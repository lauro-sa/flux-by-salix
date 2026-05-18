/**
 * /api/miembros/[id]/info-bancaria
 *
 * GET  → lista las cuentas bancarias/digitales del miembro (no eliminadas).
 *        Ordenadas por activa desc, actualizado_en desc — así la
 *        cuenta más usada y activa aparece primero.
 *
 * POST → crea una cuenta nueva. Body:
 *          { tipo_pago, banco, numero_cuenta, alias, etiqueta?,
 *            tipo_cuenta?, titular_nombre?, titular_documento?, activa? }
 *
 * Permisos:
 *   - El propio miembro puede ver y editar sus cuentas.
 *   - Otros usuarios necesitan `nomina:editar` o `usuarios:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

interface Auth { userId: string; empresaId: string }

async function verificarAuth(): Promise<Auth | null> {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return null
  const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
  if (!empresaId) return null
  return { userId: user.id, empresaId }
}

/**
 * Determina si el `auth.userId` puede leer/modificar la info bancaria
 * del `miembroId`. Reglas:
 *   1. Si es el mismo miembro (auth.userId === miembro.usuario_id), sí.
 *   2. Si tiene `nomina:editar` o `usuarios:editar`, sí.
 *   3. Sino, no.
 *
 * Devuelve { permitido: boolean, miembroEmpresaOk: boolean } — el
 * segundo flag es false si el miembro no existe en la empresa, lo
 * que se debe devolver como 404 (no 403, para no leakear existencia).
 */
async function autorizarAccesoMiembro(auth: Auth, miembroId: string) {
  const admin = crearClienteAdmin()
  const { data: miembroDest } = await admin
    .from('miembros')
    .select('id, usuario_id')
    .eq('id', miembroId)
    .eq('empresa_id', auth.empresaId)
    .maybeSingle()

  if (!miembroDest) return { permitido: false, miembroEmpresaOk: false }

  if (miembroDest.usuario_id === auth.userId) {
    return { permitido: true, miembroEmpresaOk: true }
  }

  const datosActor = await obtenerDatosMiembro(auth.userId, auth.empresaId)
  if (!datosActor) return { permitido: false, miembroEmpresaOk: true }

  const ok =
    verificarPermiso(datosActor, 'nomina', 'editar') ||
    verificarPermiso(datosActor, 'usuarios', 'editar')
  return { permitido: ok, miembroEmpresaOk: true }
}

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: miembroId } = await params

  const { permitido, miembroEmpresaOk } = await autorizarAccesoMiembro(auth, miembroId)
  if (!miembroEmpresaOk) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()
  // Orden: predeterminada primero (la que se usa al pagar siempre
  // arriba), después activas vs inactivas, después por última
  // modificación. Así, después de cambiar la default, la nueva queda
  // visualmente arriba sin que el operador tenga que buscarla.
  const { data, error } = await admin
    .from('info_bancaria')
    .select('*')
    .eq('empresa_id', auth.empresaId)
    .eq('miembro_id', miembroId)
    .eq('eliminada', false)
    .order('predeterminada', { ascending: false })
    .order('activa', { ascending: false })
    .order('actualizado_en', { ascending: false })

  if (error) {
    console.error('[info-bancaria] GET error:', error)
    return NextResponse.json({ error: 'Error al listar cuentas' }, { status: 500 })
  }
  return NextResponse.json({ cuentas: data ?? [] })
}

// ════════════════════════════════════════════════════════════════
// POST — crear cuenta nueva
// ════════════════════════════════════════════════════════════════

interface PayloadCrear {
  tipo_pago: 'banco' | 'digital'
  tipo_cuenta?: string | null
  banco?: string | null
  numero_cuenta?: string | null
  alias?: string | null
  etiqueta?: string | null
  titular_nombre?: string | null
  titular_documento?: string | null
  activa?: boolean
  /** Si true, esta cuenta queda como predeterminada y las otras
      del mismo miembro se desmarcan automáticamente. */
  predeterminada?: boolean
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: miembroId } = await params

  const { permitido, miembroEmpresaOk } = await autorizarAccesoMiembro(auth, miembroId)
  if (!miembroEmpresaOk) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: PayloadCrear
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validaciones mínimas. Mantenemos los datos opcionales: el operador
  // puede cargar una cuenta solo con alias, o solo con CBU. La
  // diferencia banco vs digital es la única clasificación obligatoria.
  if (body.tipo_pago !== 'banco' && body.tipo_pago !== 'digital') {
    return NextResponse.json({ error: "tipo_pago debe ser 'banco' o 'digital'" }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Si el miembro no tiene ninguna cuenta predeterminada todavía, esta
  // se elige como predeterminada por default (a menos que el cliente
  // mande explícitamente predeterminada=false). Cuando ya hay una,
  // respetamos la elección del operador.
  const { count: countPredet } = await admin
    .from('info_bancaria')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', auth.empresaId)
    .eq('miembro_id', miembroId)
    .eq('eliminada', false)
    .eq('predeterminada', true)
  const debePredeterminada = body.predeterminada === true
    || (body.predeterminada === undefined && (countPredet ?? 0) === 0)

  // Si esta cuenta va a ser predeterminada, desmarcamos cualquier otra
  // del mismo miembro PRIMERO (el UNIQUE parcial rechazaría 2 a la vez).
  if (debePredeterminada) {
    await admin
      .from('info_bancaria')
      .update({ predeterminada: false, actualizado_por: auth.userId })
      .eq('empresa_id', auth.empresaId)
      .eq('miembro_id', miembroId)
      .eq('eliminada', false)
      .eq('predeterminada', true)
  }

  const { data: cuenta, error } = await admin
    .from('info_bancaria')
    .insert({
      empresa_id: auth.empresaId,
      miembro_id: miembroId,
      tipo_pago: body.tipo_pago,
      tipo_cuenta: body.tipo_cuenta ?? null,
      banco: body.banco ?? null,
      numero_cuenta: body.numero_cuenta ?? null,
      alias: body.alias ?? null,
      etiqueta: body.etiqueta ?? null,
      titular_nombre: body.titular_nombre ?? null,
      titular_documento: body.titular_documento ?? null,
      activa: body.activa ?? true,
      predeterminada: debePredeterminada,
      eliminada: false,
      creado_por: auth.userId,
      actualizado_por: auth.userId,
    })
    .select()
    .single()

  if (error || !cuenta) {
    console.error('[info-bancaria] POST error:', error)
    return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 })
  }

  // Auditoría best-effort: si falla, logueamos pero no abortamos.
  await admin
    .from('auditoria_info_bancaria')
    .insert({
      empresa_id: auth.empresaId,
      info_bancaria_id: cuenta.id,
      miembro_id: miembroId,
      editado_por: auth.userId,
      accion: 'crear',
    })

  return NextResponse.json({ cuenta }, { status: 201 })
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * Catálogo por empresa de entidades financieras (bancos tradicionales
 * + billeteras virtuales). Reemplaza al viejo `/api/bancos` (que solo
 * cubría bancos). Lo consume el SelectCreable del modal de cuentas
 * bancarias del empleado para que todas las cargas usen una lista
 * canónica y se evite el clásico "Galicia / galicia / Banco Galicia".
 *
 * Permisos:
 *   • GET: cualquiera con `nomina:ver_propio` (lo lee también el
 *     empleado al ver su propia ficha).
 *   • POST/PATCH/DELETE: `config_empresa:editar` (solo admin puede
 *     ensuciar/limpiar el catálogo).
 *
 * Schema: sql/108_entidades_financieras_catalogo.sql
 */

type Tipo = 'banco' | 'digital'

const TIPOS_VALIDOS: Tipo[] = ['banco', 'digital']

/**
 * GET /api/configuracion/entidades-financieras?tipo=banco|digital
 * Lista las entidades vigentes (no eliminadas) de la empresa activa.
 * Si se pasa `tipo`, filtra solo a ese tipo.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('nomina', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const tipoParam = request.nextUrl.searchParams.get('tipo')
    const tipo = tipoParam && TIPOS_VALIDOS.includes(tipoParam as Tipo) ? tipoParam as Tipo : null

    const admin = crearClienteAdmin()
    let q = admin
      .from('entidades_financieras')
      .select('id, tipo, nombre, codigo_banco, activa')
      .eq('empresa_id', empresaId)
      .eq('eliminada', false)
      .order('nombre')

    if (tipo) q = q.eq('tipo', tipo)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entidades: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/configuracion/entidades-financieras
 * Body: { tipo: 'banco'|'digital', nombre: string, codigo_banco?: string }
 * Si ya existe una entidad con el mismo nombre+tipo (case-insensitive,
 * no eliminada), la devuelve sin duplicar.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, user } = guard

    const body = await request.json()
    const tipo: Tipo = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : 'banco'
    const nombreRaw = (body.nombre || '').trim()
    if (!nombreRaw) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    // Capitaliza palabra por palabra: "banco galicia" → "Banco Galicia".
    const nombre = nombreRaw.replace(/\b\w/g, (c: string) => c.toUpperCase())

    // Código BCRA opcional: solo 3 dígitos numéricos cuando viene.
    const codigoBancoRaw = (body.codigo_banco || '').trim()
    const codigoBanco = /^\d{3}$/.test(codigoBancoRaw) ? codigoBancoRaw : null

    const admin = crearClienteAdmin()

    // Idempotencia: si ya existe con mismo nombre+tipo, devolverla.
    const { data: existente } = await admin
      .from('entidades_financieras')
      .select('id, tipo, nombre, codigo_banco, activa')
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .ilike('nombre', nombre)
      .eq('eliminada', false)
      .maybeSingle()

    if (existente) return NextResponse.json({ entidad: existente })

    const { data, error } = await admin
      .from('entidades_financieras')
      .insert({
        empresa_id: empresaId,
        tipo,
        nombre,
        codigo_banco: codigoBanco,
        creado_por: user.id,
        actualizado_por: user.id,
      })
      .select('id, tipo, nombre, codigo_banco, activa')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auditoría
    await admin.from('auditoria_entidades_financieras').insert({
      empresa_id: empresaId,
      entidad_id: data.id,
      editado_por: user.id,
      accion: 'crear',
      campo_modificado: 'nombre',
      valor_anterior: null,
      valor_nuevo: nombre,
    })

    return NextResponse.json({ entidad: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

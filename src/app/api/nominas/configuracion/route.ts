/**
 * GET/PUT /api/nominas/configuracion — Defaults de envío del módulo.
 *
 * GET devuelve la fila de `configuracion_nomina_empresa` para la empresa
 * activa, o un objeto con todos los IDs en null si todavía no existe.
 *
 * PUT hace upsert con los IDs enviados en el body. IDs nulos se aceptan
 * y se interpretan como "borrar el default" para esa categoría.
 *
 * Auth:
 *   - GET: cualquier miembro con permiso `nomina:ver_propio` o ver_todos.
 *   - PUT: `nomina:editar`.
 *
 * Ver PLAN_MODULO_NOMINAS.md.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface ConfigEnvio {
  canal_correo_default_id: string | null
  plantilla_correo_default_id: string | null
  canal_whatsapp_default_id: string | null
  plantilla_whatsapp_default_id: string | null
}

const CAMPOS: (keyof ConfigEnvio)[] = [
  'canal_correo_default_id',
  'plantilla_correo_default_id',
  'canal_whatsapp_default_id',
  'plantilla_whatsapp_default_id',
]

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('configuracion_nomina_empresa')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error) {
    console.error('[nominas/configuracion] GET error:', error)
    return NextResponse.json({ error: 'Error al cargar configuración' }, { status: 500 })
  }

  const config: ConfigEnvio = {
    canal_correo_default_id: data?.canal_correo_default_id ?? null,
    plantilla_correo_default_id: data?.plantilla_correo_default_id ?? null,
    canal_whatsapp_default_id: data?.canal_whatsapp_default_id ?? null,
    plantilla_whatsapp_default_id: data?.plantilla_whatsapp_default_id ?? null,
  }

  return NextResponse.json({ configuracion: config })
}

// ════════════════════════════════════════════════════════════════
// PUT — upsert
// ════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Partial<ConfigEnvio>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Solo aceptamos los campos conocidos.
  const update: Record<string, string | null | Date> = {}
  for (const campo of CAMPOS) {
    if (campo in body) update[campo] = body[campo] ?? null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  update.actualizado_en = new Date().toISOString()
  update.actualizado_por = user.id

  const admin = crearClienteAdmin()
  const { error } = await admin
    .from('configuracion_nomina_empresa')
    .upsert(
      {
        empresa_id: empresaId,
        ...update,
      },
      { onConflict: 'empresa_id' },
    )

  if (error) {
    console.error('[nominas/configuracion] PUT error:', error)
    return NextResponse.json({ error: 'No se pudo guardar la configuración' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

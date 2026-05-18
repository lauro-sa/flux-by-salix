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
  /**
   * Si true, los empleados con contrato terminado antes del período
   * aparecen en gris con $0 en Liquidaciones. Si false (default), se
   * ocultan. En cualquier caso siguen visibles en la pestaña Empleados
   * con filtro "Terminados".
   */
  mostrar_empleados_terminados: boolean
  /**
   * Si true, la transición de liquidaciones_empleado_periodo de
   * 'liquidado' a 'pagado' queda bloqueada hasta pasar por 'enviado'.
   * Persistido en `empresas.nominas_envio_obligatorio` (no en esta
   * tabla) porque es política de la empresa, no solo de nómina.
   */
  envio_obligatorio: boolean
}

const CAMPOS_TEXTO: (keyof ConfigEnvio)[] = [
  'canal_correo_default_id',
  'plantilla_correo_default_id',
  'canal_whatsapp_default_id',
  'plantilla_whatsapp_default_id',
]

const CAMPOS_BOOL: (keyof ConfigEnvio)[] = ['mostrar_empleados_terminados']

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
  // Dos fuentes: configuracion_nomina_empresa (settings específicos de
  // nómina) + empresas (nominas_envio_obligatorio que es policy global).
  // Los exponemos unificados en el mismo objeto para que el cliente no
  // tenga que coordinar dos endpoints.
  const [{ data, error }, { data: emp }] = await Promise.all([
    admin
      .from('configuracion_nomina_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle(),
    admin
      .from('empresas')
      .select('nominas_envio_obligatorio')
      .eq('id', empresaId)
      .single(),
  ])

  if (error) {
    console.error('[nominas/configuracion] GET error:', error)
    return NextResponse.json({ error: 'Error al cargar configuración' }, { status: 500 })
  }

  const config: ConfigEnvio = {
    canal_correo_default_id: data?.canal_correo_default_id ?? null,
    plantilla_correo_default_id: data?.plantilla_correo_default_id ?? null,
    canal_whatsapp_default_id: data?.canal_whatsapp_default_id ?? null,
    plantilla_whatsapp_default_id: data?.plantilla_whatsapp_default_id ?? null,
    mostrar_empleados_terminados: !!data?.mostrar_empleados_terminados,
    envio_obligatorio: !!emp?.nominas_envio_obligatorio,
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

  // Solo aceptamos los campos conocidos. Separamos texto (IDs nulleables)
  // de booleanos para que los booleanos no se conviertan accidentalmente
  // a null por el `?? null`.
  const update: Record<string, string | boolean | null | Date> = {}
  for (const campo of CAMPOS_TEXTO) {
    if (campo in body) update[campo] = (body[campo] as string | null) ?? null
  }
  for (const campo of CAMPOS_BOOL) {
    if (campo in body) update[campo] = !!body[campo]
  }

  // envio_obligatorio vive en empresas (policy global), no en esta tabla.
  // Lo extraemos del body antes de upsertear configuracion_nomina_empresa.
  const cambiaEnvioObligatorio = 'envio_obligatorio' in body
  const nuevoEnvioObligatorio = !!body.envio_obligatorio

  if (Object.keys(update).length === 0 && !cambiaEnvioObligatorio) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Upsert sobre configuracion_nomina_empresa solo si hay campos para ella.
  if (Object.keys(update).length > 0) {
    update.actualizado_en = new Date().toISOString()
    update.actualizado_por = user.id

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
  }

  // Update sobre empresas si cambió envio_obligatorio.
  if (cambiaEnvioObligatorio) {
    const { error } = await admin
      .from('empresas')
      .update({ nominas_envio_obligatorio: nuevoEnvioObligatorio })
      .eq('id', empresaId)
    if (error) {
      console.error('[nominas/configuracion] PUT empresas error:', error)
      return NextResponse.json({ error: 'No se pudo actualizar envío obligatorio' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/visitas/config — Obtener configuración de visitas de la empresa.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: config } = await admin
      .from('config_visitas')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    // Si no existe, devolver defaults
    const configFinal = config || {
      checklist_predeterminado: [],
      requiere_geolocalizacion: false,
      distancia_maxima_m: 500,
      duracion_estimada_default: 30,
      motivos_predefinidos: [],
      resultados_predefinidos: [],
      enviar_avisos_whatsapp: false,
      plantilla_aviso_en_camino_id: null,
      plantilla_aviso_llegada_id: null,
    }

    return NextResponse.json(configFinal)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/visitas/config — Actualizar configuración de visitas.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_visitas', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar configuración' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    const campos: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    }

    if (body.checklist_predeterminado !== undefined) campos.checklist_predeterminado = body.checklist_predeterminado
    if (body.requiere_geolocalizacion !== undefined) campos.requiere_geolocalizacion = body.requiere_geolocalizacion
    if (body.distancia_maxima_m !== undefined) campos.distancia_maxima_m = body.distancia_maxima_m
    if (body.duracion_estimada_default !== undefined) campos.duracion_estimada_default = body.duracion_estimada_default
    if (body.motivos_predefinidos !== undefined) campos.motivos_predefinidos = body.motivos_predefinidos
    if (body.resultados_predefinidos !== undefined) campos.resultados_predefinidos = body.resultados_predefinidos
    if (body.enviar_avisos_whatsapp !== undefined) campos.enviar_avisos_whatsapp = body.enviar_avisos_whatsapp

    // Plantillas WhatsApp seleccionadas para los avisos del recorrido.
    // Validación: si vienen seteadas, deben (1) existir, (2) pertenecer a la empresa,
    // (3) estar APPROVED, (4) tener la cantidad de variables esperada — sino el envío
    // a Meta truena con un error críptico. Mejor frenar acá con un mensaje claro.
    const VARIABLES_ESPERADAS = {
      en_camino: 3, // contacto_nombre, visita_direccion, visita_eta
      llegada: 2,   // contacto_nombre, visita_direccion
    }

    async function validarPlantilla(
      plantillaId: string | null,
      variablesEsperadas: number,
      campo: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> {
      if (!plantillaId) return { ok: true } // null = volver al default
      const adminCli = crearClienteAdmin()
      const { data: plantilla } = await adminCli
        .from('plantillas_whatsapp')
        .select('id, estado_meta, componentes')
        .eq('id', plantillaId)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!plantilla) return { ok: false, error: `${campo}: plantilla no encontrada` }
      if (plantilla.estado_meta !== 'APPROVED') {
        return { ok: false, error: `${campo}: la plantilla no está aprobada por Meta` }
      }
      const cuerpo = (plantilla.componentes as { cuerpo?: { mapeo_variables?: string[] } } | null)?.cuerpo
      const cantidad = cuerpo?.mapeo_variables?.length ?? 0
      if (cantidad !== variablesEsperadas) {
        return { ok: false, error: `${campo}: la plantilla debe tener exactamente ${variablesEsperadas} variables (tiene ${cantidad})` }
      }
      return { ok: true }
    }

    if (body.plantilla_aviso_en_camino_id !== undefined) {
      const v = await validarPlantilla(body.plantilla_aviso_en_camino_id, VARIABLES_ESPERADAS.en_camino, 'plantilla_aviso_en_camino')
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      campos.plantilla_aviso_en_camino_id = body.plantilla_aviso_en_camino_id
    }
    if (body.plantilla_aviso_llegada_id !== undefined) {
      const v = await validarPlantilla(body.plantilla_aviso_llegada_id, VARIABLES_ESPERADAS.llegada, 'plantilla_aviso_llegada')
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      campos.plantilla_aviso_llegada_id = body.plantilla_aviso_llegada_id
    }

    // Upsert: crear si no existe
    const { data, error } = await admin
      .from('config_visitas')
      .upsert({
        empresa_id: empresaId,
        ...campos,
      }, { onConflict: 'empresa_id' })
      .select()
      .single()

    if (error) {
      console.error('Error al actualizar config visitas:', error)
      return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

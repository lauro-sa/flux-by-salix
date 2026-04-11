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

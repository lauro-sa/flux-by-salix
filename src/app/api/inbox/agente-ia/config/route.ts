import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/agente-ia/config — Obtener configuración del agente IA de la empresa.
 * PUT /api/inbox/agente-ia/config — Guardar configuración del agente IA.
 */

export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('config_agente_ia')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    return NextResponse.json({ config: data || null })
  } catch (err) {
    console.error('Error al obtener config agente IA:', err)
    return NextResponse.json({ config: null })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Validar y sanitizar campos
    const camposPermitidos = [
      'activo', 'nombre', 'apodo', 'personalidad', 'instrucciones', 'idioma',
      'canales_activos', 'modo_activacion', 'delay_segundos', 'max_mensajes_auto',
      'puede_responder', 'puede_clasificar', 'puede_enrutar', 'puede_resumir',
      'puede_sentimiento', 'puede_crear_actividad', 'puede_actualizar_contacto',
      'puede_etiquetar', 'modo_respuesta', 'tono', 'largo_respuesta', 'firmar_como',
      'usar_base_conocimiento', 'escalar_si_negativo', 'escalar_si_no_sabe',
      'escalar_palabras', 'mensaje_escalamiento', 'acciones_habilitadas',
      // Campos v2: configuración estructurada
      'zona_cobertura', 'sitio_web', 'horario_atencion', 'correo_empresa',
      'servicios_si', 'servicios_no', 'tipos_contacto', 'flujo_conversacion',
      'reglas_agenda', 'info_precios', 'situaciones_especiales',
      'ejemplos_conversacion', 'respuesta_si_bot', 'vocabulario_natural',
    ]

    const datosFiltrados: Record<string, unknown> = {}
    for (const campo of camposPermitidos) {
      if (campo in body) datosFiltrados[campo] = body[campo]
    }

    // Validar tipos específicos
    if (datosFiltrados.nombre && typeof datosFiltrados.nombre !== 'string') {
      return NextResponse.json({ error: 'nombre debe ser texto' }, { status: 400 })
    }
    if (datosFiltrados.delay_segundos !== undefined) {
      datosFiltrados.delay_segundos = Math.max(0, Math.min(300, Number(datosFiltrados.delay_segundos) || 0))
    }
    if (datosFiltrados.max_mensajes_auto !== undefined) {
      datosFiltrados.max_mensajes_auto = Math.max(1, Math.min(50, Number(datosFiltrados.max_mensajes_auto) || 5))
    }

    const { data, error } = await admin
      .from('config_agente_ia')
      .upsert({
        empresa_id: empresaId,
        ...datosFiltrados,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })
      .select()
      .single()

    if (error) throw error

    // Si se desactivó el agente IA globalmente, desactivar en todas las conversaciones
    if (datosFiltrados.activo === false) {
      await admin
        .from('conversaciones')
        .update({ agente_ia_activo: false, ia_pausado_hasta: null })
        .eq('empresa_id', empresaId)
        .eq('agente_ia_activo', true)
    }

    return NextResponse.json({ config: data })
  } catch (err) {
    console.error('Error al guardar config agente IA:', err)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}

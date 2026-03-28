import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  enviarTextoWhatsApp, enviarMediaWhatsApp, enviarPlantillaWhatsApp,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'

/**
 * POST /api/inbox/whatsapp/enviar — Enviar mensaje de WhatsApp.
 * Soporta: texto, media (imagen/video/audio/doc), plantilla.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const {
      conversacion_id, canal_id, texto, tipo = 'texto',
      // Media
      media_url, media_caption, media_filename,
      // Plantilla
      plantilla_nombre_api, plantilla_idioma, plantilla_componentes,
      // Firma
      firma_texto,
    } = body

    if (!conversacion_id || !canal_id) {
      return NextResponse.json({ error: 'conversacion_id y canal_id son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener canal y config
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('id, config_conexion')
      .eq('id', canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

    // Obtener conversación para el teléfono del contacto
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('identificador_externo')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.identificador_externo) {
      return NextResponse.json({ error: 'Conversación sin número de teléfono' }, { status: 400 })
    }

    const telefono = conversacion.identificador_externo

    // Obtener nombre del agente
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreAgente = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Agente'

    // Agregar firma si está configurada
    let textoFinal = texto || ''
    if (firma_texto && textoFinal) {
      textoFinal = `${textoFinal}\n\n— ${firma_texto}`
    }

    let resultado

    // Enviar según tipo
    if (tipo === 'plantilla' && plantilla_nombre_api) {
      resultado = await enviarPlantillaWhatsApp(
        config, telefono,
        plantilla_nombre_api,
        plantilla_idioma || 'es',
        plantilla_componentes,
      )
    } else if (['imagen', 'video', 'audio', 'documento'].includes(tipo) && media_url) {
      const tipoMeta = tipo === 'imagen' ? 'image' : tipo === 'documento' ? 'document' : tipo as 'video' | 'audio'
      resultado = await enviarMediaWhatsApp(
        config, telefono,
        tipoMeta, media_url,
        media_caption, media_filename,
      )
    } else {
      resultado = await enviarTextoWhatsApp(config, telefono, textoFinal)
    }

    const waMessageId = resultado.messages?.[0]?.id

    // Guardar mensaje en BD
    const { data: mensaje } = await admin
      .from('mensajes')
      .insert({
        empresa_id: empresaId,
        conversacion_id,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_id: user.id,
        remitente_nombre: nombreAgente,
        tipo_contenido: tipo === 'plantilla' ? 'texto' : tipo,
        texto: textoFinal || `[${tipo}]`,
        wa_message_id: waMessageId,
        wa_status: 'sent',
        estado: 'enviado',
      })
      .select()
      .single()

    // Actualizar conversación
    await admin
      .from('conversaciones')
      .update({
        ultimo_mensaje_texto: textoFinal || `[${tipo}]`,
        ultimo_mensaje_en: new Date().toISOString(),
        ultimo_mensaje_es_entrante: false,
        tiempo_sin_respuesta_desde: null, // agente respondió
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', conversacion_id)

    return NextResponse.json({ mensaje, wa_message_id: waMessageId }, { status: 201 })
  } catch (err) {
    console.error('Error al enviar WhatsApp:', err)
    return NextResponse.json({ error: `Error al enviar: ${(err as Error).message}` }, { status: 500 })
  }
}

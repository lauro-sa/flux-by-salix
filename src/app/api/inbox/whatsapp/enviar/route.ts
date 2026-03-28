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

    if (!conversacion_id) {
      return NextResponse.json({ error: 'conversacion_id es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener conversación para el teléfono y canal_id
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('identificador_externo, canal_id')
      .eq('id', conversacion_id)
      .single()

    if (!conversacion?.identificador_externo) {
      return NextResponse.json({ error: 'Conversación sin número de teléfono' }, { status: 400 })
    }

    const telefono = conversacion.identificador_externo
    const canalIdFinal = canal_id || conversacion.canal_id

    // Obtener canal y config
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('id, config_conexion')
      .eq('id', canalIdFinal)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

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

    // Mapear tipo a formato de Meta (acepta inglés o español)
    const mapaMetaTipo: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
      image: 'image', imagen: 'image',
      video: 'video',
      audio: 'audio',
      document: 'document', documento: 'document',
    }
    const mapaFluxTipo: Record<string, string> = {
      image: 'imagen', imagen: 'imagen',
      video: 'video',
      audio: 'audio',
      document: 'documento', documento: 'documento',
      text: 'texto', texto: 'texto',
      plantilla: 'texto',
    }
    const tipoMeta = mapaMetaTipo[tipo]
    const tipoFlux = mapaFluxTipo[tipo] || 'texto'

    // Enviar según tipo
    if (tipo === 'plantilla' && plantilla_nombre_api) {
      resultado = await enviarPlantillaWhatsApp(
        config, telefono,
        plantilla_nombre_api,
        plantilla_idioma || 'es',
        plantilla_componentes,
      )
    } else if (tipoMeta && media_url) {
      resultado = await enviarMediaWhatsApp(
        config, telefono,
        tipoMeta, media_url,
        media_caption, media_filename,
      )
    } else {
      resultado = await enviarTextoWhatsApp(config, telefono, textoFinal)
    }

    const waMessageId = resultado.messages?.[0]?.id

    // Texto para preview (no guardar placeholders como [audio])
    const textoPreview = tipoFlux === 'texto'
      ? textoFinal
      : media_caption || ''
    const textoConversacion = tipoFlux === 'texto'
      ? textoFinal
      : media_caption || `📎 ${tipoFlux.charAt(0).toUpperCase() + tipoFlux.slice(1)}`

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
        tipo_contenido: tipoFlux,
        texto: textoPreview,
        wa_message_id: waMessageId,
        wa_status: 'sent',
        estado: 'enviado',
      })
      .select()
      .single()

    // Si es media, crear adjunto en BD para que se muestre el reproductor/imagen
    if (tipoMeta && media_url && mensaje) {
      const mimeParaAdjunto = tipoMeta === 'image' ? 'image/jpeg'
        : tipoMeta === 'video' ? 'video/mp4'
        : tipoMeta === 'audio' ? 'audio/mpeg'
        : 'application/octet-stream'
      await admin.from('mensaje_adjuntos').insert({
        mensaje_id: mensaje.id,
        empresa_id: empresaId,
        nombre_archivo: media_filename || `${tipoFlux}_${Date.now()}`,
        tipo_mime: mimeParaAdjunto,
        url: media_url,
        storage_path: '',
        es_sticker: false,
        es_animado: false,
      })
    }

    // Actualizar conversación
    await admin
      .from('conversaciones')
      .update({
        ultimo_mensaje_texto: textoConversacion,
        ultimo_mensaje_en: new Date().toISOString(),
        ultimo_mensaje_es_entrante: false,
        tiempo_sin_respuesta_desde: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', conversacion_id)

    // Recargar mensaje con adjuntos incluidos
    const { data: mensajeCompleto } = await admin
      .from('mensajes')
      .select('*, adjuntos:mensaje_adjuntos(*)')
      .eq('id', mensaje.id)
      .single()

    return NextResponse.json({ mensaje: mensajeCompleto || mensaje, wa_message_id: waMessageId }, { status: 201 })
  } catch (err) {
    console.error('Error al enviar WhatsApp:', err)
    return NextResponse.json({ error: `Error al enviar: ${(err as Error).message}` }, { status: 500 })
  }
}

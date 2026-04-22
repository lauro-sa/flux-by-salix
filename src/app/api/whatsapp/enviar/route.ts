import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import {
  enviarTextoWhatsApp, enviarMediaWhatsApp, enviarPlantillaWhatsApp,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'
import { generarNombreRemitente } from '@/lib/nombre-remitente'
import { obtenerConfigPausa, calcularPausaPorRespuestaHumana } from '@/lib/whatsapp-pausa'

/**
 * POST /api/whatsapp/enviar — Enviar mensaje de WhatsApp.
 * Soporta: texto, media (imagen/video/audio/doc), plantilla.
 */
export async function POST(request: NextRequest) {
  try {
    // Detectar llamada desde cron (envío programado) via headers internos
    const programadoPor = request.headers.get('x-programado-por')
    const empresaIdCron = request.headers.get('x-empresa-id')
    const esProgramado = !!(programadoPor && empresaIdCron)

    let userId: string
    let empresaId: string

    if (esProgramado) {
      // Llamada interna del cron — usar datos del header
      userId = programadoPor
      empresaId = empresaIdCron
    } else {
      // Llamada normal de usuario — requiere sesión
      const { user } = await obtenerUsuarioRuta()
      if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

      const empId = user.app_metadata?.empresa_activa_id
      if (!empId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

      // Verificar permiso de enviar mensajes por WhatsApp
      const { permitido } = await obtenerYVerificarPermiso(user.id, empId, 'inbox_whatsapp', 'enviar')
      if (!permitido) {
        return NextResponse.json({ error: 'Sin permiso para enviar mensajes por WhatsApp' }, { status: 403 })
      }

      userId = user.id
      empresaId = empId
    }

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
      .from('canales_whatsapp')
      .select('id, config_conexion')
      .eq('id', canalIdFinal)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

    // Obtener nombre del agente con formato personalizado
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, formato_nombre_remitente')
      .eq('id', userId)
      .single()

    let sectorNombre: string | null = null
    const { data: miembro } = await admin
      .from('miembros').select('id')
      .eq('usuario_id', userId).eq('empresa_id', empresaId).single()
    if (miembro) {
      const { data: ms } = await admin
        .from('miembros_sectores').select('sector_id')
        .eq('miembro_id', miembro.id).eq('es_primario', true).single()
      if (ms) {
        const { data: sector } = await admin
          .from('sectores').select('nombre').eq('id', ms.sector_id).single()
        if (sector) sectorNombre = sector.nombre
      }
    }

    const nombreAgente = perfil
      ? generarNombreRemitente(perfil.formato_nombre_remitente, {
          nombre: perfil.nombre, apellido: perfil.apellido, sector: sectorNombre,
        })
      : 'Agente'

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

    // Texto para preview — para plantillas, obtener el cuerpo de la plantilla
    let textoPreview = ''
    let textoConversacion = ''

    if (tipo === 'plantilla' && plantilla_nombre_api) {
      // Buscar la plantilla para obtener su texto como preview
      const { data: plantillaDb } = await admin
        .from('plantillas_whatsapp')
        .select('componentes, nombre')
        .eq('nombre_api', plantilla_nombre_api)
        .eq('empresa_id', empresaId)
        .limit(1)
        .maybeSingle()

      let cuerpoPlantilla = plantillaDb?.componentes?.cuerpo?.texto || plantilla_nombre_api
      // Reemplazar variables con los parámetros enviados
      const parametros = plantilla_componentes
        ?.find((c: { type: string }) => c.type === 'body')
        ?.parameters as { text: string }[] | undefined
      if (parametros) {
        cuerpoPlantilla = cuerpoPlantilla.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) => {
          const idx = parseInt(num) - 1
          return parametros[idx]?.text || `{{${num}}}`
        })
      }
      textoPreview = cuerpoPlantilla
      textoConversacion = `📋 ${plantillaDb?.nombre || plantilla_nombre_api}`
    } else if (tipoFlux === 'texto') {
      textoPreview = textoFinal
      textoConversacion = textoFinal
    } else {
      textoPreview = media_caption || ''
      textoConversacion = media_caption || `📎 ${tipoFlux.charAt(0).toUpperCase() + tipoFlux.slice(1)}`
    }

    // Guardar mensaje en BD
    const { data: mensaje } = await admin
      .from('mensajes')
      .insert({
        empresa_id: empresaId,
        conversacion_id,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_id: userId,
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

    // Actualizar conversación (incluye limpiar tiempo sin respuesta).
    // Además: si la empresa tiene configurada pausa de automatizaciones por respuesta humana,
    // se apagan chatbot y/o agente IA según modo (siempre_activo, manual, temporal).
    const ahoraISO = new Date().toISOString()
    const configPausa = await obtenerConfigPausa(admin, empresaId)
    const pausaUpdates = calcularPausaPorRespuestaHumana(configPausa)
    await admin
      .from('conversaciones')
      .update({
        ultimo_mensaje_texto: textoConversacion,
        ultimo_mensaje_en: ahoraISO,
        ultimo_mensaje_es_entrante: false,
        tiempo_sin_respuesta_desde: null,
        actualizado_en: ahoraISO,
        ...pausaUpdates,
      })
      .eq('id', conversacion_id)

    // ─── SLA: registrar primera respuesta del agente ───
    try {
      // Obtener datos SLA de la conversación
      const { data: convSla } = await admin
        .from('conversaciones')
        .select('sla_primera_respuesta_en, sla_primera_respuesta_vence_en')
        .eq('id', conversacion_id)
        .single()

      // Solo registrar si es la primera respuesta (sla_primera_respuesta_en aún no tiene valor)
      if (convSla && !convSla.sla_primera_respuesta_en) {
        const ahora = new Date()
        const venceEn = convSla.sla_primera_respuesta_vence_en
          ? new Date(convSla.sla_primera_respuesta_vence_en)
          : null

        // Determinar si se cumplió el SLA (respondió antes de que venciera)
        const slaCumplido = venceEn ? ahora <= venceEn : true

        await admin
          .from('conversaciones')
          .update({
            sla_primera_respuesta_en: ahora.toISOString(),
            sla_primera_respuesta_cumplido: slaCumplido,
          })
          .eq('id', conversacion_id)
      }
    } catch (err) {
      // Si las columnas SLA no existen aún, falla silenciosamente
      console.warn('[SLA] Error registrando primera respuesta:', err)
    }

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

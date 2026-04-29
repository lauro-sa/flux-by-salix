import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  enviarPlantillaWhatsApp,
  enviarTextoWhatsApp,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'
import { registrarChatter } from '@/lib/chatter'
import { normalizarTelefono, generarVariantesTelefono } from '@/lib/validaciones'
import { obtenerConfigPausa, calcularPausaPorRespuestaHumana } from '@/lib/whatsapp-pausa'

/**
 * POST /api/chatter/enviar-whatsapp
 * Envía un mensaje de WhatsApp desde el chatter de un documento.
 * Maneja todo el flujo: busca canal WA, encuentra/crea conversación, envía, registra.
 *
 * Body: {
 *   telefono: string              — Número del destinatario
 *   contacto_id?: string          — ID del contacto (para vincular conversación)
 *   contacto_nombre?: string      — Nombre del contacto
 *   entidad_tipo: string          — 'presupuesto', 'factura', etc.
 *   entidad_id: string            — UUID del documento
 *   // Para plantilla:
 *   plantilla_id?: string         — ID de la plantilla en BD
 *   plantilla_nombre_api?: string — Nombre API de la plantilla en Meta
 *   plantilla_idioma?: string     — Idioma de la plantilla (default: 'es')
 *   plantilla_componentes?: any[] — Componentes con variables resueltas
 *   plantilla_texto_preview?: string — Texto preview para mostrar en chatter
 *   // Para texto libre (solo si hay conversación activa):
 *   texto?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_whatsapp', 'enviar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const {
      telefono, contacto_id, contacto_nombre,
      entidad_tipo, entidad_id,
      plantilla_id, plantilla_nombre_api, plantilla_idioma = 'es',
      plantilla_componentes, plantilla_texto_preview,
      plantilla_botones,
      texto,
    } = body

    if (!telefono) {
      return NextResponse.json({ error: 'Se requiere número de teléfono' }, { status: 400 })
    }
    if (!entidad_tipo || !entidad_id) {
      return NextResponse.json({ error: 'Se requiere entidad_tipo y entidad_id' }, { status: 400 })
    }
    if (!plantilla_nombre_api && !texto) {
      return NextResponse.json({ error: 'Se requiere plantilla o texto' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // 1. Buscar canal WhatsApp de la empresa
    const { data: canales } = await admin
      .from('canales_whatsapp')
      .select('id, config_conexion')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .limit(1)

    if (!canales?.length) {
      return NextResponse.json({ error: 'No hay canal de WhatsApp configurado' }, { status: 404 })
    }

    const canal = canales[0]
    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

    // 2. Normalizar teléfono al formato canónico E.164 sin `+` (con el 9 para móviles AR).
    // Meta espera el formato con + al enviar.
    const telefonoCanónico = normalizarTelefono(telefono) || telefono.replace(/[^\d]/g, '')
    const telConPlus = `+${telefonoCanónico}`
    const variantesTel = generarVariantesTelefono(telefono)

    // 3. Buscar conversación existente con este número (cualquier variante).
    // Traemos `estado` para saber si hay que reabrirla (caso plantilla a conversación resuelta).
    let conversacionId: string | null = null
    let conversacionEstaba: 'abierta' | 'en_espera' | 'resuelta' | 'spam' | null = null
    const orConv = variantesTel.map(v => `identificador_externo.eq.${v}`).join(',')
    const { data: convExistente, error: errConv } = await admin
      .from('conversaciones')
      .select('id, identificador_externo, contacto_id, estado')
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', 'whatsapp')
      .or(orConv)
      .limit(1)

    if (errConv) {
      console.error('Error buscando conversación:', errConv)
    }

    if (convExistente?.length) {
      conversacionId = convExistente[0].id
      conversacionEstaba = (convExistente[0].estado as typeof conversacionEstaba) || null
      // Migrar formato canónico + vincular contacto si no tiene
      const updates: Record<string, unknown> = {}
      if (convExistente[0].identificador_externo !== telefonoCanónico) {
        updates.identificador_externo = telefonoCanónico
      }
      if (contacto_id && !convExistente[0].contacto_id) {
        updates.contacto_id = contacto_id
        updates.contacto_nombre = contacto_nombre || null
      }
      if (Object.keys(updates).length > 0) {
        await admin
          .from('conversaciones')
          .update(updates)
          .eq('id', convExistente[0].id)
      }
    } else {
      // 4. Crear conversación nueva con formato canónico (sin +)
      const { data: nuevaConv } = await admin
        .from('conversaciones')
        .insert({
          empresa_id: empresaId,
          canal_id: canal.id,
          tipo_canal: 'whatsapp',
          identificador_externo: telefonoCanónico,
          contacto_id: contacto_id || null,
          contacto_nombre: contacto_nombre || null,
          estado: 'abierta',
          ultimo_mensaje_texto: plantilla_texto_preview || texto || '',
          ultimo_mensaje_en: new Date().toISOString(),
          ultimo_mensaje_es_entrante: false,
        })
        .select('id')
        .single()

      if (!nuevaConv) {
        return NextResponse.json({ error: 'Error al crear conversación' }, { status: 500 })
      }
      conversacionId = nuevaConv.id
    }

    // 5. Obtener perfil del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()

    const nombreAgente = perfil
      ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
      : 'Agente'

    // 6. Enviar mensaje via Meta API
    let resultado
    const esPlantilla = !!plantilla_nombre_api

    try {
      if (esPlantilla) {
        resultado = await enviarPlantillaWhatsApp(
          config,
          telConPlus,
          plantilla_nombre_api,
          plantilla_idioma,
          plantilla_componentes,
        )
      } else {
        resultado = await enviarTextoWhatsApp(config, telConPlus, texto)
      }
    } catch (errMeta) {
      const mensajeError = errMeta instanceof Error ? errMeta.message : String(errMeta)
      console.error('Error Meta API WhatsApp:', mensajeError)
      return NextResponse.json({
        error: `Error Meta API: ${mensajeError}`,
      }, { status: 502 })
    }

    const waMessageId = resultado.messages?.[0]?.id
    const textoMensaje = esPlantilla ? (plantilla_texto_preview || `Plantilla: ${plantilla_nombre_api}`) : texto

    // 7. Guardar mensaje en tabla mensajes
    await admin
      .from('mensajes')
      .insert({
        empresa_id: empresaId,
        conversacion_id: conversacionId,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_id: user.id,
        remitente_nombre: nombreAgente,
        tipo_contenido: 'texto',
        texto: textoMensaje,
        wa_message_id: waMessageId,
        wa_status: 'sent',
        estado: 'enviado',
        plantilla_id: plantilla_id || null,
        metadata: plantilla_botones?.length ? { botones: plantilla_botones } : {},
      })

    // 8. Actualizar conversación.
    // Aplicamos la misma lógica de pausa de automatizaciones que /api/whatsapp/enviar:
    // un humano enviando (incluso una plantilla desde una entidad) debe pausar chatbot/IA
    // según la config de la empresa. Si la conversación estaba resuelta, la reabrimos
    // acá mismo para no depender de que el cliente responda.
    const ahoraISO = new Date().toISOString()
    const configPausa = await obtenerConfigPausa(admin, empresaId)
    const pausaUpdates = calcularPausaPorRespuestaHumana(configPausa)
    const updateConv: Record<string, unknown> = {
      ultimo_mensaje_texto: textoMensaje,
      ultimo_mensaje_en: ahoraISO,
      ultimo_mensaje_es_entrante: false,
      actualizado_en: ahoraISO,
      ...pausaUpdates,
    }
    if (conversacionEstaba === 'resuelta') {
      updateConv.estado = 'abierta'
      updateConv.cerrado_en = null
      updateConv.cerrado_por = null
    }
    await admin
      .from('conversaciones')
      .update(updateConv)
      .eq('id', conversacionId)

    // 9. Registrar en chatter del documento
    await registrarChatter({
      empresaId,
      entidadTipo: entidad_tipo,
      entidadId: entidad_id,
      tipo: 'whatsapp',
      contenido: textoMensaje,
      autorId: user.id,
      autorNombre: nombreAgente,
      autorAvatarUrl: perfil?.avatar_url || null,
      metadata: {
        accion: 'whatsapp_enviado',
        whatsapp_numero: telefonoCanónico,
        whatsapp_destinatario: contacto_nombre || undefined,
        whatsapp_plantilla: plantilla_nombre_api || undefined,
        whatsapp_botones: plantilla_botones || undefined,
        wa_message_id: waMessageId || undefined,
        wa_status: 'sent',
      },
    })

    return NextResponse.json({
      ok: true,
      wa_message_id: waMessageId,
      conversacion_id: conversacionId,
    }, { status: 201 })
  } catch (error) {
    console.error('Error al enviar WhatsApp desde chatter:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error al enviar WhatsApp',
    }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { enviarPlantillaWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'
import { normalizarTelefono, generarVariantesTelefono } from '@/lib/validaciones'
import { calcularETA, redondearETA, formatearETATexto } from '@/lib/eta'
import { resolverTextoPlantilla, resolverParametrosCuerpo } from '@/lib/whatsapp/variables'
import type { CuerpoPlantillaWA } from '@/tipos/whatsapp'

const NOMBRE_PLANTILLA = 'flux_aviso_en_camino'

/**
 * POST /api/recorrido/aviso-en-camino
 * Envía (o previsualiza) el aviso "voy en camino" al contacto de una visita usando la
 * plantilla de sistema `flux_aviso_en_camino`. Calcula ETA con Google Directions y lo
 * redondea a un múltiplo amigable antes de armarlo como variable {{2}}.
 *
 * Body:
 *   visita_id: string
 *   ubicacion_actual?: { lat, lng }
 *   solo_preview?: boolean
 *
 * Respuesta:
 *   eta_min_real: number | null
 *   eta_min_comunicado: number | null
 *   mensaje: string                       — texto con variables ya resueltas
 *   telefono: string | null
 *   tiene_whatsapp: boolean
 *   plantilla_estado: 'APPROVED' | 'BORRADOR' | 'PENDING' | 'REJECTED' | 'FALTANTE' | ...
 *   plantilla_lista: boolean              — true solo si está APPROVED
 *   enviado: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'registrar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json() as {
      visita_id: string
      ubicacion_actual?: { lat: number; lng: number } | null
      solo_preview?: boolean
    }
    const { visita_id, ubicacion_actual, solo_preview } = body

    if (!visita_id) {
      return NextResponse.json({ error: 'Falta visita_id' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // 1. Visita
    const { data: visita } = await admin
      .from('visitas')
      .select('id, contacto_id, contacto_nombre, recibe_nombre, recibe_telefono, recibe_contacto_id, direccion_texto, direccion_lat, direccion_lng')
      .eq('id', visita_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) {
      return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
    }

    const nombreDestinatario = (visita.recibe_nombre || visita.contacto_nombre || '').trim()

    // 2. Teléfono — prioridades:
    //    1) recibe_telefono (snapshot escrito a mano en la visita)
    //    2) móvil WhatsApp principal del recibe_contacto_id (contacto de recepción vinculado)
    //    3) móvil WhatsApp principal del contacto_id (contacto principal de la visita)
    //    Así soportamos el caso típico donde el contacto principal es un edificio/empresa
    //    sin teléfono, pero la persona que recibe (Viviana en oficina 3B) sí lo tiene.
    let telefono: string | null = visita.recibe_telefono || null
    if (!telefono) {
      const idBusqueda = visita.recibe_contacto_id || visita.contacto_id
      const { data: tel } = await admin
        .from('contacto_telefonos')
        .select('valor')
        .eq('contacto_id', idBusqueda)
        .eq('es_whatsapp', true)
        .eq('es_principal', true)
        .maybeSingle()
      telefono = tel?.valor || null
      // Fallback adicional: si buscamos por recibe_contacto_id y no encontramos,
      // probá con el contacto principal de la visita.
      if (!telefono && visita.recibe_contacto_id && visita.recibe_contacto_id !== visita.contacto_id) {
        const { data: telPrincipal } = await admin
          .from('contacto_telefonos')
          .select('valor')
          .eq('contacto_id', visita.contacto_id)
          .eq('es_whatsapp', true)
          .eq('es_principal', true)
          .maybeSingle()
        telefono = telPrincipal?.valor || null
      }
    }

    // 3. Calcular ETA si tenemos ubicación actual + destino con coordenadas
    let etaReal: number | null = null
    if (
      ubicacion_actual?.lat != null && ubicacion_actual?.lng != null &&
      visita.direccion_lat != null && visita.direccion_lng != null
    ) {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY
      if (apiKey) {
        const resultado = await calcularETA(
          { lat: ubicacion_actual.lat, lng: ubicacion_actual.lng },
          { lat: visita.direccion_lat, lng: visita.direccion_lng },
          apiKey,
        )
        if (resultado) etaReal = resultado.duracion_min
      }
    }

    const etaComunicado = etaReal != null ? redondearETA(etaReal) : null

    // 4. Obtener plantilla de la empresa
    const { data: plantilla } = await admin
      .from('plantillas_whatsapp')
      .select('id, idioma, estado_meta, componentes, canal_id')
      .eq('empresa_id', empresaId)
      .eq('nombre_api', NOMBRE_PLANTILLA)
      .eq('activo', true)
      .maybeSingle()

    const estadoPlantilla: string = plantilla?.estado_meta || 'FALTANTE'
    const plantillaLista = estadoPlantilla === 'APPROVED'

    // 5. Armar valores de variables runtime
    const valorNombre = nombreDestinatario || 'estimado cliente'
    const valorDireccion = visita.direccion_texto || 'su dirección'
    const valorETA = etaReal != null ? formatearETATexto(etaReal) : 'en breve'

    // Cuerpo de la plantilla (con fallback genérico si no existe en BD)
    const cuerpoPlantilla: CuerpoPlantillaWA = (plantilla?.componentes as { cuerpo?: CuerpoPlantillaWA } | null)?.cuerpo
      || {
        texto: 'Hola {{1}}, le informamos que nuestro visitador va en camino a:\n*{{2}}*.\n\nEstará llegando {{3}}.\n\nAnte cualquier consulta, no dude en comunicarse con nosotros.\n\nMuchas gracias.',
        mapeo_variables: ['contacto_nombre', 'visita_direccion', 'visita_eta'],
        ejemplos: ['', '', ''],
      }

    // Datos runtime: prioriza "recibe" > contacto principal
    const datosRuntime: Record<string, string> = {}
    if (valorNombre) datosRuntime['contacto_nombre'] = valorNombre
    if (valorDireccion) datosRuntime['visita_direccion'] = valorDireccion
    // `visita_eta` no se calcula desde la BD — es runtime (Google Directions)
    datosRuntime['visita_eta'] = valorETA

    const mensaje = resolverTextoPlantilla(cuerpoPlantilla.texto || '', cuerpoPlantilla, datosRuntime)

    const tieneWhatsApp = !!telefono

    // ---------------- Modo preview ----------------
    if (solo_preview) {
      return NextResponse.json({
        eta_min_real: etaReal,
        eta_min_comunicado: etaComunicado,
        mensaje,
        telefono,
        tiene_whatsapp: tieneWhatsApp,
        plantilla_estado: estadoPlantilla,
        plantilla_lista: plantillaLista,
        enviado: false,
      })
    }

    // ---------------- Modo envío ----------------
    if (!tieneWhatsApp) {
      return NextResponse.json({ error: 'El contacto no tiene teléfono de WhatsApp' }, { status: 400 })
    }
    if (!plantilla) {
      return NextResponse.json({ error: `Plantilla ${NOMBRE_PLANTILLA} no existe en esta empresa` }, { status: 400 })
    }
    if (!plantillaLista) {
      return NextResponse.json({
        error: `Plantilla pendiente de aprobación por Meta (estado: ${estadoPlantilla}). Enviala desde la pantalla de Plantillas para habilitarla.`,
      }, { status: 400 })
    }

    // 6. Canal WhatsApp activo
    const { data: canal } = await admin
      .from('canales_whatsapp')
      .select('id, config_conexion')
      .eq('id', plantilla.canal_id || '')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .maybeSingle()

    const { data: canalFallback } = canal ? { data: canal } : await admin
      .from('canales_whatsapp')
      .select('id, config_conexion')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    const canalActivo = canal || canalFallback
    if (!canalActivo) {
      return NextResponse.json({ error: 'No hay canal de WhatsApp configurado' }, { status: 404 })
    }
    const config = canalActivo.config_conexion as unknown as ConfigCuentaWhatsApp

    // 7. Normalizar teléfono
    const telefonoCanonico = normalizarTelefono(telefono!) || telefono!.replace(/\D/g, '')
    const telConPlus = `+${telefonoCanonico}`
    const variantesTel = generarVariantesTelefono(telefono!)

    // 8. Enviar la plantilla a Meta
    // Armar parameters dinámicos según el mapeo del cuerpo (mismo resolver que el editor)
    const parametrosCuerpo = resolverParametrosCuerpo(cuerpoPlantilla, datosRuntime) || []
    const plantillaComponentes = parametrosCuerpo.length > 0
      ? [{ type: 'body', parameters: parametrosCuerpo }]
      : undefined

    let waMessageId: string | undefined
    try {
      const resultado = await enviarPlantillaWhatsApp(
        config,
        telConPlus,
        NOMBRE_PLANTILLA,
        plantilla.idioma || 'es',
        plantillaComponentes,
      )
      waMessageId = resultado.messages?.[0]?.id
    } catch (errMeta) {
      const detalle = errMeta instanceof Error ? errMeta.message : String(errMeta)
      return NextResponse.json({ error: `Error Meta API: ${detalle}` }, { status: 502 })
    }

    // 9. Buscar o crear conversación para que el mensaje aparezca en inbox
    let conversacionId: string | null = null
    const orConv = variantesTel.map(v => `identificador_externo.eq.${v}`).join(',')
    const { data: convExistente } = await admin
      .from('conversaciones')
      .select('id, contacto_id')
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', 'whatsapp')
      .or(orConv)
      .limit(1)

    if (convExistente?.length) {
      conversacionId = convExistente[0].id
      if (visita.contacto_id && !convExistente[0].contacto_id) {
        await admin
          .from('conversaciones')
          .update({ contacto_id: visita.contacto_id, contacto_nombre: nombreDestinatario || null })
          .eq('id', conversacionId)
      }
    } else {
      const { data: nuevaConv } = await admin
        .from('conversaciones')
        .insert({
          empresa_id: empresaId,
          canal_id: canalActivo.id,
          tipo_canal: 'whatsapp',
          identificador_externo: telefonoCanonico,
          contacto_id: visita.contacto_id || null,
          contacto_nombre: nombreDestinatario || null,
          estado: 'abierta',
          ultimo_mensaje_texto: mensaje,
          ultimo_mensaje_en: new Date().toISOString(),
          ultimo_mensaje_es_entrante: false,
        })
        .select('id')
        .single()
      conversacionId = nuevaConv?.id || null
    }

    // 10. Registrar mensaje en inbox
    if (conversacionId) {
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .single()
      const nombreAgente = perfil
        ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ').trim() || 'Visitador'
        : 'Visitador'

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
          texto: mensaje,
          wa_message_id: waMessageId,
          wa_status: 'sent',
          estado: 'enviado',
          plantilla_id: plantilla.id,
        })

      await admin
        .from('conversaciones')
        .update({
          ultimo_mensaje_texto: `📋 Aviso en camino`,
          ultimo_mensaje_en: new Date().toISOString(),
          ultimo_mensaje_es_entrante: false,
        })
        .eq('id', conversacionId)
    }

    // 11. Marcar visita
    await admin
      .from('visitas')
      .update({
        aviso_en_camino_enviado_at: new Date().toISOString(),
        aviso_en_camino_eta_min: etaComunicado,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', visita_id)

    // 12. Chatter
    await registrarChatter({
      empresaId,
      entidadTipo: 'visita',
      entidadId: visita_id,
      tipo: 'whatsapp',
      contenido: mensaje,
      autorId: user.id,
      autorNombre: 'Visitador',
      metadata: {
        accion: 'whatsapp_enviado',
        whatsapp_numero: telefonoCanonico,
        whatsapp_destinatario: nombreDestinatario || undefined,
        whatsapp_plantilla: NOMBRE_PLANTILLA,
        wa_message_id: waMessageId,
        detalles: {
          contexto: 'aviso_en_camino',
          eta_min_real: etaReal,
          eta_min_comunicado: etaComunicado,
        },
      },
    })

    return NextResponse.json({
      eta_min_real: etaReal,
      eta_min_comunicado: etaComunicado,
      mensaje,
      telefono: telefonoCanonico,
      tiene_whatsapp: true,
      plantilla_estado: estadoPlantilla,
      plantilla_lista: true,
      enviado: true,
    })
  } catch (err) {
    console.error('Error en POST /api/recorrido/aviso-en-camino:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

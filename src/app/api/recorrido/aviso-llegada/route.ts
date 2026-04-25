import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { enviarPlantillaWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'
import { normalizarTelefono, generarVariantesTelefono } from '@/lib/validaciones'
import { resolverTextoPlantilla, resolverParametrosCuerpo } from '@/lib/whatsapp/variables'
import type { CuerpoPlantillaWA } from '@/tipos/whatsapp'

const NOMBRE_PLANTILLA = 'flux_aviso_llegada_visita'

/**
 * POST /api/recorrido/aviso-llegada
 * Envía (o previsualiza) el aviso "ya estoy aquí" al contacto de una visita usando
 * la plantilla de sistema `flux_aviso_llegada_visita`. Análogo a aviso-en-camino pero
 * sin ETA (ya no hay tiempo estimado — el visitador ya llegó).
 *
 * Body:
 *   visita_id: string
 *   solo_preview?: boolean
 *
 * Respuesta:
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
      solo_preview?: boolean
    }
    const { visita_id, solo_preview } = body

    if (!visita_id) {
      return NextResponse.json({ error: 'Falta visita_id' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // 1. Visita
    const { data: visita } = await admin
      .from('visitas')
      .select('id, contacto_id, contacto_nombre, recibe_nombre, recibe_telefono, recibe_contacto_id, direccion_texto')
      .eq('id', visita_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) {
      return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
    }

    const nombreDestinatario = (visita.recibe_nombre || visita.contacto_nombre || '').trim()

    // 2. Teléfono — misma lógica que aviso-en-camino (recibe_telefono → contacto
    //    de recepción → contacto principal de la visita).
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

    // 3. Plantilla
    const { data: plantilla } = await admin
      .from('plantillas_whatsapp')
      .select('id, idioma, estado_meta, componentes, canal_id')
      .eq('empresa_id', empresaId)
      .eq('nombre_api', NOMBRE_PLANTILLA)
      .eq('activo', true)
      .maybeSingle()

    const estadoPlantilla: string = plantilla?.estado_meta || 'FALTANTE'
    const plantillaLista = estadoPlantilla === 'APPROVED'

    // 4. Variables runtime
    const valorNombre = nombreDestinatario || 'estimado cliente'
    const valorDireccion = visita.direccion_texto || 'su dirección'

    // Cuerpo con fallback genérico si la empresa aún no creó la plantilla.
    // Mismo texto que el seed (src/lib/plantillas-sistema/whatsapp.ts).
    const cuerpoPlantilla: CuerpoPlantillaWA = (plantilla?.componentes as { cuerpo?: CuerpoPlantillaWA } | null)?.cuerpo
      || {
        texto: 'Hola {{1}} 👋\n\nLe informamos que nuestro técnico visitador ya se encuentra en:\n📍 *{{2}}*\n\nMuchas gracias.',
        mapeo_variables: ['contacto_nombre', 'visita_direccion'],
        ejemplos: ['', ''],
      }

    const datosRuntime: Record<string, string> = {}
    if (valorNombre) datosRuntime['contacto_nombre'] = valorNombre
    if (valorDireccion) datosRuntime['visita_direccion'] = valorDireccion

    const mensaje = resolverTextoPlantilla(cuerpoPlantilla.texto || '', cuerpoPlantilla, datosRuntime)
    const tieneWhatsApp = !!telefono

    // ---------------- Modo preview ----------------
    if (solo_preview) {
      return NextResponse.json({
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

    // 5. Canal WhatsApp activo
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

    // 6. Normalizar teléfono
    const telefonoCanonico = normalizarTelefono(telefono!) || telefono!.replace(/\D/g, '')
    const telConPlus = `+${telefonoCanonico}`
    const variantesTel = generarVariantesTelefono(telefono!)

    // 7. Enviar plantilla a Meta
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

    // 8. Conversación (buscar o crear) — para que aparezca en inbox
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

    // 9. Mensaje en inbox
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
          ultimo_mensaje_texto: `📍 Aviso de llegada`,
          ultimo_mensaje_en: new Date().toISOString(),
          ultimo_mensaje_es_entrante: false,
        })
        .eq('id', conversacionId)
    }

    // 10. Marcar visita — guardamos cuándo se envió el aviso
    await admin
      .from('visitas')
      .update({
        aviso_llegada_enviado_at: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', visita_id)

    // 11. Chatter
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
          contexto: 'aviso_llegada',
        },
      },
    })

    return NextResponse.json({
      mensaje,
      telefono: telefonoCanonico,
      tiene_whatsapp: true,
      plantilla_estado: estadoPlantilla,
      plantilla_lista: true,
      enviado: true,
    })
  } catch (err) {
    console.error('Error en POST /api/recorrido/aviso-llegada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

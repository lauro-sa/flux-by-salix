/**
 * Helpers para registrar entradas en el chatter desde el servidor.
 * Se usa en: API routes de presupuestos, portal, correo, WhatsApp, etc.
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { AdjuntoChatter, MetadataChatter, TipoChatter } from '@/tipos/chatter'

interface RegistrarChatterParams {
  empresaId: string
  entidadTipo: string
  entidadId: string
  tipo?: TipoChatter
  contenido: string
  autorId?: string | null
  autorNombre?: string
  autorAvatarUrl?: string | null
  adjuntos?: AdjuntoChatter[]
  metadata?: MetadataChatter
}

/**
 * Registra una entrada en el chatter. Uso típico para eventos de sistema.
 */
export async function registrarChatter({
  empresaId,
  entidadTipo,
  entidadId,
  tipo = 'sistema',
  contenido,
  autorId = 'sistema',
  autorNombre = 'Sistema',
  autorAvatarUrl = null,
  adjuntos = [],
  metadata = {},
}: RegistrarChatterParams) {
  const admin = crearClienteAdmin()

  const { error } = await admin
    .from('chatter')
    .insert({
      empresa_id: empresaId,
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      tipo,
      contenido,
      autor_id: autorId,
      autor_nombre: autorNombre,
      autor_avatar_url: autorAvatarUrl,
      adjuntos,
      metadata,
    })

  if (error) {
    console.error('Error al registrar chatter:', error)
  }
}

/**
 * Registra un cambio de estado en el chatter de un presupuesto.
 */
export async function registrarCambioEstado({
  empresaId,
  presupuestoId,
  estadoAnterior,
  estadoNuevo,
  usuarioId,
  usuarioNombre,
  notas,
}: {
  empresaId: string
  presupuestoId: string
  estadoAnterior: string
  estadoNuevo: string
  usuarioId: string
  usuarioNombre: string
  notas?: string
}) {
  const etiquetas: Record<string, string> = {
    borrador: 'Borrador',
    enviado: 'Enviado',
    confirmado_cliente: 'Confirmado por Cliente',
    orden_venta: 'Orden de Venta',
    rechazado: 'Rechazado',
    vencido: 'Vencido',
    cancelado: 'Cancelado',
  }

  const contenido = notas
    ? `Cambió estado de ${etiquetas[estadoAnterior] || estadoAnterior} a ${etiquetas[estadoNuevo] || estadoNuevo}. ${notas}`
    : `Cambió estado de ${etiquetas[estadoAnterior] || estadoAnterior} a ${etiquetas[estadoNuevo] || estadoNuevo}`

  await registrarChatter({
    empresaId,
    entidadTipo: 'presupuesto',
    entidadId: presupuestoId,
    contenido,
    autorId: usuarioId,
    autorNombre: usuarioNombre,
    metadata: {
      accion: 'estado_cambiado',
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
    },
  })
}

/**
 * Registra un correo enviado en el chatter de una entidad.
 * Se llama después de enviar un correo desde ModalEnviarDocumento o el inbox.
 */
export async function registrarCorreoEnChatter({
  empresaId,
  entidadTipo,
  entidadId,
  asunto,
  destinatario,
  remitente,
  messageId,
  html,
  adjuntos = [],
  usuarioId,
  usuarioNombre,
  usuarioAvatarUrl,
}: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  asunto: string
  destinatario: string
  remitente?: string
  messageId?: string
  html?: string
  adjuntos?: AdjuntoChatter[]
  usuarioId: string
  usuarioNombre: string
  usuarioAvatarUrl?: string | null
}) {
  await registrarChatter({
    empresaId,
    entidadTipo,
    entidadId,
    tipo: 'correo',
    contenido: `Correo enviado: ${asunto}`,
    autorId: usuarioId,
    autorNombre: usuarioNombre,
    autorAvatarUrl: usuarioAvatarUrl,
    adjuntos,
    metadata: {
      accion: 'correo_enviado',
      correo_asunto: asunto,
      correo_destinatario: destinatario,
      correo_de: remitente,
      correo_message_id: messageId,
      correo_html: html,
    },
  })
}

/**
 * Registra un correo recibido (respuesta) en el chatter.
 * Se llama desde el webhook IMAP cuando se detecta una respuesta
 * vinculada a un documento por correo_in_reply_to / correo_references.
 */
export async function registrarCorreoRecibidoEnChatter({
  empresaId,
  entidadTipo,
  entidadId,
  asunto,
  remitente,
  messageId,
  html,
  adjuntos = [],
}: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  asunto: string
  remitente: string
  messageId?: string
  html?: string
  adjuntos?: AdjuntoChatter[]
}) {
  await registrarChatter({
    empresaId,
    entidadTipo,
    entidadId,
    tipo: 'correo',
    contenido: `Correo recibido: ${asunto}`,
    autorId: 'correo_externo',
    autorNombre: remitente,
    adjuntos,
    metadata: {
      accion: 'correo_recibido',
      correo_asunto: asunto,
      correo_de: remitente,
      correo_message_id: messageId,
      correo_html: html,
    },
  })
}

/**
 * Registra un mensaje de WhatsApp enviado en el chatter.
 */
export async function registrarWhatsAppEnChatter({
  empresaId,
  entidadTipo,
  entidadId,
  texto,
  numero,
  plantilla,
  adjuntos = [],
  usuarioId,
  usuarioNombre,
  usuarioAvatarUrl,
}: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  texto: string
  numero: string
  plantilla?: string
  adjuntos?: AdjuntoChatter[]
  usuarioId: string
  usuarioNombre: string
  usuarioAvatarUrl?: string | null
}) {
  await registrarChatter({
    empresaId,
    entidadTipo,
    entidadId,
    tipo: 'whatsapp',
    contenido: texto,
    autorId: usuarioId,
    autorNombre: usuarioNombre,
    autorAvatarUrl: usuarioAvatarUrl,
    adjuntos,
    metadata: {
      accion: 'whatsapp_enviado',
      whatsapp_numero: numero,
      whatsapp_plantilla: plantilla,
    },
  })
}


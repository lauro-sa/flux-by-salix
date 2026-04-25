/**
 * Helpers para registrar entradas en el chatter desde el servidor.
 * Se usa en: API routes de presupuestos, portal, correo, WhatsApp, etc.
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { AdjuntoChatter, MetadataChatter, TipoChatter } from '@/tipos/chatter'

/**
 * Entidad relacionada a una entrada de chatter — se usa para marcar
 * que un correo/evento también está registrado en otras fichas (ej.
 * un correo enviado a una persona vinculada a una empresa aparece en
 * ambos chatters, y cada uno muestra chips con las otras entidades).
 */
export interface EntidadRelacionadaChatter {
  tipo: string
  id: string
  nombre: string
}

/**
 * Resuelve el nombre legible de una entidad para mostrar como chip en el chatter.
 * Soporta los tipos más usados; si no encuentra, devuelve null y el chip
 * se mostrará con un label genérico ("Presupuesto", "Factura", etc.).
 */
export async function obtenerNombreEntidad(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  tipo: string,
  id: string,
): Promise<string | null> {
  try {
    switch (tipo) {
      case 'contacto': {
        const { data } = await admin
          .from('contactos')
          .select('nombre, apellido')
          .eq('empresa_id', empresaId)
          .eq('id', id)
          .maybeSingle()
        if (!data) return null
        return [data.nombre, data.apellido].filter(Boolean).join(' ').trim() || null
      }
      case 'presupuesto': {
        const { data } = await admin
          .from('presupuestos')
          .select('numero')
          .eq('empresa_id', empresaId)
          .eq('id', id)
          .maybeSingle()
        return data?.numero ? `Presupuesto ${data.numero}` : null
      }
      case 'orden_trabajo': {
        const { data } = await admin
          .from('ordenes_trabajo')
          .select('numero, titulo')
          .eq('empresa_id', empresaId)
          .eq('id', id)
          .maybeSingle()
        if (!data) return null
        return data.numero ? `Orden ${data.numero}` : data.titulo || null
      }
      case 'visita': {
        const { data } = await admin
          .from('visitas')
          .select('motivo, contacto_nombre')
          .eq('empresa_id', empresaId)
          .eq('id', id)
          .maybeSingle()
        if (!data) return null
        return data.motivo || (data.contacto_nombre ? `Visita a ${data.contacto_nombre}` : null)
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

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
    completado: 'Completado',
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
  cc,
  cco,
  remitente,
  messageId,
  html,
  adjuntos = [],
  usuarioId,
  usuarioNombre,
  usuarioAvatarUrl,
  relacionadoCon,
}: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  asunto: string
  destinatario: string
  cc?: string[]
  cco?: string[]
  remitente?: string
  messageId?: string
  html?: string
  adjuntos?: AdjuntoChatter[]
  usuarioId: string
  usuarioNombre: string
  usuarioAvatarUrl?: string | null
  /** Otras entidades donde también se registra este correo (para mostrar chips "También en:") */
  relacionadoCon?: EntidadRelacionadaChatter[]
}) {
  // Construir contenido descriptivo con CC/CCO
  const partes = [`Correo enviado: ${asunto}`]
  if (cc?.length) partes.push(`CC: ${cc.join(', ')}`)
  if (cco?.length) partes.push(`CCO: ${cco.join(', ')}`)

  await registrarChatter({
    empresaId,
    entidadTipo,
    entidadId,
    tipo: 'correo',
    contenido: partes.join(' · '),
    autorId: usuarioId,
    autorNombre: usuarioNombre,
    autorAvatarUrl: usuarioAvatarUrl,
    adjuntos,
    metadata: {
      accion: 'correo_enviado',
      correo_asunto: asunto,
      correo_destinatario: destinatario,
      correo_cc: cc?.join(', ') || undefined,
      correo_cco: cco?.join(', ') || undefined,
      correo_de: remitente,
      correo_message_id: messageId,
      correo_html: html,
      ...(relacionadoCon && relacionadoCon.length > 0 ? { relacionado_con: relacionadoCon } : {}),
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
  relacionadoCon,
}: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  asunto: string
  remitente: string
  messageId?: string
  html?: string
  adjuntos?: AdjuntoChatter[]
  relacionadoCon?: EntidadRelacionadaChatter[]
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
      ...(relacionadoCon && relacionadoCon.length > 0 ? { relacionado_con: relacionadoCon } : {}),
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


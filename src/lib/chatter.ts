/**
 * Helpers para registrar entradas en el chatter desde el servidor.
 * Se usa en: API routes de presupuestos, portal, etc.
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

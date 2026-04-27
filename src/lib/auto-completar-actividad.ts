/**
 * Helper para auto-completar una actividad origen cuando un documento vinculado
 * dispara un evento (creación, envío, finalización).
 *
 * El auto-completado solo procede si el tipo de la actividad tiene configurado
 * `evento_auto_completar = eventoEsperado`. Esto permite que cualquier tipo
 * dinámico (creado por una empresa) defina cuándo completar sus actividades sin
 * que esa lógica esté hardcodeada por clave en los endpoints.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarChatter } from '@/lib/chatter'

type EventoAutoCompletar = 'al_crear' | 'al_enviar' | 'al_finalizar'

interface ParametrosAutoCompletar {
  admin: SupabaseClient
  empresaId: string
  actividadId: string
  /** Evento que debe coincidir con `tipos_actividad.evento_auto_completar` para que la actividad se cierre. */
  eventoEsperado: EventoAutoCompletar
  usuarioId: string
  usuarioNombre: string | null
  /** Texto a registrar en el chatter de la actividad cuando se autocompleta. */
  mensajeChatter: string
  /** Metadata adicional para el chatter (ej. id del documento que disparó el evento). */
  metadataChatter?: Record<string, unknown>
}

/**
 * Completa la actividad si su tipo tiene `evento_auto_completar` igual al evento esperado.
 * Devuelve `true` si la actividad se completó, `false` en caso contrario.
 *
 * No lanza si la actividad ya está completada o no existe — silencioso por diseño,
 * porque el auto-completado es secundario al flujo principal del documento.
 */
export async function autoCompletarActividad({
  admin,
  empresaId,
  actividadId,
  eventoEsperado,
  usuarioId,
  usuarioNombre,
  mensajeChatter,
  metadataChatter,
}: ParametrosAutoCompletar): Promise<boolean> {
  // 1) Cargar la actividad y su tipo en una sola query
  const { data: actividad } = await admin
    .from('actividades')
    .select('id, estado_clave, tipo_id, tipos_actividad:tipos_actividad!tipo_id(evento_auto_completar)')
    .eq('id', actividadId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!actividad) return false

  const tipoData = actividad.tipos_actividad as unknown as { evento_auto_completar: string | null } | null
  const evento = tipoData?.evento_auto_completar
  if (evento !== eventoEsperado) return false

  // 2) Si ya está cerrada (completada/cancelada), no hacer nada
  if (actividad.estado_clave === 'completada' || actividad.estado_clave === 'cancelada') return false

  // 3) Buscar el estado 'completada' de la empresa
  const { data: estadoCompletada } = await admin
    .from('estados_actividad')
    .select('id, clave')
    .eq('empresa_id', empresaId)
    .eq('grupo', 'completado')
    .limit(1)
    .single()

  if (!estadoCompletada) return false

  // 4) Update + chatter
  const ahora = new Date().toISOString()
  const { error } = await admin
    .from('actividades')
    .update({
      estado_id: estadoCompletada.id,
      estado_clave: estadoCompletada.clave,
      completado_en: ahora,
      editado_por: usuarioId,
      editado_por_nombre: usuarioNombre,
      actualizado_en: ahora,
    })
    .eq('id', actividadId)
    .eq('empresa_id', empresaId)

  if (error) return false

  await registrarChatter({
    empresaId,
    entidadTipo: 'actividad',
    entidadId: actividadId,
    contenido: mensajeChatter,
    autorId: usuarioId,
    autorNombre: usuarioNombre || 'Usuario',
    metadata: {
      accion: 'actividad_completada',
      detalles: { evento: eventoEsperado, ...(metadataChatter || {}) },
    },
  })

  return true
}

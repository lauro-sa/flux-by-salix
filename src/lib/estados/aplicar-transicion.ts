/**
 * Helper unificado para aplicar transiciones de estado a cualquier entidad
 * de Flux. Valida la transición contra el catálogo `transiciones_estado`,
 * aplica el UPDATE, y persiste el motivo (si se proporciona) en el row de
 * `cambios_estado` que el trigger AFTER UPDATE genera automáticamente.
 *
 * Esta función es la pieza que cualquier endpoint de aplicación debería
 * usar al cambiar el estado de una entidad — en vez de hacer UPDATE directo
 * y arriesgarse a saltar la validación del catálogo.
 *
 * Migración fuente: PR 4 del refactor de estados configurables.
 *
 * Uso típico (desde un endpoint API):
 *
 *   const resultado = await aplicarTransicionEstado({
 *     admin,
 *     empresaId,
 *     entidadTipo: 'conversacion',
 *     entidadId,
 *     hastaClave: 'resuelta',
 *     motivo: body.motivo,
 *     cambiosAdicionales: { cerrado_en: new Date().toISOString() },
 *   })
 *   if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 })
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntidadConEstado, OrigenCambioEstado } from '@/tipos/estados'
import { TABLA_PRINCIPAL_POR_ENTIDAD } from '@/lib/estados/mapeo'

export interface AplicarTransicionInput {
  admin: SupabaseClient
  empresaId: string
  entidadTipo: EntidadConEstado
  entidadId: string
  /** Clave del estado destino (debe existir en `estados_<entidad>`). */
  hastaClave: string
  /** Motivo opcional. Si la transición tiene `requiere_motivo=true` es obligatorio. */
  motivo?: string
  /** Origen del cambio (default 'manual'). */
  origen?: OrigenCambioEstado
  /**
   * Cambios adicionales a aplicar en el mismo UPDATE.
   * Útil para campos que se actualizan en conjunto con el estado
   * (ej: `cerrado_en` y `cerrado_por` al pasar a 'resuelta').
   */
  cambiosAdicionales?: Record<string, unknown>
}

export type AplicarTransicionResultado =
  | {
      ok: true
      estadoAnterior: string | null
      estadoNuevo: string
      noOp?: boolean // true si el estado ya era el destino
    }
  | {
      ok: false
      estadoAnterior: string | null
      estadoNuevo: string
      error: string
      /** true si la transición requiere motivo y no se proporcionó. */
      motivoRequerido?: boolean
      /** true si la transición no está permitida según el catálogo. */
      transicionInvalida?: boolean
    }

/**
 * Aplica una transición de estado validada.
 *
 * Pasos:
 *   1. Resuelve la tabla de la entidad y verifica que esté soportada.
 *   2. Lee el estado actual.
 *   3. Si no hay cambio real → no-op exitoso.
 *   4. Valida la transición vía `validar_transicion_estado()` SQL.
 *   5. Verifica `requiere_motivo` del catálogo (si aplica).
 *   6. Aplica el UPDATE (el trigger registra cambios_estado automáticamente).
 *   7. Si hay motivo, lo agrega al cambio_estado más reciente.
 */
export async function aplicarTransicionEstado(
  input: AplicarTransicionInput,
): Promise<AplicarTransicionResultado> {
  const {
    admin,
    empresaId,
    entidadTipo,
    entidadId,
    hastaClave,
    motivo,
    cambiosAdicionales,
  } = input

  // 1) Tabla soportada
  const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[entidadTipo]
  if (!tabla) {
    return {
      ok: false,
      estadoAnterior: null,
      estadoNuevo: hastaClave,
      error: `Entidad "${entidadTipo}" no está soportada todavía por el sistema de estados.`,
    }
  }

  // 2) Estado actual
  const { data: actual, error: errLeer } = await admin
    .from(tabla)
    .select('estado_clave')
    .eq('id', entidadId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (errLeer || !actual) {
    return {
      ok: false,
      estadoAnterior: null,
      estadoNuevo: hastaClave,
      error: 'Entidad no encontrada o sin permisos',
    }
  }

  const estadoAnterior = (actual.estado_clave as string | null) ?? null

  // 3) No-op si no hay cambio real
  if (estadoAnterior === hastaClave) {
    return { ok: true, estadoAnterior, estadoNuevo: hastaClave, noOp: true }
  }

  // 4) Validar contra el catálogo
  const { data: esValida, error: errValid } = await admin.rpc(
    'validar_transicion_estado',
    {
      p_empresa_id: empresaId,
      p_entidad_tipo: entidadTipo,
      p_desde_clave: estadoAnterior,
      p_hasta_clave: hastaClave,
    },
  )

  if (errValid || !esValida) {
    return {
      ok: false,
      estadoAnterior,
      estadoNuevo: hastaClave,
      error: `Transición no permitida: ${estadoAnterior ?? '(inicial)'} → ${hastaClave}`,
      transicionInvalida: true,
    }
  }

  // 5) Verificar requiere_motivo en el catálogo
  // Buscamos la transición específica (preferimos la propia de empresa sobre sistema).
  // Como Supabase no soporta filtros con OR + IS NULL elegantemente, hacemos dos
  // queries y combinamos.
  const requiereMotivo = await transicionRequiereMotivo(
    admin,
    empresaId,
    entidadTipo,
    estadoAnterior,
    hastaClave,
  )

  if (requiereMotivo && (!motivo || motivo.trim().length === 0)) {
    return {
      ok: false,
      estadoAnterior,
      estadoNuevo: hastaClave,
      error: 'Esta transición requiere un motivo',
      motivoRequerido: true,
    }
  }

  // 6) Aplicar el UPDATE.
  // El trigger AFTER UPDATE registra en cambios_estado con
  // origen='manual'/'sistema' según auth.uid(). El motivo se persiste
  // en el paso 7.
  const cambios: Record<string, unknown> = {
    estado_clave: hastaClave,
    ...(cambiosAdicionales ?? {}),
  }

  const { error: errUpdate } = await admin
    .from(tabla)
    .update(cambios)
    .eq('id', entidadId)
    .eq('empresa_id', empresaId)

  if (errUpdate) {
    return {
      ok: false,
      estadoAnterior,
      estadoNuevo: hastaClave,
      error: errUpdate.message,
    }
  }

  // 7) Persistir motivo en el row de cambios_estado más reciente.
  // (No tenemos forma de pasar el motivo al trigger porque supabase-js no
  //  expone SET LOCAL. La solución pragmática: leer el row recién insertado
  //  y agregarle el motivo. Race condition mínima — los cambios de estado
  //  son por entidad y serializan vía RLS/PK.)
  if (motivo && motivo.trim().length > 0) {
    const { data: cambioReciente } = await admin
      .from('cambios_estado')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .eq('estado_nuevo', hastaClave)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cambioReciente?.id) {
      await admin
        .from('cambios_estado')
        .update({ motivo: motivo.trim() })
        .eq('id', cambioReciente.id)
    }
  }

  return { ok: true, estadoAnterior, estadoNuevo: hastaClave }
}

/**
 * Devuelve true si la transición específica requiere motivo según el catálogo.
 * Prefiere la transición propia de la empresa sobre la del sistema.
 */
async function transicionRequiereMotivo(
  admin: SupabaseClient,
  empresaId: string,
  entidadTipo: EntidadConEstado,
  desdeClave: string | null,
  hastaClave: string,
): Promise<boolean> {
  // Buscar coincidencia más específica primero: (empresa_id, desde, hasta)
  // luego (empresa_id, NULL, hasta), (NULL, desde, hasta), (NULL, NULL, hasta)
  const candidatos: Array<{ empresa: string | null; desde: string | null }> = [
    { empresa: empresaId, desde: desdeClave },
    { empresa: empresaId, desde: null },
    { empresa: null,      desde: desdeClave },
    { empresa: null,      desde: null },
  ]

  for (const c of candidatos) {
    let q = admin
      .from('transiciones_estado')
      .select('requiere_motivo')
      .eq('entidad_tipo', entidadTipo)
      .eq('hasta_clave', hastaClave)
      .eq('activo', true)

    q = c.empresa === null ? q.is('empresa_id', null) : q.eq('empresa_id', c.empresa)
    q = c.desde === null ? q.is('desde_clave', null) : q.eq('desde_clave', c.desde)

    const { data } = await q.maybeSingle()
    if (data) return data.requiere_motivo === true
  }

  return false
}

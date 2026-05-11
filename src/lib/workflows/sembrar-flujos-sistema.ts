/**
 * Helper que siembra los flujos del sistema para una empresa nueva
 * (sub-PR 20.5, commit 6).
 *
 * Reusa el catálogo declarativo `FLUJOS_SISTEMA` del commit 1 — NO
 * duplica el shape de los 4 flujos. Si el catálogo TS crece, este
 * helper los siembra automáticamente sin más cambios.
 *
 * Idempotencia: UPSERT con `ON CONFLICT (empresa_id, clave_sistema)
 * DO NOTHING`. La UNIQUE INDEX parcial del 20.3
 * (`flujos_clave_sistema_unique_idx`) garantiza que re-correr el seed
 * no duplica filas.
 *
 * Estado inicial: TODOS los flujos arrancan en `estado_inicial` del
 * catálogo (que el commit 6 dejó uniforme en 'activo'). Empresas
 * nuevas reciben el comportamiento "moderno" directamente — sin
 * pasar por el estado 'pausado' que las empresas migradas tuvieron
 * temporalmente entre el seed del 20.3 y la activación del 068.
 *
 * Manejo de errores: si el INSERT falla, devuelve resultado con
 * detalle del error. El llamador (API route de creación de empresa)
 * decide si abortar la creación o degradar (recomendado: degradar,
 * la empresa puede sembrar después manualmente).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FLUJOS_SISTEMA } from './flujos-sistema'

export interface ResultadoSeedFlujos {
  /** true si todos los flujos se intentaron sembrar sin error de BD. */
  ok: boolean
  /** Cantidad de flujos efectivamente insertados (excluye los que ya existían). */
  insertados: number
  /** Cantidad de flujos que ya existían (ON CONFLICT DO NOTHING). */
  ya_existian: number
  /** Mensajes de error si alguno falló (uno por flujo fallido). */
  errores: Array<{ clave: string; mensaje: string; codigo: string | null }>
}

/**
 * Siembra los flujos del catálogo `FLUJOS_SISTEMA` para una empresa.
 * Idempotente: si la empresa ya tiene un flujo con esa `clave_sistema`,
 * se ignora silenciosamente (caso normal en re-seeds o backfills).
 */
export async function sembrarFlujosSistema(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ResultadoSeedFlujos> {
  const resultado: ResultadoSeedFlujos = {
    ok: true,
    insertados: 0,
    ya_existian: 0,
    errores: [],
  }

  for (const flujo of FLUJOS_SISTEMA) {
    // upsert con ignoreDuplicates: si la fila ya existe (por clave_sistema),
    // no la actualiza (preservamos la edición que el admin haya hecho).
    const { data, error } = await admin
      .from('flujos')
      .upsert(
        {
          empresa_id: empresaId,
          nombre: flujo.nombre,
          descripcion: flujo.descripcion,
          estado: flujo.estado_inicial,
          clave_sistema: flujo.clave,
          disparador: flujo.disparador,
          condiciones: [],
          acciones: flujo.acciones,
          nodos_json: {},
          creado_por: null,
          creado_por_nombre: 'Sistema',
        },
        {
          onConflict: 'empresa_id,clave_sistema',
          ignoreDuplicates: true,
        },
      )
      .select('id')

    if (error) {
      resultado.ok = false
      resultado.errores.push({
        clave: flujo.clave,
        mensaje: error.message,
        codigo: error.code ?? null,
      })
      continue
    }

    // upsert con ignoreDuplicates devuelve [] cuando había conflict y null
    // cuando no hubo upsert. Si data tiene filas, fue inserción nueva.
    if (Array.isArray(data) && data.length > 0) {
      resultado.insertados += 1
    } else {
      resultado.ya_existian += 1
    }
  }

  return resultado
}

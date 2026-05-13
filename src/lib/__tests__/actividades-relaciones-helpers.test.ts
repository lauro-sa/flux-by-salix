/**
 * Tests del helper `actividades-relaciones-helpers` (sub-PR 20.6 Commit 2).
 *
 * Cubre:
 *   - Mapeadores triviales legacyARelacion / relacionALegacy.
 *   - cargarVinculosPorActividad: agrupa filas por actividad_id en shape legacy.
 *   - sincronizarVinculosActividad: diff INSERT / UPDATE / DELETE contra
 *     estado actual de la tabla.
 *
 * Mock minimalista de SupabaseClient: implementa solo los métodos que el
 * helper invoca (from/select/eq/in/insert/upsert/update/delete + cadena
 * de .eq necesaria para acotar por PK compuesta).
 */

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cargarVinculosPorActividad,
  insertarVinculosActividad,
  legacyARelacion,
  relacionALegacy,
  sincronizarVinculosActividad,
  type RelacionFila,
  type VinculoLegacy,
} from '../actividades-relaciones-helpers'

interface FilaActividadRelacion {
  empresa_id: string
  actividad_id: string
  entidad_tipo: string
  entidad_id: string
  entidad_nombre: string | null
  creado_por: string | null
  creado_en?: string
}

interface OpsRegistradas {
  inserts: FilaActividadRelacion[][]
  upserts: FilaActividadRelacion[][]
  updates: Array<{ campos: Record<string, unknown>; filtros: Record<string, string> }>
  deletes: Array<{ filtros: Record<string, string> }>
}

function crearAdminMock(initialData: FilaActividadRelacion[]) {
  const datos = [...initialData]
  const ops: OpsRegistradas = { inserts: [], upserts: [], updates: [], deletes: [] }

  function buildFiltered(filtered: FilaActividadRelacion[]) {
    return {
      eq(col: keyof FilaActividadRelacion, val: string) {
        return buildFiltered(filtered.filter(r => r[col] === val))
      },
      in(col: keyof FilaActividadRelacion, vals: string[]) {
        return Promise.resolve({ data: filtered.filter(r => vals.includes(r[col] as string)) })
      },
      then(onFulfilled: (v: { data: FilaActividadRelacion[] }) => unknown) {
        return Promise.resolve({ data: filtered }).then(onFulfilled)
      },
    }
  }

  function buildUpdate(campos: Record<string, unknown>, filtros: Record<string, string> = {}) {
    return {
      eq(col: string, val: string) {
        return buildUpdate(campos, { ...filtros, [col]: val })
      },
      then(onFulfilled: (v: { data: null }) => unknown) {
        ops.updates.push({ campos, filtros })
        return Promise.resolve({ data: null }).then(onFulfilled)
      },
    }
  }

  function buildDelete(filtros: Record<string, string> = {}) {
    return {
      eq(col: string, val: string) {
        return buildDelete({ ...filtros, [col]: val })
      },
      then(onFulfilled: (v: { data: null }) => unknown) {
        ops.deletes.push({ filtros })
        return Promise.resolve({ data: null }).then(onFulfilled)
      },
    }
  }

  return {
    admin: {
      from() {
        return {
          select() {
            return buildFiltered(datos)
          },
          insert(rows: FilaActividadRelacion[]) {
            ops.inserts.push(rows)
            return Promise.resolve({ data: rows })
          },
          upsert(rows: FilaActividadRelacion[]) {
            ops.upserts.push(rows)
            return Promise.resolve({ data: rows })
          },
          update(campos: Record<string, unknown>) {
            return buildUpdate(campos)
          },
          delete() {
            return buildDelete()
          },
        }
      },
    } as unknown as SupabaseClient,
    ops,
  }
}

describe('legacyARelacion / relacionALegacy', () => {
  it('legacyARelacion mapea {tipo,id,nombre} → {entidad_tipo,entidad_id,entidad_nombre}', () => {
    const v: VinculoLegacy = { tipo: 'contacto', id: 'c-1', nombre: 'Ada Lovelace' }
    expect(legacyARelacion(v)).toEqual({
      entidad_tipo: 'contacto',
      entidad_id: 'c-1',
      entidad_nombre: 'Ada Lovelace',
    })
  })

  it('relacionALegacy mapea inverso y normaliza nombre NULL a string vacío', () => {
    const r: RelacionFila = { entidad_tipo: 'presupuesto', entidad_id: 'p-1', entidad_nombre: null }
    expect(relacionALegacy(r)).toEqual({ tipo: 'presupuesto', id: 'p-1', nombre: '' })
  })
})

describe('cargarVinculosPorActividad', () => {
  it('devuelve Map vacío si no hay actividadIds', async () => {
    const { admin } = crearAdminMock([])
    const mapa = await cargarVinculosPorActividad(admin, 'emp-1', [])
    expect(mapa.size).toBe(0)
  })

  it('agrupa relaciones por actividad_id en shape legacy', async () => {
    const { admin } = crearAdminMock([
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'contacto', entidad_id: 'c-1', entidad_nombre: 'Ada', creado_por: null },
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'presupuesto', entidad_id: 'p-1', entidad_nombre: 'Pres 26-001', creado_por: null },
      { empresa_id: 'emp-1', actividad_id: 'act-2', entidad_tipo: 'contacto', entidad_id: 'c-2', entidad_nombre: 'Grace', creado_por: null },
    ])
    const mapa = await cargarVinculosPorActividad(admin, 'emp-1', ['act-1', 'act-2'])
    expect(mapa.get('act-1')).toEqual([
      { tipo: 'contacto', id: 'c-1', nombre: 'Ada' },
      { tipo: 'presupuesto', id: 'p-1', nombre: 'Pres 26-001' },
    ])
    expect(mapa.get('act-2')).toEqual([{ tipo: 'contacto', id: 'c-2', nombre: 'Grace' }])
  })

  it('actividad sin relaciones queda fuera del Map (caller usa .get() ?? [])', async () => {
    const { admin } = crearAdminMock([
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'contacto', entidad_id: 'c-1', entidad_nombre: 'Ada', creado_por: null },
    ])
    const mapa = await cargarVinculosPorActividad(admin, 'emp-1', ['act-1', 'act-vacia'])
    expect(mapa.has('act-vacia')).toBe(false)
    expect(mapa.size).toBe(1)
  })
})

describe('insertarVinculosActividad', () => {
  it('no toca BD si vinculos viene vacío', async () => {
    const { admin, ops } = crearAdminMock([])
    await insertarVinculosActividad(admin, 'emp-1', 'act-1', [], 'user-1')
    expect(ops.upserts).toHaveLength(0)
  })

  it('upsert con ignoreDuplicates para idempotencia contra el unique idx', async () => {
    const { admin, ops } = crearAdminMock([])
    await insertarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [{ tipo: 'contacto', id: 'c-1', nombre: 'Ada' }],
      'user-1',
    )
    expect(ops.upserts).toHaveLength(1)
    expect(ops.upserts[0]).toEqual([
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'contacto', entidad_id: 'c-1', entidad_nombre: 'Ada', creado_por: 'user-1' },
    ])
  })
})

describe('sincronizarVinculosActividad — diff', () => {
  const actual: FilaActividadRelacion[] = [
    { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'contacto', entidad_id: 'c-1', entidad_nombre: 'Ada', creado_por: null },
    { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'presupuesto', entidad_id: 'p-1', entidad_nombre: 'Pres 26-001', creado_por: null },
  ]

  it('sin cambios: ninguna mutación', async () => {
    const { admin, ops } = crearAdminMock(actual)
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [
        { tipo: 'contacto', id: 'c-1', nombre: 'Ada' },
        { tipo: 'presupuesto', id: 'p-1', nombre: 'Pres 26-001' },
      ],
      'user-1',
    )
    expect(ops.inserts).toHaveLength(0)
    expect(ops.updates).toHaveLength(0)
    expect(ops.deletes).toHaveLength(0)
  })

  it('agregar vínculo nuevo: solo INSERT', async () => {
    const { admin, ops } = crearAdminMock(actual)
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [
        { tipo: 'contacto', id: 'c-1', nombre: 'Ada' },
        { tipo: 'presupuesto', id: 'p-1', nombre: 'Pres 26-001' },
        { tipo: 'orden', id: 'o-1', nombre: 'OT 26-099' },
      ],
      'user-2',
    )
    expect(ops.inserts).toHaveLength(1)
    expect(ops.inserts[0]).toEqual([
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'orden', entidad_id: 'o-1', entidad_nombre: 'OT 26-099', creado_por: 'user-2' },
    ])
    expect(ops.updates).toHaveLength(0)
    expect(ops.deletes).toHaveLength(0)
  })

  it('quitar vínculo: solo DELETE', async () => {
    const { admin, ops } = crearAdminMock(actual)
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [{ tipo: 'contacto', id: 'c-1', nombre: 'Ada' }],
      'user-1',
    )
    expect(ops.inserts).toHaveLength(0)
    expect(ops.updates).toHaveLength(0)
    expect(ops.deletes).toHaveLength(1)
    expect(ops.deletes[0].filtros).toMatchObject({
      empresa_id: 'emp-1',
      actividad_id: 'act-1',
      entidad_tipo: 'presupuesto',
      entidad_id: 'p-1',
    })
  })

  it('cambiar nombre cacheado: solo UPDATE', async () => {
    const { admin, ops } = crearAdminMock(actual)
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [
        { tipo: 'contacto', id: 'c-1', nombre: 'Ada Lovelace' },
        { tipo: 'presupuesto', id: 'p-1', nombre: 'Pres 26-001' },
      ],
      'user-1',
    )
    expect(ops.inserts).toHaveLength(0)
    expect(ops.updates).toHaveLength(1)
    expect(ops.updates[0].campos).toEqual({ entidad_nombre: 'Ada Lovelace' })
    expect(ops.updates[0].filtros).toMatchObject({
      empresa_id: 'emp-1',
      actividad_id: 'act-1',
      entidad_tipo: 'contacto',
      entidad_id: 'c-1',
    })
    expect(ops.deletes).toHaveLength(0)
  })

  it('vínculo con nombre NULL existente se UPDATE al recibir nombre no vacío', async () => {
    const { admin, ops } = crearAdminMock([
      { empresa_id: 'emp-1', actividad_id: 'act-1', entidad_tipo: 'contacto', entidad_id: 'c-1', entidad_nombre: null, creado_por: null },
    ])
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [{ tipo: 'contacto', id: 'c-1', nombre: 'Ada' }],
      'user-1',
    )
    expect(ops.updates).toHaveLength(1)
    expect(ops.updates[0].campos).toEqual({ entidad_nombre: 'Ada' })
  })

  it('combinado: INSERT + UPDATE + DELETE en una sola llamada', async () => {
    const { admin, ops } = crearAdminMock(actual)
    await sincronizarVinculosActividad(
      admin,
      'emp-1',
      'act-1',
      [
        { tipo: 'contacto', id: 'c-1', nombre: 'Ada Byron' }, // rename → UPDATE
        // se quita el presupuesto p-1                          → DELETE
        { tipo: 'visita', id: 'v-1', nombre: 'Visita 2026-05-12' }, // nuevo → INSERT
      ],
      'user-1',
    )
    expect(ops.inserts).toHaveLength(1)
    expect(ops.inserts[0][0].entidad_tipo).toBe('visita')
    expect(ops.updates).toHaveLength(1)
    expect(ops.updates[0].campos).toEqual({ entidad_nombre: 'Ada Byron' })
    expect(ops.deletes).toHaveLength(1)
    expect(ops.deletes[0].filtros.entidad_id).toBe('p-1')
  })
})

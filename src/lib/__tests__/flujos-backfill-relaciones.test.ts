/**
 * Tests de la lógica del BACKFILL de `actividades_relaciones` (sub-PR 20.3).
 *
 * El backfill real lo hace SQL (`sql/067_flujos_sistema_autocompletar.sql`)
 * y se ejecutó vía Supabase MCP en flux-dev — verificación manual:
 *
 *   - 5 presupuestos con actividad_origen_id histórico → 5 relaciones
 *     entidad_tipo='presupuesto' creadas.
 *   - 0 visitas con actividad_origen_id → 0 relaciones entidad_tipo='visita'.
 *
 * Estos tests cubren el contrato del backfill como función pura: dado
 * un set de filas de `presupuestos`/`visitas` con `actividad_origen_id`,
 * la salida esperada es exactamente N relaciones N:M en el shape que
 * coincide con `EntidadRelacionable`.
 *
 * El backfill se modela como helper puro `armarFilasBackfill` para que
 * pueda re-usarse en el futuro (ej: si se agrega un trigger seed-on-empresa-create
 * que también necesita el mismo razonamiento) y para que el shape sea
 * verificable sin BD.
 */

import { describe, expect, it } from 'vitest'
import { esEntidadRelacionable } from '@/tipos/actividades-relaciones'

interface FilaConOrigen {
  id: string
  empresa_id: string
  actividad_origen_id: string | null
  creado_en: string
}

interface FilaRelacion {
  empresa_id: string
  actividad_id: string
  entidad_tipo: string
  entidad_id: string
  creado_por: null
  creado_en: string
}

/**
 * Helper puro que replica la lógica del backfill SQL: dado un array de
 * filas con `actividad_origen_id` y un `entidad_tipo`, produce el array
 * de relaciones a insertar (con dedup por la clave compuesta del UNIQUE).
 *
 * El SQL real usa `INSERT ... ON CONFLICT DO NOTHING`, esta función
 * replica esa idempotencia con un Map por la clave del UNIQUE.
 */
function armarFilasBackfill(
  filas: FilaConOrigen[],
  entidad_tipo: string,
): FilaRelacion[] {
  const dedup = new Map<string, FilaRelacion>()
  for (const f of filas) {
    if (!f.actividad_origen_id) continue
    const clave = `${f.empresa_id}|${f.actividad_origen_id}|${entidad_tipo}|${f.id}`
    if (!dedup.has(clave)) {
      dedup.set(clave, {
        empresa_id: f.empresa_id,
        actividad_id: f.actividad_origen_id,
        entidad_tipo,
        entidad_id: f.id,
        creado_por: null,
        creado_en: f.creado_en,
      })
    }
  }
  return Array.from(dedup.values())
}

describe('backfill actividades_relaciones — lógica pura', () => {
  it('genera una relación por cada presupuesto con actividad_origen_id', () => {
    const presupuestos: FilaConOrigen[] = [
      { id: 'p1', empresa_id: 'emp-A', actividad_origen_id: 'act-1', creado_en: '2026-01-01T00:00:00Z' },
      { id: 'p2', empresa_id: 'emp-A', actividad_origen_id: 'act-2', creado_en: '2026-01-02T00:00:00Z' },
      { id: 'p3', empresa_id: 'emp-A', actividad_origen_id: null,    creado_en: '2026-01-03T00:00:00Z' },
    ]
    const filas = armarFilasBackfill(presupuestos, 'presupuesto')
    expect(filas).toHaveLength(2) // p3 omitido por NULL
    expect(filas[0]).toMatchObject({
      actividad_id: 'act-1',
      entidad_tipo: 'presupuesto',
      entidad_id: 'p1',
      creado_por: null,
    })
  })

  it('todas las relaciones tienen entidad_tipo en EntidadRelacionable', () => {
    const visitas: FilaConOrigen[] = [
      { id: 'v1', empresa_id: 'emp-A', actividad_origen_id: 'act-x', creado_en: '2026-01-01T00:00:00Z' },
    ]
    const filas = armarFilasBackfill(visitas, 'visita')
    for (const r of filas) {
      expect(esEntidadRelacionable(r.entidad_tipo)).toBe(true)
    }
  })

  it('skip de filas con actividad_origen_id null (idempotencia con datos existentes)', () => {
    const filas = armarFilasBackfill(
      [
        { id: 'x1', empresa_id: 'emp-A', actividad_origen_id: null, creado_en: '2026-01-01T00:00:00Z' },
        { id: 'x2', empresa_id: 'emp-A', actividad_origen_id: null, creado_en: '2026-01-02T00:00:00Z' },
      ],
      'presupuesto',
    )
    expect(filas).toEqual([])
  })

  it('preserva creado_por NULL (backfill = sistema, no usuario humano)', () => {
    const filas = armarFilasBackfill(
      [{ id: 'p1', empresa_id: 'emp-A', actividad_origen_id: 'act-1', creado_en: '2026-01-01T00:00:00Z' }],
      'presupuesto',
    )
    expect(filas[0].creado_por).toBeNull()
  })

  it('multi-tenant: relaciones se atribuyen a la empresa correcta', () => {
    const filas = armarFilasBackfill(
      [
        { id: 'p1', empresa_id: 'emp-A', actividad_origen_id: 'act-1', creado_en: '2026-01-01T00:00:00Z' },
        { id: 'p2', empresa_id: 'emp-B', actividad_origen_id: 'act-2', creado_en: '2026-01-01T00:00:00Z' },
      ],
      'presupuesto',
    )
    const empA = filas.filter((f) => f.empresa_id === 'emp-A')
    const empB = filas.filter((f) => f.empresa_id === 'emp-B')
    expect(empA).toHaveLength(1)
    expect(empB).toHaveLength(1)
    expect(empA[0].entidad_id).toBe('p1')
    expect(empB[0].entidad_id).toBe('p2')
  })

  it('idempotencia: re-procesar las mismas filas no duplica relaciones', () => {
    const presupuestos: FilaConOrigen[] = [
      { id: 'p1', empresa_id: 'emp-A', actividad_origen_id: 'act-1', creado_en: '2026-01-01T00:00:00Z' },
      { id: 'p1', empresa_id: 'emp-A', actividad_origen_id: 'act-1', creado_en: '2026-01-01T00:00:00Z' }, // duplicado exacto
    ]
    const filas = armarFilasBackfill(presupuestos, 'presupuesto')
    expect(filas).toHaveLength(1) // dedup por clave compuesta
  })
})

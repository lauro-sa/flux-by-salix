/**
 * Tests del guard `esBodyActualizarFlujo` con foco en la extensión de
 * `icono` y `color` (sub-PR 19.2 — commit 1 backend).
 *
 * El guard cubre el contrato del PUT /api/flujos/[id]. Los campos
 * `icono` y `color` siguen el mismo patrón tri-state que `descripcion`:
 *   • undefined → no tocar la columna
 *   • null      → setear a NULL (limpiar)
 *   • string    → setear (con length check)
 *
 * String vacío se rechaza intencionalmente para forzar `null` explícito
 * y evitar ambigüedad en el handler.
 *
 * No incluimos en este archivo los tests de los demás campos del body
 * porque no se modificaron — sus reglas previas siguen viviendo en el
 * contrato del guard. Si en el futuro alguien añade tests de los demás
 * campos, este archivo se renombra a `flujos-body-actualizar.test.ts`
 * (ya tiene ese nombre) y se suman describe blocks.
 */

import { describe, expect, it } from 'vitest'
import { esBodyActualizarFlujo } from '@/tipos/workflow'

describe('esBodyActualizarFlujo — icono y color (sub-PR 19.2)', () => {
  it('acepta body con icono y color válidos', () => {
    expect(esBodyActualizarFlujo({ icono: 'BellRing', color: 'advertencia' })).toBe(true)
  })

  it('acepta body solo con icono', () => {
    expect(esBodyActualizarFlujo({ icono: 'Workflow' })).toBe(true)
  })

  it('acepta body solo con color', () => {
    expect(esBodyActualizarFlujo({ color: 'primario' })).toBe(true)
  })

  it('acepta body sin icono ni color (no toca esas columnas)', () => {
    expect(esBodyActualizarFlujo({ nombre: 'Mi flujo' })).toBe(true)
    expect(esBodyActualizarFlujo({})).toBe(true)
  })

  it('acepta null en icono y color (limpia las columnas)', () => {
    expect(esBodyActualizarFlujo({ icono: null, color: null })).toBe(true)
    expect(esBodyActualizarFlujo({ icono: null })).toBe(true)
    expect(esBodyActualizarFlujo({ color: null })).toBe(true)
  })

  it('rechaza string vacío en icono o color (forzar null para limpiar)', () => {
    // Razón: si el handler aceptara "" además de null, tendría que
    // decidir entre ambas en el normalizador. Cerramos el contrato a
    // "string no vacío | null | undefined" y la UI manda null cuando
    // quiere limpiar.
    expect(esBodyActualizarFlujo({ icono: '' })).toBe(false)
    expect(esBodyActualizarFlujo({ color: '' })).toBe(false)
    expect(esBodyActualizarFlujo({ icono: '   ' })).toBe(false)
  })

  it('rechaza tipos no-string en icono o color', () => {
    expect(esBodyActualizarFlujo({ icono: 123 })).toBe(false)
    expect(esBodyActualizarFlujo({ icono: true })).toBe(false)
    expect(esBodyActualizarFlujo({ color: ['rosa'] })).toBe(false)
    expect(esBodyActualizarFlujo({ color: { tono: 'rojo' } })).toBe(false)
  })

  it('rechaza icono o color que excedan los límites de longitud', () => {
    const iconoLargo = 'A'.repeat(65)
    const colorLargo = 'a'.repeat(33)
    expect(esBodyActualizarFlujo({ icono: iconoLargo })).toBe(false)
    expect(esBodyActualizarFlujo({ color: colorLargo })).toBe(false)
  })

  it('combina icono/color con los demás campos del body sin romper', () => {
    expect(esBodyActualizarFlujo({
      nombre: 'Recordatorio',
      descripcion: null,
      icono: 'BellRing',
      color: 'advertencia',
      disparador: { tipo: 'tiempo.cron', configuracion: { expresion: '0 9 * * *' } },
      acciones: [],
    })).toBe(true)
  })

  it('sigue rechazando estado / borrador_jsonb / activo aunque vengan icono/color válidos', () => {
    expect(esBodyActualizarFlujo({ icono: 'X', estado: 'activo' })).toBe(false)
    expect(esBodyActualizarFlujo({ color: 'exito', borrador_jsonb: {} })).toBe(false)
    expect(esBodyActualizarFlujo({ icono: 'Y', activo: true })).toBe(false)
  })
})

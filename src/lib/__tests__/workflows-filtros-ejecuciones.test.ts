/**
 * Tests unit de parsearFiltrosEjecuciones (PR 18.3).
 *
 * Cubrimos:
 *   - Defaults cuando no hay params.
 *   - Filtrado contra catálogos (estados, disparado_por_tipos).
 *   - UUID inválido en flujo_id se descarta a null.
 *   - CSV con espacios y vacíos.
 *   - Paginación clamp (mínimo 1, máximo POR_PAGINA_MAX).
 *   - error_raw_class: CSV libre (sin whitelist).
 */

import { describe, expect, it } from 'vitest'
import { parsearFiltrosEjecuciones } from '../workflows/filtros-ejecuciones'

function p(s: string): URLSearchParams {
  return new URLSearchParams(s)
}

describe('parsearFiltrosEjecuciones — defaults', () => {
  it('devuelve filtros vacíos cuando no hay params', () => {
    const r = parsearFiltrosEjecuciones(p(''))
    expect(r.flujo_id).toBeNull()
    expect(r.estados).toEqual([])
    expect(r.desde).toBeNull()
    expect(r.hasta).toBeNull()
    expect(r.creado_rango).toBeNull()
    expect(r.disparado_por_tipos).toEqual([])
    expect(r.entidad_tipo).toBeNull()
    expect(r.entidad_id).toBeNull()
    expect(r.error_raw_class).toEqual([])
    expect(r.pagina).toBe(1)
    expect(r.por_pagina).toBe(50)
  })
})

describe('parsearFiltrosEjecuciones — flujo_id', () => {
  it('acepta UUID válido', () => {
    const r = parsearFiltrosEjecuciones(p('flujo_id=11111111-1111-1111-1111-111111111111'))
    expect(r.flujo_id).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('descarta string que no es UUID', () => {
    const r = parsearFiltrosEjecuciones(p('flujo_id=abc'))
    expect(r.flujo_id).toBeNull()
  })

  it('descarta UUID malformado (longitud incorrecta)', () => {
    const r = parsearFiltrosEjecuciones(p('flujo_id=11111111-1111-1111-1111-1111'))
    expect(r.flujo_id).toBeNull()
  })
})

describe('parsearFiltrosEjecuciones — estados (catálogo TS)', () => {
  it('acepta solo estados conocidos del catálogo', () => {
    const r = parsearFiltrosEjecuciones(p('estado=pendiente,esperando,inventado'))
    expect(r.estados.sort()).toEqual(['esperando', 'pendiente'].sort())
  })

  it('limpia espacios y separadores vacíos', () => {
    const r = parsearFiltrosEjecuciones(p('estado= pendiente , , esperando '))
    expect(r.estados.sort()).toEqual(['esperando', 'pendiente'].sort())
  })

  it('todos los 6 estados válidos pasan', () => {
    const r = parsearFiltrosEjecuciones(
      p('estado=pendiente,corriendo,esperando,completado,fallado,cancelado'),
    )
    expect(r.estados).toHaveLength(6)
  })
})

describe('parsearFiltrosEjecuciones — disparado_por_tipo (whitelist)', () => {
  it('acepta los 4 prefijos válidos', () => {
    const r = parsearFiltrosEjecuciones(p('disparado_por_tipo=cambios_estado,cron,manual,webhook'))
    expect(r.disparado_por_tipos.sort()).toEqual(
      ['cambios_estado', 'cron', 'manual', 'webhook'].sort(),
    )
  })

  it('descarta valores fuera de whitelist', () => {
    const r = parsearFiltrosEjecuciones(p('disparado_por_tipo=manual,otro_origen'))
    expect(r.disparado_por_tipos).toEqual(['manual'])
  })
})

describe('parsearFiltrosEjecuciones — entidad', () => {
  it('acepta tipo y id como strings libres', () => {
    const r = parsearFiltrosEjecuciones(p('entidad_tipo=presupuesto&entidad_id=algo-cualquiera'))
    expect(r.entidad_tipo).toBe('presupuesto')
    expect(r.entidad_id).toBe('algo-cualquiera')
  })
})

describe('parsearFiltrosEjecuciones — error_raw_class', () => {
  it('acepta CSV libre sin whitelist', () => {
    const r = parsearFiltrosEjecuciones(p('error_raw_class=VariableFaltante,HelperTipoInvalido'))
    expect(r.error_raw_class).toEqual(['VariableFaltante', 'HelperTipoInvalido'])
  })

  it('limpia espacios', () => {
    const r = parsearFiltrosEjecuciones(p('error_raw_class= VariableFaltante , HelperTipoInvalido '))
    expect(r.error_raw_class).toEqual(['VariableFaltante', 'HelperTipoInvalido'])
  })
})

describe('parsearFiltrosEjecuciones — paginación', () => {
  it('clamp inferior: pagina < 1 → 1', () => {
    const r = parsearFiltrosEjecuciones(p('pagina=0'))
    expect(r.pagina).toBe(1)
  })

  it('clamp por_pagina máximo (200)', () => {
    const r = parsearFiltrosEjecuciones(p('por_pagina=10000'))
    expect(r.por_pagina).toBe(200)
  })

  it('clamp por_pagina mínimo (1)', () => {
    const r = parsearFiltrosEjecuciones(p('por_pagina=0'))
    expect(r.por_pagina).toBe(1)
  })

  it('valor numérico válido se respeta', () => {
    const r = parsearFiltrosEjecuciones(p('pagina=3&por_pagina=25'))
    expect(r.pagina).toBe(3)
    expect(r.por_pagina).toBe(25)
  })

  it('valor no numérico cae al default', () => {
    const r = parsearFiltrosEjecuciones(p('por_pagina=abc'))
    expect(r.por_pagina).toBe(50)
  })
})

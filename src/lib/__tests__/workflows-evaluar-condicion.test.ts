/**
 * Tests unit del evaluador de condiciones (sub-PR 15.2).
 *
 * Cubre:
 *   - Cada operador del catálogo (igual, distinto, mayor, menor,
 *     mayor_o_igual, menor_o_igual, contiene, no_contiene, existe,
 *     no_existe, en_lista, no_en_lista, entre, dias_desde, dias_hasta).
 *   - Anidamiento Y/O.
 *   - Dot notation para campos relacionados.
 *   - Falla cerrada (false) en estructuras rotas.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  evaluarCondicion,
  leerCampo,
} from '../workflows/evaluar-condicion'

const ctx = {
  entidad: {
    estado_nuevo: 'aceptado',
    estado_anterior: 'enviado',
    monto: 150000,
    contacto: { tipo: 'premium', email: 'cliente@ejemplo.com' },
  },
  cambio: { fecha: '2026-04-15T10:00:00Z' },
  empresa: { zona_horaria: 'America/Argentina/Buenos_Aires' },
  vacio: null,
  lista: ['a', 'b', 'c'],
}

describe('leerCampo (dot notation)', () => {
  it('lee campo top-level', () => {
    expect(leerCampo('vacio', ctx)).toBeNull()
  })
  it('lee campo anidado con dot notation', () => {
    expect(leerCampo('entidad.estado_nuevo', ctx)).toBe('aceptado')
    expect(leerCampo('entidad.contacto.tipo', ctx)).toBe('premium')
  })
  it('devuelve undefined si algún tramo no existe', () => {
    expect(leerCampo('entidad.nada.profundo', ctx)).toBeUndefined()
    expect(leerCampo('inexistente', ctx)).toBeUndefined()
  })
})

describe('evaluarCondicion — operadores de igualdad', () => {
  it('igual: matchea string', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
        ctx,
      ),
    ).toBe(true)
  })
  it('igual: no matchea valor distinto', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'rechazado' },
        ctx,
      ),
    ).toBe(false)
  })
  it('distinto: el opuesto de igual', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'distinto', valor: 'rechazado' },
        ctx,
      ),
    ).toBe(true)
  })
  it('igual: cross-type number coercion (jsonb friendly)', () => {
    // monto es 150000 (number); valor llega como string del jsonb.
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'igual', valor: '150000' },
        ctx,
      ),
    ).toBe(true)
  })
})

describe('evaluarCondicion — operadores numéricos', () => {
  it('mayor', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'mayor', valor: 100000 },
        ctx,
      ),
    ).toBe(true)
  })
  it('menor', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'menor', valor: 100000 },
        ctx,
      ),
    ).toBe(false)
  })
  it('mayor_o_igual', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'mayor_o_igual', valor: 150000 },
        ctx,
      ),
    ).toBe(true)
  })
  it('menor_o_igual', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'menor_o_igual', valor: 150000 },
        ctx,
      ),
    ).toBe(true)
  })
})

describe('evaluarCondicion — operadores de texto', () => {
  it('contiene', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.contacto.email', operador: 'contiene', valor: 'ejemplo' },
        ctx,
      ),
    ).toBe(true)
  })
  it('no_contiene', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.contacto.email', operador: 'no_contiene', valor: 'spam' },
        ctx,
      ),
    ).toBe(true)
  })
})

describe('evaluarCondicion — existencia', () => {
  it('existe: campo presente', () => {
    expect(
      evaluarCondicion({ campo: 'entidad.contacto.email', operador: 'existe' }, ctx),
    ).toBe(true)
  })
  it('existe: false en null/undefined', () => {
    expect(evaluarCondicion({ campo: 'vacio', operador: 'existe' }, ctx)).toBe(false)
    expect(evaluarCondicion({ campo: 'inexistente', operador: 'existe' }, ctx)).toBe(false)
  })
  it('no_existe: opuesto', () => {
    expect(evaluarCondicion({ campo: 'vacio', operador: 'no_existe' }, ctx)).toBe(true)
    expect(
      evaluarCondicion({ campo: 'entidad.estado_nuevo', operador: 'no_existe' }, ctx),
    ).toBe(false)
  })
})

describe('evaluarCondicion — listas', () => {
  it('en_lista', () => {
    expect(
      evaluarCondicion(
        {
          campo: 'entidad.estado_nuevo',
          operador: 'en_lista',
          valor: ['aceptado', 'enviado', 'borrador'],
        },
        ctx,
      ),
    ).toBe(true)
  })
  it('en_lista: no presente', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'en_lista', valor: ['rechazado'] },
        ctx,
      ),
    ).toBe(false)
  })
  it('no_en_lista', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'no_en_lista', valor: ['rechazado'] },
        ctx,
      ),
    ).toBe(true)
  })
  it('en_lista: valor no es array → false', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.estado_nuevo', operador: 'en_lista', valor: 'aceptado' as never },
        ctx,
      ),
    ).toBe(false)
  })
})

describe('evaluarCondicion — entre (rango)', () => {
  it('valor dentro del rango', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'entre', valor: [100000, 200000] },
        ctx,
      ),
    ).toBe(true)
  })
  it('valor fuera del rango', () => {
    expect(
      evaluarCondicion(
        { campo: 'entidad.monto', operador: 'entre', valor: [200000, 300000] },
        ctx,
      ),
    ).toBe(false)
  })
})

describe('evaluarCondicion — temporales', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T10:00:00Z')) // 10 días después de cambio.fecha
  })
  afterEach(() => vi.useRealTimers())

  it('dias_desde: hace 10 días, comparado con 5 → true', () => {
    expect(
      evaluarCondicion(
        { campo: 'cambio.fecha', operador: 'dias_desde', valor: 5 },
        ctx,
      ),
    ).toBe(true)
  })
  it('dias_desde: hace 10 días, comparado con 30 → false', () => {
    expect(
      evaluarCondicion(
        { campo: 'cambio.fecha', operador: 'dias_desde', valor: 30 },
        ctx,
      ),
    ).toBe(false)
  })
})

describe('evaluarCondicion — anidamiento Y/O', () => {
  it('Y: ambas verdaderas', () => {
    expect(
      evaluarCondicion(
        {
          operador: 'y',
          condiciones: [
            { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
            { campo: 'entidad.monto', operador: 'mayor', valor: 100000 },
          ],
        },
        ctx,
      ),
    ).toBe(true)
  })
  it('Y: una falsa hace todo falso', () => {
    expect(
      evaluarCondicion(
        {
          operador: 'y',
          condiciones: [
            { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'aceptado' },
            { campo: 'entidad.monto', operador: 'mayor', valor: 200000 },
          ],
        },
        ctx,
      ),
    ).toBe(false)
  })
  it('O: una verdadera hace todo verdadero', () => {
    expect(
      evaluarCondicion(
        {
          operador: 'o',
          condiciones: [
            { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'rechazado' },
            { campo: 'entidad.monto', operador: 'mayor', valor: 100000 },
          ],
        },
        ctx,
      ),
    ).toBe(true)
  })
  it('Anidamiento mixto Y dentro de O', () => {
    expect(
      evaluarCondicion(
        {
          operador: 'o',
          condiciones: [
            { campo: 'entidad.estado_nuevo', operador: 'igual', valor: 'rechazado' },
            {
              operador: 'y',
              condiciones: [
                { campo: 'entidad.contacto.tipo', operador: 'igual', valor: 'premium' },
                { campo: 'entidad.monto', operador: 'mayor', valor: 100000 },
              ],
            },
          ],
        },
        ctx,
      ),
    ).toBe(true)
  })
})

describe('evaluarCondicion — falla cerrada', () => {
  it('estructura rota: ni hoja ni compuesta → false', () => {
    expect(
      evaluarCondicion({ algo: 'cualquiera' } as never, ctx),
    ).toBe(false)
  })
  it('compuesta vacía con Y: vacuously true', () => {
    expect(
      evaluarCondicion({ operador: 'y', condiciones: [] }, ctx),
    ).toBe(true)
  })
  it('compuesta vacía con O: vacuously false', () => {
    expect(
      evaluarCondicion({ operador: 'o', condiciones: [] }, ctx),
    ).toBe(false)
  })
})

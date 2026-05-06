/**
 * Tests del parser bidireccional de expresiones `{{ ... }}` del editor
 * de flujos (sub-PR 19.3b).
 *
 * Verifica los dos sentidos:
 *   • parsearTexto(canon) produce los segmentos esperados.
 *   • serializarSegmentos(parsearTexto(canon)) === canon (idempotencia).
 *
 * Casos edge cubiertos (caveat del coordinador):
 *   • Sin helper.
 *   • Un helper.
 *   • Chain 2+ helpers.
 *   • Helper con un argumento.
 *   • Helper con string arg (default('Cliente')).
 *   • Mezcla con texto plano.
 *   • Variables consecutivas (`{{a}}{{b}}`).
 *   • `{{ }}` vacío preservado como texto literal.
 *   • Whitespace canonizado (parser tolera, serializador outputea forma canónica).
 *   • Comillas escapadas — NO soportadas en 19.3b: el parser falla
 *     gracefully y deja el `{{ }}` como texto literal.
 */

import { describe, expect, it } from 'vitest'
import {
  parsearTexto,
  serializarSegmentos,
  parsearExpresionVariable,
  serializarExpresionVariable,
  type ExpresionVariable,
} from '@/app/(flux)/flujos/[id]/_componentes/_picker/parsear-expresion'

describe('parsearTexto · sin helpers', () => {
  it('parsea una variable simple', () => {
    expect(parsearTexto('{{ presupuesto.total }}')).toEqual([
      {
        tipo: 'variable',
        expresion: { ruta: 'presupuesto.total', helpers: [] },
      },
    ])
  })

  it('parsea variable con dot notation profunda', () => {
    expect(parsearTexto('{{ entidad.cliente.empresa.nombre }}')).toEqual([
      {
        tipo: 'variable',
        expresion: { ruta: 'entidad.cliente.empresa.nombre', helpers: [] },
      },
    ])
  })

  it('parsea variable sin whitespace alrededor (forma compacta)', () => {
    expect(parsearTexto('{{contacto.nombre}}')).toEqual([
      {
        tipo: 'variable',
        expresion: { ruta: 'contacto.nombre', helpers: [] },
      },
    ])
  })

  it('parsea variable con whitespace exagerado', () => {
    expect(parsearTexto('{{   contacto.nombre   }}')).toEqual([
      {
        tipo: 'variable',
        expresion: { ruta: 'contacto.nombre', helpers: [] },
      },
    ])
  })
})

describe('parsearTexto · con helpers', () => {
  it('parsea un helper sin args', () => {
    expect(parsearTexto('{{ presupuesto.total | moneda }}')).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'presupuesto.total',
          helpers: [{ nombre: 'moneda', args: [] }],
        },
      },
    ])
  })

  it('parsea chain de 2 helpers sin args', () => {
    expect(parsearTexto('{{ fecha | fecha_corta | mayusculas }}')).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'fecha',
          helpers: [
            { nombre: 'fecha_corta', args: [] },
            { nombre: 'mayusculas', args: [] },
          ],
        },
      },
    ])
  })

  it('parsea helper con argumento numérico', () => {
    expect(parsearTexto('{{ texto | truncar(50) }}')).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'texto',
          helpers: [{ nombre: 'truncar', args: [50] }],
        },
      },
    ])
  })

  it('parsea helper con string arg en comillas simples', () => {
    expect(parsearTexto("{{ x | default('Cliente') }}")).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'x',
          helpers: [{ nombre: 'default', args: ['Cliente'] }],
        },
      },
    ])
  })

  it('parsea helper con string arg en comillas dobles', () => {
    expect(parsearTexto('{{ x | default("Cliente") }}')).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'x',
          helpers: [{ nombre: 'default', args: ['Cliente'] }],
        },
      },
    ])
  })

  it('parsea chain mixto: helper sin args + helper con args', () => {
    expect(parsearTexto('{{ y | mayusculas | truncar(10) }}')).toEqual([
      {
        tipo: 'variable',
        expresion: {
          ruta: 'y',
          helpers: [
            { nombre: 'mayusculas', args: [] },
            { nombre: 'truncar', args: [10] },
          ],
        },
      },
    ])
  })
})

describe('parsearTexto · mezcla con texto plano', () => {
  it('parsea variable con texto antes y después', () => {
    const segs = parsearTexto('Hola {{ contacto.nombre | nombre_corto }}, todo bien')
    expect(segs).toEqual([
      { tipo: 'texto', valor: 'Hola ' },
      {
        tipo: 'variable',
        expresion: {
          ruta: 'contacto.nombre',
          helpers: [{ nombre: 'nombre_corto', args: [] }],
        },
      },
      { tipo: 'texto', valor: ', todo bien' },
    ])
  })

  it('parsea dos variables consecutivas sin texto entre medio', () => {
    expect(parsearTexto('{{ a }}{{ b }}')).toEqual([
      { tipo: 'variable', expresion: { ruta: 'a', helpers: [] } },
      { tipo: 'variable', expresion: { ruta: 'b', helpers: [] } },
    ])
  })

  it('parsea texto plano sin variables', () => {
    expect(parsearTexto('Solo texto plano sin variables')).toEqual([
      { tipo: 'texto', valor: 'Solo texto plano sin variables' },
    ])
  })

  it('devuelve [] para string vacío', () => {
    expect(parsearTexto('')).toEqual([])
  })
})

describe('parsearTexto · casos malformados (preservar como texto)', () => {
  it('preserva `{{ }}` vacío como texto literal', () => {
    expect(parsearTexto('Antes {{ }} después')).toEqual([
      { tipo: 'texto', valor: 'Antes {{ }} después' },
    ])
  })

  it('preserva `{{ }}` sin cierre como texto', () => {
    expect(parsearTexto('Texto {{ contacto.nombre y nada')).toEqual([
      { tipo: 'texto', valor: 'Texto {{ contacto.nombre y nada' },
    ])
  })

  it('preserva variable malformada con shape inválido', () => {
    // Empieza con dígito → no es path válido.
    expect(parsearTexto('{{ 9bad }}')).toEqual([
      { tipo: 'texto', valor: '{{ 9bad }}' },
    ])
  })

  it('preserva helper malformado (paréntesis sin nombre)', () => {
    expect(parsearTexto('{{ x | (50) }}')).toEqual([
      { tipo: 'texto', valor: '{{ x | (50) }}' },
    ])
  })

  it('preserva expresión con comillas escapadas (no soportadas en 19.3b)', () => {
    // Caveat documentado: comilla escapada dentro de string arg.
    expect(parsearTexto("{{ x | default('Don\\'t') }}")).toEqual([
      { tipo: 'texto', valor: "{{ x | default('Don\\'t') }}" },
    ])
  })
})

describe('serializarSegmentos · forma canónica', () => {
  it('serializa variable simple en forma canónica', () => {
    const expr: ExpresionVariable = { ruta: 'presupuesto.total', helpers: [] }
    expect(serializarExpresionVariable(expr)).toBe('{{ presupuesto.total }}')
  })

  it('serializa helper sin args', () => {
    const expr: ExpresionVariable = {
      ruta: 'presupuesto.total',
      helpers: [{ nombre: 'moneda', args: [] }],
    }
    expect(serializarExpresionVariable(expr)).toBe('{{ presupuesto.total | moneda }}')
  })

  it('serializa chain de helpers', () => {
    const expr: ExpresionVariable = {
      ruta: 'fecha',
      helpers: [
        { nombre: 'fecha_corta', args: [] },
        { nombre: 'mayusculas', args: [] },
      ],
    }
    expect(serializarExpresionVariable(expr)).toBe('{{ fecha | fecha_corta | mayusculas }}')
  })

  it('serializa helper con number arg', () => {
    const expr: ExpresionVariable = {
      ruta: 'texto',
      helpers: [{ nombre: 'truncar', args: [50] }],
    }
    expect(serializarExpresionVariable(expr)).toBe('{{ texto | truncar(50) }}')
  })

  it('serializa string arg con comillas simples por default', () => {
    const expr: ExpresionVariable = {
      ruta: 'x',
      helpers: [{ nombre: 'default', args: ['Cliente'] }],
    }
    expect(serializarExpresionVariable(expr)).toBe("{{ x | default('Cliente') }}")
  })

  it('serializa string arg con apóstrofe usando comillas dobles', () => {
    const expr: ExpresionVariable = {
      ruta: 'x',
      helpers: [{ nombre: 'default', args: ["Don't"] }],
    }
    expect(serializarExpresionVariable(expr)).toBe(`{{ x | default("Don't") }}`)
  })

  it('serializa null / true / false como literales', () => {
    const expr: ExpresionVariable = {
      ruta: 'x',
      helpers: [{ nombre: 'h', args: [null, true, false] }],
    }
    expect(serializarExpresionVariable(expr)).toBe('{{ x | h(null, true, false) }}')
  })

  it('serializa segmentos mezclados con texto', () => {
    const segs = parsearTexto('Hola {{ contacto.nombre | nombre_corto }}!')
    expect(serializarSegmentos(segs)).toBe('Hola {{ contacto.nombre | nombre_corto }}!')
  })
})

describe('roundtrip canónica: serializar(parsear(canon)) === canon', () => {
  // Los strings acá ya están en forma canónica (espacios `{{ x | h(a) }}`)
  // — el test verifica que no haya pérdida ni cambios al hacer la
  // ida y vuelta.
  const canonicas = [
    '{{ presupuesto.total }}',
    '{{ presupuesto.total | moneda }}',
    '{{ fecha | fecha_corta | mayusculas }}',
    '{{ texto | truncar(50) }}',
    "{{ x | default('Cliente') }}",
    'Hola {{ contacto.nombre | nombre_corto }}, tu presupuesto está listo',
    '{{ a }}{{ b }}',
    'Sin variables',
    '',
    "{{ x | default('valor con espacios y signos !? ') }}",
    '{{ y | mayusculas | truncar(10) }}',
  ]

  for (const canon of canonicas) {
    it(`preserva exactamente: ${JSON.stringify(canon)}`, () => {
      const segs = parsearTexto(canon)
      expect(serializarSegmentos(segs)).toBe(canon)
    })
  }
})

describe('parsearExpresionVariable directo (sin envolver en {{ }})', () => {
  it('parsea contenido interno', () => {
    expect(parsearExpresionVariable('contacto.nombre')).toEqual({
      ruta: 'contacto.nombre',
      helpers: [],
    })
  })

  it('rechaza string vacío', () => {
    expect(parsearExpresionVariable('')).toBeNull()
    expect(parsearExpresionVariable('   ')).toBeNull()
  })

  it('rechaza path malformado', () => {
    expect(parsearExpresionVariable('9bad')).toBeNull()
    expect(parsearExpresionVariable('with spaces')).toBeNull()
  })

  it('rechaza primer segmento como función', () => {
    expect(parsearExpresionVariable('foo()')).toBeNull()
  })
})

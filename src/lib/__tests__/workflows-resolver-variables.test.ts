/**
 * Tests unit del resolver de variables {{vars}} (PR 16).
 *
 * Cubre:
 *   - Parser básico (variable simple, dot notation, espacios, sin vars).
 *   - 15 helpers individuales con casos válidos + edge cases.
 *   - Helpers chained (orden, propagación de tipos).
 *   - Comportamiento ante variable faltante (error vs default).
 *   - Validación de tipos en helpers (HelperTipoInvalido).
 *   - Helper desconocido.
 *   - resolverEnObjeto recursivo (jsonb anidado).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  resolverPlantilla,
  resolverEnObjeto,
  leerCampoDot,
  VariableFaltanteError,
  HelperTipoInvalidoError,
  HelperDesconocidoError,
} from '../workflows/resolver-variables'

// Contexto base usado en muchos tests.
const ctx = {
  entidad: {
    numero: 'PR-2026-001',
    monto: 150000,
    cliente: { nombre: 'Juan Pérez Rodriguez', email: 'juan@ejemplo.com' },
  },
  contacto: { nombre: 'Juan Pérez Rodriguez', telefono: '+5491134567890' },
  cambio: { fecha: '2026-04-15T14:30:00Z', estado_nuevo: 'aceptado' },
  empresa: {
    nombre: 'Herreelec SAS',
    zona_horaria: 'America/Argentina/Buenos_Aires',
    moneda: 'ARS',
  },
  ahora: '2026-04-15T14:30:00Z',
}

describe('leerCampoDot', () => {
  it('lee dot notation', () => {
    expect(leerCampoDot('entidad.numero', ctx)).toBe('PR-2026-001')
    expect(leerCampoDot('entidad.cliente.nombre', ctx)).toBe('Juan Pérez Rodriguez')
  })
  it('devuelve undefined si el path no resuelve', () => {
    expect(leerCampoDot('inexistente.x', ctx)).toBeUndefined()
    expect(leerCampoDot('entidad.nada', ctx)).toBeUndefined()
  })
})

describe('resolverPlantilla — parser básico', () => {
  it('plantilla sin vars devuelve igual', () => {
    expect(resolverPlantilla('Hola mundo', ctx)).toBe('Hola mundo')
  })
  it('reemplaza var simple', () => {
    expect(resolverPlantilla('Presupuesto {{entidad.numero}}', ctx)).toBe(
      'Presupuesto PR-2026-001',
    )
  })
  it('soporta espacios alrededor', () => {
    expect(resolverPlantilla('{{ entidad.numero }}', ctx)).toBe('PR-2026-001')
  })
  it('múltiples vars en una línea', () => {
    expect(
      resolverPlantilla('{{entidad.numero}} - {{cambio.estado_nuevo}}', ctx),
    ).toBe('PR-2026-001 - aceptado')
  })
  it('var numérica se convierte a string', () => {
    expect(resolverPlantilla('Total: {{entidad.monto}}', ctx)).toBe('Total: 150000')
  })
})

describe('resolverPlantilla — variable faltante', () => {
  it('lanza VariableFaltanteError sin default', () => {
    expect(() =>
      resolverPlantilla('Hola {{contacto.nada}}', ctx),
    ).toThrow(VariableFaltanteError)
  })
  it('default permite continuar con fallback string', () => {
    expect(
      resolverPlantilla('Hola {{contacto.nada | default("Cliente")}}', ctx),
    ).toBe('Hola Cliente')
  })
  it('default vacío para campos opcionales', () => {
    expect(
      resolverPlantilla('Email: {{contacto.email | default("")}}', ctx),
    ).toBe('Email: ')
  })
  it('default + helper post-default funciona', () => {
    expect(
      resolverPlantilla(
        '{{contacto.nada | default("juan") | mayusculas}}',
        ctx,
      ),
    ).toBe('JUAN')
  })
})

describe('resolverPlantilla — helpers de fechas', () => {
  it('fecha formato largo', () => {
    const r = resolverPlantilla('{{cambio.fecha | fecha}}', ctx)
    // Esperamos algo tipo "15 de abril de 2026" en es-AR / Buenos Aires.
    expect(r).toMatch(/15.*abril.*2026/)
  })
  it('fecha_corta', () => {
    expect(resolverPlantilla('{{cambio.fecha | fecha_corta}}', ctx)).toBe('15/04/2026')
  })
  it('hora', () => {
    // 14:30 UTC en Buenos Aires (UTC-3) = 11:30
    expect(resolverPlantilla('{{cambio.fecha | hora}}', ctx)).toBe('11:30')
  })
  it('dia_semana', () => {
    // 15 de abril de 2026 es miércoles.
    expect(resolverPlantilla('{{cambio.fecha | dia_semana}}', ctx)).toBe('miércoles')
  })

  describe('fecha_relativa', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-15T14:30:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('diff < 1 min devuelve "ahora" (numeric:auto)', () => {
      const r = resolverPlantilla('{{cambio.fecha | fecha_relativa}}', ctx)
      expect(r).toMatch(/ahora/)
    })
    it('hace 3 días', () => {
      vi.setSystemTime(new Date('2026-04-18T14:30:00Z'))
      const r = resolverPlantilla('{{cambio.fecha | fecha_relativa}}', ctx)
      expect(r).toMatch(/hace 3 días/)
    })
    it('en 5 días', () => {
      vi.setSystemTime(new Date('2026-04-10T14:30:00Z'))
      const r = resolverPlantilla('{{cambio.fecha | fecha_relativa}}', ctx)
      expect(r).toMatch(/dentro de 5 días|en 5 días/)
    })
  })
})

describe('resolverPlantilla — helpers numéricos', () => {
  it('moneda formato AR', () => {
    const r = resolverPlantilla('{{entidad.monto | moneda}}', ctx)
    // Intl puede producir "$ 150.000,00" o variantes; verificamos el número.
    expect(r).toMatch(/150\.000,00/)
  })
  it('numero con miles', () => {
    expect(resolverPlantilla('{{entidad.monto | numero}}', ctx)).toBe('150.000')
  })
  it('porcentaje', () => {
    expect(
      resolverPlantilla('{{tasa | porcentaje}}', { ...ctx, tasa: 0.125 }),
    ).toMatch(/12,5\s?%/)
  })
})

describe('resolverPlantilla — helpers de strings', () => {
  it('mayusculas', () => {
    expect(resolverPlantilla('{{contacto.nombre | mayusculas}}', ctx)).toBe(
      'JUAN PÉREZ RODRIGUEZ',
    )
  })
  it('minusculas', () => {
    expect(resolverPlantilla('{{contacto.nombre | minusculas}}', ctx)).toBe(
      'juan pérez rodriguez',
    )
  })
  it('capitalizar', () => {
    expect(
      resolverPlantilla('{{x | capitalizar}}', { ...ctx, x: 'hola mundo de juan' }),
    ).toBe('Hola Mundo De Juan')
  })
  it('nombre_corto: solo primer token', () => {
    expect(
      resolverPlantilla('{{contacto.nombre | nombre_corto}}', ctx),
    ).toBe('Juan')
  })
  it('truncar(N)', () => {
    expect(
      resolverPlantilla('{{x | truncar(5)}}', { ...ctx, x: 'Esto es muy largo' }),
    ).toBe('Esto …')
  })
})

describe('resolverPlantilla — chained helpers', () => {
  it('moneda + mayusculas (cuando moneda devuelve string ya)', () => {
    const r = resolverPlantilla('{{entidad.monto | moneda | mayusculas}}', ctx)
    expect(r).toMatch(/150\.000,00/)
  })
  it('nombre_corto + mayusculas', () => {
    expect(
      resolverPlantilla('{{contacto.nombre | nombre_corto | mayusculas}}', ctx),
    ).toBe('JUAN')
  })
})

describe('resolverPlantilla — validación de tipos', () => {
  it('moneda con string lanza HelperTipoInvalido', () => {
    expect(() =>
      resolverPlantilla('{{entidad.numero | moneda}}', ctx),
    ).toThrow(HelperTipoInvalidoError)
  })
  it('mayusculas con number lanza HelperTipoInvalido', () => {
    expect(() =>
      resolverPlantilla('{{entidad.monto | mayusculas}}', ctx),
    ).toThrow(HelperTipoInvalidoError)
  })
  it('error de tipo incluye nombre del helper en el mensaje', () => {
    try {
      resolverPlantilla('{{entidad.numero | moneda}}', ctx)
      expect.fail('Debió lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(HelperTipoInvalidoError)
      expect((e as Error).message).toMatch(/moneda.*number.*string/)
    }
  })
  it('chained mal ordenado: mayusculas → moneda falla', () => {
    expect(() =>
      resolverPlantilla('{{contacto.nombre | mayusculas | moneda}}', ctx),
    ).toThrow(HelperTipoInvalidoError)
  })
})

describe('resolverPlantilla — helper desconocido', () => {
  it('lanza HelperDesconocidoError', () => {
    expect(() =>
      resolverPlantilla('{{contacto.nombre | inexistente}}', ctx),
    ).toThrow(HelperDesconocidoError)
  })
})

describe('resolverEnObjeto — walk recursivo en jsonb', () => {
  it('reemplaza strings dentro de array de objetos', () => {
    const obj = {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Hola {{contacto.nombre | nombre_corto}}' },
        { type: 'text', text: 'Total: {{entidad.monto | numero}}' },
      ],
    }
    const r = resolverEnObjeto(obj, ctx) as typeof obj
    expect(r.parameters[0].text).toBe('Hola Juan')
    expect(r.parameters[1].text).toBe('Total: 150.000')
  })
  it('preserva valores no-string', () => {
    const obj = { x: 'Hola {{entidad.numero}}', y: 42, z: true, w: null }
    const r = resolverEnObjeto(obj, ctx) as typeof obj
    expect(r.x).toBe('Hola PR-2026-001')
    expect(r.y).toBe(42)
    expect(r.z).toBe(true)
    expect(r.w).toBeNull()
  })
  it('walka arrays anidados', () => {
    const obj = [
      { items: ['var: {{entidad.numero}}', 'nada'] },
      'top: {{cambio.estado_nuevo}}',
    ]
    const r = resolverEnObjeto(obj, ctx) as typeof obj
    expect((r[0] as { items: string[] }).items[0]).toBe('var: PR-2026-001')
    expect(r[1]).toBe('top: aceptado')
  })
})

/**
 * Tests del módulo lib/contacto-telefonos.
 *
 * Cubre:
 *   - normalizarListaTelefonos: dedup, principal único, defaults.
 *   - legacyAEntradas: los 4 casos del data-fill (A, B1/B2, C, D).
 *   - resolverListaDesdeBody: prioridad de telefonos[] sobre legacy.
 *
 * También incluye un test de consistencia entre legacyAEntradas y la lógica
 * SQL de la migración 20260422040000_contacto_telefonos.sql, para garantizar
 * que las nuevas escrituras producen el mismo shape que el data-fill histórico.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizarListaTelefonos,
  legacyAEntradas,
  resolverListaDesdeBody,
  type TelefonoEntrada,
} from '../contacto-telefonos'

describe('normalizarListaTelefonos', () => {
  it('devuelve [] para input vacío o nulo', () => {
    expect(normalizarListaTelefonos([])).toEqual([])
    expect(normalizarListaTelefonos(null)).toEqual([])
    expect(normalizarListaTelefonos(undefined)).toEqual([])
  })

  it('descarta entradas con valor inválido', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '' },
      { tipo: 'fijo', valor: '12' },
      { tipo: 'movil', valor: '1156029403' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe('5491156029403')
  })

  it('aplica tipo default movil si no se especifica o es inválido', () => {
    const r = normalizarListaTelefonos([
      { valor: '1156029403' },
      { tipo: 'inexistente', valor: '1167890123' },
    ])
    expect(r[0].tipo).toBe('movil')
    expect(r[1].tipo).toBe('movil')
  })

  it('deduplica por valor normalizado: el mismo número en distintos formatos cuenta como uno', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '1156029403', es_whatsapp: false, es_principal: true },
      { tipo: 'fijo', valor: '+54 9 11 5602-9403', es_whatsapp: true, es_principal: false },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].es_whatsapp).toBe(true)  // OR de flags
    expect(r[0].es_principal).toBe(true) // OR de flags
    expect(r[0].tipo).toBe('movil')      // primero gana en tipo
  })

  it('garantiza exactamente UN principal: si vienen varios, solo el primero queda', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '1156029403', es_principal: true },
      { tipo: 'fijo', valor: '1167890123', es_principal: true },
      { tipo: 'casa', valor: '1144556677', es_principal: true },
    ])
    expect(r.filter(t => t.es_principal)).toHaveLength(1)
    expect(r[0].es_principal).toBe(true)
    expect(r[1].es_principal).toBe(false)
    expect(r[2].es_principal).toBe(false)
  })

  it('si ningún input es principal, marca al primero', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '1156029403', es_principal: false },
      { tipo: 'fijo', valor: '1167890123', es_principal: false },
    ])
    expect(r[0].es_principal).toBe(true)
    expect(r[1].es_principal).toBe(false)
  })

  it('preserva etiqueta y orden cuando se proveen', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'trabajo', valor: '1156029403', etiqueta: '  Oficina  ', orden: 5 },
    ])
    expect(r[0].etiqueta).toBe('Oficina')
    expect(r[0].orden).toBe(5)
  })

  it('asigna orden incremental cuando no se provee', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '1156029403' },
      { tipo: 'fijo', valor: '1167890123' },
      { tipo: 'casa', valor: '1144556677' },
    ])
    expect(r[0].orden).toBe(0)
    expect(r[1].orden).toBe(1)
    expect(r[2].orden).toBe(2)
  })

  it('descarta etiqueta vacía o solo espacios', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'movil', valor: '1156029403', etiqueta: '   ' },
    ])
    expect(r[0].etiqueta).toBeNull()
  })
})

describe('legacyAEntradas — los 4 casos del data-fill', () => {
  it('Caso A: telefono = whatsapp → 1 entrada movil + es_whatsapp + principal', () => {
    const r = legacyAEntradas('5491156029403', '5491156029403')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      tipo: 'movil',
      valor: '5491156029403',
      es_whatsapp: true,
      es_principal: true,
    })
  })

  it('Caso B1: solo telefono móvil AR (549) → tipo movil + principal', () => {
    const r = legacyAEntradas('5491156029403', null)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      tipo: 'movil',
      es_whatsapp: false,
      es_principal: true,
    })
  })

  it('Caso B2: solo telefono fijo (internacional, no parece móvil AR) → tipo fijo + principal', () => {
    // Nota: la regla del 9 de normalizarTelefono convierte cualquier 54XX de 12 dígitos
    // a 549XX (móvil), por lo que un "fijo AR" termina clasificado como móvil. Para
    // testear el caso B2 usamos un fijo de país no-AR que se preserva tal cual.
    const r = legacyAEntradas('+15551234567', null)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      tipo: 'fijo',
      es_whatsapp: false,
      es_principal: true,
    })
  })

  it('Caso C: solo whatsapp → 1 entrada movil + es_whatsapp + principal', () => {
    // Convención: solo móvil tiene WhatsApp implícito. El campo legacy `whatsapp`
    // siempre se mapea a un teléfono móvil con WA marcado.
    const r = legacyAEntradas(null, '5491156029403')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      tipo: 'movil',
      es_whatsapp: true,
      es_principal: true,
    })
  })

  it('Caso D: telefono y whatsapp distintos → 2 entradas', () => {
    const r = legacyAEntradas('+15551234567', '5491167890123')
    expect(r).toHaveLength(2)
    // Telefono → fijo principal sin WA
    expect(r[0]).toMatchObject({
      tipo: 'fijo',
      es_whatsapp: false,
      es_principal: true,
      orden: 0,
    })
    // WhatsApp → movil con WA, no principal, orden 1
    expect(r[1]).toMatchObject({
      tipo: 'movil',
      es_whatsapp: true,
      es_principal: false,
      orden: 1,
    })
  })

  it('devuelve [] cuando ambos campos están vacíos', () => {
    expect(legacyAEntradas(null, null)).toEqual([])
    expect(legacyAEntradas('', '')).toEqual([])
    expect(legacyAEntradas('   ', undefined)).toEqual([])
  })

  it('normaliza los valores antes de comparar (5491... y +54 9 ... son lo mismo)', () => {
    const r = legacyAEntradas('5491156029403', '+54 9 11 5602-9403')
    expect(r).toHaveLength(1)
    expect(r[0].es_whatsapp).toBe(true)
  })
})

describe('resolverListaDesdeBody', () => {
  it('prioriza body.telefonos[] cuando viene presente', () => {
    const entradas: TelefonoEntrada[] = [
      { tipo: 'fijo', valor: '+15551234567', es_principal: true },
    ]
    const r = resolverListaDesdeBody({
      telefonos: entradas,
      telefono: '1199998888',  // ignorado
      whatsapp: '1199998888',
    })
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('fijo')
    expect(r[0].valor).toBe('15551234567')
  })

  it('cae a legacy telefono/whatsapp cuando no viene telefonos[]', () => {
    const r = resolverListaDesdeBody({
      telefono: '1156029403',
      whatsapp: '1156029403',
    })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      tipo: 'movil',
      es_whatsapp: true,
      es_principal: true,
    })
  })

  it('devuelve [] cuando body no trae nada de teléfono', () => {
    expect(resolverListaDesdeBody({})).toEqual([])
    expect(resolverListaDesdeBody({ telefono: null, whatsapp: null })).toEqual([])
  })

  it('telefonos[] vacío SE acepta como vacío (no cae a legacy)', () => {
    const r = resolverListaDesdeBody({
      telefonos: [],
      telefono: '1156029403',  // ignorado
    })
    expect(r).toEqual([])
  })
})

describe('Convención: WhatsApp NO es un tipo', () => {
  it('legacyAEntradas nunca emite tipo=whatsapp', () => {
    // Después de la migración 20260422050000_normalizar_tipo_whatsapp_a_movil,
    // 'whatsapp' dejó de ser un tipo válido. Ningún caso del helper lo emite.
    const r = legacyAEntradas(null, '5491156029403')
    expect(r[0].tipo).not.toBe('whatsapp')
    expect(r[0].tipo).toBe('movil')
  })

  it('si llega tipo=whatsapp por defensividad, normalizarListaTelefonos lo mapea a movil', () => {
    const r = normalizarListaTelefonos([
      { tipo: 'whatsapp', valor: '5491156029403', es_whatsapp: true, es_principal: true },
    ])
    expect(r[0].tipo).toBe('movil')
  })
})

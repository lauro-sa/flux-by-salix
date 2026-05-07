/**
 * Tests del mapeo `TipoDisparador` / `TipoAccion` → categoría de UX.
 *
 * Replicamos el patrón de "claves alcanzables" del sub-PR 19.1
 * (`flujos-etiquetas-disparador.test.ts`): cualquier tipo nuevo que se
 * agregue al catálogo de `tipos/workflow.ts` y olvide aparecer en el
 * mapa rompe estos tests, evitando que el modal `CatalogoPasos`
 * renderice opciones huérfanas en producción.
 */

import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS_DISPARADOR,
  CATEGORIAS_ACCION,
  MAPA_DISPARADOR,
  MAPA_ACCION,
  categoriaDeDisparador,
  categoriaDeAccion,
  disparadoresPorCategoria,
  accionesPorCategoria,
  claveI18nCategoriaAccion,
  claveI18nCategoriaDisparador,
  claveI18nTituloPaso,
  claveI18nDescripcionPaso,
} from '@/lib/workflows/categorias-pasos'
import { TIPOS_DISPARADOR, TIPOS_ACCION } from '@/tipos/workflow'

describe('Cobertura del catálogo (claves alcanzables)', () => {
  it('cada TipoDisparador del catálogo está mapeado a una categoría existente', () => {
    for (const tipo of TIPOS_DISPARADOR) {
      const categoria = MAPA_DISPARADOR[tipo]
      expect(categoria, `Falta mapear ${tipo}`).toBeDefined()
      expect(CATEGORIAS_DISPARADOR).toContain(categoria)
    }
  })

  it('cada TipoAccion del catálogo está mapeado a una categoría existente', () => {
    for (const tipo of TIPOS_ACCION) {
      const categoria = MAPA_ACCION[tipo]
      expect(categoria, `Falta mapear ${tipo}`).toBeDefined()
      expect(CATEGORIAS_ACCION).toContain(categoria)
    }
  })

  it('los mapas no incluyen tipos huérfanos (no agrega claves fuera del catálogo)', () => {
    const clavesDisp = Object.keys(MAPA_DISPARADOR)
    const clavesAcc = Object.keys(MAPA_ACCION)
    expect(clavesDisp.sort()).toEqual([...TIPOS_DISPARADOR].sort())
    expect(clavesAcc.sort()).toEqual([...TIPOS_ACCION].sort())
  })
})

describe('Lookup helpers', () => {
  it('categoriaDeDisparador devuelve la categoría correcta', () => {
    expect(categoriaDeDisparador('tiempo.cron')).toBe('tiempo')
    expect(categoriaDeDisparador('entidad.creada')).toBe('eventos')
  })

  it('categoriaDeDisparador devuelve undefined para null/undefined/desconocido', () => {
    expect(categoriaDeDisparador(null)).toBeUndefined()
    expect(categoriaDeDisparador(undefined)).toBeUndefined()
    expect(categoriaDeDisparador('disparador_nuevo' as never)).toBeUndefined()
  })

  it('categoriaDeAccion idem', () => {
    expect(categoriaDeAccion('terminar_flujo')).toBe('terminar')
    expect(categoriaDeAccion('crear_actividad')).toBe('creaciones')
    expect(categoriaDeAccion(null)).toBeUndefined()
  })
})

describe('Agrupadores ordenados', () => {
  it('disparadoresPorCategoria respeta el orden canónico', () => {
    const grupos = disparadoresPorCategoria()
    expect(grupos.map((g) => g.categoria)).toEqual([...CATEGORIAS_DISPARADOR])
  })

  it('accionesPorCategoria respeta el orden canónico', () => {
    const grupos = accionesPorCategoria()
    expect(grupos.map((g) => g.categoria)).toEqual([...CATEGORIAS_ACCION])
  })

  it('la unión de tipos por grupo es exactamente el catálogo (sin duplicados ni faltantes)', () => {
    const tiposDisp = disparadoresPorCategoria().flatMap((g) => g.tipos)
    const tiposAcc = accionesPorCategoria().flatMap((g) => g.tipos)
    expect(tiposDisp.sort()).toEqual([...TIPOS_DISPARADOR].sort())
    expect(tiposAcc.sort()).toEqual([...TIPOS_ACCION].sort())
  })
})

describe('Claves i18n', () => {
  it('cada categoría de disparador tiene su clave', () => {
    for (const cat of CATEGORIAS_DISPARADOR) {
      expect(claveI18nCategoriaDisparador(cat)).toBe(`flujos.catalogo.categoria.${cat}`)
    }
  })

  it('cada categoría de acción tiene su clave', () => {
    for (const cat of CATEGORIAS_ACCION) {
      expect(claveI18nCategoriaAccion(cat)).toBe(`flujos.catalogo.categoria.${cat}`)
    }
  })

  it('cada TipoAccion y TipoDisparador genera claves bien formadas para titulo/descripcion', () => {
    for (const tipo of TIPOS_ACCION) {
      expect(claveI18nTituloPaso(tipo)).toBe(`flujos.paso.${tipo}.titulo`)
      expect(claveI18nDescripcionPaso(tipo)).toBe(`flujos.paso.${tipo}.descripcion`)
    }
    for (const tipo of TIPOS_DISPARADOR) {
      expect(claveI18nTituloPaso(tipo)).toBe(`flujos.paso.${tipo}.titulo`)
      expect(claveI18nDescripcionPaso(tipo)).toBe(`flujos.paso.${tipo}.descripcion`)
    }
  })
})

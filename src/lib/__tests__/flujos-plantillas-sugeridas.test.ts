/**
 * Tests del catálogo curado de plantillas sugeridas (sub-PR 19.1).
 *
 * Verificamos:
 *   - El filtro por módulos instalados respeta la config de la empresa.
 *   - Plantillas con `modulo_catalogo: null` (módulos base) pasan siempre.
 *   - `plantillasDestacadas` evita duplicados de módulo en la primera
 *     pasada (UX del estado vacío: variedad antes que repetición).
 *   - `plantillaPorId` devuelve null para ids inexistentes.
 *   - Cada plantilla del catálogo tiene un `tipo_disparador` que matchea
 *     el tipo del campo `disparador.tipo` (consistencia interna que evita
 *     que la card muestre un disparador y el editor pre-rellene otro).
 */

import { describe, expect, it } from 'vitest'
import {
  PLANTILLAS_SUGERIDAS,
  plantillasDisponibles,
  plantillasDestacadas,
  plantillaPorId,
} from '@/lib/workflows/plantillas-sugeridas'

describe('plantillasDisponibles', () => {
  it('devuelve plantillas con modulo_catalogo null aunque no se tenga ningún módulo opcional', () => {
    const tieneModulo = () => false
    const disponibles = plantillasDisponibles(tieneModulo)
    // Las que tienen modulo_catalogo === null son las que sobreviven.
    const esperadas = PLANTILLAS_SUGERIDAS.filter((p) => p.modulo_catalogo === null)
    expect(disponibles.map((p) => p.id).sort()).toEqual(esperadas.map((p) => p.id).sort())
  })

  it('filtra plantillas cuyo módulo NO está instalado', () => {
    // Empresa con solo cuotas instalado.
    const tieneModulo = (slug: string) => slug === 'cuotas'
    const disponibles = plantillasDisponibles(tieneModulo)
    // Todas las que pasan deben ser de cuotas o de módulo base (null).
    for (const p of disponibles) {
      expect(p.modulo_catalogo === null || p.modulo_catalogo === 'cuotas').toBe(true)
    }
  })

  it('devuelve TODAS cuando se tienen todos los módulos instalados', () => {
    const tieneModulo = () => true
    const disponibles = plantillasDisponibles(tieneModulo)
    expect(disponibles.length).toBe(PLANTILLAS_SUGERIDAS.length)
  })
})

describe('plantillasDestacadas', () => {
  it('prioriza diversidad de módulos en la primera pasada', () => {
    const tieneModulo = () => true
    const destacadas = plantillasDestacadas(tieneModulo, 3)
    expect(destacadas.length).toBeLessThanOrEqual(3)
    // No debería haber dos plantillas del mismo módulo en las primeras 3
    // mientras existan otros módulos disponibles.
    const modulos = destacadas.map((p) => p.modulo)
    expect(new Set(modulos).size).toBe(modulos.length)
  })

  it('respeta el universo disponible y no inventa plantillas', () => {
    // Sin módulos opcionales instalados: solo pasan las que tienen
    // modulo_catalogo === null (módulos base como actividades). Pedimos 5
    // y verificamos que NO devuelva más de las que existen.
    const tieneModulo = () => false
    const destacadas = plantillasDestacadas(tieneModulo, 5)
    const universo = PLANTILLAS_SUGERIDAS.filter((p) => p.modulo_catalogo === null)
    expect(destacadas.length).toBeLessThanOrEqual(universo.length)
    for (const p of destacadas) {
      expect(p.modulo_catalogo).toBeNull()
    }
  })

  it('devuelve []  cuando no hay módulos compatibles', () => {
    // Tampoco actividades (modulo base, modulo_catalogo === null SIEMPRE
    // pasa) — pero forcemos el caso pidiendo 0:
    const tieneModulo = () => true
    expect(plantillasDestacadas(tieneModulo, 0)).toEqual([])
  })
})

describe('plantillaPorId', () => {
  it('encuentra una plantilla existente', () => {
    const muestra = PLANTILLAS_SUGERIDAS[0]
    expect(plantillaPorId(muestra.id)).toBe(muestra)
  })

  it('devuelve null para id inexistente', () => {
    expect(plantillaPorId('id-no-existe')).toBeNull()
  })
})

describe('integridad del catálogo', () => {
  it('cada plantilla tiene tipo_disparador que matchea disparador.tipo', () => {
    // Si en algún momento una plantilla declara `tipo_disparador: 'cron'`
    // pero su `disparador.tipo` es 'webhook.entrante', el card y el editor
    // mostrarían cosas diferentes. Lo evitamos forzando consistencia.
    for (const p of PLANTILLAS_SUGERIDAS) {
      expect(p.disparador.tipo).toBe(p.tipo_disparador)
    }
  })

  it('cada plantilla tiene fallback_es no vacíos', () => {
    // En 19.1 los strings reales viven en `fallback_es` (decisión D5=C).
    // Si alguna plantilla nueva olvida llenar fallback, pintamos el bug.
    for (const p of PLANTILLAS_SUGERIDAS) {
      expect(p.fallback_es.titulo.length).toBeGreaterThan(0)
      expect(p.fallback_es.descripcion.length).toBeGreaterThan(0)
    }
  })

  it('los ids son únicos', () => {
    const ids = PLANTILLAS_SUGERIDAS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

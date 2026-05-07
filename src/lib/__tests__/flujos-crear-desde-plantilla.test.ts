/**
 * Tests de la función pura `payloadDesdePlantilla` extraída del
 * hook `useCrearFlujo` (sub-PR 19.7). El hook propiamente requiere
 * router + toast + i18n provider; la función pura es contractual y
 * vale la pena testearla aislada para que no se rompa el shape del
 * payload `{ nombre, descripcion, plantillaId }` con el que el
 * editor de 19.2 espera el flujo recién creado.
 */

import { describe, expect, it } from 'vitest'
import { payloadDesdePlantilla } from '@/app/(flux)/flujos/_componentes/useCrearFlujo'
import {
  PLANTILLAS_SUGERIDAS,
  plantillaPorId,
} from '@/lib/workflows/plantillas-sugeridas'

describe('payloadDesdePlantilla', () => {
  it('devuelve nombre + descripcion + plantillaId con los valores de la plantilla', () => {
    const plantilla = plantillaPorId('recordatorio_cuota_3dias')
    expect(plantilla).not.toBeNull()
    if (!plantilla) return

    const payload = payloadDesdePlantilla(plantilla)
    expect(payload.nombre).toBe(plantilla.fallback_es.titulo)
    expect(payload.descripcion).toBe(plantilla.fallback_es.descripcion)
    expect(payload.plantillaId).toBe(plantilla.id)
  })

  it('todas las plantillas del catálogo producen un payload no vacío', () => {
    // Smoke check: si alguna plantilla nueva olvida poblar fallback_es,
    // el payload sale con strings vacíos y este test lo detecta.
    for (const p of PLANTILLAS_SUGERIDAS) {
      const payload = payloadDesdePlantilla(p)
      expect(payload.nombre.length).toBeGreaterThan(0)
      expect(payload.descripcion.length).toBeGreaterThan(0)
      expect(payload.plantillaId).toBe(p.id)
    }
  })

  it('preserva el id exacto: el editor de 19.2 lo lee de la URL para pre-rellenar', () => {
    // El contrato con el editor (19.2): se pasa `?plantilla=<id>`
    // y el editor hace `plantillaPorId(id)` para recuperar el shape
    // completo. Si el id muta, el editor recibe null y no pre-rellena.
    for (const p of PLANTILLAS_SUGERIDAS) {
      const payload = payloadDesdePlantilla(p)
      expect(plantillaPorId(payload.plantillaId)).not.toBeNull()
    }
  })
})

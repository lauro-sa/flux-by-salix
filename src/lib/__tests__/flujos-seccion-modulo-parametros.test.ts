/**
 * Tests del helper puro `construirParametrosListado` que arma los
 * search params del fetch al endpoint `/api/flujos` desde dentro de
 * la sección por módulo (sub-PR 19.7).
 *
 * El endpoint acepta `?modulo=<csv>` y `?tipo_disparador=<csv>` (ver
 * 19.7 commit 1 del endpoint). El helper:
 *   - Convierte arrays no vacíos a CSV.
 *   - Omite la clave si el array es undefined o vacío.
 *   - Aplica defaults de paginación.
 *
 * Si una página de configuración pasa filtros vacíos por error, el
 * test "endpoint no recibe ?modulo= vacío" lo evita.
 */

import { describe, expect, it } from 'vitest'
import { construirParametrosListado } from '@/componentes/entidad/_seccion_flujos_modulo/parametros-listado'

describe('construirParametrosListado', () => {
  it('aplica defaults de paginación cuando no llega ningún filtro', () => {
    const params = construirParametrosListado({})
    expect(params.pagina).toBe(1)
    expect(params.por_pagina).toBe(5)
    expect(params.modulo).toBeUndefined()
    expect(params.tipo_disparador).toBeUndefined()
  })

  it('serializa modulos único como CSV de un valor', () => {
    const params = construirParametrosListado({ modulos: ['actividad'] })
    expect(params.modulo).toBe('actividad')
    expect(params.tipo_disparador).toBeUndefined()
  })

  it('serializa modulos multi como CSV con comas', () => {
    const params = construirParametrosListado({
      modulos: ['presupuesto', 'cuota'],
    })
    expect(params.modulo).toBe('presupuesto,cuota')
  })

  it('serializa tiposDisparador (caso inbox sin entidad_tipo)', () => {
    const params = construirParametrosListado({
      tiposDisparador: ['inbox.correo_recibido', 'inbox.conversacion_sin_respuesta'],
    })
    expect(params.tipo_disparador).toBe(
      'inbox.correo_recibido,inbox.conversacion_sin_respuesta',
    )
    expect(params.modulo).toBeUndefined()
  })

  it('combina ambos filtros si ambos vienen con valores', () => {
    // Caso defensivo: hoy ningún consumidor pasa los dos a la vez,
    // pero el helper no debe descartar ninguno (el endpoint los aplica
    // como AND, comportamiento esperado si surge el caso).
    const params = construirParametrosListado({
      modulos: ['presupuesto'],
      tiposDisparador: ['entidad.estado_cambio'],
    })
    expect(params.modulo).toBe('presupuesto')
    expect(params.tipo_disparador).toBe('entidad.estado_cambio')
  })

  it('ignora arrays vacíos: no manda ?modulo= ni ?tipo_disparador= vacío', () => {
    // Este caso es importante porque el endpoint del PR 18.1 rechaza
    // strings vacías para ciertos filtros y nos evita un 400 silencioso.
    const params = construirParametrosListado({
      modulos: [],
      tiposDisparador: [],
    })
    expect(params.modulo).toBeUndefined()
    expect(params.tipo_disparador).toBeUndefined()
  })

  it('respeta porPagina custom si el caller lo pasa', () => {
    const params = construirParametrosListado({ porPagina: 10 })
    expect(params.por_pagina).toBe(10)
  })
})

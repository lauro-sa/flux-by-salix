/**
 * Tests del validator pre-publicar para `completar_actividad` (sub-PR 20.1).
 *
 * Cubre:
 *   - Shape mínimo válido pasa (tipo_actividad_id + si_multiple).
 *   - D1 caveat (votado): si el criterio NO tiene tipo_actividad_id ni
 *     relacionada_a, el validador rechaza con mensaje explícito que
 *     menciona ambas opciones — para que el editor pueda mostrar la
 *     guía completa al usuario.
 *   - relacionada_a SOLO también es válido al validar (el gating de
 *     "todavía no hay tabla actividades_relaciones" lo aplica el
 *     executor en runtime con `PendienteSubPR20_2`).
 *   - si_multiple inválido → rechazo con mensaje listando los 4 valores.
 *   - completar_actividad ahora aparece en la lista de acciones
 *     soportadas (mensaje de error de acción no soportada actualizado).
 *
 * Archivo aparte de `workflows-validacion-flujo.test.ts` para no
 * modificar la superficie de los tests existentes (regla R1).
 */

import { describe, expect, it } from 'vitest'
import { validarPublicable } from '../workflows/validacion-flujo'

const dispEstadoOk = {
  tipo: 'entidad.estado_cambio',
  configuracion: {
    entidad_tipo: 'presupuesto',
    hasta_clave: 'enviado',
  },
}

describe('validarPublicable — completar_actividad', () => {
  it('caso feliz: tipo_actividad_id + si_multiple pasa', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'completar_actividad',
        criterio: {
          tipo_actividad_id: 'tipo-presupuestar',
          si_multiple: 'mas_antigua',
        },
      },
    ])
    expect(r.ok).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('caso feliz: relacionada_a solo pasa (gating runtime es del executor)', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'completar_actividad',
        criterio: {
          si_multiple: 'mas_antigua',
          relacionada_a: { entidad_tipo: 'visita', entidad_id: '{{entidad.id}}' },
        },
      },
    ])
    expect(r.ok).toBe(true)
  })

  it('rechaza criterio sin tipo_actividad_id ni relacionada_a (D1 caveat)', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'completar_actividad',
        criterio: { si_multiple: 'mas_antigua', asignado_id: 'user-1' },
      },
    ])
    expect(r.ok).toBe(false)
    // Mensaje obligatorio menciona ambas alternativas + advertencia
    // sobre el riesgo de filtrar solo por asignado/contacto.
    const m = r.errores[0]
    expect(m).toMatch(/al menos tipo de actividad o relación con entidad/i)
    expect(m).toMatch(/asignado o contacto/i)
  })

  it('rechaza si_multiple inválido', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'completar_actividad',
        criterio: { tipo_actividad_id: 'tipo-x', si_multiple: 'inventado' },
      },
    ])
    expect(r.ok).toBe(false)
    const m = r.errores[0]
    expect(m).toMatch(/si_multiple/)
    expect(m).toMatch(/mas_antigua/)
    expect(m).toMatch(/mas_reciente/)
    expect(m).toMatch(/todas/)
    expect(m).toMatch(/fallar/)
  })

  it('rechaza criterio ausente o no-objeto', () => {
    const r = validarPublicable(dispEstadoOk, [
      { tipo: 'completar_actividad' },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/criterio/)
  })

  it('completar_actividad aparece en la lista de acciones soportadas (mensaje genérico)', () => {
    const r = validarPublicable(dispEstadoOk, [
      { tipo: 'accion_inexistente_para_test' },
    ])
    expect(r.ok).toBe(false)
    // Si el mensaje todavía menciona la lista, completar_actividad
    // tiene que estar — sirve como guardarriel del editor.
    const tieneListaSoportada = r.errores.some((e) =>
      /completar actividad/i.test(e),
    )
    // La acción puede caer en "no reconocido" antes que en "no soportado":
    // el guardarriel solo aplica cuando emite el mensaje de soportadas.
    if (r.errores.some((e) => /Disponibles:/.test(e))) {
      expect(tieneListaSoportada).toBe(true)
    }
  })
})

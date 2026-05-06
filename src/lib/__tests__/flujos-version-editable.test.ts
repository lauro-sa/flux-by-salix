/**
 * Tests del helper `obtenerVersionEditable`.
 *
 * Centraliza el modelo "borrador interno" (§5.3 del PLAN_UI_FLUJOS.md):
 * la UI tiene que pintar la versión publicada o el borrador según
 * estado y presencia de `borrador_jsonb`. Si este helper rompe, todo
 * el editor pinta datos incorrectos — por eso tests rigurosos.
 */

import { describe, expect, it } from 'vitest'
import { obtenerVersionEditable } from '@/lib/workflows/version-editable'

const disparadorPublicado = {
  tipo: 'entidad.estado_cambio',
  configuracion: { entidad_tipo: 'cuota', hasta_clave: 'pagada' },
}
const accionesPublicadas = [{ tipo: 'enviar_whatsapp_plantilla' }]

const baseFlujo = {
  disparador: disparadorPublicado,
  condiciones: { operador: 'y', condiciones: [] },
  acciones: accionesPublicadas,
  nodos_json: null,
  borrador_jsonb: null,
}

describe('obtenerVersionEditable', () => {
  it('flujo en borrador: pinta top-level y marca esBorradorInterno=false', () => {
    const v = obtenerVersionEditable({ ...baseFlujo, estado: 'borrador' })
    expect(v.disparador).toBe(disparadorPublicado)
    expect(v.acciones).toBe(accionesPublicadas)
    expect(v.esBorradorInterno).toBe(false)
  })

  it('flujo activo sin borrador_jsonb: pinta top-level publicado', () => {
    const v = obtenerVersionEditable({ ...baseFlujo, estado: 'activo' })
    expect(v.disparador).toBe(disparadorPublicado)
    expect(v.acciones).toBe(accionesPublicadas)
    expect(v.esBorradorInterno).toBe(false)
  })

  it('flujo activo con borrador_jsonb completo: pinta el borrador y marca esBorradorInterno', () => {
    const disparadorBorrador = {
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'cuota', hasta_clave: 'cancelada' },
    }
    const accionesBorrador = [
      { tipo: 'enviar_whatsapp_plantilla' },
      { tipo: 'crear_actividad' },
    ]
    const v = obtenerVersionEditable({
      ...baseFlujo,
      estado: 'activo',
      borrador_jsonb: {
        disparador: disparadorBorrador,
        condiciones: { operador: 'y', condiciones: [] },
        acciones: accionesBorrador,
        nodos_json: null,
      },
    })
    expect(v.disparador).toBe(disparadorBorrador)
    expect(v.acciones).toBe(accionesBorrador)
    expect(v.esBorradorInterno).toBe(true)
  })

  it('flujo pausado con borrador_jsonb: misma semántica que activo+borrador', () => {
    const accionesBorrador = [{ tipo: 'terminar_flujo' }]
    const v = obtenerVersionEditable({
      ...baseFlujo,
      estado: 'pausado',
      borrador_jsonb: { acciones: accionesBorrador },
    })
    // Borrador parcial solo trae `acciones` — disparador y condiciones
    // caen al publicado vía merge shallow.
    expect(v.disparador).toBe(disparadorPublicado)
    expect(v.acciones).toBe(accionesBorrador)
    expect(v.esBorradorInterno).toBe(true)
  })

  it('borrador_jsonb con shape inválido (array): cae al publicado sin marcar borrador', () => {
    // Defensa contra datos rotos por ediciones manuales en BD.
    const v = obtenerVersionEditable({
      ...baseFlujo,
      estado: 'activo',
      borrador_jsonb: ['esto', 'no', 'es', 'un', 'objeto'] as unknown,
    })
    expect(v.disparador).toBe(disparadorPublicado)
    expect(v.esBorradorInterno).toBe(false)
  })

  it('borrador_jsonb parcial: campos ausentes caen al publicado, presentes pisan', () => {
    const v = obtenerVersionEditable({
      ...baseFlujo,
      estado: 'activo',
      borrador_jsonb: { disparador: null }, // explicitamente null pisa publicado
    })
    expect(v.disparador).toBe(null)
    expect(v.acciones).toBe(accionesPublicadas)
    expect(v.esBorradorInterno).toBe(true)
  })
})

/**
 * Tests de los factories `crearDisparadorVacio` y `crearAccionVacia`.
 *
 * Garantía clave: cualquier `TipoDisparador` o `TipoAccion` nuevo del
 * catálogo de `tipos/workflow.ts` debe tener factory acá. Sin esto el
 * editor visual del 19.2 va a tirar TypeError al elegir un tipo
 * agregado al backend pero olvidado en la UI.
 *
 * Cumple el patrón "claves alcanzables" replicado de 19.1.
 */

import { describe, expect, it } from 'vitest'
import {
  crearDisparadorVacio,
  crearAccionVacia,
} from '@/lib/workflows/acciones-vacias'
import {
  TIPOS_DISPARADOR,
  TIPOS_ACCION,
} from '@/tipos/workflow'

describe('crearDisparadorVacio', () => {
  it('cada TipoDisparador del catálogo produce un objeto con tipo correcto y configuracion presente', () => {
    for (const tipo of TIPOS_DISPARADOR) {
      const d = crearDisparadorVacio(tipo)
      expect(d.tipo, `tipo del disparador devuelto no coincide para ${tipo}`).toBe(tipo)
      expect(d, `falta configuracion para ${tipo}`).toHaveProperty('configuracion')
    }
  })

  it('los strings requeridos vacíos están explícitamente vacíos (no undefined)', () => {
    // El editor sub-PR 19.2 distingue "no se completó" (string vacío)
    // de "no aplica" (undefined). Lo segundo confunde la validación.
    const d1 = crearDisparadorVacio('entidad.estado_cambio')
    if (d1.tipo === 'entidad.estado_cambio') {
      expect(d1.configuracion.hasta_clave).toBe('')
    }
    const d2 = crearDisparadorVacio('webhook.entrante')
    if (d2.tipo === 'webhook.entrante') {
      expect(d2.configuracion.slug).toBe('')
    }
  })

  it('tiempo.cron arranca con expresión válida sintácticamente (no string vacío)', () => {
    // Razón: la expresión cron rota tira error en validarPublicable
    // antes de llegar al panel. Damos default operativo "9 AM diario".
    const d = crearDisparadorVacio('tiempo.cron')
    if (d.tipo === 'tiempo.cron') {
      expect(d.configuracion.expresion).toMatch(/^[\d\*\/\-, ]+$/)
    }
  })

  it('tiempo.relativo_a_campo arranca con hora_local definida', () => {
    const d = crearDisparadorVacio('tiempo.relativo_a_campo')
    if (d.tipo === 'tiempo.relativo_a_campo') {
      expect(d.configuracion.hora_local).toBe('09:00')
      expect(d.configuracion.delta_dias).toBe(0)
    }
  })
})

describe('crearAccionVacia', () => {
  it('cada TipoAccion del catálogo produce un objeto con tipo correcto', () => {
    for (const tipo of TIPOS_ACCION) {
      const a = crearAccionVacia(tipo)
      expect(a.tipo, `tipo de la acción devuelto no coincide para ${tipo}`).toBe(tipo)
    }
  })

  it('strings requeridos en acciones con shape específico están vacíos (no undefined)', () => {
    const a = crearAccionVacia('enviar_whatsapp_plantilla')
    if (a.tipo === 'enviar_whatsapp_plantilla') {
      expect(a.canal_id).toBe('')
      expect(a.telefono).toBe('')
      expect(a.plantilla_nombre).toBe('')
      expect(a.idioma).toBe('es')
    }
  })

  it('condicion_branch arranca con acciones_si y acciones_no como arrays vacíos', () => {
    // Crítico para el canvas: si arrancan como undefined, el render del
    // sub-flujo y el dnd-kit del SortableContext anidado revientan al
    // intentar mapear sobre undefined.
    const a = crearAccionVacia('condicion_branch')
    if (a.tipo === 'condicion_branch') {
      expect(Array.isArray(a.acciones_si)).toBe(true)
      expect(Array.isArray(a.acciones_no)).toBe(true)
      expect(a.acciones_si.length).toBe(0)
      expect(a.acciones_no.length).toBe(0)
      expect(a.condicion).toBeDefined()
    }
  })

  it('esperar arranca con duracion_ms razonable (no 0 ni undefined)', () => {
    const a = crearAccionVacia('esperar')
    if (a.tipo === 'esperar') {
      expect(a.duracion_ms).toBeGreaterThan(0)
    }
  })

  it('terminar_flujo no exige campos extra', () => {
    const a = crearAccionVacia('terminar_flujo')
    expect(a.tipo).toBe('terminar_flujo')
  })

  it('acciones genéricas devuelven shape { tipo, parametros: {} }', () => {
    const tiposGenericos = [
      'enviar_whatsapp_texto',
      'enviar_correo_plantilla',
      'enviar_correo_texto',
      'asignar_usuario',
      'agregar_etiqueta',
      'quitar_etiqueta',
      'notificar_grupo',
      'crear_orden_trabajo',
      'crear_visita',
      'webhook_saliente',
      'esperar_evento',
    ] as const
    for (const tipo of tiposGenericos) {
      const a = crearAccionVacia(tipo)
      expect(a.tipo).toBe(tipo)
      expect(a).toHaveProperty('parametros')
    }
  })
})

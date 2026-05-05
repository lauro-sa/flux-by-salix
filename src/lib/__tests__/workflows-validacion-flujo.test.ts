/**
 * Tests unit de validarPublicable (PR 18.1).
 *
 * Cubre:
 *   - Disparadores válidos / inválidos / no soportados por el motor.
 *   - Acciones válidas / inválidas / no soportadas.
 *   - Mensajes de error legibles para mostrar en la UI.
 *   - Recursión a través de condicion_branch (acciones_si / acciones_no).
 *   - Lista vacía de acciones (un flujo sin pasos no es publicable).
 */

import { describe, expect, it } from 'vitest'
import { validarPublicable } from '../workflows/validacion-flujo'

const accionWhatsappOk = {
  tipo: 'enviar_whatsapp_plantilla',
  canal_id: 'canal-1',
  telefono: '5491134567890',
  plantilla_nombre: 'recordatorio_3d',
  idioma: 'es_AR',
}

const dispEstadoOk = {
  tipo: 'entidad.estado_cambio',
  configuracion: {
    entidad_tipo: 'presupuesto',
    hasta_clave: 'aceptado',
  },
}

const dispCronOk = {
  tipo: 'tiempo.cron',
  configuracion: { expresion: '0 9 * * 1-5' },
}

const dispRelativoOk = {
  tipo: 'tiempo.relativo_a_campo',
  configuracion: {
    entidad_tipo: 'cuota',
    campo_fecha: 'fecha_vencimiento',
    delta_dias: -3,
  },
}

describe('validarPublicable — disparador', () => {
  it('acepta el caso feliz con cambio de estado + acción WhatsApp', () => {
    const r = validarPublicable(dispEstadoOk, [accionWhatsappOk])
    expect(r.ok).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('acepta tiempo.cron y tiempo.relativo_a_campo válidos', () => {
    const a = validarPublicable(dispCronOk, [accionWhatsappOk])
    const b = validarPublicable(dispRelativoOk, [accionWhatsappOk])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
  })

  it('rechaza disparador vacío con mensaje claro', () => {
    const r = validarPublicable({}, [accionWhatsappOk])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/no tiene un tipo válido/i)
  })

  it('rechaza tipo de disparador desconocido', () => {
    const r = validarPublicable({ tipo: 'inventado.algo' }, [accionWhatsappOk])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/no existe en el catálogo/i)
  })

  it('rechaza disparadores reservados pero todavía no soportados por el motor', () => {
    const r = validarPublicable(
      { tipo: 'webhook.entrante', configuracion: { slug: 'x' } },
      [accionWhatsappOk],
    )
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/todavía no lo ejecuta el motor/i)
  })

  it('rechaza shape incompleto de entidad.estado_cambio (sin hasta_clave)', () => {
    const r = validarPublicable(
      { tipo: 'entidad.estado_cambio', configuracion: { entidad_tipo: 'presupuesto' } },
      [accionWhatsappOk],
    )
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/cambio de estado/i)
  })

  it('rechaza tiempo.cron sin expresión', () => {
    const r = validarPublicable(
      { tipo: 'tiempo.cron', configuracion: {} },
      [accionWhatsappOk],
    )
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/expresión/i)
  })
})

describe('validarPublicable — acciones', () => {
  it('rechaza lista de acciones vacía', () => {
    const r = validarPublicable(dispEstadoOk, [])
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => /al menos una acción/.test(e))).toBe(true)
  })

  it('rechaza acciones que no son lista', () => {
    const r = validarPublicable(dispEstadoOk, { tipo: 'enviar_whatsapp_plantilla' })
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => /debe ser una lista/.test(e))).toBe(true)
  })

  it('rechaza acción con tipo desconocido', () => {
    const r = validarPublicable(dispEstadoOk, [{ tipo: 'meterse_en_problemas' }])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/no reconocido/)
  })

  it('rechaza acción reservada pero no soportada (enviar_correo_plantilla)', () => {
    const r = validarPublicable(
      dispEstadoOk,
      [{ tipo: 'enviar_correo_plantilla', parametros: {} }],
    )
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/todavía no la ejecuta el motor/)
  })

  it('rechaza shape incompleto de WhatsApp (sin telefono)', () => {
    const r = validarPublicable(dispEstadoOk, [
      { ...accionWhatsappOk, telefono: '' },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/canal, teléfono, plantilla e idioma/)
  })

  it('rechaza esperar con duracion_ms y hasta_fecha simultáneos', () => {
    const r = validarPublicable(dispEstadoOk, [
      { tipo: 'esperar', duracion_ms: 1000, hasta_fecha: '2030-01-01' },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/duración|fecha absoluta/)
  })

  it('acepta esperar con solo duracion_ms', () => {
    const r = validarPublicable(dispEstadoOk, [
      { tipo: 'esperar', duracion_ms: 60000 },
      accionWhatsappOk,
    ])
    expect(r.ok).toBe(true)
  })

  it('acepta terminar_flujo sin motivo', () => {
    const r = validarPublicable(dispEstadoOk, [{ tipo: 'terminar_flujo' }])
    expect(r.ok).toBe(true)
  })
})

describe('validarPublicable — condicion_branch', () => {
  const condicionHoja = {
    campo: 'entidad.estado_nuevo',
    operador: 'igual',
    valor: 'aceptado',
  }

  it('acepta branch con dos sub-listas válidas', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'condicion_branch',
        condicion: condicionHoja,
        acciones_si: [accionWhatsappOk],
        acciones_no: [{ tipo: 'terminar_flujo' }],
      },
    ])
    expect(r.ok).toBe(true)
  })

  it('rechaza branch con acciones_si vacío', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'condicion_branch',
        condicion: condicionHoja,
        acciones_si: [],
        acciones_no: [{ tipo: 'terminar_flujo' }],
      },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => /acciones_si.*al menos una/.test(e))).toBe(true)
  })

  it('rechaza branch con acción inválida en sub-lista anidada', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'condicion_branch',
        condicion: condicionHoja,
        acciones_si: [accionWhatsappOk],
        acciones_no: [
          { tipo: 'enviar_whatsapp_plantilla', canal_id: 'x', telefono: '', plantilla_nombre: 'p', idioma: 'es' },
        ],
      },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => /acciones_no\[0\]/.test(e))).toBe(true)
  })

  it('rechaza branch con condicion mal armada', () => {
    const r = validarPublicable(dispEstadoOk, [
      {
        tipo: 'condicion_branch',
        condicion: { algo: 'roto' },
        acciones_si: [accionWhatsappOk],
        acciones_no: [accionWhatsappOk],
      },
    ])
    expect(r.ok).toBe(false)
    expect(r.errores[0]).toMatch(/condición/)
  })
})

describe('validarPublicable — múltiples errores', () => {
  it('reporta errores en disparador y acciones a la vez', () => {
    const r = validarPublicable({}, [{ tipo: 'meterse_en_problemas' }])
    expect(r.ok).toBe(false)
    // Al menos uno por cada lado.
    expect(r.errores.length).toBeGreaterThanOrEqual(2)
  })
})

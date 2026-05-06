/**
 * Tests del catálogo de variables disponibles del editor (sub-PR 19.3b).
 *
 * Caveat del coordinador: un caso por cada `TipoDisparador` validando
 * el shape del árbol — especialmente disparadores de tiempo
 * (cron, relativo_a_campo) que NO tienen `entidad` en el contexto del
 * runtime, solo empresa + actor + ahora.
 */

import { describe, expect, it } from 'vitest'
import {
  variablesDisponibles,
  type FuenteVariables,
} from '@/lib/workflows/variables-disponibles'
import { TIPOS_DISPARADOR, type TipoDisparador } from '@/tipos/workflow'

function clavesFuentes(fuentes: FuenteVariables[]): string[] {
  return fuentes.map((f) => f.clave)
}

describe('variablesDisponibles · cobertura por tipo de disparador', () => {
  it('cobre todos los TIPOS_DISPARADOR sin lanzar', () => {
    for (const tipo of TIPOS_DISPARADOR) {
      const r = variablesDisponibles({ tipo })
      expect(Array.isArray(r.fuentes)).toBe(true)
      // Garantía mínima: empresa + sistema siempre disponibles.
      expect(clavesFuentes(r.fuentes)).toContain('empresa')
      expect(clavesFuentes(r.fuentes)).toContain('sistema')
    }
  })

  it('disparador null → solo empresa + sistema', () => {
    const r = variablesDisponibles(null)
    expect(clavesFuentes(r.fuentes)).toEqual(['empresa', 'sistema'])
  })
})

describe('variablesDisponibles · entidad.estado_cambio', () => {
  it('expone Entidad + Contacto + Actor + Empresa + Sistema + Cambio (presupuesto)', () => {
    const r = variablesDisponibles({
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'presupuesto', hasta_clave: 'aceptado' },
    })
    expect(clavesFuentes(r.fuentes)).toEqual([
      'entidad', 'contacto', 'actor', 'empresa', 'sistema', 'cambio',
    ])
    // Verificar que la fuente "entidad" trae campos específicos de presupuesto.
    const entidad = r.fuentes.find((f) => f.clave === 'entidad')!
    const rutas = entidad.variables.map((v) => v.ruta)
    expect(rutas).toContain('entidad.numero')
    expect(rutas).toContain('entidad.total')
  })

  it('cuota: NO expone Contacto (no es entidad con contacto directo)', () => {
    const r = variablesDisponibles({
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'cuota', hasta_clave: 'pagada' },
    })
    expect(clavesFuentes(r.fuentes)).not.toContain('contacto')
    expect(clavesFuentes(r.fuentes)).toContain('entidad')
  })
})

describe('variablesDisponibles · entidad.creada', () => {
  it('expone Entidad + Contacto + Empresa + Sistema (sin Cambio, sin Actor)', () => {
    const r = variablesDisponibles({
      tipo: 'entidad.creada',
      configuracion: { entidad_tipo: 'visita' },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['entidad', 'contacto', 'empresa', 'sistema'])
  })
})

describe('variablesDisponibles · entidad.campo_cambia', () => {
  it('expone Entidad + Actor + Empresa + Sistema + Cambio (orden no tiene contacto en este caso)', () => {
    // orden SÍ tiene contacto directo según el catálogo.
    const r = variablesDisponibles({
      tipo: 'entidad.campo_cambia',
      configuracion: { entidad_tipo: 'orden', campo: 'titulo' },
    })
    expect(clavesFuentes(r.fuentes)).toEqual([
      'entidad', 'contacto', 'actor', 'empresa', 'sistema', 'cambio',
    ])
  })
})

describe('variablesDisponibles · actividad.completada', () => {
  it('asume `entidad: actividad` aunque no venga en configuración', () => {
    const r = variablesDisponibles({
      tipo: 'actividad.completada',
      configuracion: {},
    })
    // actividad NO tiene contacto directo según ENTIDADES_CON_CONTACTO_DIRECTO.
    expect(clavesFuentes(r.fuentes)).toContain('entidad')
    expect(clavesFuentes(r.fuentes)).not.toContain('contacto')
    expect(clavesFuentes(r.fuentes)).toContain('actor')
  })
})

describe('variablesDisponibles · tiempo.cron', () => {
  it('SOLO expone Empresa + Sistema (sin entidad, contacto, actor, ni cambio)', () => {
    const r = variablesDisponibles({
      tipo: 'tiempo.cron',
      configuracion: { expresion: '0 9 * * 1-5' },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['empresa', 'sistema'])
  })
})

describe('variablesDisponibles · tiempo.relativo_a_campo', () => {
  it('expone Entidad + Contacto + Empresa + Sistema (sin Cambio, sin Actor)', () => {
    const r = variablesDisponibles({
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'presupuesto',
        campo_fecha: 'fecha_validez',
        delta_dias: -3,
      },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['entidad', 'contacto', 'empresa', 'sistema'])
  })

  it('para cuota (sin contacto directo) expone Entidad + Empresa + Sistema', () => {
    const r = variablesDisponibles({
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'cuota',
        campo_fecha: 'fecha_vencimiento',
        delta_dias: -3,
      },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['entidad', 'empresa', 'sistema'])
  })
})

describe('variablesDisponibles · webhook.entrante', () => {
  it('SOLO expone Empresa + Sistema (sin Cambio porque no es evento típico)', () => {
    const r = variablesDisponibles({
      tipo: 'webhook.entrante',
      configuracion: { slug: 'mi-webhook' },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['empresa', 'sistema'])
  })
})

describe('variablesDisponibles · inbox.mensaje_recibido', () => {
  it('expone Empresa + Sistema + Cambio (sin entidad ni contacto fijos)', () => {
    const r = variablesDisponibles({
      tipo: 'inbox.mensaje_recibido',
      configuracion: {},
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['empresa', 'sistema', 'cambio'])
  })
})

describe('variablesDisponibles · inbox.conversacion_sin_respuesta', () => {
  it('expone Empresa + Sistema + Cambio', () => {
    const r = variablesDisponibles({
      tipo: 'inbox.conversacion_sin_respuesta',
      configuracion: { minutos_sin_respuesta: 60 },
    })
    expect(clavesFuentes(r.fuentes)).toEqual(['empresa', 'sistema', 'cambio'])
  })
})

describe('variablesDisponibles · campos por entidad', () => {
  // Cada `EntidadConEstado` que aparece en el catálogo tiene que devolver
  // al menos un campo no-genérico en su lista de variables. Si una
  // entidad nueva se agrega al type pero no acá, este test falla y
  // pinta el síntoma — coherente con el patrón "si el catálogo no cubre
  // la entidad, devolvemos los genéricos".
  const cubiertas: Array<{ entidad: string; ruta: string }> = [
    { entidad: 'presupuesto', ruta: 'entidad.numero' },
    { entidad: 'cuota', ruta: 'entidad.fecha_vencimiento' },
    { entidad: 'orden', ruta: 'entidad.numero' },
    { entidad: 'visita', ruta: 'entidad.fecha_programada' },
    { entidad: 'actividad', ruta: 'entidad.titulo' },
    { entidad: 'conversacion', ruta: 'entidad.canal' },
  ]

  for (const c of cubiertas) {
    it(`entidad=${c.entidad} expone "${c.ruta}"`, () => {
      const r = variablesDisponibles({
        tipo: 'entidad.creada' as TipoDisparador,
        configuracion: { entidad_tipo: c.entidad },
      })
      const ent = r.fuentes.find((f) => f.clave === 'entidad')
      expect(ent).toBeDefined()
      const rutas = ent!.variables.map((v) => v.ruta)
      expect(rutas).toContain(c.ruta)
    })
  }
})

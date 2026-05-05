import { describe, expect, it } from 'vitest'
import { matchearFlujos } from '../workflows/dispatcher'
import type { Flujo } from '@/tipos/workflow'
import type { CambioEstado } from '@/tipos/estados'

/**
 * Tests unit del dispatcher de workflows (PR 14).
 *
 * Cubre los 3 casos críticos pedidos por la review del PR:
 *   1. Match correcto por entidad_tipo + hasta_clave.
 *   2. Descarta flujos con activo=false.
 *   3. Descarta flujos de empresa distinta a la del evento.
 *
 * Tests adicionales sobre desde_clave (opcional) y disparadores de
 * otro tipo (que el PR 14 todavía no procesa).
 */

// Helper para fabricar eventos sin repetir 100 campos de CambioEstado.
function evento(parcial: Partial<CambioEstado>): CambioEstado {
  return {
    id: 'cambio-1',
    empresa_id: 'empresa-A',
    entidad_tipo: 'presupuesto',
    entidad_id: 'pres-1',
    estado_anterior: 'borrador',
    estado_nuevo: 'enviado',
    grupo_anterior: 'inicial',
    grupo_nuevo: 'activo',
    origen: 'manual',
    usuario_id: null,
    usuario_nombre: null,
    motivo: null,
    metadatos: {},
    contexto: {},
    creado_en: '2026-05-03T12:00:00Z',
    ...parcial,
  }
}

// Helper para fabricar flujos.
function flujo(parcial: Partial<Flujo> & { id: string }): Flujo {
  return {
    empresa_id: 'empresa-A',
    nombre: 'Test',
    descripcion: null,
    estado: 'activo',
    activo: true,
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: {
        entidad_tipo: 'presupuesto',
        hasta_clave: 'enviado',
      },
    },
    condiciones: [],
    acciones: [],
    nodos_json: {},
    borrador_jsonb: null,
    ultima_ejecucion_tiempo: null,
    creado_por: null,
    creado_por_nombre: null,
    editado_por: null,
    editado_por_nombre: null,
    creado_en: '2026-05-03T10:00:00Z',
    actualizado_en: '2026-05-03T10:00:00Z',
    ...parcial,
  }
}

describe('matchearFlujos', () => {
  it('matchea por entidad_tipo + hasta_clave', () => {
    const flujos: Flujo[] = [
      flujo({ id: 'f-1' }),                                                  // match
      flujo({ id: 'f-2', disparador: { tipo: 'entidad.estado_cambio', configuracion: { entidad_tipo: 'orden', hasta_clave: 'enviado' } } }), // entidad distinta
      flujo({ id: 'f-3', disparador: { tipo: 'entidad.estado_cambio', configuracion: { entidad_tipo: 'presupuesto', hasta_clave: 'aceptado' } } }), // hasta_clave distinto
    ]

    const matches = matchearFlujos(evento({}), flujos)

    expect(matches.map((f) => f.id)).toEqual(['f-1'])
  })

  it('descarta flujos con activo=false', () => {
    const flujos: Flujo[] = [
      flujo({ id: 'f-activo', activo: true }),
      flujo({ id: 'f-inactivo', activo: false }),
    ]

    const matches = matchearFlujos(evento({}), flujos)

    expect(matches.map((f) => f.id)).toEqual(['f-activo'])
  })

  it('descarta flujos de otra empresa', () => {
    const flujos: Flujo[] = [
      flujo({ id: 'f-A', empresa_id: 'empresa-A' }),
      flujo({ id: 'f-B', empresa_id: 'empresa-B' }),
    ]

    const matches = matchearFlujos(evento({ empresa_id: 'empresa-A' }), flujos)

    expect(matches.map((f) => f.id)).toEqual(['f-A'])
  })

  it('respeta desde_clave si está seteado', () => {
    const flujos: Flujo[] = [
      // Solo dispara si viene de borrador.
      flujo({
        id: 'f-desde-borrador',
        disparador: {
          tipo: 'entidad.estado_cambio',
          configuracion: {
            entidad_tipo: 'presupuesto',
            hasta_clave: 'enviado',
            desde_clave: 'borrador',
          },
        },
      }),
      // Solo dispara si viene de revisión.
      flujo({
        id: 'f-desde-revision',
        disparador: {
          tipo: 'entidad.estado_cambio',
          configuracion: {
            entidad_tipo: 'presupuesto',
            hasta_clave: 'enviado',
            desde_clave: 'en_revision',
          },
        },
      }),
      // desde_clave undefined → dispara desde cualquier estado.
      flujo({ id: 'f-cualquiera' }),
    ]

    const matches = matchearFlujos(
      evento({ estado_anterior: 'borrador', estado_nuevo: 'enviado' }),
      flujos,
    )

    expect(matches.map((f) => f.id).sort()).toEqual(['f-cualquiera', 'f-desde-borrador'])
  })

  it('ignora disparadores de tipo distinto a entidad.estado_cambio', () => {
    const flujos: Flujo[] = [
      flujo({
        id: 'f-cron',
        disparador: { tipo: 'tiempo.cron', configuracion: { expresion: '0 9 * * *' } },
      }),
      flujo({
        id: 'f-creada',
        disparador: { tipo: 'entidad.creada', configuracion: { entidad_tipo: 'presupuesto' } },
      }),
      flujo({ id: 'f-match' }), // único válido
    ]

    const matches = matchearFlujos(evento({}), flujos)

    expect(matches.map((f) => f.id)).toEqual(['f-match'])
  })

  it('descarta disparadores con jsonb roto (sin tipo o sin configuración)', () => {
    const flujos: Flujo[] = [
      // Disparador sin tipo: jsonb corrupto / migrado de versión vieja.
      flujo({ id: 'f-roto-1', disparador: { configuracion: {} } }),
      // Disparador sin configuracion.
      flujo({ id: 'f-roto-2', disparador: { tipo: 'entidad.estado_cambio' } }),
      // null directo.
      flujo({ id: 'f-roto-3', disparador: null }),
      flujo({ id: 'f-ok' }),
    ]

    const matches = matchearFlujos(evento({}), flujos)

    expect(matches.map((f) => f.id)).toEqual(['f-ok'])
  })
})

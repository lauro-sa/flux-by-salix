/**
 * Tests del decisor puro `decidirEntidadAPrevisar` (sub-PR 19.3b).
 *
 * Cada caso valida qué tabla y filtros aplica el preview-contexto
 * según el `tipo` del disparador. La parte async (consulta a Supabase
 * + enriquecer) se testea vía el endpoint en runtime — no la mockeamos
 * acá porque la lógica relevante es la decisión, no el wiring.
 */

import { describe, expect, it } from 'vitest'
import { decidirEntidadAPrevisar } from '@/lib/workflows/preview-contexto'
import { TIPOS_DISPARADOR, type TipoDisparador } from '@/tipos/workflow'

describe('decidirEntidadAPrevisar · cobertura por tipo de disparador', () => {
  it('cobre todos los TIPOS_DISPARADOR sin lanzar', () => {
    for (const tipo of TIPOS_DISPARADOR) {
      // Configuración mínima razonable por tipo para evitar nulls.
      const cfg = (
        tipo === 'entidad.estado_cambio' ||
        tipo === 'entidad.creada' ||
        tipo === 'entidad.campo_cambia'
      )
        ? { entidad_tipo: 'presupuesto' }
        : tipo === 'tiempo.relativo_a_campo'
          ? { entidad_tipo: 'cuota', campo_fecha: 'fecha_vencimiento', delta_dias: -3 }
          : tipo === 'tiempo.cron'
            ? { expresion: '0 9 * * *' }
            : tipo === 'webhook.entrante'
              ? { slug: 'x' }
              : tipo === 'inbox.conversacion_sin_respuesta'
                ? { minutos_sin_respuesta: 60 }
                : {}
      // No throws.
      decidirEntidadAPrevisar({ tipo, configuracion: cfg })
    }
  })

  it('disparador null → null', () => {
    expect(decidirEntidadAPrevisar(null)).toBeNull()
  })
})

describe('decidirEntidadAPrevisar · casos específicos', () => {
  it('entidad.estado_cambio + presupuesto + hasta_clave → tabla presupuestos con filtro', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'presupuesto', hasta_clave: 'aceptado' },
    })
    expect(r).toEqual({
      tipoEntidad: 'presupuesto',
      tabla: 'presupuestos',
      filtros: { estadoClave: 'aceptado' },
      ordenarPor: 'actualizado_en',
    })
  })

  it('entidad.estado_cambio sin hasta_clave → sin filtro de estado', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'cuota' },
    })
    expect(r?.filtros).toBeNull()
    expect(r?.tabla).toBe('presupuesto_cuotas')
  })

  it('entidad.creada + visita → ordena por creado_en', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'entidad.creada',
      configuracion: { entidad_tipo: 'visita' },
    })
    expect(r).toEqual({
      tipoEntidad: 'visita',
      tabla: 'visitas',
      filtros: null,
      ordenarPor: 'creado_en',
    })
  })

  it('entidad.campo_cambia → ordena por actualizado_en', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'entidad.campo_cambia',
      configuracion: { entidad_tipo: 'orden', campo: 'titulo' },
    })
    expect(r?.ordenarPor).toBe('actualizado_en')
    expect(r?.tabla).toBe('ordenes_trabajo')
  })

  it('actividad.completada → tabla actividades + filtro estado completada', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'actividad.completada',
      configuracion: {},
    })
    expect(r).toEqual({
      tipoEntidad: 'actividad',
      tabla: 'actividades',
      filtros: { estadoClave: 'completada' },
      ordenarPor: 'actualizado_en',
    })
  })

  it('tiempo.relativo_a_campo + cuota → tabla cuotas sin filtro de estado', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'cuota',
        campo_fecha: 'fecha_vencimiento',
        delta_dias: -3,
      },
    })
    expect(r?.tipoEntidad).toBe('cuota')
    expect(r?.tabla).toBe('presupuesto_cuotas')
    expect(r?.filtros).toBeNull()
  })

  it('tiempo.cron → null (no hay entidad)', () => {
    expect(
      decidirEntidadAPrevisar({
        tipo: 'tiempo.cron',
        configuracion: { expresion: '0 9 * * 1-5' },
      }),
    ).toBeNull()
  })

  it('webhook.entrante → null', () => {
    expect(
      decidirEntidadAPrevisar({
        tipo: 'webhook.entrante',
        configuracion: { slug: 'mi-webhook' },
      }),
    ).toBeNull()
  })

  it('inbox.* → null', () => {
    expect(
      decidirEntidadAPrevisar({
        tipo: 'inbox.mensaje_recibido',
        configuracion: {},
      }),
    ).toBeNull()
    expect(
      decidirEntidadAPrevisar({
        tipo: 'inbox.conversacion_sin_respuesta',
        configuracion: { minutos_sin_respuesta: 60 },
      }),
    ).toBeNull()
  })
})

describe('decidirEntidadAPrevisar · entidades sin tabla en TABLA_PRINCIPAL_POR_ENTIDAD', () => {
  it('devuelve null si la entidad no está en el catálogo de tablas', () => {
    const r = decidirEntidadAPrevisar({
      tipo: 'entidad.estado_cambio' as TipoDisparador,
      configuracion: { entidad_tipo: 'inexistente' },
    })
    expect(r).toBeNull()
  })
})

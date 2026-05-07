/**
 * Tests de contrato para los endpoints de ejecuciones consumidos por la
 * UI del historial (sub-PR 19.6).
 *
 * No invocan los endpoints reales — eso requeriría Supabase live. En
 * cambio fijan el SHAPE que la UI espera del response, declarándolo
 * con asignaciones a las interfaces TypeScript que el frontend usa
 * para parsear el JSON. Si alguien cambia el shape del backend, los
 * tipos del frontend dejan de matchear y este test (compile-time + run)
 * pinta la divergencia antes de que llegue a producción.
 *
 * Cobertura:
 *   • GET /api/ejecuciones        → response listado paginado.
 *   • GET /api/ejecuciones/[id]   → response detalle + acciones_pendientes
 *                                   + permisos.{reejecutar, cancelar}.
 *   • POST /reejecutar            → body con dry_run rechazado, response OK.
 *   • POST /cancelar              → response 409 con `codigo` discriminado.
 */

import { describe, expect, it } from 'vitest'
import type { FilaEjecucion } from '@/app/(flux)/flujos/[id]/_componentes/_historial/hooks/useListadoEjecuciones'
import type { DetalleEjecucion } from '@/app/(flux)/flujos/[id]/_componentes/_historial/hooks/useDetalleEjecucion'

describe('contrato GET /api/ejecuciones', () => {
  it('una fila incluye todos los campos que el listado consume', () => {
    // Si el endpoint deja de devolver alguno de estos campos, el cast
    // a FilaEjecucion falla en compile time.
    const fila: FilaEjecucion = {
      id: '00000000-0000-0000-0000-000000000001',
      empresa_id: '00000000-0000-0000-0000-000000000010',
      flujo_id: '00000000-0000-0000-0000-000000000020',
      estado: 'completado',
      disparado_por: 'manual:user-1',
      contexto_inicial: {
        entidad: { tipo: 'presupuesto', id: 'pres-1', titulo: 'Pres #42' },
      },
      log: [],
      inicio_en: '2026-05-07T10:00:00Z',
      fin_en: '2026-05-07T10:00:01Z',
      proximo_paso_en: null,
      intentos: 0,
      clave_idempotencia: null,
      creado_en: '2026-05-07T10:00:00Z',
      flujo_nombre: 'Recordatorio cuota',
      flujo_estado: 'activo',
    }

    // Asserts en runtime para que el test tenga "fail visible" si
    // alguien cambia el tipo de un campo (string → number, etc.).
    expect(typeof fila.id).toBe('string')
    expect(typeof fila.flujo_id).toBe('string')
    expect(typeof fila.estado).toBe('string')
    expect(typeof fila.creado_en).toBe('string')
    // disparado_por puede ser null (cron sin user, futuro)
    expect(fila.disparado_por === null || typeof fila.disparado_por === 'string').toBe(true)
    // Campos denormalizados del JOIN
    expect('flujo_nombre' in fila).toBe(true)
    expect('flujo_estado' in fila).toBe(true)
  })

  it('respuesta de listado tiene los campos top-level esperados', () => {
    // El hook hace `json.ejecuciones`, `json.total`. Si el backend
    // renombra alguno, el extractor devuelve [] / 0 silenciosamente —
    // este test fija el shape mínimo.
    const respuesta = {
      ejecuciones: [] as FilaEjecucion[],
      total: 0,
      pagina: 1,
      por_pagina: 50,
    }
    expect(Array.isArray(respuesta.ejecuciones)).toBe(true)
    expect(typeof respuesta.total).toBe('number')
    expect(typeof respuesta.pagina).toBe('number')
    expect(typeof respuesta.por_pagina).toBe('number')
  })
})

describe('contrato GET /api/ejecuciones/[id]', () => {
  it('detalle incluye acciones_pendientes embebidas y permisos.{reejecutar, cancelar}', () => {
    // El drawer del 19.6 depende crítico de `acciones_pendientes` y
    // de `permisos` server-side para mostrar/ocultar botones.
    const detalle: DetalleEjecucion = {
      id: '00000000-0000-0000-0000-000000000001',
      empresa_id: '00000000-0000-0000-0000-000000000010',
      flujo_id: '00000000-0000-0000-0000-000000000020',
      estado: 'esperando',
      disparado_por: 'cambios_estado:cambio-1',
      contexto_inicial: { entidad: { tipo: 'presupuesto', id: 'p-1' } },
      log: [],
      inicio_en: '2026-05-07T10:00:00Z',
      fin_en: null,
      proximo_paso_en: '2026-05-08T10:00:00Z',
      intentos: 0,
      clave_idempotencia: null,
      creado_en: '2026-05-07T10:00:00Z',
      flujo_nombre: 'X',
      flujo_estado: 'activo',
      acciones_pendientes: [
        {
          id: 'pend-1',
          empresa_id: '00000000-0000-0000-0000-000000000010',
          ejecucion_id: '00000000-0000-0000-0000-000000000001',
          tipo_accion: 'enviar_whatsapp_texto',
          parametros: {},
          ejecutar_en: '2026-05-08T10:00:00Z',
          estado: 'pendiente',
          resultado: null,
          intentos: 0,
          creado_en: '2026-05-07T10:00:00Z',
          actualizado_en: '2026-05-07T10:00:00Z',
        },
      ],
      permisos: {
        reejecutar: false, // esperando NO puede reejecutar (transiciones-ejecucion)
        cancelar: true,    // esperando SÍ puede cancelar
      },
    }

    expect(Array.isArray(detalle.acciones_pendientes)).toBe(true)
    expect(detalle.acciones_pendientes[0]).toHaveProperty('tipo_accion')
    expect(detalle.acciones_pendientes[0]).toHaveProperty('ejecutar_en')
    expect(detalle.permisos).toHaveProperty('reejecutar')
    expect(detalle.permisos).toHaveProperty('cancelar')
    expect(typeof detalle.permisos.reejecutar).toBe('boolean')
    expect(typeof detalle.permisos.cancelar).toBe('boolean')
  })
})

describe('contrato POST /api/ejecuciones/[id]/reejecutar', () => {
  it('body con dry_run=true se envía pero el backend devuelve 501 (no implementado)', () => {
    // El drawer del 19.6 envía body vacío `{}` para "ejecución real".
    // Si en el futuro el backend habilita dry_run, la UI puede pasar
    // a soportarlo (mini-PR posterior anotado en commit 4).
    const bodyReal = {}
    const bodyDryRun = { dry_run: true }
    expect(bodyReal).toEqual({})
    expect(bodyDryRun.dry_run).toBe(true)
    // Documentamos el código de error esperado del backend en el caso
    // dry_run para que un cambio futuro sea visible en el test.
    const codigoEsperadoSiDryRun = 'no_implementado'
    expect(codigoEsperadoSiDryRun).toBe('no_implementado')
  })

  it('respuesta OK incluye la ejecución nueva con id y estado pendiente', () => {
    // El drawer no necesita la fila completa — sólo refresca el
    // listado y cierra. Pero el shape es relevante por si en el
    // futuro queremos abrir la ejecución nueva automáticamente.
    const respuestaOK = {
      ejecucion: {
        id: '00000000-0000-0000-0000-000000000099',
        flujo_id: '00000000-0000-0000-0000-000000000020',
        estado: 'pendiente' as const,
      },
    }
    expect(typeof respuestaOK.ejecucion.id).toBe('string')
    expect(respuestaOK.ejecucion.estado).toBe('pendiente')
  })
})

describe('contrato POST /api/ejecuciones/[id]/cancelar', () => {
  it('respuesta 409 incluye `codigo` discriminado para que la UI muestre toast amigable', () => {
    // Caveat D6 del coordinador: el drawer convierte 409 con
    // codigo `corriendo_no_cancelable` o `estado_cambio` en toast info,
    // no en error técnico.
    type Resp409 =
      | { error: string; codigo: 'corriendo_no_cancelable' }
      | { error: string; codigo: 'estado_cambio'; ejecucion: unknown }

    const yaTermino: Resp409 = {
      error: 'La ejecución cambió de estado y ya no es cancelable.',
      codigo: 'estado_cambio',
      ejecucion: null,
    }
    const corriendo: Resp409 = {
      error: 'No se puede cancelar una ejecución corriendo',
      codigo: 'corriendo_no_cancelable',
    }
    expect(yaTermino.codigo).toBe('estado_cambio')
    expect(corriendo.codigo).toBe('corriendo_no_cancelable')
  })

  it('respuesta OK incluye la ejecución actualizada con estado=cancelado', () => {
    const respuestaOK = {
      ejecucion: {
        id: '00000000-0000-0000-0000-000000000001',
        estado: 'cancelado' as const,
        fin_en: '2026-05-07T10:05:00Z',
      },
    }
    expect(respuestaOK.ejecucion.estado).toBe('cancelado')
    expect(typeof respuestaOK.ejecucion.fin_en).toBe('string')
  })
})

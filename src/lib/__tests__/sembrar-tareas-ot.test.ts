/**
 * Tests de `sembrarTareasOT`: helper que copia las líneas de un presupuesto
 * a `tareas_orden` cuando se genera una OT desde el presupuesto.
 *
 * Validamos:
 *   - Mapeo tipo_linea → tipo + estado (producto→pendiente, seccion/nota→no_aplica).
 *   - Líneas tipo='descuento' se omiten (no rompen el CHECK de tareas_orden.tipo).
 *   - Tipos desconocidos se omiten con warn (no rompen).
 *   - Preserva el campo `orden` original y setea `origen_linea_id`.
 *   - Título fallback '(sin título)' si la descripción es null/vacía.
 *   - Presupuesto sin líneas / solo descuentos → `{ agregadas: 0 }` sin INSERT.
 *   - Errores de Supabase se propagan como excepción.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))

import { sembrarTareasOT } from '../sembrar-tareas-ot'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)

const EMPRESA_ID = 'empresa-uuid-1'
const PRESUPUESTO_ID = 'presupuesto-uuid-1'
const ORDEN_ID = 'orden-uuid-1'
const USER_ID = 'user-uuid-1'

interface LineaSimulada {
  id: string
  tipo_linea: string | null
  orden: number | null
  codigo_producto: string | null
  descripcion: string | null
  descripcion_detalle: string | null
}

interface EstadoMock {
  lineas: LineaSimulada[]
  errorSelectLineas?: { message: string } | null
  errorInsertTareas?: { message: string } | null
  /** Captura las filas pasadas al insert sobre tareas_orden. */
  filasInsertadas: Array<Record<string, unknown>> | null
}

function crearAdminMock(estado: EstadoMock) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'lineas_presupuesto') {
        return crearBuilderLineas(estado)
      }
      if (tabla === 'tareas_orden') {
        return crearBuilderTareas(estado)
      }
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

function crearBuilderLineas(estado: EstadoMock) {
  const promesaFinal = Promise.resolve({
    data: estado.errorSelectLineas ? null : estado.lineas,
    error: estado.errorSelectLineas ?? null,
  })
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    // .order() es el terminal en el helper: devuelve la promesa.
    order: vi.fn(() => promesaFinal),
  }
  return builder
}

function crearBuilderTareas(estado: EstadoMock) {
  return {
    insert: vi.fn((filas: Array<Record<string, unknown>>) => {
      estado.filasInsertadas = filas
      return Promise.resolve({
        data: null,
        error: estado.errorInsertTareas ?? null,
      })
    }),
  }
}

function ejecutar(estado: EstadoMock) {
  crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)
  return sembrarTareasOT({
    empresaId: EMPRESA_ID,
    presupuestoId: PRESUPUESTO_ID,
    ordenTrabajoId: ORDEN_ID,
    creadoPor: USER_ID,
    creadoPorNombre: 'Sal Salix',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sembrarTareasOT', () => {
  it('mapea productos + secciones + notas preservando orden y origen_linea_id', async () => {
    const estado: EstadoMock = {
      lineas: [
        { id: 'l1', tipo_linea: 'seccion', orden: 0, codigo_producto: null, descripcion: 'Instalación', descripcion_detalle: null },
        { id: 'l2', tipo_linea: 'producto', orden: 1, codigo_producto: 'CAB-001', descripcion: 'Cableado', descripcion_detalle: 'Cable 2.5mm certificado' },
        { id: 'l3', tipo_linea: 'producto', orden: 2, codigo_producto: 'INT-005', descripcion: 'Interruptor', descripcion_detalle: null },
        { id: 'l4', tipo_linea: 'nota', orden: 3, codigo_producto: null, descripcion: 'Cliente firma al final', descripcion_detalle: null },
        { id: 'l5', tipo_linea: 'producto', orden: 4, codigo_producto: 'LUM-010', descripcion: 'Luminaria LED', descripcion_detalle: null },
      ],
      filasInsertadas: null,
    }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 5 })
    expect(estado.filasInsertadas).toHaveLength(5)
    const filas = estado.filasInsertadas!

    // Sección — estado no_aplica.
    expect(filas[0]).toMatchObject({
      empresa_id: EMPRESA_ID,
      orden_trabajo_id: ORDEN_ID,
      tipo: 'seccion',
      estado: 'no_aplica',
      titulo: 'Instalación',
      origen_linea_id: 'l1',
      orden: 0,
      creado_por: USER_ID,
      creado_por_nombre: 'Sal Salix',
    })

    // Producto — estado pendiente.
    expect(filas[1]).toMatchObject({
      tipo: 'producto',
      estado: 'pendiente',
      titulo: 'Cableado',
      descripcion_detalle: 'Cable 2.5mm certificado',
      codigo_producto: 'CAB-001',
      origen_linea_id: 'l2',
      orden: 1,
    })

    // Nota — estado no_aplica.
    expect(filas[3]).toMatchObject({
      tipo: 'nota',
      estado: 'no_aplica',
      titulo: 'Cliente firma al final',
      origen_linea_id: 'l4',
      orden: 3,
    })

    // Último producto preserva orden=4.
    expect(filas[4]).toMatchObject({ tipo: 'producto', orden: 4, origen_linea_id: 'l5' })
  })

  it('omite líneas tipo=descuento (no se siembran como tareas)', async () => {
    const estado: EstadoMock = {
      lineas: [
        { id: 'l1', tipo_linea: 'producto', orden: 0, codigo_producto: null, descripcion: 'Mano de obra', descripcion_detalle: null },
        { id: 'l2', tipo_linea: 'descuento', orden: 1, codigo_producto: null, descripcion: 'Bonificación cliente', descripcion_detalle: null },
      ],
      filasInsertadas: null,
    }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 1 })
    expect(estado.filasInsertadas).toHaveLength(1)
    expect(estado.filasInsertadas![0]).toMatchObject({ tipo: 'producto', origen_linea_id: 'l1' })
  })

  it('omite líneas con tipo_linea desconocido (no rompe, loguea warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const estado: EstadoMock = {
      lineas: [
        { id: 'l1', tipo_linea: 'producto', orden: 0, codigo_producto: null, descripcion: 'Tarea OK', descripcion_detalle: null },
        { id: 'l2', tipo_linea: 'subtotal', orden: 1, codigo_producto: null, descripcion: 'Algo raro', descripcion_detalle: null },
      ],
      filasInsertadas: null,
    }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 1 })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('subtotal'))
    warnSpy.mockRestore()
  })

  it('usa fallback "(sin título)" cuando descripcion es null o vacía', async () => {
    const estado: EstadoMock = {
      lineas: [
        { id: 'l1', tipo_linea: 'producto', orden: 0, codigo_producto: 'X', descripcion: null, descripcion_detalle: null },
        { id: 'l2', tipo_linea: 'seccion', orden: 1, codigo_producto: null, descripcion: '   ', descripcion_detalle: null },
      ],
      filasInsertadas: null,
    }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 2 })
    expect(estado.filasInsertadas![0].titulo).toBe('(sin título)')
    expect(estado.filasInsertadas![1].titulo).toBe('(sin título)')
  })

  it('presupuesto sin líneas → devuelve { agregadas: 0 } sin INSERT', async () => {
    const estado: EstadoMock = { lineas: [], filasInsertadas: null }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 0 })
    expect(estado.filasInsertadas).toBeNull()
  })

  it('presupuesto solo con descuentos → devuelve { agregadas: 0 } sin INSERT', async () => {
    const estado: EstadoMock = {
      lineas: [
        { id: 'd1', tipo_linea: 'descuento', orden: 0, codigo_producto: null, descripcion: 'Bonif', descripcion_detalle: null },
        { id: 'd2', tipo_linea: 'descuento', orden: 1, codigo_producto: null, descripcion: 'Promo', descripcion_detalle: null },
      ],
      filasInsertadas: null,
    }

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregadas: 0 })
    expect(estado.filasInsertadas).toBeNull()
  })

  it('propaga el error si Supabase falla al leer líneas', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado: EstadoMock = {
      lineas: [],
      errorSelectLineas: { message: 'connection_lost' },
      filasInsertadas: null,
    }

    await expect(ejecutar(estado)).rejects.toThrow(/connection_lost/)
    errorSpy.mockRestore()
  })

  it('propaga el error si Supabase falla al insertar tareas', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado: EstadoMock = {
      lineas: [
        { id: 'l1', tipo_linea: 'producto', orden: 0, codigo_producto: null, descripcion: 'X', descripcion_detalle: null },
      ],
      errorInsertTareas: { message: 'check_constraint_failed' },
      filasInsertadas: null,
    }

    await expect(ejecutar(estado)).rejects.toThrow(/check_constraint_failed/)
    errorSpy.mockRestore()
  })
})

/**
 * Tests de `sembrarRelevamientoOT`: helper que clona entradas de relevamiento
 * (tipo='visita' + tipo='nota_interna') del chatter de la visita al chatter
 * de la OT, marcando subtipo='relevamiento' y origen_chatter_id para
 * idempotencia.
 *
 * Validamos:
 *   - Copia entrada principal de visita usando `visita_notas` como contenido
 *     y conservando adjuntos.
 *   - Copia notas_internas con fotos.
 *   - Omite tipos no-relevamiento (sistema, whatsapp) por filtro en SELECT.
 *   - Omite entradas sin material (sin adjuntos ni texto útil).
 *   - Idempotencia: si ya hay subtipo='relevamiento' con origen_chatter_id
 *     conocido, no se duplica.
 *   - Visita sin chatter → { agregados: 0 } sin INSERT.
 *   - Propaga errores de lectura e insert.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  crearClienteAdmin: vi.fn(),
}))

import { sembrarRelevamientoOT } from '../sembrar-relevamiento-ot'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const crearClienteAdminMock = vi.mocked(crearClienteAdmin)

const EMPRESA_ID = 'empresa-uuid-1'
const VISITA_ID = 'visita-uuid-1'
const ORDEN_ID = 'orden-uuid-1'

interface EntradaChatterMock {
  id: string
  tipo: string
  contenido: string
  autor_id: string | null
  autor_nombre: string
  autor_avatar_url: string | null
  adjuntos: Array<{ url: string; nombre: string; tipo: string; tamano?: number }>
  metadata: Record<string, unknown>
  creado_en: string
}

interface EstadoMock {
  /** Lo que devuelve el SELECT sobre chatter de la visita. */
  entradasVisita: EntradaChatterMock[]
  /** Lo que devuelve el SELECT sobre chatter de la OT (con metadata). */
  entradasOT: Array<{ metadata: Record<string, unknown> }>
  errorSelectVisita?: { message: string } | null
  errorSelectOT?: { message: string } | null
  errorInsert?: { message: string } | null
  /** Captura las filas pasadas al insert. */
  filasInsertadas: Array<Record<string, unknown>> | null
  /** Captura los filtros aplicados al SELECT de visita para asegurar que
   *  filtramos por entidad_tipo='visita' y tipos IN ('visita','nota_interna'). */
  filtrosVisita: { entidadTipo?: string; entidadId?: string; tiposIn?: string[] }
}

function crearAdminMock(estado: EstadoMock) {
  let llamadaActual: 'visita' | 'orden_trabajo' | 'insert' | null = null

  return {
    from: vi.fn((tabla: string) => {
      if (tabla !== 'chatter') {
        throw new Error(`Tabla mock no soportada: ${tabla}`)
      }

      return {
        select: vi.fn(() => {
          // Modo SELECT — el primero es visita, el segundo es OT.
          return crearBuilderSelect(estado, () => {
            const wasNull = llamadaActual === null
            llamadaActual = wasNull ? 'visita' : 'orden_trabajo'
            return wasNull ? 'visita' : 'orden_trabajo'
          })
        }),
        insert: vi.fn((filas: Array<Record<string, unknown>>) => {
          estado.filasInsertadas = filas
          return Promise.resolve({
            data: null,
            error: estado.errorInsert ?? null,
          })
        }),
      }
    }),
  }
}

function crearBuilderSelect(estado: EstadoMock, resolverModo: () => 'visita' | 'orden_trabajo') {
  const modo = resolverModo()

  const builder = {
    eq: vi.fn((col: string, val: unknown) => {
      if (modo === 'visita') {
        if (col === 'entidad_tipo') estado.filtrosVisita.entidadTipo = val as string
        if (col === 'entidad_id') estado.filtrosVisita.entidadId = val as string
      }
      return builder
    }),
    in: vi.fn((col: string, vals: string[]) => {
      if (modo === 'visita' && col === 'tipo') {
        estado.filtrosVisita.tiposIn = vals
      }
      return builder
    }),
    order: vi.fn(() => {
      // Terminal del SELECT de visita.
      return Promise.resolve({
        data: estado.errorSelectVisita ? null : estado.entradasVisita,
        error: estado.errorSelectVisita ?? null,
      })
    }),
    // El SELECT de OT no usa .order() ni .in() — solo .eq(...) terminales.
    // Promesa thenable: cuando se await sin .order(), devuelve entradasOT.
    then: (resolve: (val: { data: unknown; error: unknown }) => void) => {
      if (modo === 'orden_trabajo') {
        resolve({
          data: estado.errorSelectOT ? null : estado.entradasOT,
          error: estado.errorSelectOT ?? null,
        })
      }
    },
  }

  return builder
}

function ejecutar(estado: EstadoMock) {
  crearClienteAdminMock.mockReturnValue(crearAdminMock(estado) as never)
  return sembrarRelevamientoOT({ empresaId: EMPRESA_ID, visitaId: VISITA_ID, ordenTrabajoId: ORDEN_ID })
}

function estadoBase(overrides: Partial<EstadoMock> = {}): EstadoMock {
  return {
    entradasVisita: [],
    entradasOT: [],
    filasInsertadas: null,
    filtrosVisita: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sembrarRelevamientoOT', () => {
  it('clona la entrada principal de visita usando visita_notas y conservando adjuntos', async () => {
    const adjuntoFoto = {
      url: 'https://supabase.test/foto1.webp',
      nombre: 'foto1.jpg',
      tipo: 'image/webp',
      tamano: 1000,
    }
    const estado = estadoBase({
      entradasVisita: [
        {
          id: 'c1',
          tipo: 'visita',
          contenido: 'Visita completada',
          autor_id: 'user-1',
          autor_nombre: 'Sal Salix',
          autor_avatar_url: null,
          adjuntos: [adjuntoFoto],
          metadata: {
            accion: 'visita_completada',
            visita_id: VISITA_ID,
            visita_notas: 'Motor con rodamientos gastados — reemplazar.',
            visita_motivo: 'mantenimiento',
          },
          creado_en: '2026-05-10T10:00:00Z',
        },
      ],
    })

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregados: 1 })
    expect(estado.filasInsertadas).toHaveLength(1)
    expect(estado.filasInsertadas![0]).toMatchObject({
      empresa_id: EMPRESA_ID,
      entidad_tipo: 'orden_trabajo',
      entidad_id: ORDEN_ID,
      tipo: 'nota_interna',
      contenido: 'Motor con rodamientos gastados — reemplazar.',
      autor_id: 'user-1',
      autor_nombre: 'Sal Salix',
      adjuntos: [adjuntoFoto],
      metadata: {
        subtipo: 'relevamiento',
        origen_chatter_id: 'c1',
        accion: 'relevamiento_sembrado',
        visita_id: VISITA_ID,
      },
    })
  })

  it('clona notas_internas con fotos manteniendo contenido y adjuntos', async () => {
    const estado = estadoBase({
      entradasVisita: [
        {
          id: 'c2',
          tipo: 'nota_interna',
          contenido: 'Falta tensión en línea fase R',
          autor_id: 'user-2',
          autor_nombre: 'Técnico Juan',
          autor_avatar_url: null,
          adjuntos: [{ url: 'https://supabase.test/x.jpg', nombre: 'x.jpg', tipo: 'image/jpeg' }],
          metadata: {},
          creado_en: '2026-05-10T11:00:00Z',
        },
      ],
    })

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregados: 1 })
    expect(estado.filasInsertadas![0]).toMatchObject({
      tipo: 'nota_interna',
      contenido: 'Falta tensión en línea fase R',
      autor_nombre: 'Técnico Juan',
      metadata: { subtipo: 'relevamiento', origen_chatter_id: 'c2' },
    })
  })

  it('filtra en el SELECT por tipos relevantes (visita + nota_interna)', async () => {
    const estado = estadoBase({
      entradasVisita: [],
    })
    await ejecutar(estado)
    expect(estado.filtrosVisita.entidadTipo).toBe('visita')
    expect(estado.filtrosVisita.entidadId).toBe(VISITA_ID)
    expect(estado.filtrosVisita.tiposIn).toEqual(expect.arrayContaining(['visita', 'nota_interna']))
    expect(estado.filtrosVisita.tiposIn).toHaveLength(2)
  })

  it('omite entradas sin contenido útil ni adjuntos', async () => {
    const estado = estadoBase({
      entradasVisita: [
        {
          id: 'c-vacia',
          tipo: 'visita',
          contenido: '   ',
          autor_id: 'u',
          autor_nombre: 'X',
          autor_avatar_url: null,
          adjuntos: [],
          metadata: { visita_notas: '   ' },
          creado_en: '2026-05-10T12:00:00Z',
        },
      ],
    })

    const resultado = await ejecutar(estado)
    expect(resultado).toEqual({ agregados: 0 })
    expect(estado.filasInsertadas).toBeNull()
  })

  it('idempotencia: omite entradas cuyo id ya está sembrado en la OT', async () => {
    const estado = estadoBase({
      entradasVisita: [
        {
          id: 'c1',
          tipo: 'visita',
          contenido: 'Visita completada',
          autor_id: 'u',
          autor_nombre: 'Sal',
          autor_avatar_url: null,
          adjuntos: [{ url: 'a.jpg', nombre: 'a.jpg', tipo: 'image/jpeg' }],
          metadata: { visita_notas: 'Notas A' },
          creado_en: '2026-05-10T10:00:00Z',
        },
        {
          id: 'c2',
          tipo: 'nota_interna',
          contenido: 'Notas B',
          autor_id: 'u',
          autor_nombre: 'Sal',
          autor_avatar_url: null,
          adjuntos: [],
          metadata: {},
          creado_en: '2026-05-10T11:00:00Z',
        },
      ],
      entradasOT: [
        // Ya sembrado: c1.
        {
          metadata: {
            subtipo: 'relevamiento',
            origen_chatter_id: 'c1',
            accion: 'relevamiento_sembrado',
          },
        },
        // No es relevamiento, no afecta.
        { metadata: { accion: 'creado' } },
      ],
    })

    const resultado = await ejecutar(estado)
    expect(resultado).toEqual({ agregados: 1 })
    expect(estado.filasInsertadas).toHaveLength(1)
    expect(estado.filasInsertadas![0]).toMatchObject({
      contenido: 'Notas B',
      metadata: { origen_chatter_id: 'c2' },
    })
  })

  it('visita sin entradas de relevamiento → { agregados: 0 } sin INSERT', async () => {
    const estado = estadoBase({ entradasVisita: [] })

    const resultado = await ejecutar(estado)

    expect(resultado).toEqual({ agregados: 0 })
    expect(estado.filasInsertadas).toBeNull()
  })

  it('propaga el error al leer chatter de la visita', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado = estadoBase({
      entradasVisita: [],
      errorSelectVisita: { message: 'visita_select_fail' },
    })

    await expect(ejecutar(estado)).rejects.toThrow(/visita_select_fail/)
    errSpy.mockRestore()
  })

  it('propaga el error al insertar en chatter de la OT', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const estado = estadoBase({
      entradasVisita: [
        {
          id: 'c1',
          tipo: 'nota_interna',
          contenido: 'Algo',
          autor_id: null,
          autor_nombre: 'X',
          autor_avatar_url: null,
          adjuntos: [],
          metadata: {},
          creado_en: '2026-05-10T10:00:00Z',
        },
      ],
      errorInsert: { message: 'insert_fail' },
    })

    await expect(ejecutar(estado)).rejects.toThrow(/insert_fail/)
    errSpy.mockRestore()
  })
})

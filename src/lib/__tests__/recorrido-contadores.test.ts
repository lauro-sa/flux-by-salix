import { describe, it, expect, vi } from 'vitest'
import { recalcularContadoresRecorrido } from '../recorrido-contadores'

/**
 * Tests del helper que recalcula contadores del recorrido.
 *
 * El helper es el core de la feature "paradas polimórficas": cada vez que se
 * agrega, quita o cambia de estado una parada (visita o genérica), los contadores
 * `total_visitas / visitas_completadas / total_paradas / paradas_completadas` y
 * el estado del recorrido (`pendiente / en_curso / completado / borrador`) deben
 * mantenerse coherentes.
 *
 * Mockeamos supabase con un stub chainable mínimo: capturamos lo que se escribe
 * en `recorridos` y controlamos lo que devuelve el SELECT de paradas.
 */

type Parada = {
  id: string
  tipo: 'visita' | 'parada'
  estado: string // usado cuando tipo='parada'
  visita: { estado: string } | null
}

function crearAdminMock(opts: {
  estadoRecorrido: string
  paradas: Parada[]
}) {
  const updates: Array<Record<string, unknown>> = []

  const admin = {
    from(tabla: string) {
      if (tabla === 'recorridos') {
        return {
          // SELECT estado
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: { estado: opts.estadoRecorrido }, error: null }),
                }
              },
            }
          },
          // UPDATE
          update(payload: Record<string, unknown>) {
            updates.push(payload)
            return {
              eq: async () => ({ error: null }),
            }
          },
        }
      }
      if (tabla === 'recorrido_paradas') {
        return {
          select() {
            return {
              eq: async () => ({ data: opts.paradas, error: null }),
            }
          },
        }
      }
      throw new Error(`Tabla inesperada: ${tabla}`)
    },
  }

  return { admin, updates }
}

describe('recalcularContadoresRecorrido', () => {
  it('cuenta visitas y paradas por separado', async () => {
    const { admin, updates } = crearAdminMock({
      estadoRecorrido: 'en_curso',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'completada' } },
        { id: 'p2', tipo: 'visita', estado: 'programada', visita: { estado: 'programada' } },
        { id: 'p3', tipo: 'parada', estado: 'completada', visita: null },
        { id: 'p4', tipo: 'parada', estado: 'programada', visita: null },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-1')

    expect(res).not.toBeNull()
    expect(res!.total_visitas).toBe(2)
    expect(res!.visitas_completadas).toBe(1)
    expect(res!.total_paradas).toBe(2)
    expect(res!.paradas_completadas).toBe(1)
    expect(updates[0]).toMatchObject({
      total_visitas: 2,
      visitas_completadas: 1,
      total_paradas: 2,
      paradas_completadas: 1,
    })
  })

  it('marca el recorrido como completado cuando todas las paradas están finalizadas', async () => {
    const { admin } = crearAdminMock({
      estadoRecorrido: 'en_curso',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'completada' } },
        { id: 'p2', tipo: 'visita', estado: 'programada', visita: { estado: 'cancelada' } },
        { id: 'p3', tipo: 'parada', estado: 'completada', visita: null },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-2')
    expect(res!.estado).toBe('completado')
  })

  it('marca en_curso cuando hay una parada activa (en_camino)', async () => {
    const { admin } = crearAdminMock({
      estadoRecorrido: 'pendiente',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'en_camino' } },
        { id: 'p2', tipo: 'visita', estado: 'programada', visita: { estado: 'programada' } },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-3')
    expect(res!.estado).toBe('en_curso')
  })

  it('marca pendiente cuando nada arrancó todavía', async () => {
    const { admin } = crearAdminMock({
      estadoRecorrido: 'en_curso',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'programada' } },
        { id: 'p2', tipo: 'parada', estado: 'programada', visita: null },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-4')
    expect(res!.estado).toBe('pendiente')
  })

  it('NO toca el estado si el recorrido está en borrador (coordinador todavía organiza)', async () => {
    const { admin, updates } = crearAdminMock({
      estadoRecorrido: 'borrador',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'completada' } },
        { id: 'p2', tipo: 'visita', estado: 'programada', visita: { estado: 'completada' } },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-5')
    expect(res!.estado).toBe('borrador')
    expect(updates[0].estado).toBe('borrador')
  })

  it('paradas genéricas con estado cancelada cuentan como finalizadas para cerrar el recorrido', async () => {
    const { admin } = crearAdminMock({
      estadoRecorrido: 'en_curso',
      paradas: [
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: { estado: 'completada' } },
        { id: 'p2', tipo: 'parada', estado: 'cancelada', visita: null },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-6')
    expect(res!.estado).toBe('completado')
    // La parada cancelada no cuenta como "completada" pero sí como "finalizada"
    expect(res!.paradas_completadas).toBe(0)
    expect(res!.total_paradas).toBe(1)
  })

  it('devuelve null si el recorrido no existe', async () => {
    const admin = {
      from(tabla: string) {
        if (tabla === 'recorridos') {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: async () => ({ data: null, error: { code: 'PGRST116' } }),
                  }
                },
              }
            },
          }
        }
        throw new Error(`Tabla inesperada: ${tabla}`)
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'no-existe')
    expect(res).toBeNull()
  })

  it('maneja la relación visita como array (caso supabase)', async () => {
    // Supabase a veces devuelve la relación como array, a veces como objeto
    const { admin } = crearAdminMock({
      estadoRecorrido: 'en_curso',
      paradas: [
        // @ts-expect-error — forzamos el shape alternativo de la relación
        { id: 'p1', tipo: 'visita', estado: 'programada', visita: [{ estado: 'completada' }] },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-7')
    expect(res!.visitas_completadas).toBe(1)
    expect(res!.estado).toBe('completado')
  })

  it('recorrido vacío (sin paradas) queda en pendiente', async () => {
    const { admin } = crearAdminMock({
      estadoRecorrido: 'pendiente',
      paradas: [],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await recalcularContadoresRecorrido(admin as any, 'rec-8')
    expect(res!.total_visitas).toBe(0)
    expect(res!.total_paradas).toBe(0)
    expect(res!.estado).toBe('pendiente')
  })
})

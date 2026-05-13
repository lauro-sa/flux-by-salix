/**
 * Tests del helper `resolverPermisosGaleriaOT` — núcleo de los permisos
 * de las galerías de OT (relevamiento + bitácora).
 *
 * Reglas:
 *   - `puedeGestionar`: tiene permiso `editar` del módulo `ordenes_trabajo`,
 *     o es creador de la OT, o es cabecilla asignado.
 *   - `esAsignado`: figura en `asignados_orden_trabajo` (cabecilla o común).
 *   - Si la OT no existe / no pertenece a la empresa → orden=null y los
 *     dos flags en false.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/permisos-servidor', () => ({
  obtenerDatosMiembro: vi.fn(),
  verificarPermiso: vi.fn(),
}))

import { resolverPermisosGaleriaOT } from '../permisos-galeria-ot'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

const obtenerDatosMiembroMock = vi.mocked(obtenerDatosMiembro)
const verificarPermisoMock = vi.mocked(verificarPermiso)

const EMPRESA_ID = 'empresa-1'
const ORDEN_ID = 'orden-1'
const USER_ID = 'user-1'

const usuario = { id: USER_ID } as User

interface OrdenMock {
  id: string
  numero: string | null
  creado_por: string
  publicada: boolean
}

interface AsignadoMock {
  usuario_id: string
  es_cabecilla: boolean
}

function crearAdminMock(orden: OrdenMock | null, asignados: AsignadoMock[]) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'ordenes_trabajo') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: orden, error: null })),
              })),
            })),
          })),
        }
      }
      if (tabla === 'asignados_orden_trabajo') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: asignados, error: null })),
          })),
        }
      }
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  obtenerDatosMiembroMock.mockResolvedValue({} as never)
  verificarPermisoMock.mockReturnValue(false)
})

describe('resolverPermisosGaleriaOT', () => {
  it('OT inexistente → orden=null, flags en false', async () => {
    const admin = crearAdminMock(null, []) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.orden).toBeNull()
    expect(res.puedeGestionar).toBe(false)
    expect(res.esAsignado).toBe(false)
  })

  it('admin (permiso editar) → puedeGestionar=true aunque no sea asignado', async () => {
    verificarPermisoMock.mockReturnValue(true)
    const admin = crearAdminMock(
      { id: ORDEN_ID, numero: 'OT-001', creado_por: 'otro-user', publicada: false },
      [],
    ) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.puedeGestionar).toBe(true)
    expect(res.esAsignado).toBe(false)
  })

  it('creador de la OT → puedeGestionar=true sin permiso de módulo', async () => {
    verificarPermisoMock.mockReturnValue(false)
    const admin = crearAdminMock(
      { id: ORDEN_ID, numero: 'OT-001', creado_por: USER_ID, publicada: false },
      [],
    ) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.puedeGestionar).toBe(true)
    expect(res.esAsignado).toBe(false)
  })

  it('cabecilla asignado → puedeGestionar=true Y esAsignado=true', async () => {
    verificarPermisoMock.mockReturnValue(false)
    const admin = crearAdminMock(
      { id: ORDEN_ID, numero: 'OT-001', creado_por: 'otro-user', publicada: false },
      [{ usuario_id: USER_ID, es_cabecilla: true }],
    ) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.puedeGestionar).toBe(true)
    expect(res.esAsignado).toBe(true)
  })

  it('asignado común (no cabecilla) → esAsignado=true pero puedeGestionar=false', async () => {
    verificarPermisoMock.mockReturnValue(false)
    const admin = crearAdminMock(
      { id: ORDEN_ID, numero: 'OT-001', creado_por: 'otro-user', publicada: false },
      [{ usuario_id: USER_ID, es_cabecilla: false }],
    ) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.esAsignado).toBe(true)
    expect(res.puedeGestionar).toBe(false)
  })

  it('externo (no admin, no creador, no asignado) → todos false', async () => {
    verificarPermisoMock.mockReturnValue(false)
    const admin = crearAdminMock(
      { id: ORDEN_ID, numero: 'OT-001', creado_por: 'otro-user', publicada: false },
      [{ usuario_id: 'algun-asignado', es_cabecilla: true }],
    ) as never

    const res = await resolverPermisosGaleriaOT(admin, usuario, EMPRESA_ID, ORDEN_ID)

    expect(res.puedeGestionar).toBe(false)
    expect(res.esAsignado).toBe(false)
    expect(res.orden).not.toBeNull()
  })
})

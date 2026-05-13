/**
 * Tests de `resolverPlantillaAviso` — helper que resuelve qué plantilla
 * Meta de WhatsApp usar para los avisos del recorrido (en camino /
 * llegada).
 *
 * Estrategia testeada:
 *   1. Si la empresa configuró un id en `config_visitas`, se devuelve esa
 *      plantilla con su `nombre_api`.
 *   2. Si el id está configurado pero la plantilla no existe (eliminada),
 *      cae al fallback por nombre_api default.
 *   3. Si la empresa no tiene config (NULL), cae al fallback por nombre.
 *   4. Si tampoco existe el seed default → devuelve null.
 *   5. La selección de tipo elige el campo correcto
 *      (plantilla_aviso_llegada_id vs plantilla_aviso_en_camino_id).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolverPlantillaAviso, nombreApiDefault } from '../recorrido-plantilla-aviso'

const EMPRESA_ID = 'empresa-uuid-1'

interface PlantillaSimulada {
  id: string
  nombre_api: string
  estado_meta: string
  componentes: Record<string, unknown>
}

interface EstadoMock {
  /** Lo que devuelve el SELECT sobre config_visitas. Null = empresa sin
   *  config (algo improbable pero defensible). */
  config: Record<string, unknown> | null
  /** Plantillas indexadas por id, para resolución por id. */
  plantillasPorId: Map<string, PlantillaSimulada>
  /** Plantillas indexadas por nombre_api, para fallback por nombre. */
  plantillasPorNombre: Map<string, PlantillaSimulada>
  /** Captura el campo que se pidió en el SELECT de config_visitas. */
  campoConfigPedido?: string
  /** Captura los filtros aplicados al SELECT de plantillas. */
  filtroPorId?: string
  filtroPorNombre?: string
}

function crearAdminMock(estado: EstadoMock) {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === 'config_visitas') {
        return crearBuilderConfig(estado)
      }
      if (tabla === 'plantillas_whatsapp') {
        return crearBuilderPlantillas(estado)
      }
      throw new Error(`Tabla mock no soportada: ${tabla}`)
    }),
  }
}

function crearBuilderConfig(estado: EstadoMock) {
  const builder = {
    select: vi.fn((cols: string) => {
      estado.campoConfigPedido = cols
      return builder
    }),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: estado.config, error: null })),
  }
  return builder
}

function crearBuilderPlantillas(estado: EstadoMock) {
  // El helper hace SELECT plantillas_whatsapp por id (eq id, eq empresa_id, maybeSingle)
  // o por nombre_api (eq empresa_id, eq nombre_api, maybeSingle).
  // Tracemos los filtros aplicados.
  let buscandoPorId: string | null = null
  let buscandoPorNombre: string | null = null

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      if (col === 'id') {
        buscandoPorId = val as string
        estado.filtroPorId = val as string
      }
      if (col === 'nombre_api') {
        buscandoPorNombre = val as string
        estado.filtroPorNombre = val as string
      }
      return builder
    }),
    maybeSingle: vi.fn(() => {
      if (buscandoPorId) {
        const p = estado.plantillasPorId.get(buscandoPorId) ?? null
        return Promise.resolve({ data: p, error: null })
      }
      if (buscandoPorNombre) {
        const p = estado.plantillasPorNombre.get(buscandoPorNombre) ?? null
        return Promise.resolve({ data: p, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
  }
  return builder
}

function estadoBase(overrides: Partial<EstadoMock> = {}): EstadoMock {
  return {
    config: null,
    plantillasPorId: new Map(),
    plantillasPorNombre: new Map(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolverPlantillaAviso', () => {
  it('devuelve plantilla configurada por la empresa con su nombre_api custom', async () => {
    const plantillaCustom: PlantillaSimulada = {
      id: 'p-1',
      nombre_api: 'mi_aviso_custom',
      estado_meta: 'APPROVED',
      componentes: { cuerpo: { texto: 'Hola {{1}}' } },
    }

    const estado = estadoBase({
      config: { plantilla_aviso_en_camino_id: 'p-1' },
      plantillasPorId: new Map([['p-1', plantillaCustom]]),
    })

    const admin = crearAdminMock(estado) as never

    const res = await resolverPlantillaAviso(admin, EMPRESA_ID, 'en_camino')

    expect(res).not.toBeNull()
    expect(res!.plantilla).toEqual(plantillaCustom)
    expect(res!.nombreApi).toBe('mi_aviso_custom')
    expect(estado.filtroPorId).toBe('p-1')
  })

  it('si la plantilla configurada ya no existe, cae al seed default', async () => {
    const plantillaDefault: PlantillaSimulada = {
      id: 'p-seed',
      nombre_api: 'aviso_en_camino_default',
      estado_meta: 'APPROVED',
      componentes: {},
    }

    const estado = estadoBase({
      config: { plantilla_aviso_en_camino_id: 'p-borrada' },
      plantillasPorId: new Map(), // 'p-borrada' no está
      plantillasPorNombre: new Map([['aviso_en_camino_default', plantillaDefault]]),
    })

    const admin = crearAdminMock(estado) as never

    const res = await resolverPlantillaAviso(admin, EMPRESA_ID, 'en_camino')

    expect(res).not.toBeNull()
    expect(res!.plantilla).toEqual(plantillaDefault)
    expect(res!.nombreApi).toBe('aviso_en_camino_default')
    expect(estado.filtroPorNombre).toBe('aviso_en_camino_default')
  })

  it('sin config de empresa (NULL) usa el seed por nombre default', async () => {
    const plantillaDefault: PlantillaSimulada = {
      id: 'p-seed',
      nombre_api: 'aviso_llegada_default',
      estado_meta: 'PENDING',
      componentes: {},
    }

    const estado = estadoBase({
      config: null,
      plantillasPorNombre: new Map([['aviso_llegada_default', plantillaDefault]]),
    })

    const admin = crearAdminMock(estado) as never

    const res = await resolverPlantillaAviso(admin, EMPRESA_ID, 'llegada')

    expect(res).not.toBeNull()
    expect(res!.plantilla).toEqual(plantillaDefault)
    expect(res!.nombreApi).toBe('aviso_llegada_default')
  })

  it('si no hay configuración ni seed → devuelve null', async () => {
    const estado = estadoBase({ config: null })
    const admin = crearAdminMock(estado) as never

    const res = await resolverPlantillaAviso(admin, EMPRESA_ID, 'llegada')

    expect(res).toBeNull()
  })

  it('selecciona el campo correcto según el tipo', async () => {
    const estado = estadoBase({ config: { plantilla_aviso_llegada_id: null } })
    const admin = crearAdminMock(estado) as never

    await resolverPlantillaAviso(admin, EMPRESA_ID, 'llegada')
    expect(estado.campoConfigPedido).toContain('plantilla_aviso_llegada_id')

    const estado2 = estadoBase({ config: { plantilla_aviso_en_camino_id: null } })
    const admin2 = crearAdminMock(estado2) as never
    await resolverPlantillaAviso(admin2, EMPRESA_ID, 'en_camino')
    expect(estado2.campoConfigPedido).toContain('plantilla_aviso_en_camino_id')
  })

  it('mantiene `nombreApi` del seed cuando la plantilla configurada tiene nombre_api null', async () => {
    const plantillaSinNombre: PlantillaSimulada = {
      id: 'p-1',
      nombre_api: null as unknown as string, // simula columna null
      estado_meta: 'APPROVED',
      componentes: {},
    }

    const estado = estadoBase({
      config: { plantilla_aviso_en_camino_id: 'p-1' },
      plantillasPorId: new Map([['p-1', plantillaSinNombre]]),
    })

    const admin = crearAdminMock(estado) as never

    const res = await resolverPlantillaAviso(admin, EMPRESA_ID, 'en_camino')

    expect(res).not.toBeNull()
    expect(res!.nombreApi).toBe('aviso_en_camino_default')
  })
})

describe('nombreApiDefault', () => {
  it('devuelve aviso_llegada_default y aviso_en_camino_default', () => {
    expect(nombreApiDefault('llegada')).toBe('aviso_llegada_default')
    expect(nombreApiDefault('en_camino')).toBe('aviso_en_camino_default')
  })
})

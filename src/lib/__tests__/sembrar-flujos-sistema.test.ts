/**
 * Tests del helper `sembrarFlujosSistema` (sub-PR 20.5, commit 6).
 *
 * Cubre:
 *   1. Inserta los 4 flujos del catálogo con clave_sistema correctos.
 *   2. Idempotencia: si todos ya existían, devuelve insertados=0 +
 *      ya_existian=4, sin marcar error.
 *   3. Multi-tenant: cada upsert lleva el empresa_id indicado (NO
 *      siembra para otras empresas).
 *   4. Manejo parcial de error: si un upsert falla, los demás siguen
 *      y el resultado reporta `ok: false` con el detalle del error.
 *
 * Mock encadenable de SupabaseClient siguiendo el patrón de
 * `aplicar-transicion.test.ts`. NO toca BD real — verifica que el
 * helper arme las llamadas correctamente.
 */

import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sembrarFlujosSistema } from '../workflows/sembrar-flujos-sistema'
import { FLUJOS_SISTEMA } from '../workflows/flujos-sistema'

interface UpsertCapturado {
  fila: Record<string, unknown>
  opciones: { onConflict: string; ignoreDuplicates: boolean }
}

interface MockSeedState {
  capturados: UpsertCapturado[]
  /** Por clave_sistema: define qué devuelve la cadena upsert→select. */
  respuestaPorClave: Record<
    string,
    { data: Array<{ id: string }> | null; error: { message: string; code?: string } | null }
  >
}

function crearAdminSeedMock(estado: MockSeedState): SupabaseClient {
  const builder = {
    upsert: vi.fn((fila: Record<string, unknown>, opciones: UpsertCapturado['opciones']) => {
      estado.capturados.push({ fila, opciones })
      const clave = fila.clave_sistema as string
      const respuesta = estado.respuestaPorClave[clave] ?? {
        data: [{ id: `id-${clave}` }],
        error: null,
      }
      return {
        select: vi.fn(() => Promise.resolve(respuesta)),
      }
    }),
  }
  return {
    from: vi.fn((_tabla: string) => builder),
  } as unknown as SupabaseClient
}

describe('sembrarFlujosSistema', () => {
  it('inserta los 4 flujos del catálogo con sus clave_sistema correctas', async () => {
    const estado: MockSeedState = { capturados: [], respuestaPorClave: {} }
    const admin = crearAdminSeedMock(estado)

    const resultado = await sembrarFlujosSistema(admin, 'empresa-A')

    expect(resultado.ok).toBe(true)
    expect(resultado.insertados).toBe(FLUJOS_SISTEMA.length)
    expect(resultado.ya_existian).toBe(0)
    expect(resultado.errores).toEqual([])

    // Cada flujo del catálogo se intentó sembrar exactamente una vez.
    expect(estado.capturados).toHaveLength(FLUJOS_SISTEMA.length)
    const clavesCapturadas = estado.capturados.map((c) => c.fila.clave_sistema as string)
    const clavesEsperadas = FLUJOS_SISTEMA.map((f) => f.clave)
    expect(clavesCapturadas.sort()).toEqual([...clavesEsperadas].sort())
  })

  it('siembra para la empresa indicada y no contamina otras (multi-tenant)', async () => {
    const estado: MockSeedState = { capturados: [], respuestaPorClave: {} }
    const admin = crearAdminSeedMock(estado)

    await sembrarFlujosSistema(admin, 'empresa-X')

    for (const cap of estado.capturados) {
      expect(cap.fila.empresa_id).toBe('empresa-X')
    }
  })

  it('idempotencia: si todos los flujos ya existían (data:[]), insertados=0 + ya_existian=N', async () => {
    const estado: MockSeedState = {
      capturados: [],
      // ignoreDuplicates devuelve [] cuando hay conflict.
      respuestaPorClave: Object.fromEntries(
        FLUJOS_SISTEMA.map((f) => [f.clave, { data: [], error: null }]),
      ),
    }
    const admin = crearAdminSeedMock(estado)

    const resultado = await sembrarFlujosSistema(admin, 'empresa-existente')

    expect(resultado.ok).toBe(true)
    expect(resultado.insertados).toBe(0)
    expect(resultado.ya_existian).toBe(FLUJOS_SISTEMA.length)
    expect(resultado.errores).toEqual([])
  })

  it('upsert usa onConflict correcto + ignoreDuplicates=true', async () => {
    const estado: MockSeedState = { capturados: [], respuestaPorClave: {} }
    const admin = crearAdminSeedMock(estado)

    await sembrarFlujosSistema(admin, 'empresa-A')

    for (const cap of estado.capturados) {
      expect(cap.opciones.onConflict).toBe('empresa_id,clave_sistema')
      expect(cap.opciones.ignoreDuplicates).toBe(true)
    }
  })

  it('manejo parcial de error: si un flujo falla, los demás siguen y se reporta ok=false con detalle', async () => {
    const claveQueFalla = FLUJOS_SISTEMA[0].clave
    const estado: MockSeedState = {
      capturados: [],
      respuestaPorClave: {
        [claveQueFalla]: {
          data: null,
          error: { message: 'falla forzada', code: 'P0001' },
        },
      },
    }
    const admin = crearAdminSeedMock(estado)

    const resultado = await sembrarFlujosSistema(admin, 'empresa-A')

    expect(resultado.ok).toBe(false)
    expect(resultado.errores).toHaveLength(1)
    expect(resultado.errores[0]).toEqual({
      clave: claveQueFalla,
      mensaje: 'falla forzada',
      codigo: 'P0001',
    })
    // Los otros 3 se sembraron exitosamente.
    expect(resultado.insertados).toBe(FLUJOS_SISTEMA.length - 1)
  })

  it('todos los flujos sembrados van con estado=activo (catálogo unificado del commit 6)', async () => {
    const estado: MockSeedState = { capturados: [], respuestaPorClave: {} }
    const admin = crearAdminSeedMock(estado)

    await sembrarFlujosSistema(admin, 'empresa-A')

    for (const cap of estado.capturados) {
      expect(cap.fila.estado, `Flujo ${cap.fila.clave_sistema}`).toBe('activo')
    }
  })
})

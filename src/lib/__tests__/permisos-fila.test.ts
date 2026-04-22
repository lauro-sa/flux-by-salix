/**
 * Tests de la lógica pura de `calcularPermisosFila` (lib/permisos-fila.ts).
 * El hook `usePermisosFila` es un thin wrapper sobre esta función.
 *
 * Casos:
 *  - ownership en distintas formas (creador, asignado único, asignados_ids,
 *    asignados[], responsables[]).
 *  - gestor global (admin/propietario) bypass.
 *  - acciones que exigen ownership (completar) vs las que no (editar,
 *    eliminar, enviar, asignar).
 */

import { describe, it, expect } from 'vitest'
import { calcularPermisosFila } from '../permisos-fila'
import type { Modulo, Accion } from '@/tipos'

/** Mock simple: devuelve true si (modulo, accion) está en el set permitido. */
function hacerTienePermiso(permitidos: Array<[Modulo, Accion]>) {
  const set = new Set(permitidos.map(([m, a]) => `${m}:${a}`))
  return (m: Modulo, a: Accion) => set.has(`${m}:${a}`)
}

const USUARIO = 'user-1'
const OTRO = 'user-2'

describe('calcularPermisosFila — ownership', () => {
  it('es creador → tiene ownership', () => {
    const tp = hacerTienePermiso([['actividades', 'editar'], ['actividades', 'completar']])
    const r = calcularPermisosFila(
      'actividades',
      { creado_por: USUARIO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(true)
    expect(r.puedeEditar).toBe(true)
    expect(r.puedeCompletar).toBe(true)
  })

  it('está en asignados_ids → ownership', () => {
    const tp = hacerTienePermiso([['actividades', 'completar']])
    const r = calcularPermisosFila(
      'actividades',
      { creado_por: OTRO, asignados_ids: [USUARIO] },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(true)
    expect(r.puedeCompletar).toBe(true)
  })

  it('asignado_a único → ownership', () => {
    const tp = hacerTienePermiso([['visitas', 'completar']])
    const r = calcularPermisosFila(
      'visitas',
      { creado_por: OTRO, asignado_a: USUARIO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(true)
    expect(r.puedeCompletar).toBe(true)
  })

  it('está en asignados[] → ownership (OTs)', () => {
    const tp = hacerTienePermiso([['ordenes_trabajo', 'completar_etapa']])
    const r = calcularPermisosFila(
      'ordenes_trabajo',
      { creado_por: OTRO, asignados: [{ usuario_id: USUARIO }] },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(true)
  })

  it('está en responsables[] → ownership (contactos)', () => {
    const tp = hacerTienePermiso([['contactos', 'editar']])
    const r = calcularPermisosFila(
      'contactos',
      { creado_por: OTRO, responsables: [{ usuario_id: USUARIO }] },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(true)
    expect(r.puedeEditar).toBe(true)
  })

  it('ajeno → sin ownership; completar exige ownership', () => {
    const tp = hacerTienePermiso([['actividades', 'completar']])
    const r = calcularPermisosFila(
      'actividades',
      { creado_por: OTRO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.tieneOwnership).toBe(false)
    expect(r.puedeCompletar).toBe(false)
  })
})

describe('calcularPermisosFila — gestor global', () => {
  it('admin siempre completa aunque no sea creador/asignado', () => {
    const tp = hacerTienePermiso([['actividades', 'completar']])
    const r = calcularPermisosFila(
      'actividades',
      { creado_por: OTRO },
      USUARIO,
      tp,
      { esAdmin: true, esPropietario: false },
    )
    expect(r.esGestorGlobal).toBe(true)
    expect(r.puedeCompletar).toBe(true)
  })

  it('propietario es gestor global aunque no sea admin', () => {
    const tp = hacerTienePermiso([['actividades', 'completar']])
    const r = calcularPermisosFila(
      'actividades',
      { creado_por: OTRO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: true },
    )
    expect(r.esGestorGlobal).toBe(true)
    expect(r.puedeCompletar).toBe(true)
  })
})

describe('calcularPermisosFila — permisos del módulo', () => {
  it('sin permiso editar → puedeEditar=false aunque sea creador', () => {
    const tp = hacerTienePermiso([])
    const r = calcularPermisosFila(
      'contactos',
      { creado_por: USUARIO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.puedeEditar).toBe(false)
  })

  it('sin registro (carga): gestor global aún puede editar si tiene permiso', () => {
    const tp = hacerTienePermiso([['contactos', 'editar']])
    const r = calcularPermisosFila(
      'contactos',
      null,
      USUARIO,
      tp,
      { esAdmin: true, esPropietario: false },
    )
    expect(r.puedeEditar).toBe(true)
  })

  it('sin registro y sin ser gestor → todos los flags false', () => {
    const tp = hacerTienePermiso([['contactos', 'editar']])
    const r = calcularPermisosFila(
      'contactos',
      null,
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    expect(r.puedeEditar).toBe(false)
    expect(r.tieneOwnership).toBe(false)
  })

  it('eliminar NO exige ownership (patrón estándar)', () => {
    const tp = hacerTienePermiso([['contactos', 'eliminar']])
    const r = calcularPermisosFila(
      'contactos',
      { creado_por: OTRO },
      USUARIO,
      tp,
      { esAdmin: false, esPropietario: false },
    )
    // La UI muestra el botón; el servidor rechaza si corresponde.
    expect(r.puedeEliminar).toBe(true)
  })
})

/**
 * Tests de los defaults de permisos para el módulo Flujos (PR 18.1).
 *
 * El módulo arranca con defaults pensados para no encender flujos
 * por accidente: solo administrador (y propietario / superadmin) los
 * pueden activar; gestor mira pero no toca; los demás roles arrancan
 * sin acceso (se asignan via permisos_custom según el caso).
 */

import { describe, expect, it } from 'vitest'
import { resolverPermiso, type ContextoPermisos } from '../permisos-logica'

function ctx(parcial: Partial<ContextoPermisos> = {}): ContextoPermisos {
  return {
    rol: null,
    permisosCustom: null,
    esPropietario: false,
    esSuperadmin: false,
    ...parcial,
  }
}

const ACCIONES_FLUJOS = ['ver_todos', 'ver_propio', 'crear', 'editar', 'eliminar', 'activar'] as const

describe('Permisos de Flujos — propietario y superadmin', () => {
  it('propietario puede todo (incluido activar)', () => {
    const c = ctx({ rol: 'propietario', esPropietario: true })
    for (const a of ACCIONES_FLUJOS) {
      expect(resolverPermiso(c, 'flujos', a)).toBe(true)
    }
  })

  it('superadmin de Salix puede todo en flujos', () => {
    const c = ctx({ esSuperadmin: true })
    for (const a of ACCIONES_FLUJOS) {
      expect(resolverPermiso(c, 'flujos', a)).toBe(true)
    }
  })
})

describe('Permisos de Flujos — administrador', () => {
  it('admin tiene los 5 permisos por default', () => {
    const c = ctx({ rol: 'administrador' })
    expect(resolverPermiso(c, 'flujos', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'crear')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'editar')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'eliminar')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'activar')).toBe(true)
  })

  it('admin con permisos_custom respeta el override completo', () => {
    // Override que le saca activar — el admin puede diseñar pero no encender.
    const c = ctx({
      rol: 'administrador',
      permisosCustom: { flujos: ['ver_todos', 'crear', 'editar'] },
    })
    expect(resolverPermiso(c, 'flujos', 'editar')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'activar')).toBe(false)
    expect(resolverPermiso(c, 'flujos', 'eliminar')).toBe(false)
  })
})

describe('Permisos de Flujos — gestor', () => {
  it('gestor solo tiene ver_todos por default', () => {
    const c = ctx({ rol: 'gestor' })
    expect(resolverPermiso(c, 'flujos', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'crear')).toBe(false)
    expect(resolverPermiso(c, 'flujos', 'editar')).toBe(false)
    expect(resolverPermiso(c, 'flujos', 'eliminar')).toBe(false)
    expect(resolverPermiso(c, 'flujos', 'activar')).toBe(false)
  })
})

describe('Permisos de Flujos — roles sin acceso por default', () => {
  for (const rol of ['vendedor', 'supervisor', 'colaborador', 'invitado'] as const) {
    it(`${rol} no tiene acceso a flujos por default`, () => {
      const c = ctx({ rol })
      for (const a of ACCIONES_FLUJOS) {
        expect(resolverPermiso(c, 'flujos', a)).toBe(false)
      }
    })
  }

  it('un vendedor con permisos_custom puede crear/editar pero no activar', () => {
    // Caso de uso: "diseñador de flujos" sin habilitación operacional.
    const c = ctx({
      rol: 'vendedor',
      permisosCustom: { flujos: ['ver_todos', 'crear', 'editar'] },
    })
    expect(resolverPermiso(c, 'flujos', 'editar')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'crear')).toBe(true)
    expect(resolverPermiso(c, 'flujos', 'activar')).toBe(false)
  })
})

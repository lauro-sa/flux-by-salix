/**
 * Test parametrizado: matriz completa de rol × módulo × acción.
 *
 * Propósito: detectar cambios accidentales en los defaults de `PERMISOS_POR_ROL`.
 * Cualquier PR que agregue/quite un permiso por defecto rompe este test,
 * obligando a una revisión consciente (y, si el cambio es intencional, un
 * update del snapshot).
 *
 * Cómo regenerar: `npx vitest run -u`
 */

import { describe, it, expect } from 'vitest'
import { resolverPermiso } from '../permisos-logica'
import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '../permisos-constantes'
import { ACCIONES_POR_MODULO } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'
import type { Modulo, Accion } from '@/tipos/permisos'

const ROLES: Rol[] = [
  'propietario',
  'administrador',
  'gestor',
  'vendedor',
  'supervisor',
  'colaborador',
  'invitado',
]

function esPropietario(rol: Rol): boolean {
  return rol === 'propietario'
}

describe('matriz rol × módulo × acción — defaults estáticos', () => {
  // Genera un snapshot determinístico con el resultado para cada combinación.
  // Si alguien cambia PERMISOS_POR_ROL o la lógica de resolverPermiso, el
  // snapshot difiere y el test falla.
  it('coincide con el snapshot (regenerar con -u si el cambio es intencional)', () => {
    const matriz: Record<Rol, Record<string, boolean>> = {
      propietario: {},
      administrador: {},
      gestor: {},
      vendedor: {},
      supervisor: {},
      colaborador: {},
      invitado: {},
    }

    const modulos = Object.keys(ACCIONES_POR_MODULO) as Modulo[]
    for (const rol of ROLES) {
      for (const modulo of modulos) {
        const acciones = ACCIONES_POR_MODULO[modulo]
        for (const accion of acciones) {
          const clave = `${modulo}:${accion}`
          matriz[rol][clave] = resolverPermiso(
            {
              rol,
              permisosCustom: null,
              esPropietario: esPropietario(rol),
              esSuperadmin: false,
            },
            modulo,
            accion,
          )
        }
      }
    }

    expect(matriz).toMatchSnapshot()
  })

  it('propietario puede todo en todos los módulos y acciones', () => {
    const modulos = Object.keys(ACCIONES_POR_MODULO) as Modulo[]
    for (const modulo of modulos) {
      for (const accion of ACCIONES_POR_MODULO[modulo]) {
        const puede = resolverPermiso(
          { rol: 'propietario', permisosCustom: null, esPropietario: true, esSuperadmin: false },
          modulo,
          accion,
        )
        expect(puede, `propietario debería poder ${modulo}:${accion}`).toBe(true)
      }
    }
  })

  it('superadmin interno bypassa RESTRICCIONES_ADMIN', () => {
    // Un superadmin de Salix puede incluso eliminar config_empresa (restricción
    // de admin regular) porque el bypass es previo a toda otra evaluación.
    const puede = resolverPermiso(
      { rol: 'administrador', permisosCustom: null, esPropietario: false, esSuperadmin: true },
      'config_empresa',
      'eliminar',
    )
    expect(puede).toBe(true)
  })

  it('invitado sin custom: 0 permisos en todos los módulos', () => {
    const modulos = Object.keys(ACCIONES_POR_MODULO) as Modulo[]
    for (const modulo of modulos) {
      for (const accion of ACCIONES_POR_MODULO[modulo]) {
        const puede = resolverPermiso(
          { rol: 'invitado', permisosCustom: null, esPropietario: false, esSuperadmin: false },
          modulo,
          accion,
        )
        expect(puede, `invitado NO debería poder ${modulo}:${accion}`).toBe(false)
      }
    }
  })

  it('todo rol operacional tiene al menos un "ver" en algún módulo', () => {
    // Sanity check: no existe un rol default (salvo invitado) que salga con
    // pantalla SinPermiso en todos lados.
    const rolesOperacionales: Rol[] = ['administrador', 'gestor', 'vendedor', 'supervisor', 'colaborador']
    for (const rol of rolesOperacionales) {
      const permisos = PERMISOS_POR_ROL[rol]
      const tieneAlgunVer = Object.values(permisos).some(acciones =>
        (acciones || []).some(a => a === 'ver_propio' || a === 'ver_todos' || a === 'ver'),
      )
      expect(tieneAlgunVer, `rol ${rol} debería tener al menos un permiso de "ver"`).toBe(true)
    }
  })

  it('RESTRICCIONES_ADMIN contiene solo acciones válidas', () => {
    // Si alguien agrega una restricción mal escrita, la lógica la ignoraría.
    for (const [modulo, accionesRestringidas] of Object.entries(RESTRICCIONES_ADMIN)) {
      const accionesValidas = ACCIONES_POR_MODULO[modulo as Modulo]
      for (const accion of accionesRestringidas as Accion[]) {
        expect(
          accionesValidas.includes(accion),
          `RESTRICCIONES_ADMIN.${modulo} menciona ${accion} pero el módulo no la define`,
        ).toBe(true)
      }
    }
  })
})

describe('matriz — coherencia entre PERMISOS_POR_ROL y ACCIONES_POR_MODULO', () => {
  it('ningún default de rol referencia acciones no declaradas en ACCIONES_POR_MODULO', () => {
    for (const [rol, mapa] of Object.entries(PERMISOS_POR_ROL)) {
      for (const [modulo, acciones] of Object.entries(mapa)) {
        const accionesValidas = ACCIONES_POR_MODULO[modulo as Modulo]
        expect(accionesValidas, `módulo ${modulo} no declarado en ACCIONES_POR_MODULO`).toBeDefined()
        for (const accion of acciones || []) {
          expect(
            accionesValidas.includes(accion),
            `rol ${rol} tiene ${modulo}:${accion} pero el módulo no define esa acción`,
          ).toBe(true)
        }
      }
    }
  })
})

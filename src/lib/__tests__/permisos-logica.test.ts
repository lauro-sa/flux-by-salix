/**
 * Tests de la lógica de permisos.
 * Al ser la fuente única que usan tanto el cliente (useRol) como el servidor
 * (verificarPermiso), estos tests garantizan que ambos lados se comporten igual.
 */

import { describe, it, expect } from 'vitest'
import { resolverPermiso, type ContextoPermisos } from '../permisos-logica'

// Factory de contexto con defaults razonables para que los tests sean legibles.
function ctx(parcial: Partial<ContextoPermisos> = {}): ContextoPermisos {
  return {
    rol: null,
    permisosCustom: null,
    esPropietario: false,
    esSuperadmin: false,
    ...parcial,
  }
}

describe('resolverPermiso — bypass', () => {
  it('superadmin de Salix tiene acceso total', () => {
    const c = ctx({ esSuperadmin: true })
    expect(resolverPermiso(c, 'contactos', 'eliminar')).toBe(true)
    expect(resolverPermiso(c, 'config_empresa', 'eliminar')).toBe(true)
    expect(resolverPermiso(c, 'auditoria', 'ver')).toBe(true)
  })

  it('propietario tiene acceso total, incluso a acciones destructivas', () => {
    const c = ctx({ rol: 'propietario', esPropietario: true })
    expect(resolverPermiso(c, 'config_empresa', 'eliminar')).toBe(true)
    expect(resolverPermiso(c, 'usuarios', 'eliminar')).toBe(true)
  })

  it('sin rol → sin permisos', () => {
    const c = ctx()
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(false)
  })
})

describe('resolverPermiso — administrador', () => {
  it('admin sin permisos_custom usa defaults del rol', () => {
    const c = ctx({ rol: 'administrador' })
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'usuarios', 'invitar')).toBe(true)
    expect(resolverPermiso(c, 'config_empresa', 'editar')).toBe(true)
  })

  it('admin con permisos_custom usa SOLO los custom (override total)', () => {
    const c = ctx({
      rol: 'administrador',
      permisosCustom: { contactos: ['ver_propio'] },
    })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(false)
    // Este es el bug que arreglamos: antes admin ignoraba custom y seguía teniendo todo.
    expect(resolverPermiso(c, 'usuarios', 'invitar')).toBe(false)
    expect(resolverPermiso(c, 'config_empresa', 'editar')).toBe(false)
  })

  it('admin no puede ejecutar acciones bloqueadas por RESTRICCIONES_ADMIN', () => {
    // config_empresa:eliminar está restringido al propietario.
    const c = ctx({ rol: 'administrador' })
    expect(resolverPermiso(c, 'config_empresa', 'eliminar')).toBe(false)
  })

  it('restricción admin gana sobre permisos_custom explícitos', () => {
    const c = ctx({
      rol: 'administrador',
      permisosCustom: { config_empresa: ['eliminar', 'editar'] },
    })
    expect(resolverPermiso(c, 'config_empresa', 'eliminar')).toBe(false)
    expect(resolverPermiso(c, 'config_empresa', 'editar')).toBe(true)
  })
})

describe('resolverPermiso — roles operacionales', () => {
  it('vendedor ve solo lo propio en contactos', () => {
    const c = ctx({ rol: 'vendedor' })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(false)
    expect(resolverPermiso(c, 'contactos', 'eliminar')).toBe(false)
  })

  it('gestor ve todos los contactos y puede eliminar', () => {
    const c = ctx({ rol: 'gestor' })
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'eliminar')).toBe(true)
  })

  it('supervisor ve todo sin permisos de edición fuerte', () => {
    const c = ctx({ rol: 'supervisor' })
    expect(resolverPermiso(c, 'asistencias', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'eliminar')).toBe(false)
  })

  it('empleado tiene acceso mínimo (solo asistencias/calendario/interno propios)', () => {
    const c = ctx({ rol: 'empleado' })
    expect(resolverPermiso(c, 'asistencias', 'ver_propio')).toBe(true)
    expect(resolverPermiso(c, 'asistencias', 'marcar')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(false)
    expect(resolverPermiso(c, 'usuarios', 'ver')).toBe(false)
  })

  it('invitado sin permisos_custom no tiene acceso a nada', () => {
    const c = ctx({ rol: 'invitado' })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(false)
    expect(resolverPermiso(c, 'asistencias', 'ver_propio')).toBe(false)
  })

  it('invitado con permisos_custom usa exactamente esos', () => {
    const c = ctx({
      rol: 'invitado',
      permisosCustom: { contactos: ['ver_propio'] },
    })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'editar')).toBe(false)
    expect(resolverPermiso(c, 'actividades', 'ver_propio')).toBe(false)
  })
})

describe('resolverPermiso — permisos_custom override', () => {
  it('custom que restringe por debajo del rol gana', () => {
    // Un gestor al que se le quitó "eliminar" en contactos.
    const c = ctx({
      rol: 'gestor',
      permisosCustom: { contactos: ['ver_todos', 'crear', 'editar'] },
    })
    expect(resolverPermiso(c, 'contactos', 'ver_todos')).toBe(true)
    expect(resolverPermiso(c, 'contactos', 'eliminar')).toBe(false)
  })

  it('custom que da acceso fuera del rol default gana', () => {
    // Un empleado al que se le dio acceso a ver contactos propios.
    const c = ctx({
      rol: 'empleado',
      permisosCustom: { contactos: ['ver_propio'], asistencias: ['ver_propio', 'marcar'] },
    })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(true)
    expect(resolverPermiso(c, 'asistencias', 'marcar')).toBe(true)
  })

  it('custom con módulo vacío significa sin acceso a ese módulo', () => {
    const c = ctx({
      rol: 'vendedor',
      permisosCustom: { contactos: [] },
    })
    expect(resolverPermiso(c, 'contactos', 'ver_propio')).toBe(false)
  })
})

describe('resolverPermiso — casos de bug histórico', () => {
  it('caso real: deshabilitar config_empresa a un admin oculta el engranaje', () => {
    // Escenario que el usuario reportó: admin con permisos_custom sin config_empresa.
    const c = ctx({
      rol: 'administrador',
      permisosCustom: { contactos: ['ver_todos'] },
    })
    expect(resolverPermiso(c, 'config_empresa', 'ver')).toBe(false)
  })

  it('caso real: superadmin bypasa incluso cuando el rol es invitado', () => {
    const c = ctx({ rol: 'invitado', esSuperadmin: true })
    expect(resolverPermiso(c, 'config_empresa', 'editar')).toBe(true)
  })
})

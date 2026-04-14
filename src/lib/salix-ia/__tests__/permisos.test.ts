/**
 * Tests del filtrado de herramientas por permisos de Salix IA.
 * Verifica que cada rol solo accede a las herramientas que le corresponden.
 */

import { describe, it, expect, vi } from 'vitest'
import { filtrarHerramientasPermitidas, determinarVisibilidad } from '../permisos'
import { HERRAMIENTAS_SALIX_IA } from '../herramientas/definiciones'
import type { ConfigSalixIA, MiembroSalixIA } from '@/tipos/salix-ia'

// Mock de verificarPermiso
vi.mock('@/lib/permisos-servidor', () => ({
  verificarPermiso: (miembro: { rol: string; permisos_custom: Record<string, string[]> | null }, modulo: string, accion: string) => {
    const { rol, permisos_custom } = miembro

    // Propietario tiene acceso total
    if (rol === 'propietario') return true

    // Administrador: acceso a todo excepto config_*
    if (rol === 'administrador') {
      return !modulo.startsWith('config_')
    }

    // Permisos custom tienen prioridad
    if (permisos_custom) {
      const acciones = permisos_custom[modulo]
      return acciones?.includes(accion) ?? false
    }

    // Vendedor: contactos, actividades, visitas, calendario, presupuestos, NO asistencias
    if (rol === 'vendedor') {
      const modulosVendedor: Record<string, string[]> = {
        contactos: ['ver_propio', 'crear', 'editar'],
        actividades: ['ver_propio', 'crear', 'editar'],
        visitas: ['ver_propio', 'crear', 'editar'],
        calendario: ['ver_propio', 'crear', 'editar'],
        presupuestos: ['ver_propio', 'crear', 'editar'],
      }
      return modulosVendedor[modulo]?.includes(accion) ?? false
    }

    // Empleado: solo ver_propio en módulos básicos
    if (rol === 'empleado') {
      const modulosEmpleado: Record<string, string[]> = {
        actividades: ['ver_propio'],
        calendario: ['ver_propio'],
        asistencias: ['ver_propio'],
      }
      return modulosEmpleado[modulo]?.includes(accion) ?? false
    }

    return false
  },
}))

const configCompleta: ConfigSalixIA = {
  empresa_id: 'test-empresa',
  habilitado: true,
  nombre: 'Salix IA',
  personalidad: '',
  herramientas_habilitadas: [
    'buscar_contactos', 'obtener_contacto', 'crear_contacto',
    'crear_actividad', 'crear_recordatorio', 'crear_visita',
    'consultar_asistencias', 'consultar_calendario',
    'consultar_actividades', 'consultar_visitas',
    'buscar_presupuestos',
    'modificar_actividad', 'modificar_visita',
    'modificar_presupuesto', 'modificar_evento',
  ],
  whatsapp_copilot_habilitado: false,
  max_iteraciones_herramientas: 5,
  creado_en: '',
  actualizado_en: '',
}

const crearMiembro = (rol: string, permisos_custom: Record<string, string[]> | null = null): MiembroSalixIA => ({
  id: 'test-miembro',
  usuario_id: 'test-usuario',
  rol,
  permisos_custom,
  salix_ia_habilitado: true,
  puesto_nombre: null,
  sector: null,
})

describe('filtrarHerramientasPermitidas', () => {
  it('propietario accede a todas las herramientas', () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('propietario'),
      configCompleta
    )
    expect(resultado).toHaveLength(HERRAMIENTAS_SALIX_IA.length)
  })

  it('administrador accede a todas las herramientas', () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('administrador'),
      configCompleta
    )
    expect(resultado).toHaveLength(HERRAMIENTAS_SALIX_IA.length)
  })

  it('vendedor NO accede a consultar_asistencias', () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('vendedor'),
      configCompleta
    )
    const nombres = resultado.map((h) => h.nombre)
    expect(nombres).not.toContain('consultar_asistencias')
    expect(nombres).toContain('buscar_contactos')
    expect(nombres).toContain('crear_actividad')
    expect(nombres).toContain('crear_visita')
  })

  it('empleado solo accede a herramientas de consulta limitadas', () => {
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('empleado'),
      configCompleta
    )
    const nombres = resultado.map((h) => h.nombre)
    expect(nombres).toContain('consultar_actividades')
    expect(nombres).toContain('consultar_calendario')
    expect(nombres).toContain('consultar_asistencias')
    expect(nombres).not.toContain('crear_contacto')
    expect(nombres).not.toContain('crear_visita')
  })

  it('permisos custom sobrescriben los del rol', () => {
    const miembro = crearMiembro('empleado', {
      contactos: ['ver_todos', 'crear'],
      actividades: ['ver_todos', 'crear'],
    })
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      miembro,
      configCompleta
    )
    const nombres = resultado.map((h) => h.nombre)
    expect(nombres).toContain('buscar_contactos')
    expect(nombres).toContain('crear_contacto')
    expect(nombres).toContain('crear_actividad')
  })

  it('herramientas deshabilitadas en config de empresa no aparecen', () => {
    const configLimitada: ConfigSalixIA = {
      ...configCompleta,
      herramientas_habilitadas: ['buscar_contactos', 'consultar_calendario'],
    }
    const resultado = filtrarHerramientasPermitidas(
      HERRAMIENTAS_SALIX_IA,
      crearMiembro('propietario'),
      configLimitada
    )
    expect(resultado).toHaveLength(2)
    expect(resultado.map((h) => h.nombre)).toEqual(['buscar_contactos', 'consultar_calendario'])
  })
})

describe('determinarVisibilidad', () => {
  it('propietario tiene visibilidad "todos"', () => {
    expect(determinarVisibilidad(crearMiembro('propietario'), 'contactos')).toBe('todos')
  })

  it('vendedor tiene visibilidad "propio" en contactos', () => {
    expect(determinarVisibilidad(crearMiembro('vendedor'), 'contactos')).toBe('propio')
  })

  it('empleado sin permiso de contactos retorna null', () => {
    expect(determinarVisibilidad(crearMiembro('empleado'), 'contactos')).toBeNull()
  })

  it('empleado ve sus propias asistencias', () => {
    expect(determinarVisibilidad(crearMiembro('empleado'), 'asistencias')).toBe('propio')
  })
})

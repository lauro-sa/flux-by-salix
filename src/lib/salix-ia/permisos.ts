/**
 * Filtrado de herramientas de Salix IA por permisos del usuario.
 * Solo permite usar herramientas que el usuario tiene derecho a usar
 * según su rol, permisos custom y la configuración de la empresa.
 */

import { verificarPermiso } from '@/lib/permisos-servidor'
import type { DefinicionHerramienta, ConfigSalixIA, MiembroSalixIA, NombreHerramienta } from '@/tipos/salix-ia'
import type { Rol } from '@/tipos/miembro'

interface DatosMiembroPermiso {
  rol: Rol
  permisos_custom: Record<string, string[]> | null
}

/**
 * Filtra las herramientas disponibles según:
 * 1. Herramientas habilitadas en la config de la empresa
 * 2. Permisos del usuario para el módulo de cada herramienta
 */
export function filtrarHerramientasPermitidas(
  herramientas: DefinicionHerramienta[],
  miembro: MiembroSalixIA,
  config: ConfigSalixIA
): DefinicionHerramienta[] {
  const habilitadas = new Set<NombreHerramienta>(config.herramientas_habilitadas)

  const datosMiembro: DatosMiembroPermiso = {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom,
  }

  return herramientas.filter((h) => {
    // La empresa debe tener habilitada esta herramienta
    if (!habilitadas.has(h.nombre)) return false

    // El usuario debe tener permiso para la acción requerida
    // Para herramientas de consulta, verificar ver_propio o ver_todos
    if (h.soporta_visibilidad) {
      const verTodos = verificarPermiso(datosMiembro, h.modulo, 'ver_todos')
      const verPropio = verificarPermiso(datosMiembro, h.modulo, 'ver_propio')
      return verTodos || verPropio
    }

    // Para herramientas de creación, verificar la acción específica
    return verificarPermiso(datosMiembro, h.modulo, h.accion_requerida)
  })
}

/**
 * Determina si el usuario puede ver todos los registros o solo los propios.
 * Retorna 'todos' si tiene ver_todos, 'propio' si solo ver_propio, null si no tiene acceso.
 */
export function determinarVisibilidad(
  miembro: MiembroSalixIA,
  modulo: DefinicionHerramienta['modulo']
): 'todos' | 'propio' | null {
  const datosMiembro: DatosMiembroPermiso = {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom,
  }

  if (verificarPermiso(datosMiembro, modulo, 'ver_todos')) return 'todos'
  if (verificarPermiso(datosMiembro, modulo, 'ver_propio')) return 'propio'
  return null
}

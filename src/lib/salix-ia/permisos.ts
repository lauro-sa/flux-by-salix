/**
 * Filtrado de herramientas de Salix IA por nivel de acceso del miembro y permisos.
 *
 * El nivel_salix decide qué categorías de tools se exponen al modelo:
 *  - 'ninguno'  → array vacío (el endpoint debería cortar antes, pero también filtramos acá)
 *  - 'personal' → solo tools con categoria='personal'
 *  - 'completo' → tools de gestión (filtradas por rol/permiso) + tools personales
 *
 * Las tools personales no chequean permisos de rol porque siempre operan sobre
 * los datos del propio empleado (todos los roles, incluso 'invitado', pueden
 * consultar sus propios recibos y asistencia).
 */

import { verificarPermiso } from '@/lib/permisos-servidor'
import type { DefinicionHerramienta, ConfigSalixIA, MiembroSalixIA, NombreHerramienta } from '@/tipos/salix-ia'
import type { Rol } from '@/tipos/miembro'

interface DatosMiembroPermiso {
  rol: Rol
  permisos_custom: Record<string, string[]> | null
}

/**
 * Filtra las herramientas disponibles según el nivel_salix del miembro y
 * la configuración de la empresa.
 */
export function filtrarHerramientasPermitidas(
  herramientas: DefinicionHerramienta[],
  miembro: MiembroSalixIA,
  config: ConfigSalixIA
): DefinicionHerramienta[] {
  // Nivel 'ninguno': el modelo no recibe ninguna tool. El endpoint debe cortar
  // antes con 403, pero por defensa en profundidad acá también devolvemos vacío.
  if (miembro.nivel_salix === 'ninguno') return []

  const habilitadas = new Set<NombreHerramienta>(config.herramientas_habilitadas)

  const datosMiembro: DatosMiembroPermiso = {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom,
  }

  return herramientas.filter((h) => {
    // La empresa debe tener habilitada esta herramienta
    if (!habilitadas.has(h.nombre)) return false

    const esPersonal = h.categoria === 'personal'

    // Nivel 'personal': solo tools personales, sin chequeo de rol.
    if (miembro.nivel_salix === 'personal') return esPersonal

    // Nivel 'completo': tools personales pasan directo (son sobre uno mismo);
    // las de gestión se filtran por permiso de rol como hasta ahora.
    if (esPersonal) return true

    if (h.soporta_visibilidad) {
      const verTodos = verificarPermiso(datosMiembro, h.modulo, 'ver_todos')
      const verPropio = verificarPermiso(datosMiembro, h.modulo, 'ver_propio')
      return verTodos || verPropio
    }
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

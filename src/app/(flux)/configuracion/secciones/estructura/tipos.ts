/**
 * Tipos y utilidades puras del módulo de estructura organizacional.
 * Se usan desde SeccionEstructura, NodoSector y TabHorarios.
 */

export interface Sector {
  id: string
  nombre: string
  color: string
  icono: string
  activo: boolean
  orden: number
  padre_id: string | null
  jefe_id: string | null
  es_predefinido: boolean
}

/** Sector enriquecido con sus hijos ya resueltos (árbol recursivo). */
export interface SectorConHijos extends Sector {
  hijos: SectorConHijos[]
}

export interface Horario {
  id: string
  sector_id: string | null
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

export interface Puesto {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  activo: boolean
  orden: number
  sector_ids: string[]
}

export interface MiembroSimple {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
}

export interface AsignacionMiembroSector {
  sector_id: string
  miembro_id: string
}

/** Construye el árbol jerárquico a partir de la lista plana de sectores. */
export function construirArbol(sectores: Sector[], padreId: string | null = null): SectorConHijos[] {
  return sectores
    .filter(s => s.padre_id === padreId)
    .sort((a, b) => a.orden - b.orden)
    .map(s => ({
      ...s,
      hijos: construirArbol(sectores, s.id),
    }))
}

/** Obtiene todos los IDs descendientes de un sector (para prevenir referencias circulares). */
export function obtenerDescendientes(sectores: Sector[], sectorId: string): Set<string> {
  const descendientes = new Set<string>()
  const buscar = (id: string) => {
    sectores.filter(s => s.padre_id === id).forEach(s => {
      descendientes.add(s.id)
      buscar(s.id)
    })
  }
  buscar(sectorId)
  return descendientes
}

/** Cuenta cuántos miembros tiene cada sector. */
export function contarMiembrosPorSector(asignaciones: AsignacionMiembroSector[]): Map<string, number> {
  const conteo = new Map<string, number>()
  asignaciones.forEach(a => {
    conteo.set(a.sector_id, (conteo.get(a.sector_id) || 0) + 1)
  })
  return conteo
}

/** Obtiene los miembros asignados a un sector específico. */
export function obtenerMiembrosDeSector(
  sectorId: string,
  asignaciones: AsignacionMiembroSector[],
  miembros: MiembroSimple[],
): MiembroSimple[] {
  const miembroIds = new Set(asignaciones.filter(a => a.sector_id === sectorId).map(a => a.miembro_id))
  return miembros.filter(m => miembroIds.has(m.id))
}

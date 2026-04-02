import type { ReactNode } from 'react'

/* ─── Tipos públicos ─── */

export type TipoFiltro = 'seleccion' | 'multiple' | 'fecha'

export interface Filtro {
  id: string
  etiqueta: string
  icono?: ReactNode
  tipo: TipoFiltro
  valor: string | string[]
  onChange: (valor: string | string[]) => void
  opciones?: { valor: string; etiqueta: string }[]
}

export interface PillGrupo {
  id: string
  etiqueta: string
  opciones: { id: string; etiqueta: string; icono?: ReactNode; conteo?: number }[]
  activo: string
  onChange: (id: string) => void
}

export interface Plantilla {
  id: string
  nombre: string
  predefinida: boolean
}

export interface OpcionVista {
  id: string
  icono: ReactNode
  etiqueta: string
  deshabilitada?: boolean
}

export interface PropiedadesBarraBusqueda {
  /* Busqueda */
  busqueda: string
  onBusqueda: (texto: string) => void
  placeholder?: string
  contadorResultados?: number

  /* Filtros */
  filtros?: Filtro[]
  onLimpiarFiltros?: () => void

  /* Pills principales */
  pillsGrupos?: PillGrupo[]

  /* Vistas guardadas (favoritos) */
  plantillas?: Plantilla[]
  plantillaActivaId?: string
  onAplicarPlantilla?: (id: string) => void
  onGuardarNuevaPlantilla?: (nombre: string) => void
  onSobrescribirPlantilla?: (id: string) => void
  onEliminarPlantilla?: (id: string) => void

  /* Vistas (lista/tarjetas/kanban) */
  vistaActual?: string
  opcionesVista?: OpcionVista[]
  onCambiarVista?: (id: string) => void

  /* Columnas */
  mostrarBotonColumnas?: boolean
  onAbrirColumnas?: () => void

  className?: string
}

/* ─── Helpers ─── */

/** Cuenta cuantos filtros tienen valor activo */
export function contarFiltrosActivos(filtros: Filtro[]): number {
  return filtros.filter((f) => {
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }).length
}

/** Genera el placeholder dinámico */
export function generarPlaceholder(base: string, contador?: number, filtrosActivos?: number): string {
  if (filtrosActivos && filtrosActivos > 0) return `Buscar en ${filtrosActivos} filtro${filtrosActivos > 1 ? 's' : ''} activo${filtrosActivos > 1 ? 's' : ''}...`
  if (contador !== undefined) return `${base} (${contador.toLocaleString('es')} resultados)`
  return base
}

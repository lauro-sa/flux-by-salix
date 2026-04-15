/**
 * Tipos compartidos del Sidebar de Flux.
 * Usados por todos los sub-componentes del sidebar.
 */

export interface ItemNav {
  id: string
  etiqueta: string
  icono: React.ReactNode
  ruta: string
  badge?: number
  /** Indicador persistente (dot) — hay items pendientes aunque no haya notificaciones */
  indicador?: boolean
  fijo?: boolean
  seccion: 'principal' | 'documentos' | 'admin' | 'otros'
  /** Modulo del sistema de permisos — si no tiene, siempre visible */
  modulo?: string
  /** Slug del catalogo de modulos — para filtrar por modulos instalados */
  moduloCatalogo?: string
}

export interface PropiedadesSidebar {
  colapsado: boolean
  onToggle: () => void
  mobilAbierto: boolean
  onCerrarMobil: () => void
  /** Modo auto-ocultar activo (sidebar colapsado, se expande al hover) */
  autoOcultar?: boolean
  /** Sidebar expandido temporalmente por hover en modo auto-ocultar */
  hoverExpandido?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

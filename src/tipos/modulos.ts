/**
 * Tipos para el sistema de módulos instalables de Flux.
 * Se usa en: useModulos, página /aplicaciones, Sidebar, middleware.
 */

/** Categorías de módulos en el catálogo */
export type CategoriaModulo = 'base' | 'operacional' | 'documentos' | 'comunicacion' | 'admin' | 'premium' | 'proximamente'

/** Tiers de precio */
export type TierModulo = 'free' | 'starter' | 'pro' | 'enterprise'

/** Un módulo del catálogo maestro */
export interface ModuloCatalogo {
  id: string
  slug: string
  nombre: string
  descripcion: string
  icono: string
  categoria: CategoriaModulo
  es_base: boolean
  requiere: string[]
  orden: number
  precio_mensual_usd: number
  precio_anual_usd: number
  tier: TierModulo
  version: string
  destacado: boolean
  visible: boolean
  features: string[]
}

/** Un módulo instalado en una empresa */
export interface ModuloInstalado {
  id: string
  empresa_id: string
  modulo: string // slug del catálogo
  activo: boolean
  activado_en: string | null
  desactivado_en: string | null
  config: Record<string, unknown>
  catalogo_modulo_id: string | null
  instalado_por: string | null
  version: string | null
  purga_programada_en: string | null
  purgado: boolean
}

/** Módulo del catálogo + estado de instalación para la UI */
export interface ModuloConEstado extends ModuloCatalogo {
  instalado: boolean
  activo: boolean
  modulo_empresa_id: string | null // id en modulos_empresa si está instalado
  purga_programada_en: string | null // fecha límite para reinstalar antes de perder datos
  dias_restantes_purga: number | null // días que faltan para la purga (null si no aplica)
}

/** Suscripción de la empresa */
export interface Suscripcion {
  id: string
  empresa_id: string
  plan: TierModulo
  estado: 'activa' | 'trial' | 'vencida' | 'cancelada'
  inicio_en: string
  vence_en: string | null
  trial_hasta: string | null
  limite_usuarios: number | null
  limite_contactos: number | null
  limite_storage_mb: number | null
}

/** Mapeo de slug de módulo → rutas que protege */
export const RUTAS_POR_MODULO: Record<string, string[]> = {
  inbox: ['/inbox'],
  contactos: ['/contactos'],
  actividades: ['/actividades'],
  calendario: ['/calendario'],
  whatsapp: ['/inbox'], // whatsapp se valida dentro del inbox
  visitas: ['/visitas'],
  recorrido: ['/recorrido'],
  productos: ['/productos'],
  presupuestos: ['/presupuestos'],
  informes: ['/informes'],
  ordenes_trabajo: ['/ordenes'],
  asistencias: ['/asistencias'],
  auditoria: ['/auditoria'],
  inteligencia_artificial: [],
  portal_clientes: ['/portal'],
}

/** Mapeo inverso: ruta → slug de módulo requerido */
export const MODULO_POR_RUTA: Record<string, string> = {
  '/visitas': 'visitas',
  '/recorrido': 'recorrido',
  '/productos': 'productos',
  '/presupuestos': 'presupuestos',
  '/informes': 'informes',
  '/ordenes': 'ordenes_trabajo',
  '/asistencias': 'asistencias',
  '/auditoria': 'auditoria',
}
// Nota: las rutas base (/inbox, /contactos, /actividades, /calendario) NO se validan
// porque esos módulos siempre están instalados (es_base = true)

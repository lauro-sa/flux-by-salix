/**
 * Tipo Empresa — representa una empresa/organización en Flux.
 * Se usa en: auth, sidebar, selector de empresa, onboarding, configuración.
 */
export interface Empresa {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
  pais: string | null
  color_marca: string | null
  creado_en: string
  direccion?: Record<string, unknown> | null
  [key: string]: unknown
}

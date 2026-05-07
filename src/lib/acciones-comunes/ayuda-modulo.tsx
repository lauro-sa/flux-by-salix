/**
 * Helper para agregar la acción "Guía de uso" al menú de acciones
 * de cualquier listado que use PlantillaListado.
 *
 * Uso:
 *   import { accionAyudaModulo } from '@/lib/acciones-comunes/ayuda-modulo'
 *
 *   <PlantillaListado
 *     acciones={[
 *       accionAyudaModulo('flujos', t, router),
 *       // ... otras acciones
 *     ]}
 *   />
 *
 * Click → navega a /ayuda/<slug>, que carga docs/COMO_USAR_<SLUG>.md
 * automáticamente. Si el MD no existe, la página muestra mensaje
 * informativo en lugar de error 404.
 *
 * Convención: ver docs/CONVENCION_GUIAS_USUARIO.md
 */
import { BookOpen } from 'lucide-react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

interface AccionMenu {
  id: string
  etiqueta: string
  icono?: React.ReactNode
  onClick: () => void
  peligro?: boolean
}

type FuncionTraduccion = (clave: string) => string

export function accionAyudaModulo(
  slug: string,
  t: FuncionTraduccion,
  router: AppRouterInstance,
): AccionMenu {
  return {
    id: 'ayuda-modulo',
    etiqueta: t('comun.guia_uso'),
    icono: <BookOpen size={14} />,
    onClick: () => router.push(`/ayuda/${slug}`),
  }
}

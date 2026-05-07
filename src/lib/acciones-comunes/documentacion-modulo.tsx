/**
 * Helper para agregar la acción "Documentación" al menú de acciones
 * de cualquier listado que use PlantillaListado.
 *
 * Uso:
 *   import { accionDocumentacionModulo } from '@/lib/acciones-comunes/documentacion-modulo'
 *
 *   <PlantillaListado
 *     acciones={[
 *       accionDocumentacionModulo('flujos', t, router),
 *       // ... otras acciones
 *     ]}
 *   />
 *
 * Click → navega a /documentacion/<slug>, que carga
 * docs/DOCUMENTACION_<SLUG>.md automáticamente. Si el MD no existe,
 * la página muestra mensaje informativo en lugar de error 404.
 *
 * Convención: ver docs/CONVENCION_DOCUMENTACION_USUARIO.md
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

export function accionDocumentacionModulo(
  slug: string,
  t: FuncionTraduccion,
  router: AppRouterInstance,
): AccionMenu {
  return {
    id: 'documentacion-modulo',
    etiqueta: t('comun.documentacion'),
    icono: <BookOpen size={14} />,
    onClick: () => router.push(`/documentacion/${slug}`),
  }
}

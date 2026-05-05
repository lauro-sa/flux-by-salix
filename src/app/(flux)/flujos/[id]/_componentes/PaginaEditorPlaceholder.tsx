'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Workflow } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'

/**
 * Placeholder del editor de flujos para sub-PR 19.1 (D2 del plan de scope).
 *
 * Comportamiento: al montar, dispara un toast informativo y navega de
 * vuelta al listado. La pantalla intermedia muestra brevemente el ícono
 * + microcopy mientras el router redirige, así no queda blanco.
 *
 * En 19.2 este componente se elimina y la ruta /flujos/[id] pasa a montar
 * el editor real (canvas vertical + panel lateral + dnd-kit).
 */
export default function PaginaEditorPlaceholder() {
  const router = useRouter()
  const { t } = useTraduccion()
  const { mostrar } = useToast()

  useEffect(() => {
    mostrar('info', t('flujos.toast.editor_proximamente'))
    router.replace('/flujos')
  }, [mostrar, router, t])

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[calc(100dvh-var(--header-alto))] gap-4 px-6 text-center">
      <div className="text-texto-terciario">
        <Workflow size={56} strokeWidth={1.4} />
      </div>
      <h1 className="text-lg font-semibold text-texto-primario">
        {t('flujos.editor_proximamente_titulo')}
      </h1>
      <p className="text-sm text-texto-terciario max-w-md leading-relaxed">
        {t('flujos.editor_proximamente_desc')}
      </p>
    </div>
  )
}

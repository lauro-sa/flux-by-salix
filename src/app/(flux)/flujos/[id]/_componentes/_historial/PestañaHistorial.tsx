'use client'

import { History } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * PestañaHistorial — vista de historial de ejecuciones del flujo (sub-PR 19.6).
 *
 * Render condicional desde `EditorFlujo` cuando `?vista=historial`. Convive
 * con la tab Editor; cambiar de tab NO descarta cambios pendientes (el
 * autoguardado del hook sigue corriendo en background).
 *
 * Commit 1 deja un placeholder con título y vacío. Los próximos commits
 * agregan: TablaDinamica + filtros, drawer de detalle, acciones.
 */

interface Props {
  flujoId: string
}

export default function PestañaHistorial({ flujoId: _flujoId }: Props) {
  const { t } = useTraduccion()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex flex-col items-center justify-center text-center py-16 text-texto-terciario">
          <History size={28} className="mb-3 opacity-40" strokeWidth={1.6} />
          <p className="text-sm font-medium text-texto-secundario">
            {t('flujos.historial.placeholder.titulo')}
          </p>
          <p className="mt-1 text-xs max-w-md">
            {t('flujos.historial.placeholder.descripcion')}
          </p>
        </div>
      </div>
    </div>
  )
}

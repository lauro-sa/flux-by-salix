'use client'

import { Calendar } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useTraduccion } from '@/lib/i18n'

/**
 * Calendario — Página principal del módulo calendario.
 * Próximamente: vista de calendario con eventos, actividades y visitas.
 */
export default function PaginaCalendario() {
  const { t } = useTraduccion()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><Calendar size={20} /></span>
          {t('calendario.titulo')}
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <EstadoVacio
          icono={<Calendar size={48} strokeWidth={1.2} />}
          titulo={t('comun.proximamente')}
          descripcion={t('comun.proximamente_desc')}
        />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useTraduccion } from '@/lib/i18n'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/* ════════════════════════════════════════════
   Sub-componente: Paginador de tabla
   ════════════════════════════════════════════ */

export function Paginador({
  paginaActual,
  totalPaginas,
  registroInicio,
  registroFin,
  totalRegistros,
  onCambiarPagina,
}: {
  paginaActual: number
  totalPaginas: number
  registroInicio: number
  registroFin: number
  totalRegistros: number
  onCambiarPagina: (pagina: number) => void
}) {
  const { t } = useTraduccion()
  /* Estado para el comportamiento "click centro = última, otro click = primera" */
  const [ultimoClickCentro, setUltimoClickCentro] = useState(false)

  const irAnterior = () => {
    if (paginaActual > 1) onCambiarPagina(paginaActual - 1)
    setUltimoClickCentro(false)
  }

  const irSiguiente = () => {
    if (paginaActual < totalPaginas) onCambiarPagina(paginaActual + 1)
    setUltimoClickCentro(false)
  }

  const clickCentro = () => {
    if (ultimoClickCentro) {
      onCambiarPagina(1)
      setUltimoClickCentro(false)
    } else {
      onCambiarPagina(totalPaginas)
      setUltimoClickCentro(true)
    }
  }

  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-borde-sutil">
      {/* Info */}
      <span className="text-xs text-texto-terciario">
        {registroInicio}–{registroFin} de {totalRegistros.toLocaleString('es')}
      </span>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Primera página */}
        <button
          type="button"
          onClick={() => { onCambiarPagina(1); setUltimoClickCentro(false) }}
          disabled={paginaActual === 1}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Primera página"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Anterior */}
        <button
          type="button"
          onClick={irAnterior}
          disabled={paginaActual === 1}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('comun.anterior')}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Indicador central clickeable */}
        <button
          type="button"
          onClick={clickCentro}
          className="px-3 py-1 rounded text-xs font-medium text-texto-primario hover:bg-superficie-hover cursor-pointer border-none bg-transparent transition-colors"
          title={ultimoClickCentro ? 'Ir a la primera página' : 'Ir a la última página'}
        >
          {paginaActual} / {totalPaginas}
        </button>

        {/* Siguiente */}
        <button
          type="button"
          onClick={irSiguiente}
          disabled={paginaActual === totalPaginas}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('comun.siguiente')}
        >
          <ChevronRight size={14} />
        </button>

        {/* Última página */}
        <button
          type="button"
          onClick={() => { onCambiarPagina(totalPaginas); setUltimoClickCentro(true) }}
          disabled={paginaActual === totalPaginas}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Última página"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  )
}

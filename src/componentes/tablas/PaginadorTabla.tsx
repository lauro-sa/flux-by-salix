'use client'

import { useState } from 'react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

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
  const { locale } = useFormato()
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
        {registroInicio}–{registroFin} de {totalRegistros.toLocaleString(locale)}
      </span>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Primera página */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<ChevronsLeft size={14} />}
          onClick={() => { onCambiarPagina(1); setUltimoClickCentro(false) }}
          disabled={paginaActual === 1}
          titulo={t('paginacion.primera_pagina')}
        />

        {/* Anterior */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<ChevronLeft size={14} />}
          onClick={irAnterior}
          disabled={paginaActual === 1}
          titulo={t('comun.anterior')}
        />

        {/* Indicador central clickeable */}
        <Boton
          variante="fantasma"
          tamano="xs"
          onClick={clickCentro}
          titulo={ultimoClickCentro ? 'Ir a la primera página' : 'Ir a la última página'}
        >
          {paginaActual} / {totalPaginas}
        </Boton>

        {/* Siguiente */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<ChevronRight size={14} />}
          onClick={irSiguiente}
          disabled={paginaActual === totalPaginas}
          titulo={t('comun.siguiente')}
        />

        {/* Última página */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<ChevronsRight size={14} />}
          onClick={() => { onCambiarPagina(totalPaginas); setUltimoClickCentro(true) }}
          disabled={paginaActual === totalPaginas}
          titulo={t('paginacion.ultima_pagina')}
        />
      </div>
    </div>
  )
}

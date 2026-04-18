'use client'

/**
 * SeccionOcultosDeshabilitados — Renderiza las secciones colapsables de items
 * ocultos (clickeables pero dimmed) y deshabilitados (no clickeables, tachados).
 * Permite restaurar items individuales desde cada seccion.
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Eye, Power } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import type { ItemNav } from './tipos'

interface PropiedadesSeccion {
  itemsOcultos: ItemNav[]
  itemsDeshabilitados: ItemNav[]
  onRestaurarOculto: (id: string) => void
  onRestaurarDeshabilitado: (id: string) => void
  onCerrarMobil: () => void
  vibrar: () => void
}

function SeccionOcultosDeshabilitados({
  itemsOcultos,
  itemsDeshabilitados,
  onRestaurarOculto,
  onRestaurarDeshabilitado,
  onCerrarMobil,
  vibrar,
}: PropiedadesSeccion) {
  const [ocultosAbierta, setOcultosAbierta] = useState(false)
  const [deshabilitadosAbierta, setDeshabilitadosAbierta] = useState(false)

  return (
    <>
      {/* Seccion OCULTOS — clickeables, solo no estan en el nav principal */}
      {itemsOcultos.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOcultosAbierta(!ocultosAbierta)} className="flex items-center gap-1 w-full px-1.5 mb-1 bg-transparent border-none cursor-pointer text-xxs font-semibold text-texto-terciario/50 uppercase tracking-wider hover:text-texto-terciario transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 rounded">
            <ChevronDown size={10} className={`transition-transform ${ocultosAbierta ? '' : '-rotate-90'}`} />
            Ocultos ({itemsOcultos.length})
          </button>
          <AnimatePresence>
            {ocultosAbierta && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-px overflow-hidden">
                {itemsOcultos.map(item => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative group">
                    <Link
                      href={item.ruta}
                      onClick={() => { onCerrarMobil(); vibrar() }}
                      style={{ color: 'var(--texto-terciario)' }}
                      className="flex items-center gap-2 px-1.5 py-2 rounded-boton no-underline hover:bg-superficie-hover transition-colors"
                    >
                      <span className="shrink-0 flex opacity-50 ml-6">{item.icono}</span>
                      <span className="flex-1 truncate text-sm opacity-60">{item.etiqueta}</span>
                    </Link>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<Eye size={12} />}
                      titulo="Mostrar"
                      onClick={(e) => { e.stopPropagation(); onRestaurarOculto(item.id) }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-70 group-active:opacity-70"
                      style={{ color: 'var(--texto-terciario)' }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Seccion DESHABILITADOS — NO clickeables, tachados */}
      {itemsDeshabilitados.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setDeshabilitadosAbierta(!deshabilitadosAbierta)} className="flex items-center gap-1 w-full px-1.5 mb-1 bg-transparent border-none cursor-pointer text-xxs font-semibold text-texto-terciario/50 uppercase tracking-wider hover:text-texto-terciario transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 rounded">
            <ChevronDown size={10} className={`transition-transform ${deshabilitadosAbierta ? '' : '-rotate-90'}`} />
            Deshabilitados ({itemsDeshabilitados.length})
          </button>
          <AnimatePresence>
            {deshabilitadosAbierta && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-px overflow-hidden">
                {itemsDeshabilitados.map(item => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative group">
                    <div className="flex items-center gap-2 px-1.5 py-2 rounded-boton cursor-not-allowed" style={{ color: 'var(--texto-terciario)' }}>
                      <span className="shrink-0 flex opacity-30 ml-6">{item.icono}</span>
                      <span className="flex-1 truncate text-sm opacity-40 line-through">{item.etiqueta}</span>
                    </div>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<Power size={12} />}
                      titulo="Habilitar"
                      onClick={(e) => { e.stopPropagation(); onRestaurarDeshabilitado(item.id) }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-70 group-active:opacity-70"
                      style={{ color: 'var(--texto-terciario)' }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}

export { SeccionOcultosDeshabilitados }

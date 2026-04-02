'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import type { AccionLote } from '@/componentes/tablas/tipos-tabla'

/* ════════════════════════════════════════════
   Sub-componente: Barra flotante de acciones masivas
   Arrastrable arriba/abajo, estilo Attio
   ════════════════════════════════════════════ */

export function BarraAccionesLote({
  seleccionados,
  accionesLote,
  onLimpiarSeleccion,
  preferencias,
  guardarPreferencias,
}: {
  seleccionados: Set<string>
  accionesLote: AccionLote[]
  onLimpiarSeleccion: () => void
  preferencias: { config_tablas: Record<string, unknown> }
  guardarPreferencias: (cambios: Record<string, unknown>) => void
}) {
  const posGuardada = ((preferencias.config_tablas?.['__global'] as Record<string, string> | undefined)?.barraAccionesPosicion || 'abajo') as 'arriba' | 'abajo'
  const [posicion, setPosicion] = useState<'arriba' | 'abajo'>(posGuardada)
  const [arrastrando, setArrastrando] = useState(false)
  const [sidebarAncho, setSidebarAncho] = useState(0)
  const barraRef = useRef<HTMLDivElement>(null)

  // Detectar ancho real del sidebar (dinámico: expandido/colapsado/mobile)
  useEffect(() => {
    const detectar = () => {
      const sidebar = document.querySelector('aside')
      setSidebarAncho(sidebar ? sidebar.getBoundingClientRect().width : 0)
    }
    detectar()
    const obs = new ResizeObserver(detectar)
    const sidebar = document.querySelector('aside')
    if (sidebar) obs.observe(sidebar)
    window.addEventListener('resize', detectar)
    return () => { obs.disconnect(); window.removeEventListener('resize', detectar) }
  }, [])

  // Sincronizar con preferencias guardadas
  useEffect(() => { setPosicion(posGuardada) }, [posGuardada])

  const guardarPosicion = useCallback((pos: 'arriba' | 'abajo') => {
    setPosicion(pos)
    const globalActual = (preferencias.config_tablas?.['__global'] || {}) as Record<string, string>
    guardarPreferencias({
      config_tablas: {
        ...preferencias.config_tablas,
        __global: { ...globalActual, barraAccionesPosicion: pos },
      },
    })
  }, [preferencias.config_tablas, guardarPreferencias])

  const visible = seleccionados.size > 0 && accionesLote.length > 0
  const esArriba = posicion === 'arriba'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={barraRef}
          key="barra-acciones-lote"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.5}
          onDragStart={() => setArrastrando(true)}
          onDragEnd={(_, info) => {
            setArrastrando(false)
            // Si arrastraron más de 80px, cambiar posición
            if (esArriba && info.offset.y > 80) guardarPosicion('abajo')
            else if (!esArriba && info.offset.y < -80) guardarPosicion('arriba')
          }}
          initial={{ opacity: 0, y: esArriba ? -20 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: esArriba ? -20 : 20 }}
          transition={arrastrando ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
          className={[
            'fixed z-[100] flex items-center gap-2.5 pl-1.5 pr-4 py-2 rounded-xl shadow-elevada border border-borde-sutil group/barra select-none',
            esArriba ? 'top-20' : 'bottom-6',
          ].join(' ')}
          style={{
            backgroundColor: 'var(--superficie-elevada)',
            touchAction: 'none',
            left: sidebarAncho + (window.innerWidth - sidebarAncho) / 2,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Drag handle */}
          <div className="flex items-center justify-center w-6 h-8 rounded-lg text-texto-terciario/0 group-hover/barra:text-texto-terciario hover:!text-texto-secundario hover:!bg-superficie-hover transition-all cursor-grab active:cursor-grabbing shrink-0 touch-none">
            <GripVertical size={14} />
          </div>

          {/* Conteo */}
          <span className="text-sm font-semibold text-texto-primario tabular-nums">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>

          <div className="w-px h-5 bg-borde-sutil" />

          {/* Acciones */}
          {accionesLote.map((accion) => (
            <Boton
              key={accion.id}
              variante={accion.peligro ? 'peligro' : 'fantasma'}
              tamano="sm"
              icono={accion.icono}
              onClick={() => { accion.onClick(seleccionados); onLimpiarSeleccion() }}
            >
              {accion.etiqueta}
            </Boton>
          ))}

          <div className="w-px h-5 bg-borde-sutil" />

          {/* Deseleccionar */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<X size={14} />}
            onClick={onLimpiarSeleccion}
            titulo="Deseleccionar todo"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

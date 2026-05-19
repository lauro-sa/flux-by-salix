'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { PuntoEstado } from '@/componentes/ui/PuntoEstado'
import { CabezalPanel } from '@/componentes/ui/CabezalPanel'
import type { EstadoPanel } from './tipos'

/**
 * EncabezadoSalix — Header del panel lateral con:
 *  - Logo cuadrado violeta metalizado + sparkle adentro que rota.
 *    Rotación lenta (24s) en idle, rápida (3s) cuando está pensando.
 *  - Título "Salix IA" + subtítulo que cambia con el estado.
 *  - PuntoEstado al lado del subtítulo (verde idle, violeta pensando, etc.)
 *  - Botón de cerrar a la derecha.
 *
 * El estado del panel viene del padre porque el header solo refleja, no decide.
 */

interface PropsEncabezadoSalix {
  estado: EstadoPanel
  /** Cantidad de líneas listas cuando estado === 'resultados'. Para el subtítulo. */
  cantidadResultados?: number
  onCerrar: () => void
}

// Subtítulo dinámico — cambia con el estado para que el usuario sepa qué pasa.
function subtituloPorEstado(estado: EstadoPanel, cantidad: number): string {
  switch (estado) {
    case 'vacio':       return 'Describí el trabajo y armamos el presupuesto'
    case 'analizando':  return 'pensando…'
    case 'resultados':  return cantidad === 1 ? '1 línea lista' : `${cantidad} líneas listas`
    case 'error':       return 'algo salió mal'
  }
}

// Punto de estado mapeado al estado del panel.
function puntoPorEstado(estado: EstadoPanel): 'activo' | 'pensando' | 'listo' | 'error' {
  switch (estado) {
    case 'vacio':       return 'activo'
    case 'analizando':  return 'pensando'
    case 'resultados':  return 'listo'
    case 'error':       return 'error'
  }
}

export function EncabezadoSalix({ estado, cantidadResultados = 0, onCerrar }: PropsEncabezadoSalix) {
  const pensando = estado === 'analizando'

  // Usamos CabezalPanel para mantener altura, padding y estilo unificados
  // con PanelChat, PanelNotas y PanelRecordatorios. Lo único custom es el
  // ícono (logo violeta con sparkle rotando) y el subtítulo (con PuntoEstado).
  return (
    <CabezalPanel
      icono={
        <div
          className="size-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--insignia-primario) 0%, var(--insignia-violeta) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: pensando ? 3 : 24,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="flex items-center justify-center"
          >
            <Sparkles size={14} className="text-white" />
          </motion.div>
        </div>
      }
      titulo="Salix IA"
      subtitulo={
        <>
          <PuntoEstado estado={puntoPorEstado(estado)} />
          <span>{subtituloPorEstado(estado, cantidadResultados)}</span>
        </>
      }
      onCerrar={onCerrar}
    />
  )
}

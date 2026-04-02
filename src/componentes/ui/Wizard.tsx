'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight } from 'lucide-react'
import { Boton } from './Boton'

/**
 * Wizard — Componente de flujo multi-paso con navegación y validación.
 * Muestra indicador de pasos arriba y contenido del paso actual abajo.
 * Se usa en: onboarding, creación de contactos complejos, configuración inicial.
 */

interface PasoWizard {
  /** ID único del paso */
  id: string
  /** Título del paso */
  titulo: string
  /** Descripción corta opcional */
  descripcion?: string
  /** Contenido del paso (formulario, instrucciones, etc.) */
  contenido: ReactNode
  /** Validación antes de avanzar. Retorna true si es válido */
  validar?: () => boolean | Promise<boolean>
  /** Icono opcional para el indicador */
  icono?: ReactNode
}

interface PropiedadesWizard {
  /** Pasos del wizard */
  pasos: PasoWizard[]
  /** Callback al completar todos los pasos */
  onCompletar: () => void
  /** Callback al cancelar */
  onCancelar?: () => void
  /** Texto del botón de completar (último paso) */
  textoCompletar?: string
  /** Texto del botón siguiente */
  textoSiguiente?: string
  /** Texto del botón anterior */
  textoAnterior?: string
  /** Texto del botón cancelar */
  textoCancelar?: string
  /** Paso inicial (índice) */
  pasoInicial?: number
  /** Clase CSS adicional */
  className?: string
}

function IndicadorPasos({
  pasos,
  pasoActual,
}: {
  pasos: PasoWizard[]
  pasoActual: number
}) {
  return (
    <div className="flex items-center w-full">
      {pasos.map((paso, i) => {
        const completado = i < pasoActual
        const activo = i === pasoActual
        const ultimo = i === pasos.length - 1

        return (
          <div key={paso.id} className={`flex items-center ${ultimo ? '' : 'flex-1'}`}>
            {/* Círculo del paso */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-200
                  ${completado
                    ? 'bg-insignia-exito text-texto-inverso'
                    : activo
                      ? 'bg-texto-marca text-texto-inverso'
                      : 'bg-superficie-hover text-texto-terciario'
                  }
                `}
              >
                {completado ? <Check size={14} strokeWidth={3} /> : paso.icono || i + 1}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-medium leading-tight ${activo ? 'text-texto-primario' : 'text-texto-terciario'}`}>
                  {paso.titulo}
                </p>
                {paso.descripcion && activo && (
                  <p className="text-xxs text-texto-terciario leading-tight mt-0.5">
                    {paso.descripcion}
                  </p>
                )}
              </div>
            </div>

            {/* Línea conectora */}
            {!ultimo && (
              <div className="flex-1 mx-3 h-px relative">
                <div className="absolute inset-0 bg-borde-sutil" />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-insignia-exito"
                  initial={{ width: '0%' }}
                  animate={{ width: completado ? '100%' : '0%' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Wizard({
  pasos,
  onCompletar,
  onCancelar,
  textoCompletar = 'Completar',
  textoSiguiente = 'Siguiente',
  textoAnterior = 'Anterior',
  textoCancelar = 'Cancelar',
  pasoInicial = 0,
  className = '',
}: PropiedadesWizard) {
  const [pasoActual, setPasoActual] = useState(pasoInicial)
  const [direccion, setDireccion] = useState(1) // 1 = adelante, -1 = atrás
  const [validando, setValidando] = useState(false)

  const esUltimo = pasoActual === pasos.length - 1
  const esPrimero = pasoActual === 0

  const avanzar = useCallback(async () => {
    const paso = pasos[pasoActual]

    // Validar si el paso tiene validación
    if (paso.validar) {
      setValidando(true)
      try {
        const valido = await paso.validar()
        if (!valido) {
          setValidando(false)
          return
        }
      } catch {
        setValidando(false)
        return
      }
      setValidando(false)
    }

    if (esUltimo) {
      onCompletar()
    } else {
      setDireccion(1)
      setPasoActual((prev) => prev + 1)
    }
  }, [pasoActual, pasos, esUltimo, onCompletar])

  const retroceder = useCallback(() => {
    if (esPrimero) return
    setDireccion(-1)
    setPasoActual((prev) => prev - 1)
  }, [esPrimero])

  const variantes = {
    entrar: (dir: number) => ({
      x: dir > 0 ? 24 : -24,
      opacity: 0,
    }),
    centro: {
      x: 0,
      opacity: 1,
    },
    salir: (dir: number) => ({
      x: dir > 0 ? -24 : 24,
      opacity: 0,
    }),
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Indicador de pasos */}
      <div className="px-1 pb-6">
        <IndicadorPasos pasos={pasos} pasoActual={pasoActual} />
      </div>

      {/* Contenido del paso actual */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <AnimatePresence mode="wait" custom={direccion}>
          <motion.div
            key={pasos[pasoActual].id}
            custom={direccion}
            variants={variantes}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {pasos[pasoActual].contenido}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center justify-between pt-6 border-t border-borde-sutil mt-6">
        <div>
          {onCancelar && esPrimero && (
            <Boton variante="fantasma" onClick={onCancelar}>
              {textoCancelar}
            </Boton>
          )}
          {!esPrimero && (
            <Boton variante="fantasma" onClick={retroceder}>
              {textoAnterior}
            </Boton>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xxs text-texto-terciario mr-2 tabular-nums">
            {pasoActual + 1} / {pasos.length}
          </span>
          <Boton
            variante="primario"
            onClick={avanzar}
            cargando={validando}
            iconoDerecho={!esUltimo ? <ChevronRight size={14} /> : undefined}
          >
            {esUltimo ? textoCompletar : textoSiguiente}
          </Boton>
        </div>
      </div>
    </div>
  )
}

export { Wizard }
export type { PropiedadesWizard, PasoWizard }

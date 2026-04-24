'use client'

/**
 * PopoverProgramar — Popover para programar el envío de un correo.
 * Opciones rápidas (mañana 8h, 13h, 20h) + selector custom de fecha y hora.
 * Se usa en: ModalEnviarDocumento (pie fijo, botón de programar).
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Coffee, Moon, Calendar } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { useFormato } from '@/hooks/useFormato'
import { diaSiguienteCorto } from './ayudantes'

interface PropiedadesPopoverProgramar {
  abierto: boolean
  onCerrar: () => void
  onProgramar: (fecha: string) => void
  disabled?: boolean
}

export function PopoverProgramar({
  abierto,
  onCerrar,
  onProgramar,
  disabled,
}: PropiedadesPopoverProgramar) {
  const { locale } = useFormato()
  const [fechaCustom, setFechaCustom] = useState<string | null>(null)
  const [horaCustom, setHoraCustom] = useState<string | null>(null)
  const [mostrarCustom, setMostrarCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera (ignorando portales de selectores internos)
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current || ref.current.contains(target)) return
      // Los SelectorFecha/SelectorHora renderizan su dropdown en un portal
      // a document.body; ese click es "lógicamente" dentro del popover.
      if (target instanceof Element && target.closest('[data-selector-portal="true"]')) return
      onCerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, onCerrar])

  // Resetear al abrir
  useEffect(() => {
    if (abierto) { setFechaCustom(null); setHoraCustom(null); setMostrarCustom(false) }
  }, [abierto])

  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  const dia = diaSiguienteCorto(locale)

  const formatear = (hora: number) => {
    const d = new Date(manana)
    d.setHours(hora, 0, 0, 0)
    return d.toISOString()
  }

  // Defaults para el modo custom: hoy (o mañana si rebasa medianoche) + 1 hora en punto.
  const defaultsCustom = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hora = `${String(d.getHours()).padStart(2, '0')}:00`
    return { fecha, hora }
  }

  const abrirCustom = () => {
    const { fecha, hora } = defaultsCustom()
    setFechaCustom(fecha)
    setHoraCustom(hora)
    setMostrarCustom(true)
  }

  const puedeConfirmarCustom = fechaCustom && horaCustom

  const confirmarCustom = () => {
    if (!fechaCustom || !horaCustom) return
    const [h, m] = horaCustom.split(':').map(Number)
    const d = new Date(fechaCustom + 'T00:00:00')
    d.setHours(h, m, 0, 0)
    onProgramar(d.toISOString())
    onCerrar()
  }

  const opciones = [
    { etiqueta: 'Mañana a la mañana', hora: `${dia}, 08:00`, icono: <Sun size={15} />, valor: formatear(8) },
    { etiqueta: 'Mañana a la tarde', hora: `${dia}, 13:00`, icono: <Coffee size={15} />, valor: formatear(13) },
    { etiqueta: 'Mañana a la noche', hora: `${dia}, 20:00`, icono: <Moon size={15} />, valor: formatear(20) },
  ]

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full right-0 mb-2 rounded-popover shadow-elevada overflow-visible z-50"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)', width: mostrarCustom ? 340 : 280 }}
        >
          {/* Título */}
          <div className="px-4 pt-3 pb-2">
            <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
              Programar envío
            </span>
          </div>

          {/* Opciones rápidas */}
          <div>
            {opciones.map((op) => (
              <OpcionMenu
                key={op.valor}
                icono={op.icono}
                derecha={<span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{op.hora}</span>}
                onClick={() => { onProgramar(op.valor); onCerrar() }}
                disabled={disabled}
              >
                {op.etiqueta}
              </OpcionMenu>
            ))}
          </div>

          {/* Elegir fecha y hora — con SelectorFecha + SelectorHora */}
          <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
            {!mostrarCustom ? (
              <OpcionMenu
                icono={<Calendar size={15} />}
                onClick={abrirCustom}
              >
                Elegir fecha y hora...
              </OpcionMenu>
            ) : (
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SelectorFecha
                      valor={fechaCustom}
                      onChange={setFechaCustom}
                      placeholder="Fecha"
                      limpiable={false}
                      anioMin={new Date().getFullYear()}
                      anioMax={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div className="w-[110px]">
                    <SelectorHora
                      valor={horaCustom}
                      onChange={setHoraCustom}
                      placeholder="Hora"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => { setMostrarCustom(false); setFechaCustom(null); setHoraCustom(null) }}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    variante="primario"
                    tamano="xs"
                    disabled={!puedeConfirmarCustom || disabled}
                    onClick={confirmarCustom}
                  >
                    Programar
                  </Boton>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

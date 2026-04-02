'use client'

import { AlarmClock, CalendarDays, Clock, X } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * PreviewRecordatorio — Modales de vista previa para mostrar cómo se vería
 * la alerta de un recordatorio (modal completo o toast/notificación).
 */

interface PreviewRecordatorioProps {
  previewModal: boolean
  onCerrarModal: () => void
  previewToast: boolean
  onCerrarToast: () => void
}

function PreviewRecordatorio({ previewModal, onCerrarModal, previewToast, onCerrarToast }: PreviewRecordatorioProps) {
  return (
    <>
      {/* ── Preview: Modal de recordatorio ── */}
      <Modal
        abierto={previewModal}
        onCerrar={onCerrarModal}
        titulo="Recordatorio"
        tamano="sm"
        acciones={
          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tamano="sm" onClick={onCerrarModal}>Descartar</Boton>
            <Boton variante="secundario" tamano="sm" onClick={onCerrarModal}>Posponer 30 min</Boton>
            <Boton tamano="sm" onClick={onCerrarModal}>Completar</Boton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
              <AlarmClock size={20} className="text-texto-marca" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-texto-primario">Llamar a Juan Pérez</h4>
              <p className="text-sm text-texto-terciario mt-0.5">Confirmar disponibilidad para la reunión del viernes</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-texto-secundario">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-texto-terciario" />
              <span>Hoy, 31 Mar 2026</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-texto-terciario" />
              <span>15:00</span>
            </div>
          </div>

          <div className="px-3 py-2.5 rounded-lg bg-superficie-hover text-xs text-texto-terciario italic">
            Este es un ejemplo de cómo se vería el modal cuando llegue el momento del recordatorio.
          </div>
        </div>
      </Modal>

      {/* ── Preview: Toast de notificación ── */}
      <AnimatePresence>
        {previewToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-6 z-[10000] w-[360px] border border-borde-sutil rounded-2xl shadow-elevada overflow-hidden"
            style={{ backgroundColor: 'var(--superficie-elevada)', top: 'calc(var(--header-alto) + 12px)' }}
          >
            <div className="flex items-start gap-3 p-4">
              <div className="size-9 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
                <AlarmClock size={18} className="text-texto-marca" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-texto-marca">Recordatorio</span>
                  <span className="text-xxs text-texto-terciario">Ahora</span>
                </div>
                <p className="text-sm font-medium text-texto-primario mt-0.5">Llamar a Juan Pérez</p>
                <p className="text-xs text-texto-terciario mt-0.5">Confirmar disponibilidad para la reunión del viernes</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xxs text-texto-terciario">
                    <CalendarDays size={11} />
                    <span>Hoy</span>
                  </div>
                  <div className="flex items-center gap-1 text-xxs text-texto-terciario">
                    <Clock size={11} />
                    <span>15:00</span>
                  </div>
                </div>
              </div>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<X size={14} />}
                onClick={onCerrarToast}
              />
            </div>
            <div className="flex border-t border-borde-sutil">
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={onCerrarToast}
                className="flex-1 rounded-none text-texto-terciario"
              >
                Descartar
              </Boton>
              <div className="w-px bg-borde-sutil" />
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={onCerrarToast}
                className="flex-1 rounded-none text-texto-secundario"
              >
                Posponer
              </Boton>
              <div className="w-px bg-borde-sutil" />
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={onCerrarToast}
                className="flex-1 rounded-none text-texto-marca"
              >
                Completar
              </Boton>
            </div>
            <div className="px-3 py-1.5 bg-superficie-hover text-center">
              <span className="text-xxs text-texto-terciario italic">Vista previa — así se vería la notificación</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { PreviewRecordatorio }

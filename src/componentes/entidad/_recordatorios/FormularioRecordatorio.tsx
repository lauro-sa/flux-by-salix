'use client'

import { Plus, Bell, Eye, X } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { sonidos } from '@/hooks/useSonido'
import { motion, AnimatePresence } from 'framer-motion'
import { hoyISO, mañanaISO } from './tipos'
import type { UseRecordatoriosRetorno } from './useRecordatorios'

/**
 * FormularioRecordatorio — Formulario para crear/editar un recordatorio.
 * Ahora con:
 *  - Título hero (texto grande, sin label).
 *  - Chips de fecha rápida: Hoy / Mañana / En 3 días / Próx. semana / Próx. mes.
 *  - Secciones claras con labels compactos.
 *  - Touch-friendly en mobile.
 */

interface FormularioRecordatorioProps {
  estado: UseRecordatoriosRetorno
}

/* ─── Helpers de preset de fecha ─── */

function fechaDesdeHoy(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

interface ChipFecha {
  clave: string
  etiqueta: string
  fecha: () => string
}

const CHIPS_FECHA: ChipFecha[] = [
  { clave: 'hoy', etiqueta: 'Hoy', fecha: hoyISO },
  { clave: 'manana', etiqueta: 'Mañana', fecha: mañanaISO },
  { clave: '3dias', etiqueta: 'En 3 días', fecha: () => fechaDesdeHoy(3) },
  { clave: 'semana', etiqueta: 'En 1 semana', fecha: () => fechaDesdeHoy(7) },
  { clave: 'mes', etiqueta: 'En 1 mes', fecha: () => fechaDesdeHoy(30) },
]

/* ─── Etiqueta de sección ─── */

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider">
        {titulo}
      </span>
      {children}
    </div>
  )
}

function FormularioRecordatorio({ estado }: FormularioRecordatorioProps) {
  const {
    titulo, setTitulo,
    descripcion, setDescripcion,
    fecha, setFecha,
    usarHora, setUsarHora,
    hora, setHora,
    recurrencia, setRecurrencia,
    alertaModal, setAlertaModal,
    notificarWhatsApp, setNotificarWhatsApp,
    mostrarNota, setMostrarNota,
    setAbierto, setPreviewModal, setPreviewToast,
    crear,
  } = estado

  return (
    <div className="flex flex-col gap-7">
      {/* 1. Título — hero */}
      <Input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="¿Qué querés recordar?"
        autoFocus
        formato={null}
        onKeyDown={(e) => { if (e.key === 'Enter' && titulo.trim()) crear() }}
        className="!text-base !py-2.5"
      />

      {/* 2. Fecha */}
      <Seccion titulo="¿Cuándo?">
        {/* Chips de fecha rápida — pills glass con estado activo violet */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS_FECHA.map((c) => {
            const fechaChip = c.fecha()
            const activo = fecha === fechaChip
            return (
              <button
                key={c.clave}
                type="button"
                onClick={() => setFecha(fechaChip)}
                className="salix-pill"
                data-activo={activo}
              >
                {c.etiqueta}
              </button>
            )
          })}
        </div>

        {/* Selector de fecha + hora — sin íconos externos (los componentes
            ya traen el suyo adentro). Layout en grid de 2 columnas iguales. */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <SelectorFecha
              valor={fecha}
              onChange={(v) => setFecha(v || mañanaISO())}
              limpiable={false}
            />
          </div>
          <div className="min-w-0 flex items-center gap-1">
            {usarHora ? (
              <>
                <div className="salix-input-hora flex-1 min-w-0">
                  <SelectorHora
                    valor={hora}
                    onChange={setHora}
                    pasoMinutos={15}
                  />
                </div>
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<X size={14} />}
                  onClick={() => setUsarHora(false)}
                  titulo="Todo el día"
                />
              </>
            ) : (
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => setUsarHora(true)}
                className="flex-1"
              >
                Todo el día
              </Boton>
            )}
          </div>
        </div>
      </Seccion>

      {/* 3. Repetir */}
      <Seccion titulo="Repetir">
        <SelectorRecurrencia
          valor={recurrencia}
          onChange={setRecurrencia}
          fechaReferencia={fecha}
          compacto
        />
      </Seccion>

      {/* 4. Alertas — cards glass con ícono brand circular */}
      <Seccion titulo="Alertas">
        <div className="flex flex-col gap-2">
          {/* Notificación + modal */}
          <div className="salix-card flex items-center gap-3 px-3 py-2.5">
            <div
              className="salix-icon-circle salix-icon-link shrink-0"
              style={{ width: 32, height: 32 }}
            >
              <Bell className="size-3.5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/95 leading-tight">
                {alertaModal ? 'Notificación + modal' : 'Solo notificación'}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5 leading-tight">
                {alertaModal ? 'Abre un modal al momento' : 'Aparece en la campana'}
              </p>
            </div>
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              titulo="Vista previa"
              icono={<Eye size={13} />}
              onClick={() => {
                setAbierto(false)
                setTimeout(() => {
                  if (alertaModal) setPreviewModal(true)
                  else setPreviewToast(true)
                  sonidos.notificacion()
                }, 200)
              }}
            />
            <Interruptor activo={alertaModal} onChange={setAlertaModal} />
          </div>

          {/* WhatsApp */}
          <div className="salix-card flex items-center gap-3 px-3 py-2.5">
            <div
              className="salix-icon-circle salix-icon-whatsapp shrink-0"
              style={{ width: 32, height: 32 }}
            >
              <IconoWhatsApp size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/95 leading-tight">Avisar por WhatsApp</p>
              <p className="text-[11px] text-white/50 mt-0.5 leading-tight">
                Se envía al número principal
              </p>
            </div>
            <Interruptor activo={notificarWhatsApp} onChange={setNotificarWhatsApp} />
          </div>
        </div>
      </Seccion>

      {/* 5. Nota opcional */}
      <AnimatePresence initial={false}>
        {!mostrarNota ? (
          <motion.div
            key="agregar-nota"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<Plus size={14} />}
              onClick={() => setMostrarNota(true)}
            >
              Agregar nota
            </Boton>
          </motion.div>
        ) : (
          <motion.div
            key="campo-nota"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Seccion titulo="Nota">
              <TextArea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Notas adicionales..."
                rows={3}
                autoFocus
                compacto
              />
            </Seccion>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { FormularioRecordatorio }

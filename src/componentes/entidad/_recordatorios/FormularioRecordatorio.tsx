'use client'

import { Plus, Clock, Bell, Eye, X, Calendar as IconoCalendario } from 'lucide-react'
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
    <div className="flex flex-col gap-2">
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
    <div className="flex flex-col gap-5">
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
        {/* Chips de fecha rápida */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS_FECHA.map((c) => {
            const fechaChip = c.fecha()
            const activo = fecha === fechaChip
            return (
              <button
                key={c.clave}
                type="button"
                onClick={() => setFecha(fechaChip)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activo
                    ? 'bg-texto-marca/15 border border-texto-marca/40 text-texto-marca'
                    : 'border border-borde-sutil bg-transparent text-texto-terciario hover:text-texto-primario hover:bg-white/[0.04]'
                }`}
              >
                {c.etiqueta}
              </button>
            )
          })}
        </div>

        {/* Selector de fecha + hora */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            <IconoCalendario size={14} className="text-texto-terciario shrink-0" />
            <div className="flex-1 min-w-0">
              <SelectorFecha
                valor={fecha}
                onChange={(v) => setFecha(v || mañanaISO())}
                limpiable={false}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock size={14} className="text-texto-terciario shrink-0" />
            {usarHora ? (
              <>
                <div className="flex-1 min-w-0">
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

      {/* 4. Alertas */}
      <Seccion titulo="Alertas">
        <div className="flex flex-col gap-2">
          {/* Notificación + modal */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-card border border-white/[0.06] bg-white/[0.02]">
            <Bell size={14} className="text-texto-terciario shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-texto-primario leading-tight">
                {alertaModal ? 'Notificación + modal' : 'Solo notificación'}
              </p>
              <p className="text-[11px] text-texto-terciario mt-0.5 leading-tight">
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
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-card border border-white/[0.06] bg-white/[0.02]">
            <IconoWhatsApp size={14} className="text-canal-whatsapp shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-texto-primario leading-tight">Avisar por WhatsApp</p>
              <p className="text-[11px] text-texto-terciario mt-0.5 leading-tight">
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

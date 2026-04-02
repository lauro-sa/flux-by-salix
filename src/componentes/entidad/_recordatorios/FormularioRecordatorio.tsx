'use client'

import { Plus, Clock, Bell, Eye, X } from 'lucide-react'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { sonidos } from '@/hooks/useSonido'
import { motion, AnimatePresence } from 'framer-motion'
import { mañanaISO } from './tipos'
import type { UseRecordatoriosRetorno } from './useRecordatorios'

/**
 * FormularioRecordatorio — Contenido del tab "Crear" con inputs para
 * título, fecha/hora, recurrencia, alerta y nota opcional.
 */

interface FormularioRecordatorioProps {
  estado: UseRecordatoriosRetorno
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
    mostrarNota, setMostrarNota,
    setAbierto, setPreviewModal, setPreviewToast,
    crear,
  } = estado

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Título — sin label, hero element */}
      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="¿Qué necesitas recordar?"
        autoFocus
        className="w-full px-3 py-2.5 rounded-lg border border-borde-sutil bg-superficie-app text-sm font-medium text-texto-primario placeholder:text-texto-placeholder placeholder:font-normal focus:outline-none focus:border-texto-marca transition-colors"
        onKeyDown={(e) => { if (e.key === 'Enter' && titulo.trim()) crear() }}
      />

      {/* 2. Fecha + Hora — compacto, sin labels */}
      <div className="grid grid-cols-2 gap-2">
        <SelectorFecha
          valor={fecha}
          onChange={(v) => setFecha(v || mañanaISO())}
          limpiable={false}
        />
        <div className="flex items-center gap-2">
          {usarHora ? (
            <div className="flex-1">
              <SelectorHora
                valor={hora}
                onChange={setHora}
                pasoMinutos={15}
              />
            </div>
          ) : (
            <button
              onClick={() => setUsarHora(true)}
              className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-superficie-hover text-xs text-texto-terciario hover:text-texto-secundario cursor-pointer border-none transition-colors"
            >
              <Clock size={13} />
              Todo el día
            </button>
          )}
          {usarHora && (
            <button
              onClick={() => setUsarHora(false)}
              className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors"
              title="Cambiar a todo el día"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Repetir — Select compacto + panel expandible */}
      <SelectorRecurrencia
        valor={recurrencia}
        onChange={setRecurrencia}
        fechaReferencia={fecha}
        compacto
      />

      {/* 4. Alerta — fila inline con toggle + preview */}
      <div className="flex items-center gap-2 px-1">
        <Bell size={14} className="text-texto-terciario shrink-0" />
        <span className="text-xs text-texto-secundario flex-1">
          {alertaModal ? 'Notificación + modal' : 'Solo notificación'}
        </span>
        <Interruptor activo={alertaModal} onChange={setAlertaModal} />
        <button
          onClick={() => {
            setAbierto(false)
            setTimeout(() => {
              if (alertaModal) { setPreviewModal(true) } else { setPreviewToast(true) }
              sonidos.notificacion()
            }, 200)
          }}
          className="shrink-0 flex items-center justify-center size-7 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors"
          title="Vista previa"
        >
          <Eye size={13} />
        </button>
      </div>

      {/* 5. + Agregar nota — colapsado */}
      <AnimatePresence>
        {!mostrarNota ? (
          <button
            onClick={() => setMostrarNota(true)}
            className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-secundario bg-transparent border-none cursor-pointer transition-colors px-1 py-0.5"
          >
            <Plus size={13} />
            Agregar nota
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-borde-sutil bg-superficie-app text-xs text-texto-primario placeholder:text-texto-placeholder resize-none focus:outline-none focus:border-texto-marca transition-colors"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { FormularioRecordatorio }

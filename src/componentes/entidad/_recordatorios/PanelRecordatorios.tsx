'use client'

/**
 * PanelRecordatorios — Panel lateral flotante de recordatorios.
 * Desktop: panel lateral derecho (420px) con animación slide-in.
 * Mobile: pantalla completa con slide-up.
 *
 * Usa `useRecordatorios` internamente para reaprovechar toda la lógica
 * (crear/editar/completar/eliminar/recurrencia/alerta/whatsapp).
 *
 * Tabs: Crear | Activos | Completados.
 *
 * Se usa en: BotonFlotanteRecordatorios.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlarmClock, Plus, Clock, CheckCircle2 } from 'lucide-react'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useRecordatorios } from './useRecordatorios'
import { FormularioRecordatorio } from './FormularioRecordatorio'
import { ListaRecordatorios } from './ListaRecordatorios'
import { PreviewRecordatorio } from './PreviewRecordatorio'
import { ModalConfirmarEliminar } from './ModalConfirmarEliminar'

interface PropiedadesPanelRecordatorios {
  abierto: boolean
  onCerrar: () => void
}

function PanelRecordatorios({ abierto, onCerrar }: PropiedadesPanelRecordatorios) {
  const esMovil = useEsMovil()
  const estado = useRecordatorios()

  const {
    setAbierto,
    tab, setTab,
    activos, completados, cargando,
    titulo, fecha, creando, crear, editandoId, limpiarFormulario,
    toggleCompletar, intentarEliminar, eliminarDirecto, editarRecordatorio,
    previewModal, setPreviewModal,
    previewToast, setPreviewToast,
    confirmarEliminar, setConfirmarEliminar,
  } = estado

  // Sincronizar `abierto` del hook con el prop para disparar la carga de datos
  useEffect(() => {
    setAbierto(abierto)
  }, [abierto, setAbierto])

  const contenido = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-card bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
            <AlarmClock className="size-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Recordatorios</h3>
            <p className="text-[11px] text-texto-terciario">
              {activos.length === 0
                ? 'Sin recordatorios activos'
                : `${activos.length} ${activos.length === 1 ? 'activo' : 'activos'}`}
            </p>
          </div>
        </div>
        <button
          onClick={onCerrar}
          className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
          title="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2 shrink-0">
        <Tabs
          tabs={[
            { clave: 'crear', etiqueta: editandoId ? 'Editar' : 'Crear', icono: <Plus size={13} /> },
            { clave: 'activos', etiqueta: 'Activos', contador: activos.length, icono: <Clock size={13} /> },
            { clave: 'completados', etiqueta: 'Completados', icono: <CheckCircle2 size={13} /> },
          ]}
          activo={tab}
          onChange={(t) => { if (t !== 'crear') limpiarFormulario(); setTab(t) }}
        />
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 scrollbar-auto-oculto">
        {tab === 'crear' && <FormularioRecordatorio estado={estado} />}

        {tab === 'activos' && (
          <ListaRecordatorios
            tipo="activos"
            recordatorios={activos}
            cargando={cargando}
            onToggleCompletar={toggleCompletar}
            onEliminar={intentarEliminar}
            onEditar={editarRecordatorio}
            onIrACrear={() => setTab('crear')}
          />
        )}

        {tab === 'completados' && (
          <ListaRecordatorios
            tipo="completados"
            recordatorios={completados}
            cargando={cargando}
            onToggleCompletar={toggleCompletar}
            onEliminar={intentarEliminar}
          />
        )}
      </div>

      {/* Pie — botón crear (solo en tab crear) */}
      {tab === 'crear' && (
        <div className="border-t border-white/[0.07] px-4 py-3 flex items-center gap-2 shrink-0">
          <Boton
            onClick={crear}
            cargando={creando}
            disabled={!titulo.trim() || !fecha}
            tamano="sm"
          >
            {editandoId ? 'Guardar cambios' : 'Crear recordatorio'}
          </Boton>
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={() => { limpiarFormulario(); if (editandoId) setTab('activos'); else onCerrar() }}
          >
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  )

  // Mobile: pantalla completa (slide-up)
  if (esMovil) {
    return (
      <>
        {createPortal(
          <AnimatePresence>
            {abierto && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                className="fixed inset-0 z-[80] bg-superficie-app flex flex-col"
                style={{
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {contenido}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Previews de alerta */}
        <PreviewRecordatorio
          previewModal={previewModal}
          onCerrarModal={() => setPreviewModal(false)}
          previewToast={previewToast}
          onCerrarToast={() => setPreviewToast(false)}
        />

        {/* Modal confirmación eliminar recurrente */}
        <ModalConfirmarEliminar
          recordatorio={confirmarEliminar}
          onCerrar={() => setConfirmarEliminar(null)}
          onConfirmar={eliminarDirecto}
        />
      </>
    )
  }

  // Desktop: panel lateral derecho
  return (
    <>
      {createPortal(
        <AnimatePresence>
          {abierto && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCerrar}
                className="fixed inset-0 bg-black/20 z-[68]"
              />
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] z-[69] bg-superficie-elevada border-l border-white/[0.07] shadow-2xl flex flex-col"
              >
                {contenido}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Previews de alerta */}
      <PreviewRecordatorio
        previewModal={previewModal}
        onCerrarModal={() => setPreviewModal(false)}
        previewToast={previewToast}
        onCerrarToast={() => setPreviewToast(false)}
      />

      {/* Modal confirmación eliminar recurrente */}
      <ModalConfirmarEliminar
        recordatorio={confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
        onConfirmar={eliminarDirecto}
      />
    </>
  )
}

export { PanelRecordatorios }

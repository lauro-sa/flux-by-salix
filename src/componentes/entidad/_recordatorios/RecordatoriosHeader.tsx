'use client'

import {
  AlarmClock, Plus, Clock, CheckCircle2,
} from 'lucide-react'
import { PopoverAdaptable as Popover } from '@/componentes/ui/PopoverAdaptable'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { useRecordatorios } from './useRecordatorios'
import { FormularioRecordatorio } from './FormularioRecordatorio'
import { ListaRecordatorios } from './ListaRecordatorios'
import { PreviewRecordatorio } from './PreviewRecordatorio'
import { ModalConfirmarEliminar } from './ModalConfirmarEliminar'

/**
 * RecordatoriosHeader — Ícono en el header que abre un popover con mini-app de recordatorios.
 * Tabs: Crear | Activos | Completados.
 * Opciones de alerta: solo notificación en campana o también abrir modal al momento.
 * Se usa en: NotificacionesHeader.tsx (al lado de los 3 íconos de notificaciones).
 */
function RecordatoriosHeader() {
  const estado = useRecordatorios()

  const {
    abierto, setAbierto,
    tab, setTab,
    activos, completados, cargando, vencidos,
    titulo, setTitulo, descripcion, setDescripcion,
    fecha, creando, crear, editandoId, limpiarFormulario,
    toggleCompletar, intentarEliminar, eliminarDirecto, editarRecordatorio,
    previewModal, setPreviewModal,
    previewToast, setPreviewToast,
    confirmarEliminar, setConfirmarEliminar,
  } = estado

  const contenido = (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <div className="flex items-center gap-2">
          <AlarmClock size={16} className="text-texto-terciario" />
          <h3 className="text-sm font-semibold text-texto-primario">Recordatorios</h3>
          {activos.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xxs font-bold bg-texto-marca text-white">
              {activos.length}
            </span>
          )}
        </div>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
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
        <div className="border-t border-borde-sutil px-4 py-3 flex items-center gap-2 shrink-0">
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
            onClick={() => { limpiarFormulario(); if (editandoId) setTab('activos'); else setAbierto(false) }}
          >
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Popover
        abierto={abierto}
        onCambio={setAbierto}
        alineacion="fin"
        ancho={400}
        offset={10}
        tituloMovil="Recordatorios"
        contenido={contenido}
      >
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<AlarmClock size={17} strokeWidth={1.75} />}
          titulo="Recordatorios"
          className="relative"
        >
          {vencidos > 0 && (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-insignia-peligro-texto" />
          )}
        </Boton>
      </Popover>

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

export { RecordatoriosHeader }

'use client'

import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { PanelInterno } from './PanelInterno'
import { ModalCrearCanalInterno } from './ModalCrearCanalInterno'
import type { ConversacionConDetalles, MensajeConAdjuntos, CanalInterno } from '@/tipos/inbox'
import type { DatosMensaje } from './CompositorMensaje'
import type { VistaMovilInterno } from './useEstadoInbox'

/**
 * Layout del tab de Interno — panel de canales + chat de mensajería interna.
 * Incluye modal de creación de canales y soporte de vista móvil.
 */

interface PropsLayoutInterno {
  conversacion: ConversacionConDetalles | null
  mensajes: MensajeConAdjuntos[]
  canalesPublicos: CanalInterno[]
  canalesPrivados: CanalInterno[]
  canalesGrupos: CanalInterno[]
  canalSeleccionado: CanalInterno | null
  onSeleccionarCanal: (canal: CanalInterno | null) => void
  modalCrearAbierto: boolean
  onAbrirModalCrear: () => void
  onCerrarModalCrear: () => void
  onEnviar: (datos: DatosMensaje) => Promise<void>
  cargando: boolean
  enviando: boolean
  usuarioId: string
  onRecargarCanales: () => Promise<void>
  onReaccionar: (mensajeId: string, emoji: string) => Promise<void>
  esMovil: boolean
  vistaMovil: VistaMovilInterno
  onVolverMovil: () => void
  // Callbacks para actualizar estado del canal al crear
  onCanalCreado: (canal: CanalInterno) => void
  onAutoSeleccionarCanal: (canal: CanalInterno) => void
  // Limpiar conversación y mensajes
  onLimpiarConversacion: () => void
}

export function LayoutInterno({
  conversacion,
  mensajes,
  canalesPublicos,
  canalesPrivados,
  canalesGrupos,
  canalSeleccionado,
  onSeleccionarCanal,
  modalCrearAbierto,
  onAbrirModalCrear,
  onCerrarModalCrear,
  onEnviar,
  cargando,
  enviando,
  usuarioId,
  onRecargarCanales,
  onReaccionar,
  esMovil,
  vistaMovil,
  onVolverMovil,
  onCanalCreado,
  onAutoSeleccionarCanal,
  onLimpiarConversacion,
}: PropsLayoutInterno) {
  return (
    <>
      <ErrorBoundary mensaje="Error en mensajería interna">
        <PanelInterno
          conversacion={conversacion}
          mensajes={mensajes}
          canalesPublicos={canalesPublicos}
          canalesPrivados={canalesPrivados}
          canalesGrupos={canalesGrupos}
          canalSeleccionado={canalSeleccionado}
          onSeleccionarCanal={(canal) => {
            onSeleccionarCanal(canal)
            if (!canal) {
              onLimpiarConversacion()
            }
            if (esMovil && canal) {
              // La vista se cambia desde el padre
            }
          }}
          onCrearCanal={onAbrirModalCrear}
          onEnviar={onEnviar}
          cargando={cargando}
          enviando={enviando}
          usuarioId={usuarioId}
          onRecargarCanales={onRecargarCanales}
          onReaccionar={onReaccionar}
          esMovil={esMovil}
          vistaMovil={vistaMovil}
          onVolverMovil={onVolverMovil}
        />
      </ErrorBoundary>
      <ModalCrearCanalInterno
        abierto={modalCrearAbierto}
        onCerrar={onCerrarModalCrear}
        onCreado={async (canalCreado?: CanalInterno) => {
          if (canalCreado) {
            onCanalCreado(canalCreado)
            onAutoSeleccionarCanal(canalCreado)
          }
          onRecargarCanales()
        }}
      />
    </>
  )
}

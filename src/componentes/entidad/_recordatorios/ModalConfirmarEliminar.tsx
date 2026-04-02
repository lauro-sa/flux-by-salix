'use client'

import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { textoRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import type { Recordatorio } from './tipos'

/**
 * ModalConfirmarEliminar — Modal de confirmación antes de eliminar
 * un recordatorio recurrente. Muestra el nombre y la frecuencia.
 */

interface ModalConfirmarEliminarProps {
  recordatorio: Recordatorio | null
  onCerrar: () => void
  onConfirmar: (id: string) => void
}

function ModalConfirmarEliminar({ recordatorio, onCerrar, onConfirmar }: ModalConfirmarEliminarProps) {
  return (
    <Modal
      abierto={!!recordatorio}
      onCerrar={onCerrar}
      titulo="Eliminar recordatorio recurrente"
      tamano="sm"
      acciones={
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="peligro" tamano="sm" onClick={() => recordatorio && onConfirmar(recordatorio.id)}>Eliminar</Boton>
        </div>
      }
    >
      {recordatorio && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texto-primario">
            Vas a eliminar <strong>{recordatorio.titulo}</strong> que se repite{' '}
            <strong>
              {recordatorio.recurrencia
                ? textoRecurrencia(recordatorio.recurrencia!).toLowerCase()
                : recordatorio.repetir}
            </strong>.
          </p>
          <p className="text-base text-texto-terciario">
            Se eliminará este recordatorio y no volverá a aparecer. Esta acción no se puede deshacer.
          </p>
        </div>
      )}
    </Modal>
  )
}

export { ModalConfirmarEliminar }

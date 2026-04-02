'use client'

/**
 * ModalRevocacion — Modal de confirmacion para revocar todos los permisos de emergencia.
 * Se usa en: SeccionPermisos (accion destructiva).
 */

import { useState, useCallback } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'

interface PropiedadesModalRevocacion {
  abierto: boolean
  onCerrar: () => void
  onConfirmar: (motivo: string) => Promise<void>
}

export function ModalRevocacion({ abierto, onCerrar, onConfirmar }: PropiedadesModalRevocacion) {
  const [motivoRevocacion, setMotivoRevocacion] = useState('')
  const [revocando, setRevocando] = useState(false)

  const cerrar = useCallback(() => {
    setMotivoRevocacion('')
    onCerrar()
  }, [onCerrar])

  const confirmar = useCallback(async () => {
    if (motivoRevocacion.trim().length < 5) return
    setRevocando(true)
    try {
      await onConfirmar(motivoRevocacion.trim())
      setMotivoRevocacion('')
    } finally {
      setRevocando(false)
    }
  }, [onConfirmar, motivoRevocacion])

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Revocar todos los permisos"
      tamano="sm"
      acciones={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={revocando}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            onClick={confirmar}
            cargando={revocando}
            disabled={motivoRevocacion.trim().length < 5}
          >
            Revocar todo
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-texto-terciario leading-relaxed">
          Esta accion eliminara todos los permisos del usuario y cerrara su sesion.
          Queda registrada en auditoria.
        </p>
        <div>
          <Input
            etiqueta="Motivo (obligatorio)"
            value={motivoRevocacion}
            onChange={(e) => setMotivoRevocacion(e.target.value)}
            placeholder="Ej: Salida de la empresa, conducta inapropiada..."
            formato={null}
            error={motivoRevocacion.length > 0 && motivoRevocacion.trim().length < 5 ? 'Minimo 5 caracteres' : undefined}
          />
        </div>
      </div>
    </Modal>
  )
}

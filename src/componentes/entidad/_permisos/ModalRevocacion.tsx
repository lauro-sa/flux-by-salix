'use client'

/**
 * ModalRevocacion — Modal de confirmacion para revocar todos los permisos de emergencia.
 * Se usa en: SeccionPermisos (accion destructiva).
 */

import { useState, useCallback } from 'react'
import { Boton } from '@/componentes/ui/Boton'
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
          <label className="block text-sm font-medium text-texto-primario mb-1.5">
            Motivo (obligatorio)
          </label>
          <input
            type="text"
            value={motivoRevocacion}
            onChange={(e) => setMotivoRevocacion(e.target.value)}
            placeholder="Ej: Salida de la empresa, conducta inapropiada..."
            className="w-full px-3 py-2 text-sm rounded-md border border-borde-fuerte bg-superficie-tarjeta text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-texto-marca transition-colors"
          />
          {motivoRevocacion.length > 0 && motivoRevocacion.trim().length < 5 && (
            <p className="text-xs mt-1" style={{ color: 'var(--insignia-peligro)' }}>Minimo 5 caracteres</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

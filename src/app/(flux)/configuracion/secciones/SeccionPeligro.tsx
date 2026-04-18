'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'

/**
 * Sección Zona Peligrosa — eliminar empresa.
 * Solo visible para el propietario.
 * Requiere escribir el nombre de la empresa para confirmar.
 */
export function SeccionPeligro() {
  const { empresa } = useEmpresa()
  const { cerrarSesion } = useAuth()

  const [modalEliminar, setModalEliminar] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const nombreCoincide = confirmacion === empresa?.nombre

  const eliminarEmpresa = async () => {
    if (!nombreCoincide) return
    setEliminando(true)

    const res = await fetch('/api/empresas/eliminar', { method: 'DELETE' })

    if (res.ok) {
      await cerrarSesion()
      window.location.href = '/login'
    }

    setEliminando(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-insignia-peligro mb-1">Zona peligrosa</h2>
        <p className="text-base text-texto-terciario">Acciones irreversibles. Procedé con precaución.</p>
      </div>

      <div className="bg-insignia-peligro/5 border border-insignia-peligro/20 rounded-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-insignia-peligro mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-texto-primario mb-1">Eliminar empresa</h3>
            <p className="text-base text-texto-terciario mb-4">
              Esto eliminará permanentemente <strong>{empresa?.nombre}</strong> y todos sus datos:
              miembros, contactos, actividades, documentos, configuraciones. Esta acción no se puede deshacer.
            </p>
            <Boton
              variante="peligro"
              onClick={() => setModalEliminar(true)}
            >
              Eliminar empresa
            </Boton>
          </div>
        </div>
      </div>

      {/* Modal de confirmación con input */}
      {modalEliminar && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => { setModalEliminar(false); setConfirmacion('') }}
          onConfirmar={eliminarEmpresa}
          titulo="¿Eliminar empresa permanentemente?"
          descripcion={`Escribí "${empresa?.nombre}" para confirmar la eliminación.`}
          tipo="peligro"
          etiquetaConfirmar="Eliminar permanentemente"
          cargando={eliminando}
        />
      )}
    </div>
  )
}

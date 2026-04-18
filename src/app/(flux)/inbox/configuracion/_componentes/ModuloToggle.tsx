'use client'

import { Interruptor } from '@/componentes/ui/Interruptor'

/**
 * Toggle visual para activar/desactivar un módulo del inbox.
 * Se usa en la sección General de configuración.
 */
export function ModuloToggle({
  icono, nombre, descripcion, activo, onChange,
}: {
  icono: React.ReactNode
  nombre: string
  descripcion: string
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-card"
      style={{ border: '1px solid var(--borde-sutil)' }}
    >
      <div className="flex-shrink-0">{icono}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>{nombre}</p>
        <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{descripcion}</p>
      </div>
      <Interruptor activo={activo} onChange={onChange} />
    </div>
  )
}

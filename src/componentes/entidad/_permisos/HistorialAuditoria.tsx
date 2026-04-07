'use client'

/**
 * HistorialAuditoria — Timeline de cambios recientes en permisos.
 * Se usa en: SeccionPermisos (zona inferior).
 */

import { Insignia } from '@/componentes/ui/Insignia'
import { useFormato } from '@/hooks/useFormato'
import type { PermisoAuditoria } from '@/tipos/permisos_auditoria'

interface PropiedadesHistorialAuditoria {
  entradas: PermisoAuditoria[]
}

export function HistorialAuditoria({ entradas }: PropiedadesHistorialAuditoria) {
  const { locale } = useFormato()
  if (entradas.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-texto-secundario mb-2">Historial de cambios</h4>
      <div className="space-y-1.5">
        {entradas.slice(0, 5).map((entrada) => (
          <div key={entrada.id} className="flex items-center gap-2 text-xs text-texto-terciario px-3 py-1.5 rounded bg-superficie-tarjeta border border-borde-sutil">
            <Insignia
              color={entrada.accion_tipo === 'revocar_todo' ? 'peligro' : entrada.accion_tipo === 'restablecer_rol' ? 'info' : 'neutro'}
              tamano="sm"
            >
              {entrada.accion_tipo === 'revocar_todo' ? 'Revocado' : entrada.accion_tipo === 'restablecer_rol' ? 'Restablecido' : 'Editado'}
            </Insignia>
            <span>{new Date(entrada.editado_en).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {entrada.motivo && <span className="italic">— {entrada.motivo}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

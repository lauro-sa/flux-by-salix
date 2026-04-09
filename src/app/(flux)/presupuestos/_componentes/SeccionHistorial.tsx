'use client'

/**
 * SeccionHistorial — Muestra el historial de cambios de estado del presupuesto.
 * Se usa en: EditorPresupuesto.tsx
 */

import { History } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { ETIQUETAS_ESTADO } from '@/tipos/presupuesto'
import type { EstadoPresupuesto } from '@/tipos/presupuesto'
import { useFormato } from '@/hooks/useFormato'

interface EntradaHistorial {
  id: string
  estado: string
  fecha: string
  usuario_nombre?: string | null
}

interface PropsSeccionHistorial {
  historial: EntradaHistorial[]
}

export default function SeccionHistorial({ historial }: PropsSeccionHistorial) {
  const formato = useFormato()

  if (historial.length === 0) return null

  return (
    <div className="px-6 py-4 border-t border-borde-sutil">
      <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1 mb-3">
        <History size={12} /> Historial
      </span>
      <div className="space-y-2">
        {historial.map((h) => (
          <div key={h.id} className="flex items-center gap-2 text-xs">
            <Insignia color={COLOR_ESTADO_DOCUMENTO[h.estado] || 'neutro'}>
              {ETIQUETAS_ESTADO[h.estado as EstadoPresupuesto] || h.estado}
            </Insignia>
            <span className="text-texto-terciario">
              {formato.fecha(h.fecha, { corta: true })} {formato.hora(h.fecha)}
            </span>
            {h.usuario_nombre && <span className="text-texto-terciario">— {h.usuario_nombre}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

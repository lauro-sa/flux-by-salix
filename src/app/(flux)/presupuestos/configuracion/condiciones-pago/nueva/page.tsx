'use client'

import { useEffect, useState } from 'react'
import { PaginaEditorCondicionPago } from '@/componentes/entidad/_editor_condicion_pago/PaginaEditorCondicionPago'
import { useToast } from '@/componentes/feedback/Toast'
import type { CondicionPago } from '@/tipos/presupuesto'

export default function PaginaNuevaCondicionPago() {
  const { mostrar } = useToast()
  const [condicionesActuales, setCondicionesActuales] = useState<CondicionPago[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => setCondicionesActuales((data.condiciones_pago as CondicionPago[]) || []))
      .catch(() => mostrar('error', 'Error al cargar'))
      .finally(() => setCargando(false))
  }, [mostrar])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorCondicionPago
      condicion={null}
      condicionesActuales={condicionesActuales}
      rutaVolver="/presupuestos/configuracion/condiciones-pago"
      textoVolver="Condiciones de pago"
    />
  )
}

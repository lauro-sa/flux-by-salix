'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorCondicionPago } from '@/componentes/entidad/_editor_condicion_pago/PaginaEditorCondicionPago'
import { useToast } from '@/componentes/feedback/Toast'
import type { CondicionPago } from '@/tipos/presupuesto'

export default function PaginaEditarCondicionPago() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [condicion, setCondicion] = useState<CondicionPago | null>(null)
  const [condicionesActuales, setCondicionesActuales] = useState<CondicionPago[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch('/api/presupuestos/config')
        const data = await res.json()
        const todas: CondicionPago[] = (data.condiciones_pago as CondicionPago[]) || []
        const encontrada = todas.find(c => c.id === id)
        if (cancelado) return
        if (!encontrada) {
          mostrar('error', 'Condición no encontrada')
          router.replace('/presupuestos/configuracion/condiciones-pago')
          return
        }
        setCondicion(encontrada)
        setCondicionesActuales(todas)
      } catch {
        if (!cancelado) mostrar('error', 'Error al cargar')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (id) cargar()
    return () => { cancelado = true }
  }, [id, mostrar, router])

  if (cargando || !condicion) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando condición...</p>
      </div>
    )
  }

  return (
    <PaginaEditorCondicionPago
      condicion={condicion}
      condicionesActuales={condicionesActuales}
      rutaVolver="/presupuestos/configuracion/condiciones-pago"
      textoVolver="Condiciones de pago"
    />
  )
}

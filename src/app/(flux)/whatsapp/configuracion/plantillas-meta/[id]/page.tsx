'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorPlantillaMeta } from '@/componentes/entidad/_editor_plantilla_meta/PaginaEditorPlantillaMeta'
import { useToast } from '@/componentes/feedback/Toast'
import type { CanalMensajeria } from '@/tipos/inbox'
import type { PlantillaWhatsApp } from '@/tipos/whatsapp'

export default function PaginaEditarPlantillaMeta() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [plantilla, setPlantilla] = useState<PlantillaWhatsApp | null>(null)
  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)

  // Fetcher compartido — se reusa para carga inicial y para el refresh tras
  // re-enviar a Meta (así el timeline/badge/banner reflejan el nuevo estado
  // sin que el usuario tenga que recargar la página).
  const cargar = useCallback(async (mostrarErrores = true) => {
    try {
      const [resP, resC] = await Promise.all([
        fetch('/api/whatsapp/plantillas'),
        fetch('/api/whatsapp/canales'),
      ])
      const [dataP, dataC] = await Promise.all([resP.json(), resC.json()])

      const encontrada: PlantillaWhatsApp | undefined = (dataP.plantillas || []).find(
        (p: PlantillaWhatsApp) => p.id === id,
      )
      if (!encontrada) {
        if (mostrarErrores) mostrar('error', 'Plantilla no encontrada')
        router.replace('/whatsapp/configuracion/plantillas-meta')
        return
      }
      setPlantilla(encontrada)
      setCanales(dataC.canales || [])
    } catch {
      if (mostrarErrores) mostrar('error', 'Error al cargar la plantilla')
    }
  }, [id, mostrar, router])

  useEffect(() => {
    let cancelado = false
    const cargarInicial = async () => {
      setCargando(true)
      await cargar()
      if (!cancelado) setCargando(false)
    }
    if (id) cargarInicial()
    return () => { cancelado = true }
  }, [id, cargar])

  if (cargando || !plantilla) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando plantilla...</p>
      </div>
    )
  }

  return (
    <PaginaEditorPlantillaMeta
      plantilla={plantilla}
      canales={canales}
      rutaVolver="/whatsapp/configuracion/plantillas-meta"
      textoVolver="Plantillas de WhatsApp"
      onRecargar={() => cargar(false)}
    />
  )
}

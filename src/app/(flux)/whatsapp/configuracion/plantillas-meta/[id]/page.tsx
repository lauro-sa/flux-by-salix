'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const [resP, resC] = await Promise.all([
          fetch('/api/whatsapp/plantillas'),
          fetch('/api/whatsapp/canales'),
        ])
        const [dataP, dataC] = await Promise.all([resP.json(), resC.json()])
        if (cancelado) return

        const encontrada: PlantillaWhatsApp | undefined = (dataP.plantillas || []).find(
          (p: PlantillaWhatsApp) => p.id === id,
        )
        if (!encontrada) {
          mostrar('error', 'Plantilla no encontrada')
          router.replace('/whatsapp/configuracion/plantillas-meta')
          return
        }
        setPlantilla(encontrada)
        setCanales(dataC.canales || [])
      } catch {
        if (!cancelado) mostrar('error', 'Error al cargar la plantilla')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (id) cargar()
    return () => { cancelado = true }
  }, [id, mostrar, router])

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
    />
  )
}

'use client'

/**
 * Editar plantilla de correo existente — página completa.
 * Carga la plantilla por id y la pasa a PaginaEditorPlantilla.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorPlantilla } from '@/componentes/entidad/_editor_plantilla/PaginaEditorPlantilla'
import { useToast } from '@/componentes/feedback/Toast'
import type { PlantillaRespuesta } from '@/tipos/inbox'

export default function PaginaEditarPlantillaCorreo() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [plantilla, setPlantilla] = useState<PlantillaRespuesta | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch('/api/correo/plantillas')
        const data = await res.json()
        const encontrada: PlantillaRespuesta | undefined = (data.plantillas || []).find(
          (p: PlantillaRespuesta) => p.id === id,
        )
        if (cancelado) return
        if (!encontrada) {
          mostrar('error', 'Plantilla no encontrada')
          router.replace('/inbox/configuracion/plantillas-correo')
          return
        }
        setPlantilla(encontrada)
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
    <PaginaEditorPlantilla
      plantilla={plantilla}
      rutaVolver="/inbox/configuracion/plantillas-correo"
      textoVolver="Plantillas de correo"
    />
  )
}

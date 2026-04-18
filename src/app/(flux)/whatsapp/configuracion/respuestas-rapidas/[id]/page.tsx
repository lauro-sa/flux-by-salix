'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorRespuestaRapida } from '@/componentes/entidad/_editor_respuesta_rapida/PaginaEditorRespuestaRapida'
import { useToast } from '@/componentes/feedback/Toast'
import type { PlantillaRespuesta } from '@/tipos/inbox'

export default function PaginaEditarRespuestaWhatsApp() {
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
        const res = await fetch('/api/whatsapp/respuestas-rapidas')
        const data = await res.json()
        const encontrada: PlantillaRespuesta | undefined = (data.plantillas || []).find(
          (p: PlantillaRespuesta) => p.id === id,
        )
        if (cancelado) return
        if (!encontrada) {
          mostrar('error', 'Respuesta no encontrada')
          router.replace('/whatsapp/configuracion/respuestas-rapidas')
          return
        }
        setPlantilla(encontrada)
      } catch {
        if (!cancelado) mostrar('error', 'Error al cargar la respuesta')
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
        <p className="text-sm text-texto-terciario">Cargando respuesta...</p>
      </div>
    )
  }

  return (
    <PaginaEditorRespuestaRapida
      plantilla={plantilla}
      canalFijo="whatsapp"
      rutaApi="/api/whatsapp/respuestas-rapidas"
      rutaVolver="/whatsapp/configuracion/respuestas-rapidas"
      textoVolver="Respuestas rápidas"
    />
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaginaEditorPlantillaMeta } from '@/componentes/entidad/_editor_plantilla_meta/PaginaEditorPlantillaMeta'
import type { CanalMensajeria } from '@/tipos/inbox'

export default function PaginaNuevaPlantillaMeta() {
  const searchParams = useSearchParams()
  const canalIdInicial = searchParams.get('canal') || undefined

  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/whatsapp/canales')
      .then(r => r.json())
      .then(d => setCanales(d.canales || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorPlantillaMeta
      plantilla={null}
      canales={canales}
      canalIdInicial={canalIdInicial}
      rutaVolver="/whatsapp/configuracion/plantillas-meta"
      textoVolver="Plantillas de WhatsApp"
    />
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorTipoEvento } from '@/componentes/entidad/_editor_tipo_evento/PaginaEditorTipoEvento'
import { useToast } from '@/componentes/feedback/Toast'
import type { TipoEventoCalendario } from '../../_tipos'

export default function PaginaEditarTipoEvento() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [tipo, setTipo] = useState<TipoEventoCalendario | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch('/api/calendario/config')
        const data = await res.json()
        if (cancelado) return
        const encontrado: TipoEventoCalendario | undefined = (data.tipos || []).find((t: TipoEventoCalendario) => t.id === id)
        if (!encontrado) {
          mostrar('error', 'Tipo no encontrado')
          router.replace('/calendario/configuracion/tipos')
          return
        }
        setTipo(encontrado)
      } catch {
        if (!cancelado) mostrar('error', 'Error al cargar')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (id) cargar()
    return () => { cancelado = true }
  }, [id, mostrar, router])

  if (cargando || !tipo) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorTipoEvento
      tipo={tipo}
      rutaVolver="/calendario/configuracion/tipos"
      textoVolver="Tipos de evento"
    />
  )
}

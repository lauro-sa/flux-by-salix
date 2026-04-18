'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PaginaEditorTipoActividad } from '@/componentes/entidad/_editor_tipo_actividad/PaginaEditorTipoActividad'
import { useToast } from '@/componentes/feedback/Toast'
import type { TipoActividad } from '../../_tipos'
import { MODULOS_DISPONIBLES } from '../../_tipos'

export default function PaginaEditarTipoActividad() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [tipo, setTipo] = useState<TipoActividad | null>(null)
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [miembros, setMiembros] = useState<{ usuario_id: string; nombre: string; apellido: string }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch('/api/actividades/config')
        const data = await res.json()
        if (cancelado) return

        const todos: TipoActividad[] = data.tipos || []
        const encontrado = todos.find(t => t.id === id)
        if (!encontrado) {
          mostrar('error', 'Tipo no encontrado')
          router.replace('/actividades/configuracion/tipos')
          return
        }
        if (encontrado.es_sistema) {
          mostrar('info', 'Los tipos del sistema no se pueden editar')
          router.replace('/actividades/configuracion/tipos')
          return
        }
        setTipo(encontrado)
        setTipos(todos)

        const supabase = crearClienteNavegador()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const empresaId = user.app_metadata?.empresa_activa_id
          if (empresaId) {
            const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
            if (mRes?.length) {
              const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
              setMiembros((perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido })))
            }
          }
        }
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
    <PaginaEditorTipoActividad
      tipo={tipo}
      tipos={tipos}
      miembros={miembros}
      modulosDisponibles={MODULOS_DISPONIBLES}
      rutaVolver="/actividades/configuracion/tipos"
      textoVolver="Tipos de actividad"
    />
  )
}

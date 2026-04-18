'use client'

import { useEffect, useState } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PaginaEditorTipoActividad } from '@/componentes/entidad/_editor_tipo_actividad/PaginaEditorTipoActividad'
import type { TipoActividad } from '../../_tipos'
import { MODULOS_DISPONIBLES } from '../../_tipos'

export default function PaginaNuevoTipoActividad() {
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [miembros, setMiembros] = useState<{ usuario_id: string; nombre: string; apellido: string }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/actividades/config')
        const data = await res.json()
        setTipos(data.tipos || [])

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
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorTipoActividad
      tipo={null}
      tipos={tipos}
      miembros={miembros}
      modulosDisponibles={MODULOS_DISPONIBLES}
      rutaVolver="/actividades/configuracion/tipos"
      textoVolver="Tipos de actividad"
    />
  )
}

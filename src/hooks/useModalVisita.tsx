'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'

/**
 * useModalVisita — Hook reutilizable para abrir ModalVisita desde cualquier contexto.
 * Carga miembros visitadores y config de visitas automáticamente.
 * Se usa en: calendario, actividades, chatter, o cualquier lugar que necesite crear/editar visitas.
 */

import type {
  MiembroVisitador as MiembroVisita,
  ConfigVisitas as ConfigVisita,
  Visita as VisitaExistente,
} from '@/tipos/visita'

export type { MiembroVisita, ConfigVisita, VisitaExistente }

// Datos mínimos para precargar el contacto al crear visita desde otro contexto
// (chatter de presupuesto/orden/factura/contacto). El modal expande al shape completo.
export interface ContactoInicialVisita {
  id: string
  nombre: string
  apellido?: string | null
}

interface OpcionesAbrir {
  visita?: VisitaExistente | null
  contactoInicial?: ContactoInicialVisita | null
}

export function useModalVisita() {
  const { mostrar } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [visitaEditando, setVisitaEditando] = useState<VisitaExistente | null>(null)
  const [contactoInicial, setContactoInicial] = useState<ContactoInicialVisita | null>(null)

  // Cargar miembros visitadores (cache largo)
  const { data: miembros = [] } = useQuery<MiembroVisita[]>({
    queryKey: ['miembros-visitadores'],
    queryFn: async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return []
      const { data: mRes } = await supabase
        .from('miembros')
        .select('usuario_id, rol, permisos_custom')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
      if (!mRes?.length) return []
      const permisosVisitador = ['ver_propio', 'registrar']
      const esVisitador = (m: typeof mRes[0]) => {
        if (m.rol === 'propietario') return true
        if (!m.permisos_custom) return false
        const permisos = m.permisos_custom as Record<string, string[]>
        return permisos.recorrido?.some((p: string) => permisosVisitador.includes(p)) ?? false
      }
      const visitadores = mRes.filter(esVisitador)
      if (!visitadores.length) return []
      const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', visitadores.map(m => m.usuario_id))
      return (perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido }))
    },
    staleTime: 5 * 60_000,
  })

  // Cargar config de visitas (cache largo)
  const { data: config = null } = useQuery<ConfigVisita | null>({
    queryKey: ['config-visitas'],
    queryFn: async () => {
      const res = await fetch('/api/visitas/config')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  // Crear visita
  const crearVisita = useCallback(async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/visitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear visita')
    mostrar('exito', 'Visita creada')
    return res.json()
  }, [mostrar])

  // Editar visita
  const editarVisita = useCallback(async (datos: Record<string, unknown>) => {
    const { id, ...campos } = datos
    const res = await fetch(`/api/visitas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) throw new Error('Error al editar visita')
    mostrar('exito', 'Visita actualizada')
    return res.json()
  }, [mostrar])

  // Completar visita
  const completarVisita = useCallback(async (id: string) => {
    const res = await fetch(`/api/visitas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    if (!res.ok) throw new Error()
    mostrar('exito', 'Visita completada')
  }, [mostrar])

  // Cancelar visita
  const cancelarVisita = useCallback(async (id: string) => {
    const res = await fetch(`/api/visitas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cancelar' }),
    })
    if (!res.ok) throw new Error()
    mostrar('info', 'Visita cancelada')
  }, [mostrar])

  // Abrir modal — para editar (visita) o crear con contacto precargado (contactoInicial).
  // Acepta también la firma vieja `abrir(visita)` por simplicidad de migración interna.
  const abrir = useCallback((opciones?: OpcionesAbrir | VisitaExistente | null) => {
    if (opciones && 'contacto_id' in opciones) {
      // Firma legacy: visita directa
      setVisitaEditando(opciones)
      setContactoInicial(null)
    } else {
      const opts = (opciones || {}) as OpcionesAbrir
      setVisitaEditando(opts.visita || null)
      setContactoInicial(opts.contactoInicial || null)
    }
    setAbierto(true)
  }, [])

  // Cerrar modal
  const cerrar = useCallback(() => {
    setAbierto(false)
    setVisitaEditando(null)
    setContactoInicial(null)
  }, [])

  // Handler unificado para guardar (crear o editar)
  const guardar = useCallback(async (datos: Record<string, unknown>) => {
    if (datos.id) {
      return editarVisita(datos)
    }
    return crearVisita(datos)
  }, [crearVisita, editarVisita])

  return {
    abierto,
    visitaEditando,
    contactoInicial,
    miembros,
    config,
    abrir,
    cerrar,
    guardar,
    completarVisita,
    cancelarVisita,
  }
}

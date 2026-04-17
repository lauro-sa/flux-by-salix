'use client'

/**
 * ModalVisitasContacto — Lista de visitas de un contacto con paginador.
 * Al tocar una visita abre ModalDetalleVisita con toda la info.
 * Se usa en: BarraKPIs al tocar el KPI de visitas.
 */

import { useState, useEffect, useCallback } from 'react'
import { MapPin, ChevronLeft, ChevronRight, Clock, CheckCircle2, X, CalendarClock, Loader2 } from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { ModalDetalleVisita, type DatosVisitaDetalle } from '@/componentes/entidad/_panel_chatter/ModalDetalleVisita'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import type { AdjuntoChatter } from '@/tipos/chatter'

// ── Tipos ──

interface VisitaListado {
  id: string
  contacto_nombre: string
  direccion_texto: string | null
  estado: string
  motivo: string | null
  notas: string | null
  notas_registro: string | null
  resultado: string | null
  temperatura: string | null
  checklist: { id: string; texto: string; completado: boolean }[]
  duracion_estimada_min: number | null
  duracion_real_min: number | null
  fecha_completada: string | null
  fecha_programada: string
  prioridad: string | null
  asignado_nombre: string | null
  editado_por_nombre: string | null
  recibe_nombre: string | null
  recibe_telefono: string | null
  registro_lat: number | null
  registro_lng: number | null
  registro_precision_m: number | null
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  contactoId: string
  contactoNombre: string
}

// ── Colores por estado ──
const COLORES_ESTADO: Record<string, { color: string; etiqueta: string }> = {
  programada: { color: 'var(--estado-pendiente)', etiqueta: 'Programada' },
  en_camino: { color: 'var(--insignia-info)', etiqueta: 'En camino' },
  en_sitio: { color: 'var(--insignia-info)', etiqueta: 'En sitio' },
  completada: { color: 'var(--estado-completado)', etiqueta: 'Completada' },
  cancelada: { color: 'var(--estado-error)', etiqueta: 'Cancelada' },
  reprogramada: { color: 'var(--insignia-advertencia)', etiqueta: 'Reprogramada' },
}

const POR_PAGINA = 10

export function ModalVisitasContacto({ abierto, onCerrar, contactoId, contactoNombre }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const [visitas, setVisitas] = useState<VisitaListado[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(false)

  // Detalle de visita seleccionada
  const [visitaDetalle, setVisitaDetalle] = useState<DatosVisitaDetalle | null>(null)
  const [adjuntosDetalle, setAdjuntosDetalle] = useState<AdjuntoChatter[]>([])
  const [indiceDetalle, setIndiceDetalle] = useState(-1)
  const [autoAbierto, setAutoAbierto] = useState(false)

  const cargarVisitas = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams({
        contacto_id: contactoId,
        vista: 'todas',
        pagina: String(pagina),
        por_pagina: String(POR_PAGINA),
        orden_campo: 'fecha_programada',
        orden_dir: 'desc',
      })
      const resp = await fetch(`/api/visitas?${params}`)
      if (!resp.ok) throw new Error()
      const data = await resp.json()
      setVisitas(data.visitas || [])
      setTotal(data.total || 0)
    } catch {
      setVisitas([])
      setTotal(0)
    } finally {
      setCargando(false)
    }
  }, [contactoId, pagina])

  useEffect(() => {
    if (abierto) {
      setAutoAbierto(false)
      setVisitaDetalle(null)
      cargarVisitas()
    }
  }, [abierto, cargarVisitas])

  // Abrir detalle de una visita — cargar fotos del registro
  const abrirDetalle = useCallback(async (visita: VisitaListado, indice: number) => {
    setIndiceDetalle(indice)
    setVisitaDetalle({
      resultado: visita.resultado,
      notas: visita.notas,
      notas_registro: visita.notas_registro,
      temperatura: visita.temperatura,
      checklist: visita.checklist || [],
      direccion_texto: visita.direccion_texto,
      duracion_real_min: visita.duracion_real_min,
      duracion_estimada_min: visita.duracion_estimada_min,
      fecha_completada: visita.fecha_completada,
      fecha_programada: visita.fecha_programada,
      motivo: visita.motivo,
      contacto_nombre: visita.contacto_nombre,
      contacto_id: contactoId,
      asignado_nombre: visita.asignado_nombre,
      editado_por_nombre: visita.editado_por_nombre,
      prioridad: visita.prioridad,
      recibe_nombre: visita.recibe_nombre,
      recibe_telefono: visita.recibe_telefono,
      registro_lat: visita.registro_lat,
      registro_lng: visita.registro_lng,
      registro_precision_m: visita.registro_precision_m,
    })

    // Cargar fotos desde el registro
    try {
      const resp = await fetch(`/api/recorrido/registro?visita_id=${visita.id}`)
      if (resp.ok) {
        const data = await resp.json()
        setAdjuntosDetalle(
          (data.fotos || []).map((f: { url: string; nombre: string; tipo?: string; tamano?: number }) => ({
            url: f.url,
            nombre: f.nombre,
            tipo: f.tipo || 'image/jpeg',
            tamano: f.tamano,
          }))
        )
      }
    } catch {
      setAdjuntosDetalle([])
    }
  }, [contactoId])

  // Navegar entre visitas en el detalle
  const navegarDetalle = useCallback((dir: -1 | 1) => {
    const nuevoIndice = indiceDetalle + dir
    if (nuevoIndice >= 0 && nuevoIndice < visitas.length) {
      abrirDetalle(visitas[nuevoIndice], nuevoIndice)
    }
  }, [indiceDetalle, visitas, abrirDetalle])

  // Auto-abrir la última visita (primera del array, que viene ordenado desc) — solo una vez
  useEffect(() => {
    if (!cargando && visitas.length > 0 && !autoAbierto) {
      setAutoAbierto(true)
      abrirDetalle(visitas[0], 0)
    }
  }, [cargando, visitas, autoAbierto, abrirDetalle])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  // Formatear fecha
  const formatearFecha = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(formato.locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <ModalDetalleVisita
      abierto={abierto && !!visitaDetalle}
      onCerrar={() => { setVisitaDetalle(null); setAdjuntosDetalle([]); onCerrar() }}
      datosVisita={visitaDetalle ? { ...visitaDetalle, adjuntos: adjuntosDetalle } : undefined}
      navegacion={{
        indice: indiceDetalle >= 0 ? indiceDetalle : 0,
        total: Math.max(visitas.length, 1),
        onAnterior: indiceDetalle > 0 ? () => navegarDetalle(-1) : undefined,
        onSiguiente: indiceDetalle < visitas.length - 1 ? () => navegarDetalle(1) : undefined,
      }}
    />
  )
}

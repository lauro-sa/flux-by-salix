'use client'

/**
 * Selector inline que vincula (o desvincula) una visita previa al
 * presupuesto. La visita aporta dirección, contacto operativo y, más
 * importante, el relevamiento técnico (fotos + notas) que se siembra
 * automáticamente en la OT al generar la orden de venta.
 *
 * Modo de uso:
 *   - Si NO hay visita vinculada (`visitaId === null`) → botón
 *     "Vincular visita" que abre un popover con las visitas del contacto
 *     (más recientes primero). Click en una visita la vincula.
 *   - Si hay visita vinculada → ficha compacta con motivo / fecha /
 *     estado y botones "Cambiar" (mismo popover) y "Quitar" (`onCambiar(null)`).
 *
 * Si `esEditable=false`, solo muestra la ficha en modo lectura (sin
 * botones de cambio).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, ChevronDown, Link2, Loader2, MapPin, X } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

interface Visita {
  id: string
  contacto_id: string | null
  contacto_nombre: string | null
  motivo: string | null
  fecha_programada: string | null
  fecha_completada: string | null
  estado: string | null
  direccion_texto: string | null
}

interface Props {
  contactoId: string | null
  visitaId: string | null
  onCambiar: (visitaId: string | null) => void
  esEditable: boolean
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  programada: 'Programada',
  en_camino: 'En camino',
  llegando: 'Llegando',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  provisoria: 'Provisoria',
}

const ESTADOS_DESTACADOS = new Set(['completada', 'en_curso'])

export default function SelectorVisitaPresupuesto({
  contactoId,
  visitaId,
  onCambiar,
  esEditable,
}: Props) {
  const { fecha } = useFormato()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [visitaActual, setVisitaActual] = useState<Visita | null>(null)
  const [cargandoActual, setCargandoActual] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Carga de la visita actualmente vinculada (para mostrar la ficha) ──
  useEffect(() => {
    if (!visitaId) {
      setVisitaActual(null)
      return
    }
    let cancelado = false
    setCargandoActual(true)
    fetch(`/api/visitas/${visitaId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no_visita'))))
      .then(data => {
        if (cancelado) return
        const v = (data?.visita ?? data) as Visita
        setVisitaActual(v)
      })
      .catch(() => {
        if (!cancelado) setVisitaActual(null)
      })
      .finally(() => {
        if (!cancelado) setCargandoActual(false)
      })
    return () => {
      cancelado = true
    }
  }, [visitaId])

  // ── Carga del listado al abrir el popover ──
  const cargarLista = useCallback(async () => {
    if (!contactoId) {
      setVisitas([])
      return
    }
    setCargandoLista(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/visitas?contacto_id=${encodeURIComponent(contactoId)}&por_pagina=20&orden_campo=fecha_programada&orden_dir=desc`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'No se pudieron cargar las visitas')
      }
      const data = await res.json()
      // El listado puede venir como { visitas } o como { data }; soportamos ambos.
      const lista = (data?.visitas ?? data?.data ?? data ?? []) as Visita[]
      setVisitas(Array.isArray(lista) ? lista : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar visitas')
    } finally {
      setCargandoLista(false)
    }
  }, [contactoId])

  useEffect(() => {
    if (abierto) cargarLista()
  }, [abierto, cargarLista])

  // Cerrar el popover al clickear afuera.
  useEffect(() => {
    if (!abierto) return
    function alClickear(e: MouseEvent) {
      if (!contenedorRef.current) return
      if (!contenedorRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [abierto])

  function vincular(v: Visita) {
    onCambiar(v.id)
    setAbierto(false)
  }

  function desvincular() {
    onCambiar(null)
    setAbierto(false)
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3 relative" ref={contenedorRef}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
          Visita de origen
        </span>
        {esEditable && visitaActual && (
          <button
            type="button"
            onClick={desvincular}
            className="text-[11px] text-texto-terciario hover:text-insignia-peligro inline-flex items-center gap-1"
          >
            <X size={12} />
            Quitar
          </button>
        )}
      </div>

      <div className="mt-2">
        {cargandoActual ? (
          <div className="flex items-center gap-2 text-xs text-texto-terciario">
            <Loader2 size={12} className="animate-spin" />
            Cargando visita…
          </div>
        ) : visitaActual ? (
          <FichaVisita visita={visitaActual} fechaFormat={fecha} />
        ) : (
          <p className="text-xs text-texto-terciario">
            {contactoId
              ? 'Sin visita vinculada. Si el presupuesto nace de una visita técnica, vinculala para heredar el relevamiento a la OT.'
              : 'Seleccioná un contacto para vincular una visita.'}
          </p>
        )}

        {esEditable && contactoId && (
          <button
            type="button"
            onClick={() => setAbierto(v => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-texto-marca hover:text-texto-marca/80"
          >
            <Link2 size={13} />
            {visitaActual ? 'Cambiar visita' : 'Vincular visita'}
            <ChevronDown size={12} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 z-20 rounded-card border border-borde-fuerte bg-superficie-elevada shadow-lg overflow-hidden"
          >
            {cargandoLista ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-texto-terciario">
                <Loader2 size={12} className="animate-spin" />
                Buscando visitas…
              </div>
            ) : error ? (
              <div className="px-3 py-3 text-xs text-insignia-peligro">{error}</div>
            ) : visitas.length === 0 ? (
              <div className="px-3 py-3 text-xs text-texto-terciario">
                Este contacto no tiene visitas registradas.
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-borde-sutil/40">
                {visitas.map(v => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => vincular(v)}
                      disabled={v.id === visitaId}
                      className={`w-full text-left px-3 py-2 hover:bg-superficie-hover transition-colors ${
                        v.id === visitaId ? 'opacity-50 cursor-default' : ''
                      }`}
                    >
                      <FichaVisita visita={v} fechaFormat={fecha} compacta />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FichaVisita({
  visita,
  fechaFormat,
  compacta = false,
}: {
  visita: Visita
  fechaFormat: ReturnType<typeof useFormato>['fecha']
  compacta?: boolean
}) {
  const fechaRef = visita.fecha_completada || visita.fecha_programada
  const motivoTexto = (visita.motivo ?? '').trim() || 'Visita sin motivo'
  const estadoEtiqueta = visita.estado ? ETIQUETAS_ESTADO[visita.estado] || visita.estado : null
  const destacado = visita.estado ? ESTADOS_DESTACADOS.has(visita.estado) : false

  return (
    <div className={compacta ? 'space-y-0.5' : 'space-y-1'}>
      <div className="flex items-center gap-2">
        <p className={`text-sm font-medium text-texto-primario truncate ${compacta ? '' : 'leading-tight'}`}>
          {motivoTexto}
        </p>
        {estadoEtiqueta && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
              destacado
                ? 'bg-insignia-exito/15 text-insignia-exito'
                : 'bg-borde-sutil/30 text-texto-terciario'
            }`}
          >
            {estadoEtiqueta}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-texto-terciario">
        {fechaRef && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} />
            {fechaFormat(fechaRef, { corta: true })}
          </span>
        )}
        {visita.direccion_texto && (
          <span className="inline-flex items-center gap-1 truncate min-w-0">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{visita.direccion_texto}</span>
          </span>
        )}
      </div>
    </div>
  )
}

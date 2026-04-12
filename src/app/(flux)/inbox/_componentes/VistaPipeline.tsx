'use client'

/**
 * VistaPipeline — Vista Kanban de conversaciones del inbox organizadas por etapa.
 * Se usa en: inbox (pestaña Pipeline), tanto para WhatsApp como para Correo.
 * Usa @dnd-kit para drag & drop de tarjetas entre columnas y reordenar columnas.
 * Funciona en PC, mobile y PWA.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useFormato } from '@/hooks/useFormato'
import type { ConversacionConDetalles, EtapaConversacion } from '@/tipos/inbox'
import type { ResultadoValidacion } from './_helpers/validarRequisitosEtapa'
import { validarRequisitosEtapa } from './_helpers/validarRequisitosEtapa'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { AlertCircle, AlertTriangle, MessageSquare } from 'lucide-react'
import { DrawerChat } from './DrawerChat'

// ─── Props ───

interface PropiedadesVistaPipeline {
  tipoCanal: 'whatsapp' | 'correo'
}

// ─── Helpers ───

function tiempoRelativo(fecha: string, locale: string): string {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const dias = Math.floor(hrs / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias}d`
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(fecha))
}

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  return texto.slice(0, max).trimEnd() + '...'
}

const COLORES_PRIORIDAD: Record<string, { fondo: string; texto: string; etiqueta: string }> = {
  urgente: { fondo: 'bg-prioridad-alta-fondo', texto: 'text-prioridad-alta', etiqueta: 'Urgente' },
  alta: { fondo: 'bg-prioridad-media-fondo', texto: 'text-prioridad-media', etiqueta: 'Alta' },
  baja: { fondo: 'bg-prioridad-baja-fondo', texto: 'text-prioridad-baja', etiqueta: 'Baja' },
}

const ID_SIN_ETAPA = '__sin_etapa__'
const INTERVALO_REFRESCO_MS = 30_000

// ─── Tarjeta de conversación (visual) ───

function TarjetaConversacion({ conversacion }: { conversacion: ConversacionConDetalles }) {
  const formato = useFormato()
  const nombreContacto =
    conversacion.contacto?.nombre
      ? `${conversacion.contacto.nombre}${conversacion.contacto.apellido ? ` ${conversacion.contacto.apellido}` : ''}`
      : conversacion.contacto_nombre || conversacion.contacto?.telefono || conversacion.contacto?.whatsapp || 'Sin nombre'

  const ultimoMensaje = conversacion.ultimo_mensaje_texto
    ? truncar(conversacion.ultimo_mensaje_texto, 60)
    : 'Sin mensajes'

  const tiempoUltimoMsg = conversacion.ultimo_mensaje_en ? tiempoRelativo(conversacion.ultimo_mensaje_en, formato.locale) : null
  const prioridad = conversacion.prioridad !== 'normal' ? COLORES_PRIORIDAD[conversacion.prioridad] : null

  return (
    <div className="rounded-lg border p-3 bg-superficie-tarjeta border-borde-sutil hover:border-borde-fuerte transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-texto-primario truncate">{nombreContacto}</span>
        {conversacion.mensajes_sin_leer > 0 && (
          <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-texto-marca text-texto-inverso">
            {conversacion.mensajes_sin_leer}
          </span>
        )}
      </div>
      <p className="text-xs text-texto-secundario leading-relaxed mb-2 line-clamp-2">{ultimoMensaje}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {tiempoUltimoMsg && <span className="text-xs text-texto-terciario">{tiempoUltimoMsg}</span>}
        {prioridad && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${prioridad.fondo} ${prioridad.texto}`}>
            {prioridad.etiqueta}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-borde-sutil">
        <span className="text-xs text-texto-terciario truncate">
          {conversacion.asignado_a_nombre || 'Sin asignar'}
        </span>
      </div>
    </div>
  )
}

// ─── Tarjeta draggable (wrapper con @dnd-kit) ───

function TarjetaDraggable({ conversacion, onClick }: { conversacion: ConversacionConDetalles; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: conversacion.id,
    data: { tipo: 'tarjeta', conversacion },
  })

  const estilo = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={estilo} {...attributes} {...listeners} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}>
      <TarjetaConversacion conversacion={conversacion} />
    </div>
  )
}

// ─── Columna sortable (wrapper con @dnd-kit) ───

function ColumnaSortable({
  colId,
  titulo,
  color,
  esSinEtapa,
  items,
  sobreMi,
  onClickTarjeta,
}: {
  colId: string
  titulo: string
  color: string
  esSinEtapa: boolean
  items: ConversacionConDetalles[]
  sobreMi: boolean
  onClickTarjeta: (conv: ConversacionConDetalles) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${colId}`,
    data: { tipo: 'columna', colId },
    disabled: esSinEtapa,
  })

  const estiloColumna = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const idsItems = useMemo(() => items.map(c => c.id), [items])

  return (
    <div
      ref={setNodeRef}
      style={estiloColumna}
      className="flex flex-col gap-3 min-w-[260px] sm:min-w-[280px] w-[260px] sm:w-[280px] shrink-0"
    >
      {/* Header de columna */}
      <div className="flex items-center gap-1.5 px-1 group">
        {!esSinEtapa && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded opacity-30 group-hover:opacity-70 hover:!opacity-100 transition-opacity touch-none"
            title="Arrastrar para reordenar columna"
          >
            <GripVertical size={14} className="text-texto-terciario" />
          </div>
        )}
        {color && <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <span className="text-sm font-semibold text-texto-primario">{titulo}</span>
        <span className="text-xs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* Zona de tarjetas */}
      <SortableContext items={idsItems} strategy={horizontalListSortingStrategy}>
        <div
          className={`flex flex-col gap-2 min-h-[120px] rounded-xl p-1.5 transition-all duration-200 ${
            sobreMi
              ? 'bg-texto-marca/10 border-2 border-dashed border-texto-marca/50'
              : 'border-2 border-transparent'
          }`}
        >
          {items.map((conv) => (
            <TarjetaDraggable
              key={conv.id}
              conversacion={conv}
              onClick={() => onClickTarjeta(conv)}
            />
          ))}

          {items.length === 0 && !sobreMi && (
            <div className="text-xs text-texto-terciario text-center py-8 border border-dashed border-borde-sutil rounded-lg">
              Sin conversaciones
            </div>
          )}
          {sobreMi && items.length === 0 && (
            <div className="text-xs text-texto-marca text-center py-8 border-2 border-dashed border-texto-marca/50 rounded-lg font-medium">
              Soltar aquí
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Esqueleto de carga ───

function EsqueletoCarga() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 min-w-[260px] sm:min-w-[280px] w-[260px] sm:w-[280px] shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="size-2.5 rounded-full bg-superficie-hover animate-pulse" />
            <div className="h-4 w-24 rounded bg-superficie-hover animate-pulse" />
            <div className="h-4 w-6 rounded-full bg-superficie-hover animate-pulse" />
          </div>
          {Array.from({ length: 3 - i }).map((_, j) => (
            <div key={j} className="rounded-lg border border-borde-sutil p-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-superficie-hover animate-pulse" />
              <div className="h-3 w-full rounded bg-superficie-hover animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-superficie-hover animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ───

export default function VistaPipeline({ tipoCanal }: PropiedadesVistaPipeline) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [etapas, setEtapas] = useState<EtapaConversacion[]>([])
  const [conversaciones, setConversaciones] = useState<ConversacionConDetalles[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drawer chat flotante
  const [convDrawer, setConvDrawer] = useState<ConversacionConDetalles | null>(null)

  // Validacion de etapa (modales)
  const [modalValidacion, setModalValidacion] = useState<{
    convId: string
    etapa: EtapaConversacion
    resultado: ResultadoValidacion
    tipo: 'bloqueante' | 'advertencia'
  } | null>(null)

  const [modalMotivo, setModalMotivo] = useState<{
    convId: string
    etapa: EtapaConversacion
  } | null>(null)
  const [textoMotivo, setTextoMotivo] = useState('')
  const [enviandoMotivo, setEnviandoMotivo] = useState(false)

  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragTipo, setActiveDragTipo] = useState<'tarjeta' | 'columna' | null>(null)
  const [columnaHoverId, setColumnaHoverId] = useState<string | null>(null)

  // Sensores: pointer con distancia mínima (para no interferir con click) + touch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ─── Carga de datos ───

  const cargarDatos = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true)
      setError(null)

      const [resEtapas, resConversaciones] = await Promise.all([
        fetch(`/api/inbox/etapas?tipo_canal=${tipoCanal}`),
        fetch(`/api/inbox/conversaciones?tipo_canal=${tipoCanal}`),
      ])

      if (!resEtapas.ok) throw new Error('Error al cargar etapas')
      if (!resConversaciones.ok) throw new Error('Error al cargar conversaciones')

      const dataEtapas = await resEtapas.json()
      const dataConversaciones = await resConversaciones.json()

      setEtapas(dataEtapas.etapas || dataEtapas || [])
      setConversaciones(dataConversaciones.conversaciones || dataConversaciones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [tipoCanal])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    intervaloRef.current = setInterval(() => cargarDatos(true), INTERVALO_REFRESCO_MS)
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current) }
  }, [cargarDatos])

  // ─── Columnas ───

  const columnasOrdenadas = useMemo(() => {
    const activas = etapas.filter(e => e.activa).sort((a, b) => a.orden - b.orden)
    return [
      { id: ID_SIN_ETAPA, titulo: 'Sin etapa', color: '#9ca3af' },
      ...activas.map(e => ({ id: e.id, titulo: e.etiqueta, color: e.color })),
    ]
  }, [etapas])

  const idsColumnas = useMemo(() => columnasOrdenadas.map(c => `col-${c.id}`), [columnasOrdenadas])

  const itemsPorColumna = useMemo(() => {
    const mapa: Record<string, ConversacionConDetalles[]> = {}
    for (const col of columnasOrdenadas) mapa[col.id] = []
    for (const conv of conversaciones) {
      const colId = conv.etapa_id || ID_SIN_ETAPA
      if (mapa[colId]) mapa[colId].push(conv)
      else mapa[ID_SIN_ETAPA]?.push(conv)
    }
    return mapa
  }, [conversaciones, columnasOrdenadas])

  // ─── Navegación ───

  const abrirConversacion = useCallback((conv: ConversacionConDetalles) => {
    setConvDrawer(conv)
  }, [])

  // ─── Mover tarjeta (PATCH) — reutilizable desde drag y modales ───

  const moverConversacionAEtapa = useCallback(async (convId: string, nuevaEtapaId: string | null, notaEtapa?: string) => {
    // Actualizacion optimista
    setConversaciones(prev => prev.map(c =>
      c.id === convId ? { ...c, etapa_id: nuevaEtapaId } : c,
    ))

    try {
      const cuerpo: Record<string, unknown> = { etapa_id: nuevaEtapaId }
      if (notaEtapa) cuerpo.nota_etapa = notaEtapa

      const res = await fetch(`/api/inbox/conversaciones/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      if (!res.ok) throw new Error()
    } catch {
      cargarDatos(true)
    }
  }, [cargarDatos])

  // ─── Drag handlers ───

  // Encontrar a qué columna pertenece un id (puede ser tarjeta o columna)
  const encontrarColumnaDeItem = useCallback((id: string): string | null => {
    // Es una columna?
    if (id.startsWith('col-')) return id.replace('col-', '')
    // Es una tarjeta? Buscar en qué columna está
    for (const [colId, items] of Object.entries(itemsPorColumna)) {
      if (items.some(c => c.id === id)) return colId
    }
    return null
  }, [itemsPorColumna])

  const onDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const tipo = active.data.current?.tipo as 'tarjeta' | 'columna' | undefined
    setActiveDragId(String(active.id))
    setActiveDragTipo(tipo || null)
  }, [])

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) { setColumnaHoverId(null); return }

    const tipoActivo = active.data.current?.tipo
    if (tipoActivo !== 'tarjeta') return

    // Determinar la columna destino
    const overTipo = over.data.current?.tipo
    let colDestinoId: string | null = null

    if (overTipo === 'columna') {
      colDestinoId = over.data.current?.colId
    } else {
      // Está sobre otra tarjeta → encontrar su columna
      colDestinoId = encontrarColumnaDeItem(String(over.id))
    }

    if (colDestinoId) setColumnaHoverId(colDestinoId)
  }, [encontrarColumnaDeItem])

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setActiveDragTipo(null)
    setColumnaHoverId(null)

    if (!over) return

    const tipoActivo = active.data.current?.tipo

    // ─── Reordenar columnas ───
    if (tipoActivo === 'columna') {
      const activeColId = active.data.current?.colId as string
      const overColId = over.data.current?.colId as string
      if (!activeColId || !overColId || activeColId === overColId) return

      const activas = etapas.filter(e => e.activa).sort((a, b) => a.orden - b.orden)
      const idxOrigen = activas.findIndex(e => e.id === activeColId)
      const idxDestino = activas.findIndex(e => e.id === overColId)
      if (idxOrigen === -1 || idxDestino === -1) return

      const nuevas = arrayMove(activas, idxOrigen, idxDestino).map((e, i) => ({ ...e, orden: i }))

      // Optimista
      setEtapas(prev => prev.map(e => {
        const act = nuevas.find(n => n.id === e.id)
        return act ? { ...e, orden: act.orden } : e
      }))

      // Persistir
      try {
        await Promise.all(nuevas.map(e =>
          fetch('/api/inbox/etapas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: e.id, orden: e.orden }),
          })
        ))
      } catch { cargarDatos(true) }
      return
    }

    // ─── Mover tarjeta a otra columna ───
    if (tipoActivo === 'tarjeta') {
      const convId = String(active.id)
      let colDestinoId: string | null = null

      if (over.data.current?.tipo === 'columna') {
        colDestinoId = over.data.current?.colId
      } else {
        colDestinoId = encontrarColumnaDeItem(String(over.id))
      }

      if (!colDestinoId) return

      const colOrigenId = encontrarColumnaDeItem(convId)
      if (colOrigenId === colDestinoId) return

      const nuevaEtapaId = colDestinoId === ID_SIN_ETAPA ? null : colDestinoId

      // Validar requisitos de la etapa destino
      const etapaDestino = etapas.find(e => e.id === nuevaEtapaId)
      if (etapaDestino?.requisitos?.length) {
        const conv = conversaciones.find(c => c.id === convId)
        if (conv) {
          const resultado = validarRequisitosEtapa(conv, etapaDestino.requisitos)
          if (resultado.estrictos.length > 0) {
            setModalValidacion({ convId, etapa: etapaDestino, resultado, tipo: 'bloqueante' })
            return // No mover — requisitos estrictos fallan
          }
          if (resultado.recomendados.length > 0) {
            setModalValidacion({ convId, etapa: etapaDestino, resultado, tipo: 'advertencia' })
            return // Esperar confirmacion del usuario
          }
        }
      }

      // Verificar si la etapa requiere motivo (accion pedir_motivo)
      if (etapaDestino?.acciones_auto?.some(a => a.tipo === 'pedir_motivo')) {
        setModalMotivo({ convId, etapa: etapaDestino })
        setTextoMotivo('')
        return // Esperar input del motivo
      }

      await moverConversacionAEtapa(convId, nuevaEtapaId)
    }
  }, [etapas, conversaciones, encontrarColumnaDeItem, moverConversacionAEtapa])

  // ─── Overlay (lo que se ve mientras arrastrás) ───

  const activeDragConv = activeDragTipo === 'tarjeta'
    ? conversaciones.find(c => c.id === activeDragId)
    : null

  const activeDragCol = activeDragTipo === 'columna'
    ? columnasOrdenadas.find(c => `col-${c.id}` === activeDragId)
    : null

  // ─── Render ───

  if (error && !cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm text-texto-secundario text-center max-w-md">{error}</p>
        <button onClick={() => cargarDatos()} className="text-sm text-texto-marca hover:underline font-medium">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Texto de ayuda */}
      <div className="flex items-start gap-2 px-1">
        <span className="text-texto-terciario text-sm shrink-0 mt-0.5">ℹ️</span>
        <p className="text-xs text-texto-terciario leading-relaxed">
          <span className="font-medium text-texto-secundario">Vista Pipeline</span> — Arrastrá las conversaciones entre columnas para cambiar su etapa. Arrastrá las columnas del ícono ⠿ para reordenarlas.
        </p>
      </div>

      {cargando ? (
        <EsqueletoCarga />
      ) : etapas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl">🏗️</span>
          <p className="text-sm text-texto-secundario text-center max-w-sm leading-relaxed">
            No hay etapas configuradas para este canal. Configura las etapas del pipeline desde la configuración del inbox.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={idsColumnas} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
              {columnasOrdenadas.map((col) => (
                <ColumnaSortable
                  key={col.id}
                  colId={col.id}
                  titulo={col.titulo}
                  color={col.color}
                  esSinEtapa={col.id === ID_SIN_ETAPA}
                  items={itemsPorColumna[col.id] || []}
                  sobreMi={columnaHoverId === col.id && activeDragTipo === 'tarjeta'}
                  onClickTarjeta={abrirConversacion}
                />
              ))}
            </div>
          </SortableContext>

          {/* Overlay: lo que sigue al cursor mientras arrastrás */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDragConv && (
              <div className="rotate-2 scale-105 shadow-lg rounded-lg">
                <TarjetaConversacion conversacion={activeDragConv} />
              </div>
            )}
            {activeDragCol && (
              <div className="bg-superficie-elevada border border-borde-fuerte rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
                <GripVertical size={14} className="text-texto-terciario" />
                <div className="size-2.5 rounded-full" style={{ backgroundColor: activeDragCol.color }} />
                <span className="text-sm font-semibold text-texto-primario">{activeDragCol.titulo}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ─── Modal: Validacion bloqueante (requisitos estrictos) ─── */}
      <Modal
        abierto={!!modalValidacion && modalValidacion.tipo === 'bloqueante'}
        onCerrar={() => setModalValidacion(null)}
        titulo={`No se puede mover a "${modalValidacion?.etapa.etiqueta}"`}
        tamano="sm"
        acciones={
          <Boton variante="secundario" onClick={() => setModalValidacion(null)}>
            Cerrar
          </Boton>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-insignia-peligro mb-1">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">Requisitos obligatorios no cumplidos</span>
          </div>
          <ul className="flex flex-col gap-2">
            {modalValidacion?.resultado.estrictos.map((req) => (
              <li key={req.campo} className="flex items-center gap-2 text-sm text-texto-secundario bg-insignia-peligro/8 rounded-lg px-3 py-2">
                <span className="text-base">{req.icono}</span>
                <span>{req.nombre}</span>
              </li>
            ))}
          </ul>
          {(modalValidacion?.resultado.recomendados.length ?? 0) > 0 && (
            <>
              <div className="flex items-center gap-2 text-insignia-advertencia mt-2 mb-1">
                <AlertTriangle size={16} />
                <span className="text-xs font-medium">Tambien recomendados</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {modalValidacion?.resultado.recomendados.map((req) => (
                  <li key={req.campo} className="flex items-center gap-2 text-sm text-texto-terciario px-3 py-1.5">
                    <span className="text-base">{req.icono}</span>
                    <span>{req.nombre}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Modal>

      {/* ─── Modal: Validacion advertencia (requisitos recomendados) ─── */}
      <Modal
        abierto={!!modalValidacion && modalValidacion.tipo === 'advertencia'}
        onCerrar={() => setModalValidacion(null)}
        titulo={`Mover a "${modalValidacion?.etapa.etiqueta}"?`}
        tamano="sm"
        acciones={
          <div className="flex gap-3 w-full">
            <Boton variante="secundario" anchoCompleto onClick={() => setModalValidacion(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="advertencia"
              anchoCompleto
              onClick={async () => {
                if (!modalValidacion) return
                const { convId, etapa } = modalValidacion
                const nuevaEtapaId = etapa.id
                setModalValidacion(null)

                // Verificar si tambien requiere motivo
                if (etapa.acciones_auto?.some(a => a.tipo === 'pedir_motivo')) {
                  setModalMotivo({ convId, etapa })
                  setTextoMotivo('')
                  return
                }

                await moverConversacionAEtapa(convId, nuevaEtapaId)
              }}
            >
              Mover de todos modos
            </Boton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-insignia-advertencia mb-1">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">Requisitos recomendados no cumplidos</span>
          </div>
          <ul className="flex flex-col gap-2">
            {modalValidacion?.resultado.recomendados.map((req) => (
              <li key={req.campo} className="flex items-center gap-2 text-sm text-texto-secundario bg-insignia-advertencia/8 rounded-lg px-3 py-2">
                <span className="text-base">{req.icono}</span>
                <span>{req.nombre}</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* ─── Modal: Motivo para mover a etapa ─── */}
      <Modal
        abierto={!!modalMotivo}
        onCerrar={() => { setModalMotivo(null); setTextoMotivo(''); setEnviandoMotivo(false) }}
        titulo={`Motivo para mover a "${modalMotivo?.etapa.etiqueta}"`}
        tamano="sm"
        acciones={
          <div className="flex gap-3 w-full">
            <Boton
              variante="secundario"
              anchoCompleto
              onClick={() => { setModalMotivo(null); setTextoMotivo(''); setEnviandoMotivo(false) }}
              disabled={enviandoMotivo}
            >
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              anchoCompleto
              disabled={textoMotivo.trim().length < 5 || enviandoMotivo}
              cargando={enviandoMotivo}
              onClick={async () => {
                if (!modalMotivo || textoMotivo.trim().length < 5) return
                setEnviandoMotivo(true)
                const { convId, etapa } = modalMotivo
                await moverConversacionAEtapa(convId, etapa.id, textoMotivo.trim())
                setModalMotivo(null)
                setTextoMotivo('')
                setEnviandoMotivo(false)
              }}
            >
              Confirmar
            </Boton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-texto-secundario mb-1">
            <MessageSquare size={18} />
            <span className="text-sm font-medium">Escribe el motivo del cambio de etapa</span>
          </div>
          <textarea
            className="w-full rounded-lg border border-borde-sutil bg-superficie-tarjeta text-texto-primario text-sm px-3 py-2.5 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-texto-marca/30 focus:border-texto-marca transition-colors placeholder:text-texto-terciario"
            placeholder="Escribe el motivo (minimo 5 caracteres)..."
            value={textoMotivo}
            onChange={(e) => setTextoMotivo(e.target.value)}
            autoFocus
          />
          {textoMotivo.length > 0 && textoMotivo.trim().length < 5 && (
            <p className="text-xs text-insignia-peligro">Minimo 5 caracteres</p>
          )}
        </div>
      </Modal>

      {/* Drawer de chat flotante */}
      <DrawerChat
        conversacion={convDrawer}
        tipoCanal={tipoCanal}
        abierto={!!convDrawer}
        onCerrar={() => setConvDrawer(null)}
        onEtapaCambiada={(convId, etapaId) => {
          // Actualización optimista en el pipeline
          setConversaciones(prev => prev.map(c =>
            c.id === convId ? { ...c, etapa_id: etapaId } : c,
          ))
          // Actualizar también el drawer
          setConvDrawer(prev => prev && prev.id === convId ? { ...prev, etapa_id: etapaId } : prev)
        }}
      />
    </div>
  )
}

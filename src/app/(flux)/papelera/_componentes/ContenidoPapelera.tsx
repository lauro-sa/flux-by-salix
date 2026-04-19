'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trash2, RotateCcw, Clock, User, FileText, Package,
  Zap, Search, X, MapPin, StickyNote, AlertTriangle,
  MessageCircle, CalendarDays, Route,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Tabs } from '@/componentes/ui/Tabs'
import { Insignia } from '@/componentes/ui/Insignia'
import { Avatar } from '@/componentes/ui/Avatar'
import { normalizarBusqueda } from '@/lib/validaciones'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SkeletonLista } from '@/componentes/feedback/SkeletonTabla'
import { useAuth } from '@/hooks/useAuth'
import { useRol } from '@/hooks/useRol'
import { usePreferencias } from '@/hooks/usePreferencias'

/**
 * ContenidoPapelera — Papelera unificada de Flux.
 * Muestra todos los elementos eliminados con:
 * - Fecha de eliminación y días restantes antes de purga automática (30 días)
 * - Quién eliminó (visible para admins)
 * - Botones de restaurar y eliminar siempre visibles
 * - Filtros por tipo de entidad
 *
 * Visibilidad:
 * - Usuarios normales: solo ven lo que ellos eliminaron
 * - Admins/Propietarios: ven todo lo de la empresa
 */

/** Días antes de purga automática */
const DIAS_RETENCION = 30

type TipoEntidad = 'contactos' | 'presupuestos' | 'actividades' | 'productos' | 'visitas' | 'notas' | 'conversaciones' | 'eventos' | 'recorridos'

export interface ElementoPapelera {
  id: string
  nombre: string
  tipo: TipoEntidad
  eliminado_en: string
  eliminado_por: string | null
  eliminado_por_nombre: string | null
  subtitulo?: string
}

/** Orden por defecto — respeta el orden del sidebar (itemsNav.ts) */
const TABS_ENTIDAD: { id: string; etiqueta: string; icono?: React.ReactNode }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'contactos', etiqueta: 'Contactos', icono: <User size={13} /> },
  { id: 'actividades', etiqueta: 'Actividades', icono: <Zap size={13} /> },
  { id: 'visitas', etiqueta: 'Visitas', icono: <MapPin size={13} /> },
  { id: 'productos', etiqueta: 'Productos', icono: <Package size={13} /> },
  { id: 'presupuestos', etiqueta: 'Presupuestos', icono: <FileText size={13} /> },
  { id: 'notas', etiqueta: 'Notas', icono: <StickyNote size={13} /> },
  { id: 'conversaciones', etiqueta: 'Conversaciones', icono: <MessageCircle size={13} /> },
  { id: 'eventos', etiqueta: 'Eventos', icono: <CalendarDays size={13} /> },
  { id: 'recorridos', etiqueta: 'Recorridos', icono: <Route size={13} /> },
]

const ICONO_ENTIDAD: Record<TipoEntidad, typeof User> = {
  contactos: User,
  presupuestos: FileText,
  actividades: Zap,
  productos: Package,
  visitas: MapPin,
  notas: StickyNote,
  conversaciones: MessageCircle,
  eventos: CalendarDays,
  recorridos: Route,
}

const COLOR_TIPO: Record<TipoEntidad, string> = {
  contactos: 'neutro',
  presupuestos: 'info',
  actividades: 'violeta',
  productos: 'cyan',
  visitas: 'naranja',
  notas: 'advertencia',
  conversaciones: 'exito',
  eventos: 'primario',
  recorridos: 'rosa',
}

const ETIQUETA_ENTIDAD: Record<TipoEntidad, string> = {
  contactos: 'Contacto',
  presupuestos: 'Presupuesto',
  actividades: 'Actividad',
  productos: 'Producto',
  visitas: 'Visita',
  notas: 'Nota',
  conversaciones: 'Conversación',
  eventos: 'Evento',
  recorridos: 'Recorrido',
}

/** Calcula días desde una fecha */
function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24))
}

/** Formato de fecha legible */
function formatoFecha(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Texto de cuándo se eliminó: hoy, ayer, día de la semana, o fecha directa */
function textoTiempo(fecha: string): string {
  const d = new Date(fecha)
  const dias = diasDesde(fecha)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  // Menos de 7 días: día de la semana (El lunes, El martes...)
  if (dias < 7) {
    return `El ${d.toLocaleDateString('es-AR', { weekday: 'long' })}`
  }
  // 7+ días: fecha directa
  return formatoFecha(fecha)
}

interface Props {
  datosIniciales: ElementoPapelera[]
}

export default function ContenidoPapelera({ datosIniciales }: Props) {
  const { usuario } = useAuth()
  const { esPropietario, esAdmin } = useRol()
  const { preferencias } = usePreferencias()

  const queryClient = useQueryClient()

  const [filtro, setFiltro] = useState<'todos' | TipoEntidad>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<ElementoPapelera | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const puedeVerTodos = esPropietario || esAdmin

  // React Query — siempre refetcha al montar para datos frescos
  const { data: elementos = [], isLoading: cargando } = useQuery({
    queryKey: ['papelera'],
    queryFn: async () => {
      const [contactosRes, presupuestosRes, actividadesRes, productosRes, visitasRes, notasRes, conversacionesRes, eventosRes, recorridosRes] = await Promise.all([
        fetch('/api/contactos?en_papelera=true').then(r => r.ok ? r.json() : { contactos: [] }),
        fetch('/api/presupuestos?en_papelera=true').then(r => r.ok ? r.json() : { presupuestos: [] }),
        fetch('/api/actividades?en_papelera=true').then(r => r.ok ? r.json() : { actividades: [] }),
        fetch('/api/productos?en_papelera=true').then(r => r.ok ? r.json() : { productos: [] }),
        fetch('/api/visitas?en_papelera=true').then(r => r.ok ? r.json() : { visitas: [] }),
        fetch('/api/notas-rapidas?en_papelera=true').then(r => r.ok ? r.json() : { notas: [] }),
        fetch('/api/inbox/conversaciones?papelera=true').then(r => r.ok ? r.json() : { conversaciones: [] }),
        fetch('/api/calendario/papelera').then(r => r.ok ? r.json() : { eventos: [] }),
        fetch('/api/recorrido/papelera').then(r => r.ok ? r.json() : { recorridos: [] }),
      ])

      const resultados: ElementoPapelera[] = []

      // Recolectar IDs de usuarios que eliminaron para resolver nombres
      const idsUsuarios = new Set<string>()
      const recolectar = (items: Record<string, unknown>[], campo: string) => {
        for (const item of items) { if (item[campo]) idsUsuarios.add(item[campo] as string) }
      }
      recolectar(contactosRes?.contactos || [], 'editado_por')
      recolectar(presupuestosRes?.presupuestos || [], 'editado_por')
      recolectar(actividadesRes?.actividades || [], 'editado_por')
      recolectar(productosRes?.productos || [], 'editado_por')
      recolectar(visitasRes?.visitas || [], 'editado_por')
      recolectar(notasRes?.notas || [], 'actualizado_por')
      recolectar(conversacionesRes?.conversaciones || [], 'actualizado_por')
      recolectar(eventosRes?.eventos || [], 'editado_por')
      recolectar(recorridosRes?.recorridos || [], 'creado_por')

      // Resolver nombres de quienes eliminaron
      const nombresUsuarios: Record<string, string> = {}
      try {
        // Miembros de la empresa (excluye usuario actual)
        const miembrosRes = await fetch('/api/notas-rapidas/miembros')
        if (miembrosRes.ok) {
          const miembros = await miembrosRes.json()
          for (const m of (Array.isArray(miembros) ? miembros : [])) {
            nombresUsuarios[m.usuario_id] = [m.nombre, m.apellido].filter(Boolean).join(' ') || 'Usuario'
          }
        }
      } catch { /* silenciar */ }
      // El usuario actual (lo agrega desde user_metadata de Supabase Auth)
      if (usuario?.id && !nombresUsuarios[usuario.id]) {
        const meta = usuario.user_metadata
        const nombre = meta?.nombre || meta?.full_name || meta?.name
        const apellido = meta?.apellido || ''
        nombresUsuarios[usuario.id] = [nombre, apellido].filter(Boolean).join(' ') || usuario.email?.split('@')[0] || 'Yo'
      }

      for (const c of (contactosRes?.contactos || [])) {
        resultados.push({
          id: c.id,
          nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
          tipo: 'contactos',
          eliminado_en: c.papelera_en || c.actualizado_en,
          eliminado_por: c.editado_por,
          eliminado_por_nombre: nombresUsuarios[c.editado_por] || null,
          subtitulo: c.correo || c.telefono || c.codigo,
        })
      }

      for (const p of (presupuestosRes?.presupuestos || [])) {
        resultados.push({
          id: p.id,
          nombre: p.titulo || p.codigo || 'Sin título',
          tipo: 'presupuestos',
          eliminado_en: p.papelera_en || p.actualizado_en,
          eliminado_por: p.editado_por,
          eliminado_por_nombre: nombresUsuarios[p.editado_por] || null,
          subtitulo: p.codigo,
        })
      }

      for (const a of (actividadesRes?.actividades || [])) {
        resultados.push({
          id: a.id,
          nombre: a.titulo || a.asunto || 'Sin título',
          tipo: 'actividades',
          eliminado_en: a.papelera_en || a.actualizado_en,
          eliminado_por: a.editado_por,
          eliminado_por_nombre: nombresUsuarios[a.editado_por] || null,
          subtitulo: a.tipo,
        })
      }

      for (const p of (productosRes?.productos || [])) {
        resultados.push({
          id: p.id,
          nombre: p.nombre || 'Sin nombre',
          tipo: 'productos',
          eliminado_en: p.papelera_en || p.actualizado_en,
          eliminado_por: p.editado_por,
          eliminado_por_nombre: nombresUsuarios[p.editado_por] || null,
          subtitulo: p.codigo || p.sku,
        })
      }

      for (const v of (visitasRes?.visitas || [])) {
        resultados.push({
          id: v.id,
          nombre: v.titulo || 'Sin título',
          tipo: 'visitas',
          eliminado_en: v.papelera_en || v.actualizado_en,
          eliminado_por: v.editado_por,
          eliminado_por_nombre: nombresUsuarios[v.editado_por] || null,
          subtitulo: v.contacto_nombre || v.estado,
        })
      }

      for (const n of (notasRes?.notas || [])) {
        const uid = n.actualizado_por || n.creador_id
        const preview = n.contenido ? n.contenido.slice(0, 60) : ''
        resultados.push({
          id: n.id,
          nombre: n.titulo || preview || 'Sin título',
          tipo: 'notas',
          eliminado_en: n.papelera_en || n.actualizado_en,
          eliminado_por: uid,
          eliminado_por_nombre: nombresUsuarios[uid] || null,
          subtitulo: n.titulo ? preview : undefined,
        })
      }

      for (const c of (conversacionesRes?.conversaciones || [])) {
        const uid = c.actualizado_por
        const canal = c.tipo_canal === 'whatsapp' ? 'WhatsApp' : c.tipo_canal === 'correo' ? 'Correo' : 'Chat'
        resultados.push({
          id: c.id,
          nombre: c.contacto_nombre || c.remitente_nombre || c.asunto || 'Sin nombre',
          tipo: 'conversaciones',
          eliminado_en: c.papelera_en || c.actualizado_en,
          eliminado_por: uid,
          eliminado_por_nombre: nombresUsuarios[uid] || null,
          subtitulo: canal,
        })
      }

      for (const e of (eventosRes?.eventos || [])) {
        resultados.push({
          id: e.id,
          nombre: e.titulo || 'Sin título',
          tipo: 'eventos',
          eliminado_en: e.papelera_en || e.actualizado_en,
          eliminado_por: e.editado_por,
          eliminado_por_nombre: nombresUsuarios[e.editado_por] || null,
          subtitulo: e.tipo_clave || undefined,
        })
      }

      for (const r of (recorridosRes?.recorridos || [])) {
        resultados.push({
          id: r.id,
          nombre: `Recorrido ${r.fecha}`,
          tipo: 'recorridos',
          eliminado_en: r.papelera_en || r.actualizado_en,
          eliminado_por: r.creado_por,
          eliminado_por_nombre: nombresUsuarios[r.creado_por] || null,
          subtitulo: r.asignado_nombre,
        })
      }

      resultados.sort((a, b) => new Date(b.eliminado_en).getTime() - new Date(a.eliminado_en).getTime())

      return resultados
    },
    initialData: datosIniciales,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Mapeo de tipo a ruta API
  const rutaApi = (tipo: TipoEntidad) => {
    if (tipo === 'notas') return 'notas-rapidas'
    if (tipo === 'conversaciones') return 'inbox/conversaciones'
    if (tipo === 'eventos') return 'calendario'
    if (tipo === 'recorridos') return 'recorrido'
    return tipo
  }

  /** Restaurar un elemento */
  const restaurar = useCallback(async (elem: ElementoPapelera) => {
    setRestaurando(elem.id)
    try {
      const url = `/api/${rutaApi(elem.tipo)}/${elem.id}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: false }),
      })
      if (res.ok) {
        queryClient.setQueryData(['papelera'], (prev: ElementoPapelera[] | undefined) =>
          (prev || []).filter(e => e.id !== elem.id)
        )
      }
    } catch { /* silenciar */ }
    setRestaurando(null)
  }, [queryClient])

  /** Eliminar definitivamente */
  const eliminarDefinitivo = useCallback(async (elem: ElementoPapelera) => {
    setEliminando(true)
    try {
      const url = `/api/${rutaApi(elem.tipo)}/${elem.id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        queryClient.setQueryData(['papelera'], (prev: ElementoPapelera[] | undefined) =>
          (prev || []).filter(e => e.id !== elem.id)
        )
      }
    } catch { /* silenciar */ }
    setEliminando(false)
    setConfirmacionEliminar(null)
  }, [queryClient])

  // Filtrar por visibilidad (admins ven todo, usuarios solo lo suyo)
  const elementosVisibles = puedeVerTodos
    ? elementos
    : elementos.filter(e => e.eliminado_por === usuario?.id)

  // Filtrar por tab y búsqueda (case + accent insensitive)
  const elementosFiltrados = elementosVisibles.filter(e => {
    if (filtro !== 'todos' && e.tipo !== filtro) return false
    if (busqueda) {
      const q = normalizarBusqueda(busqueda)
      return normalizarBusqueda(e.nombre).includes(q) || (e.subtitulo ? normalizarBusqueda(e.subtitulo).includes(q) : false)
    }
    return true
  })

  // Tabs ordenados según preferencias del sidebar del usuario
  const tabsOrdenados = useMemo(() => {
    const orden = preferencias.sidebar_orden
    if (!orden) return TABS_ENTIDAD

    // Aplanar el orden de todas las secciones del sidebar
    const ordenPlano: string[] = []
    for (const ids of Object.values(orden)) {
      ordenPlano.push(...ids)
    }

    // IDs de tabs de papelera (sin 'todos')
    const tabsSinTodos = TABS_ENTIDAD.filter(t => t.id !== 'todos')

    // Ordenar según la posición en el sidebar
    tabsSinTodos.sort((a, b) => {
      const idxA = ordenPlano.indexOf(a.id)
      const idxB = ordenPlano.indexOf(b.id)
      // Si no está en el orden, va al final
      const posA = idxA === -1 ? 999 : idxA
      const posB = idxB === -1 ? 999 : idxB
      return posA - posB
    })

    return [TABS_ENTIDAD[0], ...tabsSinTodos]
  }, [preferencias.sidebar_orden])

  // Contadores por tipo
  const contadores = useMemo(() => {
    const c: Record<string, number> = { todos: elementosVisibles.length }
    for (const tab of tabsOrdenados) {
      if (tab.id !== 'todos') {
        c[tab.id] = elementosVisibles.filter(e => e.tipo === tab.id).length
      }
    }
    return c
  }, [elementosVisibles])

  return (
    <div className="flex flex-col h-full">
      {/* ═══ CABECERO ═══ */}
      <div className="shrink-0 px-2 sm:px-6 pt-5 pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Info + contador */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-card bg-insignia-peligro/10 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-insignia-peligro" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-texto-primario">Papelera</h1>
                {elementosVisibles.length > 0 && (
                  <span className="text-xs font-medium text-texto-terciario bg-superficie-hover px-2 py-0.5 rounded-full">
                    {elementosVisibles.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-texto-terciario mt-0.5">
                Los elementos se eliminan automáticamente después de {DIAS_RETENCION} días
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-terciario pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar en papelera..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-superficie-tarjeta border border-borde-sutil rounded-card outline-none text-texto-primario placeholder:text-texto-terciario focus:border-texto-marca/40 transition-colors"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-texto-terciario hover:text-texto-secundario"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ FILTROS — Tabs del sistema ═══ */}
      <div className="shrink-0 px-2 sm:px-6 mb-4">
        <Tabs
          layoutId="papelera-tabs"
          tabs={tabsOrdenados
            .map(tab => ({
              clave: tab.id,
              etiqueta: tab.etiqueta,
              icono: tab.icono,
              contador: (contadores[tab.id] ?? 0) > 0 ? contadores[tab.id] : undefined,
            }))
          }
          activo={filtro}
          onChange={(clave) => setFiltro(clave as typeof filtro)}
        />
      </div>

      {/* ═══ LISTA ═══ */}
      <div className="flex-1 overflow-auto px-2 sm:px-6 pb-4">
        {cargando ? (
          <SkeletonLista filas={6} />
        ) : elementosFiltrados.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-superficie-tarjeta border border-borde-sutil rounded-card">
            <EstadoVacio
              icono={<Trash2 size={48} strokeWidth={1} />}
              titulo={busqueda ? 'Sin resultados' : 'Papelera vacía'}
              descripcion={busqueda ? 'No se encontraron elementos con esa búsqueda.' : 'Los elementos eliminados aparecerán acá para que puedas restaurarlos o eliminarlos definitivamente.'}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <AnimatePresence mode="popLayout">
              {elementosFiltrados.map(elem => {
                const Icono = ICONO_ENTIDAD[elem.tipo]
                const dias = diasDesde(elem.eliminado_en)
                const diasRestantes = Math.max(0, DIAS_RETENCION - dias)
                const urgente = diasRestantes <= 5
                const colorTipo = COLOR_TIPO[elem.tipo] as 'neutro' | 'info' | 'violeta' | 'cyan' | 'naranja' | 'advertencia' | 'exito' | 'primario' | 'rosa'

                const nombreEliminador = elem.eliminado_por_nombre || ''

                return (
                  <motion.div
                    key={elem.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className="flex gap-3 px-4 py-3.5 rounded-card bg-superficie-tarjeta border border-borde-sutil hover:border-borde-fuerte transition-colors"
                  >
                    {/* Ícono tipo + avatar eliminador apilados a las puntas */}
                    <div className="flex flex-col items-center justify-between shrink-0 self-stretch">
                      <div className="size-9 rounded-card flex items-center justify-center bg-superficie-hover">
                        <Icono size={16} className="text-texto-terciario" />
                      </div>
                      <Tooltip contenido={nombreEliminador || 'Usuario desconocido'} posicion="derecha" delay={300}>
                        <Avatar
                          nombre={nombreEliminador || '?'}
                          tamano="xs"
                          className="cursor-pointer"
                        />
                      </Tooltip>
                    </div>

                    {/* Info — cada dato en su propia línea */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Línea 1: Píldora tipo */}
                      <div>
                        <Insignia color={colorTipo} tamano="sm">
                          <Icono size={10} className="shrink-0" />
                          {ETIQUETA_ENTIDAD[elem.tipo]}
                        </Insignia>
                      </div>

                      {/* Línea 2: Nombre */}
                      <p className="text-sm font-medium text-texto-primario truncate">{elem.nombre}</p>

                      {/* Línea 2: Quién eliminó + cuándo */}
                      <div className="flex items-center gap-1.5 text-xs text-texto-terciario">
                        <Clock size={11} className="shrink-0" />
                        {nombreEliminador ? (
                          <span>
                            <span className="text-texto-secundario font-medium">{nombreEliminador}</span>
                            {' eliminó '}
                            <span className="lowercase">{textoTiempo(elem.eliminado_en)}</span>
                          </span>
                        ) : (
                          <span>Eliminado {textoTiempo(elem.eliminado_en).toLowerCase()}</span>
                        )}
                        {elem.subtitulo && (
                          <>
                            <span className="text-borde-fuerte">·</span>
                            <span className="truncate max-w-[200px]">{elem.subtitulo}</span>
                          </>
                        )}
                      </div>

                      {/* Línea 3: Días restantes */}
                      <div className={`flex items-center gap-1 text-xs ${
                        urgente ? 'text-insignia-peligro font-medium' : 'text-texto-terciario'
                      }`}>
                        {urgente && <AlertTriangle size={11} className="shrink-0" />}
                        {diasRestantes === 0
                          ? 'Se elimina permanentemente hoy'
                          : diasRestantes === 1
                            ? 'Se elimina permanentemente mañana'
                            : `Se elimina permanentemente en ${diasRestantes} días`
                        }
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <Boton
                        variante="secundario"
                        tamano="xs"
                        icono={<RotateCcw size={13} />}
                        onClick={() => restaurar(elem)}
                        cargando={restaurando === elem.id}
                      >
                        <span className="hidden sm:inline">Restaurar</span>
                      </Boton>
                      {puedeVerTodos && (
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          icono={<Trash2 size={13} />}
                          onClick={() => setConfirmacionEliminar(elem)}
                          className="!text-insignia-peligro/60 hover:!text-insignia-peligro hover:!bg-insignia-peligro/10"
                        />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modal confirmación eliminar definitivo */}
      <ModalConfirmacion
        abierto={!!confirmacionEliminar}
        onCerrar={() => setConfirmacionEliminar(null)}
        titulo="Eliminar definitivamente"
        descripcion={`¿Estás seguro de eliminar "${confirmacionEliminar?.nombre}" para siempre? Esta acción no se puede deshacer.`}
        tipo="peligro"
        etiquetaConfirmar="Eliminar para siempre"
        onConfirmar={() => { if (confirmacionEliminar) eliminarDefinitivo(confirmacionEliminar) }}
        cargando={eliminando}
      />
    </div>
  )
}

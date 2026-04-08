'use client'

import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessagesSquare, Zap, Bell,
  MessageSquare, AtSign, AlertTriangle,
  CalendarClock, UserPlus, Eye, PartyPopper,
  Megaphone, FileCheck, Mail,
  AlarmClock, Plus, Clock, CheckCircle2,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import { PopoverAdaptable as Popover } from '@/componentes/ui/PopoverAdaptable'
import { PanelNotificaciones, type ItemNotificacion } from '@/componentes/ui/PanelNotificaciones'
import {
  useNotificaciones,
  type Notificacion,
  type CategoriaNotificacion,
} from '@/hooks/useNotificaciones'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'
import { WidgetJornada } from './WidgetJornada'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useRecordatorios } from './_recordatorios/useRecordatorios'
import { FormularioRecordatorio } from './_recordatorios/FormularioRecordatorio'
import { ListaRecordatorios } from './_recordatorios/ListaRecordatorios'
import { PreviewRecordatorio } from './_recordatorios/PreviewRecordatorio'
import { ModalConfirmarEliminar } from './_recordatorios/ModalConfirmarEliminar'
import { Tabs } from '@/componentes/ui/Tabs'

/**
 * NotificacionesHeader — Los 3 íconos de notificaciones del header + botón silenciar.
 * Cada ícono abre un Popover con un PanelNotificaciones filtrado por categoría.
 *   1. Sobre (Inbox) → correos, WhatsApp, mensajes internos
 *   2. Clipboard (Actividades) → asignaciones, vencimientos, recordatorios
 *   3. Campana (Sistema) → portal, cumpleaños, anuncios, actualizaciones
 *   4. Silenciar → modo concentración
 * Se usa en: Header.tsx
 */

/* ─── Mapeo de tipo → ícono para cada notificación ─── */

const ICONOS_TIPO: Record<string, typeof Mail> = {
  nuevo_mensaje: MessageSquare,
  mencion: AtSign,
  sla_vencido: AlertTriangle,
  mensaje_whatsapp: MessageSquare,
  mensaje_correo: Mail,
  mensaje_interno: MessageSquare,

  actividad: Zap,
  asignacion: UserPlus,
  actividad_asignada: UserPlus,
  actividad_pronto_vence: CalendarClock,
  actividad_vencida: AlertTriangle,
  recordatorio: CalendarClock,
  calendario: CalendarClock,

  cumpleanios_propio: PartyPopper,
  cumpleanios_colega: PartyPopper,
  anuncio: Megaphone,
  portal_vista: Eye,
  portal_aceptado: FileCheck,
  portal_rechazado: AlertTriangle,
  portal_cancelado: AlertTriangle,
  documento_estado: FileCheck,
  actualizacion: Bell,
  usuario_pendiente: UserPlus,
}

const COLORES_TIPO: Record<string, string> = {
  nuevo_mensaje: 'var(--canal-whatsapp)',
  mensaje_whatsapp: 'var(--canal-whatsapp)',
  mensaje_correo: 'var(--canal-correo)',
  mensaje_interno: 'var(--canal-interno)',
  mencion: 'var(--texto-marca)',
  sla_vencido: 'var(--insignia-peligro-texto)',

  actividad_pronto_vence: 'var(--insignia-advertencia-texto)',
  actividad_vencida: 'var(--insignia-peligro-texto)',
  asignacion: 'var(--texto-marca)',
  actividad_asignada: 'var(--texto-marca)',

  cumpleanios_propio: 'var(--insignia-rosa-texto)',
  cumpleanios_colega: 'var(--insignia-rosa-texto)',
  portal_vista: 'var(--insignia-info-texto)',
  portal_aceptado: 'var(--insignia-exito-texto)',
  portal_rechazado: 'var(--insignia-peligro-texto)',
  anuncio: 'var(--insignia-violeta-texto)',
}

/* ─── Helpers ─── */

function tiempoRelativo(fecha: string, locale: string = 'es-AR'): string {
  const ahora = Date.now()
  const creada = new Date(fecha).getTime()
  const diff = ahora - creada
  const minutos = Math.floor(diff / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `hace ${dias}d`
  return new Date(fecha).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

/** Agrupar notificaciones por referencia_id (misma conversación).
 *  Solo muestra grupos que tengan al menos 1 no leída.
 *  El badge y "+N más" cuentan solo las no leídas del grupo. */
function agruparNotificaciones(notificaciones: Notificacion[]) {
  const mapa = new Map<string, { ultima: Notificacion; ids: string[]; noLeidas: Notificacion[] }>()

  for (const n of notificaciones) {
    const clave = n.referencia_id || n.id
    const existente = mapa.get(clave)
    if (existente) {
      existente.ids.push(n.id)
      if (!n.leida) {
        existente.noLeidas.push(n)
        if (n.creada_en > existente.ultima.creada_en) existente.ultima = n
      }
    } else {
      mapa.set(clave, {
        ultima: n,
        ids: [n.id],
        noLeidas: n.leida ? [] : [n],
      })
    }
  }

  // Solo mostrar grupos con al menos 1 notificación no leída
  return [...mapa.values()].filter((g) => g.noLeidas.length > 0)
}

function renderizarIconoNotificacion(tipo: string, color: string, cantidad: number) {
  const esWhatsApp = tipo === 'mensaje_whatsapp' || tipo === 'nuevo_mensaje'
  const IconoComp = ICONOS_TIPO[tipo] || Bell

  return (
    <div className="relative shrink-0">
      <div
        className="size-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      >
        {esWhatsApp
          ? <IconoWhatsApp size={16} style={{ color }} />
          : <IconoComp size={16} style={{ color }} />
        }
      </div>
      {cantidad > 1 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-xxs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {cantidad}
        </span>
      )}
    </div>
  )
}

/** Tipos de notificación que corresponden a actividades */
const TIPOS_ACTIVIDAD = new Set([
  'actividad_asignada', 'actividad_pronto_vence', 'actividad_vencida',
  'actividad', 'asignacion',
])

/**
 * Renderiza la píldora del tipo de actividad (ej: "Visita", "Llamada", "Presupuestar").
 * Prioridad: tipo_etiqueta/tipo_color (enriquecido por API).
 * Fallback: parsea cuerpo "{etiqueta} · {titulo}" + color de la notificación (Realtime).
 */
function renderizarPildoraTipo(n: Notificacion): ReactNode {
  if (!TIPOS_ACTIVIDAD.has(n.tipo)) return null

  // Fuente 1: campos enriquecidos por la API
  let etiqueta = n.tipo_etiqueta
  let colorTipo = n.tipo_color

  // Fuente 2 (fallback Realtime): parsear del cuerpo + color de la notificación
  if (!etiqueta && n.cuerpo) {
    const partes = n.cuerpo.split(' · ')
    if (partes.length >= 2 && partes[0] !== 'Actividad') {
      etiqueta = partes[0]
      colorTipo = n.color
    }
  }

  if (!etiqueta) return null

  const c = colorTipo || 'var(--texto-terciario)'
  return (
    <span
      className="inline-flex items-center text-xxs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}
    >
      {etiqueta}
    </span>
  )
}

/** Extrae solo el título de la actividad del cuerpo (sin la etiqueta del tipo) */
function extraerTituloActividad(n: Notificacion): string | undefined {
  if (!TIPOS_ACTIVIDAD.has(n.tipo) || !n.cuerpo) return n.cuerpo || undefined
  const partes = n.cuerpo.split(' · ')
  if (partes.length < 2) return n.cuerpo
  // Retorna todo después de la primera parte (etiqueta o "Actividad")
  return partes.slice(1).join(' · ')
}

function notificacionAItem(
  grupo: { ultima: Notificacion; ids: string[]; noLeidas: Notificacion[] },
  onClickItem: (n: Notificacion, ids: string[]) => void,
  locale: string = 'es-AR',
): ItemNotificacion {
  const { ultima: n, ids, noLeidas } = grupo
  const cantidad = noLeidas.length
  const color = COLORES_TIPO[n.tipo] || 'var(--texto-terciario)'
  const descripcionBase = extraerTituloActividad(n)
  return {
    id: n.id,
    icono: renderizarIconoNotificacion(n.tipo, color, cantidad),
    titulo: n.titulo,
    descripcion: cantidad > 1
      ? `${descripcionBase || ''} · +${cantidad - 1} más`.replace(/^ · /, '')
      : descripcionBase,
    insignia: renderizarPildoraTipo(n),
    tiempo: tiempoRelativo(n.creada_en, locale),
    leida: false,
    onClick: () => onClickItem(n, ids),
    datos: { ids },
    subItems: cantidad > 1
      ? noLeidas.map((sub) => ({
          id: sub.id,
          titulo: sub.titulo,
          descripcion: extraerTituloActividad(sub),
          insignia: renderizarPildoraTipo(sub),
          tiempo: tiempoRelativo(sub.creada_en, locale),
          leida: sub.leida,
          onClick: () => onClickItem(sub, [sub.id]),
        }))
      : undefined,
  }
}

/* ─── Configuración de cada popover ─── */

interface ConfigPopover {
  categoria: CategoriaNotificacion
  titulo: string
  icono: typeof Mail
  textoVacio: string
  rutaVerTodo: string
  etiquetaVerTodo: string
}

const POPOVERS: ConfigPopover[] = [
  {
    categoria: 'inbox',
    titulo: 'Inbox',
    icono: MessagesSquare,
    textoVacio: 'Sin mensajes nuevos',
    rutaVerTodo: '/inbox',
    etiquetaVerTodo: 'Ver todo en Inbox',
  },
  {
    categoria: 'actividades',
    titulo: 'Actividades',
    icono: Zap,
    textoVacio: 'Sin actividades pendientes',
    rutaVerTodo: '/actividades',
    etiquetaVerTodo: 'Ver todas las actividades',
  },
  {
    categoria: 'sistema',
    titulo: 'Notificaciones',
    icono: Bell,
    textoVacio: 'Sin notificaciones',
    rutaVerTodo: '/configuracion',
    etiquetaVerTodo: 'Ver configuración',
  },
]

/* ─── Componente ─── */

/* ─── Pestañas del Inbox ─── */

type FiltroInbox = 'todo' | 'whatsapp' | 'correo' | 'interno'

const TIPOS_POR_FILTRO: Record<FiltroInbox, string[] | null> = {
  todo: null,
  whatsapp: ['mensaje_whatsapp', 'nuevo_mensaje'],
  correo: ['mensaje_correo'],
  interno: ['mensaje_interno', 'mencion'],
}

const PESTANAS_INBOX: { clave: FiltroInbox; etiqueta: string }[] = [
  { clave: 'todo', etiqueta: 'Todo' },
  { clave: 'whatsapp', etiqueta: 'WhatsApp' },
  { clave: 'correo', etiqueta: 'Correo' },
  { clave: 'interno', etiqueta: 'Interno' },
]

function PestanasInbox({
  activa,
  onChange,
  conteos,
}: {
  activa: FiltroInbox
  onChange: (f: FiltroInbox) => void
  conteos: Record<FiltroInbox, number>
}) {
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-borde-sutil">
      {PESTANAS_INBOX.map(({ clave, etiqueta }) => {
        const esActiva = activa === clave
        const conteo = conteos[clave]
        return (
          <button
            key={clave}
            onClick={() => onChange(clave)}
            className={[
              'relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border-none cursor-pointer transition-colors',
              esActiva
                ? 'bg-superficie-hover text-texto-primario'
                : 'bg-transparent text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover/50',
            ].join(' ')}
          >
            {clave === 'whatsapp' && (
              <IconoWhatsApp size={12} className={esActiva ? 'text-[var(--canal-whatsapp)]' : ''} />
            )}
            {clave === 'correo' && (
              <Mail size={12} strokeWidth={1.75} className={esActiva ? 'text-[var(--canal-correo)]' : ''} />
            )}
            {clave === 'interno' && (
              <MessageSquare size={12} strokeWidth={1.75} className={esActiva ? 'text-[var(--canal-interno)]' : ''} />
            )}
            {etiqueta}
            {conteo > 0 && (
              <span className={[
                'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xxs font-bold',
                esActiva ? 'bg-texto-marca text-white' : 'bg-superficie-hover text-texto-terciario',
              ].join(' ')}>
                {conteo > 99 ? '99+' : conteo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Componente principal ─── */

/* ─── Pestañas del popover de Actividades (Actividades + Recordatorios) ─── */

type TabActividades = 'actividades' | 'recordatorios'

function PestanasActividades({
  activa,
  onChange,
  noLeidas,
  totalRecordatorios,
}: {
  activa: TabActividades
  onChange: (t: TabActividades) => void
  noLeidas: number
  totalRecordatorios: number
}) {
  const tabs: { clave: TabActividades; etiqueta: string; icono: React.ReactNode; conteo: number }[] = [
    { clave: 'actividades', etiqueta: 'Actividades', icono: <Zap size={12} strokeWidth={1.75} />, conteo: noLeidas },
    { clave: 'recordatorios', etiqueta: 'Recordatorios', icono: <AlarmClock size={12} strokeWidth={1.75} />, conteo: totalRecordatorios },
  ]

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-borde-sutil">
      {tabs.map(({ clave, etiqueta, icono, conteo }) => {
        const esActiva = activa === clave
        return (
          <button
            key={clave}
            onClick={() => onChange(clave)}
            className={[
              'relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border-none cursor-pointer transition-colors',
              esActiva
                ? 'bg-superficie-hover text-texto-primario'
                : 'bg-transparent text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover/50',
            ].join(' ')}
          >
            {icono}
            {etiqueta}
            {conteo > 0 && (
              <span className={[
                'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xxs font-bold',
                esActiva ? 'bg-texto-marca text-white' : 'bg-superficie-hover text-texto-terciario',
              ].join(' ')}>
                {conteo > 99 ? '99+' : conteo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Contenido de recordatorios dentro del popover de actividades ─── */

function ContenidoRecordatorios({ estado }: { estado: ReturnType<typeof useRecordatorios> }) {
  const {
    tab, setTab,
    activos, completados, cargando,
    titulo, setTitulo, descripcion, setDescripcion,
    fecha, creando, crear,
    toggleCompletar, intentarEliminar,
  } = estado

  return (
    <div className="flex flex-col" style={{ minHeight: 280 }}>
      {/* Nota aclaratoria */}
      <p className="text-xxs text-texto-terciario px-4 pt-2.5 pb-0.5">
        Tus recordatorios personales — solo vos los ves.
      </p>

      {/* Sub-tabs: Crear | Activos | Completados */}
      <div className="shrink-0">
        <Tabs
          tabs={[
            { clave: 'crear', etiqueta: 'Crear', icono: <Plus size={13} /> },
            { clave: 'activos', etiqueta: 'Activos', contador: activos.length, icono: <Clock size={13} /> },
            { clave: 'completados', etiqueta: 'Completados', icono: <CheckCircle2 size={13} /> },
          ]}
          activo={tab}
          onChange={setTab}
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
        {tab === 'crear' && <FormularioRecordatorio estado={estado} />}
        {tab === 'activos' && (
          <ListaRecordatorios
            tipo="activos"
            recordatorios={activos}
            cargando={cargando}
            onToggleCompletar={toggleCompletar}
            onEliminar={intentarEliminar}
            onIrACrear={() => setTab('crear')}
          />
        )}
        {tab === 'completados' && (
          <ListaRecordatorios
            tipo="completados"
            recordatorios={completados}
            cargando={cargando}
            onToggleCompletar={toggleCompletar}
            onEliminar={intentarEliminar}
          />
        )}
      </div>

      {/* Pie — botón crear (solo en tab crear) */}
      {tab === 'crear' && (
        <div className="border-t border-borde-sutil px-4 py-3 flex items-center gap-2 shrink-0">
          <Boton
            onClick={crear}
            cargando={creando}
            disabled={!titulo.trim() || !fecha}
            tamano="sm"
          >
            Crear recordatorio
          </Boton>
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={() => { setTitulo(''); setDescripcion('') }}
          >
            Limpiar
          </Boton>
        </div>
      )}
    </div>
  )
}

/* ─── Componente principal ─── */

function NotificacionesHeader() {
  const router = useRouter()
  const { locale } = useFormato()
  const { estaSilenciada } = useModoConcentracion()
  const [popoverAbierto, setPopoverAbierto] = useState<string | null>(null)
  const [filtroInbox, setFiltroInbox] = useState<FiltroInbox>('todo')
  const [tabActividades, setTabActividades] = useState<TabActividades>('actividades')

  const {
    porCategoria,
    noLeidasPorCategoria,
    marcarTodasLeidas,
    marcarLeidas,
    descartar,
    cargando,
  } = useNotificaciones({ estaSilenciada })

  /* Recordatorios — se activa cuando se abre el popover de actividades en tab recordatorios */
  const estadoRecordatorios = useRecordatorios()

  /* Sincronizar estado abierto de recordatorios con el popover */
  const abrirPopoverActividades = useCallback((abierto: boolean) => {
    setPopoverAbierto(abierto ? 'actividades' : null)
    if (abierto) setTabActividades('actividades')
    estadoRecordatorios.setAbierto(false)
  }, [estadoRecordatorios])

  const cambiarTabActividades = useCallback((tab: TabActividades) => {
    setTabActividades(tab)
    estadoRecordatorios.setAbierto(tab === 'recordatorios')
  }, [estadoRecordatorios])

  const handleClickItem = useCallback((n: Notificacion, idsGrupo?: string[]) => {
    const ids = idsGrupo && idsGrupo.length > 0 ? idsGrupo : [n.id]
    marcarLeidas(ids)
    setPopoverAbierto(null)
    if (n.referencia_tipo === 'actividad' && n.referencia_id) {
      router.push(`/actividades?actividad_id=${n.referencia_id}`)
    } else if (n.url) {
      router.push(n.url)
    }
  }, [marcarLeidas, router])

  /* Conteos de no leídas por sub-filtro del inbox */
  const itemsInbox = porCategoria('inbox')
  const conteosInbox = useMemo(() => {
    const c: Record<FiltroInbox, number> = { todo: 0, whatsapp: 0, correo: 0, interno: 0 }
    for (const n of itemsInbox) {
      if (n.leida) continue
      c.todo++
      for (const [filtro, tipos] of Object.entries(TIPOS_POR_FILTRO)) {
        if (tipos && tipos.includes(n.tipo)) c[filtro as FiltroInbox]++
      }
    }
    return c
  }, [itemsInbox])

  return (
    <>
      <div className="flex items-center gap-1">
        {POPOVERS.map((config) => {
          const noLeidas = noLeidasPorCategoria(config.categoria)
          const items = porCategoria(config.categoria)
          const Icono = config.icono
          const silenciada = estaSilenciada(config.categoria)
          const esActividades = config.categoria === 'actividades'

          /* Filtrar por pestaña si es inbox */
          const tiposFiltro = config.categoria === 'inbox' ? TIPOS_POR_FILTRO[filtroInbox] : null
          const itemsFiltrados = tiposFiltro
            ? items.filter((n) => tiposFiltro.includes(n.tipo))
            : items

          /* Agrupar por conversación/referencia para no mostrar un choclo */
          const grupos = agruparNotificaciones(itemsFiltrados)
          const itemsMapeados: ItemNotificacion[] = grupos
            .slice(0, 20)
            .map((g) => notificacionAItem(g, handleClickItem, locale))

          /* Badge: para actividades sumar recordatorios vencidos */
          const badgeCount = esActividades
            ? noLeidas + estadoRecordatorios.vencidos
            : noLeidas

          return (
            <Popover
              key={config.categoria}
              abierto={popoverAbierto === config.categoria}
              onCambio={(v) => {
                if (esActividades) {
                  abrirPopoverActividades(v)
                } else {
                  setPopoverAbierto(v ? config.categoria : null)
                }
              }}
              alineacion="fin"
              ancho={400}
              offset={10}
              tituloMovil={esActividades && tabActividades === 'recordatorios' ? 'Recordatorios' : config.titulo}
              contenido={
                <>
                  {config.categoria === 'inbox' && (
                    <PestanasInbox
                      activa={filtroInbox}
                      onChange={setFiltroInbox}
                      conteos={conteosInbox}
                    />
                  )}
                  {esActividades && (
                    <PestanasActividades
                      activa={tabActividades}
                      onChange={cambiarTabActividades}
                      noLeidas={noLeidas}
                      totalRecordatorios={estadoRecordatorios.activos.length}
                    />
                  )}
                  {esActividades && tabActividades === 'recordatorios' ? (
                    <ContenidoRecordatorios estado={estadoRecordatorios} />
                  ) : (
                    <PanelNotificaciones
                      titulo={config.titulo}
                      iconoTitulo={<Icono size={15} strokeWidth={1.75} className="text-texto-terciario" />}
                      items={itemsMapeados}
                      noLeidas={config.categoria === 'inbox' ? conteosInbox[filtroInbox] : noLeidas}
                      cargando={cargando}
                      onMarcarTodasLeidas={() => marcarTodasLeidas(config.categoria)}
                      onDescartar={descartar}
                      textoVacio={config.textoVacio}
                      iconoVacio={<Icono size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
                      pie={
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          onClick={() => { setPopoverAbierto(null); router.push(config.rutaVerTodo) }}
                          className="w-full"
                        >
                          {config.etiquetaVerTodo} →
                        </Boton>
                      }
                    />
                  )}
                </>
              }
            >
              <span className="relative">
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  soloIcono
                  icono={<Icono size={17} strokeWidth={1.75} />}
                  titulo={silenciada ? `${config.titulo} (silenciado)` : config.titulo}
                  className={[
                    'size-8',
                    silenciada
                      ? 'text-texto-terciario/30 hover:text-texto-terciario/50'
                      : 'text-texto-terciario hover:text-texto-secundario',
                  ].join(' ')}
                />
                {badgeCount > 0 && (
                  <span className={[
                    'absolute -top-0.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xxs font-bold leading-none pointer-events-none',
                    silenciada
                      ? 'bg-texto-terciario/20 text-texto-terciario'
                      : 'bg-texto-marca text-white',
                  ].join(' ')}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
                {silenciada && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="block w-4 h-px bg-texto-terciario/40 rotate-45 rounded-full" />
                  </span>
                )}
              </span>
            </Popover>
          )
        })}

        {/* Separador */}
        <span className="hidden sm:block w-px h-4 bg-borde-sutil mx-1" />

        {/* Jornada (chip compacto con timer) */}
        <WidgetJornada />
      </div>

      {/* Recordatorios: modales de preview y confirmación de eliminar */}
      <PreviewRecordatorio
        previewModal={estadoRecordatorios.previewModal}
        onCerrarModal={() => estadoRecordatorios.setPreviewModal(false)}
        previewToast={estadoRecordatorios.previewToast}
        onCerrarToast={() => estadoRecordatorios.setPreviewToast(false)}
      />
      <ModalConfirmarEliminar
        recordatorio={estadoRecordatorios.confirmarEliminar}
        onCerrar={() => estadoRecordatorios.setConfirmarEliminar(null)}
        onConfirmar={estadoRecordatorios.eliminarDirecto}
      />
    </>
  )
}

export { NotificacionesHeader }

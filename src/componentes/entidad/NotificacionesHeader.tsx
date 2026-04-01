'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessagesSquare, Zap, Bell,
  MessageSquare, AtSign, AlertTriangle,
  CalendarClock, UserPlus, Eye, PartyPopper,
  Megaphone, FileCheck, Mail,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { PanelNotificaciones, type ItemNotificacion } from '@/componentes/ui/PanelNotificaciones'
import {
  useNotificaciones,
  type Notificacion,
  type CategoriaNotificacion,
} from '@/hooks/useNotificaciones'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'
import { RecordatoriosHeader } from './RecordatoriosHeader'

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

function tiempoRelativo(fecha: string): string {
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
  return new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function notificacionAItem(n: Notificacion, onClick?: () => void): ItemNotificacion {
  const IconoComp = ICONOS_TIPO[n.tipo] || Bell
  const color = COLORES_TIPO[n.tipo] || 'var(--texto-terciario)'
  return {
    id: n.id,
    icono: (
      <div
        className="size-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      >
        <IconoComp size={16} style={{ color }} />
      </div>
    ),
    titulo: n.titulo,
    descripcion: n.cuerpo || undefined,
    tiempo: tiempoRelativo(n.creada_en),
    leida: n.leida,
    onClick,
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

function NotificacionesHeader() {
  const router = useRouter()
  const { estaSilenciada } = useModoConcentracion()
  const [popoverAbierto, setPopoverAbierto] = useState<string | null>(null)

  const {
    porCategoria,
    noLeidasPorCategoria,
    marcarTodasLeidas,
    marcarLeidas,
    descartar,
    cargando,
  } = useNotificaciones({ estaSilenciada })

  const handleClickItem = useCallback((n: Notificacion) => {
    if (!n.leida) marcarLeidas([n.id])
    setPopoverAbierto(null)
    if (n.url) router.push(n.url)
  }, [marcarLeidas, router])

  return (
    <div className="flex items-center gap-0.5">
      {POPOVERS.map((config) => {
        const noLeidas = noLeidasPorCategoria(config.categoria)
        const items = porCategoria(config.categoria)
        const Icono = config.icono
        const silenciada = estaSilenciada(config.categoria)

        const itemsMapeados: ItemNotificacion[] = items
          .slice(0, 20)
          .map((n) => notificacionAItem(n, () => handleClickItem(n)))

        return (
          <Popover
            key={config.categoria}
            abierto={popoverAbierto === config.categoria}
            onCambio={(v) => setPopoverAbierto(v ? config.categoria : null)}
            alineacion="fin"
            ancho={400}
            offset={10}
            contenido={
              <PanelNotificaciones
                titulo={config.titulo}
                iconoTitulo={<Icono size={15} strokeWidth={1.75} className="text-texto-terciario" />}
                items={itemsMapeados}
                noLeidas={noLeidas}
                cargando={cargando}
                onMarcarTodasLeidas={() => marcarTodasLeidas(config.categoria)}
                onDescartar={descartar}
                textoVacio={config.textoVacio}
                iconoVacio={<Icono size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
                pie={
                  <button
                    onClick={() => { setPopoverAbierto(null); router.push(config.rutaVerTodo) }}
                    className="flex items-center justify-center gap-1.5 w-full py-1 text-xs font-medium text-texto-marca hover:text-texto-primario bg-transparent border-none cursor-pointer transition-colors"
                  >
                    {config.etiquetaVerTodo} →
                  </button>
                }
              />
            }
          >
            <button
              className={[
                'relative flex items-center justify-center size-8 rounded-md bg-transparent border-none cursor-pointer transition-colors',
                silenciada
                  ? 'text-texto-terciario/30 hover:text-texto-terciario/50'
                  : 'text-texto-terciario hover:text-texto-secundario',
              ].join(' ')}
              title={silenciada ? `${config.titulo} (silenciado)` : config.titulo}
            >
              <Icono size={17} strokeWidth={1.75} />
              {/* Badge con contador — punto si 1-9, número si 10+ */}
              {noLeidas > 0 && (
                noLeidas < 10 ? (
                  <span className={[
                    'absolute top-0.5 right-0.5 size-2 rounded-full',
                    silenciada ? 'bg-texto-terciario/30' : 'bg-texto-marca',
                  ].join(' ')} />
                ) : (
                  <span className={[
                    'absolute -top-0.5 -right-1 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold leading-none',
                    silenciada
                      ? 'bg-texto-terciario/20 text-texto-terciario'
                      : 'bg-texto-marca text-white',
                  ].join(' ')}>
                    {noLeidas > 99 ? '99' : noLeidas}
                  </span>
                )
              )}
              {/* Rayita de mute sutil */}
              {silenciada && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="block w-4 h-px bg-texto-terciario/40 rotate-45 rounded-full" />
                </span>
              )}
            </button>
          </Popover>
        )
      })}

      {/* Recordatorios */}
      <RecordatoriosHeader />
    </div>
  )
}

export { NotificacionesHeader }

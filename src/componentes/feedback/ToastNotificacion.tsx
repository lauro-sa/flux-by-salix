'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageSquare, AtSign, AlertTriangle, CalendarClock, UserPlus,
  Eye, PartyPopper, Megaphone, FileCheck, Mail, Bell, Zap,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import {
  useNotificaciones,
  type Notificacion,
  type CategoriaNotificacion,
} from '@/hooks/useNotificaciones'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'

/**
 * ToastNotificacion — Tarjetas flotantes que aparecen al llegar una notificación en tiempo real.
 * Agrupa mensajes de la misma conversación para no inundar la pantalla.
 * Se posiciona arriba a la derecha, debajo del header.
 * Máximo 3 grupos visibles, auto-descarta en 8s, se expande al hover.
 * Se usa en: PlantillaApp (layout principal).
 */

/* ─── Mapeos de ícono y color por tipo ─── */

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
  recordatorio: 'var(--texto-marca)',
}

const ETIQUETAS_TIPO: Record<string, string> = {
  mensaje_whatsapp: 'WhatsApp',
  mensaje_correo: 'Correo',
  mensaje_interno: 'Mensaje',
  mencion: 'Mención',
  actividad_asignada: 'Actividad',
  actividad_pronto_vence: 'Vencimiento',
  actividad_vencida: 'Vencida',
  recordatorio: 'Recordatorio',
  portal_vista: 'Portal',
  portal_aceptado: 'Aceptado',
  portal_rechazado: 'Rechazado',
  cumpleanios_propio: 'Cumpleaños',
  cumpleanios_colega: 'Cumpleaños',
  anuncio: 'Anuncio',
}

const MAX_TOASTS = 3
const DURACION_AUTO_MS = 8000

/** Grupo de notificaciones de la misma conversación/referencia */
interface GrupoToast {
  /** Clave de agrupación (referencia_id o id de la primera) */
  clave: string
  /** Notificación más reciente (la que se muestra) */
  ultima: Notificacion
  /** Total de notificaciones en el grupo */
  cantidad: number
  /** IDs de todas las notificaciones del grupo */
  ids: string[]
}

/* ─── Toast individual (ahora con soporte de grupo) ─── */

interface PropsToastItem {
  grupo: GrupoToast
  onDescartar: (clave: string) => void
  onVer: (n: Notificacion) => void
}

function ToastItem({ grupo, onDescartar, onVer }: PropsToastItem) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pausado, setPausado] = useState(false)

  const { ultima, cantidad } = grupo
  const color = COLORES_TIPO[ultima.tipo] || 'var(--texto-marca)'
  const Icono = ICONOS_TIPO[ultima.tipo] || Bell
  const etiqueta = ETIQUETAS_TIPO[ultima.tipo] || 'Notificación'

  /* Auto-descartar en 8s */
  useEffect(() => {
    if (pausado) return
    timerRef.current = setTimeout(() => onDescartar(grupo.clave), DURACION_AUTO_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pausado, grupo.clave, onDescartar])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      className="w-[360px] border border-borde-sutil rounded-2xl shadow-elevada overflow-hidden pointer-events-auto"
      style={{ backgroundColor: 'var(--superficie-elevada)' }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Ícono con badge de cantidad */}
        <div className="relative shrink-0">
          <div
            className="size-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <Icono size={18} style={{ color }} />
          </div>
          {cantidad > 1 && (
            <span
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xxs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {cantidad}
            </span>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color }}>{etiqueta}</span>
            <span className="text-xxs text-texto-terciario">Ahora</span>
          </div>
          <p className="text-sm font-medium text-texto-primario mt-0.5 truncate">{ultima.titulo}</p>
          {ultima.cuerpo && (
            <p className="text-xs text-texto-terciario mt-0.5 line-clamp-1">{ultima.cuerpo}</p>
          )}
          {cantidad > 1 && (
            <p className="text-xxs mt-1" style={{ color }}>
              +{cantidad - 1} mensaje{cantidad > 2 ? 's' : ''} más
            </p>
          )}
        </div>

        {/* Cerrar */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<X size={14} />}
          onClick={() => onDescartar(grupo.clave)}
        />
      </div>

      {/* Botones de acción */}
      <div className="flex border-t border-borde-sutil">
        <Boton
          variante="fantasma"
          tamano="xs"
          onClick={() => onDescartar(grupo.clave)}
          className="flex-1 rounded-none"
        >
          Descartar
        </Boton>
        {ultima.url && (
          <>
            <div className="w-px bg-borde-sutil" />
            <Boton
              variante="fantasma"
              tamano="xs"
              onClick={() => onVer(ultima)}
              className="flex-1 rounded-none text-texto-marca"
            >
              Ver
            </Boton>
          </>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Contenedor principal ─── */

function ToastNotificacion() {
  const router = useRouter()
  const { estaSilenciada } = useModoConcentracion()
  const [grupos, setGrupos] = useState<GrupoToast[]>([])

  /* Callback cuando llega una nueva notificación */
  const handleNueva = useCallback((n: Notificacion) => {
    const categoria = categorizarTipo(n.tipo)
    if (estaSilenciada(categoria)) return

    /* Clave de agrupación: referencia_id (conversación) o id si no tiene */
    const clave = n.referencia_id || n.id

    setGrupos((prev) => {
      const existente = prev.find((g) => g.clave === clave)
      if (existente) {
        /* Actualizar grupo existente con la nueva notificación */
        return prev.map((g) =>
          g.clave === clave
            ? { ...g, ultima: n, cantidad: g.cantidad + 1, ids: [...g.ids, n.id] }
            : g
        )
      }
      /* Crear nuevo grupo */
      const nuevo: GrupoToast = { clave, ultima: n, cantidad: 1, ids: [n.id] }
      const nuevos = [nuevo, ...prev]
      return nuevos.slice(0, MAX_TOASTS)
    })
  }, [estaSilenciada])

  /* Conectar con useNotificaciones (solo para recibir onNueva) */
  useNotificaciones({ onNueva: handleNueva, estaSilenciada })

  const descartar = useCallback((clave: string) => {
    setGrupos((prev) => prev.filter((g) => g.clave !== clave))
  }, [])

  const ver = useCallback((n: Notificacion) => {
    const clave = n.referencia_id || n.id
    setGrupos((prev) => prev.filter((g) => g.clave !== clave))
    if (n.url) router.push(n.url)
  }, [router])

  return (
    <div
      className="fixed right-6 z-[10000] flex flex-col gap-3 pointer-events-none"
      style={{ top: 'calc(var(--header-alto, 56px) + 12px)' }}
    >
      <AnimatePresence mode="popLayout">
        {grupos.map((g) => (
          <ToastItem key={g.clave} grupo={g} onDescartar={descartar} onVer={ver} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/* Helper inline — evita dependencia circular */
function categorizarTipo(tipo: string): CategoriaNotificacion {
  const INBOX = ['nuevo_mensaje', 'mencion', 'sla_vencido', 'mensaje_whatsapp', 'mensaje_correo', 'mensaje_interno']
  const ACTIVIDADES = ['actividad', 'asignacion', 'actividad_asignada', 'actividad_pronto_vence', 'actividad_vencida', 'recordatorio', 'calendario']
  if (INBOX.includes(tipo)) return 'inbox'
  if (ACTIVIDADES.includes(tipo)) return 'actividades'
  return 'sistema'
}

export { ToastNotificacion }

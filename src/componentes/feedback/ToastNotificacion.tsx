'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageSquare, AtSign, AlertTriangle, CalendarClock, UserPlus,
  Eye, PartyPopper, Megaphone, FileCheck, Mail, Bell, Zap, ChevronDown, Clock,
  Calendar, MapPin,
} from 'lucide-react'
import {
  useNotificaciones,
  type Notificacion,
  type CategoriaNotificacion,
} from '@/hooks/useNotificaciones'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'
import { Boton } from '@/componentes/ui/Boton'

/**
 * ToastNotificacion — Tarjetas flotantes agrupadas por conversación.
 * Al hover se expande mostrando todos los mensajes del grupo con scroll.
 * Máximo 3 grupos visibles, auto-descarta en 8s.
 * Se usa en: PlantillaApp (layout principal).
 */

const ICONOS_TIPO: Record<string, typeof Mail> = {
  nuevo_mensaje: MessageSquare, mencion: AtSign, sla_vencido: AlertTriangle,
  mensaje_whatsapp: MessageSquare, mensaje_correo: Mail, mensaje_interno: MessageSquare,
  actividad: Zap, asignacion: UserPlus, actividad_asignada: UserPlus,
  actividad_pronto_vence: CalendarClock, actividad_vencida: AlertTriangle,
  recordatorio: CalendarClock, calendario: CalendarClock,
  cumpleanios_propio: PartyPopper, cumpleanios_colega: PartyPopper,
  anuncio: Megaphone, portal_vista: Eye, portal_aceptado: FileCheck,
  portal_rechazado: AlertTriangle, portal_cancelado: AlertTriangle,
  documento_estado: FileCheck, actualizacion: Bell, usuario_pendiente: UserPlus,
  fichaje_automatico: Clock, evento_asignado: Calendar, recordatorio_evento: CalendarClock,
  visita_en_camino: MapPin, visita_cancelada: AlertTriangle, visita_reprogramada: CalendarClock,
}

const COLORES_TIPO: Record<string, string> = {
  nuevo_mensaje: 'var(--canal-whatsapp)', mensaje_whatsapp: 'var(--canal-whatsapp)',
  mensaje_correo: 'var(--canal-correo)', mensaje_interno: 'var(--canal-interno)',
  mencion: 'var(--texto-marca)', sla_vencido: 'var(--insignia-peligro-texto)',
  actividad_pronto_vence: 'var(--insignia-advertencia-texto)',
  actividad_vencida: 'var(--insignia-peligro-texto)',
  fichaje_automatico: 'var(--insignia-exito-texto)',
  asignacion: 'var(--texto-marca)', actividad_asignada: 'var(--texto-marca)',
  cumpleanios_propio: 'var(--insignia-rosa-texto)', cumpleanios_colega: 'var(--insignia-rosa-texto)',
  portal_vista: 'var(--insignia-info-texto)', portal_aceptado: 'var(--insignia-exito-texto)',
  portal_rechazado: 'var(--insignia-peligro-texto)', portal_cancelado: 'var(--insignia-advertencia-texto)',
  anuncio: 'var(--insignia-violeta-texto)',
  recordatorio: 'var(--texto-marca)',
  documento_estado: 'var(--insignia-info-texto)', actualizacion: 'var(--texto-marca)',
  usuario_pendiente: 'var(--insignia-advertencia-texto)',
  evento_asignado: 'var(--texto-marca)',
  recordatorio_evento: 'var(--insignia-advertencia-texto)',
  visita_en_camino: 'var(--insignia-info-texto)',
  visita_cancelada: 'var(--insignia-peligro-texto)',
  visita_reprogramada: 'var(--insignia-advertencia-texto)',
}

const ETIQUETAS_TIPO: Record<string, string> = {
  mensaje_whatsapp: 'WhatsApp', mensaje_correo: 'Correo', mensaje_interno: 'Mensaje',
  mencion: 'Mención', actividad_asignada: 'Actividad', actividad_pronto_vence: 'Vencimiento',
  actividad_vencida: 'Vencida', recordatorio: 'Recordatorio', portal_vista: 'Portal',
  portal_aceptado: 'Aceptado', portal_rechazado: 'Rechazado',
  fichaje_automatico: 'Fichaje', evento_asignado: 'Evento',
  recordatorio_evento: 'Recordatorio', visita_en_camino: 'En camino',
  visita_cancelada: 'Cancelada', visita_reprogramada: 'Reprogramada',
  cumpleanios_propio: 'Cumpleaños', cumpleanios_colega: 'Cumpleaños', anuncio: 'Anuncio',
  nuevo_mensaje: 'Mensaje', sla_vencido: 'SLA vencido', asignacion: 'Asignación',
  portal_cancelado: 'Cancelado', documento_estado: 'Documento', actualizacion: 'Sistema',
  usuario_pendiente: 'Usuario',
}

const MAX_TOASTS = 3
const DURACION_AUTO_MS = 8000
/** Tipos que merecen más tiempo en pantalla (el usuario necesita verlos) */
const TIPOS_DURACION_LARGA = new Set(['fichaje_automatico', 'actividad_vencida', 'actividad_pronto_vence'])
const DURACION_LARGA_MS = 15000

interface GrupoToast {
  clave: string
  /** Todas las notificaciones del grupo (más reciente primero) */
  todas: Notificacion[]
}

/* ─── Toast individual con expansión al hover ─── */

interface PropsToastItem {
  grupo: GrupoToast
  onDescartar: (clave: string) => void
  onVer: (n: Notificacion) => void
}

function ToastItem({ grupo, onDescartar, onVer }: PropsToastItem) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandido, setExpandido] = useState(false)

  const { todas } = grupo
  const ultima = todas[0]
  const cantidad = todas.length
  const color = COLORES_TIPO[ultima.tipo] || 'var(--texto-marca)'
  const Icono = ICONOS_TIPO[ultima.tipo] || Bell
  const etiqueta = ETIQUETAS_TIPO[ultima.tipo] || 'Notificación'

  /* Auto-descartar (pausar cuando está expandido) */
  const duracion = TIPOS_DURACION_LARGA.has(ultima.tipo) ? DURACION_LARGA_MS : DURACION_AUTO_MS
  useEffect(() => {
    if (expandido) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    timerRef.current = setTimeout(() => onDescartar(grupo.clave), duracion)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [expandido, grupo.clave, onDescartar, cantidad, duracion])

  const esGrupo = cantidad > 1

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      onMouseEnter={() => esGrupo && setExpandido(true)}
      onMouseLeave={() => setExpandido(false)}
      className="w-full sm:w-[360px] max-w-[calc(100vw-2rem)] border border-borde-sutil rounded-modal shadow-elevada overflow-hidden pointer-events-auto"
      style={{ backgroundColor: 'var(--superficie-elevada)' }}
    >
      {/* Header: siempre visible */}
      <div className="flex items-start gap-3 p-3.5">
        <div className="relative shrink-0">
          <div
            className="size-9 rounded-card flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <Icono size={18} style={{ color }} />
          </div>
          {esGrupo && (
            <span
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xxs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {cantidad}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color }}>{etiqueta}</span>
            <span className="text-xxs text-texto-terciario">Justo ahora</span>
          </div>
          <p className="text-sm font-medium text-texto-primario mt-0.5 truncate">{ultima.titulo}</p>
          {ultima.cuerpo && (
            <p className="text-xs text-texto-terciario mt-0.5 truncate">{ultima.cuerpo}</p>
          )}
          {!expandido && esGrupo && (
            <p className="text-xxs mt-1 flex items-center gap-1" style={{ color }}>
              <ChevronDown size={10} /> +{cantidad - 1} mensaje{cantidad > 2 ? 's' : ''} más
            </p>
          )}
        </div>

        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<X size={14} />}
          titulo="Cerrar"
          onClick={() => onDescartar(grupo.clave)}
          className="shrink-0"
        />
      </div>

      {/* Lista expandida al hover (solo si hay más de 1 mensaje) */}
      {esGrupo && (
        <div
          className="border-t border-borde-sutil overflow-hidden transition-all duration-200 ease-out"
          style={{
            maxHeight: expandido ? '200px' : '0px',
            opacity: expandido ? 1 : 0,
          }}
        >
          <div
            className="max-h-[200px] overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {todas.map((n, i) => (
              <button
                key={n.id}
                onClick={() => onVer(n)}
                className="w-full flex items-start gap-2.5 px-3.5 py-2 text-left hover:bg-superficie-hover transition-colors bg-transparent border-none cursor-pointer focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                style={i < todas.length - 1 ? { borderBottom: '1px solid var(--borde-sutil)' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-texto-primario truncate">{n.titulo}</p>
                  {n.cuerpo && (
                    <p className="text-xxs text-texto-terciario mt-0.5 truncate">{n.cuerpo}</p>
                  )}
                </div>
                <span className="text-xxs text-texto-marca shrink-0 mt-0.5">Ver</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex border-t border-borde-sutil">
        <Boton
          variante="fantasma"
          tamano="xs"
          onClick={() => onDescartar(grupo.clave)}
          className="flex-1 rounded-none py-2"
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
              className="flex-1 rounded-none py-2 text-texto-marca"
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

  const handleNueva = useCallback((n: Notificacion) => {
    // En mobile con push activo, no mostrar toast (ya llega la notificación del sistema)
    if (typeof window !== 'undefined' && window.innerWidth < 768
      && 'Notification' in window && Notification.permission === 'granted') {
      return
    }

    const categoria = categorizarTipo(n.tipo)
    if (estaSilenciada(categoria)) return

    const clave = n.referencia_id || n.id

    setGrupos((prev) => {
      const existente = prev.find((g) => g.clave === clave)
      if (existente) {
        return prev.map((g) =>
          g.clave === clave
            ? { ...g, todas: [n, ...g.todas] }
            : g
        )
      }
      const nuevo: GrupoToast = { clave, todas: [n] }
      return [nuevo, ...prev].slice(0, MAX_TOASTS)
    })
  }, [estaSilenciada])

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
      className="fixed right-6 z-[var(--z-toast)] flex flex-col gap-3 pointer-events-none"
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

function categorizarTipo(tipo: string): CategoriaNotificacion {
  const INBOX = ['nuevo_mensaje', 'mencion', 'sla_vencido', 'mensaje_whatsapp', 'mensaje_correo', 'mensaje_interno']
  const ACTIVIDADES = ['actividad', 'asignacion', 'actividad_asignada', 'actividad_pronto_vence', 'actividad_vencida', 'recordatorio', 'recordatorio_evento', 'calendario', 'evento_asignado']
  if (INBOX.includes(tipo)) return 'inbox'
  if (ACTIVIDADES.includes(tipo)) return 'actividades'
  return 'sistema'
}

export { ToastNotificacion }

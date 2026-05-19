'use client'

/**
 * PuntoEstado — Bolita pequeña que comunica un estado vivo de algo
 * (un panel pensando, un servicio activo, una sesión lista, un error).
 *
 * Se usa en:
 *  - Headers de paneles que cambian de estado (ej: Salix IA "activo" / "pensando…").
 *  - Etiquetas de servicios o conexiones (websocket abierto, sincronización en curso).
 *  - Cualquier lugar donde un texto necesita un acento visual mínimo de estado.
 *
 * Los colores y el glow vienen de tokens (--insignia-*, --glow-*) — nunca hardcodeados.
 * Las animaciones de pulso son keyframes globales (`flux-pulso-suave`, `flux-pulso-rapido`).
 */

type EstadoPunto = 'activo' | 'pensando' | 'listo' | 'error' | 'inactivo'

interface PropsPuntoEstado {
  estado?: EstadoPunto
  tamano?: 'sm' | 'md'
  className?: string
}

// Mapa de estados → tokens visuales. Cada estado define color de fondo, glow
// y animación de pulso. `pensando` late más rápido para comunicar urgencia.
const configEstado: Record<EstadoPunto, {
  fondo: string
  glow: string | null
  animacion: string | null
}> = {
  activo:    { fondo: 'var(--insignia-exito)',    glow: 'var(--glow-exito)',  animacion: 'flux-pulso-suave 2.2s ease-in-out infinite' },
  pensando:  { fondo: 'var(--insignia-primario)', glow: 'var(--glow-marca)',  animacion: 'flux-pulso-rapido 1s ease-in-out infinite' },
  listo:     { fondo: 'var(--insignia-exito)',    glow: 'var(--glow-exito)',  animacion: null },
  error:     { fondo: 'var(--insignia-peligro)',  glow: 'var(--glow-peligro)', animacion: null },
  inactivo:  { fondo: 'var(--insignia-neutro)',   glow: null,                  animacion: null },
}

const tamanos: Record<'sm' | 'md', string> = {
  sm: 'size-1.5', // 6px
  md: 'size-2',   // 8px
}

export function PuntoEstado({ estado = 'activo', tamano = 'sm', className = '' }: PropsPuntoEstado) {
  const cfg = configEstado[estado]
  return (
    <span
      className={`inline-block rounded-full transition-colors duration-300 ${tamanos[tamano]} ${className}`}
      style={{
        backgroundColor: cfg.fondo,
        boxShadow: cfg.glow ?? undefined,
        animation: cfg.animacion ?? undefined,
      }}
      aria-hidden="true"
    />
  )
}

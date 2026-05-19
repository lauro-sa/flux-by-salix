'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import {
  X, Mail, Phone, Briefcase, ExternalLink, ChevronLeft, Loader2,
  Building2, Clock, LogIn, LogOut, Smartphone, KeyRound, ScanLine,
  Bot, CircleCheck, CircleX,
} from 'lucide-react'
import { formatearTelefono } from '@/lib/formato'
import type { Conversacion } from '@/tipos/inbox'

/**
 * Panel derecho — info del miembro (empleado) cuando la conversación es interna
 * (WhatsApp con empleados). Se renderiza en lugar de PanelInfoContacto cuando
 * audiencia === 'empleados' en el módulo /whatsapp.
 *
 * Consume el endpoint consolidado /api/miembros/[id]/panel-resumen que devuelve
 * identidad, puesto, sector, turno, fichaje del día y flags de configuración
 * en una sola request.
 */

interface PropiedadesPanelInfoEmpleado {
  conversacion: Conversacion | null
  abierto: boolean
  onCerrar: () => void
  esMovil?: boolean
}

interface EntidadConColor {
  id: string
  nombre: string
  color: string | null
  icono?: string | null
}

interface TurnoMini {
  id: string
  nombre: string
  flexible: boolean
}

interface AsistenciaHoy {
  id: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  estado: string
  estado_clave: string | null
  tipo: string
  metodo_registro: string
}

interface ResumenMiembro {
  id: string
  rol: string
  activo: boolean
  nombre: string
  apellido: string
  correo: string | null
  correo_empresa: string | null
  telefono: string | null
  telefono_empresa: string | null
  puesto: EntidadConColor | null
  sector: EntidadConColor | null
  turno: TurnoMini | null
  metodo_fichaje: 'kiosco' | 'automatico' | 'manual' | null
  fichaje_auto_movil: boolean
  tiene_kiosco_rfid: boolean
  tiene_kiosco_pin: boolean
  salix_ia_web: boolean
  salix_ia_whatsapp: boolean
  nivel_salix: 'ninguno' | 'personal' | 'completo'
  asistencia_hoy: AsistenciaHoy | null
  zona_horaria: string
}

export function PanelInfoEmpleado({
  conversacion,
  abierto,
  onCerrar,
  esMovil = false,
}: PropiedadesPanelInfoEmpleado) {
  const [datos, setDatos] = useState<ResumenMiembro | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Evita pisar el estado cuando el usuario cambia de conversación rápido.
  const miembroIdActualRef = useRef<string | null>(null)

  useEffect(() => {
    const miembroId = conversacion?.miembro_id
    miembroIdActualRef.current = miembroId ?? null
    if (!miembroId) {
      setDatos(null)
      setError(null)
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    fetch(`/api/miembros/${miembroId}/panel-resumen`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'No encontrado' : 'Error al cargar')
        return r.json() as Promise<ResumenMiembro>
      })
      .then((data) => {
        if (!cancelado && miembroIdActualRef.current === miembroId) setDatos(data)
      })
      .catch((e: Error) => {
        if (!cancelado) setError(e.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => { cancelado = true }
  }, [conversacion?.miembro_id])

  // Fallback de nombre mientras carga (usa lo que ya tiene la conversación).
  const nombreFallback = conversacion?.contacto_nombre || 'Empleado'
  const nombreCompleto = datos
    ? `${datos.nombre} ${datos.apellido}`.trim() || nombreFallback
    : nombreFallback

  const contenidoPanel = (
    <>
      {/* Header — misma altura que el header del chat. */}
      <div
        className="flex items-center justify-between px-4 h-[65px] sticky top-0 z-10"
        style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        {esMovil ? (
          <Boton variante="fantasma" tamano="sm" icono={<ChevronLeft size={20} />} onClick={onCerrar} className="min-h-[44px]">
            Volver
          </Boton>
        ) : (
          <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Info del empleado
          </span>
        )}
        {!esMovil && (
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cerrar" icono={<X size={16} />} onClick={onCerrar} />
        )}
      </div>

      {/* Cuerpo */}
      {!conversacion?.miembro_id ? (
        <EstadoVacio mensaje="Esta conversación no está vinculada a un empleado." />
      ) : cargando && !datos ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
        </div>
      ) : error && !datos ? (
        <EstadoVacio mensaje={`No se pudo cargar la info del empleado (${error}).`} />
      ) : datos ? (
        <div className="p-4 space-y-5">
          {/* Identidad */}
          <div className="flex flex-col items-center text-center pt-2">
            <Avatar nombre={nombreCompleto} tamano="xl" />
            <h2 className="mt-3 text-base font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {nombreCompleto}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="text-xxs font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'var(--insignia-info-fondo)', color: 'var(--insignia-info-texto)' }}
              >
                Empleado
              </span>
              {!datos.activo && (
                <span
                  className="text-xxs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--insignia-peligro-fondo)', color: 'var(--insignia-peligro-texto)' }}
                >
                  Inactivo
                </span>
              )}
            </div>
          </div>

          {/* Puesto / Sector / Turno */}
          {(datos.puesto || datos.sector || datos.turno) && (
            <SeccionPanel titulo="Laboral">
              {datos.puesto && (
                <FilaDato
                  icono={<Briefcase size={14} />}
                  iconoColor={datos.puesto.color}
                  etiqueta="Puesto"
                  valor={datos.puesto.nombre}
                />
              )}
              {datos.sector && (
                <FilaDato
                  icono={<Building2 size={14} />}
                  iconoColor={datos.sector.color}
                  etiqueta="Sector"
                  valor={datos.sector.nombre}
                />
              )}
              {datos.turno && (
                <FilaDato
                  icono={<Clock size={14} />}
                  etiqueta="Turno"
                  valor={`${datos.turno.nombre}${datos.turno.flexible ? ' · flexible' : ''}`}
                />
              )}
            </SeccionPanel>
          )}

          {/* Fichaje de hoy */}
          <SeccionPanel titulo="Fichaje de hoy">
            <ResumenFichajeHoy asistencia={datos.asistencia_hoy} zonaHoraria={datos.zona_horaria} />
          </SeccionPanel>

          {/* Contacto */}
          <SeccionPanel titulo="Contacto">
            <FilaDato
              icono={<Mail size={14} />}
              etiqueta="Correo empresa"
              valor={datos.correo_empresa}
              href={datos.correo_empresa ? `mailto:${datos.correo_empresa}` : undefined}
            />
            <FilaDato
              icono={<Mail size={14} />}
              etiqueta="Correo personal"
              valor={datos.correo}
              href={datos.correo ? `mailto:${datos.correo}` : undefined}
            />
            <FilaDato
              icono={<Phone size={14} />}
              etiqueta="Teléfono empresa"
              valor={datos.telefono_empresa ? formatearTelefono(datos.telefono_empresa) : null}
              href={datos.telefono_empresa ? `tel:${datos.telefono_empresa}` : undefined}
            />
            <FilaDato
              icono={<Phone size={14} />}
              etiqueta="Teléfono personal"
              valor={datos.telefono ? formatearTelefono(datos.telefono) : null}
              href={datos.telefono ? `tel:${datos.telefono}` : undefined}
            />
          </SeccionPanel>

          {/* Configuración / accesos */}
          <SeccionPanel titulo="Configuración">
            <FilaBoolean
              icono={<Smartphone size={14} />}
              etiqueta="Fichaje desde móvil"
              valor={datos.fichaje_auto_movil}
            />
            <FilaDato
              icono={<LogIn size={14} />}
              etiqueta="Método de fichaje"
              valor={
                datos.metodo_fichaje === 'kiosco' ? 'Kiosco'
                : datos.metodo_fichaje === 'automatico' ? 'Automático'
                : datos.metodo_fichaje === 'manual' ? 'Manual'
                : 'No definido'
              }
            />
            {(datos.tiene_kiosco_rfid || datos.tiene_kiosco_pin) && (
              <FilaDato
                icono={datos.tiene_kiosco_rfid ? <ScanLine size={14} /> : <KeyRound size={14} />}
                etiqueta="Credencial kiosco"
                valor={
                  datos.tiene_kiosco_rfid && datos.tiene_kiosco_pin ? 'RFID + PIN'
                  : datos.tiene_kiosco_rfid ? 'RFID'
                  : 'PIN'
                }
              />
            )}
            <FilaBoolean
              icono={<Bot size={14} />}
              etiqueta="Salix IA por WhatsApp"
              valor={datos.salix_ia_whatsapp}
            />
            <FilaBoolean
              icono={<Bot size={14} />}
              etiqueta="Salix IA en la app"
              valor={datos.salix_ia_web}
            />
          </SeccionPanel>

          {/* Atajo al perfil completo */}
          <Link
            href={`/usuarios/${datos.id}`}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-card border transition-colors hover:bg-[var(--superficie-hover)]"
            style={{ borderColor: 'var(--borde-sutil)', color: 'var(--texto-primario)' }}
          >
            <span className="flex items-center gap-2 text-sm">
              <Briefcase size={14} style={{ color: 'var(--texto-terciario)' }} />
              Ver perfil completo
            </span>
            <ExternalLink size={14} style={{ color: 'var(--texto-terciario)' }} />
          </Link>
        </div>
      ) : null}
    </>
  )

  // Móvil: vista completa
  if (esMovil) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: 'var(--superficie-tarjeta)', overscrollBehaviorY: 'contain' }}>
        {contenidoPanel}
      </div>
    )
  }

  // Desktop: panel lateral animado (mismo ancho/animación que PanelInfoContacto)
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full overflow-hidden flex-shrink-0"
          style={{ borderLeft: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
        >
          <div className="h-full overflow-y-auto">
            {contenidoPanel}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────

function SeccionPanel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p
        className="text-[11px] font-medium uppercase tracking-wider px-1"
        style={{ color: 'var(--texto-terciario)' }}
      >
        {titulo}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function FilaDato({
  icono, iconoColor, etiqueta, valor, href,
}: {
  icono: React.ReactNode
  iconoColor?: string | null
  etiqueta: string
  valor: string | null
  href?: string
}) {
  if (!valor) return null
  const contenido = (
    <span className="text-sm truncate" style={{ color: 'var(--texto-primario)' }}>{valor}</span>
  )
  return (
    <div className="flex items-center gap-3 py-1.5 px-1">
      <span
        className="flex-shrink-0"
        style={{ color: iconoColor || 'var(--texto-terciario)' }}
      >
        {icono}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xxs leading-tight" style={{ color: 'var(--texto-terciario)' }}>{etiqueta}</p>
        {href ? (
          <a href={href} className="block truncate hover:underline" style={{ color: 'var(--texto-primario)' }}>
            {contenido}
          </a>
        ) : contenido}
      </div>
    </div>
  )
}

/** Fila para flags booleanas (habilitado/deshabilitado) con check/X visual. */
function FilaBoolean({
  icono, etiqueta, valor,
}: {
  icono: React.ReactNode
  etiqueta: string
  valor: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-1">
      <span className="flex-shrink-0" style={{ color: 'var(--texto-terciario)' }}>{icono}</span>
      <span className="flex-1 text-sm truncate" style={{ color: 'var(--texto-primario)' }}>{etiqueta}</span>
      {valor
        ? <CircleCheck size={14} style={{ color: 'var(--insignia-exito)' }} />
        : <CircleX size={14} style={{ color: 'var(--texto-terciario)' }} />
      }
    </div>
  )
}

/** Resumen del fichaje de hoy: entrada, salida, estado. Si no fichó → "Sin fichaje". */
function ResumenFichajeHoy({
  asistencia, zonaHoraria,
}: {
  asistencia: AsistenciaHoy | null
  zonaHoraria: string
}) {
  if (!asistencia) {
    return (
      <p className="text-sm px-1 py-2" style={{ color: 'var(--texto-secundario)' }}>
        Sin fichaje hoy.
      </p>
    )
  }
  const horaEntrada = asistencia.hora_entrada
    ? new Date(asistencia.hora_entrada).toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', timeZone: zonaHoraria,
      })
    : null
  const horaSalida = asistencia.hora_salida
    ? new Date(asistencia.hora_salida).toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', timeZone: zonaHoraria,
      })
    : null
  // El backend marca tipo='tardanza' cuando hay desvío vs horario esperado.
  const esTardanza = asistencia.tipo === 'tardanza'
  return (
    <>
      <FilaDato
        icono={<LogIn size={14} />}
        etiqueta={esTardanza ? 'Entrada (tardanza)' : 'Entrada'}
        valor={horaEntrada}
      />
      <FilaDato
        icono={<LogOut size={14} />}
        etiqueta="Salida"
        valor={horaSalida || (asistencia.hora_entrada ? 'En curso' : null)}
      />
    </>
  )
}

function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>{mensaje}</p>
    </div>
  )
}

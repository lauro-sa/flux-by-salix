'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Clock, Sun, Calendar, BellRing, AlarmClock,
  CalendarClock, BellOff, Loader2,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { Boton } from '@/componentes/ui/Boton'

/**
 * PopoverSnooze — Popover para posponer (snooze) una conversación.
 * Permite elegir duración predefinida o personalizada, con nota opcional.
 * Si ya está pospuesta, muestra info y botón para despertar.
 * Se usa en: header de conversación (WhatsApp y correo).
 */

interface PropiedadesPopoverSnooze {
  conversacionId: string
  snoozeActual: { hasta: string; nota: string | null } | null
  onSnooze: (hasta: string, nota: string | null) => void
  onDespertar: () => void
}

/* ─── Helpers de fecha ─── */

/** Genera la fecha de "mañana a las 9:00" en la zona local */
function manianaALas9(): Date {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  fecha.setHours(9, 0, 0, 0)
  return fecha
}

/** Genera la fecha del "próximo lunes a las 9:00" en la zona local */
function proximoLunesALas9(): Date {
  const fecha = new Date()
  const diaSemana = fecha.getDay() // 0=dom, 1=lun, ...
  // Si hoy es lunes, ir al próximo lunes (7 días)
  const diasHastaLunes = diaSemana === 0 ? 1 : diaSemana === 1 ? 7 : 8 - diaSemana
  fecha.setDate(fecha.getDate() + diasHastaLunes)
  fecha.setHours(9, 0, 0, 0)
  return fecha
}

/** Formatea una fecha ISO a texto legible */
function formatearFecha(iso: string): string {
  try {
    const fecha = new Date(iso)
    const ahora = new Date()
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    const diaFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
    const diffDias = Math.round((diaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

    const hora = fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

    if (diffDias === 0) return `Hoy a las ${hora}`
    if (diffDias === 1) return `Mañana a las ${hora}`
    if (diffDias > 1 && diffDias <= 7) {
      const dia = fecha.toLocaleDateString('es', { weekday: 'long' })
      return `${dia.charAt(0).toUpperCase() + dia.slice(1)} a las ${hora}`
    }
    return fecha.toLocaleDateString('es', {
      day: 'numeric', month: 'short', year: fecha.getFullYear() !== ahora.getFullYear() ? 'numeric' : undefined,
    }) + ` a las ${hora}`
  } catch {
    return iso
  }
}

/** Convierte fecha local a ISO string preservando la hora local */
function aISOLocal(fecha: Date): string {
  return fecha.toISOString()
}

/* ─── Opciones predefinidas ─── */

interface OpcionSnooze {
  etiqueta: string
  descripcion: string
  icono: typeof Clock
  obtenerFecha: () => Date
}

const OPCIONES_PREDEFINIDAS: OpcionSnooze[] = [
  {
    etiqueta: '1 hora',
    descripcion: 'Vuelve en 60 minutos',
    icono: Clock,
    obtenerFecha: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    etiqueta: '3 horas',
    descripcion: 'Vuelve en 3 horas',
    icono: AlarmClock,
    obtenerFecha: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
  },
  {
    etiqueta: 'Mañana a las 9:00',
    descripcion: 'Vuelve mañana por la mañana',
    icono: Sun,
    obtenerFecha: manianaALas9,
  },
  {
    etiqueta: 'Próximo lunes 9:00',
    descripcion: 'Vuelve el lunes siguiente',
    icono: Calendar,
    obtenerFecha: proximoLunesALas9,
  },
]

/* ─── Componente principal ─── */

function PopoverSnooze({
  conversacionId,
  snoozeActual,
  onSnooze,
  onDespertar,
}: PropiedadesPopoverSnooze) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false)
  const [fechaPersonalizada, setFechaPersonalizada] = useState('')
  const [guardando, setGuardando] = useState(false)

  const estaPospuesta = snoozeActual !== null

  /* Valor mínimo para el datetime-local: ahora + 5 min */
  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000)
    // Formato: YYYY-MM-DDTHH:mm
    return d.getFullYear()
      + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0')
      + 'T' + String(d.getHours()).padStart(2, '0')
      + ':' + String(d.getMinutes()).padStart(2, '0')
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Aplicar snooze */
  const aplicarSnooze = useCallback(async (fecha: Date) => {
    setGuardando(true)
    try {
      const hastaISO = aISOLocal(fecha)
      const notaFinal = nota.trim() || null

      const res = await fetch('/api/inbox/conversaciones/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          snooze_hasta: hastaISO,
          nota: notaFinal,
        }),
      })

      if (res.ok) {
        onSnooze(hastaISO, notaFinal)
        setNota('')
        setMostrarPersonalizado(false)
        setFechaPersonalizada('')
        setAbierto(false)
      }
    } finally {
      setGuardando(false)
    }
  }, [conversacionId, nota, onSnooze])

  /* Despertar (quitar snooze) */
  const despertar = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/inbox/conversaciones/snooze?conversacion_id=${conversacionId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onDespertar()
        setAbierto(false)
      }
    } finally {
      setGuardando(false)
    }
  }, [conversacionId, onDespertar])

  /* Enviar fecha personalizada */
  const enviarPersonalizado = useCallback(() => {
    if (!fechaPersonalizada) return
    const fecha = new Date(fechaPersonalizada)
    if (fecha <= new Date()) return
    aplicarSnooze(fecha)
  }, [fechaPersonalizada, aplicarSnooze])

  /* ─── Contenido del popover ─── */
  const contenidoPopover = (
    <div className="py-2 flex flex-col">
      {/* Texto de ayuda */}
      <p
        className="px-3.5 pb-2 text-xs leading-relaxed"
        style={{ color: 'var(--texto-terciario)' }}
      >
        Posponer — Esta conversación desaparecerá del inbox y volverá automáticamente en el tiempo que elijas
      </p>

      {/* Banner de snooze activo */}
      {estaPospuesta && (
        <div
          className="mx-3 mb-2 px-3 py-2.5 rounded-lg flex flex-col gap-1.5"
          style={{
            backgroundColor: 'var(--insignia-advertencia-fondo, rgba(245, 158, 11, 0.1))',
            border: '1px solid var(--insignia-advertencia-borde, rgba(245, 158, 11, 0.25))',
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--insignia-advertencia, #f59e0b)' }}>
            <BellRing size={14} />
            <span>Pospuesta hasta {formatearFecha(snoozeActual.hasta)}</span>
          </div>
          {snoozeActual.nota && (
            <p className="text-xs pl-[22px]" style={{ color: 'var(--texto-secundario)' }}>
              {snoozeActual.nota}
            </p>
          )}
        </div>
      )}

      {/* Separador */}
      <div className="h-px mx-2.5 mb-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Botón despertar si está pospuesta */}
      {estaPospuesta && (
        <>
          <button
            type="button"
            onClick={despertar}
            disabled={guardando}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm font-medium transition-colors duration-100 cursor-pointer min-h-[44px]"
            style={{
              color: 'var(--insignia-peligro, #ef4444)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--superficie-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            {guardando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <BellOff size={16} />
            )}
            <span>Despertar ahora</span>
          </button>

          {/* Separador */}
          <div className="h-px mx-2.5 my-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

          <p className="px-3.5 py-1.5 text-xs" style={{ color: 'var(--texto-terciario)' }}>
            Reprogramar:
          </p>
        </>
      )}

      {/* Opciones predefinidas */}
      {OPCIONES_PREDEFINIDAS.map(opcion => {
        const Icono = opcion.icono
        return (
          <button
            key={opcion.etiqueta}
            type="button"
            onClick={() => aplicarSnooze(opcion.obtenerFecha())}
            disabled={guardando}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors duration-100 cursor-pointer min-h-[44px]"
            style={{
              color: 'var(--texto-primario)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--superficie-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Icono size={16} style={{ color: 'var(--texto-terciario)' }} className="shrink-0" />
            <div className="flex flex-col items-start gap-0.5">
              <span>{opcion.etiqueta}</span>
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                {opcion.descripcion}
              </span>
            </div>
          </button>
        )
      })}

      {/* Separador antes de personalizado */}
      <div className="h-px mx-2.5 my-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Fecha personalizada */}
      {!mostrarPersonalizado ? (
        <button
          type="button"
          onClick={() => setMostrarPersonalizado(true)}
          disabled={guardando}
          className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors duration-100 cursor-pointer min-h-[44px]"
          style={{
            color: 'var(--texto-secundario)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--superficie-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <CalendarClock size={16} style={{ color: 'var(--texto-terciario)' }} className="shrink-0" />
          <span>Fecha personalizada...</span>
        </button>
      ) : (
        <div className="px-3.5 py-2 flex flex-col gap-2">
          <input
            type="datetime-local"
            value={fechaPersonalizada}
            onChange={e => setFechaPersonalizada(e.target.value)}
            min={minDatetime}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors duration-150 min-h-[44px]"
            style={{
              backgroundColor: 'var(--superficie-tarjeta)',
              borderColor: 'var(--borde-sutil)',
              color: 'var(--texto-primario)',
            }}
          />
          <div className="flex gap-2">
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => {
                setMostrarPersonalizado(false)
                setFechaPersonalizada('')
              }}
            >
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              tamano="sm"
              onClick={enviarPersonalizado}
              disabled={!fechaPersonalizada || guardando}
              cargando={guardando}
            >
              Posponer
            </Boton>
          </div>
        </div>
      )}

      {/* Separador antes de nota */}
      <div className="h-px mx-2.5 my-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Textarea para nota opcional */}
      <div className="px-3.5 py-2">
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Agregar nota de recordatorio..."
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors duration-150 min-h-[44px]"
          style={{
            backgroundColor: 'var(--superficie-tarjeta)',
            borderColor: 'var(--borde-sutil)',
            color: 'var(--texto-primario)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--borde-fuerte)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--borde-sutil)' }}
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--texto-terciario)' }}>
          La nota se mostrará cuando la conversación vuelva al inbox
        </p>
      </div>
    </div>
  )

  return (
    <Popover
      contenido={contenidoPopover}
      abierto={abierto}
      onCambio={val => {
        setAbierto(val)
        if (!val) {
          /* Limpiar estado al cerrar */
          setMostrarPersonalizado(false)
          setFechaPersonalizada('')
        }
      }}
      ancho={320}
      alineacion="fin"
    >
      {/* Trigger: botón con ícono de reloj */}
      <Boton
        variante={estaPospuesta ? 'advertencia' : 'fantasma'}
        tamano="sm"
        soloIcono
        icono={estaPospuesta ? <BellRing size={16} /> : <Clock size={16} />}
        titulo={estaPospuesta ? `Pospuesta hasta ${formatearFecha(snoozeActual!.hasta)}` : 'Posponer conversación'}
        tooltip={estaPospuesta ? `Pospuesta hasta ${formatearFecha(snoozeActual!.hasta)}` : 'Posponer'}
      />
    </Popover>
  )
}

export { PopoverSnooze }
export type { PropiedadesPopoverSnooze }

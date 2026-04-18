'use client'

/**
 * Componentes internos reutilizados dentro de la página de detalle de usuario.
 * Incluye: SeccionEncabezado, TarjetaStat, MiniCalendario
 */

import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { ESTADOS_ASISTENCIA, obtenerDiasMes } from './constantes'

/* ═══════════════════════════════════════════════════
   ItemMenu — Ítem de menú dropdown
   ═══════════════════════════════════════════════════ */

export function ItemMenu({ icono, children, onClick, variante = 'normal' }: {
  icono: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  variante?: 'normal' | 'advertencia' | 'peligro'
}) {
  return (
    <OpcionMenu
      icono={icono}
      peligro={variante === 'peligro'}
      onClick={onClick}
    >
      {children}
    </OpcionMenu>
  )
}

/* ═══════════════════════════════════════════════════
   SeccionEncabezado — Encabezado de sección con línea inferior sutil
   ═══════════════════════════════════════════════════ */

export function SeccionEncabezado({ icono, titulo, accion }: { icono: React.ReactNode; titulo: string; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4 pb-2.5 -mx-4 px-4 sm:-mx-5 sm:px-5 border-b border-borde-sutil/40">
      <div className="flex items-center gap-2">
        <span className="text-texto-terciario">{icono}</span>
        <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>
      </div>
      {accion}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   TarjetaStat — Stat card para el resumen
   ═══════════════════════════════════════════════════ */

export function TarjetaStat({ etiqueta, valor, subvalor, icono, color = 'primario' }: {
  etiqueta: string
  valor: string | number
  subvalor?: string
  icono: React.ReactNode
  color?: 'primario' | 'exito' | 'advertencia' | 'peligro' | 'info'
}) {
  const colores = {
    primario: 'bg-insignia-primario-fondo text-insignia-primario-texto',
    exito: 'bg-insignia-exito-fondo text-insignia-exito-texto',
    advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto',
    peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto',
    info: 'bg-insignia-info-fondo text-insignia-info-texto',
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">{etiqueta}</span>
        <div className={`size-8 rounded-card flex items-center justify-center ${colores[color]}`}>
          {icono}
        </div>
      </div>
      <p className="text-2xl font-bold text-texto-primario">{valor}</p>
      {subvalor && <p className="text-xs text-texto-terciario mt-0.5">{subvalor}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MiniCalendario — Mini-calendario del mes, compacto, círculos
   ═══════════════════════════════════════════════════ */

export function MiniCalendario({ anio, mes, asistencias, diasLaborales, diasSemanaCortos, diaInicioSemana, formatearMes }: {
  anio: number
  mes: number
  asistencias: Record<number, 'presente' | 'ausente' | 'tardanza'>
  diasLaborales: number[]
  diasSemanaCortos: string[]
  diaInicioSemana: number
  formatearMes: (fecha: Date | string) => string
}) {
  const dias = obtenerDiasMes(anio, mes, diaInicioSemana)
  const hoy = new Date()
  const esHoy = (dia: number) => hoy.getFullYear() === anio && hoy.getMonth() === mes && hoy.getDate() === dia

  // Colores por estado
  const estiloEstado = {
    presente: 'bg-insignia-exito/20 text-insignia-exito',
    ausente: 'bg-insignia-peligro/20 text-insignia-peligro',
    tardanza: 'bg-insignia-advertencia/20 text-insignia-advertencia',
  }

  return (
    <div className="select-none">
      {/* Header del mes */}
      <p className="text-xs font-medium text-texto-secundario mb-3 capitalize">{formatearMes(new Date(anio, mes))}</p>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-px">
        {/* Encabezados de día */}
        {diasSemanaCortos.map((d, i) => (
          <div key={i} className="h-7 flex items-center justify-center text-xxs font-semibold text-texto-terciario/60 uppercase">
            {d}
          </div>
        ))}

        {/* Días */}
        {dias.map((dia, i) => {
          if (dia === null) return <div key={`v-${i}`} className="h-7" />

          const estado = asistencias[dia]
          const esLaboral = diasLaborales.includes(new Date(anio, mes, dia).getDay())
          const esPasado = new Date(anio, mes, dia) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
          const hoyEs = esHoy(dia)

          // Determinar estilo
          let clase = 'h-7 w-full flex items-center justify-center text-xs rounded-full transition-colors '

          if (hoyEs) {
            clase += 'font-bold text-texto-marca ring-[1.5px] ring-inset ring-texto-marca'
          } else if (estado) {
            clase += estiloEstado[estado] + ' font-medium'
          } else if (!esLaboral) {
            clase += 'text-texto-terciario/30'
          } else if (esPasado) {
            clase += 'text-texto-terciario/60'
          } else {
            clase += 'text-texto-secundario'
          }

          return (
            <div key={dia} className="flex items-center justify-center">
              <div className={clase}>
                {dia}
              </div>
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-borde-sutil">
        {ESTADOS_ASISTENCIA.map(l => (
          <div key={l.etiqueta} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${l.color}`} />
            <span className="text-xxs text-texto-terciario">{l.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

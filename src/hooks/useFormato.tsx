'use client'

import { useMemo } from 'react'
import { useEmpresa } from './useEmpresa'

/**
 * Hook para formatear fechas, moneda y configuración regional.
 * Lee la config de la empresa (moneda, formato_fecha, dia_inicio_semana, zona_horaria).
 * Se usa en: toda la app para mostrar fechas, montos y calendarios consistentes.
 */

interface FormatoConfig {
  /** Formatea un número como moneda según la config de la empresa */
  moneda: (monto: number) => string

  /** Formatea una fecha según el formato de la empresa (DD/MM/YYYY, MM/DD/YYYY, etc.) */
  fecha: (fecha: Date | string, opciones?: { conHora?: boolean; corta?: boolean; soloMes?: boolean }) => string

  /** Formatea fecha relativa: "hace 2 días", "hoy", "ayer" */
  fechaRelativa: (fecha: Date | string) => string

  /** Día de inicio de semana: 0=domingo, 1=lunes */
  diaInicioSemana: number

  /** Nombres de días empezando por el día de inicio configurado */
  diasSemana: string[]
  diasSemanaCortos: string[]

  /** Zona horaria de la empresa */
  zonaHoraria: string

  /** Moneda de la empresa (código ISO) */
  codigoMoneda: string

  /** Formato de hora: '12h' o '24h' */
  formatoHora: string
}

const DIAS_COMPLETOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function useFormato(): FormatoConfig {
  const { empresa } = useEmpresa()

  return useMemo(() => {
    const emp = empresa as Record<string, unknown> | null
    const monedaCodigo = (emp?.moneda as string) || 'ARS'
    const formatoFecha = (emp?.formato_fecha as string) || 'DD/MM/YYYY'
    const diaInicio = (emp?.dia_inicio_semana as string) === 'domingo' ? 0 : 1
    const zona = (emp?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fmtHora = (emp?.formato_hora as string) || '24h'

    // Locale basado en la zona horaria
    const locale = zona.startsWith('America/Argentina') ? 'es-AR'
      : zona.startsWith('America') ? 'es-MX'
      : 'es'

    /** Formatear moneda */
    const moneda = (monto: number): string => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: monedaCodigo,
        minimumFractionDigits: 0,
        maximumFractionDigits: monto % 1 === 0 ? 0 : 2,
      }).format(monto)
    }

    /** Formatear fecha */
    const fecha = (input: Date | string, opciones?: { conHora?: boolean; corta?: boolean; soloMes?: boolean }): string => {
      const d = typeof input === 'string' ? new Date(input + (input.length === 10 ? 'T12:00:00' : '')) : input
      if (isNaN(d.getTime())) return '—'

      if (opciones?.soloMes) {
        return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      }

      if (opciones?.corta) {
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      }

      // Formato según config empresa
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const anio = d.getFullYear()

      let resultado = ''
      switch (formatoFecha) {
        case 'MM/DD/YYYY': resultado = `${mes}/${dia}/${anio}`; break
        case 'YYYY-MM-DD': resultado = `${anio}-${mes}-${dia}`; break
        case 'DD/MM/YYYY':
        default: resultado = `${dia}/${mes}/${anio}`; break
      }

      if (opciones?.conHora) {
        const horas = d.getHours()
        const minutos = String(d.getMinutes()).padStart(2, '0')
        if (fmtHora === '12h') {
          const h12 = horas % 12 || 12
          const ampm = horas < 12 ? 'AM' : 'PM'
          resultado += ` ${h12}:${minutos} ${ampm}`
        } else {
          resultado += ` ${String(horas).padStart(2, '0')}:${minutos}`
        }
      }

      return resultado
    }

    /** Fecha legible larga (ej: "15 de marzo de 2026") */
    const fechaLegible = (input: Date | string): string => {
      const d = typeof input === 'string' ? new Date(input + (input.length === 10 ? 'T12:00:00' : '')) : input
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    }

    /** Fecha relativa */
    const fechaRelativa = (input: Date | string): string => {
      const d = typeof input === 'string' ? new Date(input) : input
      if (isNaN(d.getTime())) return '—'

      const ahora = new Date()
      const diffMs = ahora.getTime() - d.getTime()
      const diffDias = Math.floor(diffMs / 86400000)

      if (diffDias === 0) return 'Hoy'
      if (diffDias === 1) return 'Ayer'
      if (diffDias < 7) return `Hace ${diffDias} días`
      if (diffDias < 30) return `Hace ${Math.floor(diffDias / 7)} sem`
      return fecha(d, { corta: true })
    }

    // Reordenar días según día de inicio
    const reordenar = <T,>(arr: T[]): T[] => {
      return [...arr.slice(diaInicio), ...arr.slice(0, diaInicio)]
    }

    return {
      moneda,
      fecha,
      fechaRelativa,
      diaInicioSemana: diaInicio,
      diasSemana: reordenar(DIAS_COMPLETOS),
      diasSemanaCortos: reordenar(DIAS_CORTOS),
      zonaHoraria: zona,
      codigoMoneda: monedaCodigo,
      formatoHora: fmtHora,
    }
  }, [empresa])
}

export { useFormato, type FormatoConfig }

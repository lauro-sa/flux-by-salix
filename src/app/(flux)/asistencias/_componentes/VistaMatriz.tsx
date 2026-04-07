'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Loader2, Calendar, Printer, Download,
  SlidersHorizontal,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useEsMovil } from '@/hooks/useEsMovil'
import Holidays from 'date-holidays'

// ─── Tipos ───────────────────────────────────────────────────

interface Miembro {
  id: string
  nombre: string
}

interface CeldaAsistencia {
  id: string
  estado: string
  tipo: string
  hora_entrada: string | null
  hora_salida: string | null
  metodo_registro: string
  puntualidad_min: number | null
  cierre_automatico: boolean
}

type Periodo = 'semana' | 'quincena' | 'mes'

// ─── Constantes ──────────────────────────────────────────────

const COLORES_CELDA: Record<string, { fondo: string; borde: string }> = {
  normal:       { fondo: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
  cerrado:      { fondo: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
  activo:       { fondo: 'bg-sky-500/12', borde: 'border-sky-500/25' },
  tardanza:     { fondo: 'bg-amber-500/12', borde: 'border-amber-500/25' },
  almuerzo:     { fondo: 'bg-amber-500/10', borde: 'border-amber-500/20' },
  particular:   { fondo: 'bg-sky-500/10', borde: 'border-sky-500/20' },
  auto_cerrado: { fondo: 'bg-red-500/10', borde: 'border-red-500/20' },
  ausente:      { fondo: 'bg-red-500/8', borde: 'border-red-500/15' },
}

const COLOR_PUNTO: Record<string, string> = {
  normal: 'bg-emerald-400',
  cerrado: 'bg-emerald-400',
  activo: 'bg-sky-400',
  tardanza: 'bg-amber-400',
  auto_cerrado: 'bg-red-400',
  ausente: 'bg-red-400',
}

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// ─── Helpers ─────────────────────────────────────────────────

function generarFechas(desde: Date, hasta: Date): string[] {
  const fechas: string[] = []
  const d = new Date(desde)
  while (d <= hasta) {
    fechas.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return fechas
}

function obtenerRango(periodo: Periodo, offset: number): { desde: Date; hasta: Date; etiqueta: string; subtitulo: string } {
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)

  if (periodo === 'semana') {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - hoy.getDay() + 1 + (offset * 7))
    const fin = new Date(inicio)
    fin.setDate(inicio.getDate() + 6)
    const etiqueta = `Semana del ${inicio.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]} ${fin.getFullYear()}`
    const pad = (n: number) => String(n).padStart(2, '0')
    const subtitulo = `${pad(inicio.getDate())}/${pad(inicio.getMonth()+1)}/${inicio.getFullYear()} — ${pad(fin.getDate())}/${pad(fin.getMonth()+1)}/${fin.getFullYear()}`
    return { desde: inicio, hasta: fin, etiqueta, subtitulo }
  }

  if (periodo === 'quincena') {
    // Quincena actual: si hoy <= 15 → primera, si no → segunda
    const quincenaActual = hoy.getDate() <= 15 ? 0 : 1 // 0 = primera, 1 = segunda
    const quincenaAbsoluta = hoy.getMonth() * 2 + quincenaActual + offset
    const mesIdx = Math.floor(quincenaAbsoluta / 2)
    const esPrimera = ((quincenaAbsoluta % 2) + 2) % 2 === 0

    const anoBase = hoy.getFullYear() + Math.floor(mesIdx / 12)
    const mes = ((mesIdx % 12) + 12) % 12

    if (esPrimera) {
      const desde = new Date(anoBase, mes, 1)
      const hasta = new Date(anoBase, mes, 15)
      const pad = (n: number) => String(n).padStart(2, '0')
      return {
        desde, hasta,
        etiqueta: `Quincena 1-15 de ${MESES[mes]} ${anoBase}`,
        subtitulo: `01/${pad(mes+1)}/${anoBase} — 15/${pad(mes+1)}/${anoBase}`,
      }
    } else {
      const desde = new Date(anoBase, mes, 16)
      const hasta = new Date(anoBase, mes + 1, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      return {
        desde, hasta,
        etiqueta: `Quincena 16-${hasta.getDate()} de ${MESES[mes]} ${anoBase}`,
        subtitulo: `16/${pad(mes+1)}/${anoBase} — ${pad(hasta.getDate())}/${pad(mes+1)}/${anoBase}`,
      }
    }
  }

  // mes
  const base = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1)
  const desde = new Date(base.getFullYear(), base.getMonth(), 1)
  const hasta = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  const etiqueta = `${MESES[base.getMonth()]} ${base.getFullYear()}`
  const pad = (n: number) => String(n).padStart(2, '0')
  const subtitulo = `01/${pad(base.getMonth()+1)}/${base.getFullYear()} — ${pad(hasta.getDate())}/${pad(base.getMonth()+1)}/${base.getFullYear()}`
  return { desde, hasta, etiqueta, subtitulo }
}

function formatearHora(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function estadoCelda(asist: CeldaAsistencia | undefined): string {
  if (!asist) return 'vacio'
  if (asist.tipo === 'tardanza') return 'tardanza'
  if (asist.estado === 'ausente') return 'ausente'
  if (asist.estado === 'auto_cerrado') return 'auto_cerrado'
  if (asist.estado === 'activo') return 'activo'
  return 'cerrado'
}

function iniciales(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const COLORES_AVATAR = [
  'bg-insignia-info/20 text-insignia-info',
  'bg-insignia-exito/20 text-insignia-exito',
  'bg-insignia-advertencia/20 text-insignia-advertencia',
  'bg-[color:var(--insignia-peligro)]/20 text-[color:var(--insignia-peligro)]',
  'bg-purple-500/20 text-purple-400',
  'bg-cyan-500/20 text-cyan-400',
]

// ─── Componente ──────────────────────────────────────────────

export function VistaMatriz() {
  const esMovil = useEsMovil()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [offset, setOffset] = useState(0)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [asistencias, setAsistencias] = useState<Record<string, Record<string, CeldaAsistencia>>>({})
  const [cargando, setCargando] = useState(true)
  const [ocultarFindes, setOcultarFindes] = useState(false)

  const { desde, hasta, etiqueta, subtitulo } = useMemo(() => obtenerRango(periodo, offset), [periodo, offset])
  const todasLasFechas = useMemo(() => generarFechas(desde, hasta), [desde, hasta])
  const fechas = useMemo(() => {
    if (!ocultarFindes) return todasLasFechas
    return todasLasFechas.filter(f => {
      const d = new Date(f + 'T12:00:00').getDay()
      return d !== 0 && d !== 6
    })
  }, [todasLasFechas, ocultarFindes])

  // Feriados argentinos (offline via date-holidays)
  const feriados = useMemo(() => {
    const hd = new Holidays('AR')
    const anios = new Set(todasLasFechas.map(f => parseInt(f.split('-')[0])))
    const mapa = new Map<string, string>()
    for (const anio of anios) {
      for (const h of hd.getHolidays(anio)) {
        if (h.type === 'public') {
          const fecha = h.date.split(' ')[0] // "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DD"
          mapa.set(fecha, h.name)
        }
      }
    }
    return mapa
  }, [fechas])
  const diasLaborales = useMemo(() => todasLasFechas.filter(f => {
    const d = new Date(f + 'T12:00:00').getDay()
    return d !== 0 && d !== 6
  }), [todasLasFechas])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const desdeStr = desde.toISOString().split('T')[0]
      const hastaStr = hasta.toISOString().split('T')[0]
      const res = await fetch(`/api/asistencias/matriz?desde=${desdeStr}&hasta=${hastaStr}`)
      if (!res.ok) return
      const data = await res.json()
      setMiembros(data.miembros || [])
      setAsistencias(data.asistencias || {})
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const hoyStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-full">
      {/* Header de la matriz */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-borde-sutil shrink-0">
        {/* Periodo toggles */}
        <div className="flex items-center gap-1">
          {(['semana', 'quincena', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriodo(p); setOffset(0) }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                periodo === p
                  ? 'bg-superficie-elevada text-texto-primario border border-borde-sutil'
                  : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-elevada/50'
              }`}
            >
              <Calendar size={12} />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}

          {/* Ocultar fines de semana */}
          <button
            onClick={() => setOcultarFindes(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              ocultarFindes
                ? 'bg-texto-marca/15 text-texto-marca border border-texto-marca/20'
                : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-elevada/50'
            }`}
            title={ocultarFindes ? 'Mostrar fines de semana' : 'Ocultar fines de semana'}
          >
            <SlidersHorizontal size={12} />
            {ocultarFindes ? 'Sin fines de semana' : 'Sáb/Dom'}
          </button>
        </div>

        {/* Navegación central */}
        <div className="flex items-center gap-3">
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronLeft size={16} />} onClick={() => setOffset(o => o - 1)} />
          <button
            onClick={() => setOffset(0)}
            className="text-center hover:text-texto-marca transition-colors"
          >
            <p className="text-sm font-semibold text-texto-primario">{etiqueta}</p>
            <p className="text-[10px] text-texto-terciario">{subtitulo}</p>
          </button>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronRight size={16} />} onClick={() => setOffset(o => o + 1)} />
        </div>

        {/* Acciones derecha — solo desktop */}
        <div className="hidden sm:flex items-center gap-1">
          <Boton variante="fantasma" tamano="xs">
            <Printer size={13} className="mr-1.5" /> Nómina
          </Boton>
          <Boton variante="fantasma" tamano="xs">
            <Download size={13} className="mr-1.5" /> Exportar
          </Boton>
        </div>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : esMovil ? (
        /* ═══ VISTA MOBILE — Tarjetas por empleado ═══ */
        <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
          {miembros.map((miembro, idx) => {
            const asistMiembro = asistencias[miembro.id] || {}
            let presentes = 0
            let ausentes = 0
            for (const fecha of diasLaborales) {
              const a = asistMiembro[fecha]
              if (a && a.estado !== 'ausente') presentes++
              else if (a && a.estado === 'ausente') ausentes++
            }
            const totalLaboral = diasLaborales.length
            const colorAvatar = COLORES_AVATAR[idx % COLORES_AVATAR.length]

            return (
              <div key={miembro.id} className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
                {/* Header de tarjeta */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colorAvatar}`}>
                      {iniciales(miembro.nombre)}
                    </div>
                    <span className="font-semibold text-texto-primario text-sm">{miembro.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-texto-primario">{presentes}/{totalLaboral}</span>
                    {ausentes > 0 && <span className="text-xs font-semibold text-red-400">{ausentes}A</span>}
                  </div>
                </div>

                {/* Mini calendario semanal */}
                <div className="px-3 pb-3">
                  <div className="bg-superficie-app/50 rounded-lg border border-borde-sutil/50 overflow-hidden">
                    {/* Días header */}
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${fechas.length}, 1fr)` }}>
                      {fechas.map((fecha) => {
                        const d = new Date(fecha + 'T12:00:00')
                        const diaSemana = d.getDay()
                        const esFinde = diaSemana === 0 || diaSemana === 6
                        const diasMovil = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
                        return (
                          <div key={fecha} className={`text-center py-1.5 text-[10px] font-medium ${esFinde ? 'text-texto-terciario/40' : 'text-texto-terciario'}`}>
                            {diasMovil[diaSemana]}
                          </div>
                        )
                      })}
                    </div>

                    {/* Celdas con fondo de color */}
                    <div className="grid gap-1 px-1 pb-1" style={{ gridTemplateColumns: `repeat(${fechas.length}, 1fr)` }}>
                      {fechas.map((fecha) => {
                        const d = new Date(fecha + 'T12:00:00')
                        const diaSemana = d.getDay()
                        const esHoy = fecha === hoyStr
                        const esFinde = diaSemana === 0 || diaSemana === 6
                        const esFeriado = feriados.has(fecha)
                        const asist = asistMiembro[fecha] as CeldaAsistencia | undefined
                        const estado = estadoCelda(asist)

                        // Fondo según estado
                        let fondoCelda = 'bg-transparent'
                        let textColor = 'text-texto-primario'
                        let subTexto = ''
                        let puntoColor = ''

                        if (esFinde) {
                          fondoCelda = 'bg-superficie-elevada/40'
                          textColor = 'text-texto-terciario/30'
                        } else if (estado === 'ausente') {
                          fondoCelda = 'bg-red-500/12 border border-red-500/20'
                          subTexto = 'AUS'
                        } else if (estado === 'tardanza') {
                          fondoCelda = 'bg-amber-500/12 border border-amber-500/20'
                          puntoColor = 'bg-amber-400'
                        } else if (estado === 'cerrado' || estado === 'normal') {
                          fondoCelda = 'bg-emerald-500/12 border border-emerald-500/20'
                          puntoColor = 'bg-emerald-400'
                        } else if (estado === 'activo') {
                          fondoCelda = 'bg-sky-500/12 border border-sky-500/20'
                          puntoColor = 'bg-sky-400'
                        } else if (estado === 'auto_cerrado') {
                          fondoCelda = 'bg-red-500/8 border border-red-500/15'
                          puntoColor = 'bg-red-400'
                        }

                        if (esFeriado && !esFinde) {
                          fondoCelda = estado !== 'vacio' ? fondoCelda : 'bg-violet-500/10 border border-violet-500/20'
                          textColor = estado === 'vacio' ? 'text-violet-400' : textColor
                        }

                        if (esHoy) textColor = 'text-texto-marca'

                        return (
                          <div
                            key={fecha}
                            className={`flex flex-col items-center justify-center py-2 rounded-lg ${fondoCelda}`}
                          >
                            <span className={`text-sm font-bold ${textColor}`}>
                              {d.getDate()}
                            </span>

                            {esFinde ? (
                              <span className="text-texto-terciario/20 text-[9px] leading-none">—</span>
                            ) : subTexto ? (
                              <span className="text-red-400 text-[9px] font-bold leading-none mt-0.5">{subTexto}</span>
                            ) : puntoColor ? (
                              <div className={`size-1.5 rounded-full mt-1 ${puntoColor}`} />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {miembros.length === 0 && (
            <div className="flex items-center justify-center py-20 text-texto-terciario text-sm">
              No hay miembros activos
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-superficie-app">
              <tr>
                <th className="sticky left-0 z-20 bg-superficie-app text-left px-4 py-3 font-medium text-texto-terciario text-xs uppercase tracking-wider border-b border-borde-sutil min-w-[200px]">
                  Empleado
                </th>
                {fechas.map((fecha, i) => {
                  const d = new Date(fecha + 'T12:00:00')
                  const diaSemana = d.getDay()
                  const esHoy = fecha === hoyStr
                  const esFinde = diaSemana === 0 || diaSemana === 6
                  const nombreFeriado = feriados.get(fecha)

                  // Separador de fin de semana (cuando ocultos): si el día es lunes y no es el primer día
                  const esLunesTrasOculto = ocultarFindes && diaSemana === 1 && i > 0

                  return (
                    <React.Fragment key={fecha}>
                      {esLunesTrasOculto && (
                        <th className="border-b border-borde-sutil w-[6px] min-w-[6px] max-w-[6px] p-0">
                          <div className="h-full flex items-center justify-center gap-[2px]">
                            <div className="w-[1px] h-8 bg-texto-terciario/20 rounded-full" />
                            <div className="w-[1px] h-8 bg-texto-terciario/20 rounded-full" />
                          </div>
                        </th>
                      )}
                      <th
                        className={`px-1 py-2 text-center border-b border-borde-sutil min-w-[90px] ${
                          esHoy ? 'bg-texto-marca/8' : nombreFeriado ? 'bg-violet-500/8' : ''
                        }`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider ${
                          nombreFeriado ? 'text-violet-400' : esFinde ? 'text-texto-terciario/50' : 'text-texto-terciario'
                        }`}>
                          {DIAS_SEMANA_CORTO[diaSemana]}
                        </div>
                        <div className={`text-lg font-semibold ${
                          esHoy ? 'text-texto-marca' : nombreFeriado ? 'text-violet-400' : esFinde ? 'text-texto-terciario/40' : 'text-texto-primario'
                        }`}>
                          {d.getDate()}
                        </div>
                        {nombreFeriado && (
                          <div className="text-[8px] text-violet-400 leading-tight truncate max-w-[80px] mx-auto" title={nombreFeriado}>
                            {nombreFeriado.length > 15 ? nombreFeriado.slice(0, 14) + '…' : nombreFeriado}
                          </div>
                        )}
                      </th>
                    </React.Fragment>
                  )
                })}
                {/* Resumen */}
                <th className="sticky right-0 z-20 bg-superficie-app px-3 py-2 text-center border-b border-l border-borde-sutil min-w-[70px]">
                  <div className="text-[10px] uppercase tracking-wider text-texto-terciario">Resumen</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro, idx) => {
                // Calcular resumen
                const asistMiembro = asistencias[miembro.id] || {}
                let presentes = 0
                let ausentes = 0
                for (const fecha of diasLaborales) {
                  const a = asistMiembro[fecha]
                  if (a && a.estado !== 'ausente') presentes++
                  else if (a && a.estado === 'ausente') ausentes++
                }
                const totalLaboral = diasLaborales.length
                const colorAvatar = COLORES_AVATAR[idx % COLORES_AVATAR.length]

                return (
                  <tr key={miembro.id} className="hover:bg-superficie-elevada/20 transition-colors">
                    {/* Empleado con avatar */}
                    <td className="sticky left-0 z-10 bg-superficie-app px-4 py-3 border-b border-borde-sutil">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colorAvatar}`}>
                          {iniciales(miembro.nombre)}
                        </div>
                        <span className="font-medium text-texto-primario text-sm whitespace-nowrap">
                          {miembro.nombre}
                        </span>
                      </div>
                    </td>

                    {/* Celdas por día */}
                    {fechas.map((fecha, i) => {
                      const asist = asistMiembro[fecha] as CeldaAsistencia | undefined
                      const estado = estadoCelda(asist)
                      const d = new Date(fecha + 'T12:00:00')
                      const diaSemana = d.getDay()
                      const esHoy = fecha === hoyStr
                      const esFinde = diaSemana === 0 || diaSemana === 6
                      const esFeriado = feriados.has(fecha)
                      const fondoCol = esHoy ? 'bg-texto-marca/5' : esFeriado ? 'bg-violet-500/5' : ''
                      const esLunesTrasOculto = ocultarFindes && diaSemana === 1 && i > 0

                      // Separador de fin de semana
                      const separador = esLunesTrasOculto ? (
                        <td className="border-b border-borde-sutil w-[6px] min-w-[6px] max-w-[6px] p-0">
                          <div className="h-full flex items-center justify-center gap-[2px]">
                            <div className="w-[1px] h-10 bg-texto-terciario/20 rounded-full" />
                            <div className="w-[1px] h-10 bg-texto-terciario/20 rounded-full" />
                          </div>
                        </td>
                      ) : null

                      // Fin de semana
                      if (esFinde) {
                        return (
                          <td key={fecha} className="px-1 py-1.5 border-b border-borde-sutil bg-superficie-elevada/20">
                            <div className="flex items-center justify-center h-[60px]">
                              <span className="text-texto-terciario/30 text-xs">—</span>
                            </div>
                          </td>
                        )
                      }

                      // Celda contenido
                      let celda: React.ReactNode

                      if (estado === 'ausente') {
                        celda = (
                          <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${fondoCol}`}>
                            <div className={`mx-auto rounded-lg h-[60px] flex items-center justify-center ${COLORES_CELDA.ausente.fondo} border ${COLORES_CELDA.ausente.borde}`}>
                              <span className="text-red-400 text-[11px] font-semibold uppercase">Ausente</span>
                            </div>
                          </td>
                        )
                      } else if (!asist || estado === 'vacio') {
                        celda = (
                          <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${fondoCol}`}>
                            <div className="h-[60px]" />
                          </td>
                        )
                      } else {
                        const colores = COLORES_CELDA[estado] || COLORES_CELDA.cerrado
                        const colorPunto = COLOR_PUNTO[estado] || 'bg-emerald-400'
                        const horaE = formatearHora(asist.hora_entrada)
                        const horaS = formatearHora(asist.hora_salida)
                        const etiquetaEstado = estado === 'cerrado' ? 'ok' :
                          estado === 'tardanza' ? 'tarde' :
                          estado === 'activo' ? 'en turno' :
                          estado === 'auto_cerrado' ? 'auto' : estado

                        celda = (
                          <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${fondoCol}`}>
                            <div className={`mx-auto rounded-lg h-[74px] flex flex-col items-center justify-center gap-1.5 border ${colores.fondo} ${colores.borde} cursor-default pt-1`}>
                              <div className={`size-2 rounded-full ${colorPunto} shrink-0`} />
                              <span className="text-xs font-semibold text-texto-primario leading-none">{horaE}</span>
                              <span className="text-[10px] text-texto-terciario leading-none">{horaS || '...'}</span>
                              <span className="text-[9px] text-texto-terciario/70 leading-none">{etiquetaEstado}</span>
                            </div>
                          </td>
                        )
                      }

                      return separador ? (
                        <React.Fragment key={fecha}>{separador}{celda}</React.Fragment>
                      ) : celda
                    })}

                    {/* Resumen */}
                    <td className="sticky right-0 z-10 bg-superficie-app px-3 py-3 text-center border-b border-l border-borde-sutil">
                      <div className="text-sm font-bold text-texto-primario">{presentes}/{totalLaboral}</div>
                      {ausentes > 0 && (
                        <div className="text-[10px] text-[color:var(--insignia-peligro)] font-medium">{ausentes}A</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {miembros.length === 0 && (
            <div className="flex items-center justify-center py-20 text-texto-terciario text-sm">
              No hay miembros activos
            </div>
          )}
        </div>
      )}
    </div>
  )
}

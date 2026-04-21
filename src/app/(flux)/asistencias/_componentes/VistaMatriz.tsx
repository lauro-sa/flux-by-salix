'use client'

import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import {
  Loader2, Printer, Download,
  Maximize2, CheckSquare, X,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { CabezaloHero, HeroRango } from '@/componentes/entidad/CabezaloHero'
import { formatearPuntualidadCorta } from '@/lib/constantes/asistencias'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { ModalNomina } from './ModalNomina'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useFormato } from '@/hooks/useFormato'
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
  normal:       { fondo: 'bg-asistencia-presente-fondo', borde: 'border-asistencia-presente/20' },
  cerrado:      { fondo: 'bg-asistencia-presente-fondo', borde: 'border-asistencia-presente/20' },
  activo:       { fondo: 'bg-asistencia-particular-fondo', borde: 'border-asistencia-particular/25' },
  tardanza:     { fondo: 'bg-asistencia-tarde-fondo', borde: 'border-asistencia-tarde/25' },
  almuerzo:     { fondo: 'bg-asistencia-almuerzo-fondo', borde: 'border-asistencia-almuerzo/20' },
  particular:   { fondo: 'bg-asistencia-particular-fondo', borde: 'border-asistencia-particular/20' },
  auto_cerrado: { fondo: 'bg-asistencia-ausente-fondo', borde: 'border-asistencia-ausente/20' },
  ausente:      { fondo: 'bg-asistencia-ausente-fondo', borde: 'border-asistencia-ausente/15' },
  feriado:      { fondo: 'bg-asistencia-feriado-fondo', borde: 'border-asistencia-feriado/20' },
}

const COLOR_PUNTO: Record<string, string> = {
  normal: 'bg-asistencia-presente',
  cerrado: 'bg-asistencia-presente',
  activo: 'bg-asistencia-particular',
  tardanza: 'bg-asistencia-tarde',
  auto_cerrado: 'bg-asistencia-ausente',
  ausente: 'bg-asistencia-ausente',
  feriado: 'bg-asistencia-feriado',
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

function formatearHora(iso: string | null, formato: string = '24h'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (formato === '12h') {
    const h = d.getHours() % 12 || 12
    const m = String(d.getMinutes()).padStart(2, '0')
    const ampm = d.getHours() < 12 ? 'AM' : 'PM'
    return `${h}:${m} ${ampm}`
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** hoyStr para comparaciones — se usa en estadoCelda y renderizado */
const hoyStrGlobal = new Date().toISOString().split('T')[0]

function estadoCelda(asist: CeldaAsistencia | undefined, fecha?: string, esFinde?: boolean, esFeriado?: boolean): string {
  if (asist) {
    // Feriado: verificar tanto estado como tipo (el cron marca tipo='feriado' pero el estado puede quedar diferente)
    if (asist.estado === 'feriado' || asist.tipo === 'feriado') return 'feriado'
    if (asist.tipo === 'tardanza') return 'tardanza'
    if (asist.estado === 'ausente') return 'ausente'
    if (asist.estado === 'auto_cerrado') return 'auto_cerrado'
    if (asist.estado === 'activo') return 'activo'
    return 'cerrado'
  }
  // Sin registro: feriado visual (sin record en BD)
  if (fecha && esFeriado && !esFinde) return 'feriado'
  // Sin registro: si es día laboral pasado (no finde, no feriado, no futuro) → ausente
  if (fecha && !esFinde && !esFeriado && fecha < hoyStrGlobal) {
    return 'ausente'
  }
  return 'vacio'
}

function iniciales(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const COLORES_AVATAR = [
  'bg-insignia-info/20 text-insignia-info',
  'bg-insignia-exito/20 text-insignia-exito',
  'bg-insignia-advertencia/20 text-insignia-advertencia',
  'bg-[color:var(--insignia-peligro)]/20 text-[color:var(--insignia-peligro)]',
  'bg-insignia-violeta/20 text-insignia-violeta',
  'bg-insignia-cyan/20 text-insignia-cyan',
]

// ─── Componente ──────────────────────────────────────────────

export function VistaMatriz({ onClickAsistencia, onCrearFichaje, recargarKey, slotTabs, slotAcciones }: {
  onClickAsistencia?: (asistenciaId: string) => void
  onCrearFichaje?: (miembroId: string, miembroNombre: string, fecha: string) => void
  recargarKey?: number
  /** Slot opcional para renderizar los tabs entre el hero y los controles */
  slotTabs?: ReactNode
  /** Slot opcional para acciones a la izquierda de la navegación ‹ Hoy › (ej. switcher de vistas) */
  slotAcciones?: ReactNode
}) {
  const [nominaAbierta, setNominaAbierta] = useState(false)
  const esMovil = useEsMovil()
  const { formatoHora, locale } = useFormato()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [offset, setOffset] = useState(0)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [asistencias, setAsistencias] = useState<Record<string, Record<string, CeldaAsistencia>>>({})
  const [cargando, setCargando] = useState(true)
  const [ocultarFindes, setOcultarFindes] = useState(false)
  const [ajustarPantalla, setAjustarPantalla] = useState(false)
  // Modo selección (oculto por defecto)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  // Selección: celdas individuales (miembroId:fecha) + empleados completos
  const [selCeldas, setSelCeldas] = useState<Set<string>>(new Set())

  const celdaKey = (miembroId: string, fecha: string) => `${miembroId}:${fecha}`

  const toggleCelda = (miembroId: string, fecha: string) => {
    const key = celdaKey(miembroId, fecha)
    setSelCeldas(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  // Seleccionar todos los días de un empleado
  const toggleEmpleado = (id: string) => {
    const diasLab = fechas.filter(f => { const d = new Date(f + 'T12:00:00').getDay(); return d !== 0 && d !== 6 })
    const keys = diasLab.map(f => celdaKey(id, f))
    const todosSeleccionados = keys.every(k => selCeldas.has(k))
    setSelCeldas(prev => {
      const n = new Set(prev)
      if (todosSeleccionados) { keys.forEach(k => n.delete(k)) }
      else { keys.forEach(k => n.add(k)) }
      return n
    })
  }

  const toggleTodosEmpleados = () => {
    const diasLab = fechas.filter(f => { const d = new Date(f + 'T12:00:00').getDay(); return d !== 0 && d !== 6 })
    const totalKeys = miembros.flatMap(m => diasLab.map(f => celdaKey(m.id, f)))
    const todosSeleccionados = totalKeys.length > 0 && totalKeys.every(k => selCeldas.has(k))
    setSelCeldas(todosSeleccionados ? new Set() : new Set(totalKeys))
  }

  // Verificar si un empleado tiene todas sus celdas seleccionadas
  const empleadoSeleccionado = (id: string) => {
    const diasLab = fechas.filter(f => { const d = new Date(f + 'T12:00:00').getDay(); return d !== 0 && d !== 6 })
    return diasLab.length > 0 && diasLab.every(f => selCeldas.has(celdaKey(id, f)))
  }
  const empleadoParcial = (id: string) => {
    const diasLab = fechas.filter(f => { const d = new Date(f + 'T12:00:00').getDay(); return d !== 0 && d !== 6 })
    const sel = diasLab.filter(f => selCeldas.has(celdaKey(id, f))).length
    return sel > 0 && sel < diasLab.length
  }

  const haySeleccion = selCeldas.size > 0

  // Derivar empleados y días seleccionados para la nómina
  const selEmpleadosNomina = useMemo(() => {
    const ids = new Set<string>()
    selCeldas.forEach(k => ids.add(k.split(':')[0]))
    return Array.from(ids)
  }, [selCeldas])

  const selDiasNomina = useMemo(() => {
    const dias = new Set<string>()
    selCeldas.forEach(k => dias.add(k.split(':')[1]))
    return Array.from(dias)
  }, [selCeldas])

  const { desde, hasta, etiqueta } = useMemo(() => obtenerRango(periodo, offset), [periodo, offset])
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
    return d !== 0 && d !== 6 && !feriados.has(f)
  }), [todasLasFechas, feriados])

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

  useEffect(() => { cargar() }, [cargar, recargarKey])

  const hoyStr = new Date().toISOString().split('T')[0]

  // Nivel de compresión según cantidad de días y ajustar pantalla
  const esUltra = ajustarPantalla && fechas.length > 16
  const esCompacto = ajustarPantalla && !esUltra
  // Quincena+ sin ajustar: celdas intermedias (más angostas que semana)
  const esIntermedio = !ajustarPantalla && fechas.length > 8
  // Vista semanal: celdas amplias con duración visible
  const esSemanal = !esUltra && !esCompacto && !esIntermedio

  // Altura común de celdas según modo — todos los tipos (ausente, feriado, vacío,
  // finde, fichaje) usan la misma para que las filas no tengan espacios muertos
  const altoCelda = esUltra
    ? 'h-[20px]'
    : esCompacto
      ? 'h-[52px]'
      : esIntermedio
        ? 'h-[62px]'
        : esSemanal
          ? 'h-[90px]'
          : 'h-[74px]'

  return (
    <div className="flex flex-col h-full">
      <CabezaloHero
        titulo={<HeroRango desde={desde} hasta={hasta} periodo={periodo} />}
        onAnterior={() => setOffset(o => o - 1)}
        onSiguiente={() => setOffset(o => o + 1)}
        onHoy={() => setOffset(0)}
        hoyDeshabilitado={offset === 0}
        slotAcciones={slotAcciones}
        slotTabs={slotTabs}
        slotControles={<>
          {/* Selector de período */}
          <GrupoBotones>
            {(['semana', 'quincena', 'mes'] as Periodo[]).map((p) => (
              <Boton
                key={p}
                variante="secundario"
                tamano="sm"
                onClick={() => { setPeriodo(p); setOffset(0) }}
                className={periodo === p ? 'bg-superficie-hover text-texto-primario font-semibold' : 'text-texto-terciario'}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Boton>
            ))}
          </GrupoBotones>

          {/* Interruptor Sáb/Dom */}
          <div className="flex items-center gap-2 pl-1">
            <Interruptor activo={!ocultarFindes} onChange={(v) => setOcultarFindes(!v)} />
            <span className="text-xs text-texto-secundario select-none">Sáb/Dom</span>
          </div>

          {/* Iconos de vista — agrupados */}
          <GrupoBotones>
            <Boton
              variante="secundario"
              tamano="sm"
              soloIcono
              icono={<Maximize2 size={13} />}
              onClick={() => setAjustarPantalla(v => !v)}
              titulo={ajustarPantalla ? 'Tamaño normal' : 'Ajustar a pantalla'}
              className={ajustarPantalla ? 'text-texto-marca bg-texto-marca/10 border-texto-marca/30' : ''}
            />
            <Boton
              variante="secundario"
              tamano="sm"
              soloIcono
              icono={modoSeleccion ? <X size={13} /> : <CheckSquare size={13} />}
              onClick={() => { setModoSeleccion(v => !v); if (modoSeleccion) setSelCeldas(new Set()) }}
              titulo={modoSeleccion ? `Salir de selección (${selCeldas.size} sel.)` : 'Seleccionar para nómina'}
              className={modoSeleccion ? 'text-texto-marca bg-texto-marca/10 border-texto-marca/30' : ''}
            />
          </GrupoBotones>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Acciones a la derecha */}
          <GrupoBotones>
          <Boton
            variante="secundario"
            tamano="sm"
            icono={<Printer size={12} />}
            onClick={() => setNominaAbierta(true)}
          >
            <span className="hidden sm:inline">Nómina</span>
            {haySeleccion && (
              <span className="text-xxs bg-texto-marca/20 text-texto-marca px-1 py-0.5 rounded-full ml-1">{selCeldas.size}</span>
            )}
          </Boton>
          <Boton
            variante="secundario"
            tamano="sm"
            icono={<Download size={12} />}
            onClick={() => {
              const d = desde.toISOString().split('T')[0]
              const h = hasta.toISOString().split('T')[0]
              window.open(`/api/asistencias/exportar?desde=${d}&hasta=${h}`, '_blank')
            }}
          >
            <span className="hidden sm:inline">Exportar</span>
          </Boton>
        </GrupoBotones>
        </>}
      />

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
              if (a && (a.estado === 'feriado' || a.tipo === 'feriado')) continue
              if (a && a.estado !== 'ausente') presentes++
              else if (a && a.estado === 'ausente') ausentes++
            }
            const totalLaboral = diasLaborales.length
            const colorAvatar = COLORES_AVATAR[idx % COLORES_AVATAR.length]

            return (
              <div key={miembro.id} className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
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
                    {ausentes > 0 && <span className="text-xs font-semibold text-asistencia-ausente">{ausentes}A</span>}
                  </div>
                </div>

                {/* Mini calendario semanal */}
                <div className="px-3 pb-3">
                  <div className="bg-superficie-app/50 rounded-card border border-borde-sutil/50 overflow-hidden">
                    {/* Días header */}
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${fechas.length}, 1fr)` }}>
                      {fechas.map((fecha) => {
                        const d = new Date(fecha + 'T12:00:00')
                        const diaSemana = d.getDay()
                        const esFinde = diaSemana === 0 || diaSemana === 6
                        const diasMovil = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
                        return (
                          <div key={fecha} className={`text-center py-1.5 text-xxs font-medium ${esFinde ? 'text-texto-terciario/40' : 'text-texto-terciario'}`}>
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
                        const estado = estadoCelda(asist, fecha, esFinde, esFeriado)

                        // Fondo según estado
                        let fondoCelda = 'bg-transparent'
                        let textColor = 'text-texto-primario'
                        let subTexto = ''
                        let puntoColor = ''

                        if (esFinde) {
                          fondoCelda = 'bg-superficie-elevada/40'
                          textColor = 'text-texto-terciario/30'
                        } else if (estado === 'ausente') {
                          fondoCelda = 'bg-asistencia-ausente/12 border border-asistencia-ausente/20'
                          subTexto = 'AUS'
                        } else if (estado === 'tardanza') {
                          fondoCelda = 'bg-asistencia-tarde/12 border border-asistencia-tarde/20'
                          puntoColor = 'bg-asistencia-tarde'
                        } else if (estado === 'cerrado' || estado === 'normal') {
                          fondoCelda = 'bg-asistencia-presente/12 border border-asistencia-presente/20'
                          puntoColor = 'bg-asistencia-presente'
                        } else if (estado === 'activo') {
                          fondoCelda = 'bg-asistencia-particular/12 border border-asistencia-particular/20'
                          puntoColor = 'bg-asistencia-particular'
                        } else if (estado === 'auto_cerrado') {
                          fondoCelda = 'bg-asistencia-ausente/8 border border-asistencia-ausente/15'
                          puntoColor = 'bg-asistencia-ausente'
                        }

                        if (esFeriado && !esFinde) {
                          fondoCelda = estado !== 'vacio' ? fondoCelda : 'bg-asistencia-feriado/10 border border-asistencia-feriado/20'
                          textColor = estado === 'vacio' ? 'text-asistencia-feriado' : textColor
                        }

                        if (esHoy) textColor = 'text-texto-marca'

                        return (
                          <div
                            key={fecha}
                            className={`flex flex-col items-center justify-center py-2 rounded-card ${fondoCelda}`}
                          >
                            <span className={`text-sm font-bold ${textColor}`}>
                              {d.getDate()}
                            </span>

                            {esFinde ? (
                              <span className="text-texto-terciario/20 text-xxs leading-none">—</span>
                            ) : subTexto ? (
                              <span className="text-asistencia-ausente text-xxs font-bold leading-none mt-0.5">{subTexto}</span>
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
          <table className={`border-collapse text-sm ${ajustarPantalla ? 'w-full table-fixed' : 'w-full'}`}>
            <thead className="sticky top-0 z-10 bg-superficie-app">
              <tr>
                <th className={`sticky left-0 z-20 bg-superficie-app text-left font-medium text-texto-terciario text-xs uppercase tracking-wider border-b border-borde-sutil ${esUltra ? 'w-[120px] px-2 py-2' : esCompacto ? 'w-[160px] px-3 py-2' : esIntermedio ? 'w-[140px] max-w-[140px] px-2 py-3' : 'min-w-[200px] px-4 py-3'}`}>
                  <div className="flex items-center gap-2">
                    {modoSeleccion && (
                      <Checkbox
                        marcado={selCeldas.size > 0 && miembros.every(m => empleadoSeleccionado(m.id))}
                        indeterminado={haySeleccion && !miembros.every(m => empleadoSeleccionado(m.id))}
                        onChange={toggleTodosEmpleados}
                      />
                    )}
                    <span>Empleado</span>
                  </div>
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
                          <div className="h-full flex items-center justify-center gap-0.5">
                            <div className="w-[1px] h-8 bg-texto-terciario/20 rounded-full" />
                            <div className="w-[1px] h-8 bg-texto-terciario/20 rounded-full" />
                          </div>
                        </th>
                      )}
                      <th
                        className={`py-2 text-center border-b border-borde-sutil ${esUltra ? 'px-0' : esCompacto ? 'px-0.5' : esIntermedio ? 'px-0.5 min-w-[70px]' : 'px-1 min-w-[90px]'} ${
                          esHoy ? 'bg-texto-marca/8' : nombreFeriado ? 'bg-asistencia-feriado/8' : ''
                        }`}
                      >
                        <div className={`${esUltra ? 'text-[7px]' : 'text-xxs'} uppercase tracking-wider ${
                          nombreFeriado ? 'text-asistencia-feriado' : esFinde ? 'text-texto-terciario/50' : 'text-texto-terciario'
                        }`}>
                          {esUltra ? DIAS_SEMANA_CORTO[diaSemana].charAt(0) : DIAS_SEMANA_CORTO[diaSemana]}
                        </div>
                        <div className={`${esUltra ? 'text-xs' : esCompacto ? 'text-sm' : esIntermedio ? 'text-base' : 'text-lg'} font-semibold ${
                          esHoy ? 'text-texto-marca' : nombreFeriado ? 'text-asistencia-feriado' : esFinde ? 'text-texto-terciario/40' : 'text-texto-primario'
                        }`}>
                          {d.getDate()}
                        </div>
                        {nombreFeriado && esUltra && (
                          <div className="size-1 rounded-full bg-asistencia-feriado mx-auto mt-0.5" title={nombreFeriado} />
                        )}
                        {nombreFeriado && !esUltra && (
                          <div className="text-xxs text-asistencia-feriado leading-tight truncate max-w-[80px] mx-auto" title={nombreFeriado}>
                            {nombreFeriado.length > 15 ? nombreFeriado.slice(0, 14) + '…' : nombreFeriado}
                          </div>
                        )}
                      </th>
                    </React.Fragment>
                  )
                })}
                {/* Resumen */}
                <th className={`sticky right-0 z-20 bg-superficie-app px-3 py-2 text-center border-b border-l border-borde-sutil ${ajustarPantalla ? 'w-[60px]' : 'min-w-[70px]'}`}>
                  <div className="text-xxs uppercase tracking-wider text-texto-terciario">Resumen</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro, idx) => {
                // Calcular resumen: días laborales + feriados donde sí fichó
                const asistMiembro = asistencias[miembro.id] || {}
                let presentes = 0
                let ausentes = 0
                let feriadosTrabajados = 0
                for (const fecha of diasLaborales) {
                  const a = asistMiembro[fecha]
                  if (a && a.estado !== 'ausente') presentes++
                  else if (a && a.estado === 'ausente') ausentes++
                }
                // Contar feriados donde realmente fichó (hora_entrada presente)
                for (const [fechaFer] of feriados) {
                  const a = asistMiembro[fechaFer]
                  if (a && a.hora_entrada) { presentes++; feriadosTrabajados++ }
                }
                const totalLaboral = diasLaborales.length + feriadosTrabajados
                const colorAvatar = COLORES_AVATAR[idx % COLORES_AVATAR.length]

                return (
                  <tr key={miembro.id} className="hover:bg-superficie-elevada/20 transition-colors">
                    {/* Empleado con avatar */}
                    <td className={`sticky left-0 z-10 bg-superficie-app border-b border-borde-sutil ${esUltra ? 'px-2 py-1.5' : esCompacto || esIntermedio ? 'px-2 py-2' : 'px-4 py-3'}`}>
                      <div className="flex items-center gap-2">
                        {modoSeleccion && (
                          <Checkbox
                            marcado={empleadoSeleccionado(miembro.id)}
                            indeterminado={empleadoParcial(miembro.id)}
                            onChange={() => toggleEmpleado(miembro.id)}
                          />
                        )}
                        <div className={`${esUltra ? 'size-6 text-xxs' : esCompacto || esIntermedio ? 'size-7 text-xxs' : 'size-8 text-xs'} rounded-full flex items-center justify-center font-bold shrink-0 ${colorAvatar}`}>
                          {iniciales(miembro.nombre)}
                        </div>
                        <span className={`font-medium text-texto-primario ${esUltra ? 'text-xs leading-tight' : esCompacto || esIntermedio ? 'text-xs leading-tight' : 'text-sm whitespace-nowrap'}`}>
                          {miembro.nombre}
                        </span>
                      </div>
                    </td>

                    {/* Celdas por día */}
                    {fechas.map((fecha, i) => {
                      const asist = asistMiembro[fecha] as CeldaAsistencia | undefined
                      const d = new Date(fecha + 'T12:00:00')
                      const diaSemana = d.getDay()
                      const esHoy = fecha === hoyStr
                      const esFinde = diaSemana === 0 || diaSemana === 6
                      const esFeriado = feriados.has(fecha)
                      const estado = estadoCelda(asist, fecha, esFinde, esFeriado)
                      const fondoCol = esHoy ? 'bg-texto-marca/5' : esFeriado ? 'bg-asistencia-feriado/5' : ''
                      const celdaSel = modoSeleccion && selCeldas.has(celdaKey(miembro.id, fecha))
                      const ringSeleccion = celdaSel ? 'ring-2 ring-texto-marca/50 ring-inset rounded-boton' : ''
                      const esLunesTrasOculto = ocultarFindes && diaSemana === 1 && i > 0

                      // Separador de fin de semana
                      const separador = esLunesTrasOculto ? (
                        <td className="border-b border-borde-sutil w-[6px] min-w-[6px] max-w-[6px] p-0">
                          <div className="h-full flex items-center justify-center gap-0.5">
                            <div className="w-[1px] h-10 bg-texto-terciario/20 rounded-full" />
                            <div className="w-[1px] h-10 bg-texto-terciario/20 rounded-full" />
                          </div>
                        </td>
                      ) : null

                      // Fin de semana
                      if (esFinde) {
                        return (
                          <td key={fecha} className={`${esUltra ? 'px-0 py-1' : 'px-1 py-1.5'} border-b border-borde-sutil bg-superficie-elevada/20`}>
                            <div className={`flex items-center justify-center ${altoCelda}`}>
                              <span className={`text-texto-terciario/30 ${esUltra ? 'text-xxs' : 'text-xs'}`}>—</span>
                            </div>
                          </td>
                        )
                      }

                      // Celda contenido
                      let celda: React.ReactNode

                      if (estado === 'feriado') {
                        const nombreFer = feriados.get(fecha) || 'Feriado'
                        celda = (
                          <td key={fecha} className={`${esUltra ? 'px-0 py-1' : 'px-1 py-1.5'} border-b border-borde-sutil ${fondoCol} ${ringSeleccion}`}>
                            {esUltra ? (
                              <div className="group/celda relative mx-auto">
                                <div className="size-5 rounded-boton bg-asistencia-feriado/20 flex items-center justify-center">
                                  <span className="text-asistencia-feriado text-[7px] font-bold">F</span>
                                </div>
                                <div className="absolute z-[var(--z-popover)] top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 scale-95 pointer-events-none group-hover/celda:opacity-100 group-hover/celda:scale-100 transition-all duration-150">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 bg-superficie-elevada border-l border-t border-borde-sutil rotate-45 mb-[-5px]" />
                                  <div className="bg-superficie-elevada border border-borde-sutil rounded-card shadow-xl px-3 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <div className="size-2 rounded-full bg-asistencia-feriado" />
                                      <span className="text-xs font-medium text-asistencia-feriado">Feriado</span>
                                    </div>
                                    <p className="text-xxs text-texto-terciario mt-0.5">{nombreFer}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                            <div className={`mx-auto rounded-card ${altoCelda} flex flex-col items-center justify-center ${COLORES_CELDA.feriado.fondo} border ${COLORES_CELDA.feriado.borde}`}>
                              <span className={`text-asistencia-feriado ${esCompacto ? 'text-xxs' : 'text-xs'} font-semibold`}>Feriado</span>
                              {!esCompacto && <span className="text-xxs text-asistencia-feriado/60 truncate max-w-[80px]">{nombreFer}</span>}
                            </div>
                            )}
                          </td>
                        )
                      } else if (estado === 'ausente') {
                        celda = (
                          <td key={fecha} className={`${esUltra ? 'px-0 py-1' : 'px-1 py-1.5'} border-b border-borde-sutil ${fondoCol} ${ringSeleccion}`}>
                            {esUltra ? (
                              <div className="group/celda relative mx-auto">
                                <div className="size-5 rounded-boton bg-asistencia-ausente/20 flex items-center justify-center cursor-pointer" role="gridcell" tabIndex={0} onClick={() => { if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else if (asist) { onClickAsistencia?.(asist.id) } else { onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else if (asist) { onClickAsistencia?.(asist.id) } else { onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } } }}>
                                  <span className="text-asistencia-ausente text-[7px] font-bold">A</span>
                                </div>
                                <div className="absolute z-[var(--z-popover)] top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 scale-95 pointer-events-none group-hover/celda:opacity-100 group-hover/celda:scale-100 transition-all duration-150">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 bg-superficie-elevada border-l border-t border-borde-sutil rotate-45 mb-[-5px]" />
                                  <div className="bg-superficie-elevada border border-borde-sutil rounded-card shadow-xl px-3 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <div className="size-2 rounded-full bg-asistencia-ausente" />
                                      <span className="text-xs font-medium text-asistencia-ausente">Ausente</span>
                                    </div>
                                    <p className="text-xxs text-texto-terciario mt-0.5">Sin registro de asistencia</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                            <div role="gridcell" tabIndex={0} onClick={() => { if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else if (asist) { onClickAsistencia?.(asist.id) } else { onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else if (asist) { onClickAsistencia?.(asist.id) } else { onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } } }} className={`mx-auto rounded-card ${altoCelda} flex items-center justify-center px-1 overflow-hidden ${COLORES_CELDA.ausente.fondo} border ${COLORES_CELDA.ausente.borde} cursor-pointer hover:brightness-110 transition-all`} title="Ausente">
                              <span className={`text-asistencia-ausente ${esCompacto || esIntermedio ? 'text-xxs' : 'text-xs'} font-semibold uppercase whitespace-nowrap leading-none`}>{esCompacto || esIntermedio ? 'Aus.' : 'Ausente'}</span>
                            </div>
                            )}
                          </td>
                        )
                      } else if (!asist || estado === 'vacio') {
                        celda = (
                          <td key={fecha} className={`${esUltra ? 'px-0 py-1' : 'px-1 py-1.5'} border-b border-borde-sutil ${fondoCol} ${ringSeleccion}`}>
                            <div
                              className={`${altoCelda} ${!esFinde ? 'cursor-pointer hover:bg-superficie-elevada/30 rounded-card transition-colors' : ''}`}
                              {...(!esFinde ? { role: 'gridcell' as const, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (modoSeleccion) toggleCelda(miembro.id, fecha); else onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } } } : {})}
                              onClick={() => { if (!esFinde) { if (modoSeleccion) toggleCelda(miembro.id, fecha); else onCrearFichaje?.(miembro.id, miembro.nombre, fecha) } }}
                            />
                          </td>
                        )
                      } else {
                        const colores = COLORES_CELDA[estado] || COLORES_CELDA.cerrado
                        const colorPunto = COLOR_PUNTO[estado] || 'bg-asistencia-presente'
                        const horaE = formatearHora(asist.hora_entrada, formatoHora)
                        const horaS = formatearHora(asist.hora_salida, formatoHora)
                        const etiquetaEstado = estado === 'cerrado' ? 'ok' :
                          estado === 'tardanza' ? 'tarde' :
                          estado === 'activo' ? 'en turno' :
                          estado === 'auto_cerrado' ? 'auto' : estado

                        // Duración para tooltip
                        const entradaMs = asist.hora_entrada ? new Date(asist.hora_entrada).getTime() : 0
                        const salidaMs = asist.hora_salida ? new Date(asist.hora_salida).getTime() : Date.now()
                        const min = entradaMs ? Math.max(0, Math.round((salidaMs - entradaMs) / 60000)) : 0
                        const fmtDur = (m: number) => { const h = Math.floor(m/60); const mm = m%60; return h === 0 ? `${mm}min` : mm > 0 ? `${h}h ${mm}min` : `${h}h` }
                        const colorDurTxt = estado === 'auto_cerrado' || estado === 'tardanza' ? 'text-asistencia-tarde' : 'text-asistencia-presente'

                        celda = (
                          <td key={fecha} className={`${esUltra ? 'px-0 py-1 text-center' : 'px-1 py-1.5'} border-b border-borde-sutil ${fondoCol} ${ringSeleccion}`}>
                            {esUltra ? (
                              /* Ultra compacto: solo punto de color con tooltip rico */
                              <div className="group/celda relative inline-flex justify-center">
                                <div
                                  className="size-5 rounded-boton flex items-center justify-center cursor-pointer"
                                  onClick={() => { if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else { onClickAsistencia?.(asist.id) } }}
                                  style={{ backgroundColor: `color-mix(in srgb, ${estado === 'cerrado' ? '#10b981' : estado === 'tardanza' ? '#f59e0b' : estado === 'auto_cerrado' ? '#ef4444' : estado === 'activo' ? '#0ea5e9' : '#10b981'} 20%, transparent)` }}
                                >
                                  <div className={`size-1.5 rounded-full ${colorPunto}`} />
                                </div>
                                {/* Tooltip rico al hacer hover — aparece abajo */}
                                <div className="absolute z-[var(--z-popover)] top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 scale-95 pointer-events-none group-hover/celda:opacity-100 group-hover/celda:scale-100 transition-all duration-150">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 bg-superficie-elevada border-l border-t border-borde-sutil rotate-45 mb-[-5px]" />
                                  <div className="bg-superficie-elevada border border-borde-sutil rounded-card shadow-xl min-w-[180px] overflow-hidden">
                                    {/* Estado + fecha */}
                                    <div className="px-3 py-2 border-b border-white/[0.07]">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`size-2 rounded-full ${colorPunto}`} />
                                        <span className="text-xs font-medium text-texto-primario capitalize">{etiquetaEstado}</span>
                                      </div>
                                      <p className="text-[10px] text-texto-terciario/50 mt-0.5">
                                        {new Date(fecha + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                                      </p>
                                    </div>
                                    {/* Horarios */}
                                    <div className="px-3 py-2 border-b border-white/[0.07] text-center">
                                      <p className="text-sm font-semibold text-texto-primario tracking-tight">{horaE} → {horaS || '...'}</p>
                                      {min > 0 && (
                                        <p className={`text-lg font-bold mt-0.5 ${colorDurTxt}`}>{fmtDur(min)}</p>
                                      )}
                                    </div>
                                    {/* Método + detalles */}
                                    <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-texto-terciario/60">
                                      <span>{asist.metodo_registro === 'automatico' ? 'Auto' : asist.metodo_registro === 'manual' ? 'Manual' : asist.metodo_registro}</span>
                                      {asist.puntualidad_min != null && asist.puntualidad_min !== 0 && (
                                        <span className={asist.puntualidad_min < 0 ? 'text-asistencia-presente' : 'text-asistencia-ausente'}>
                                          {formatearPuntualidadCorta(asist.puntualidad_min)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Normal / compacto — con tooltip rico en hover */
                              <div className="group/celda relative mx-auto">
                                <div
                                  onClick={() => { if (modoSeleccion) { toggleCelda(miembro.id, fecha) } else { onClickAsistencia?.(asist.id) } }}
                                  className={`rounded-card ${esCompacto ? 'h-[52px] gap-0.5 px-0.5' : esIntermedio ? 'h-[62px] gap-1 px-0.5' : esSemanal ? 'h-[90px] gap-1 pt-1.5' : 'h-[74px] gap-1.5 pt-1'} flex flex-col items-center justify-center border ${colores.fondo} ${colores.borde} cursor-pointer hover:brightness-110 transition-all`}>
                                  <div className={`${esCompacto || esIntermedio ? 'size-1.5' : 'size-2'} rounded-full ${colorPunto} shrink-0`} />
                                  <span className={`${esCompacto ? 'text-xxs' : 'text-xs'} font-semibold text-texto-primario leading-none`}>{horaE}</span>
                                  <span className="text-xxs text-texto-terciario leading-none">{horaS || '...'}</span>
                                  {esSemanal && min > 0 && (
                                    <span className={`text-xxs font-semibold leading-none mt-0.5 ${colorDurTxt}`}>{fmtDur(min)}</span>
                                  )}
                                </div>
                                {/* Tooltip rico */}
                                <div className="absolute z-[var(--z-popover)] top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 scale-95 pointer-events-none group-hover/celda:opacity-100 group-hover/celda:scale-100 transition-all duration-150">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 bg-superficie-elevada border-l border-t border-borde-sutil rotate-45 mb-[-5px]" />
                                  <div className="bg-superficie-elevada border border-borde-sutil rounded-card shadow-xl min-w-[180px] overflow-hidden">
                                    <div className="px-3 py-2 border-b border-white/[0.07]">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`size-2 rounded-full ${colorPunto}`} />
                                        <span className="text-xs font-medium text-texto-primario capitalize">{etiquetaEstado}</span>
                                      </div>
                                      <p className="text-[10px] text-texto-terciario/50 mt-0.5">
                                        {new Date(fecha + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                                      </p>
                                    </div>
                                    <div className="px-3 py-2 border-b border-white/[0.07] text-center">
                                      <p className="text-sm font-semibold text-texto-primario tracking-tight">{horaE} → {horaS || '...'}</p>
                                      {min > 0 && (
                                        <p className={`text-lg font-bold mt-0.5 ${colorDurTxt}`}>{fmtDur(min)}</p>
                                      )}
                                    </div>
                                    <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-texto-terciario/60">
                                      <span>{asist.metodo_registro === 'automatico' ? 'Auto' : asist.metodo_registro === 'manual' ? 'Manual' : asist.metodo_registro}</span>
                                      {asist.puntualidad_min != null && asist.puntualidad_min !== 0 && (
                                        <span className={asist.puntualidad_min < 0 ? 'text-asistencia-presente' : 'text-asistencia-ausente'}>
                                          {formatearPuntualidadCorta(asist.puntualidad_min)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
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
                        <div className="text-xxs text-[color:var(--insignia-peligro)] font-medium">{ausentes}A</div>
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

      <ModalNomina
        abierto={nominaAbierta}
        onCerrar={() => setNominaAbierta(false)}
        desde={desde.toISOString().split('T')[0]}
        hasta={hasta.toISOString().split('T')[0]}
        etiquetaPeriodo={etiqueta}
        empleadosSeleccionados={haySeleccion ? selEmpleadosNomina : undefined}
        diasSeleccionados={haySeleccion ? selDiasNomina : undefined}
      />
    </div>
  )
}

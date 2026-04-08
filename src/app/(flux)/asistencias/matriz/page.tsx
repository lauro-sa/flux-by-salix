'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, ChevronLeft, ChevronRight, ArrowLeft,
  List, Loader2,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'

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
  editado_por: string | null
}

type Periodo = 'semana' | 'quincena' | 'mes'

// ─── Constantes ──────────────────────────────────────────────

const COLORES_ESTADO: Record<string, { bg: string; texto: string; etiqueta: string }> = {
  activo:       { bg: 'bg-insignia-exito/20', texto: 'text-insignia-exito', etiqueta: 'En turno' },
  cerrado:      { bg: 'bg-insignia-exito/20', texto: 'text-insignia-exito', etiqueta: 'Normal' },
  tardanza:     { bg: 'bg-insignia-advertencia/20', texto: 'text-insignia-advertencia', etiqueta: 'Tardanza' },
  almuerzo:     { bg: 'bg-insignia-advertencia/20', texto: 'text-insignia-advertencia', etiqueta: 'Almuerzo' },
  particular:   { bg: 'bg-insignia-info/20', texto: 'text-insignia-info', etiqueta: 'Trámite' },
  auto_cerrado: { bg: 'bg-[color:var(--insignia-peligro)]/15', texto: 'text-[color:var(--insignia-peligro)]', etiqueta: 'Sin salida' },
  ausente:      { bg: 'bg-[color:var(--insignia-peligro)]/20', texto: 'text-[color:var(--insignia-peligro)]', etiqueta: 'Ausente' },
}

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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

function obtenerRango(periodo: Periodo, offset: number, locale: string): { desde: Date; hasta: Date; etiqueta: string } {
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0) // evitar drift UTC

  if (periodo === 'semana') {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - hoy.getDay() + 1 + (offset * 7)) // lunes
    const fin = new Date(inicio)
    fin.setDate(inicio.getDate() + 6) // domingo
    const etiqueta = `${inicio.getDate()}/${inicio.getMonth() + 1} — ${fin.getDate()}/${fin.getMonth() + 1}`
    return { desde: inicio, hasta: fin, etiqueta }
  }

  if (periodo === 'quincena') {
    const mesBase = hoy.getMonth() + Math.floor(offset / 2)
    const anoBase = hoy.getFullYear() + Math.floor(mesBase / 12)
    const mes = ((mesBase % 12) + 12) % 12
    const esSegunda = (offset % 2 !== 0) ? hoy.getDate() > 15 : offset % 2 !== 0

    if ((!esSegunda && offset >= 0) || (esSegunda && offset < 0)) {
      const desde = new Date(anoBase, mes, 1)
      const hasta = new Date(anoBase, mes, 15)
      return { desde, hasta, etiqueta: `1-15 ${desde.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}` }
    } else {
      const desde = new Date(anoBase, mes, 16)
      const hasta = new Date(anoBase, mes + 1, 0) // último día del mes
      return { desde, hasta, etiqueta: `16-${hasta.getDate()} ${desde.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}` }
    }
  }

  // mes
  const mesBase = hoy.getMonth() + offset
  const anoBase = hoy.getFullYear() + Math.floor(mesBase / 12)
  const mes = ((mesBase % 12) + 12) % 12
  const desde = new Date(anoBase, mes, 1)
  const hasta = new Date(anoBase, mes + 1, 0)
  const etiqueta = desde.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return { desde, hasta, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) }
}

function formatearHora(iso: string | null, locale: string, hour12 = false): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 })
}

function estadoCelda(asist: CeldaAsistencia | undefined): string {
  if (!asist) return 'vacio'
  if (asist.tipo === 'tardanza') return 'tardanza'
  if (asist.estado === 'ausente') return 'ausente'
  if (asist.estado === 'auto_cerrado') return 'auto_cerrado'
  return asist.estado
}

// ─── Página ──────────────────────────────────────────────────

export default function PaginaMatrizAsistencias() {
  const router = useRouter()
  const { locale, formatoHora: fmtHora } = useFormato()
  const hour12 = fmtHora === '12h'
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [offset, setOffset] = useState(0)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [asistencias, setAsistencias] = useState<Record<string, Record<string, CeldaAsistencia>>>({})
  const [cargando, setCargando] = useState(true)

  const { desde, hasta, etiqueta } = useMemo(() => obtenerRango(periodo, offset, locale), [periodo, offset, locale])

  const fechas = useMemo(() => generarFechas(desde, hasta), [desde, hasta])

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <div className="flex items-center gap-3">
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ArrowLeft size={16} />} onClick={() => router.push('/asistencias')} />
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-texto-marca" />
            <h1 className="text-base font-semibold text-texto-primario">Matriz de asistencias</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle vista lista */}
          <Boton variante="fantasma" tamano="xs" onClick={() => router.push('/asistencias')}>
            <List size={14} className="mr-1" /> Lista
          </Boton>
        </div>
      </div>

      {/* Controles de periodo */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-borde-sutil shrink-0">
        <div className="flex items-center gap-1">
          {(['semana', 'quincena', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriodo(p); setOffset(0) }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                periodo === p
                  ? 'bg-superficie-elevada text-texto-primario'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronLeft size={16} />} onClick={() => setOffset(o => o - 1)} />
          <button
            onClick={() => setOffset(0)}
            className="text-sm font-medium text-texto-primario hover:text-texto-marca transition-colors min-w-[140px] text-center"
          >
            {etiqueta}
          </button>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronRight size={16} />} onClick={() => setOffset(o => o + 1)} />
        </div>

        <div className="w-[100px]" /> {/* spacer */}
      </div>

      {/* Matriz */}
      {cargando ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-superficie-app">
              <tr>
                <th className="sticky left-0 z-20 bg-superficie-app text-left px-3 py-2 font-semibold text-texto-secundario border-b border-r border-borde-sutil min-w-[160px]">
                  Empleado
                </th>
                {fechas.map((fecha) => {
                  const d = new Date(fecha + 'T12:00:00')
                  const diaSemana = d.getDay()
                  const esHoy = fecha === hoyStr
                  const esFinde = diaSemana === 0 || diaSemana === 6

                  return (
                    <th
                      key={fecha}
                      className={`px-1 py-2 text-center font-medium border-b border-borde-sutil min-w-[44px] ${
                        esHoy ? 'bg-texto-marca/10' : esFinde ? 'bg-superficie-elevada/50' : ''
                      }`}
                    >
                      <div className="text-xxs text-texto-terciario">{DIAS_SEMANA_CORTO[diaSemana]}</div>
                      <div className={`text-xs ${esHoy ? 'text-texto-marca font-bold' : 'text-texto-secundario'}`}>
                        {d.getDate()}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro) => (
                <tr key={miembro.id} className="hover:bg-superficie-elevada/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-superficie-app px-3 py-2 font-medium text-texto-primario border-b border-r border-borde-sutil whitespace-nowrap">
                    {miembro.nombre}
                  </td>
                  {fechas.map((fecha) => {
                    const asist = asistencias[miembro.id]?.[fecha] as CeldaAsistencia | undefined
                    const estado = estadoCelda(asist)
                    const config = COLORES_ESTADO[estado]
                    const d = new Date(fecha + 'T12:00:00')
                    const esHoy = fecha === hoyStr
                    const esFinde = d.getDay() === 0 || d.getDay() === 6

                    return (
                      <td
                        key={fecha}
                        className={`px-0.5 py-1.5 text-center border-b border-borde-sutil ${
                          esHoy ? 'bg-texto-marca/5' : esFinde ? 'bg-superficie-elevada/30' : ''
                        }`}
                      >
                        {asist && config ? (
                          <div
                            title={`${config.etiqueta}${asist.hora_entrada ? ` | E: ${formatearHora(asist.hora_entrada, locale, hour12)}` : ''}${asist.hora_salida ? ` | S: ${formatearHora(asist.hora_salida, locale, hour12)}` : ''}`}
                            className={`mx-auto size-7 rounded-md flex items-center justify-center cursor-default ${config.bg}`}
                          >
                            <span className={`text-xxs font-bold ${config.texto}`}>
                              {estado === 'cerrado' ? '✓' :
                               estado === 'tardanza' ? 'T' :
                               estado === 'ausente' ? '✕' :
                               estado === 'auto_cerrado' ? '!' :
                               estado === 'activo' ? '●' :
                               estado === 'almuerzo' ? '◐' :
                               estado === 'particular' ? '→' : ''}
                            </span>
                          </div>
                        ) : esFinde ? (
                          <div className="mx-auto size-7 rounded-md bg-superficie-elevada/50 opacity-30" />
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
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

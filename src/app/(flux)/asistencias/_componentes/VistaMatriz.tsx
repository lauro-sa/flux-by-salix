'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Loader2, Calendar, Printer, Download,
  SlidersHorizontal,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

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
  normal:       { fondo: 'bg-insignia-exito/10', borde: 'border-insignia-exito/20' },
  cerrado:      { fondo: 'bg-insignia-exito/10', borde: 'border-insignia-exito/20' },
  activo:       { fondo: 'bg-insignia-exito/15', borde: 'border-insignia-exito/30' },
  tardanza:     { fondo: 'bg-insignia-advertencia/15', borde: 'border-insignia-advertencia/25' },
  almuerzo:     { fondo: 'bg-insignia-advertencia/10', borde: 'border-insignia-advertencia/20' },
  particular:   { fondo: 'bg-insignia-info/10', borde: 'border-insignia-info/20' },
  auto_cerrado: { fondo: 'bg-[color:var(--insignia-peligro)]/10', borde: 'border-[color:var(--insignia-peligro)]/20' },
  ausente:      { fondo: 'bg-[color:var(--insignia-peligro)]/8', borde: 'border-[color:var(--insignia-peligro)]/15' },
}

const COLOR_PUNTO: Record<string, string> = {
  normal: 'bg-insignia-exito',
  cerrado: 'bg-insignia-exito',
  activo: 'bg-insignia-exito',
  tardanza: 'bg-insignia-advertencia',
  auto_cerrado: 'bg-[color:var(--insignia-peligro)]',
  ausente: 'bg-[color:var(--insignia-peligro)]',
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
    const base = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1)
    const desde = new Date(base.getFullYear(), base.getMonth(), 1)
    const hasta = new Date(base.getFullYear(), base.getMonth(), 15)
    const etiqueta = `Quincena 1-15 de ${MESES[base.getMonth()]} ${base.getFullYear()}`
    const subtitulo = `01/${String(base.getMonth()+1).padStart(2,'0')}/${base.getFullYear()} — 15/${String(base.getMonth()+1).padStart(2,'0')}/${base.getFullYear()}`
    return { desde, hasta, etiqueta, subtitulo }
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
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [offset, setOffset] = useState(0)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [asistencias, setAsistencias] = useState<Record<string, Record<string, CeldaAsistencia>>>({})
  const [cargando, setCargando] = useState(true)

  const { desde, hasta, etiqueta, subtitulo } = useMemo(() => obtenerRango(periodo, offset), [periodo, offset])
  const fechas = useMemo(() => generarFechas(desde, hasta), [desde, hasta])
  const diasLaborales = useMemo(() => fechas.filter(f => {
    const d = new Date(f + 'T12:00:00').getDay()
    return d !== 0 && d !== 6
  }), [fechas])

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
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

          {/* Filtros placeholder */}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full text-texto-terciario hover:text-texto-secundario hover:bg-superficie-elevada/50 transition-colors">
            <SlidersHorizontal size={12} />
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

        {/* Acciones derecha */}
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="xs">
            <Printer size={13} className="mr-1.5" /> Nómina
          </Boton>
          <Boton variante="fantasma" tamano="xs">
            <Download size={13} className="mr-1.5" /> Exportar
          </Boton>
        </div>
      </div>

      {/* Tabla matriz */}
      {cargando ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-superficie-app">
              <tr>
                <th className="sticky left-0 z-20 bg-superficie-app text-left px-4 py-3 font-medium text-texto-terciario text-xs uppercase tracking-wider border-b border-borde-sutil min-w-[200px]">
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
                      className={`px-1 py-2 text-center border-b border-borde-sutil min-w-[90px] ${
                        esHoy ? 'bg-texto-marca/8' : ''
                      }`}
                    >
                      <div className={`text-[10px] uppercase tracking-wider ${esFinde ? 'text-texto-terciario/50' : 'text-texto-terciario'}`}>
                        {DIAS_SEMANA_CORTO[diaSemana]}
                      </div>
                      <div className={`text-lg font-semibold ${
                        esHoy ? 'text-texto-marca' : esFinde ? 'text-texto-terciario/40' : 'text-texto-primario'
                      }`}>
                        {d.getDate()}
                      </div>
                    </th>
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
                    {fechas.map((fecha) => {
                      const asist = asistMiembro[fecha] as CeldaAsistencia | undefined
                      const estado = estadoCelda(asist)
                      const d = new Date(fecha + 'T12:00:00')
                      const esHoy = fecha === hoyStr
                      const esFinde = d.getDay() === 0 || d.getDay() === 6

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

                      // Ausente
                      if (estado === 'ausente') {
                        return (
                          <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${esHoy ? 'bg-texto-marca/5' : ''}`}>
                            <div className={`mx-auto rounded-lg h-[60px] flex items-center justify-center ${COLORES_CELDA.ausente.fondo} border ${COLORES_CELDA.ausente.borde}`}>
                              <span className="text-[color:var(--insignia-peligro)] text-[11px] font-semibold uppercase">Ausente</span>
                            </div>
                          </td>
                        )
                      }

                      // Sin registro (día laboral)
                      if (!asist || estado === 'vacio') {
                        return (
                          <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${esHoy ? 'bg-texto-marca/5' : ''}`}>
                            <div className="h-[60px]" />
                          </td>
                        )
                      }

                      // Con registro
                      const colores = COLORES_CELDA[estado] || COLORES_CELDA.cerrado
                      const colorPunto = COLOR_PUNTO[estado] || 'bg-insignia-exito'
                      const horaE = formatearHora(asist.hora_entrada)
                      const horaS = formatearHora(asist.hora_salida)
                      const etiquetaEstado = estado === 'cerrado' ? 'ok' :
                        estado === 'tardanza' ? 'tarde' :
                        estado === 'activo' ? 'en turno' :
                        estado === 'auto_cerrado' ? 'auto' : estado

                      return (
                        <td key={fecha} className={`px-1 py-1.5 border-b border-borde-sutil ${esHoy ? 'bg-texto-marca/5' : ''}`}>
                          <div className={`mx-auto rounded-lg h-[60px] flex flex-col items-center justify-center gap-0.5 border ${colores.fondo} ${colores.borde} cursor-default`}>
                            {/* Punto de estado */}
                            <div className={`size-1.5 rounded-full ${colorPunto}`} />
                            {/* Entrada */}
                            <span className="text-xs font-semibold text-texto-primario leading-none">
                              {horaE}
                            </span>
                            {/* Salida */}
                            <span className="text-[10px] text-texto-terciario leading-none">
                              {horaS || '...'}
                            </span>
                            {/* Estado */}
                            <span className="text-[9px] text-texto-terciario/70 leading-none">
                              {etiquetaEstado}
                            </span>
                          </div>
                        </td>
                      )
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

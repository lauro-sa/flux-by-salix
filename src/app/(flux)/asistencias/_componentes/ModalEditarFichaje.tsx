'use client'

import { useState, useEffect } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { Boton } from '@/componentes/ui/Boton'
import {
  CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints,
  Calendar, MapPin, Pencil, Trash2, ChevronDown, Monitor, Smartphone,
  Fingerprint, KeyRound, Wifi, Zap, Settings2, Activity,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { SelectorHora } from '@/componentes/ui/SelectorHora'

// ─── Tipos ───────────────────────────────────────────────────

interface RegistroEditable {
  id: string
  miembro_nombre: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  salida_particular: string | null
  vuelta_particular: string | null
  estado: string
  tipo: string
  notas: string | null
  metodo_registro?: string
  metodo_salida?: string | null
  terminal_nombre?: string | null
  puntualidad_min?: number | null
  cierre_automatico?: boolean
  ubicacion_entrada?: Record<string, unknown> | null
  ubicacion_salida?: Record<string, unknown> | null
  editado_por?: string | null
  foto_entrada?: string | null
  foto_salida?: string | null
  tiempo_activo_min?: number | null
  total_heartbeats?: number | null
  creado_en?: string | null
  actualizado_en?: string | null
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  registro: RegistroEditable | null
  onGuardado: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtHora(iso: string | null, formato: string = '24h'): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (formato === '12h') {
    const h = d.getHours() % 12 || 12
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
    return `${h}:${d.getMinutes().toString().padStart(2, '0')} ${ampm}`
  }
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function fmtFechaLarga(fechaStr: string, locale: string): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return fecha.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function calcMin(ent: string | null, sal: string | null, almI: string | null, almF: string | null): number {
  if (!ent || !sal) return 0
  let diff = (new Date(sal).getTime() - new Date(ent).getTime()) / 60000
  if (almI && almF) diff -= (new Date(almF).getTime() - new Date(almI).getTime()) / 60000
  return Math.max(0, Math.round(diff))
}

function fmtDuracion(min: number): string {
  if (min <= 0) return '0min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function aDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}T${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function deDatetimeLocal(valor: string): string | null {
  if (!valor) return null
  return new Date(valor).toISOString()
}

function extraerHora(dtLocal: string): string | null {
  if (!dtLocal) return null
  const [, hora] = dtLocal.split('T')
  return hora || null
}

function reconstruir(fecha: string, hora: string | null): string {
  if (!hora) return ''
  return `${fecha}T${hora}`
}

function inicial(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Config estados ──────────────────────────────────────────

const ESTADO_CFG: Record<string, { etiqueta: string; color: string; fondo: string; icono: React.ReactNode }> = {
  activo:       { etiqueta: 'En turno', color: 'text-emerald-400', fondo: 'bg-emerald-500/15', icono: <Clock size={13} /> },
  cerrado:      { etiqueta: 'Cerrado', color: 'text-emerald-400/70', fondo: 'bg-emerald-500/10', icono: <CheckCircle2 size={13} /> },
  auto_cerrado: { etiqueta: 'Sin salida', color: 'text-amber-400', fondo: 'bg-amber-500/15', icono: <AlertTriangle size={13} /> },
  ausente:      { etiqueta: 'Ausente', color: 'text-red-400', fondo: 'bg-red-500/15', icono: <XCircle size={13} /> },
  almuerzo:     { etiqueta: 'Almorzando', color: 'text-amber-400', fondo: 'bg-amber-500/15', icono: <Coffee size={13} /> },
  particular:   { etiqueta: 'Trámite', color: 'text-sky-400', fondo: 'bg-sky-500/15', icono: <Footprints size={13} /> },
}

const METODO_CFG: Record<string, { etiqueta: string; icono: React.ReactNode }> = {
  manual:     { etiqueta: 'Manual', icono: <Pencil size={12} /> },
  rfid:       { etiqueta: 'RFID', icono: <Wifi size={12} /> },
  nfc:        { etiqueta: 'NFC', icono: <Smartphone size={12} /> },
  pin:        { etiqueta: 'PIN', icono: <KeyRound size={12} /> },
  automatico: { etiqueta: 'PC', icono: <Monitor size={12} /> },
  solicitud:  { etiqueta: 'Solicitud', icono: <Fingerprint size={12} /> },
  sistema:    { etiqueta: 'Sistema', icono: <Settings2 size={12} /> },
}

// Determinar si el método es presencial (kiosco) o remoto (PC/web)
function esPresencial(metodo?: string | null): boolean {
  return metodo === 'rfid' || metodo === 'nfc' || metodo === 'pin'
}

function etiquetaOrigen(metodo?: string | null): string {
  if (!metodo) return ''
  if (esPresencial(metodo)) return 'Kiosco'
  if (metodo === 'automatico') return 'PC'
  if (metodo === 'manual') return 'Web'
  return ''
}

const COLORES_AVATAR = [
  'bg-indigo-500/25 text-indigo-400',
  'bg-emerald-500/25 text-emerald-400',
  'bg-amber-500/25 text-amber-400',
  'bg-red-500/25 text-red-400',
  'bg-purple-500/25 text-purple-400',
  'bg-cyan-500/25 text-cyan-400',
]

const JORNADA_REF = 8 * 60

// ─── Componente ──────────────────────────────────────────────

export function ModalEditarFichaje({ abierto, onCerrar, registro, onGuardado }: PropiedadesModal) {
  const { formatoHora, locale } = useFormato()
  const [editando, setEditando] = useState(false)
  const [entrada, setEntrada] = useState('')
  const [salida, setSalida] = useState('')
  const [inicioAlm, setInicioAlm] = useState('')
  const [finAlm, setFinAlm] = useState('')
  const [salidaPart, setSalidaPart] = useState('')
  const [vueltaPart, setVueltaPart] = useState('')
  const [estado, setEstado] = useState('cerrado')
  const [tipo, setTipo] = useState('normal')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (registro) {
      setEntrada(aDatetimeLocal(registro.hora_entrada))
      setSalida(aDatetimeLocal(registro.hora_salida))
      setInicioAlm(aDatetimeLocal(registro.inicio_almuerzo))
      setFinAlm(aDatetimeLocal(registro.fin_almuerzo))
      setSalidaPart(aDatetimeLocal(registro.salida_particular))
      setVueltaPart(aDatetimeLocal(registro.vuelta_particular))
      setEstado(registro.estado)
      setTipo(registro.tipo)
      setNotas(registro.notas || '')
      setEditando(false)
    }
  }, [registro])

  if (!registro) return null

  const r = registro
  const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.cerrado
  const min = calcMin(r.hora_entrada, r.hora_salida, r.inicio_almuerzo, r.fin_almuerzo)
  const dur = fmtDuracion(min)
  const pct = Math.min(100, Math.round((min / JORNADA_REF) * 100))
  const hash = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hash % COLORES_AVATAR.length]
  const colorBarra = r.estado === 'ausente' ? 'bg-red-500/25' : r.estado === 'auto_cerrado' ? 'bg-amber-500/25' : 'bg-emerald-500/25'
  const colorDurTxt = r.estado === 'auto_cerrado' || r.tipo === 'tardanza' ? 'text-amber-400' : 'text-emerald-400'

  // Puntualidad
  const punt = r.puntualidad_min
  const tienePuntualidad = punt !== null && punt !== undefined && r.estado !== 'ausente'

  // Métodos
  const metEntrada = METODO_CFG[r.metodo_registro || 'manual'] || METODO_CFG.manual
  const metSalida = r.metodo_salida ? (METODO_CFG[r.metodo_salida] || null) : null
  const origenEntrada = etiquetaOrigen(r.metodo_registro)
  const origenSalida = etiquetaOrigen(r.metodo_salida)

  // Tiempo activo
  const tiempoActivo = r.tiempo_activo_min
  const tieneTiempoActivo = tiempoActivo !== null && tiempoActivo !== undefined && tiempoActivo > 0
  const pctActivo = tieneTiempoActivo && min > 0 ? Math.min(100, Math.round((tiempoActivo / min) * 100)) : 0

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/asistencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: r.id,
          hora_entrada: deDatetimeLocal(entrada),
          hora_salida: deDatetimeLocal(salida),
          inicio_almuerzo: deDatetimeLocal(inicioAlm),
          fin_almuerzo: deDatetimeLocal(finAlm),
          salida_particular: deDatetimeLocal(salidaPart),
          vuelta_particular: deDatetimeLocal(vueltaPart),
          estado, tipo,
          notas: notas || null,
        }),
      })
      if (res.ok) { onGuardado(); onCerrar() }
    } finally { setGuardando(false) }
  }

  const eliminar = async () => {
    if (!confirm('¿Eliminar este registro de asistencia?')) return
    setGuardando(true)
    try {
      const res = await fetch('/api/asistencias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      })
      if (res.ok) { onGuardado(); onCerrar() }
    } finally { setGuardando(false) }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo=""
      tamano="md"
      acciones={
        editando ? (
          <div className="flex items-center justify-between w-full">
            <Boton variante="peligro" tamano="sm" onClick={eliminar} disabled={guardando}>
              <Trash2 size={13} className="mr-1" /> Eliminar
            </Boton>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tamano="sm" onClick={() => setEditando(false)}>Cancelar</Boton>
              <Boton variante="primario" tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Boton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end w-full">
            <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
              <Pencil size={13} className="mr-1" /> Editar
            </Boton>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {/* ═══ HEADER: Avatar + Nombre + Badge ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`size-11 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${colorAvatar}`}>
              {inicial(r.miembro_nombre)}
            </div>
            <div>
              <h3 className="text-base font-semibold text-texto-primario">{r.miembro_nombre}</h3>
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <Calendar size={11} />
                {fmtFechaLarga(r.fecha, locale)}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-current/15 ${cfg.fondo} ${cfg.color}`}>
            {cfg.icono}
            {cfg.etiqueta}
          </span>
        </div>

        {/* ═══ VISTA DETALLE (no editando) ═══ */}
        {!editando ? (
          <>
            {/* Horarios */}
            {r.estado !== 'ausente' && r.hora_entrada ? (
              <div className="space-y-3">
                {/* Entrada → Salida · Duración */}
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-mono font-semibold text-texto-primario tracking-tight">
                    {fmtHora(r.hora_entrada, formatoHora)}
                  </span>
                  <span className="text-texto-terciario text-lg">→</span>
                  <span className="text-2xl font-mono font-semibold text-texto-primario tracking-tight">
                    {r.hora_salida ? fmtHora(r.hora_salida, formatoHora) : '…'}
                  </span>
                  <span className={`text-sm font-medium ${colorDurTxt}`}>· {dur}</span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colorBarra} transition-all duration-500 flex items-center justify-center`}
                    style={{ width: `${Math.max(pct, 15)}%` }}
                  >
                    <span className="text-xxs font-semibold whitespace-nowrap flex items-center gap-0.5 text-texto-secundario">
                      <Calendar size={8} /> {dur}
                    </span>
                  </div>
                </div>

                <p className={`text-sm font-medium ${colorDurTxt}`}>{dur} netos</p>
              </div>
            ) : (
              <div className="py-4 text-center">
                <XCircle size={28} className="mx-auto text-red-400/40 mb-2" />
                <p className="text-sm text-red-400/60">Sin registro de asistencia</p>
              </div>
            )}

            {/* ═══ ENTRADA / SALIDA — métodos ═══ */}
            {r.estado !== 'ausente' && r.hora_entrada && (
              <div className="grid grid-cols-2 gap-3">
                {/* Entrada */}
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1.5">Entrada</p>
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                      {metEntrada.icono}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-texto-primario">{metEntrada.etiqueta}</p>
                      {origenEntrada && (
                        <p className="text-xxs text-texto-terciario">{origenEntrada}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Salida */}
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1.5">Salida</p>
                  {metSalida ? (
                    <div className="flex items-center gap-2">
                      <div className={`size-7 rounded-md flex items-center justify-center ${
                        r.estado === 'auto_cerrado' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {metSalida.icono}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-texto-primario">{metSalida.etiqueta}</p>
                        {origenSalida && (
                          <p className="text-xxs text-texto-terciario">{origenSalida}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-texto-terciario">—</p>
                  )}
                </div>
              </div>
            )}

            {/* ═══ INFO ADICIONAL ═══ */}
            <div className="grid grid-cols-2 gap-3">
              {/* Puntualidad */}
              {tienePuntualidad && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Puntualidad</p>
                  <p className={`text-sm font-medium ${
                    punt! > 10 ? 'text-amber-400' : punt! < 0 ? 'text-emerald-400' : 'text-texto-primario'
                  }`}>
                    {punt! > 0 ? `+${punt} min tarde` : punt! < 0 ? `${Math.abs(punt!)} min antes` : 'Puntual'}
                  </p>
                </div>
              )}

              {/* Tipo */}
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Tipo</p>
                <p className="text-sm text-texto-primario capitalize">{r.tipo}</p>
              </div>

              {/* Almuerzo */}
              {(r.inicio_almuerzo || r.fin_almuerzo) && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Almuerzo</p>
                  <p className="text-sm text-texto-primario font-mono">
                    {fmtHora(r.inicio_almuerzo, formatoHora)} → {fmtHora(r.fin_almuerzo, formatoHora)}
                  </p>
                </div>
              )}

              {/* Trámite */}
              {(r.salida_particular || r.vuelta_particular) && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Trámite</p>
                  <p className="text-sm text-texto-primario font-mono">
                    {fmtHora(r.salida_particular, formatoHora)} → {fmtHora(r.vuelta_particular, formatoHora)}
                  </p>
                </div>
              )}

              {/* Terminal */}
              {r.terminal_nombre && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Terminal</p>
                  <p className="text-sm text-texto-primario">{r.terminal_nombre}</p>
                </div>
              )}

              {/* Ubicación entrada */}
              {r.ubicacion_entrada && (r.ubicacion_entrada as Record<string, string>)?.direccion && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5 col-span-2">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Ubicación</p>
                  <p className="text-sm text-texto-primario flex items-center gap-1.5">
                    <MapPin size={12} className="text-texto-terciario shrink-0" />
                    {(r.ubicacion_entrada as Record<string, string>).direccion}
                    {(r.ubicacion_entrada as Record<string, string>).barrio && `, ${(r.ubicacion_entrada as Record<string, string>).barrio}`}
                  </p>
                </div>
              )}
            </div>

            {/* ═══ TIEMPO ACTIVO EN PC ═══ */}
            {tieneTiempoActivo && (
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xxs uppercase tracking-wider text-texto-terciario flex items-center gap-1.5">
                    <Activity size={10} />
                    Uso del software
                  </p>
                  <span className="text-xxs text-texto-terciario">
                    {r.total_heartbeats || 0} señales
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-superficie-elevada/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
                      style={{ width: `${Math.max(pctActivo, 5)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-sky-400 whitespace-nowrap">
                    {fmtDuracion(tiempoActivo)}
                  </span>
                </div>
                {min > 0 && (
                  <p className="text-xxs text-texto-terciario mt-1">
                    {pctActivo}% de la jornada ({dur}) con actividad en Flux
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            {r.notas && (
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <p className="text-xxs uppercase tracking-wider text-texto-terciario mb-1">Notas</p>
                <p className="text-sm text-texto-secundario">{r.notas}</p>
              </div>
            )}

            {/* Fotos de fichaje */}
            {(r.foto_entrada || r.foto_salida) && (
              <div className="grid grid-cols-2 gap-3">
                {r.foto_entrada && (
                  <div className="bg-superficie-elevada/30 rounded-lg overflow-hidden">
                    <p className="text-xxs uppercase tracking-wider text-texto-terciario px-3 pt-2 pb-1">Foto entrada</p>
                    <img src={r.foto_entrada} alt="Foto entrada" className="w-full h-32 object-cover" />
                  </div>
                )}
                {r.foto_salida && (
                  <div className="bg-superficie-elevada/30 rounded-lg overflow-hidden">
                    <p className="text-xxs uppercase tracking-wider text-texto-terciario px-3 pt-2 pb-1">Foto salida</p>
                    <img src={r.foto_salida} alt="Foto salida" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* Editado / Cierre automático */}
            {(r.editado_por || r.cierre_automatico) && (
              <div className="flex items-center gap-3 flex-wrap">
                {r.editado_por && (
                  <div className="flex items-center gap-1.5">
                    <Pencil size={9} className="text-texto-terciario" />
                    <span className="text-xxs text-texto-terciario">Editado manualmente</span>
                  </div>
                )}
                {r.cierre_automatico && (
                  <div className="flex items-center gap-1.5">
                    <Zap size={9} className="text-texto-terciario" />
                    <span className="text-xxs text-texto-terciario">Cierre automático</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ═══ MODO EDICIÓN ═══ */
          <div className="space-y-4">
            {/* Estado y tipo */}
            <div className="grid grid-cols-2 gap-3">
              <Select
                etiqueta="Estado"
                opciones={[
                  { valor: 'activo', etiqueta: 'En turno' },
                  { valor: 'cerrado', etiqueta: 'Cerrado' },
                  { valor: 'auto_cerrado', etiqueta: 'Sin salida' },
                  { valor: 'ausente', etiqueta: 'Ausente' },
                  { valor: 'almuerzo', etiqueta: 'En almuerzo' },
                  { valor: 'particular', etiqueta: 'En trámite' },
                ]}
                valor={estado}
                onChange={setEstado}
              />
              <Select
                etiqueta="Tipo"
                opciones={[
                  { valor: 'normal', etiqueta: 'Normal' },
                  { valor: 'tardanza', etiqueta: 'Tardanza' },
                  { valor: 'ausencia', etiqueta: 'Ausencia' },
                  { valor: 'flexible', etiqueta: 'Flexible' },
                ]}
                valor={tipo}
                onChange={setTipo}
              />
            </div>

            {/* Horarios — solo horas, la fecha es fija */}
            <div className="grid grid-cols-2 gap-3">
              <CampoHoraLimpiable etiqueta="Entrada" valor={extraerHora(entrada)} onChange={(v) => setEntrada(reconstruir(r.fecha, v))} onLimpiar={() => setEntrada('')} />
              <CampoHoraLimpiable etiqueta="Salida" valor={extraerHora(salida)} onChange={(v) => setSalida(reconstruir(r.fecha, v))} onLimpiar={() => setSalida('')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoHoraLimpiable etiqueta="Inicio almuerzo" valor={extraerHora(inicioAlm)} onChange={(v) => setInicioAlm(reconstruir(r.fecha, v))} onLimpiar={() => setInicioAlm('')} />
              <CampoHoraLimpiable etiqueta="Fin almuerzo" valor={extraerHora(finAlm)} onChange={(v) => setFinAlm(reconstruir(r.fecha, v))} onLimpiar={() => setFinAlm('')} />
            </div>

            <details className="group">
              <summary className="text-xs text-texto-terciario cursor-pointer flex items-center gap-1 hover:text-texto-secundario transition-colors">
                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                Trámite / particular
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <CampoHoraLimpiable etiqueta="Salida trámite" valor={extraerHora(salidaPart)} onChange={(v) => setSalidaPart(reconstruir(r.fecha, v))} onLimpiar={() => setSalidaPart('')} />
                <CampoHoraLimpiable etiqueta="Vuelta trámite" valor={extraerHora(vueltaPart)} onChange={(v) => setVueltaPart(reconstruir(r.fecha, v))} onLimpiar={() => setVueltaPart('')} />
              </div>
            </details>

            <TextArea
              etiqueta="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Motivo de la edición..."
              rows={2}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Campo hora con botón limpiar ────────────────────────────

function CampoHoraLimpiable({ etiqueta, valor, onChange, onLimpiar }: {
  etiqueta: string
  valor: string | null
  onChange: (v: string | null) => void
  onLimpiar: () => void
}) {
  return (
    <div className="relative">
      <SelectorHora etiqueta={etiqueta} valor={valor} onChange={onChange} pasoMinutos={5} />
      {valor && (
        <button
          type="button"
          onClick={onLimpiar}
          className="absolute top-0 right-0 text-xxs text-texto-terciario hover:text-red-400 transition-colors"
          title="Limpiar"
        >
          ✕
        </button>
      )}
    </div>
  )
}

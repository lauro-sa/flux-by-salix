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
import { formatearPuntualidad } from '@/lib/constantes/asistencias'
import Image from 'next/image'
import { useTraduccion } from '@/lib/i18n'

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
  activo:       { etiqueta: 'En turno', color: 'text-asistencia-presente', fondo: 'bg-asistencia-presente-fondo', icono: <Clock size={13} /> },
  cerrado:      { etiqueta: 'Cerrado', color: 'text-asistencia-presente/70', fondo: 'bg-asistencia-presente-fondo', icono: <CheckCircle2 size={13} /> },
  auto_cerrado: { etiqueta: 'Sin salida', color: 'text-asistencia-tarde', fondo: 'bg-asistencia-tarde-fondo', icono: <AlertTriangle size={13} /> },
  ausente:      { etiqueta: 'Ausente', color: 'text-asistencia-ausente', fondo: 'bg-asistencia-ausente-fondo', icono: <XCircle size={13} /> },
  almuerzo:     { etiqueta: 'Almorzando', color: 'text-asistencia-almuerzo', fondo: 'bg-asistencia-almuerzo-fondo', icono: <Coffee size={13} /> },
  particular:   { etiqueta: 'Trámite', color: 'text-asistencia-particular', fondo: 'bg-asistencia-particular-fondo', icono: <Footprints size={13} /> },
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
  'bg-insignia-primario/25 text-insignia-primario',
  'bg-insignia-exito/25 text-insignia-exito',
  'bg-insignia-advertencia/25 text-insignia-advertencia',
  'bg-insignia-peligro/25 text-insignia-peligro',
  'bg-insignia-violeta/25 text-insignia-violeta',
  'bg-insignia-cyan/25 text-insignia-cyan',
]

const JORNADA_REF = 8 * 60

// ─── Componente ──────────────────────────────────────────────

export function ModalEditarFichaje({ abierto, onCerrar, registro, onGuardado }: PropiedadesModal) {
  const { t } = useTraduccion()
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
  const enCurso = ['activo', 'almuerzo', 'particular'].includes(r.estado)
  const salidaCalc = r.hora_salida || (enCurso && r.hora_entrada ? new Date().toISOString() : null)
  const min = calcMin(r.hora_entrada, salidaCalc, r.inicio_almuerzo, r.fin_almuerzo)
  const dur = fmtDuracion(min)
  const pct = Math.min(100, Math.round((min / JORNADA_REF) * 100))
  const hash = r.miembro_nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const colorAvatar = COLORES_AVATAR[hash % COLORES_AVATAR.length]
  const colorBarra = r.estado === 'ausente' ? 'bg-asistencia-ausente/25' : r.estado === 'auto_cerrado' ? 'bg-asistencia-tarde/25' : 'bg-asistencia-presente/25'
  const colorDurTxt = r.estado === 'auto_cerrado' || r.tipo === 'tardanza' ? 'text-asistencia-tarde' : 'text-asistencia-presente'

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
      accionPrimaria={editando ? {
        etiqueta: t('comun.guardar'),
        onClick: guardar,
        cargando: guardando,
      } : {
        etiqueta: 'Editar',
        onClick: () => setEditando(true),
        icono: <Pencil size={13} />,
      }}
      accionSecundaria={editando ? {
        etiqueta: t('comun.cancelar'),
        onClick: () => setEditando(false),
      } : undefined}
      accionPeligro={editando ? {
        etiqueta: 'Eliminar',
        onClick: eliminar,
        icono: <Trash2 size={13} />,
      } : undefined}
    >
      <div className="-mx-5 -mt-4">
        {/* ═══ HEADER: Avatar + Nombre + Badge ═══ */}
        <div className="flex items-center justify-between px-5 pt-[18px] pb-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className={`size-[38px] rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 ${colorAvatar}`}>
              {inicial(r.miembro_nombre)}
            </div>
            <div>
              <h3 className="text-sm font-medium text-texto-primario">{r.miembro_nombre}</h3>
              <p className="flex items-center gap-1 text-[11px] text-texto-terciario/50 mt-0.5">
                <Calendar size={11} />
                {fmtFechaLarga(r.fecha, locale)}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-[5px] rounded-full text-[11px] font-medium border shrink-0 ${cfg.fondo} ${cfg.color}`}>
            {cfg.icono}
            {cfg.etiqueta}
          </span>
        </div>

        {/* ═══ VISTA DETALLE (no editando) ═══ */}
        {!editando ? (
          <>
            {/* ── Bloque de tiempo ── */}
            {r.estado !== 'ausente' && r.hora_entrada ? (
              <div className="px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-baseline gap-2.5 mb-2">
                  <span className="text-[32px] font-semibold text-texto-primario tracking-tight leading-none">
                    {fmtHora(r.hora_entrada, formatoHora)}
                  </span>
                  <span className="text-xl text-texto-terciario/30">→</span>
                  <span className="text-xl font-medium text-texto-terciario/50 tracking-tight">
                    {enCurso ? '…' : fmtHora(r.hora_salida, formatoHora)}
                  </span>
                  <span className="text-xs text-texto-terciario/50 ml-1">· {dur}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-boton bg-asistencia-presente/12 border border-asistencia-presente/25">
                    <Calendar size={11} className="text-asistencia-presente" />
                    <span className="text-[11px] font-medium text-asistencia-presente">{dur}</span>
                  </div>
                  <span className={`text-xs font-medium ${colorDurTxt}`}>{dur} netos</span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 border-b border-white/[0.07] text-center">
                <XCircle size={28} className="mx-auto text-asistencia-ausente/40 mb-2" />
                <p className="text-sm text-asistencia-ausente/60">Sin registro de asistencia</p>
              </div>
            )}

            {/* ── Grid: Entrada | Salida | Puntualidad | Tipo ── */}
            {r.estado !== 'ausente' && r.hora_entrada && (
              <div className="grid grid-cols-2">
                {/* Entrada */}
                <div className="px-5 py-3 border-b border-r border-white/[0.07]">
                  <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Entrada</p>
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-boton bg-asistencia-presente/15 flex items-center justify-center text-asistencia-presente">
                      {metEntrada.icono}
                    </div>
                    <div>
                      <p className="text-[13px] text-texto-primario/75">{metEntrada.etiqueta}</p>
                      {origenEntrada && <p className="text-[10px] text-texto-terciario/40">{origenEntrada}</p>}
                    </div>
                  </div>
                </div>

                {/* Salida */}
                <div className="px-5 py-3 border-b border-white/[0.07]">
                  <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Salida</p>
                  {metSalida ? (
                    <div className="flex items-center gap-2">
                      <div className={`size-7 rounded-boton flex items-center justify-center ${
                        r.estado === 'auto_cerrado' ? 'bg-asistencia-tarde/15 text-asistencia-tarde' : 'bg-asistencia-presente/15 text-asistencia-presente'
                      }`}>
                        {metSalida.icono}
                      </div>
                      <div>
                        <p className="text-[13px] text-texto-primario/75">{metSalida.etiqueta}</p>
                        {origenSalida && <p className="text-[10px] text-texto-terciario/40">{origenSalida}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-texto-terciario/40">— Sin registrar</p>
                  )}
                </div>

                {/* Puntualidad */}
                <div className="px-5 py-3 border-b border-r border-white/[0.07]">
                  <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Puntualidad</p>
                  {tienePuntualidad ? (() => {
                    const p = formatearPuntualidad(punt!)
                    return p ? <p className={`text-[13px] font-medium ${p.color}`}>{p.texto}</p> : null
                  })() : (
                    <p className="text-[13px] text-texto-terciario/40">—</p>
                  )}
                </div>

                {/* Tipo */}
                <div className="px-5 py-3 border-b border-white/[0.07]">
                  <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Tipo</p>
                  <p className="text-[13px] text-texto-primario/75 capitalize">{r.tipo}</p>
                </div>

                {/* Almuerzo */}
                {r.inicio_almuerzo && (
                  <div className="px-5 py-3 border-b border-r border-white/[0.07]">
                    <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Almuerzo</p>
                    <p className="text-[13px] text-texto-primario/75">
                      {fmtHora(r.inicio_almuerzo, formatoHora)} → {fmtHora(r.fin_almuerzo, formatoHora)}
                    </p>
                  </div>
                )}

                {/* Trámite */}
                {r.salida_particular && (
                  <div className="px-5 py-3 border-b border-white/[0.07]">
                    <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Trámite</p>
                    <p className="text-[13px] text-texto-primario/75">
                      {fmtHora(r.salida_particular, formatoHora)} → {fmtHora(r.vuelta_particular, formatoHora)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Ubicación ── */}
            {r.ubicacion_entrada && (
              <div className="px-5 py-3 border-b border-white/[0.07]">
                <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Ubicación</p>
                <p className="flex items-center gap-1.5 text-[13px] text-texto-primario/75">
                  <MapPin size={13} className="text-texto-terciario/40 shrink-0" />
                  {(() => {
                    const ub = r.ubicacion_entrada as Record<string, string>
                    const partes = [ub?.direccion, ub?.barrio, ub?.ciudad].filter(Boolean)
                    return partes.length ? partes.join(', ') : ub?.lat ? `${ub.lat}, ${ub.lng}` : 'Ubicación registrada'
                  })()}
                </p>
              </div>
            )}

            {/* ── Uso del software ── */}
            {tieneTiempoActivo && (
              <div className="px-5 py-3 border-b border-white/[0.07]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} className="text-texto-terciario/40" />
                    <span className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider">Uso del software</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-texto-terciario/40">{r.total_heartbeats || 0} señales</span>
                    <span className="text-[13px] font-medium text-insignia-info">{fmtDuracion(tiempoActivo!)}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded bg-gradient-to-r from-insignia-info to-texto-marca transition-all duration-500"
                    style={{ width: `${Math.max(pctActivo, 5)}%` }}
                  />
                </div>
                {min > 0 && (
                  <p className="text-[11px] text-texto-terciario/40 mt-1.5">
                    {pctActivo}% de la jornada ({dur}) con actividad en Flux
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            {r.notas && (
              <div className="px-5 py-3 border-b border-white/[0.07]">
                <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Notas</p>
                <p className="text-[13px] text-texto-secundario">{r.notas}</p>
              </div>
            )}

            {/* Fotos de fichaje */}
            {(r.foto_entrada || r.foto_salida) && (
              <div className="grid grid-cols-2 border-b border-white/[0.07]">
                {r.foto_entrada && (
                  <div className="px-5 py-3 border-r border-white/[0.07]">
                    <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Foto entrada</p>
                    <div className="relative w-full h-32">
                      <Image src={r.foto_entrada} alt="Foto entrada" fill sizes="(max-width: 768px) 50vw, 300px" className="object-cover rounded-card" />
                    </div>
                  </div>
                )}
                {r.foto_salida && (
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider mb-1.5">Foto salida</p>
                    <div className="relative w-full h-32">
                      <Image src={r.foto_salida} alt="Foto salida" fill sizes="(max-width: 768px) 50vw, 300px" className="object-cover rounded-card" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Editado / Cierre automático */}
            {(r.editado_por || r.cierre_automatico) && (
              <div className="flex items-center gap-3 flex-wrap px-5 py-2.5">
                {r.editado_por && (
                  <div className="flex items-center gap-1.5">
                    <Pencil size={9} className="text-texto-terciario/40" />
                    <span className="text-[10px] text-texto-terciario/40">Editado manualmente</span>
                  </div>
                )}
                {r.cierre_automatico && (
                  <div className="flex items-center gap-1.5">
                    <Zap size={9} className="text-texto-terciario/40" />
                    <span className="text-[10px] text-texto-terciario/40">Cierre automático</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ═══ MODO EDICIÓN ═══ */
          <div className="flex flex-col gap-3.5 px-5 py-4">
            {/* Estado y tipo */}
            <div className="grid grid-cols-2 gap-2.5">
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

            <hr className="border-white/[0.07]" />

            {/* Horarios — solo horas, la fecha es fija */}
            <div className="grid grid-cols-2 gap-2.5">
              <CampoHoraLimpiable etiqueta="Entrada" valor={extraerHora(entrada)} onChange={(v) => setEntrada(reconstruir(r.fecha, v))} onLimpiar={() => setEntrada('')} />
              <CampoHoraLimpiable etiqueta="Salida" valor={extraerHora(salida)} onChange={(v) => setSalida(reconstruir(r.fecha, v))} onLimpiar={() => setSalida('')} />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <CampoHoraLimpiable etiqueta="Inicio almuerzo" valor={extraerHora(inicioAlm)} onChange={(v) => setInicioAlm(reconstruir(r.fecha, v))} onLimpiar={() => setInicioAlm('')} />
              <CampoHoraLimpiable etiqueta="Fin almuerzo" valor={extraerHora(finAlm)} onChange={(v) => setFinAlm(reconstruir(r.fecha, v))} onLimpiar={() => setFinAlm('')} />
            </div>

            {/* Trámite colapsable */}
            <details className="group border border-white/[0.08] rounded-card overflow-hidden">
              <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5 text-xs font-medium text-texto-terciario/60">
                  <Footprints size={12} />
                  Trámite / particular
                </span>
                <ChevronDown size={12} className="text-texto-terciario/30 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="grid grid-cols-2 gap-2.5 p-3 border-t border-white/[0.07]">
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
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-texto-terciario/40 uppercase tracking-wider">{etiqueta}</label>
      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.1] rounded-card px-2.5 py-2 focus-within:border-texto-marca/50 transition-colors">
        <Clock size={13} className="text-texto-terciario/30 shrink-0" />
        <input
          type="time"
          value={valor || ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="HH:MM"
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-texto-primario/75 [color-scheme:dark]"
        />
        {valor && (
          <button
            type="button"
            onClick={onLimpiar}
            className="shrink-0 text-texto-terciario/30 hover:text-asistencia-ausente/70 transition-colors"
            title="Limpiar"
          >
            <XCircle size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

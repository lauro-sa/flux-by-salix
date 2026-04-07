'use client'

import { useState, useEffect } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { Boton } from '@/componentes/ui/Boton'
import {
  CheckCircle2, AlertTriangle, Clock, XCircle, Coffee, Footprints,
  Calendar, MapPin, Pencil, Trash2, ChevronDown,
} from 'lucide-react'

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
  ubicacion_entrada?: Record<string, unknown> | null
  editado_por?: string | null
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  registro: RegistroEditable | null
  onGuardado: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtHora24(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function calcMin(entrada: string | null, salida: string | null, inicioAlm: string | null, finAlm: string | null): number {
  if (!entrada) return 0
  const fin = salida ? new Date(salida).getTime() : Date.now()
  let min = Math.round((fin - new Date(entrada).getTime()) / 60000)
  if (inicioAlm && finAlm) min -= Math.round((new Date(finAlm).getTime() - new Date(inicioAlm).getTime()) / 60000)
  return Math.max(0, min)
}

function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function aDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deDatetimeLocal(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
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

const METODO_ETIQUETA: Record<string, string> = {
  manual: 'Manual', rfid: 'RFID', nfc: 'NFC', pin: 'PIN',
  automatico: 'Automático', solicitud: 'Solicitud', sistema: 'Sistema',
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
                {fmtFechaLarga(r.fecha)}
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
                    {fmtHora24(r.hora_entrada)}
                  </span>
                  <span className="text-texto-terciario text-lg">→</span>
                  <span className="text-2xl font-mono font-semibold text-texto-primario tracking-tight">
                    {r.hora_salida ? fmtHora24(r.hora_salida) : '…'}
                  </span>
                  <span className={`text-sm font-medium ${colorDurTxt}`}>· {dur}</span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-5 rounded-full bg-superficie-elevada/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colorBarra} transition-all duration-500 flex items-center justify-center`}
                    style={{ width: `${Math.max(pct, 15)}%` }}
                  >
                    <span className="text-[9px] font-semibold whitespace-nowrap flex items-center gap-0.5 text-texto-secundario">
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

            {/* Info adicional */}
            <div className="grid grid-cols-2 gap-3">
              {/* Almuerzo */}
              {(r.inicio_almuerzo || r.fin_almuerzo) && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Almuerzo</p>
                  <p className="text-sm text-texto-primario font-mono">
                    {fmtHora24(r.inicio_almuerzo)} → {fmtHora24(r.fin_almuerzo)}
                  </p>
                </div>
              )}

              {/* Trámite */}
              {(r.salida_particular || r.vuelta_particular) && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Trámite</p>
                  <p className="text-sm text-texto-primario font-mono">
                    {fmtHora24(r.salida_particular)} → {fmtHora24(r.vuelta_particular)}
                  </p>
                </div>
              )}

              {/* Método */}
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Método</p>
                <p className="text-sm text-texto-primario">
                  {METODO_ETIQUETA[r.metodo_registro || 'manual'] || r.metodo_registro}
                </p>
              </div>

              {/* Tipo */}
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Tipo</p>
                <p className="text-sm text-texto-primario capitalize">{r.tipo}</p>
              </div>

              {/* Ubicación */}
              {r.ubicacion_entrada && (r.ubicacion_entrada as Record<string, string>)?.direccion && (
                <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5 col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Ubicación</p>
                  <p className="text-sm text-texto-primario flex items-center gap-1.5">
                    <MapPin size={12} className="text-texto-terciario shrink-0" />
                    {(r.ubicacion_entrada as Record<string, string>).direccion}
                    {(r.ubicacion_entrada as Record<string, string>).barrio && `, ${(r.ubicacion_entrada as Record<string, string>).barrio}`}
                  </p>
                </div>
              )}
            </div>

            {/* Notas */}
            {r.notas && (
              <div className="bg-superficie-elevada/30 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-texto-terciario mb-1">Notas</p>
                <p className="text-sm text-texto-secundario">{r.notas}</p>
              </div>
            )}

            {/* Editado */}
            {r.editado_por && (
              <p className="text-[10px] text-texto-terciario flex items-center gap-1">
                <Pencil size={9} /> Editado manualmente
              </p>
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

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-3">
              <CampoFecha etiqueta="Entrada" valor={entrada} onChange={setEntrada} />
              <CampoFecha etiqueta="Salida" valor={salida} onChange={setSalida} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoFecha etiqueta="Inicio almuerzo" valor={inicioAlm} onChange={setInicioAlm} />
              <CampoFecha etiqueta="Fin almuerzo" valor={finAlm} onChange={setFinAlm} />
            </div>

            <details className="group">
              <summary className="text-xs text-texto-terciario cursor-pointer flex items-center gap-1 hover:text-texto-secundario transition-colors">
                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                Trámite / particular
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <CampoFecha etiqueta="Salida trámite" valor={salidaPart} onChange={setSalidaPart} />
                <CampoFecha etiqueta="Vuelta trámite" valor={vueltaPart} onChange={setVueltaPart} />
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

// ─── Campo fecha reutilizable ────────────────────────────────

function CampoFecha({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">{etiqueta}</label>
      <input
        type="datetime-local"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-superficie-elevada/40 border border-borde-sutil rounded-lg px-3 py-2 text-sm text-texto-primario focus:border-texto-marca focus:outline-none transition-colors"
      />
    </div>
  )
}

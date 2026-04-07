'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings2, Clock, CalendarCheck, Monitor, Timer, Zap,
  Plus, Trash2, Star, ChevronDown, ChevronUp, Shield,
  Link2, Copy, RefreshCw, Ban,
} from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { Cargador } from '@/componentes/ui/Cargador'
import { useFormato } from '@/hooks/useFormato'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { QRCodeSVG } from 'qrcode.react'

// ─── Tipos ───────────────────────────────────────────────────

interface DiaHorario {
  activo: boolean
  desde: string
  hasta: string
}

interface DiasConfig {
  lunes: DiaHorario
  martes: DiaHorario
  miercoles: DiaHorario
  jueves: DiaHorario
  viernes: DiaHorario
  sabado: DiaHorario
  domingo: DiaHorario
}

interface TurnoLaboral {
  id: string
  nombre: string
  es_default: boolean
  flexible: boolean
  tolerancia_min: number
  dias: DiasConfig
}

interface ConfigAsistencias {
  kiosco_habilitado: boolean
  kiosco_metodo_lectura: string
  kiosco_pin_admin: string | null
  kiosco_capturar_foto: boolean
  kiosco_modo_empresa: string
  auto_checkout_habilitado: boolean
  auto_checkout_max_horas: number
  descontar_almuerzo: boolean
  duracion_almuerzo_min: number
  horas_minimas_diarias: number
  horas_maximas_diarias: number
  fichaje_auto_habilitado: boolean
  fichaje_auto_notif_min: number
  fichaje_auto_umbral_salida: number
}

interface Terminal {
  id: string
  nombre: string
  activo: boolean
  ultimo_ping: string | null
  creado_en: string
}

interface Sector {
  id: string
  nombre: string
  turno_id: string | null
  activo: boolean
}

const DIAS_SEMANA: { clave: keyof DiasConfig; etiqueta: string }[] = [
  { clave: 'lunes', etiqueta: 'Lunes' },
  { clave: 'martes', etiqueta: 'Martes' },
  { clave: 'miercoles', etiqueta: 'Miércoles' },
  { clave: 'jueves', etiqueta: 'Jueves' },
  { clave: 'viernes', etiqueta: 'Viernes' },
  { clave: 'sabado', etiqueta: 'Sábado' },
  { clave: 'domingo', etiqueta: 'Domingo' },
]

const DIAS_DEFAULT: DiasConfig = {
  lunes: { activo: true, desde: '09:00', hasta: '18:00' },
  martes: { activo: true, desde: '09:00', hasta: '18:00' },
  miercoles: { activo: true, desde: '09:00', hasta: '18:00' },
  jueves: { activo: true, desde: '09:00', hasta: '18:00' },
  viernes: { activo: true, desde: '09:00', hasta: '18:00' },
  sabado: { activo: false, desde: '09:00', hasta: '13:00' },
  domingo: { activo: false, desde: '09:00', hasta: '13:00' },
}

// ─── Página principal ────────────────────────────────────────

export default function PaginaConfiguracionAsistencias() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')
  const [cargando, setCargando] = useState(true)
  const [config, setConfig] = useState<ConfigAsistencias | null>(null)
  const [turnos, setTurnos] = useState<TurnoLaboral[]>([])
  const [terminales, setTerminales] = useState<Terminal[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/asistencias/config')
      if (!res.ok) return
      const data = await res.json()
      setConfig(data.config)
      setTurnos(data.turnos || [])
      setTerminales(data.terminales || [])
      setSectores(data.sectores || [])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Guardar config parcial (autoguardado)
  const guardarConfig = useCallback(async (campos: Partial<ConfigAsistencias>) => {
    setConfig(prev => prev ? { ...prev, ...campos } : prev)
    await fetch('/api/asistencias/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
  }, [])

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} />, grupo: 'Configuración' },
    { id: 'turnos', etiqueta: 'Turnos laborales', icono: <Clock size={16} />, grupo: 'Configuración' },
    { id: 'kiosco', etiqueta: 'Kiosco', icono: <Monitor size={16} />, grupo: 'Fichaje' },
    { id: 'terminales', etiqueta: 'Terminales', icono: <Shield size={16} />, grupo: 'Fichaje' },
    { id: 'auto_checkout', etiqueta: 'Auto-checkout', icono: <Timer size={16} />, grupo: 'Automatización' },
    { id: 'fichaje_auto', etiqueta: 'Fichaje automático', icono: <Zap size={16} />, grupo: 'Automatización' },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Asistencias"
      descripcion="Horarios, kiosco, terminales y reglas de fichaje."
      iconoHeader={<CalendarCheck size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Asistencias"
      onVolver={() => router.push('/asistencias')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Cargador tamano="md" />
        </div>
      ) : config ? (
        <>
          {seccionActiva === 'general' && (
            <SeccionGeneral config={config} onGuardar={guardarConfig} />
          )}
          {seccionActiva === 'turnos' && (
            <SeccionTurnos turnos={turnos} sectores={sectores} onRecargar={cargar} />
          )}
          {seccionActiva === 'kiosco' && (
            <SeccionKiosco config={config} onGuardar={guardarConfig} />
          )}
          {seccionActiva === 'terminales' && (
            <SeccionTerminales terminales={terminales} onRecargar={cargar} />
          )}
          {seccionActiva === 'auto_checkout' && (
            <SeccionAutoCheckout config={config} onGuardar={guardarConfig} />
          )}
          {seccionActiva === 'fichaje_auto' && (
            <SeccionFichajeAuto config={config} onGuardar={guardarConfig} />
          )}
        </>
      ) : null}
    </PlantillaConfiguracion>
  )
}

// ─── Sección General ─────────────────────────────────────────

function SeccionGeneral({ config, onGuardar }: { config: ConfigAsistencias; onGuardar: (c: Partial<ConfigAsistencias>) => void }) {
  return (
    <div className="space-y-6">
      <TarjetaConfig titulo="Almuerzo" descripcion="Cómo se descuenta el tiempo de almuerzo en el cálculo de horas.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Descontar almuerzo</p>
              <p className="text-xs text-texto-terciario">Restar tiempo de almuerzo de las horas trabajadas.</p>
            </div>
            <Interruptor
              activo={config.descontar_almuerzo}
              onChange={(v) => onGuardar({ descontar_almuerzo: v })}
            />
          </div>
          {config.descontar_almuerzo && (
            <div className="max-w-[200px]">
              <Input
                tipo="number"
                etiqueta="Duración del almuerzo (min)"
                value={String(config.duracion_almuerzo_min)}
                onChange={() => {}}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 60
                  onGuardar({ duracion_almuerzo_min: Math.max(15, Math.min(120, val)) })
                }}
                compacto
              />
            </div>
          )}
        </div>
      </TarjetaConfig>

      <TarjetaConfig titulo="Límites de jornada" descripcion="Horas mínimas y máximas diarias esperadas. Dejar en 0 para desactivar.">
        <div className="grid grid-cols-2 gap-4 max-w-[400px]">
          <Input
            tipo="number"
            etiqueta="Horas mínimas"
            value={String(config.horas_minimas_diarias)}
            onChange={() => {}}
            onBlur={(e) => {
              const val = parseFloat(e.currentTarget.value) || 0
              onGuardar({ horas_minimas_diarias: Math.max(0, Math.min(24, val)) })
            }}
            compacto
          />
          <Input
            tipo="number"
            etiqueta="Horas máximas"
            value={String(config.horas_maximas_diarias)}
            onChange={() => {}}
            onBlur={(e) => {
              const val = parseFloat(e.currentTarget.value) || 0
              onGuardar({ horas_maximas_diarias: Math.max(0, Math.min(24, val)) })
            }}
            compacto
          />
        </div>
      </TarjetaConfig>
    </div>
  )
}

// ─── Sección Turnos Laborales ────────────────────────────────

function SeccionTurnos({ turnos, sectores, onRecargar }: { turnos: TurnoLaboral[]; sectores: Sector[]; onRecargar: () => void }) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  const crearTurno = async () => {
    if (!nuevoNombre.trim()) return
    setCreando(true)
    const esDefault = turnos.length === 0
    await fetch('/api/asistencias/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), es_default: esDefault, dias: DIAS_DEFAULT }),
    })
    setNuevoNombre('')
    setCreando(false)
    onRecargar()
  }

  const actualizarTurno = async (id: string, campos: Partial<TurnoLaboral>) => {
    await fetch('/api/asistencias/turnos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...campos }),
    })
    onRecargar()
  }

  const eliminarTurno = async (id: string) => {
    await fetch('/api/asistencias/turnos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    onRecargar()
  }

  const asignarSector = async (sectorId: string, turnoId: string | null) => {
    await fetch('/api/asistencias/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _asignar_sector: { sector_id: sectorId, turno_id: turnoId } }),
    })
    onRecargar()
  }

  return (
    <div className="space-y-6">
      {/* Crear turno */}
      <TarjetaConfig titulo="Turnos laborales" descripcion="Horarios que se asignan a sectores o miembros individuales.">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              etiqueta="Nombre del turno"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') crearTurno() }}
              placeholder="Ej: Turno mañana, Horario fábrica..."
              compacto
            />
          </div>
          <Boton onClick={crearTurno} disabled={!nuevoNombre.trim() || creando} cargando={creando} tamano="sm">
            <Plus size={14} className="mr-1" /> Crear
          </Boton>
        </div>
      </TarjetaConfig>

      {/* Lista de turnos */}
      {turnos.map((turno) => (
        <TarjetaConfig
          key={turno.id}
          titulo={
            <div className="flex items-center gap-2">
              <span>{turno.nombre}</span>
              {turno.es_default && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-insignia-exito/15 text-insignia-exito">
                  <Star size={10} /> Predeterminado
                </span>
              )}
              {turno.flexible && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-insignia-info/15 text-insignia-info">
                  Flexible
                </span>
              )}
            </div>
          }
          accion={
            <button
              onClick={() => setExpandido(expandido === turno.id ? null : turno.id)}
              className="p-1 rounded-md hover:bg-superficie-elevada transition-colors"
            >
              {expandido === turno.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          }
        >
          {expandido === turno.id && (
            <EditorTurno
              turno={turno}
              onActualizar={(campos) => actualizarTurno(turno.id, campos)}
              onEliminar={() => eliminarTurno(turno.id)}
              puedeEliminar={!turno.es_default}
            />
          )}
        </TarjetaConfig>
      ))}

      {/* Asignación a sectores */}
      {turnos.length > 0 && sectores.length > 0 && (
        <TarjetaConfig titulo="Asignar a sectores" descripcion="Cada sector puede tener su propio turno. Si no se asigna, usa el predeterminado.">
          <div className="space-y-2">
            {sectores.map((sector) => (
              <div key={sector.id} className="flex items-center justify-between py-2 px-1">
                <span className="text-sm text-texto-primario">{sector.nombre}</span>
                <div className="w-48">
                  <Select
                    opciones={[
                      { valor: '', etiqueta: 'Predeterminado' },
                      ...turnos.map(t => ({ valor: t.id, etiqueta: t.nombre })),
                    ]}
                    valor={sector.turno_id || ''}
                    onChange={(v) => asignarSector(sector.id, v || null)}
                  />
                </div>
              </div>
            ))}
          </div>
        </TarjetaConfig>
      )}
    </div>
  )
}

// ─── Editor de turno expandido ───────────────────────────────

function EditorTurno({ turno, onActualizar, onEliminar, puedeEliminar }: {
  turno: TurnoLaboral
  onActualizar: (campos: Partial<TurnoLaboral>) => void
  onEliminar: () => void
  puedeEliminar: boolean
}) {
  const [dias, setDias] = useState<DiasConfig>(turno.dias)

  const actualizarDia = (clave: keyof DiasConfig, campo: keyof DiaHorario, valor: boolean | string) => {
    const nuevosDias = { ...dias, [clave]: { ...dias[clave], [campo]: valor } }
    setDias(nuevosDias)
    onActualizar({ dias: nuevosDias })
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Opciones generales */}
      <div className="flex flex-wrap items-center gap-6">
        <Interruptor
          activo={turno.flexible}
          onChange={(v) => onActualizar({ flexible: v })}
          etiqueta="Flexible (sin control de puntualidad)"
        />
        {!turno.es_default && (
          <Boton
            variante="fantasma"
            tamano="xs"
            onClick={() => onActualizar({ es_default: true })}
          >
            <Star size={12} className="mr-1" /> Marcar como predeterminado
          </Boton>
        )}
      </div>

      {/* Tolerancia */}
      {!turno.flexible && (
        <div className="max-w-[200px]">
          <Input
            tipo="number"
            etiqueta="Tolerancia tardanza (min)"
            value={String(turno.tolerancia_min)}
            onChange={() => {}}
            onBlur={(e) => {
              const val = parseInt(e.currentTarget.value) || 10
              onActualizar({ tolerancia_min: Math.max(0, Math.min(60, val)) })
            }}
            compacto
          />
        </div>
      )}

      {/* Días de la semana */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-texto-secundario mb-2">Horarios por día</p>
        {DIAS_SEMANA.map(({ clave, etiqueta }) => (
          <div key={clave} className="flex items-center gap-3 py-1.5">
            <div className="w-24">
              <Interruptor
                activo={dias[clave].activo}
                onChange={(v) => actualizarDia(clave, 'activo', v)}
                etiqueta={etiqueta}
              />
            </div>
            {dias[clave].activo && (
              <div className="flex items-center gap-2 text-sm">
                <SelectorHora
                  valor={dias[clave].desde || null}
                  onChange={(v) => actualizarDia(clave, 'desde', v || '09:00')}
                  pasoMinutos={15}
                />
                <span className="text-texto-terciario">a</span>
                <SelectorHora
                  valor={dias[clave].hasta || null}
                  onChange={(v) => actualizarDia(clave, 'hasta', v || '18:00')}
                  pasoMinutos={15}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Eliminar */}
      {puedeEliminar && (
        <div className="pt-2 border-t border-borde-sutil">
          <Boton variante="peligro" tamano="sm" onClick={onEliminar}>
            <Trash2 size={14} className="mr-1" /> Eliminar turno
          </Boton>
        </div>
      )}
    </div>
  )
}

// ─── Sección Kiosco ──────────────────────────────────────────

function SeccionKiosco({ config, onGuardar }: { config: ConfigAsistencias; onGuardar: (c: Partial<ConfigAsistencias>) => void }) {
  return (
    <div className="space-y-6">
      <TarjetaConfig titulo="Kiosco de fichaje" descripcion="Terminal físico para registrar entrada y salida en tablet.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Habilitar kiosco</p>
              <p className="text-xs text-texto-terciario">Permite configurar terminales de fichaje.</p>
            </div>
            <Interruptor
              activo={config.kiosco_habilitado}
              onChange={(v) => onGuardar({ kiosco_habilitado: v })}
            />
          </div>

          {config.kiosco_habilitado && (
            <div className="space-y-4 pt-2">
              <Select
                etiqueta="Método de lectura"
                opciones={[
                  { valor: 'rfid_hid', etiqueta: 'RFID USB (HID emulado)' },
                  { valor: 'nfc', etiqueta: 'NFC (Web NFC API)' },
                ]}
                valor={config.kiosco_metodo_lectura}
                onChange={(v) => onGuardar({ kiosco_metodo_lectura: v })}
              />

              <Select
                etiqueta="Visualización de empresa"
                opciones={[
                  { valor: 'logo_y_nombre', etiqueta: 'Logo + nombre' },
                  { valor: 'solo_logo', etiqueta: 'Solo logo' },
                  { valor: 'solo_nombre', etiqueta: 'Solo nombre' },
                ]}
                valor={config.kiosco_modo_empresa}
                onChange={(v) => onGuardar({ kiosco_modo_empresa: v })}
              />

              <div className="max-w-[200px]">
                <Input
                  etiqueta="PIN admin (4 dígitos)"
                  value={config.kiosco_pin_admin || ''}
                  onChange={() => {}}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 4)
                    onGuardar({ kiosco_pin_admin: val || null })
                  }}
                  placeholder="0000"
                  compacto
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-texto-primario">Foto silenciosa</p>
                  <p className="text-xs text-texto-terciario">Capturar foto al fichar (entrada y salida).</p>
                </div>
                <Interruptor
                  activo={config.kiosco_capturar_foto}
                  onChange={(v) => onGuardar({ kiosco_capturar_foto: v })}
                />
              </div>
            </div>
          )}
        </div>
      </TarjetaConfig>
    </div>
  )
}

// ─── Sección Terminales ──────────────────────────────────────

function SeccionTerminales({ terminales, onRecargar }: { terminales: Terminal[]; onRecargar: () => void }) {
  const formato = useFormato()
  const [nombreNueva, setNombreNueva] = useState('')
  const [creando, setCreando] = useState(false)
  const [linkGenerado, setLinkGenerado] = useState<{ terminalId: string; link: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [confirmar, setConfirmar] = useState<{ tipo: 'revocar' | 'eliminar'; id: string; nombre: string } | null>(null)

  const crearTerminal = async () => {
    if (!nombreNueva.trim() || creando) return
    setCreando(true)
    try {
      const res = await fetch('/api/kiosco/terminales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNueva.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setLinkGenerado({ terminalId: data.terminal.id, link: data.linkSetup })
        setNombreNueva('')
        onRecargar()
      }
    } finally {
      setCreando(false)
    }
  }

  const regenerarLink = async (terminalId: string) => {
    const res = await fetch('/api/kiosco/terminales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminalId }),
    })
    if (res.ok) {
      const data = await res.json()
      setLinkGenerado({ terminalId, link: data.linkSetup })
    }
  }

  const ejecutarAccion = async () => {
    if (!confirmar) return
    await fetch('/api/kiosco/terminales', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminalId: confirmar.id,
        eliminar: confirmar.tipo === 'eliminar',
      }),
    })
    if (linkGenerado?.terminalId === confirmar.id) setLinkGenerado(null)
    setConfirmar(null)
    onRecargar()
  }

  const copiarLink = () => {
    if (!linkGenerado) return
    navigator.clipboard.writeText(linkGenerado.link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const terminalesActivas = terminales.filter((t) => t.activo)
  const terminalesRevocadas = terminales.filter((t) => !t.activo)

  return (
    <div className="space-y-6">
      {/* Crear nueva terminal */}
      <TarjetaConfig titulo="Nueva terminal" descripcion="Creá un terminal y generá el enlace de activación para la tablet.">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              etiqueta=""
              placeholder="Nombre (ej: Entrada Principal)"
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearTerminal()}
              compacto
            />
          </div>
          <Boton
            onClick={crearTerminal}
            variante="primario"
            tamano="sm"
            disabled={!nombreNueva.trim() || creando}
            icono={<Plus size={16} />}
          >
            Crear
          </Boton>
        </div>
      </TarjetaConfig>

      {/* Link + QR de activación generado */}
      {linkGenerado && (
        <TarjetaConfig titulo="Activar terminal" descripcion="Escaneá el QR desde la tablet o copiá el enlace.">
          <div className="space-y-4">
            <div className="flex justify-center py-4">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <QRCodeSVG
                  value={linkGenerado.link}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-superficie-elevada border border-borde-sutil">
              <Link2 size={14} className="text-texto-terciario shrink-0" />
              <code className="text-xs text-texto-secundario break-all flex-1 select-all">{linkGenerado.link}</code>
            </div>

            <div className="flex gap-2">
              <Boton onClick={copiarLink} variante="secundario" tamano="sm" icono={<Copy size={14} />}>
                {copiado ? 'Copiado' : 'Copiar enlace'}
              </Boton>
              <Boton onClick={() => setLinkGenerado(null)} variante="fantasma" tamano="sm">
                Cerrar
              </Boton>
            </div>

            <p className="text-xs text-texto-terciario">
              El enlace es de un solo uso. Una vez activado, el kiosco queda vinculado permanentemente.
            </p>
          </div>
        </TarjetaConfig>
      )}

      {/* Terminales activas */}
      {terminalesActivas.length > 0 && (
        <TarjetaConfig titulo="Terminales activas" descripcion="Dispositivos vinculados y funcionando.">
          <div className="space-y-2">
            {terminalesActivas.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3 px-4 rounded-xl border border-borde-sutil">
                <div className="size-2.5 rounded-full bg-insignia-exito shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto-primario truncate">{t.nombre}</p>
                  <p className="text-xs text-texto-terciario">
                    {t.ultimo_ping
                      ? `Último ping: ${formato.fecha(t.ultimo_ping, { conHora: true })}`
                      : 'Nunca conectada'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => regenerarLink(t.id)}
                    className="p-2 rounded-lg hover:bg-superficie-elevada transition-colors"
                    title="Regenerar enlace"
                  >
                    <RefreshCw size={15} className="text-texto-terciario" />
                  </button>
                  <button
                    onClick={() => setConfirmar({ tipo: 'revocar', id: t.id, nombre: t.nombre })}
                    className="p-2 rounded-lg hover:bg-insignia-peligro/10 transition-colors"
                    title="Revocar terminal"
                  >
                    <Ban size={15} className="text-insignia-peligro" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TarjetaConfig>
      )}

      {/* Terminales revocadas */}
      {terminalesRevocadas.length > 0 && (
        <TarjetaConfig titulo="Terminales revocadas" descripcion="Dispositivos desactivados.">
          <div className="space-y-2">
            {terminalesRevocadas.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-3 px-4 rounded-xl border border-borde-sutil opacity-60">
                <div className="size-2.5 rounded-full bg-texto-terciario shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto-primario truncate">{t.nombre}</p>
                  <p className="text-xs text-texto-terciario">Revocada</p>
                </div>
                <button
                  onClick={() => setConfirmar({ tipo: 'eliminar', id: t.id, nombre: t.nombre })}
                  className="p-2 rounded-lg hover:bg-insignia-peligro/10 transition-colors shrink-0"
                  title="Eliminar terminal"
                >
                  <Trash2 size={15} className="text-insignia-peligro" />
                </button>
              </div>
            ))}
          </div>
        </TarjetaConfig>
      )}

      {/* Estado vacío */}
      {terminales.length === 0 && (
        <TarjetaConfig titulo="Terminales registradas" descripcion="Dispositivos vinculados para fichaje presencial.">
          <p className="text-sm text-texto-terciario py-4">
            No hay terminales registradas. Creá una arriba para empezar.
          </p>
        </TarjetaConfig>
      )}

      {/* Modal de confirmación */}
      <ModalConfirmacion
        abierto={!!confirmar}
        onCerrar={() => setConfirmar(null)}
        onConfirmar={ejecutarAccion}
        tipo="peligro"
        titulo={confirmar?.tipo === 'revocar' ? 'Revocar terminal' : 'Eliminar terminal'}
        descripcion={
          confirmar?.tipo === 'revocar'
            ? `¿Revocar "${confirmar.nombre}"? La tablet dejará de funcionar como kiosco. Podés reactivarla después con un nuevo enlace.`
            : `¿Eliminar "${confirmar?.nombre}" permanentemente? Esta acción no se puede deshacer.`
        }
        etiquetaConfirmar={confirmar?.tipo === 'revocar' ? 'Revocar' : 'Eliminar'}
      />
    </div>
  )
}

// ─── Sección Auto-Checkout ───────────────────────────────────

function SeccionAutoCheckout({ config, onGuardar }: { config: ConfigAsistencias; onGuardar: (c: Partial<ConfigAsistencias>) => void }) {
  return (
    <div className="space-y-6">
      <TarjetaConfig titulo="Cierre automático" descripcion="Cierra turnos abiertos que superen el tiempo máximo (se ejecuta a las 03:00 AM).">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Activar cierre automático</p>
              <p className="text-xs text-texto-terciario">Los turnos que superen el límite se cierran automáticamente.</p>
            </div>
            <Interruptor
              activo={config.auto_checkout_habilitado}
              onChange={(v) => onGuardar({ auto_checkout_habilitado: v })}
            />
          </div>

          {config.auto_checkout_habilitado && (
            <div className="max-w-[200px]">
              <Input
                tipo="number"
                etiqueta="Duración máxima de turno (horas)"
                value={String(config.auto_checkout_max_horas)}
                onChange={() => {}}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 12
                  onGuardar({ auto_checkout_max_horas: Math.max(1, Math.min(24, val)) })
                }}
                compacto
              />
            </div>
          )}
        </div>
      </TarjetaConfig>
    </div>
  )
}

// ─── Sección Fichaje Automático ──────────────────────────────

function SeccionFichajeAuto({ config, onGuardar }: { config: ConfigAsistencias; onGuardar: (c: Partial<ConfigAsistencias>) => void }) {
  return (
    <div className="space-y-6">
      <TarjetaConfig titulo="Fichaje automático" descripcion="Registra entrada y salida automáticamente según la actividad en Flux.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Habilitar fichaje automático</p>
              <p className="text-xs text-texto-terciario">Los miembros con método &quot;automático&quot; fichan al usar Flux.</p>
            </div>
            <Interruptor
              activo={config.fichaje_auto_habilitado}
              onChange={(v) => onGuardar({ fichaje_auto_habilitado: v })}
            />
          </div>

          {config.fichaje_auto_habilitado && (
            <div className="grid grid-cols-2 gap-4 max-w-[400px]">
              <Input
                tipo="number"
                etiqueta="Notificar después de (min)"
                value={String(config.fichaje_auto_notif_min)}
                onChange={() => {}}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 10
                  onGuardar({ fichaje_auto_notif_min: Math.max(1, Math.min(60, val)) })
                }}
                compacto
              />
              <Input
                tipo="number"
                etiqueta="Umbral de salida (min)"
                value={String(config.fichaje_auto_umbral_salida)}
                onChange={() => {}}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 30
                  onGuardar({ fichaje_auto_umbral_salida: Math.max(5, Math.min(120, val)) })
                }}
                compacto
              />
            </div>
          )}
        </div>
      </TarjetaConfig>
    </div>
  )
}

// ─── Componente Tarjeta Config ───────────────────────────────

function TarjetaConfig({ titulo, descripcion, accion, children }: {
  titulo: React.ReactNode
  descripcion?: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-borde-sutil">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>
            {descripcion && <p className="text-xs text-texto-terciario mt-0.5">{descripcion}</p>}
          </div>
          {accion}
        </div>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  )
}

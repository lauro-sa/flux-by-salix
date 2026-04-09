'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings2, Clock, CalendarCheck, Monitor, Timer, Zap,
  Plus, Trash2, Star, ChevronDown, ChevronUp, Shield,
  Link2, Copy, RefreshCw, Ban, ExternalLink, Globe,
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
import { DELAY_CARGA } from '@/lib/constantes/timeouts'

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
  zona_horaria: string | null
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

interface HorarioEmpresa {
  id: string
  dia_semana: number // 0=Lun, 1=Mar, ... 6=Dom
  hora_inicio: string
  hora_fin: string
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
  const [horariosEmpresa, setHorariosEmpresa] = useState<HorarioEmpresa[]>([])

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/asistencias/config')
      if (!res.ok) return
      const data = await res.json()
      setConfig(data.config)
      setTurnos(data.turnos || [])
      setTerminales(data.terminales || [])
      setSectores(data.sectores || [])
      setHorariosEmpresa(data.horarios_empresa || [])
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
            <SeccionTurnos turnos={turnos} sectores={sectores} horariosEmpresa={horariosEmpresa} onRecargar={cargar} />
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
      <TarjetaConfig titulo="Almuerzo" descripcion="Si tu equipo tiene horario de almuerzo, activá esto para que se descuente del total de horas trabajadas. El empleado puede fichar su almuerzo desde el kiosco o la web.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Descontar almuerzo</p>
              <p className="text-xs text-texto-terciario">Si está activo, el tiempo de almuerzo se resta de las horas netas del día.</p>
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

      <TarjetaConfig titulo="Límites de jornada" descripcion="Definí cuántas horas mínimas y máximas puede tener una jornada. Se usa para alertas y reportes. Dejá en 0 para no aplicar límite.">
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

function SeccionTurnos({ turnos, sectores, horariosEmpresa, onRecargar }: {
  turnos: TurnoLaboral[]
  sectores: Sector[]
  horariosEmpresa: HorarioEmpresa[]
  onRecargar: () => void
}) {
  const router = useRouter()
  const [expandido, setExpandido] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  // Turnos personalizados (excluir el predeterminado viejo si existe)
  const turnosPersonalizados = turnos.filter(t => !t.es_default)

  const crearTurno = async () => {
    if (!nuevoNombre.trim()) return
    setCreando(true)
    await fetch('/api/asistencias/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), es_default: false, dias: DIAS_DEFAULT }),
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
      {/* Horario predeterminado (read-only, desde config empresa) */}
      <TarjetaConfig
        titulo={
          <div className="flex flex-wrap items-center gap-2">
            <span>Horario predeterminado</span>
            <span className="inline-flex items-center gap-1 text-xxs font-semibold px-1.5 py-0.5 rounded-full bg-insignia-exito/15 text-insignia-exito shrink-0">
              <Star size={10} /> Empresa
            </span>
          </div>
        }
        descripcion="Este horario aplica a todos los empleados que no tengan un turno personalizado asignado. Se configura en Configuración de empresa → Regional."
      >
        {/* Vista read-only de días */}
        <div className="space-y-1">
          {DIAS_SEMANA.map(({ clave, etiqueta }, idx) => {
            const horario = horariosEmpresa.find(h => h.dia_semana === idx)
            const activo = horario?.activo ?? (idx <= 4)
            const inicio = horario?.hora_inicio || '09:00'
            const fin = horario?.hora_fin || '18:00'

            return (
              <div key={clave} className={`flex items-center gap-3 py-1.5 ${!activo ? 'opacity-40' : ''}`}>
                <div className="w-28 shrink-0 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${activo ? 'bg-insignia-exito' : 'bg-borde-sutil'}`} />
                  <span className="text-sm text-texto-primario">{etiqueta}</span>
                </div>
                {activo ? (
                  <span className="text-sm text-texto-secundario tabular-nums">
                    {inicio.slice(0, 5)} a {fin.slice(0, 5)}
                  </span>
                ) : (
                  <span className="text-xs text-texto-terciario italic">No laboral</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="pt-3 border-t border-borde-sutil mt-3">
          <Boton
            variante="fantasma"
            tamano="xs"
            onClick={() => router.push('/configuracion?seccion=estructura&tab=horarios')}
          >
            <ExternalLink size={12} className="mr-1" /> Editar en configuración de empresa
          </Boton>
        </div>
      </TarjetaConfig>

      {/* Crear turno personalizado */}
      <TarjetaConfig titulo="Turnos personalizados" descripcion="Creá turnos con horarios diferentes al predeterminado. Después asignalos a sectores (abajo) o a miembros individuales desde su perfil. Los empleados sin turno asignado usan el horario predeterminado de la empresa.">
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

      {/* Lista de turnos personalizados */}
      {turnosPersonalizados.map((turno) => {
        const abierto = expandido === turno.id
        const diasActivos = DIAS_SEMANA.filter(d => turno.dias[d.clave]?.activo)
        const resumenHorario = diasActivos.length > 0
          ? `${diasActivos.map(d => d.etiqueta.slice(0, 3)).join(', ')} · ${turno.dias[diasActivos[0].clave]?.desde || '09:00'} a ${turno.dias[diasActivos[0].clave]?.hasta || '18:00'}`
          : 'Sin días activos'

        return (
          <TarjetaConfig
            key={turno.id}
            titulo={
              <button
                type="button"
                onClick={() => setExpandido(abierto ? null : turno.id)}
                className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full text-left cursor-pointer"
              >
                {abierto ? <ChevronUp size={14} className="text-texto-terciario shrink-0" /> : <ChevronDown size={14} className="text-texto-terciario shrink-0" />}
                <span className="shrink-0">{turno.nombre}</span>
                {turno.flexible && (
                  <span className="text-xxs font-semibold px-1.5 py-0.5 rounded-full bg-insignia-info/15 text-insignia-info shrink-0">
                    Flexible
                  </span>
                )}
                {!abierto && (
                  <span className="ml-auto text-xs text-texto-terciario font-normal hidden sm:inline">
                    {resumenHorario} · {turno.flexible ? 'Sin control' : `${turno.tolerancia_min}min tolerancia`}
                  </span>
                )}
              </button>
            }
          >
            {abierto && (
              <EditorTurno
                turno={turno}
                onActualizar={(campos) => actualizarTurno(turno.id, campos)}
                onEliminar={() => eliminarTurno(turno.id)}
                puedeEliminar
              />
            )}
          </TarjetaConfig>
        )
      })}

      {/* Asignación a sectores */}
      {turnosPersonalizados.length > 0 && sectores.length > 0 && (
        <TarjetaConfig titulo="Asignar a sectores" descripcion="Asigná un turno personalizado a cada sector. Todos los empleados de ese sector heredan el horario. Si un miembro tiene turno propio en su perfil, ese tiene prioridad.">
          <div className="space-y-2">
            {sectores.map((sector) => (
              <div key={sector.id} className="flex items-center justify-between py-2 px-1">
                <span className="text-sm text-texto-primario">{sector.nombre}</span>
                <div className="w-48">
                  <Select
                    opciones={[
                      { valor: '', etiqueta: 'Predeterminado (empresa)' },
                      ...turnosPersonalizados.map(t => ({ valor: t.id, etiqueta: t.nombre })),
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
      {/* Nombre editable */}
      <div className="max-w-[300px]">
        <Input
          etiqueta="Nombre del turno"
          value={turno.nombre}
          onChange={() => {}}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim()
            if (val && val !== turno.nombre) onActualizar({ nombre: val })
          }}
          compacto
        />
      </div>

      {/* Opciones generales */}
      <div className="flex flex-wrap items-center gap-6">
        <Interruptor
          activo={turno.flexible}
          onChange={(v) => onActualizar({ flexible: v })}
          etiqueta="Flexible (sin control de puntualidad)"
        />
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
          <div key={clave} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5">
            <div className="w-28 shrink-0">
              <Interruptor
                activo={dias[clave].activo}
                onChange={(v) => actualizarDia(clave, 'activo', v)}
                etiqueta={etiqueta}
              />
            </div>
            {dias[clave].activo && (
              <div className="flex items-center gap-2 text-sm pl-12 sm:pl-0">
                <div className="w-[110px]">
                  <SelectorHora
                    valor={dias[clave].desde || null}
                    onChange={(v) => actualizarDia(clave, 'desde', v || '09:00')}
                    pasoMinutos={15}
                  />
                </div>
                <span className="text-texto-terciario shrink-0">a</span>
                <div className="w-[110px]">
                  <SelectorHora
                    valor={dias[clave].hasta || null}
                    onChange={(v) => actualizarDia(clave, 'hasta', v || '18:00')}
                    pasoMinutos={15}
                  />
                </div>
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
      <TarjetaConfig titulo="Kiosco de fichaje" descripcion="Instalá una tablet en la entrada de tu oficina o planta para que los empleados fichen con llavero RFID, NFC o PIN. Después de activar, andá a la sección Terminales para vincular dispositivos.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Habilitar kiosco</p>
              <p className="text-xs text-texto-terciario">Activa esto para poder crear y vincular terminales de fichaje presencial.</p>
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
                  etiqueta="PIN admin (6 dígitos)"
                  value={config.kiosco_pin_admin || ''}
                  onChange={() => {}}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)
                    onGuardar({ kiosco_pin_admin: val || null })
                  }}
                  placeholder="0000"
                  compacto
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-texto-primario">Foto silenciosa</p>
                  <p className="text-xs text-texto-terciario">La tablet saca una foto automática al momento de fichar, sin que el empleado lo note. Útil para auditoría.</p>
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
  const [editandoZona, setEditandoZona] = useState<string | null>(null)

  const guardarZona = async (terminalId: string, zona: string | null) => {
    await fetch('/api/kiosco/terminales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminalId, zona_horaria: zona || null }),
    })
    setEditandoZona(null)
    onRecargar()
  }

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
    setTimeout(() => setCopiado(false), DELAY_CARGA)
  }

  const terminalesActivas = terminales.filter((t) => t.activo)
  const terminalesRevocadas = terminales.filter((t) => !t.activo)

  return (
    <div className="space-y-6">
      {/* Crear nueva terminal */}
      <TarjetaConfig titulo="Nueva terminal" descripcion="Cada terminal es un dispositivo físico (tablet) donde los empleados fichan. Creá una, escaneá el QR desde la tablet y listo.">
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
        <TarjetaConfig titulo="Activar terminal" descripcion="Abrí el navegador en la tablet, escaneá este QR o pegá el enlace. El terminal se vincula automáticamente y queda listo para fichar.">
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
        <TarjetaConfig titulo="Terminales activas" descripcion="Dispositivos vinculados y funcionando. Podés cambiar la zona horaria si un terminal está en una ubicación con huso horario diferente al de la empresa.">
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
                  {/* Zona horaria */}
                  {editandoZona === t.id ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <select
                        className="text-xs bg-superficie-elevada border border-borde-sutil rounded-lg px-2 py-1 text-texto-primario"
                        defaultValue={t.zona_horaria || ''}
                        onChange={(e) => guardarZona(t.id, e.target.value || null)}
                      >
                        <option value="">Zona de la empresa (predeterminada)</option>
                        <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires)</option>
                        <option value="America/Argentina/Cordoba">Argentina (Córdoba)</option>
                        <option value="America/Montevideo">Uruguay</option>
                        <option value="America/Santiago">Chile</option>
                        <option value="America/Bogota">Colombia</option>
                        <option value="America/Lima">Perú</option>
                        <option value="America/Mexico_City">México (CDMX)</option>
                        <option value="America/Sao_Paulo">Brasil (São Paulo)</option>
                        <option value="Europe/Madrid">España</option>
                        <option value="America/New_York">EE.UU. (Este)</option>
                        <option value="America/Los_Angeles">EE.UU. (Pacífico)</option>
                      </select>
                      <button onClick={() => setEditandoZona(null)} className="text-xs text-texto-terciario hover:text-texto-secundario">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditandoZona(t.id)}
                      className="text-xxs text-texto-terciario hover:text-texto-secundario mt-0.5 flex items-center gap-1 transition-colors"
                    >
                      <Globe size={10} />
                      {t.zona_horaria || 'Zona de la empresa'}
                    </button>
                  )}
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
      <TarjetaConfig titulo="Cierre automático" descripcion="Si un empleado se olvida de fichar su salida, el sistema cierra el turno automáticamente después del tiempo máximo. Si el empleado tenía actividad en Flux (heartbeat), la salida queda como 'Cerrado' con la última hora registrada. Si no hubo actividad, queda como 'Sin salida'.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Activar cierre automático</p>
              <p className="text-xs text-texto-terciario">Se ejecuta a las 03:00 AM y también cuando se detecta inactividad prolongada.</p>
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
      <TarjetaConfig titulo="Fichaje automático" descripcion="Para empleados que trabajan en PC. Flux detecta cuándo empiezan a usar el sistema y registra la entrada automáticamente. La salida se actualiza con cada señal de actividad. Para que funcione, este switch debe estar activo Y el empleado debe tener el método 'Automático' en su perfil de usuario.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-texto-primario">Habilitar fichaje automático</p>
              <p className="text-xs text-texto-terciario">Switch maestro: si está apagado, ningún empleado ficha automáticamente, sin importar su configuración individual.</p>
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
                etiqueta="Notificar entrada después de (min)"
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
                etiqueta="Inactividad para cerrar (min)"
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings2, Clock, CalendarCheck, Monitor, Timer, Zap,
  Plus, Trash2, Shield,
  Link2, Copy, RefreshCw, Ban, Globe, Coins,
} from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { Cargador } from '@/componentes/ui/Cargador'
import { useFormato } from '@/hooks/useFormato'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { QRCodeSVG } from 'qrcode.react'
import { DELAY_CARGA } from '@/lib/constantes/timeouts'

// ─── Tipos ───────────────────────────────────────────────────

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
  umbral_jornada_completa_pct: number
  umbral_media_jornada_pct: number
  modo_pago_parcial: 'no_paga' | 'media_jornada' | 'proporcional'
}

interface Terminal {
  id: string
  nombre: string
  zona_horaria: string | null
  activo: boolean
  ultimo_ping: string | null
  creado_en: string
}

// Zonas horarias disponibles por terminal (cuando difiere de la empresa)
const OPCIONES_ZONA_HORARIA = [
  { valor: '', etiqueta: 'Zona de la empresa (predeterminada)' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Argentina (Buenos Aires)' },
  { valor: 'America/Argentina/Cordoba', etiqueta: 'Argentina (Córdoba)' },
  { valor: 'America/Montevideo', etiqueta: 'Uruguay' },
  { valor: 'America/Santiago', etiqueta: 'Chile' },
  { valor: 'America/Bogota', etiqueta: 'Colombia' },
  { valor: 'America/Lima', etiqueta: 'Perú' },
  { valor: 'America/Mexico_City', etiqueta: 'México (CDMX)' },
  { valor: 'America/Sao_Paulo', etiqueta: 'Brasil (São Paulo)' },
  { valor: 'Europe/Madrid', etiqueta: 'España' },
  { valor: 'America/New_York', etiqueta: 'EE.UU. (Este)' },
  { valor: 'America/Los_Angeles', etiqueta: 'EE.UU. (Pacífico)' },
]

// ─── Página principal ────────────────────────────────────────

export default function PaginaConfiguracionAsistencias() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')
  const [cargando, setCargando] = useState(true)
  const [config, setConfig] = useState<ConfigAsistencias | null>(null)
  const [terminales, setTerminales] = useState<Terminal[]>([])

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/asistencias/config')
      if (!res.ok) return
      const data = await res.json()
      setConfig(data.config)
      setTerminales(data.terminales || [])
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
    { id: 'nomina', etiqueta: 'Nómina', icono: <Coins size={16} />, grupo: 'Configuración' },
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
      onCambiarSeccion={(id) => {
        if (id === 'turnos') {
          router.push('/asistencias/configuracion/turnos')
          return
        }
        setSeccionActiva(id)
      }}
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
          {seccionActiva === 'nomina' && (
            <SeccionNomina config={config} onGuardar={guardarConfig} />
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


// ─── Sección Nómina ──────────────────────────────────────────
// Clasificación de jornadas para empleados jornaleros/por día.
// Define umbrales (completa/media/parcial) y cómo pagar las parciales.

function SeccionNomina({ config, onGuardar }: { config: ConfigAsistencias; onGuardar: (c: Partial<ConfigAsistencias>) => void }) {
  // Valores locales editables sin guardar hasta blur
  const [umbralCompleta, setUmbralCompleta] = useState(String(config.umbral_jornada_completa_pct))
  const [umbralMedia, setUmbralMedia] = useState(String(config.umbral_media_jornada_pct))

  useEffect(() => {
    setUmbralCompleta(String(config.umbral_jornada_completa_pct))
    setUmbralMedia(String(config.umbral_media_jornada_pct))
  }, [config.umbral_jornada_completa_pct, config.umbral_media_jornada_pct])

  const guardarUmbrales = (completa: number, media: number) => {
    // Validar: 0 < media < completa ≤ 100
    const c = Math.max(10, Math.min(100, completa))
    const m = Math.max(1, Math.min(c - 1, media))
    onGuardar({ umbral_jornada_completa_pct: c, umbral_media_jornada_pct: m })
  }

  return (
    <div className="space-y-6">
      <TarjetaConfig
        titulo="Clasificación de jornada"
        descripcion="Para empleados jornaleros (pago por día), Flux clasifica automáticamente cada día según cuánto trabajó respecto a su turno. Así podés pagar jornada completa, media jornada o un pago parcial sin tener que calcularlo a mano."
      >
        <div className="space-y-5">
          {/* Explicación visual de los tramos */}
          <div className="rounded-card border border-borde-sutil bg-superficie-elevada p-4">
            <p className="text-xs font-medium text-texto-terciario uppercase tracking-wider mb-3">Cómo se clasifica cada día</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-insignia-exito/15 text-insignia-exito text-xs font-semibold">1</span>
                <p className="text-texto-secundario">
                  <span className="font-medium text-texto-primario">Jornada completa</span> — trabajó ≥ <span className="font-medium text-texto-primario">{config.umbral_jornada_completa_pct}%</span> del turno. Paga <span className="font-medium">1 jornal</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-insignia-advertencia/15 text-insignia-advertencia text-xs font-semibold">½</span>
                <p className="text-texto-secundario">
                  <span className="font-medium text-texto-primario">Media jornada</span> — trabajó entre <span className="font-medium text-texto-primario">{config.umbral_media_jornada_pct}%</span> y {config.umbral_jornada_completa_pct}%. Paga <span className="font-medium">0,5 jornal</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-insignia-info/15 text-insignia-info text-xs font-semibold">¼</span>
                <p className="text-texto-secundario">
                  <span className="font-medium text-texto-primario">Presente parcial</span> — trabajó menos de {config.umbral_media_jornada_pct}% (ej: se fue antes por cancelación o imprevisto). Paga según regla abajo.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-insignia-peligro/15 text-insignia-peligro text-xs font-semibold">0</span>
                <p className="text-texto-secundario">
                  <span className="font-medium text-texto-primario">Ausente</span> — no fichó ni un minuto. No paga.
                </p>
              </div>
            </div>
          </div>

          {/* Umbrales editables */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">Umbrales</p>
            <div className="grid grid-cols-2 gap-4 max-w-[440px]">
              <Input
                tipo="number"
                etiqueta="Umbral jornada completa (%)"
                value={umbralCompleta}
                onChange={(e) => setUmbralCompleta(e.currentTarget.value)}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 75
                  guardarUmbrales(val, config.umbral_media_jornada_pct)
                }}
                compacto
              />
              <Input
                tipo="number"
                etiqueta="Umbral media jornada (%)"
                value={umbralMedia}
                onChange={(e) => setUmbralMedia(e.currentTarget.value)}
                onBlur={(e) => {
                  const val = parseInt(e.currentTarget.value) || 25
                  guardarUmbrales(config.umbral_jornada_completa_pct, val)
                }}
                compacto
              />
            </div>
            <p className="text-xs text-texto-terciario mt-2">
              Valores predeterminados: 75% y 25%. El umbral de media jornada debe ser menor que el de jornada completa.
            </p>
          </div>

          {/* Modo de pago para parciales */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">Qué hacer con presentes parciales</p>
            <div className="max-w-[440px]">
              <Select
                etiqueta=""
                opciones={[
                  { valor: 'no_paga', etiqueta: 'No paga (sólo queda registrado)' },
                  { valor: 'media_jornada', etiqueta: 'Paga como media jornada' },
                  { valor: 'proporcional', etiqueta: 'Paga proporcional al tiempo trabajado' },
                ]}
                valor={config.modo_pago_parcial}
                onChange={(v) => onGuardar({ modo_pago_parcial: v as ConfigAsistencias['modo_pago_parcial'] })}
              />
            </div>
            <p className="text-xs text-texto-terciario mt-2">
              Esta regla sólo aplica a empleados con compensación <span className="font-medium">por día</span>. Los de sueldo fijo y por hora no se ven afectados.
            </p>
          </div>
        </div>
      </TarjetaConfig>
    </div>
  )
}

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
              <div className="p-4 bg-white rounded-modal shadow-lg">
                <QRCodeSVG
                  value={linkGenerado.link}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-card bg-superficie-elevada border border-borde-sutil">
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
              <div key={t.id} className="flex items-center gap-3 py-3 px-4 rounded-card border border-borde-sutil">
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
                      <div className="min-w-[240px]">
                        <Select
                          opciones={OPCIONES_ZONA_HORARIA}
                          valor={t.zona_horaria || ''}
                          onChange={(v) => guardarZona(t.id, v || null)}
                        />
                      </div>
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
                    className="p-2 rounded-card hover:bg-superficie-elevada transition-colors"
                    title="Regenerar enlace"
                  >
                    <RefreshCw size={15} className="text-texto-terciario" />
                  </button>
                  <button
                    onClick={() => setConfirmar({ tipo: 'revocar', id: t.id, nombre: t.nombre })}
                    className="p-2 rounded-card hover:bg-insignia-peligro/10 transition-colors"
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
              <div key={t.id} className="flex items-center gap-3 py-3 px-4 rounded-card border border-borde-sutil opacity-60">
                <div className="size-2.5 rounded-full bg-texto-terciario shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto-primario truncate">{t.nombre}</p>
                  <p className="text-xs text-texto-terciario">Revocada</p>
                </div>
                <button
                  onClick={() => setConfirmar({ tipo: 'eliminar', id: t.id, nombre: t.nombre })}
                  className="p-2 rounded-card hover:bg-insignia-peligro/10 transition-colors shrink-0"
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
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
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

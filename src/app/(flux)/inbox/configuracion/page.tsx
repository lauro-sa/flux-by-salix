'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Insignia } from '@/componentes/ui/Insignia'
import { Alerta } from '@/componentes/ui/Alerta'
import { Avatar } from '@/componentes/ui/Avatar'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import {
  Settings2, MessageCircle, Mail, Hash, FileText, Users,
  Clock, Bell, Plus, Trash2, Wifi, WifiOff, AlertTriangle,
  Pencil, GripVertical, Shield, ChevronDown,
} from 'lucide-react'
import type { CanalInbox, PlantillaRespuesta, ConfigInbox, TipoCanal } from '@/tipos/inbox'
import { ModalAgregarCanal } from '../_componentes/ModalAgregarCanal'
import { SeccionWhatsApp } from '../_componentes/SeccionWhatsApp'

/**
 * Configuración del Inbox — secciones: General, WhatsApp, Correo, Interno, Plantillas, SLA.
 */

export default function PaginaConfiguracionInbox() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')
  const [cargando, setCargando] = useState(true)

  // Modal agregar canal
  const [modalCanal, setModalCanal] = useState<{ abierto: boolean; tipo: TipoCanal }>({ abierto: false, tipo: 'whatsapp' })

  // Datos
  const [config, setConfig] = useState<ConfigInbox | null>(null)
  const [canales, setCanales] = useState<CanalInbox[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaRespuesta[]>([])

  // Cargar configuración
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resConfig, resCanales, resPlantillas] = await Promise.all([
        fetch('/api/inbox/config'),
        fetch('/api/inbox/canales'),
        fetch('/api/inbox/plantillas'),
      ])
      const [dataConfig, dataCanales, dataPlantillas] = await Promise.all([
        resConfig.json(),
        resCanales.json(),
        resPlantillas.json(),
      ])

      setConfig(dataConfig.config)
      setCanales(dataCanales.canales || [])
      setPlantillas(dataPlantillas.plantillas || [])
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Guardar config
  const guardarConfig = useCallback(async (cambios: Partial<ConfigInbox>) => {
    try {
      await fetch('/api/inbox/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      setConfig(prev => prev ? { ...prev, ...cambios } : null)
    } catch {
      // TODO: toast error
    }
  }, [])

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'whatsapp', etiqueta: 'WhatsApp', icono: <MessageCircle size={16} /> },
    { id: 'correo', etiqueta: 'Correo electrónico', icono: <Mail size={16} /> },
    { id: 'interno', etiqueta: 'Mensajería interna', icono: <Hash size={16} /> },
    { id: 'plantillas_wa', etiqueta: 'Plantillas WhatsApp', icono: <FileText size={16} />, grupo: 'Plantillas' },
    { id: 'plantillas_correo', etiqueta: 'Plantillas de correo', icono: <FileText size={16} />, grupo: 'Plantillas' },
    { id: 'asignacion', etiqueta: 'Asignación', icono: <Users size={16} />, grupo: 'Avanzado' },
    { id: 'sla', etiqueta: 'SLA y horarios', icono: <Clock size={16} />, grupo: 'Avanzado' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, grupo: 'Avanzado' },
  ]

  const canalesWhatsApp = canales.filter(c => c.tipo === 'whatsapp')
  const canalesCorreo = canales.filter(c => c.tipo === 'correo')

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Inbox"
      volverTexto="Inbox"
      onVolver={() => router.push('/inbox')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {/* General */}
      {seccionActiva === 'general' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--texto-primario)' }}>
              Módulos activos
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--texto-terciario)' }}>
              Activá o desactivá los canales de comunicación que usa tu empresa.
            </p>
            <div className="space-y-3">
              <ModuloToggle
                icono={<MessageCircle size={18} style={{ color: 'var(--canal-whatsapp)' }} />}
                nombre="WhatsApp"
                descripcion="Chat en tiempo real con clientes vía WhatsApp Business"
                activo={true}
                onChange={() => {}}
              />
              <ModuloToggle
                icono={<Mail size={18} style={{ color: 'var(--canal-correo)' }} />}
                nombre="Correo electrónico"
                descripcion="Bandejas compartidas y personales con soporte IMAP/Gmail"
                activo={true}
                onChange={() => {}}
              />
              <ModuloToggle
                icono={<Hash size={18} style={{ color: 'var(--canal-interno)' }} />}
                nombre="Mensajería interna"
                descripcion="Canales y mensajes directos entre agentes"
                activo={true}
                onChange={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp — sección completa con stepper, formulario guiado, firma, coexistencia, FAQs */}
      {seccionActiva === 'whatsapp' && (
        <SeccionWhatsApp canales={canales} onRecargar={cargar} />
      )}

      {/* Correo */}
      {seccionActiva === 'correo' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Bandejas de correo
            </h3>
            <Boton variante="primario" tamano="sm" icono={<Plus size={14} />} onClick={() => setModalCanal({ abierto: true, tipo: 'correo' })}>
              Agregar bandeja
            </Boton>
          </div>

          <Alerta tipo="info" titulo="Tipos de conexión">
            Podés conectar correos vía IMAP/SMTP (cualquier proveedor) o Gmail OAuth (conexión directa con Google).
          </Alerta>

          {canalesCorreo.length === 0 ? (
            <EstadoVacio
              icono={<Mail />}
              titulo="Sin bandejas de correo"
              descripcion="Conectá una bandeja de correo compartida (ventas@, info@) o personal."
            />
          ) : (
            <div className="space-y-3">
              {canalesCorreo.map((canal) => (
                <CanalCard key={canal.id} canal={canal} onRecargar={cargar} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interno */}
      {seccionActiva === 'interno' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Mensajería interna
          </h3>
          <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
            Los canales internos se crean y administran directamente desde la pestaña Interno del Inbox.
            Acá podés configurar permisos y notificaciones globales.
          </p>
          <div className="space-y-3">
            <Interruptor
              activo={true}
              onChange={() => {}}
              etiqueta="Permitir que cualquier miembro cree canales públicos"
            />
            <Interruptor
              activo={true}
              onChange={() => {}}
              etiqueta="Permitir mensajes directos entre agentes"
            />
            <Interruptor
              activo={false}
              onChange={() => {}}
              etiqueta="Permitir invitados externos en canales"
            />
          </div>
        </div>
      )}

      {/* Plantillas WhatsApp */}
      {seccionActiva === 'plantillas_wa' && (
        <SeccionPlantillas
          canal="whatsapp"
          plantillas={plantillas.filter(p => p.canal === 'whatsapp' || p.canal === 'todos')}
          onRecargar={cargar}
        />
      )}

      {/* Plantillas Correo */}
      {seccionActiva === 'plantillas_correo' && (
        <SeccionPlantillas
          canal="correo"
          plantillas={plantillas.filter(p => p.canal === 'correo' || p.canal === 'todos')}
          onRecargar={cargar}
        />
      )}

      {/* Asignación */}
      {seccionActiva === 'asignacion' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Reglas de asignación
          </h3>
          <div className="space-y-4">
            <Interruptor
              activo={config?.asignacion_automatica || false}
              onChange={(v) => guardarConfig({ asignacion_automatica: v })}
              etiqueta="Asignación automática de nuevas conversaciones"
            />
            {config?.asignacion_automatica && (
              <Select
                etiqueta="Algoritmo de asignación"
                valor={config?.algoritmo_asignacion || 'round_robin'}
                opciones={[
                  { valor: 'round_robin', etiqueta: 'Round Robin (turno rotativo)' },
                  { valor: 'por_carga', etiqueta: 'Por carga (menos conversaciones abiertas)' },
                ]}
                onChange={(v) => guardarConfig({ algoritmo_asignacion: v as 'round_robin' | 'por_carga' })}
              />
            )}
          </div>
        </div>
      )}

      {/* SLA */}
      {seccionActiva === 'sla' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            SLA y tiempos de respuesta
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              tipo="number"
              etiqueta="Primera respuesta (minutos)"
              defaultValue={String(config?.sla_primera_respuesta_minutos || 60)}
              onBlur={(e) => guardarConfig({ sla_primera_respuesta_minutos: parseInt(e.target.value) || 60 })}
            />
            <Input
              tipo="number"
              etiqueta="Resolución (horas)"
              defaultValue={String(config?.sla_resolucion_horas || 24)}
              onBlur={(e) => guardarConfig({ sla_resolucion_horas: parseInt(e.target.value) || 24 })}
            />
          </div>

          <h3 className="text-sm font-semibold mt-6" style={{ color: 'var(--texto-primario)' }}>
            Respuesta fuera de horario
          </h3>
          <Interruptor
            activo={config?.respuesta_fuera_horario || false}
            onChange={(v) => guardarConfig({ respuesta_fuera_horario: v })}
            etiqueta="Enviar respuesta automática fuera del horario de atención"
          />
          {config?.respuesta_fuera_horario && (
            <Input
              etiqueta="Mensaje automático"
              defaultValue={config?.mensaje_fuera_horario || ''}
              onBlur={(e) => guardarConfig({ mensaje_fuera_horario: e.target.value })}
              placeholder="Gracias por tu mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00."
            />
          )}
        </div>
      )}

      {/* Notificaciones */}
      {seccionActiva === 'notificaciones' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Notificaciones del inbox
          </h3>
          <div className="space-y-3">
            <Interruptor
              activo={config?.notificar_nuevo_mensaje ?? true}
              onChange={(v) => guardarConfig({ notificar_nuevo_mensaje: v })}
              etiqueta="Notificar cuando llega un mensaje nuevo"
            />
            <Interruptor
              activo={config?.notificar_asignacion ?? true}
              onChange={(v) => guardarConfig({ notificar_asignacion: v })}
              etiqueta="Notificar cuando te asignan una conversación"
            />
            <Interruptor
              activo={config?.notificar_sla_vencido ?? true}
              onChange={(v) => guardarConfig({ notificar_sla_vencido: v })}
              etiqueta="Notificar cuando se vence el SLA de una conversación"
            />
            <Interruptor
              activo={config?.sonido_notificacion ?? true}
              onChange={(v) => guardarConfig({ sonido_notificacion: v })}
              etiqueta="Sonido de notificación"
            />
          </div>
        </div>
      )}

      {/* Modal agregar canal */}
      <ModalAgregarCanal
        abierto={modalCanal.abierto}
        onCerrar={() => setModalCanal({ ...modalCanal, abierto: false })}
        tipoCanal={modalCanal.tipo}
        onCanalCreado={cargar}
      />
    </PlantillaConfiguracion>
  )
}

// Toggle de módulo
function ModuloToggle({
  icono, nombre, descripcion, activo, onChange,
}: {
  icono: React.ReactNode
  nombre: string
  descripcion: string
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{ border: '1px solid var(--borde-sutil)' }}
    >
      <div className="flex-shrink-0">{icono}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>{nombre}</p>
        <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{descripcion}</p>
      </div>
      <Interruptor activo={activo} onChange={onChange} />
    </div>
  )
}

// Card visual de canal conectado — muestra todos los datos de la cuenta
function CanalCard({ canal, onRecargar }: { canal: CanalInbox; onRecargar?: () => void }) {
  const [expandido, setExpandido] = useState(false)
  const [cargandoCalidad, setCargandoCalidad] = useState(false)
  type DatosCalidad = { rating: string; tier: string; status: string }
  const calidadInicial = (canal.config_conexion as Record<string, unknown>)?.calidadActual as DatosCalidad | undefined
  const [calidad, setCalidad] = useState<DatosCalidad | null>(calidadInicial || null)

  const conectado = canal.estado_conexion === 'conectado'
  const error = canal.estado_conexion === 'error'
  const config = canal.config_conexion as Record<string, unknown>
  const esWhatsApp = canal.tipo === 'whatsapp'

  // Colores de calidad
  const colorCalidad: Record<string, string> = {
    GREEN: 'exito', YELLOW: 'advertencia', RED: 'peligro',
  }

  const consultarCalidad = async () => {
    setCargandoCalidad(true)
    try {
      const res = await fetch(`/api/inbox/whatsapp/calidad?canal_id=${canal.id}`)
      const data = await res.json()
      if (data.calidad) setCalidad({
        rating: data.calidad.quality_rating,
        tier: data.calidad.messaging_limit_tier,
        status: data.calidad.status,
      })
    } catch { /* silenciar */ }
    setCargandoCalidad(false)
  }

  // Datos a mostrar según proveedor
  const datosVisibles: { etiqueta: string; valor: string; sensible?: boolean }[] = []

  if (esWhatsApp && canal.proveedor === 'meta_api') {
    datosVisibles.push(
      { etiqueta: 'Número', valor: (config.numeroTelefono || config.numero_telefono || '—') as string },
      { etiqueta: 'Phone Number ID', valor: (config.phoneNumberId || config.phone_number_id || '—') as string },
      { etiqueta: 'WABA ID', valor: (config.wabaId || config.waba_id || '—') as string },
      { etiqueta: 'Access Token', valor: (config.tokenAcceso || config.access_token || '') as string, sensible: true },
      { etiqueta: 'Webhook Secret', valor: (config.secretoWebhook || '') as string, sensible: true },
      { etiqueta: 'Webhook Verify Token', valor: (config.tokenVerificacion || '') as string, sensible: true },
    )
  } else if (esWhatsApp && canal.proveedor === 'twilio') {
    datosVisibles.push(
      { etiqueta: 'Número', valor: (config.from_number || '—') as string },
      { etiqueta: 'Account SID', valor: (config.account_sid || '—') as string },
      { etiqueta: 'Auth Token', valor: (config.auth_token || '') as string, sensible: true },
    )
  } else if (canal.proveedor === 'imap') {
    datosVisibles.push(
      { etiqueta: 'Servidor IMAP', valor: `${config.host || '—'}:${config.puerto || '993'}` },
      { etiqueta: 'Usuario', valor: (config.usuario || '—') as string },
      { etiqueta: 'SSL', valor: config.ssl ? 'Sí' : 'No' },
      { etiqueta: 'SMTP', valor: `${config.smtp_host || config.host || '—'}:${config.smtp_puerto || '587'}` },
    )
  } else if (canal.proveedor === 'gmail_oauth') {
    datosVisibles.push(
      { etiqueta: 'Correo', valor: (config.email || '—') as string },
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        border: expandido ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Header — siempre visible */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Icono del canal */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: esWhatsApp ? 'rgba(37, 211, 102, 0.1)' : 'rgba(37, 99, 235, 0.1)',
          }}
        >
          {esWhatsApp ? (
            <MessageCircle size={20} style={{ color: 'var(--canal-whatsapp)' }} />
          ) : (
            <Mail size={20} style={{ color: 'var(--canal-correo)' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {canal.nombre}
            </p>
            <Insignia color={conectado ? 'exito' : error ? 'peligro' : 'neutro'} tamano="sm">
              {conectado ? 'Conectado' : error ? 'Error' : 'Desconectado'}
            </Insignia>
            {calidad && (
              <Insignia color={colorCalidad[calidad.rating] as 'exito' | 'advertencia' | 'peligro'} tamano="sm">
                {calidad.rating}
              </Insignia>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              {canal.proveedor === 'imap' && 'IMAP/SMTP'}
              {canal.proveedor === 'gmail_oauth' && 'Gmail OAuth'}
              {canal.proveedor === 'meta_api' && 'Meta Business API'}
              {canal.proveedor === 'twilio' && 'Twilio'}
            </span>
            {esWhatsApp && (
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                {(config.numeroTelefono || config.numero_telefono || config.from_number || '') as string}
              </span>
            )}
            {!esWhatsApp && (
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                {(config.usuario || config.email || '') as string}
              </span>
            )}
          </div>
          {error && canal.ultimo_error && (
            <p className="text-xxs mt-1" style={{ color: 'var(--insignia-peligro)' }}>
              {canal.ultimo_error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <ChevronDown
            size={16}
            style={{
              color: 'var(--texto-terciario)',
              transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms',
            }}
          />
        </div>
      </button>

      {/* Detalle expandido */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
              {/* Tabla de datos */}
              <div className="pt-3">
                <table className="w-full">
                  <tbody>
                    {datosVisibles.filter(d => d.valor && d.valor !== '—' || !d.sensible).map((dato) => (
                      <tr key={dato.etiqueta}>
                        <td className="py-1.5 pr-4 text-xs font-medium align-top" style={{ color: 'var(--texto-terciario)', width: '40%' }}>
                          {dato.etiqueta}
                        </td>
                        <td className="py-1.5 text-xs align-top" style={{ color: 'var(--texto-primario)' }}>
                          {dato.sensible ? (
                            <span className="font-mono text-xxs px-1.5 py-0.5 rounded" style={{ background: 'var(--superficie-hover)' }}>
                              {dato.valor ? `${dato.valor.substring(0, 8)}${'•'.repeat(20)}` : '—'}
                            </span>
                          ) : (
                            <span className="font-mono text-xxs">{dato.valor}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calidad del número (solo WA) */}
              {esWhatsApp && calidad && (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
                      Calidad del número
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: calidad.rating === 'GREEN' ? 'var(--insignia-exito)'
                              : calidad.rating === 'YELLOW' ? 'var(--insignia-advertencia)'
                              : 'var(--insignia-peligro)',
                          }}
                        />
                        <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
                          {calidad.rating}
                        </span>
                      </div>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        Tier: {calidad.tier}
                      </span>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        Estado: {calidad.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook URL (solo WA Meta) */}
              {esWhatsApp && canal.proveedor === 'meta_api' && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--texto-secundario)' }}>
                    URL del Webhook (configurar en Meta)
                  </p>
                  <code
                    className="text-xxs font-mono block p-2 rounded"
                    style={{
                      background: 'var(--superficie-app)',
                      color: 'var(--texto-marca)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/inbox/whatsapp/webhook` : '/api/inbox/whatsapp/webhook'}
                  </code>
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2">
                {esWhatsApp && (
                  <Boton
                    variante="secundario"
                    tamano="xs"
                    onClick={consultarCalidad}
                    cargando={cargandoCalidad}
                  >
                    Consultar calidad
                  </Boton>
                )}
                <Boton variante="fantasma" tamano="xs" icono={<Pencil size={12} />}>
                  Editar
                </Boton>
                <Boton variante="peligro" tamano="xs" icono={<Trash2 size={12} />}>
                  Eliminar
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Sección de plantillas
function SeccionPlantillas({
  canal,
  plantillas,
  onRecargar,
}: {
  canal: 'whatsapp' | 'correo'
  plantillas: PlantillaRespuesta[]
  onRecargar: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Plantillas de {canal === 'whatsapp' ? 'WhatsApp' : 'correo'}
        </h3>
        <Boton variante="primario" tamano="sm" icono={<Plus size={14} />}>
          Nueva plantilla
        </Boton>
      </div>

      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
        Creá plantillas con variables como {'{{nombre}}'}, {'{{empresa}}'} para respuestas rápidas.
        Podés definir en qué módulos se usan y quién puede acceder a ellas.
      </p>

      {plantillas.length === 0 ? (
        <EstadoVacio
          icono={<FileText />}
          titulo="Sin plantillas"
          descripcion={`Creá tu primera plantilla de ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'} para agilizar respuestas.`}
        />
      ) : (
        <div className="space-y-2">
          {plantillas.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ border: '1px solid var(--borde-sutil)' }}
            >
              <GripVertical size={14} style={{ color: 'var(--texto-terciario)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {p.nombre}
                  </p>
                  {p.categoria && <Insignia color="neutro" tamano="sm">{p.categoria}</Insignia>}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
                  {p.contenido}
                </p>
                {p.modulos.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {p.modulos.map((m) => (
                      <Insignia key={m} color="primario" tamano="sm">{m}</Insignia>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {p.disponible_para === 'roles' && (
                  <Shield size={12} style={{ color: 'var(--texto-terciario)' }} />
                )}
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<Pencil size={12} />} />
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={12} />} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

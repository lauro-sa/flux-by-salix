'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Boton } from '@/componentes/ui/Boton'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Insignia } from '@/componentes/ui/Insignia'
import { Alerta } from '@/componentes/ui/Alerta'
import { Modal } from '@/componentes/ui/Modal'
import { Avatar } from '@/componentes/ui/Avatar'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import {
  Settings2, Mail, Hash, FileText, Users,
  Clock, Bell, Plus, Trash2, Wifi, WifiOff, AlertTriangle,
  Pencil, GripVertical, Shield, ChevronDown, RefreshCw, Loader2,
  Zap, TrendingUp, Tag, Sparkles, Bot, MessageCircle,
} from 'lucide-react'
import type { CanalInbox, PlantillaRespuesta, ConfigInbox, TipoCanal } from '@/tipos/inbox'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ModalAgregarCanal } from '../_componentes/ModalAgregarCanal'
import { SeccionWhatsApp } from '../_componentes/SeccionWhatsApp'
import { ModalEtiquetas } from '../_componentes/ModalEtiquetas'
import { ModalReglas } from '../_componentes/ModalReglas'
import { PanelMetricas } from '../_componentes/PanelMetricas'
import { ListaProgramados } from '../_componentes/ListaProgramados'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useRol } from '@/hooks/useRol'

/**
 * Configuración del Inbox — secciones: General, WhatsApp, Correo, Interno, Plantillas, SLA.
 */

export default function PaginaConfiguracionInbox() {
  const router = useRouter()
  const { tienePermisoConfig } = useRol()
  const puedeConfigEmpresa = tienePermisoConfig('config_empresa', 'ver')
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
    { id: 'whatsapp', etiqueta: 'WhatsApp', icono: <IconoWhatsApp size={16} /> },
    { id: 'correo', etiqueta: 'Correo electrónico', icono: <Mail size={16} /> },
    { id: 'interno', etiqueta: 'Mensajería interna', icono: <Hash size={16} /> },
    { id: 'chatbot', etiqueta: 'Chatbot', icono: <Bot size={16} />, grupo: 'Automatización' },
    { id: 'respuestas_rapidas', etiqueta: 'Respuestas rápidas', icono: <Zap size={16} />, grupo: 'Plantillas' },
    { id: 'plantillas_wa', etiqueta: 'Plantillas Meta (WA)', icono: <FileText size={16} />, grupo: 'Plantillas' },
    { id: 'plantillas_correo', etiqueta: 'Plantillas de correo', icono: <FileText size={16} />, grupo: 'Plantillas' },
    { id: 'etiquetas', etiqueta: 'Etiquetas', icono: <Tag size={16} />, grupo: 'Correo avanzado' },
    { id: 'reglas', etiqueta: 'Reglas automáticas', icono: <Zap size={16} />, grupo: 'Correo avanzado' },
    { id: 'metricas', etiqueta: 'Métricas', icono: <TrendingUp size={16} />, grupo: 'Correo avanzado' },
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
                icono={<IconoWhatsApp size={18} style={{ color: 'var(--canal-whatsapp)' }} />}
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

          {/* IA en el inbox */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--texto-primario)' }}>
              Inteligencia Artificial
            </h3>
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{ border: '1px solid var(--borde-sutil)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)' }}
              >
                <Sparkles size={18} style={{ color: 'var(--texto-marca)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                  Asistente IA en el inbox
                </p>
                <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  Sugerencias de respuesta, resúmenes y análisis de sentimiento en conversaciones.
                </p>
              </div>
              <Interruptor
                activo={config?.ia_habilitada || false}
                onChange={(v) => guardarConfig({ ia_habilitada: v })}
              />
            </div>
            <div
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-lg text-xs"
              style={{
                background: 'color-mix(in srgb, var(--insignia-info) 8%, transparent)',
                color: 'var(--texto-terciario)',
              }}
            >
              <Sparkles size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--insignia-info)' }} />
              <span>
                El proveedor y la API key de IA se configuran desde{' '}
                {puedeConfigEmpresa ? (
                  <a
                    href="/configuracion?seccion=ia"
                    className="font-medium underline underline-offset-2"
                    style={{ color: 'var(--texto-marca)' }}
                  >
                    Configuración de la empresa &gt; IA
                  </a>
                ) : (
                  <strong>Configuración de la empresa &gt; IA</strong>
                )}
                . Este switch solo activa o desactiva el uso de IA dentro del inbox.
                {!puedeConfigEmpresa && (
                  <span className="block mt-1" style={{ color: 'var(--insignia-advertencia)' }}>
                    No tenés permisos para acceder a esa configuración. Pedile a un administrador que configure la API key.
                  </span>
                )}
              </span>
            </div>
            {config?.ia_habilitada && (
              <p className="text-xs mt-2 px-1" style={{ color: 'var(--texto-terciario)' }}>
                Los agentes verán el panel "Asistente IA" en cada conversación para pedir sugerencias, resúmenes y análisis de sentimiento.
              </p>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp — sección completa con stepper, formulario guiado, firma, coexistencia, FAQs */}
      {seccionActiva === 'whatsapp' && (
        <SeccionWhatsApp canales={canales} onRecargar={cargar} />
      )}

      {/* Correo */}
      {seccionActiva === 'correo' && (
        <SeccionCorreo
          canalesCorreo={canalesCorreo}
          config={config}
          onAgregarCanal={() => setModalCanal({ abierto: true, tipo: 'correo' })}
          onRecargar={cargar}
          onGuardarConfig={guardarConfig}
        />
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

      {/* Etiquetas */}
      {seccionActiva === 'etiquetas' && (
        <SeccionEtiquetasConfig />
      )}

      {/* Reglas automáticas */}
      {seccionActiva === 'reglas' && (
        <SeccionReglasConfig />
      )}

      {/* Métricas */}
      {seccionActiva === 'metricas' && (
        <SeccionMetricasConfig />
      )}

      {/* Chatbot */}
      {seccionActiva === 'chatbot' && (
        <SeccionChatbot />
      )}

      {/* Respuestas rápidas */}
      {seccionActiva === 'respuestas_rapidas' && (
        <SeccionRespuestasRapidas
          plantillas={plantillas}
          onRecargar={cargar}
        />
      )}

      {/* Plantillas Meta (WhatsApp) */}
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
  const [modalEliminar, setModalEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [editando, setEditando] = useState(false)
  type DatosCalidad = { rating: string; tier: string; status: string }
  const calidadInicial = (canal.config_conexion as Record<string, unknown>)?.calidadActual as DatosCalidad | undefined
  const [calidad, setCalidad] = useState<DatosCalidad | null>(calidadInicial || null)

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      await fetch(`/api/inbox/canales/${canal.id}`, { method: 'DELETE' })
      setModalEliminar(false)
      onRecargar?.()
    } catch { /* silenciar */ }
    setEliminando(false)
  }

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
            <IconoWhatsApp size={20} style={{ color: 'var(--canal-whatsapp)' }} />
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
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  icono={<Pencil size={12} />}
                  onClick={() => setEditando(true)}
                >
                  Editar
                </Boton>
                <Boton
                  variante="peligro"
                  tamano="xs"
                  icono={<Trash2 size={12} />}
                  onClick={() => setModalEliminar(true)}
                >
                  Eliminar
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal confirmar eliminación */}
      <ModalConfirmacion
        abierto={modalEliminar}
        onCerrar={() => setModalEliminar(false)}
        onConfirmar={handleEliminar}
        titulo={`Eliminar ${canal.nombre}`}
        descripcion={`¿Estás seguro de que querés eliminar la conexión "${canal.nombre}"? Esta acción no se puede deshacer. Se perderán todas las conversaciones y mensajes asociados a este canal.`}
        tipo="peligro"
        etiquetaConfirmar="Sí, eliminar"
        cargando={eliminando}
      />

      {/* Modal editar canal */}
      {editando && (
        <ModalAgregarCanal
          abierto={editando}
          onCerrar={() => setEditando(false)}
          tipoCanal={canal.tipo as TipoCanal}
          onCanalCreado={() => { setEditando(false); onRecargar?.() }}
          canalEditar={{
            id: canal.id,
            nombre: canal.nombre,
            proveedor: canal.proveedor,
            config_conexion: canal.config_conexion as Record<string, unknown>,
          }}
        />
      )}
    </div>
  )
}

// Sección de Etiquetas en config
function SeccionEtiquetasConfig() {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Etiquetas de correo
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
            Organizá conversaciones con etiquetas de color. Se pueden asignar manualmente o vía reglas automáticas.
          </p>
        </div>
      </div>

      <Boton variante="primario" tamano="sm" icono={<Tag size={14} />} onClick={() => setModalAbierto(true)}>
        Gestionar etiquetas
      </Boton>

      <ModalEtiquetas
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      />
    </div>
  )
}

// Sección de Reglas en config
function SeccionReglasConfig() {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Reglas automáticas
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
          Clasificá correos automáticamente según remitente, asunto o contenido. Las reglas se ejecutan al recibir cada correo nuevo.
        </p>
      </div>

      <Boton variante="primario" tamano="sm" icono={<Zap size={14} />} onClick={() => setModalAbierto(true)}>
        Gestionar reglas
      </Boton>

      <ModalReglas
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      />
    </div>
  )
}

// Sección de Métricas en config
function SeccionMetricasConfig() {
  return (
    <div className="space-y-4">
      <PanelMetricas />

      <div className="pt-4" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <ListaProgramados />
      </div>
    </div>
  )
}

// Editor de firma HTML por canal (con autoguardado)
function EditorFirmaCanal({ canal }: { canal: CanalInbox }) {
  const configCanal = canal.config_conexion as Record<string, unknown>
  const firmaActual = (configCanal.firma || '') as string
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const guardarFirma = useCallback((html: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      await fetch(`/api/inbox/canales/${canal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_conexion: { ...configCanal, firma: html },
        }),
      })
    }, 1000)
  }, [canal.id, configCanal])

  return (
    <div className="mb-4">
      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>
        {canal.nombre}
      </label>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--borde-sutil)' }}
      >
        <EditorTexto
          contenido={firmaActual}
          onChange={guardarFirma}
          placeholder="Ej: Juan Pérez — Ventas — Mi Empresa S.A."
          alturaMinima={80}
        />
      </div>
    </div>
  )
}

// Sección de Correo — bandejas, firma, listas permitidos/bloqueados
function SeccionCorreo({
  canalesCorreo,
  config,
  onAgregarCanal,
  onRecargar,
  onGuardarConfig,
}: {
  canalesCorreo: CanalInbox[]
  config: ConfigInbox | null
  onAgregarCanal: () => void
  onRecargar: () => void
  onGuardarConfig: (cambios: Partial<ConfigInbox>) => void
}) {
  const configAny = config as unknown as Record<string, unknown> | null
  const [listaPermitidos, setListaPermitidos] = useState(
    ((configAny?.correo_lista_permitidos as string[]) || []).join('\n')
  )
  const [listaBloqueados, setListaBloqueados] = useState(
    ((configAny?.correo_lista_bloqueados as string[]) || []).join('\n')
  )

  const guardarListas = () => {
    const permitidos = listaPermitidos.split('\n').map(l => l.trim()).filter(Boolean)
    const bloqueados = listaBloqueados.split('\n').map(l => l.trim()).filter(Boolean)
    onGuardarConfig({
      ...config,
      correo_lista_permitidos: permitidos,
      correo_lista_bloqueados: bloqueados,
    } as Partial<ConfigInbox>)
  }

  const [sincronizando, setSincronizando] = useState(false)
  const [resultadoSync, setResultadoSync] = useState<string | null>(null)

  const sincronizarAhora = async () => {
    setSincronizando(true)
    setResultadoSync(null)
    try {
      // Sincronizar cada canal en paralelo (evita timeout)
      const resultados = await Promise.allSettled(
        canalesCorreo.map(canal =>
          fetch('/api/inbox/correo/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canal_id: canal.id }),
          }).then(r => r.json())
        )
      )

      let totalNuevos = 0
      let errores = 0
      for (const r of resultados) {
        if (r.status === 'fulfilled' && r.value.resultados) {
          totalNuevos += r.value.resultados.reduce((s: number, x: { mensajes_nuevos: number }) => s + x.mensajes_nuevos, 0)
        } else {
          errores++
        }
      }

      if (errores > 0) {
        setResultadoSync(`${totalNuevos} correo${totalNuevos !== 1 ? 's' : ''} nuevo${totalNuevos !== 1 ? 's' : ''}. ${errores} canal${errores !== 1 ? 'es' : ''} con error.`)
      } else {
        setResultadoSync(`Sincronización completa. ${totalNuevos} correo${totalNuevos !== 1 ? 's' : ''} nuevo${totalNuevos !== 1 ? 's' : ''}.`)
      }
    } catch {
      setResultadoSync('Error al sincronizar.')
    } finally {
      setSincronizando(false)
      setTimeout(() => setResultadoSync(null), 8000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bandejas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Bandejas de correo
          </h3>
          {canalesCorreo.length > 0 && (
            <Boton
              variante="secundario"
              tamano="xs"
              icono={sincronizando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              onClick={sincronizarAhora}
              disabled={sincronizando}
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Boton>
          )}
        </div>
        <Boton variante="primario" tamano="sm" icono={<Plus size={14} />} onClick={onAgregarCanal}>
          Agregar bandeja
        </Boton>
      </div>

      {resultadoSync && (
        <Alerta tipo={resultadoSync.includes('Error') ? 'peligro' : 'exito'} cerrable onCerrar={() => setResultadoSync(null)}>
          {resultadoSync}
        </Alerta>
      )}

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
            <CanalCard key={canal.id} canal={canal} onRecargar={onRecargar} />
          ))}
        </div>
      )}

      {/* Firma de correo */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
          Firma de correo
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--texto-terciario)' }}>
          Se incluye al final de cada correo enviado. Podés usar HTML básico.
        </p>
        {canalesCorreo.map((canal) => (
          <EditorFirmaCanal key={canal.id} canal={canal} />
        ))}
      </div>

      {/* Listas de permitidos/bloqueados */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
          Filtro anti-spam
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--texto-terciario)' }}>
          Emails o dominios (uno por línea). Los permitidos nunca se marcan como spam. Los bloqueados se auto-clasifican como spam.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--insignia-exito)' }}>
              Permitidos
            </label>
            <textarea
              value={listaPermitidos}
              onChange={(e) => setListaPermitidos(e.target.value)}
              onBlur={guardarListas}
              rows={5}
              className="w-full text-xs rounded-lg p-2.5 resize-none outline-none font-mono"
              style={{
                background: 'var(--superficie-hover)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
              placeholder="cliente@empresa.com&#10;@socio.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--insignia-peligro)' }}>
              Bloqueados
            </label>
            <textarea
              value={listaBloqueados}
              onChange={(e) => setListaBloqueados(e.target.value)}
              onBlur={guardarListas}
              rows={5}
              className="w-full text-xs rounded-lg p-2.5 resize-none outline-none font-mono"
              style={{
                background: 'var(--superficie-hover)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
              placeholder="spam@dominio.com&#10;@marketing-masivo.com"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sección de respuestas rápidas ───
// Son atajos de texto con formato que el agente inserta con `/` en el compositor.
// Separadas de las plantillas de Meta (WhatsApp Business templates).
function SeccionRespuestasRapidas({
  plantillas,
  onRecargar,
}: {
  plantillas: PlantillaRespuesta[]
  onRecargar: () => void
}) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState<PlantillaRespuesta | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Solo las que NO son plantillas de Meta (canal 'todos' o cualquier canal)
  const respuestas = plantillas.filter(p => p.activo)

  const guardar = async (datos: { nombre: string; contenido: string; categoria: string; canal: string }) => {
    setGuardando(true)
    try {
      if (editando) {
        await fetch(`/api/inbox/plantillas/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      } else {
        await fetch('/api/inbox/plantillas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      }
      setModalAbierto(false)
      setEditando(null)
      onRecargar()
    } catch {
      // TODO: toast error
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!eliminando) return
    try {
      await fetch(`/api/inbox/plantillas/${eliminando.id}`, { method: 'DELETE' })
      setEliminando(null)
      onRecargar()
    } catch {
      // TODO: toast error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Respuestas rápidas
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
            Mensajes predefinidos que los agentes pueden insertar escribiendo <code
              className="px-1 py-0.5 rounded text-xxs"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
            >/</code> en el compositor. Soportan formato de texto.
          </p>
        </div>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Plus size={14} />}
          onClick={() => { setEditando(null); setModalAbierto(true) }}
        >
          Nueva respuesta
        </Boton>
      </div>

      {respuestas.length === 0 ? (
        <EstadoVacio
          icono={<Zap />}
          titulo="Sin respuestas rápidas"
          descripcion="Creá respuestas predefinidas para que los agentes respondan más rápido. Pueden incluir formato (negrita, cursiva, listas, etc.)."
        />
      ) : (
        <div className="space-y-2">
          {respuestas.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 p-3 rounded-lg group transition-colors"
              style={{ border: '1px solid var(--borde-sutil)' }}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Zap size={14} style={{ color: 'var(--texto-marca)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {p.nombre}
                  </p>
                  {p.categoria && <Insignia color="neutro" tamano="sm">{p.categoria}</Insignia>}
                  <Insignia
                    color={p.canal === 'todos' ? 'primario' : p.canal === 'whatsapp' ? 'exito' : 'info'}
                    tamano="sm"
                  >
                    {p.canal === 'todos' ? 'Todos' : p.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}
                  </Insignia>
                </div>
                {/* Preview del contenido con formato */}
                {p.contenido_html ? (
                  <div
                    className="text-xs mt-1 line-clamp-2 prose-sm"
                    style={{ color: 'var(--texto-terciario)' }}
                    dangerouslySetInnerHTML={{ __html: p.contenido_html }}
                  />
                ) : (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--texto-terciario)' }}>
                    {p.contenido}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<Pencil size={12} />}
                  onClick={() => { setEditando(p); setModalAbierto(true) }}
                />
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<Trash2 size={12} />}
                  onClick={() => setEliminando(p)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <ModalRespuestaRapida
          plantilla={editando}
          onGuardar={guardar}
          onCerrar={() => { setModalAbierto(false); setEditando(null) }}
          guardando={guardando}
        />
      )}

      {/* Modal confirmar eliminación */}
      {eliminando && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => setEliminando(null)}
          onConfirmar={eliminar}
          titulo="¿Eliminar respuesta rápida?"
          descripcion={`Se eliminará "${eliminando.nombre}". Los agentes ya no podrán usarla.`}
          tipo="peligro"
          etiquetaConfirmar="Eliminar"
        />
      )}
    </div>
  )
}

// ─── Sección Chatbot ───

interface OpcionMenu {
  numero: string
  etiqueta: string
  respuesta: string
}

interface PalabraClave {
  palabras: string[]
  respuesta: string
  exacta: boolean
}

interface ConfigChatbot {
  activo: boolean
  bienvenida_activa: boolean
  mensaje_bienvenida: string
  menu_activo: boolean
  mensaje_menu: string
  opciones_menu: OpcionMenu[]
  palabras_clave: PalabraClave[]
  mensaje_defecto: string
  palabra_transferir: string
  mensaje_transferencia: string
  modo: 'siempre' | 'fuera_horario'
}

const CHATBOT_DEFAULTS: ConfigChatbot = {
  activo: false,
  bienvenida_activa: true,
  mensaje_bienvenida: '¡Hola! 👋 Gracias por comunicarte con nosotros.',
  menu_activo: false,
  mensaje_menu: 'Elegí una opción:\n1️⃣ Información de productos\n2️⃣ Consultar precios\n3️⃣ Horarios de atención\n4️⃣ Hablar con un asesor',
  opciones_menu: [
    { numero: '1', etiqueta: 'Productos', respuesta: 'Te envío información de nuestros productos...' },
    { numero: '2', etiqueta: 'Precios', respuesta: 'Los precios dependen del trabajo. ¿Podrías contarnos qué necesitás?' },
    { numero: '3', etiqueta: 'Horarios', respuesta: 'Nuestro horario de atención es de Lunes a Viernes de 8:00 a 17:00.' },
    { numero: '4', etiqueta: 'Asesor', respuesta: '' },
  ],
  palabras_clave: [],
  mensaje_defecto: 'No entendí tu mensaje. Escribí *menu* para ver las opciones o esperá que un asesor te atienda.',
  palabra_transferir: 'asesor',
  mensaje_transferencia: 'Te estoy derivando con un asesor. En breve te van a atender. 🙏',
  modo: 'siempre',
}

function SeccionChatbot() {
  const [config, setConfig] = useState<ConfigChatbot>(CHATBOT_DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Cargar config
  useEffect(() => {
    fetch('/api/inbox/chatbot')
      .then(r => r.json())
      .then(d => { if (d.config) setConfig({ ...CHATBOT_DEFAULTS, ...d.config }) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // Guardar
  const guardar = async (cambios: Partial<ConfigChatbot>) => {
    const nueva = { ...config, ...cambios }
    setConfig(nueva)
    setGuardando(true)
    try {
      await fetch('/api/inbox/chatbot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
    } catch { /* silenciar */ }
    setGuardando(false)
  }

  // Agregar palabra clave
  const agregarPalabraClave = () => {
    guardar({
      palabras_clave: [...config.palabras_clave, { palabras: [''], respuesta: '', exacta: false }],
    })
  }

  // Actualizar palabra clave
  const actualizarPalabraClave = (indice: number, campo: keyof PalabraClave, valor: unknown) => {
    const nuevas = [...config.palabras_clave]
    nuevas[indice] = { ...nuevas[indice], [campo]: valor }
    guardar({ palabras_clave: nuevas })
  }

  // Eliminar palabra clave
  const eliminarPalabraClave = (indice: number) => {
    guardar({ palabras_clave: config.palabras_clave.filter((_, i) => i !== indice) })
  }

  // Agregar opción de menú
  const agregarOpcionMenu = () => {
    const siguiente = String(config.opciones_menu.length + 1)
    guardar({
      opciones_menu: [...config.opciones_menu, { numero: siguiente, etiqueta: '', respuesta: '' }],
    })
  }

  // Actualizar opción de menú
  const actualizarOpcionMenu = (indice: number, campo: keyof OpcionMenu, valor: string) => {
    const nuevas = [...config.opciones_menu]
    nuevas[indice] = { ...nuevas[indice], [campo]: valor }
    guardar({ opciones_menu: nuevas })
  }

  // Eliminar opción de menú
  const eliminarOpcionMenu = (indice: number) => {
    guardar({ opciones_menu: config.opciones_menu.filter((_, i) => i !== indice) })
  }

  if (cargando) return <div className="py-8 text-center text-sm" style={{ color: 'var(--texto-terciario)' }}>Cargando...</div>

  return (
    <div className="space-y-6">
      {/* Header + toggle principal */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>Chatbot de WhatsApp</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
            Respuestas automáticas para clientes. Sin código.
          </p>
        </div>
        <Interruptor activo={config.activo} onChange={(v) => guardar({ activo: v })} />
      </div>

      {guardando && (
        <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Guardando...</p>
      )}

      <div className={!config.activo ? 'opacity-40 pointer-events-none' : ''}>
        {/* Modo */}
        <div
          className="flex items-center gap-3 p-3 rounded-lg mb-4"
          style={{ border: '1px solid var(--borde-sutil)' }}
        >
          <Bot size={16} style={{ color: 'var(--texto-marca)' }} />
          <div className="flex-1">
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Modo del bot</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {config.modo === 'siempre' ? 'Responde siempre que no haya un agente atendiendo' : 'Solo responde fuera del horario de atención'}
            </p>
          </div>
          <select
            value={config.modo}
            onChange={(e) => guardar({ modo: e.target.value as 'siempre' | 'fuera_horario' })}
            className="text-xs rounded-lg px-2 py-1"
            style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
          >
            <option value="siempre">Siempre activo</option>
            <option value="fuera_horario">Solo fuera de horario</option>
          </select>
        </div>

        {/* ─── Bienvenida ─── */}
        <div className="p-4 rounded-lg space-y-3 mb-4" style={{ border: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} style={{ color: 'var(--canal-whatsapp)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Mensaje de bienvenida</span>
            </div>
            <Interruptor activo={config.bienvenida_activa} onChange={(v) => guardar({ bienvenida_activa: v })} />
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Se envía automáticamente cuando un número nuevo escribe por primera vez.
          </p>
          {config.bienvenida_activa && (
            <textarea
              value={config.mensaje_bienvenida}
              onChange={(e) => guardar({ mensaje_bienvenida: e.target.value })}
              className="w-full rounded-lg p-2.5 text-sm resize-none outline-none"
              style={{ background: 'var(--superficie-app)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', minHeight: 80 }}
              placeholder="¡Hola! 👋 Gracias por comunicarte..."
            />
          )}
        </div>

        {/* ─── Menú principal ─── */}
        <div className="p-4 rounded-lg space-y-3 mb-4" style={{ border: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Menú de opciones</span>
            </div>
            <Interruptor activo={config.menu_activo} onChange={(v) => guardar({ menu_activo: v })} />
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            El cliente escribe un número y recibe la respuesta configurada. Se muestra después de la bienvenida o cuando escribe "menu".
          </p>

          {config.menu_activo && (
            <>
              <textarea
                value={config.mensaje_menu}
                onChange={(e) => guardar({ mensaje_menu: e.target.value })}
                className="w-full rounded-lg p-2.5 text-sm resize-none outline-none"
                style={{ background: 'var(--superficie-app)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', minHeight: 80 }}
                placeholder="Elegí una opción:&#10;1️⃣ Productos&#10;2️⃣ Precios..."
              />

              <p className="text-xxs font-medium mt-3" style={{ color: 'var(--texto-secundario)' }}>Opciones</p>
              <div className="space-y-2">
                {config.opciones_menu.map((op, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--superficie-hover)' }}>
                    <span className="text-sm font-bold mt-1 w-6 text-center" style={{ color: 'var(--texto-marca)' }}>
                      {op.numero}
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={op.etiqueta}
                        onChange={(e) => actualizarOpcionMenu(i, 'etiqueta', e.target.value)}
                        className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded"
                        style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
                        placeholder="Nombre de la opción"
                      />
                      <textarea
                        value={op.respuesta}
                        onChange={(e) => actualizarOpcionMenu(i, 'respuesta', e.target.value)}
                        className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded resize-none"
                        style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', minHeight: 50 }}
                        placeholder={op.numero === config.palabra_transferir ? '(Transfiere a agente)' : 'Respuesta automática...'}
                      />
                    </div>
                    <button onClick={() => eliminarOpcionMenu(i)} className="p-1 mt-1" style={{ color: 'var(--texto-terciario)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarOpcionMenu}>
                Agregar opción
              </Boton>
            </>
          )}
        </div>

        {/* ─── Palabras clave ─── */}
        <div className="p-4 rounded-lg space-y-3 mb-4" style={{ border: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🔑</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Respuestas por palabra clave</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Si el mensaje del cliente contiene alguna de estas palabras, el bot responde automáticamente.
          </p>

          <div className="space-y-2">
            {config.palabras_clave.map((pc, i) => (
              <div key={i} className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'var(--superficie-hover)' }}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pc.palabras.join(', ')}
                    onChange={(e) => actualizarPalabraClave(i, 'palabras', e.target.value.split(',').map(p => p.trim().toLowerCase()).filter(Boolean))}
                    className="flex-1 text-xs bg-transparent outline-none px-2 py-1 rounded"
                    style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
                    placeholder="Palabras separadas por coma: precio, costo, cuanto"
                  />
                  <button onClick={() => eliminarPalabraClave(i)} className="p-1" style={{ color: 'var(--texto-terciario)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <textarea
                  value={pc.respuesta}
                  onChange={(e) => actualizarPalabraClave(i, 'respuesta', e.target.value)}
                  className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded resize-none"
                  style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', minHeight: 50 }}
                  placeholder="Respuesta automática cuando detecta estas palabras..."
                />
              </div>
            ))}
          </div>
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarPalabraClave}>
            Agregar palabra clave
          </Boton>
        </div>

        {/* ─── Mensaje por defecto ─── */}
        <div className="p-4 rounded-lg space-y-3 mb-4" style={{ border: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">❓</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Mensaje por defecto</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Se envía cuando el bot no entiende el mensaje del cliente.
          </p>
          <textarea
            value={config.mensaje_defecto}
            onChange={(e) => guardar({ mensaje_defecto: e.target.value })}
            className="w-full rounded-lg p-2.5 text-sm resize-none outline-none"
            style={{ background: 'var(--superficie-app)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', minHeight: 60 }}
          />
        </div>

        {/* ─── Transferencia a agente ─── */}
        <div className="p-4 rounded-lg space-y-3" style={{ border: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🙋</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Transferir a agente</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Cuando el cliente escribe esta palabra, el bot deja de responder y un agente toma la conversación.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xxs mb-1 block" style={{ color: 'var(--texto-terciario)' }}>Palabra clave</label>
              <input
                type="text"
                value={config.palabra_transferir}
                onChange={(e) => guardar({ palabra_transferir: e.target.value.toLowerCase() })}
                className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded"
                style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
              />
            </div>
            <div>
              <label className="text-xxs mb-1 block" style={{ color: 'var(--texto-terciario)' }}>Mensaje al transferir</label>
              <input
                type="text"
                value={config.mensaje_transferencia}
                onChange={(e) => guardar({ mensaje_transferencia: e.target.value })}
                className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded"
                style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Convertir formato WhatsApp (*negrita*, _cursiva_, ~tachado~) a HTML para preview
function formatoWhatsAppAHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code>$1</code>')
    .replace(/\n/g, '<br />')
}

// Modal para crear/editar respuesta rápida — textarea con preview estilo WhatsApp
function ModalRespuestaRapida({
  plantilla,
  onGuardar,
  onCerrar,
  guardando,
}: {
  plantilla: PlantillaRespuesta | null
  onGuardar: (datos: { nombre: string; contenido: string; contenido_html: string; categoria: string; canal: string }) => void
  onCerrar: () => void
  guardando: boolean
}) {
  const [nombre, setNombre] = useState(plantilla?.nombre || '')
  const [categoria, setCategoria] = useState(plantilla?.categoria || '')
  const [canal, setCanal] = useState(plantilla?.canal || 'todos')
  const [contenido, setContenido] = useState(plantilla?.contenido || '')

  const manejarGuardar = () => {
    if (!nombre.trim() || !contenido.trim()) return
    onGuardar({
      nombre: nombre.trim(),
      contenido: contenido,
      contenido_html: formatoWhatsAppAHtml(contenido),
      categoria: categoria.trim(),
      canal,
    })
  }

  return (
    <Modal
      abierto={true}
      onCerrar={onCerrar}
      titulo={plantilla ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}
      tamano="3xl"
      acciones={
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            tamano="sm"
            onClick={manejarGuardar}
            disabled={guardando || !nombre.trim() || !contenido.trim()}
          >
            {guardando ? 'Guardando...' : plantilla ? 'Guardar cambios' : 'Crear respuesta'}
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Nombre */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
            Nombre (para buscar con /)
          </label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Presupuesto enviado, Saludo inicial, Horarios..."
            compacto
            formato={null}
          />
        </div>

        {/* Categoría + Canal */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
              Categoría (opcional)
            </label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: Ventas, Soporte, Info..."
              compacto
              formato={null}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
              Disponible en
            </label>
            <Select
              valor={canal}
              onChange={(v: string) => setCanal(v as 'correo' | 'whatsapp' | 'interno' | 'todos')}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos los canales' },
                { valor: 'whatsapp', etiqueta: 'Solo WhatsApp' },
                { valor: 'correo', etiqueta: 'Solo Correo' },
              ]}
            />
          </div>
        </div>

        {/* Textarea + Preview lado a lado */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
            Mensaje
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Textarea — pegá o escribí el mensaje */}
            <div>
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder={'Pegá o escribí tu mensaje acá...\n\nFormato WhatsApp:\n*negrita*  _cursiva_  ~tachado~'}
                className="w-full rounded-lg p-3 text-sm resize-none outline-none"
                style={{
                  background: 'var(--superficie-app)',
                  color: 'var(--texto-primario)',
                  border: '1px solid var(--borde-sutil)',
                  minHeight: 220,
                  fontFamily: 'inherit',
                }}
                spellCheck={false}
              />
              <p className="text-xxs mt-1.5" style={{ color: 'var(--texto-terciario)' }}>
                Emojis, saltos de línea y formato WhatsApp se conservan al enviar.
              </p>
            </div>

            {/* Preview estilo WhatsApp */}
            <div>
              <div
                className="rounded-lg p-3 text-sm overflow-y-auto"
                style={{
                  background: 'var(--superficie-hover)',
                  border: '1px solid var(--borde-sutil)',
                  minHeight: 220,
                  maxHeight: 300,
                }}
              >
                {contenido ? (
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--texto-primario)' }}
                    dangerouslySetInnerHTML={{ __html: formatoWhatsAppAHtml(contenido) }}
                  />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    Vista previa del mensaje...
                  </p>
                )}
              </div>
              <p className="text-xxs mt-1.5" style={{ color: 'var(--texto-terciario)' }}>
                Así se verá en WhatsApp
              </p>
            </div>
          </div>

          {/* Referencia rápida de formato */}
          <div
            className="flex items-center gap-4 mt-2 px-2 py-1.5 rounded text-xxs"
            style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
          >
            <span><strong>*negrita*</strong></span>
            <span><em>_cursiva_</em></span>
            <span><del>~tachado~</del></span>
            <span><code>{'```código```'}</code></span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Sección de plantillas (Meta WhatsApp / Correo)
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

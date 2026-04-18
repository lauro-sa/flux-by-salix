'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/componentes/feedback/Toast'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import SeccionAgenteIA from '@/componentes/mensajeria/SeccionAgenteIA'
import {
  Settings2, FileText, Users,
  Clock, Bell, Sparkles, Bot, KanbanSquare,
  Zap,
} from 'lucide-react'
import type { CanalMensajeria, ConfigMensajeria } from '@/tipos/inbox'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ModalAgregarCanal } from '@/componentes/mensajeria/ModalAgregarCanal'
import { SeccionWhatsApp } from '@/app/(flux)/whatsapp/_componentes/SeccionWhatsApp'
import { SeccionChatbot } from '@/app/(flux)/inbox/configuracion/_componentes/SeccionChatbot'
import {
  SeccionPipeline,
  SeccionEtiquetasConfig,
} from '@/app/(flux)/inbox/configuracion/_componentes/SeccionesSimples'
import { useRol } from '@/hooks/useRol'
import { useTraduccion } from '@/lib/i18n'

/**
 * Configuración de WhatsApp — sección independiente.
 * Incluye: canales WA, plantillas Meta, chatbot, agente IA,
 * pipeline, respuestas rápidas, asignación, SLA y notificaciones.
 */

export default function PaginaConfiguracionWhatsApp() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { t } = useTraduccion()
  const { tienePermisoConfig } = useRol()
  const puedeConfigEmpresa = tienePermisoConfig('config_empresa', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('canales')
  const [cargando, setCargando] = useState(true)

  // Modal agregar canal
  const [modalCanal, setModalCanal] = useState(false)

  // Datos
  const [config, setConfig] = useState<ConfigMensajeria | null>(null)
  const [canales, setCanales] = useState<CanalMensajeria[]>([])

  // Cargar configuración
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resConfig, resCanales] = await Promise.all([
        fetch('/api/whatsapp/config'),
        fetch('/api/whatsapp/canales'),
      ])
      const [dataConfig, dataCanales] = await Promise.all([
        resConfig.json(),
        resCanales.json(),
      ])

      setConfig(dataConfig.config)
      setCanales(dataCanales.canales || [])
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Guardar config
  const guardarConfig = useCallback(async (cambios: Partial<ConfigMensajeria>) => {
    try {
      await fetch('/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      setConfig(prev => prev ? { ...prev, ...cambios } : null)
    } catch {
      mostrar('error', 'Error al guardar la configuración')
    }
  }, [mostrar])

  const secciones: SeccionConfig[] = [
    { id: 'canales', etiqueta: 'Canales WhatsApp', icono: <IconoWhatsApp size={16} /> },
    { id: 'pipeline', etiqueta: 'Pipeline / Etapas', icono: <KanbanSquare size={16} /> },
    { id: 'chatbot', etiqueta: 'Chatbot', icono: <Bot size={16} />, grupo: 'Automatización' },
    { id: 'agente_ia', etiqueta: 'Agente IA', icono: <Sparkles size={16} />, grupo: 'Automatización' },
    { id: 'respuestas_rapidas', etiqueta: 'Respuestas rápidas', icono: <Zap size={16} />, grupo: 'Plantillas' },
    { id: 'plantillas_wa', etiqueta: 'Plantillas Meta', icono: <FileText size={16} />, grupo: 'Plantillas' },
    { id: 'etiquetas', etiqueta: 'Etiquetas', icono: <Settings2 size={16} />, grupo: 'Avanzado' },
    { id: 'asignacion', etiqueta: 'Asignación', icono: <Users size={16} />, grupo: 'Avanzado' },
    { id: 'sla', etiqueta: 'SLA', icono: <Clock size={16} />, grupo: 'Avanzado' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, grupo: 'Avanzado' },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de WhatsApp"
      descripcion="Canales, plantillas Meta, chatbot, automatización y reglas de WhatsApp."
      iconoHeader={<IconoWhatsApp size={22} />}
      volverTexto="WhatsApp"
      onVolver={() => router.push('/whatsapp')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={(id) => {
        if (id === 'respuestas_rapidas') {
          router.push('/whatsapp/configuracion/respuestas-rapidas')
          return
        }
        if (id === 'plantillas_wa') {
          router.push('/whatsapp/configuracion/plantillas-meta')
          return
        }
        setSeccionActiva(id)
      }}
    >
      {/* Canales WhatsApp */}
      {seccionActiva === 'canales' && (
        <SeccionWhatsApp canales={canales} onRecargar={cargar} />
      )}

      {/* Pipeline / Etapas — solo WhatsApp */}
      {seccionActiva === 'pipeline' && (
        <SeccionPipeline canales={['whatsapp']} />
      )}

      {/* Chatbot */}
      {seccionActiva === 'chatbot' && (
        <SeccionChatbot />
      )}

      {/* Agente IA */}
      {seccionActiva === 'agente_ia' && (
        <SeccionAgenteIA />
      )}

      {/* Etiquetas */}
      {seccionActiva === 'etiquetas' && (
        <SeccionEtiquetasConfig />
      )}

      {/* Asignación */}
      {seccionActiva === 'asignacion' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Asignación automática
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
            SLA (Acuerdos de Nivel de Servicio)
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
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Notificaciones
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Configurá qué notificaciones recibís en WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { campo: 'notificar_nuevo_mensaje', etiqueta: 'Mensaje nuevo', desc: 'Cuando llega un mensaje de un cliente' },
              { campo: 'notificar_asignacion', etiqueta: 'Asignación', desc: 'Cuando te asignan una conversación' },
              { campo: 'notificar_sla_vencido', etiqueta: 'SLA vencido', desc: 'Cuando se vence el tiempo de respuesta' },
              { campo: 'sonido_notificacion', etiqueta: 'Sonido', desc: 'Reproducir sonido con cada notificación' },
            ].map(n => (
              <div
                key={n.campo}
                className="flex items-center justify-between gap-3 p-3 rounded-card"
                style={{ border: '1px solid var(--borde-sutil)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{n.etiqueta}</p>
                  <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{n.desc}</p>
                </div>
                <Interruptor
                  activo={(config as unknown as Record<string, boolean>)?.[n.campo] ?? true}
                  onChange={(v) => guardarConfig({ [n.campo]: v })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal agregar canal */}
      <ModalAgregarCanal
        abierto={modalCanal}
        onCerrar={() => setModalCanal(false)}
        tipoCanal="whatsapp"
        onCanalCreado={cargar}
      />
    </PlantillaConfiguracion>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/componentes/feedback/Toast'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import SeccionAgenteIA from '@/app/(flux)/inbox/_componentes/SeccionAgenteIA'
import {
  Settings2, Mail, Hash, FileText, Users,
  Clock, Bell, Sparkles, Bot, MessageCircle, KanbanSquare,
  Zap, TrendingUp, Tag,
} from 'lucide-react'
import type { CanalInbox, PlantillaRespuesta, ConfigInbox, TipoCanal } from '@/tipos/inbox'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ModalAgregarCanal } from '../_componentes/ModalAgregarCanal'
import { SeccionWhatsApp } from '../_componentes/SeccionWhatsApp'
import { SeccionPlantillasWA } from '../_componentes/SeccionPlantillasWA'
import { useRol } from '@/hooks/useRol'
import { useTraduccion } from '@/lib/i18n'

// Sub-componentes extraídos
import { ModuloToggle } from './_componentes/ModuloToggle'
import { SeccionCorreo } from './_componentes/SeccionCorreo'
import { SeccionChatbot } from './_componentes/SeccionChatbot'
import { SeccionRespuestasRapidas } from './_componentes/SeccionRespuestasRapidas'
import { SeccionPlantillasCorreo } from './_componentes/SeccionPlantillasCorreo'
import {
  SeccionPipeline,
  SeccionEtiquetasConfig,
  SeccionReglasConfig,
  SeccionMetricasConfig,
} from './_componentes/SeccionesSimples'

/**
 * Configuración del Inbox — orquestador principal.
 * Secciones: General, WhatsApp, Correo, Interno, Plantillas, SLA, etc.
 * Cada sección se renderiza desde un sub-componente en _componentes/.
 */

export default function PaginaConfiguracionInbox() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { t } = useTraduccion()
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
  const [modulos, setModulos] = useState<Record<string, boolean>>({
    inbox_whatsapp: true,
    inbox_correo: true,
    inbox_interno: true,
  })

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

      // Cargar estado de módulos
      if (dataConfig.modulos) {
        const map: Record<string, boolean> = {}
        for (const m of dataConfig.modulos) {
          map[m.modulo] = m.activo
        }
        setModulos(prev => ({ ...prev, ...map }))
      }
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [])

  // Toggle módulo activo/inactivo
  const toggleModulo = useCallback(async (modulo: string, activo: boolean) => {
    setModulos(prev => ({ ...prev, [modulo]: activo }))
    try {
      await fetch('/api/inbox/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo, activo }),
      })
    } catch {
      // Revertir
      setModulos(prev => ({ ...prev, [modulo]: !activo }))
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
      mostrar('error', 'Error al guardar la configuración')
    }
  }, [])

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: t('inbox.config.general'), icono: <Settings2 size={16} /> },
    { id: 'whatsapp', etiqueta: t('inbox.canales.whatsapp'), icono: <IconoWhatsApp size={16} /> },
    { id: 'correo', etiqueta: t('inbox.config.correo'), icono: <Mail size={16} /> },
    { id: 'interno', etiqueta: t('inbox.config.interno'), icono: <Hash size={16} /> },
    { id: 'pipeline', etiqueta: 'Pipeline / Etapas', icono: <KanbanSquare size={16} /> },
    { id: 'chatbot', etiqueta: 'Chatbot', icono: <Bot size={16} />, grupo: 'Automatización' },
    { id: 'agente_ia', etiqueta: 'Agente IA', icono: <Sparkles size={16} />, grupo: 'Automatización' },
    { id: 'respuestas_rapidas', etiqueta: 'Respuestas rápidas', icono: <Zap size={16} />, grupo: t('inbox.plantillas') },
    { id: 'plantillas_wa', etiqueta: t('inbox.config.plantillas_whatsapp'), icono: <FileText size={16} />, grupo: t('inbox.plantillas') },
    { id: 'plantillas_correo', etiqueta: t('inbox.config.plantillas_correo'), icono: <FileText size={16} />, grupo: t('inbox.plantillas') },
    { id: 'etiquetas', etiqueta: t('inbox.etiquetar'), icono: <Tag size={16} />, grupo: 'Correo avanzado' },
    { id: 'reglas', etiqueta: 'Reglas automáticas', icono: <Zap size={16} />, grupo: 'Correo avanzado' },
    { id: 'metricas', etiqueta: 'Métricas', icono: <TrendingUp size={16} />, grupo: 'Correo avanzado' },
    { id: 'asignacion', etiqueta: t('inbox.config.asignacion'), icono: <Users size={16} />, grupo: 'Avanzado' },
    { id: 'sla', etiqueta: t('inbox.config.sla'), icono: <Clock size={16} />, grupo: 'Avanzado' },
    { id: 'notificaciones', etiqueta: t('inbox.config.notificaciones'), icono: <Bell size={16} />, grupo: 'Avanzado' },
  ]

  const canalesWhatsApp = canales.filter(c => c.tipo === 'whatsapp')
  const canalesCorreo = canales.filter(c => c.tipo === 'correo')

  return (
    <PlantillaConfiguracion
      titulo={t('inbox.config.titulo')}
      descripcion="Canales de comunicación, plantillas, automatización y reglas de tu bandeja de entrada."
      iconoHeader={<MessageCircle size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto={t('inbox.titulo')}
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
                nombre={t('inbox.canales.whatsapp')}
                descripcion="Chat en tiempo real con clientes vía WhatsApp Business"
                activo={modulos.inbox_whatsapp}
                onChange={(v) => toggleModulo('inbox_whatsapp', v)}
              />
              <ModuloToggle
                icono={<Mail size={18} style={{ color: 'var(--canal-correo)' }} />}
                nombre={t('inbox.config.correo')}
                descripcion="Bandejas compartidas y personales con soporte IMAP/Gmail"
                activo={modulos.inbox_correo}
                onChange={(v) => toggleModulo('inbox_correo', v)}
              />
              <ModuloToggle
                icono={<Hash size={18} style={{ color: 'var(--canal-interno)' }} />}
                nombre={t('inbox.config.interno')}
                descripcion="Canales y mensajes directos entre agentes"
                activo={modulos.inbox_interno}
                onChange={(v) => toggleModulo('inbox_interno', v)}
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

      {/* WhatsApp */}
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
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {t('inbox.config.interno')}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Los canales internos se crean y administran directamente desde la pestaña Interno del Inbox.
              Acá podés configurar permisos y notificaciones globales.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { campo: 'permitir_canales_publicos', etiqueta: 'Canales públicos', desc: 'Permitir que cualquier miembro cree canales públicos' },
              { campo: 'permitir_mensajes_directos', etiqueta: 'Mensajes directos', desc: 'Permitir mensajes directos entre agentes' },
              { campo: 'permitir_invitados_externos', etiqueta: 'Invitados externos', desc: 'Permitir invitados externos en canales' },
            ].map(n => (
              <div
                key={n.campo}
                className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ border: '1px solid var(--borde-sutil)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{n.etiqueta}</p>
                  <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{n.desc}</p>
                </div>
                <Interruptor
                  activo={(config as unknown as Record<string, boolean>)?.[n.campo] ?? n.campo !== 'permitir_invitados_externos'}
                  onChange={(v) => guardarConfig({ [n.campo]: v })}
                />
              </div>
            ))}
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

      {/* Pipeline / Etapas */}
      {seccionActiva === 'pipeline' && (
        <SeccionPipeline />
      )}

      {/* Chatbot */}
      {seccionActiva === 'chatbot' && (
        <SeccionChatbot />
      )}

      {/* Agente IA */}
      {seccionActiva === 'agente_ia' && (
        <SeccionAgenteIA />
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
        <SeccionPlantillasWA
          canalesWhatsApp={canalesWhatsApp}
          onRecargar={cargar}
        />
      )}

      {/* Plantillas Correo */}
      {seccionActiva === 'plantillas_correo' && (
        <SeccionPlantillasCorreo
          canal="correo"
          plantillas={plantillas.filter(p => p.canal === 'correo' || p.canal === 'todos')}
          onRecargar={cargar}
        />
      )}

      {/* Asignación */}
      {seccionActiva === 'asignacion' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            {t('inbox.config.asignacion')}
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
            {t('inbox.config.sla')}
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
              {t('inbox.config.notificaciones')}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Configurá qué notificaciones recibís cuando trabajás en el inbox.
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
                className="flex items-center justify-between gap-3 p-3 rounded-xl"
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
        abierto={modalCanal.abierto}
        onCerrar={() => setModalCanal({ ...modalCanal, abierto: false })}
        tipoCanal={modalCanal.tipo}
        onCanalCreado={cargar}
      />
    </PlantillaConfiguracion>
  )
}

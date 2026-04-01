'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Brain, MessageSquare, BookOpen, AlertTriangle, Activity, Plus, Pencil, Trash2, X, Maximize2, Globe, FileUp, Loader2, Building2, GitBranch, ChevronUp, ChevronDown } from 'lucide-react'
import { Interruptor, Select, Input, Boton, Modal, Insignia } from '@/componentes/ui'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import type { ConfigAgenteIA, EntradaBaseConocimiento, LogAgenteIA, TipoContactoConfig, PasoFlujoConfig, EjemploConversacionConfig } from '@/tipos/inbox'

/**
 * SeccionAgenteIA — UI de configuración del Agente IA dentro de inbox/configuracion.
 * Se usa en: configuracion/page.tsx cuando seccionActiva === 'agente_ia'.
 * Tabs: General, Capacidades, Respuestas, Conocimiento, Escalamiento, Actividad.
 */

// ─── Defaults ───

const CONFIG_DEFAULTS: ConfigAgenteIA = {
  id: '',
  empresa_id: '',
  activo: false,
  nombre: 'Asistente Flux',
  apodo: '',
  personalidad: '',
  instrucciones: '',
  idioma: 'es',
  canales_activos: [],
  modo_activacion: 'despues_chatbot',
  delay_segundos: 0,
  max_mensajes_auto: 5,
  puede_responder: true,
  puede_clasificar: true,
  puede_enrutar: false,
  puede_resumir: true,
  puede_sentimiento: true,
  puede_crear_actividad: false,
  puede_actualizar_contacto: false,
  puede_etiquetar: true,
  modo_respuesta: 'sugerir',
  tono: 'profesional',
  largo_respuesta: 'medio',
  firmar_como: '',
  usar_base_conocimiento: false,
  escalar_si_negativo: true,
  escalar_si_no_sabe: true,
  escalar_palabras: ['hablar con persona', 'agente', 'humano', 'gerente'],
  mensaje_escalamiento: 'Te voy a comunicar con un agente. Un momento por favor.',
  acciones_habilitadas: [],
  total_mensajes_enviados: 0,
  total_escalamientos: 0,
  zona_cobertura: '',
  sitio_web: '',
  horario_atencion: '',
  correo_empresa: '',
  servicios_si: '',
  servicios_no: '',
  tipos_contacto: [],
  flujo_conversacion: [],
  reglas_agenda: '',
  info_precios: '',
  situaciones_especiales: '',
  ejemplos_conversacion: [],
  respuesta_si_bot: '',
  vocabulario_natural: '',
  ultimo_analisis_conversaciones: null,
  total_conversaciones_analizadas: 0,
}

// ─── Tabs ───

const TABS = [
  { id: 'general', etiqueta: 'General', icono: <Sparkles size={14} /> },
  { id: 'negocio', etiqueta: 'Negocio', icono: <Building2 size={14} /> },
  { id: 'flujo', etiqueta: 'Flujo', icono: <GitBranch size={14} /> },
  { id: 'capacidades', etiqueta: 'Capacidades', icono: <Brain size={14} /> },
  { id: 'respuestas', etiqueta: 'Respuestas', icono: <MessageSquare size={14} /> },
  { id: 'conocimiento', etiqueta: 'Conocimiento', icono: <BookOpen size={14} /> },
  { id: 'escalamiento', etiqueta: 'Escalamiento', icono: <AlertTriangle size={14} /> },
  { id: 'actividad', etiqueta: 'Actividad', icono: <Activity size={14} /> },
]

// ─── Componente principal ───

// ─── Canal simple para el selector ───
interface CanalSimple {
  id: string
  nombre: string
  tipo: string
}

export default function SeccionAgenteIA() {
  const { t } = useTraduccion()
  const { mostrar: mostrarToast } = useToast()
  const [config, setConfig] = useState<ConfigAgenteIA>(CONFIG_DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [tabActiva, setTabActiva] = useState('general')
  const [canales, setCanales] = useState<CanalSimple[]>([])

  // Cargar config + canales
  useEffect(() => {
    Promise.all([
      fetch('/api/inbox/agente-ia/config').then(r => r.json()),
      fetch('/api/inbox/canales').then(r => r.json()).catch(() => ({ canales: [] })),
    ])
      .then(([configData, canalesData]) => {
        if (configData.config) setConfig({ ...CONFIG_DEFAULTS, ...configData.config })
        setCanales((canalesData.canales || []).map((c: { id: string; nombre: string; tipo: string }) => ({
          id: c.id, nombre: c.nombre, tipo: c.tipo,
        })))
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // Guardar al servidor — envía PUT con debounce para texto
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configRef = useRef<ConfigAgenteIA>(config)

  // Mantener ref sincronizada con el estado
  useEffect(() => { configRef.current = config }, [config])

  const enviarAlServidor = useCallback(async (datos: ConfigAgenteIA) => {
    try {
      const res = await fetch('/api/inbox/agente-ia/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) {
        console.error('[AGENTE_IA] Error guardando config:', res.status)
        mostrarToast('error', 'Error al guardar configuración del agente')
      }
    } catch {
      mostrarToast('error', 'Error de red al guardar configuración')
    }
  }, [])

  const guardar = useCallback((cambios: Partial<ConfigAgenteIA>) => {
    setConfig(prev => {
      const nueva = { ...prev, ...cambios }
      configRef.current = nueva
      return nueva
    })

    // Debounce: esperar 500ms antes de enviar (acumula cambios rápidos como tipeo)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      enviarAlServidor(configRef.current)
    }, 500)
  }, [enviarAlServidor])

  // Flush al desmontar (guardar cambios pendientes)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        enviarAlServidor(configRef.current)
      }
    }
  }, [enviarAlServidor])

  if (cargando) {
    return <div className="py-8 text-center text-sm" style={{ color: 'var(--texto-terciario)' }}>Cargando...</div>
  }

  const estiloSeccion = { border: '1px solid var(--borde-sutil)' }

  return (
    <div className="space-y-5">
      {/* ═══ Header + toggle ═══ */}
      <div className="flex items-center justify-between p-4 rounded-xl" style={estiloSeccion}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)' }}
          >
            <Sparkles size={20} style={{ color: 'var(--texto-marca)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--texto-primario)' }}>
              Agente IA
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-texto-marca/10 text-texto-marca">
                <Sparkles size={10} />
                Salix IA
              </span>
              {config.activo && (
                <span
                  className="ml-2 text-xxs font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--insignia-exito) 15%, transparent)', color: 'var(--insignia-exito)' }}
                >
                  activo
                </span>
              )}
            </h3>
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Inteligencia artificial que clasifica, responde y actúa automáticamente.
            </p>
          </div>
        </div>
        <Interruptor activo={config.activo} onChange={(v) => guardar({ activo: v })} />
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: tabActiva === tab.id ? 'var(--superficie-hover)' : 'transparent',
              color: tabActiva === tab.id ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            }}
          >
            {tab.icono}
            {tab.etiqueta}
          </button>
        ))}
      </div>

      {/* ═══ Contenido deshabilitado si inactivo ═══ */}
      <div className={`space-y-4 ${!config.activo ? 'opacity-40 pointer-events-none' : ''}`}>
        {tabActiva === 'general' && <TabGeneral config={config} guardar={guardar} canales={canales} />}
        {tabActiva === 'negocio' && <TabNegocio config={config} guardar={guardar} />}
        {tabActiva === 'flujo' && <TabFlujo config={config} guardar={guardar} />}
        {tabActiva === 'capacidades' && <TabCapacidades config={config} guardar={guardar} />}
        {tabActiva === 'respuestas' && <TabRespuestas config={config} guardar={guardar} />}
        {tabActiva === 'conocimiento' && <TabConocimiento config={config} guardar={guardar} />}
        {tabActiva === 'escalamiento' && <TabEscalamiento config={config} guardar={guardar} />}
        {tabActiva === 'actividad' && <TabActividad />}
      </div>
    </div>
  )
}

// ─── Props compartidas ───

interface TabProps {
  config: ConfigAgenteIA
  guardar: (cambios: Partial<ConfigAgenteIA>) => void
}

const estiloSeccion = { border: '1px solid var(--borde-sutil)' }

// ─── Textarea expandible: preview + modal grande ───

function TextareaExpandible({ etiqueta, valor, onChange, placeholder, lineasPreview = 3 }: {
  etiqueta: string
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  lineasPreview?: number
}) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [valorLocal, setValorLocal] = useState(valor)

  // Sincronizar cuando cambia desde afuera
  useEffect(() => { setValorLocal(valor) }, [valor])

  const guardarYCerrar = () => {
    onChange(valorLocal)
    setModalAbierto(false)
  }

  // Preview: primeras N líneas truncadas
  const lineas = valor.split('\n')
  const preview = lineas.slice(0, lineasPreview).join('\n')
  const tieneMore = lineas.length > lineasPreview || valor.length > 200

  return (
    <>
      <div>
        <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
          {etiqueta}
        </label>
        <div
          onClick={() => setModalAbierto(true)}
          className="w-full text-xs rounded-lg px-3 py-2 cursor-pointer transition-colors group relative overflow-hidden"
          style={{
            background: 'var(--superficie-hover)',
            color: valor ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            border: '1px solid var(--borde-sutil)',
            minHeight: 60,
            maxHeight: tieneMore ? 120 : undefined,
          }}
        >
          <div className="whitespace-pre-wrap" style={{ paddingBottom: tieneMore ? 28 : 0 }}>
            {valor || placeholder || 'Hacé clic para editar...'}
          </div>
          {tieneMore && (
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-lg flex items-end justify-center"
              style={{
                height: 36,
                paddingBottom: 6,
                background: 'linear-gradient(transparent, var(--superficie-hover) 60%)',
              }}
            >
              <span className="text-xxs font-medium flex items-center gap-1" style={{ color: 'var(--texto-marca)' }}>
                <Maximize2 size={10} />
                Editar
              </span>
            </div>
          )}
        </div>
      </div>

      <Modal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {etiqueta}
            </h3>
            <button onClick={() => setModalAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>
          <textarea
            value={valorLocal}
            onChange={(e) => setValorLocal(e.target.value)}
            placeholder={placeholder}
            rows={18}
            autoFocus
            className="w-full text-sm rounded-lg px-4 py-3 resize-none leading-relaxed"
            style={{
              background: 'var(--superficie-hover)',
              color: 'var(--texto-primario)',
              border: '1px solid var(--borde-sutil)',
              minHeight: 400,
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {valorLocal.length} caracteres · {valorLocal.split('\n').length} líneas
            </span>
            <div className="flex gap-2">
              <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
              <Boton variante="primario" tamano="sm" onClick={guardarYCerrar}>Guardar</Boton>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: General
// ═══════════════════════════════════════════════

function TabGeneral({ config, guardar, canales }: TabProps & { canales: CanalSimple[] }) {
  const { t } = useTraduccion()
  const toggleCanal = (canalId: string) => {
    const activos = config.canales_activos || []
    const nuevos = activos.includes(canalId)
      ? activos.filter(id => id !== canalId)
      : [...activos, canalId]
    guardar({ canales_activos: nuevos })
  }

  return (
    <>
      {/* Nombre */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Identidad del agente
        </p>
        <Input
          etiqueta={t('configuracion.agente_ia.nombre_agente')}
          value={config.nombre}
          onChange={(e) => guardar({ nombre: e.target.value })}
          placeholder="Valentina"
        />
        <Input
          etiqueta={t('configuracion.agente_ia.apodo')}
          value={config.apodo}
          onChange={(e) => guardar({ apodo: e.target.value })}
          placeholder="Vale, Valen..."
          ayuda="Opcional. Si el cliente lo llama por apodo, el agente lo reconoce."
        />
        <Input
          etiqueta={t('configuracion.agente_ia.si_preguntan_bot')}
          value={config.respuesta_si_bot}
          onChange={(e) => guardar({ respuesta_si_bot: e.target.value })}
          placeholder={`Soy ${config.nombre || 'el asistente'}, de la empresa. ¿En qué te puedo ayudar?`}
          ayuda="Qué responde si le preguntan si es un bot o una IA. Dejá vacío para respuesta automática."
        />
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.personalidad')}
          valor={config.personalidad}
          onChange={(v) => guardar({ personalidad: v })}
          placeholder="Profesional pero cercana. Directa, no da vueltas. Segura, nunca dice 'creo que'. Humana, no parece chatbot."
        />
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.palabras_naturales')}
          valor={config.vocabulario_natural}
          onChange={(v) => guardar({ vocabulario_natural: v })}
          placeholder="Perfecto, Genial, Dale, Listo, Claro que sí, Sin problema, Entendido"
          lineasPreview={2}
        />
      </div>

      {/* Canales donde opera */}
      {canales.length > 0 && (
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
            Canales donde opera
          </p>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Si no seleccionás ninguno, el agente opera en todos los canales.
          </p>
          <div className="space-y-2">
            {canales.map(canal => (
              <label
                key={canal.id}
                className="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: (config.canales_activos || []).includes(canal.id)
                    ? 'var(--superficie-hover)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={(config.canales_activos || []).includes(canal.id)}
                  onChange={() => toggleCanal(canal.id)}
                  style={{ accentColor: 'var(--texto-marca)' }}
                />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{canal.nombre}</p>
                  <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{canal.tipo}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Cuándo actuar */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Cuándo actuar
        </p>
        <Select
          etiqueta={t('configuracion.agente_ia.modo_activacion')}
          valor={config.modo_activacion}
          onChange={(v) => guardar({ modo_activacion: v as ConfigAgenteIA['modo_activacion'] })}
          opciones={[
            { valor: 'siempre', etiqueta: 'Siempre activo' },
            { valor: 'despues_chatbot', etiqueta: 'Después del chatbot (si no respondió)' },
            { valor: 'fuera_horario', etiqueta: 'Solo fuera de horario' },
            { valor: 'sin_asignar', etiqueta: 'Solo si no hay agente asignado' },
          ]}
        />
        <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
          {config.modo_activacion === 'siempre' && 'El agente IA interviene en todos los mensajes entrantes.'}
          {config.modo_activacion === 'despues_chatbot' && 'Interviene solo si el chatbot no matcheó ninguna regla.'}
          {config.modo_activacion === 'fuera_horario' && 'Solo responde fuera del horario de atención configurado.'}
          {config.modo_activacion === 'sin_asignar' && 'Solo responde si la conversación no tiene agente humano asignado.'}
        </p>
        <Input
          etiqueta={t('configuracion.agente_ia.esperar_segundos')}
          tipo="number"
          value={String(config.delay_segundos)}
          onChange={(e) => guardar({ delay_segundos: parseInt(e.target.value) || 0 })}
          placeholder="0"
        />
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Negocio
// ═══════════════════════════════════════════════

function TabNegocio({ config, guardar }: TabProps) {
  const { t } = useTraduccion()
  return (
    <>
      {/* Datos de la empresa */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Datos de la empresa
        </p>
        <Input
          etiqueta={t('configuracion.agente_ia.zona_cobertura')}
          value={config.zona_cobertura}
          onChange={(e) => guardar({ zona_cobertura: e.target.value })}
          placeholder="CABA y Gran Buenos Aires"
        />
        <Input
          etiqueta={t('configuracion.agente_ia.sitio_web')}
          value={config.sitio_web}
          onChange={(e) => guardar({ sitio_web: e.target.value })}
          placeholder="www.miempresa.com"
        />
        <Input
          etiqueta={t('configuracion.agente_ia.correo_contacto')}
          value={config.correo_empresa}
          onChange={(e) => guardar({ correo_empresa: e.target.value })}
          placeholder="info@miempresa.com"
        />
        <Input
          etiqueta={t('configuracion.agente_ia.horario_atencion')}
          value={config.horario_atencion}
          onChange={(e) => guardar({ horario_atencion: e.target.value })}
          placeholder="Lunes a Viernes de 9 a 18hs"
        />
      </div>

      {/* Servicios */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Servicios
        </p>
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.servicios')}
          valor={config.servicios_si}
          onChange={(v) => guardar({ servicios_si: v })}
          placeholder="Reparación y mantenimiento de portones&#10;Automatización de portones&#10;Herrería de obra en general"
          lineasPreview={4}
        />
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.no_hacen')}
          valor={config.servicios_no}
          onChange={(v) => guardar({ servicios_no: v })}
          placeholder="Reparaciones de autos&#10;Carpintería de madera&#10;Trabajos fuera de la zona de cobertura"
          lineasPreview={3}
        />
      </div>

      {/* Precios y otros */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Información adicional
        </p>
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.precios_referencia')}
          valor={config.info_precios}
          onChange={(v) => guardar({ info_precios: v })}
          placeholder="Trabajo operativo base: $150.000&#10;Solo informar si el cliente pregunta"
          lineasPreview={3}
        />
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.instrucciones')}
          valor={config.instrucciones}
          onChange={(v) => guardar({ instrucciones: v })}
          placeholder="Los presupuestos se envían por correo en 24 a 72hs. Las visitas son sin cargo. Pagos: Mercado Pago o transferencia."
        />
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.situaciones_especiales')}
          valor={config.situaciones_especiales}
          onChange={(v) => guardar({ situaciones_especiales: v })}
          placeholder="Cliente enojado: primero reconocer la situación, después dar info. Nunca minimizar.&#10;Si menciona abogado/demanda → escalar."
          lineasPreview={3}
        />
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Flujo
// ═══════════════════════════════════════════════

function TabFlujo({ config, guardar }: TabProps) {
  const { t } = useTraduccion()
  // ── Flujo de conversación ──
  const flujo = Array.isArray(config.flujo_conversacion) ? config.flujo_conversacion : []

  const agregarPaso = () => {
    const nuevo: PasoFlujoConfig = {
      paso: flujo.length + 1,
      titulo: '',
      descripcion: '',
      condicion_avance: '',
    }
    guardar({ flujo_conversacion: [...flujo, nuevo] })
  }

  const actualizarPaso = (indice: number, cambios: Partial<PasoFlujoConfig>) => {
    const nuevos = flujo.map((p, i) => i === indice ? { ...p, ...cambios } : p)
    guardar({ flujo_conversacion: nuevos })
  }

  const eliminarPaso = (indice: number) => {
    const nuevos = flujo.filter((_, i) => i !== indice).map((p, i) => ({ ...p, paso: i + 1 }))
    guardar({ flujo_conversacion: nuevos })
  }

  const moverPaso = (indice: number, direccion: 'arriba' | 'abajo') => {
    const destino = direccion === 'arriba' ? indice - 1 : indice + 1
    if (destino < 0 || destino >= flujo.length) return
    const nuevos = [...flujo]
    ;[nuevos[indice], nuevos[destino]] = [nuevos[destino], nuevos[indice]]
    guardar({ flujo_conversacion: nuevos.map((p, i) => ({ ...p, paso: i + 1 })) })
  }

  // ── Tipos de contacto ──
  const tipos = Array.isArray(config.tipos_contacto) ? config.tipos_contacto : []
  const [modalTipoAbierto, setModalTipoAbierto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<Partial<TipoContactoConfig> & { indice?: number } | null>(null)

  const guardarTipo = () => {
    if (!tipoEditando?.tipo || !tipoEditando?.nombre) return
    const tipoNuevo: TipoContactoConfig = {
      tipo: tipoEditando.tipo,
      nombre: tipoEditando.nombre,
      icono: tipoEditando.icono || '',
      formulario: tipoEditando.formulario || '',
      instrucciones: tipoEditando.instrucciones || '',
    }
    if (tipoEditando.indice !== undefined) {
      const nuevos = tipos.map((t, i) => i === tipoEditando.indice ? tipoNuevo : t)
      guardar({ tipos_contacto: nuevos })
    } else {
      guardar({ tipos_contacto: [...tipos, tipoNuevo] })
    }
    setModalTipoAbierto(false)
    setTipoEditando(null)
  }

  const eliminarTipo = (indice: number) => {
    guardar({ tipos_contacto: tipos.filter((_, i) => i !== indice) })
  }

  return (
    <>
      {/* Flujo de conversación */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
              Flujo de conversación
            </p>
            <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Pasos que sigue el agente cuando un cliente consulta.
            </p>
          </div>
          <Boton tamano="xs" variante="secundario" icono={<Plus size={14} />} onClick={agregarPaso}>
            Paso
          </Boton>
        </div>

        {flujo.length === 0 && (
          <div className="text-center py-6">
            <GitBranch size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Sin flujo configurado. El agente responderá de forma libre.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {flujo.map((paso, i) => (
            <div
              key={i}
              className="p-3 rounded-lg space-y-2"
              style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-hover)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xxs font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--superficie-tarjeta)', color: 'var(--texto-marca)' }}>
                    {paso.paso}
                  </span>
                  <input
                    value={paso.titulo}
                    onChange={(e) => actualizarPaso(i, { titulo: e.target.value })}
                    placeholder="Título del paso"
                    className="text-xs font-medium bg-transparent border-none outline-none flex-1"
                    style={{ color: 'var(--texto-primario)' }}
                  />
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => moverPaso(i, 'arriba')}
                    disabled={i === 0}
                    className="p-1 rounded cursor-pointer disabled:opacity-30"
                    style={{ color: 'var(--texto-terciario)' }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moverPaso(i, 'abajo')}
                    disabled={i === flujo.length - 1}
                    className="p-1 rounded cursor-pointer disabled:opacity-30"
                    style={{ color: 'var(--texto-terciario)' }}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => eliminarPaso(i)}
                    className="p-1 rounded cursor-pointer"
                    style={{ color: 'var(--insignia-peligro)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <textarea
                value={paso.descripcion}
                onChange={(e) => actualizarPaso(i, { descripcion: e.target.value })}
                placeholder="Qué hacer en este paso..."
                rows={2}
                className="w-full text-xs rounded-lg px-3 py-2 resize-none"
                style={{ background: 'var(--superficie-tarjeta)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
              />
              <input
                value={paso.condicion_avance}
                onChange={(e) => actualizarPaso(i, { condicion_avance: e.target.value })}
                placeholder="Avanzar cuando..."
                className="w-full text-xxs rounded-lg px-3 py-1.5"
                style={{ background: 'var(--superficie-tarjeta)', color: 'var(--texto-terciario)', border: '1px solid var(--borde-sutil)' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tipos de contacto */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
              Tipos de contacto
            </p>
            <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Cada tipo puede tener su propio formulario de datos.
            </p>
          </div>
          <Boton
            tamano="xs"
            variante="secundario"
            icono={<Plus size={14} />}
            onClick={() => { setTipoEditando({ tipo: '', nombre: '', icono: '', formulario: '', instrucciones: '' }); setModalTipoAbierto(true) }}
          >
            Tipo
          </Boton>
        </div>

        {tipos.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--texto-terciario)' }}>
            Sin tipos configurados. El agente no diferenciará entre tipos de cliente.
          </p>
        )}

        {tipos.map((tipo, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm">{tipo.icono || '👤'}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{tipo.nombre}</p>
                <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                  {tipo.instrucciones || tipo.tipo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => { setTipoEditando({ ...tipo, indice: i }); setModalTipoAbierto(true) }}
                className="p-1.5 rounded cursor-pointer"
                style={{ color: 'var(--texto-terciario)' }}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => eliminarTipo(i)}
                className="p-1.5 rounded cursor-pointer"
                style={{ color: 'var(--insignia-peligro)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reglas de agenda */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Reglas de agenda
        </p>
        <TextareaExpandible
          etiqueta={t('configuracion.agente_ia.agendar_visitas')}
          valor={config.reglas_agenda}
          onChange={(v) => guardar({ reglas_agenda: v })}
          placeholder="Visitas: martes y jueves, 11 a 16hs.&#10;Si es lunes/martes → proponer jueves.&#10;Nunca proponer el mismo día."
          lineasPreview={4}
        />
      </div>

      {/* Modal crear/editar tipo de contacto */}
      <Modal abierto={modalTipoAbierto} onCerrar={() => { setModalTipoAbierto(false); setTipoEditando(null) }}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {tipoEditando?.indice !== undefined ? 'Editar tipo de contacto' : 'Nuevo tipo de contacto'}
            </h3>
            <button onClick={() => setModalTipoAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>
          <div className="flex gap-3">
            <div className="w-16">
              <Input
                etiqueta={t('configuracion.agente_ia.icono')}
                value={tipoEditando?.icono || ''}
                onChange={(e) => setTipoEditando(prev => prev ? { ...prev, icono: e.target.value } : prev)}
                placeholder="🏠"
              />
            </div>
            <div className="flex-1">
              <Input
                etiqueta={t('configuracion.agente_ia.nombre')}
                value={tipoEditando?.nombre || ''}
                onChange={(e) => setTipoEditando(prev => prev ? { ...prev, nombre: e.target.value } : prev)}
                placeholder="Particular"
              />
            </div>
          </div>
          <Input
            etiqueta={t('configuracion.agente_ia.identificador')}
            value={tipoEditando?.tipo || ''}
            onChange={(e) => setTipoEditando(prev => prev ? { ...prev, tipo: e.target.value } : prev)}
            placeholder="particular"
            ayuda="Valor interno (sin espacios, en minúscula)"
          />
          <div>
            <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
              Instrucciones
            </label>
            <textarea
              value={tipoEditando?.instrucciones || ''}
              onChange={(e) => setTipoEditando(prev => prev ? { ...prev, instrucciones: e.target.value } : prev)}
              placeholder="Persona física, uso residencial. Factura B."
              rows={2}
              className="w-full text-xs rounded-lg px-3 py-2 resize-none"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
            />
          </div>
          <div>
            <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
              Formulario de datos
            </label>
            <textarea
              value={tipoEditando?.formulario || ''}
              onChange={(e) => setTipoEditando(prev => prev ? { ...prev, formulario: e.target.value } : prev)}
              placeholder={"📊 Para elaborar el presupuesto, completá:\n\n👤 DATOS PERSONALES\n• Nombre y apellido:\n• Teléfono:\n• Email:\n\n📍 DIRECCIÓN\n• Dirección del trabajo:"}
              rows={10}
              className="w-full text-xs rounded-lg px-3 py-2 resize-none"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
            />
            <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Este template se envía al cliente cuando el agente necesita recopilar datos.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setModalTipoAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={guardarTipo}>Guardar</Boton>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Capacidades
// ═══════════════════════════════════════════════

function TabCapacidades({ config, guardar }: TabProps) {
  const capacidades = [
    { key: 'puede_responder', titulo: 'Responder mensajes', desc: 'Genera respuestas automáticas al cliente' },
    { key: 'puede_clasificar', titulo: 'Clasificar intención y tema', desc: 'Detecta qué quiere el cliente y el área temática' },
    { key: 'puede_sentimiento', titulo: 'Detectar sentimiento', desc: 'Analiza si el cliente está contento, neutro o molesto' },
    { key: 'puede_etiquetar', titulo: 'Etiquetar conversaciones', desc: 'Sugiere y aplica etiquetas automáticamente' },
    { key: 'puede_resumir', titulo: 'Resumir conversaciones', desc: 'Genera un resumen de la conversación' },
    { key: 'puede_enrutar', titulo: 'Enrutar a agente/equipo', desc: 'Asigna la conversación al equipo correcto' },
    { key: 'puede_crear_actividad', titulo: 'Crear actividades', desc: 'Crea tareas o seguimientos a partir de la conversación' },
    { key: 'puede_actualizar_contacto', titulo: 'Actualizar datos del contacto', desc: 'Modifica datos del contacto (empresa, cargo, etc.)' },
  ] as const

  return (
    <div className="p-4 rounded-xl space-y-1" style={estiloSeccion}>
      <p className="text-xxs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--texto-terciario)' }}>
        Qué puede hacer el agente
      </p>
      {capacidades.map(cap => (
        <div
          key={cap.key}
          className="flex items-center justify-between py-2.5 px-1"
          style={{ borderBottom: '1px solid var(--borde-sutil)' }}
        >
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{cap.titulo}</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{cap.desc}</p>
          </div>
          <Interruptor
            activo={config[cap.key]}
            onChange={(v) => guardar({ [cap.key]: v })}
          />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Tab: Respuestas
// ═══════════════════════════════════════════════

function TabRespuestas({ config, guardar }: TabProps) {
  const { t } = useTraduccion()
  return (
    <>
      {/* Modo de respuesta */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Modo de respuesta
        </p>
        <div className="space-y-2">
          {([
            { valor: 'automatico', titulo: 'Automático', desc: 'Envía la respuesta sin aprobación humana' },
            { valor: 'sugerir', titulo: 'Sugerir', desc: 'Muestra al agente humano para que la apruebe' },
            { valor: 'borrador', titulo: 'Borrador', desc: 'Guarda como borrador en el compositor' },
          ] as const).map(modo => (
            <label
              key={modo.valor}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                background: config.modo_respuesta === modo.valor ? 'var(--superficie-hover)' : 'transparent',
                border: `1px solid ${config.modo_respuesta === modo.valor ? 'var(--texto-marca)' : 'var(--borde-sutil)'}`,
              }}
            >
              <input
                type="radio"
                name="modo_respuesta"
                checked={config.modo_respuesta === modo.valor}
                onChange={() => guardar({ modo_respuesta: modo.valor })}
                className="mt-0.5"
                style={{ accentColor: 'var(--texto-marca)' }}
              />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{modo.titulo}</p>
                <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{modo.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Tono y largo */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Estilo de escritura
        </p>
        <Select
          etiqueta={t('configuracion.agente_ia.tono')}
          valor={config.tono}
          onChange={(v) => guardar({ tono: v as ConfigAgenteIA['tono'] })}
          opciones={[
            { valor: 'profesional', etiqueta: 'Profesional' },
            { valor: 'amigable', etiqueta: 'Amigable' },
            { valor: 'formal', etiqueta: 'Formal' },
            { valor: 'casual', etiqueta: 'Casual' },
          ]}
        />
        <Select
          etiqueta={t('configuracion.agente_ia.largo_respuestas')}
          valor={config.largo_respuesta}
          onChange={(v) => guardar({ largo_respuesta: v as ConfigAgenteIA['largo_respuesta'] })}
          opciones={[
            { valor: 'corto', etiqueta: 'Corto — 1 oración' },
            { valor: 'medio', etiqueta: 'Medio — 1 a 3 oraciones' },
            { valor: 'largo', etiqueta: 'Largo — 1 párrafo' },
          ]}
        />
        <Input
          etiqueta={t('configuracion.agente_ia.firma')}
          value={config.firmar_como}
          onChange={(e) => guardar({ firmar_como: e.target.value })}
          placeholder="— Equipo de Soporte"
        />
        <Input
          etiqueta={t('configuracion.agente_ia.max_respuestas')}
          tipo="number"
          value={String(config.max_mensajes_auto)}
          onChange={(e) => guardar({ max_mensajes_auto: parseInt(e.target.value) || 5 })}
        />
      </div>

      {/* Ejemplos de conversación */}
      <TabEjemplos config={config} guardar={guardar} />

      {/* Entrenar desde conversaciones */}
      <SeccionEntrenar config={config} guardar={guardar} />
    </>
  )
}

// ═══════════════════════════════════════════════
// Sub-tab: Entrenar al agente desde conversaciones
// ═══════════════════════════════════════════════

function SeccionEntrenar({ config, guardar }: TabProps) {
  const [analizando, setAnalizando] = useState(false)
  const [periodoDias, setPeriodoDias] = useState(60)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({})

  const analizarDesdeBD = async () => {
    setAnalizando(true)
    setError('')
    setResultado(null)
    try {
      const res = await fetch('/api/inbox/agente-ia/analizar-conversaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo_dias: periodoDias }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data.analisis)
      // Preseleccionar todo
      const sel: Record<string, boolean> = {}
      for (const key of Object.keys(data.analisis)) sel[key] = true
      setSeleccionados(sel)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Error al analizar'))
    }
    setAnalizando(false)
  }

  const analizarDesdeArchivo = async (archivo: File) => {
    setSubiendoArchivo(true)
    setError('')
    setResultado(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const res = await fetch('/api/inbox/agente-ia/analizar-conversaciones', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data.analisis)
      const sel: Record<string, boolean> = {}
      for (const key of Object.keys(data.analisis)) sel[key] = true
      setSeleccionados(sel)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Error al analizar'))
    }
    setSubiendoArchivo(false)
  }

  const aplicarResultados = () => {
    if (!resultado) return
    const cambios: Partial<typeof config> = {}

    if (seleccionados.ejemplos_sugeridos && Array.isArray(resultado.ejemplos_sugeridos)) {
      const existentes = Array.isArray(config.ejemplos_conversacion) ? config.ejemplos_conversacion : []
      cambios.ejemplos_conversacion = [...existentes, ...(resultado.ejemplos_sugeridos as typeof config.ejemplos_conversacion)]
    }
    if (seleccionados.vocabulario_detectado && resultado.vocabulario_detectado) {
      cambios.vocabulario_natural = config.vocabulario_natural
        ? `${config.vocabulario_natural}, ${resultado.vocabulario_detectado}`
        : String(resultado.vocabulario_detectado)
    }
    if (seleccionados.flujo_detectado && Array.isArray(resultado.flujo_detectado) && resultado.flujo_detectado.length > 0) {
      cambios.flujo_conversacion = resultado.flujo_detectado as typeof config.flujo_conversacion
    }
    if (seleccionados.servicios_si && resultado.servicios_si) {
      cambios.servicios_si = config.servicios_si
        ? `${config.servicios_si}\n${resultado.servicios_si}`
        : String(resultado.servicios_si)
    }
    if (seleccionados.servicios_no && resultado.servicios_no) {
      cambios.servicios_no = config.servicios_no
        ? `${config.servicios_no}\n${resultado.servicios_no}`
        : String(resultado.servicios_no)
    }
    if (seleccionados.tipos_contacto_detectados && Array.isArray(resultado.tipos_contacto_detectados)) {
      const existentes = Array.isArray(config.tipos_contacto) ? config.tipos_contacto : []
      cambios.tipos_contacto = [...existentes, ...(resultado.tipos_contacto_detectados as typeof config.tipos_contacto)]
    }
    if (seleccionados.situaciones_especiales && resultado.situaciones_especiales) {
      cambios.situaciones_especiales = config.situaciones_especiales
        ? `${config.situaciones_especiales}\n${resultado.situaciones_especiales}`
        : String(resultado.situaciones_especiales)
    }
    if (seleccionados.reglas_agenda && resultado.reglas_agenda) {
      cambios.reglas_agenda = String(resultado.reglas_agenda)
    }
    if (seleccionados.info_precios && resultado.info_precios) {
      cambios.info_precios = String(resultado.info_precios)
    }
    if (seleccionados.tono_detectado && resultado.tono_detectado) {
      cambios.personalidad = config.personalidad
        ? `${config.personalidad}\n${resultado.tono_detectado}`
        : String(resultado.tono_detectado)
    }

    guardar(cambios)
    setResultado(null)
  }

  const toggleSeleccion = (key: string) => {
    setSeleccionados(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const etiquetasResultado: Record<string, string> = {
    ejemplos_sugeridos: 'Ejemplos de conversación',
    vocabulario_detectado: 'Vocabulario natural',
    flujo_detectado: 'Flujo de conversación',
    servicios_si: 'Servicios que ofrecen',
    servicios_no: 'Servicios que NO hacen',
    tipos_contacto_detectados: 'Tipos de contacto',
    tono_detectado: 'Tono detectado',
    situaciones_especiales: 'Situaciones especiales',
    reglas_agenda: 'Reglas de agenda',
    info_precios: 'Precios de referencia',
  }

  return (
    <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
      <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
        Entrenar al agente con conversaciones reales
      </p>
      <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
        Analizamos conversaciones para extraer ejemplos, vocabulario, flujos y más.
      </p>

      {!resultado && (
        <>
          {/* Desde Flux */}
          <div className="p-3 rounded-lg space-y-2" style={{ border: '1px solid var(--borde-sutil)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Desde conversaciones en Flux</p>
            <div className="flex items-center gap-2">
              <select
                value={periodoDias}
                onChange={(e) => setPeriodoDias(Number(e.target.value))}
                className="text-xs rounded-lg px-2 py-1.5"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
              >
                <option value={7}>Últimos 7 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={60}>Últimos 60 días</option>
                <option value={90}>Últimos 90 días</option>
                <option value={365}>Todo</option>
              </select>
              <Boton tamano="sm" variante="primario" onClick={analizarDesdeBD} cargando={analizando} disabled={analizando}>
                Analizar
              </Boton>
            </div>
          </div>

          {/* Desde archivo */}
          <div className="p-3 rounded-lg space-y-2" style={{ border: '1px solid var(--borde-sutil)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Importar historial anterior</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              Subí archivos .txt exportados de WhatsApp (podés subir varios).
            </p>
            <label
              className="flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-colors text-xs font-medium"
              style={{ border: '2px dashed var(--borde-sutil)', color: 'var(--texto-terciario)' }}
            >
              {subiendoArchivo ? (
                <><Loader2 size={14} className="animate-spin" /> Analizando...</>
              ) : (
                <><FileUp size={14} /> Elegir archivo .txt</>
              )}
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) analizarDesdeArchivo(archivo)
                  e.target.value = ''
                }}
                disabled={subiendoArchivo}
              />
            </label>
          </div>

          {config.ultimo_analisis_conversaciones && (
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              Último análisis: {new Date(config.ultimo_analisis_conversaciones).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </>
      )}

      {/* Resultados del análisis */}
      {resultado && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>
            Resultados del análisis
          </p>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Seleccioná lo que querés aplicar a la configuración del agente.
          </p>

          {Object.entries(etiquetasResultado).map(([key, label]) => {
            const valor = resultado[key]
            if (!valor || (Array.isArray(valor) && valor.length === 0)) return null
            const preview = typeof valor === 'string'
              ? valor.slice(0, 100)
              : Array.isArray(valor)
                ? `${valor.length} items`
                : ''

            return (
              <label
                key={key}
                className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors"
                style={{ background: seleccionados[key] ? 'var(--superficie-hover)' : 'transparent' }}
              >
                <input
                  type="checkbox"
                  checked={!!seleccionados[key]}
                  onChange={() => toggleSeleccion(key)}
                  className="mt-0.5"
                  style={{ accentColor: 'var(--texto-marca)' }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{label}</p>
                  <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>{preview}</p>
                </div>
              </label>
            )
          })}

          <div className="flex gap-2 pt-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setResultado(null)}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={aplicarResultados}>Aplicar seleccionados</Boton>
          </div>

          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Solo completa campos vacíos. No sobreescribe lo que ya tenés configurado.
          </p>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--insignia-peligro)' }}>{error}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Sub-tab: Ejemplos de conversación (few-shot)
// ═══════════════════════════════════════════════

function TabEjemplos({ config, guardar }: TabProps) {
  const { t } = useTraduccion()
  const ejemplos = Array.isArray(config.ejemplos_conversacion) ? config.ejemplos_conversacion : []
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<{
    titulo: string
    mensajes: { rol: 'cliente' | 'agente'; texto: string }[]
    indice?: number
  } | null>(null)

  const abrirNuevo = () => {
    setEditando({ titulo: '', mensajes: [{ rol: 'cliente', texto: '' }, { rol: 'agente', texto: '' }] })
    setModalAbierto(true)
  }

  const abrirEditar = (indice: number) => {
    setEditando({ ...ejemplos[indice], indice })
    setModalAbierto(true)
  }

  const guardarEjemplo = () => {
    if (!editando?.titulo || !editando.mensajes.some(m => m.texto)) return
    const ejemplo: EjemploConversacionConfig = {
      titulo: editando.titulo,
      mensajes: editando.mensajes.filter(m => m.texto.trim()),
    }
    if (editando.indice !== undefined) {
      const nuevos = ejemplos.map((e, i) => i === editando.indice ? ejemplo : e)
      guardar({ ejemplos_conversacion: nuevos })
    } else {
      guardar({ ejemplos_conversacion: [...ejemplos, ejemplo] })
    }
    setModalAbierto(false)
    setEditando(null)
  }

  const eliminarEjemplo = (indice: number) => {
    guardar({ ejemplos_conversacion: ejemplos.filter((_, i) => i !== indice) })
  }

  const agregarMensaje = () => {
    if (!editando) return
    const ultimoRol = editando.mensajes.at(-1)?.rol || 'agente'
    setEditando({
      ...editando,
      mensajes: [...editando.mensajes, { rol: ultimoRol === 'cliente' ? 'agente' : 'cliente', texto: '' }],
    })
  }

  const actualizarMensaje = (indice: number, cambios: Partial<{ rol: 'cliente' | 'agente'; texto: string }>) => {
    if (!editando) return
    setEditando({
      ...editando,
      mensajes: editando.mensajes.map((m, i) => i === indice ? { ...m, ...cambios } : m),
    })
  }

  const eliminarMensaje = (indice: number) => {
    if (!editando) return
    setEditando({
      ...editando,
      mensajes: editando.mensajes.filter((_, i) => i !== indice),
    })
  }

  return (
    <>
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
              Ejemplos de conversación
            </p>
            <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Ejemplos reales de cómo querés que responda el agente. Mejora mucho la calidad.
            </p>
          </div>
          <Boton tamano="xs" variante="secundario" icono={<Plus size={14} />} onClick={abrirNuevo}>
            Ejemplo
          </Boton>
        </div>

        {ejemplos.length === 0 && (
          <div className="text-center py-6">
            <MessageSquare size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Sin ejemplos todavía. Agregá conversaciones de referencia.
            </p>
          </div>
        )}

        {ejemplos.map((ej, i) => (
          <div
            key={i}
            className="p-3 rounded-lg space-y-1.5"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>{ej.titulo}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => abrirEditar(i)} className="p-1 rounded cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => eliminarEjemplo(i)} className="p-1 rounded cursor-pointer" style={{ color: 'var(--insignia-peligro)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {ej.mensajes.slice(0, 3).map((m, j) => (
              <p key={j} className="text-xxs truncate" style={{ color: m.rol === 'cliente' ? 'var(--texto-secundario)' : 'var(--texto-marca)' }}>
                {m.rol === 'cliente' ? 'Cliente' : 'Agente'}: {m.texto}
              </p>
            ))}
            {ej.mensajes.length > 3 && (
              <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>+{ej.mensajes.length - 3} mensajes más</p>
            )}
          </div>
        ))}
      </div>

      {/* Modal crear/editar ejemplo */}
      <Modal abierto={modalAbierto} onCerrar={() => { setModalAbierto(false); setEditando(null) }}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {editando?.indice !== undefined ? 'Editar ejemplo' : 'Nuevo ejemplo de conversación'}
            </h3>
            <button onClick={() => setModalAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>
          <Input
            etiqueta={t('configuracion.agente_ia.titulo_ejemplo')}
            value={editando?.titulo || ''}
            onChange={(e) => setEditando(prev => prev ? { ...prev, titulo: e.target.value } : prev)}
            placeholder="Consulta simple, particular"
          />
          <div className="space-y-2">
            <p className="text-xxs font-medium" style={{ color: 'var(--texto-secundario)' }}>Mensajes</p>
            {(editando?.mensajes || []).map((m, i) => (
              <div key={i} className="flex gap-2 items-start">
                <select
                  value={m.rol}
                  onChange={(e) => actualizarMensaje(i, { rol: e.target.value as 'cliente' | 'agente' })}
                  className="text-xxs rounded-lg px-2 py-2 shrink-0"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)', width: 80 }}
                >
                  <option value="cliente">Cliente</option>
                  <option value="agente">Agente</option>
                </select>
                <textarea
                  value={m.texto}
                  onChange={(e) => actualizarMensaje(i, { texto: e.target.value })}
                  placeholder={m.rol === 'cliente' ? 'Mensaje del cliente...' : 'Respuesta del agente...'}
                  rows={2}
                  className="flex-1 text-xs rounded-lg px-3 py-2 resize-none"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
                />
                <button onClick={() => eliminarMensaje(i)} className="p-1.5 rounded cursor-pointer shrink-0 mt-1" style={{ color: 'var(--insignia-peligro)' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <Boton tamano="xs" variante="fantasma" icono={<Plus size={14} />} onClick={agregarMensaje}>
              Agregar mensaje
            </Boton>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={guardarEjemplo}>Guardar</Boton>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Conocimiento
// ═══════════════════════════════════════════════

function TabConocimiento({ config, guardar }: TabProps) {
  const { t } = useTraduccion()
  const { mostrar: mostrarToast } = useToast()
  const [entradas, setEntradas] = useState<EntradaBaseConocimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [entradaEditando, setEntradaEditando] = useState<Partial<EntradaBaseConocimiento> | null>(null)
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false)
  const [importandoUrl, setImportandoUrl] = useState('')
  const [importandoCargando, setImportandoCargando] = useState(false)
  const [importandoError, setImportandoError] = useState('')
  const [importandoArchivo, setImportandoArchivo] = useState(false)

  // Cargar entradas
  useEffect(() => {
    fetch('/api/inbox/agente-ia/base-conocimiento')
      .then(r => r.json())
      .then(d => setEntradas(d.entradas || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const guardarEntrada = async () => {
    if (!entradaEditando?.titulo || !entradaEditando?.contenido) return
    const esEdicion = !!entradaEditando.id
    const url = esEdicion
      ? `/api/inbox/agente-ia/base-conocimiento/${entradaEditando.id}`
      : '/api/inbox/agente-ia/base-conocimiento'

    try {
      const res = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaEditando),
      })
      const data = await res.json()
      if (data.entrada) {
        if (esEdicion) {
          setEntradas(prev => prev.map(e => e.id === data.entrada.id ? data.entrada : e))
        } else {
          setEntradas(prev => [data.entrada, ...prev])
        }
        mostrarToast('exito', esEdicion ? 'Entrada actualizada' : 'Entrada creada')
      }
      setModalAbierto(false)
      setEntradaEditando(null)
    } catch {
      mostrarToast('error', 'Error al guardar entrada')
    }
  }

  const eliminarEntrada = async (id: string) => {
    try {
      await fetch(`/api/inbox/agente-ia/base-conocimiento/${id}`, { method: 'DELETE' })
      setEntradas(prev => prev.filter(e => e.id !== id))
      mostrarToast('exito', 'Entrada eliminada')
    } catch {
      mostrarToast('error', 'Error al eliminar entrada')
    }
  }

  // Importar desde URL
  const importarDesdeUrl = async () => {
    if (!importandoUrl.trim()) return
    setImportandoCargando(true)
    setImportandoError('')
    try {
      const res = await fetch('/api/inbox/agente-ia/base-conocimiento/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'url', url: importandoUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.entrada) {
        setEntradas(prev => [data.entrada, ...prev])
        setImportandoUrl('')
        setModalImportarAbierto(false)
      }
    } catch (err) {
      setImportandoError(String(err instanceof Error ? err.message : 'Error al importar'))
    }
    setImportandoCargando(false)
  }

  // Importar desde archivo (PDF, TXT, MD, CSV, JSON)
  const importarDesdeArchivo = async (archivo: File) => {
    setImportandoArchivo(true)
    setImportandoError('')
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const res = await fetch('/api/inbox/agente-ia/base-conocimiento/importar-archivo', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.entrada) {
        setEntradas(prev => [data.entrada, ...prev])
        setModalImportarAbierto(false)
      }
    } catch (err) {
      setImportandoError(String(err instanceof Error ? err.message : 'Error al importar archivo'))
    }
    setImportandoArchivo(false)
  }

  const CATEGORIAS = [
    { valor: 'general', etiqueta: 'General' },
    { valor: 'soporte', etiqueta: 'Soporte' },
    { valor: 'ventas', etiqueta: 'Ventas' },
    { valor: 'info', etiqueta: 'Información' },
    { valor: 'producto', etiqueta: 'Producto' },
  ]

  return (
    <>
      {/* Toggle base de conocimiento */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Usar base de conocimiento</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>El agente consulta estas entradas para dar respuestas precisas.</p>
          </div>
          <Interruptor activo={config.usar_base_conocimiento} onChange={(v) => guardar({ usar_base_conocimiento: v })} />
        </div>
      </div>

      {/* Lista de entradas */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
            Entradas ({entradas.length})
          </p>
          <div className="flex gap-1.5">
            <Boton
              tamano="xs"
              variante="fantasma"
              icono={<Globe size={14} />}
              onClick={() => { setImportandoUrl(''); setImportandoError(''); setModalImportarAbierto(true) }}
            >
              Importar
            </Boton>
            <Boton
              tamano="xs"
              variante="secundario"
              icono={<Plus size={14} />}
              onClick={() => {
                setEntradaEditando({ titulo: '', contenido: '', categoria: 'general', etiquetas: [], activo: true })
                setModalAbierto(true)
              }}
            >
              Agregar
            </Boton>
          </div>
        </div>

        {cargando && <p className="text-xs text-center py-4" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>}

        {!cargando && entradas.length === 0 && (
          <div className="text-center py-6">
            <BookOpen size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Sin entradas todavía. Agregá información para que el agente responda mejor.
            </p>
          </div>
        )}

        {entradas.map(entrada => (
          <div
            key={entrada.id}
            className="flex items-center justify-between py-2 px-2 rounded-lg"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{entrada.titulo}</p>
                <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                  {entrada.contenido.slice(0, 80)}...
                </p>
              </div>
              <Insignia color={entrada.activo ? 'exito' : 'neutro'}>{entrada.categoria}</Insignia>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => { setEntradaEditando(entrada); setModalAbierto(true) }}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--texto-terciario)' }}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => eliminarEntrada(entrada.id)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--insignia-peligro)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      <Modal abierto={modalAbierto} onCerrar={() => { setModalAbierto(false); setEntradaEditando(null) }}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {entradaEditando?.id ? 'Editar entrada' : 'Nueva entrada'}
            </h3>
            <button onClick={() => setModalAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>
          <Input
            etiqueta={t('configuracion.agente_ia.titulo_campo')}
            value={entradaEditando?.titulo || ''}
            onChange={(e) => setEntradaEditando(prev => prev ? { ...prev, titulo: e.target.value } : prev)}
            placeholder="Política de devoluciones"
          />
          <Select
            etiqueta={t('configuracion.agente_ia.categoria')}
            valor={entradaEditando?.categoria || 'general'}
            onChange={(v) => setEntradaEditando(prev => prev ? { ...prev, categoria: v } : prev)}
            opciones={CATEGORIAS}
          />
          {/* Etiquetas (chips) */}
          <div>
            <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(entradaEditando?.etiquetas || []).map((et, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xxs px-2 py-1 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--texto-marca) 15%, transparent)',
                    color: 'var(--texto-marca)',
                  }}
                >
                  {et}
                  <button
                    onClick={() => setEntradaEditando(prev => prev ? {
                      ...prev,
                      etiquetas: (prev.etiquetas || []).filter((_, idx) => idx !== i),
                    } : prev)}
                    className="cursor-pointer hover:opacity-70"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <input
              placeholder="Escribí y presioná Enter..."
              className="w-full text-xs rounded-lg px-3 py-2"
              style={{
                background: 'var(--superficie-hover)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const valor = (e.target as HTMLInputElement).value.trim()
                  if (valor && !(entradaEditando?.etiquetas || []).includes(valor)) {
                    setEntradaEditando(prev => prev ? {
                      ...prev,
                      etiquetas: [...(prev.etiquetas || []), valor],
                    } : prev)
                  }
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
            />
          </div>
          <div>
            <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
              Contenido
            </label>
            <textarea
              value={entradaEditando?.contenido || ''}
              onChange={(e) => setEntradaEditando(prev => prev ? { ...prev, contenido: e.target.value } : prev)}
              placeholder="Nuestra política de devoluciones permite cambios dentro de los 30 días..."
              rows={8}
              className="w-full text-xs rounded-lg px-3 py-2 resize-none"
              style={{
                background: 'var(--superficie-hover)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={guardarEntrada}>Guardar</Boton>
          </div>
        </div>
      </Modal>

      {/* Modal importar desde URL o archivo */}
      <Modal abierto={modalImportarAbierto} onCerrar={() => setModalImportarAbierto(false)}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Importar conocimiento
            </h3>
            <button onClick={() => setModalImportarAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Desde URL */}
          <div className="p-4 rounded-xl space-y-3" style={{ border: '1px solid var(--borde-sutil)' }}>
            <div className="flex items-center gap-2">
              <Globe size={16} style={{ color: 'var(--texto-marca)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Desde una página web</p>
            </div>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              Pegá la URL y extraemos el contenido automáticamente.
            </p>
            <div className="flex gap-2">
              <Input
                value={importandoUrl}
                onChange={(e) => setImportandoUrl(e.target.value)}
                placeholder="https://www.ejemplo.com/info"
                compacto
                onKeyDown={(e) => e.key === 'Enter' && importarDesdeUrl()}
              />
              <Boton
                variante="primario"
                tamano="sm"
                onClick={importarDesdeUrl}
                cargando={importandoCargando}
                disabled={importandoCargando || !importandoUrl.trim()}
              >
                Importar
              </Boton>
            </div>
          </div>

          {/* Desde archivo */}
          <div className="p-4 rounded-xl space-y-3" style={{ border: '1px solid var(--borde-sutil)' }}>
            <div className="flex items-center gap-2">
              <FileUp size={16} style={{ color: 'var(--texto-marca)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Desde un archivo</p>
            </div>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              Subí un PDF, TXT, MD, CSV o JSON y extraemos el contenido.
            </p>
            <label
              className="flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-colors text-xs font-medium"
              style={{
                border: '2px dashed var(--borde-sutil)',
                color: 'var(--texto-terciario)',
              }}
            >
              {importandoArchivo ? (
                <><Loader2 size={14} className="animate-spin" /> Procesando...</>
              ) : (
                <><FileUp size={14} /> Elegir archivo</>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.json"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) importarDesdeArchivo(archivo)
                  e.target.value = ''
                }}
                disabled={importandoArchivo}
              />
            </label>
          </div>

          {/* Error */}
          {importandoError && (
            <p className="text-xs px-2" style={{ color: 'var(--insignia-peligro)' }}>
              {importandoError}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Escalamiento
// ═══════════════════════════════════════════════

function TabEscalamiento({ config, guardar }: TabProps) {
  const [nuevaPalabra, setNuevaPalabra] = useState('')

  const agregarPalabra = () => {
    if (!nuevaPalabra.trim()) return
    guardar({ escalar_palabras: [...config.escalar_palabras, nuevaPalabra.trim()] })
    setNuevaPalabra('')
  }

  const eliminarPalabra = (indice: number) => {
    guardar({ escalar_palabras: config.escalar_palabras.filter((_, i) => i !== indice) })
  }

  return (
    <>
      {/* Toggles de escalamiento */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Cuándo escalar a humano
        </p>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Escalar si sentimiento negativo</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Transfiere a humano si el cliente está molesto</p>
          </div>
          <Interruptor activo={config.escalar_si_negativo} onChange={(v) => guardar({ escalar_si_negativo: v })} />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>Escalar si no sabe responder</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Transfiere si la IA no tiene información suficiente</p>
          </div>
          <Interruptor activo={config.escalar_si_no_sabe} onChange={(v) => guardar({ escalar_si_no_sabe: v })} />
        </div>
      </div>

      {/* Palabras de escalamiento */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Palabras que disparan escalamiento
        </p>
        <div className="flex flex-wrap gap-1.5">
          {config.escalar_palabras.map((palabra, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xxs px-2 py-1 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--insignia-advertencia) 15%, transparent)',
                color: 'var(--insignia-advertencia)',
              }}
            >
              {palabra}
              <button onClick={() => eliminarPalabra(i)} className="cursor-pointer hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={nuevaPalabra}
            onChange={(e) => setNuevaPalabra(e.target.value)}
            placeholder="Agregar palabra..."
            compacto
            onKeyDown={(e) => e.key === 'Enter' && agregarPalabra()}
          />
          <Boton variante="secundario" tamano="sm" onClick={agregarPalabra}>Agregar</Boton>
        </div>
      </div>

      {/* Mensaje de escalamiento */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Mensaje al escalar
        </p>
        <textarea
          value={config.mensaje_escalamiento}
          onChange={(e) => guardar({ mensaje_escalamiento: e.target.value })}
          rows={2}
          className="w-full text-xs rounded-lg px-3 py-2 resize-none"
          style={{
            background: 'var(--superficie-hover)',
            color: 'var(--texto-primario)',
            border: '1px solid var(--borde-sutil)',
          }}
        />
        <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
          Este mensaje se envía al cliente cuando el agente IA escala a un humano.
        </p>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Actividad
// ═══════════════════════════════════════════════

function TabActividad() {
  const [logs, setLogs] = useState<LogAgenteIA[]>([])
  const [todosLogs, setTodosLogs] = useState<LogAgenteIA[]>([])
  const [metricas, setMetricas] = useState<{
    total_acciones: number
    total_tokens: number
    latencia_promedio: number
    tasa_exito: number
    por_accion: Record<string, number>
    sentimiento_promedio?: string
  } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modalLogAbierto, setModalLogAbierto] = useState(false)
  const [paginaLog, setPaginaLog] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [cargandoLog, setCargandoLog] = useState(false)

  useEffect(() => {
    fetch('/api/inbox/agente-ia/log?limite=10')
      .then(r => r.json())
      .then(d => {
        setLogs(d.logs || [])
        setMetricas(d.metricas || null)
        setTotalLogs(d.total || 0)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const abrirLogCompleto = async () => {
    setModalLogAbierto(true)
    setCargandoLog(true)
    setPaginaLog(1)
    try {
      const res = await fetch('/api/inbox/agente-ia/log?limite=50&pagina=1')
      const d = await res.json()
      setTodosLogs(d.logs || [])
      setTotalLogs(d.total || 0)
    } catch { /* silenciar */ }
    setCargandoLog(false)
  }

  const cargarPaginaLog = async (pagina: number) => {
    setCargandoLog(true)
    setPaginaLog(pagina)
    try {
      const res = await fetch(`/api/inbox/agente-ia/log?limite=50&pagina=${pagina}`)
      const d = await res.json()
      setTodosLogs(d.logs || [])
    } catch { /* silenciar */ }
    setCargandoLog(false)
  }

  if (cargando) return <p className="text-xs text-center py-4" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>

  const tarjetaMetrica = (titulo: string, valor: string | number) => (
    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--superficie-hover)' }}>
      <p className="text-lg font-bold" style={{ color: 'var(--texto-primario)' }}>{valor}</p>
      <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{titulo}</p>
    </div>
  )

  const etiquetaAccion: Record<string, string> = {
    responder: 'Respuesta',
    clasificar: 'Clasificación',
    escalar: 'Escalamiento',
    etiquetar: 'Etiquetado',
    sentimiento: 'Sentimiento',
    resumir: 'Resumen',
    enrutar: 'Enrutado',
    crear_actividad: 'Actividad',
    actualizar_contacto: 'Contacto',
  }

  const renderFilaLog = (log: LogAgenteIA) => (
    <div
      key={log.id}
      className="flex items-center justify-between py-2 px-2 rounded-lg text-xs"
      style={{ background: 'var(--superficie-hover)' }}
    >
      <div className="flex items-center gap-2">
        <Insignia color={log.exito ? 'exito' : 'peligro'}>
          {etiquetaAccion[log.accion] || log.accion}
        </Insignia>
        <span style={{ color: 'var(--texto-terciario)' }}>
          {new Date(log.creado_en).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
        </span>
      </div>
      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
        {log.latencia_ms}ms · {(log.tokens_entrada + log.tokens_salida).toLocaleString()} tokens
      </span>
    </div>
  )

  const totalPaginas = Math.ceil(totalLogs / 50)

  return (
    <>
      {/* Métricas 24h */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
          Últimas 24 horas
        </p>
        {metricas ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {tarjetaMetrica('Acciones', metricas.total_acciones)}
            {tarjetaMetrica('Tokens', metricas.total_tokens.toLocaleString())}
            {tarjetaMetrica('Latencia prom.', `${metricas.latencia_promedio}ms`)}
            {tarjetaMetrica('Tasa de éxito', `${metricas.tasa_exito}%`)}
            {tarjetaMetrica('Sentimiento', metricas.sentimiento_promedio || '—')}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Sin actividad reciente.</p>
        )}
      </div>

      {/* Últimas acciones */}
      <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
        <div className="flex items-center justify-between">
          <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
            Últimas acciones
          </p>
          {totalLogs > 10 && (
            <button
              onClick={abrirLogCompleto}
              className="text-xxs font-medium cursor-pointer"
              style={{ color: 'var(--texto-marca)' }}
            >
              Ver log completo ({totalLogs})
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-6">
            <Activity size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Sin acciones todavía.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map(renderFilaLog)}
          </div>
        )}
      </div>

      {/* Modal log completo */}
      <Modal abierto={modalLogAbierto} onCerrar={() => setModalLogAbierto(false)}>
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Log completo del agente IA
            </h3>
            <button onClick={() => setModalLogAbierto(false)} className="cursor-pointer" style={{ color: 'var(--texto-terciario)' }}>
              <X size={18} />
            </button>
          </div>

          {cargandoLog ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {todosLogs.map(renderFilaLog)}
            </div>
          )}

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Boton
                variante="secundario"
                tamano="xs"
                disabled={paginaLog <= 1}
                onClick={() => cargarPaginaLog(paginaLog - 1)}
              >
                Anterior
              </Boton>
              <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                Página {paginaLog} de {totalPaginas}
              </span>
              <Boton
                variante="secundario"
                tamano="xs"
                disabled={paginaLog >= totalPaginas}
                onClick={() => cargarPaginaLog(paginaLog + 1)}
              >
                Siguiente
              </Boton>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

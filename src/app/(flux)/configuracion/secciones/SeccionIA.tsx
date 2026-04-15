'use client'

import { useState, useEffect, useCallback } from 'react'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import {
  Sparkles, MessageSquare, Wand2, Eye, EyeOff, RotateCcw, Maximize2, Minimize2,
  Check, Shield, Zap, ExternalLink, Settings2, BarChart3, ChevronRight,
} from 'lucide-react'
import { LogoAnthropic, LogoOpenAI, LogoGoogle, LogoXAI } from '@/componentes/ui/LogosIA'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Boton } from '@/componentes/ui/Boton'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useModulos } from '@/hooks/useModulos'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { PanelUsoIA } from '@/componentes/ia/PanelUsoIA'
import { ENLACES_FACTURACION } from '@/lib/ia/precios'

// ==================== CONSTANTES ====================

const PROVEEDORES = [
  {
    id: 'anthropic',
    nombre: 'Anthropic',
    descripcion: 'Razonamiento avanzado, respuestas cuidadosas',
    color: '#d4a574',
    Logo: LogoAnthropic,
    modelos: [
      { id: 'claude-sonnet-4-20250514', nombre: 'Claude Sonnet 4', desc: 'Equilibrio ideal' },
      { id: 'claude-haiku-4-5-20251001', nombre: 'Claude Haiku 4.5', desc: 'Rápido y económico' },
      { id: 'claude-opus-4-20250514', nombre: 'Claude Opus 4', desc: 'El más inteligente' },
    ],
  },
  {
    id: 'openai',
    nombre: 'OpenAI',
    descripcion: 'Versatilidad y amplia compatibilidad',
    color: '#10a37f',
    Logo: LogoOpenAI,
    modelos: [
      { id: 'gpt-4o', nombre: 'GPT-4o', desc: 'El más inteligente' },
      { id: 'gpt-4o-mini', nombre: 'GPT-4o Mini', desc: 'Rápido y económico' },
      { id: 'gpt-4-turbo', nombre: 'GPT-4 Turbo', desc: 'Contexto largo' },
    ],
  },
  {
    id: 'google',
    nombre: 'Gemini',
    descripcion: 'Multimodal con el contexto más largo del mercado',
    color: '#4285f4',
    Logo: LogoGoogle,
    modelos: [
      { id: 'gemini-2.0-flash', nombre: 'Gemini 2.0 Flash', desc: 'Rápido y económico' },
      { id: 'gemini-2.0-pro', nombre: 'Gemini 2.0 Pro', desc: 'El más capaz' },
      { id: 'gemini-1.5-pro', nombre: 'Gemini 1.5 Pro', desc: 'Contexto largo' },
    ],
  },
  {
    id: 'xai',
    nombre: 'Grok',
    descripcion: 'Inferencia ultra rápida por xAI',
    color: '#1d9bf0',
    Logo: LogoXAI,
    modelos: [
      { id: 'grok-3', nombre: 'Grok 3', desc: 'El más capaz' },
      { id: 'grok-3-mini', nombre: 'Grok 3 Mini', desc: 'Rápido y económico' },
    ],
  },
]

const MODULOS_DISPONIBLES = [
  { id: 'contactos', nombre: 'Contactos', desc: 'Clientes, proveedores, prospectos' },
  { id: 'actividades', nombre: 'Actividades', desc: 'Tareas y seguimientos' },
  { id: 'visitas', nombre: 'Visitas', desc: 'Visitas programadas' },
  { id: 'productos', nombre: 'Productos', desc: 'Catálogo y precios' },
  { id: 'presupuestos', nombre: 'Presupuestos', desc: 'Cotizaciones' },
  { id: 'facturas', nombre: 'Facturas', desc: 'Facturación y pagos' },
  { id: 'ordenes_trabajo', nombre: 'Órdenes de trabajo', desc: 'Órdenes y etapas' },
  { id: 'asistencias', nombre: 'Asistencias', desc: 'Fichaje y jornadas' },
  { id: 'calendario', nombre: 'Calendario', desc: 'Eventos y agenda' },
]

// ==================== TIPOS ====================

interface ConfigIA {
  habilitado: boolean
  proveedor_defecto: string
  api_key_anthropic: string
  api_key_openai: string
  api_key_google: string
  api_key_xai: string
  modelo_anthropic: string
  modelo_openai: string
  modelo_google: string
  modelo_xai: string
  temperatura: number
  max_tokens: number
  modulos_accesibles: string[]
  prompt_asistente?: string
  prompt_asistente_presupuestos: string
}

const DEFAULTS: ConfigIA = {
  habilitado: false,
  proveedor_defecto: 'anthropic',
  api_key_anthropic: '',
  api_key_openai: '',
  api_key_google: '',
  api_key_xai: '',
  modelo_anthropic: 'claude-sonnet-4-20250514',
  modelo_openai: 'gpt-4o',
  modelo_google: 'gemini-2.0-flash',
  modelo_xai: 'grok-3',
  temperatura: 0.7,
  max_tokens: 4096,
  modulos_accesibles: ['contactos', 'actividades', 'visitas', 'productos', 'presupuestos', 'facturas', 'ordenes_trabajo'],
  prompt_asistente_presupuestos: '',
}

type SubSeccion = 'panel' | 'configuracion' | 'asistentes' | 'copiloto'

const SLUGS_IA = ['agente_ia', 'salix_ia', 'chatbot_inbox', 'automatizaciones']

/** Herramientas disponibles para Salix IA Copiloto con nombres legibles */
const HERRAMIENTAS_COPILOTO = [
  { id: 'buscar_contactos', nombre: 'Buscar contactos', grupo: 'Contactos' },
  { id: 'obtener_contacto', nombre: 'Ver detalle de contacto', grupo: 'Contactos' },
  { id: 'crear_contacto', nombre: 'Crear contacto', grupo: 'Contactos' },
  { id: 'crear_actividad', nombre: 'Crear actividad', grupo: 'Actividades' },
  { id: 'modificar_actividad', nombre: 'Modificar/eliminar actividad', grupo: 'Actividades' },
  { id: 'consultar_actividades', nombre: 'Consultar actividades', grupo: 'Actividades' },
  { id: 'crear_visita', nombre: 'Agendar visita', grupo: 'Visitas' },
  { id: 'modificar_visita', nombre: 'Modificar visita', grupo: 'Visitas' },
  { id: 'consultar_visitas', nombre: 'Consultar visitas', grupo: 'Visitas' },
  { id: 'crear_recordatorio', nombre: 'Crear recordatorio', grupo: 'Calendario' },
  { id: 'consultar_calendario', nombre: 'Consultar calendario', grupo: 'Calendario' },
  { id: 'modificar_evento', nombre: 'Modificar evento', grupo: 'Calendario' },
  { id: 'consultar_asistencias', nombre: 'Consultar asistencias', grupo: 'Asistencias' },
  { id: 'buscar_presupuestos', nombre: 'Buscar presupuestos', grupo: 'Presupuestos' },
  { id: 'modificar_presupuesto', nombre: 'Cambiar estado presupuesto', grupo: 'Presupuestos' },
  { id: 'anotar_nota', nombre: 'Crear nota', grupo: 'Notas' },
  { id: 'consultar_notas', nombre: 'Consultar notas', grupo: 'Notas' },
  { id: 'modificar_nota', nombre: 'Modificar/eliminar nota', grupo: 'Notas' },
]

interface ConfigCopiloto {
  habilitado: boolean
  nombre: string
  personalidad: string
  herramientas_habilitadas: string[]
  whatsapp_copilot_habilitado: boolean
  max_iteraciones_herramientas: number
}

// ==================== COMPONENTE PRINCIPAL ====================

export function SeccionIA() {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const { modulos, cargando: cargandoModulos, tieneModulo } = useModulos()
  const supabase = crearClienteNavegador()

  const tieneAlgunModuloIA = SLUGS_IA.some(slug => tieneModulo(slug))

  const [config, setConfig] = useState<ConfigIA>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [subSeccion, setSubSeccion] = useState<SubSeccion>('panel')
  const [keyVisible, setKeyVisible] = useState(false)

  const guardarEnServidor = useCallback(async (datos: Record<string, unknown>) => {
    if (!empresa) return false
    const { error } = await supabase
      .from('config_ia')
      .upsert({ empresa_id: empresa.id, ...datos, actualizado_en: new Date().toISOString() }, { onConflict: 'empresa_id' })
    return !error
  }, [empresa, supabase])

  const { estado, guardarInmediato, setSnapshot } = useAutoguardado({ onGuardar: guardarEnServidor })

  useEffect(() => {
    if (!empresa) return
    const cargar = async () => {
      setCargando(true)
      const { data } = await supabase.from('config_ia').select('*').eq('empresa_id', empresa.id).single()
      if (data) {
        const c: ConfigIA = { ...DEFAULTS, ...data }
        setConfig(c)
        setSnapshot(c as unknown as Record<string, unknown>)
      }
      setCargando(false)
    }
    cargar()
  }, [empresa, supabase, setSnapshot])

  const act = (cambios: Partial<ConfigIA>) => {
    setConfig(prev => ({ ...prev, ...cambios }))
    guardarInmediato(cambios as Record<string, unknown>)
  }

  const proveedorActivo = PROVEEDORES.find(p => p.id === config.proveedor_defecto) || PROVEEDORES[0]
  const keyField = `api_key_${proveedorActivo.id}` as keyof ConfigIA
  const modeloField = `modelo_${proveedorActivo.id}` as keyof ConfigIA
  const apiKey = config[keyField] as string
  const modeloActual = config[modeloField] as string

  const enmascararKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•••• •••• ••••'
    return '•••• •••• •••• ' + key.slice(-4)
  }

  if (cargando || cargandoModulos) return <CargadorSeccion />

  // Sin módulos de IA → estado bloqueado
  if (!tieneAlgunModuloIA) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center py-12 px-6 bg-superficie-tarjeta border border-borde-sutil rounded-xl">
          <div className="w-16 h-16 rounded-2xl bg-superficie-elevada flex items-center justify-center mb-4">
            <Sparkles size={28} strokeWidth={1.5} className="text-texto-terciario" />
          </div>
          <h3 className="text-base font-semibold text-texto-primario mb-2">
            No tenés módulos de IA instalados
          </h3>
          <p className="text-base text-texto-secundario max-w-md mb-6">
            Para configurar la inteligencia artificial, primero instalá al menos un módulo de IA desde la tienda de aplicaciones.
          </p>
          <a
            href="/aplicaciones"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white no-underline transition-colors"
            style={{ backgroundColor: 'var(--texto-marca)' }}
          >
            <Sparkles size={16} />
            Ir a {t('navegacion.aplicaciones')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-lg font-semibold text-texto-primario">Inteligencia Artificial</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-texto-marca/10 text-texto-marca">
              <Sparkles size={10} />
              Salix IA
            </span>
          </div>
          <p className="text-sm text-texto-terciario">
            Gestioná tu proveedor de IA, controlá el consumo y personalizá los asistentes.
          </p>
        </div>
        <IndicadorGuardado estado={estado} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-superficie-hover/50 rounded-lg p-1">
        {([
          { id: 'panel' as const, icono: <BarChart3 size={15} />, etiqueta: 'Panel' },
          { id: 'configuracion' as const, icono: <Settings2 size={15} />, etiqueta: 'Configuración' },
          { id: 'asistentes' as const, icono: <MessageSquare size={15} />, etiqueta: 'Asistentes' },
          { id: 'copiloto' as const, icono: <Zap size={15} />, etiqueta: 'Copiloto' },
        ]).map(s => (
          <Boton
            key={s.id}
            variante="fantasma"
            tamano="sm"
            icono={s.icono}
            onClick={() => setSubSeccion(s.id)}
            className={
              subSeccion === s.id ? '!bg-superficie-tarjeta !text-texto-primario !shadow-sm' : '!text-texto-terciario'
            }
          >
            <span className="hidden sm:inline">{s.etiqueta}</span>
          </Boton>
        ))}
      </div>

      {/* ==================== TAB: PANEL ==================== */}
      {subSeccion === 'panel' && (
        <div className="space-y-5">
          {/* Tarjeta de estado actual */}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
                  <proveedorActivo.Logo size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-texto-primario">{proveedorActivo.nombre}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      config.habilitado
                        ? 'bg-insignia-exito/10 text-insignia-exito'
                        : 'bg-superficie-hover text-texto-terciario'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.habilitado ? 'bg-insignia-exito' : 'bg-texto-terciario'}`} />
                      {config.habilitado ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-xs text-texto-terciario mt-0.5">
                    Modelo: {proveedorActivo.modelos.find(m => m.id === modeloActual)?.nombre || modeloActual}
                    {apiKey ? '' : ' · Sin API Key configurada'}
                  </p>
                </div>
              </div>
              <Boton
                variante="secundario"
                tamano="xs"
                icono={<ChevronRight size={14} />}
                onClick={() => setSubSeccion('configuracion')}
              >
                Configurar
              </Boton>
            </div>
          </div>

          {/* Dashboard de uso (incluye TarjetaSaldoIA + métricas) */}
          <PanelUsoIA proveedorActivo={config.proveedor_defecto} nombreProveedor={proveedorActivo.nombre} />
        </div>
      )}

      {/* ==================== TAB: CONFIGURACIÓN ==================== */}
      {subSeccion === 'configuracion' && (
        <div className="space-y-0">

          {/* ── SECCIÓN: PROVEEDOR Y ACCESO ── */}
          <SeccionConfig titulo="Proveedor y acceso" descripcion="Configurá el proveedor de IA y el acceso para tu empresa.">

            {/* Toggle habilitado */}
            <FilaConfig
              titulo="Salix IA"
              descripcion="Habilitá o deshabilitá la inteligencia artificial para toda la empresa. Cuando está deshabilitada, ningún usuario puede usar IA."
            >
              <Boton
                variante="fantasma"
                onClick={() => act({ habilitado: !config.habilitado })}
                className={`relative !w-11 !h-6 !rounded-full !p-0 shrink-0 ${
                  config.habilitado ? '!bg-texto-marca' : '!bg-borde-fuerte'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                  config.habilitado ? 'left-5.5' : 'left-0.5'
                }`} />
              </Boton>
            </FilaConfig>

            <Separador />

            {/* Proveedor */}
            <FilaConfig
              titulo="Proveedor de IA"
              descripcion="Elegí qué proveedor procesa las consultas de tu equipo. Cada proveedor tiene diferentes modelos, precios y capacidades."
              vertical
            >
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {PROVEEDORES.map(p => {
                  const seleccionado = config.proveedor_defecto === p.id
                  const tieneKey = !!(config[`api_key_${p.id}` as keyof ConfigIA])

                  return (
                    <button
                      key={p.id}
                      onClick={() => act({ proveedor_defecto: p.id })}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left bg-transparent cursor-pointer ${
                        seleccionado
                          ? 'border-texto-marca bg-texto-marca/5 shadow-sm'
                          : 'border-borde-sutil hover:border-borde-fuerte'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-superficie-hover flex items-center justify-center shrink-0">
                        <p.Logo size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold block ${seleccionado ? 'text-texto-marca' : 'text-texto-primario'}`}>
                          {p.nombre}
                        </span>
                        <span className="text-xs text-texto-terciario block truncate">{p.descripcion}</span>
                      </div>
                      <div className="absolute top-2 right-2">
                        {tieneKey ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-insignia-exito/10 text-insignia-exito">
                            <Check size={10} />
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-borde-fuerte block" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </FilaConfig>

            <Separador />

            {/* API Key */}
            <FilaConfig
              titulo={`API Key de ${proveedorActivo.nombre}`}
              descripcion="Tu clave se almacena cifrada y nunca es visible completa. Necesitás una API key para que Salix IA pueda funcionar."
              vertical
            >
              {/* Key actual */}
              {apiKey && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-insignia-exito/20 bg-insignia-exito/5 mb-3 w-full">
                  <Shield size={16} className="text-insignia-exito shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-texto-primario">API Key configurada</span>
                    <span className="text-xs text-texto-terciario font-mono ml-2">{enmascararKey(apiKey)}</span>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 w-full">
                <div className="flex-1">
                  <Input
                    tipo={keyVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, [keyField]: e.target.value }))}
                    placeholder={`sk-... o tu clave de ${proveedorActivo.nombre}`}
                    compacto
                    formato={null}
                    iconoDerecho={
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        titulo="Mostrar/ocultar clave"
                        icono={keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        onClick={() => setKeyVisible(!keyVisible)}
                      />
                    }
                  />
                </div>
                <Boton variante="primario" tamano="sm" onClick={() => act({ [keyField]: config[keyField] })}>
                  Guardar key
                </Boton>
              </div>

              {/* Link a consola */}
              {ENLACES_FACTURACION[proveedorActivo.id] && (
                <a
                  href={ENLACES_FACTURACION[proveedorActivo.id].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-texto-marca hover:underline no-underline mt-2"
                >
                  <ExternalLink size={12} />
                  Obtener API Key en {ENLACES_FACTURACION[proveedorActivo.id].etiqueta}
                </a>
              )}
            </FilaConfig>
          </SeccionConfig>

          {/* ── SECCIÓN: MODELO Y PARÁMETROS ── */}
          <SeccionConfig titulo="Modelo y parámetros" descripcion="Ajustá el modelo y los parámetros de generación de texto.">

            {/* Modelo */}
            <FilaConfig
              titulo="Modelo"
              descripcion="Para consultas de Salix IA recomendamos el modelo más rápido y económico — la diferencia en calidad de respuesta es mínima."
              vertical
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                {proveedorActivo.modelos.map(m => {
                  const seleccionado = modeloActual === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => act({ [modeloField]: m.id })}
                      className={`flex flex-col p-3 rounded-xl border transition-all text-left bg-transparent cursor-pointer ${
                        seleccionado
                          ? 'border-texto-marca bg-texto-marca/5'
                          : 'border-borde-sutil hover:border-borde-fuerte'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${seleccionado ? 'text-texto-marca' : 'text-texto-primario'}`}>
                        {m.nombre}
                      </span>
                      <span className="text-xs text-texto-terciario">{m.desc}</span>
                    </button>
                  )
                })}
              </div>
            </FilaConfig>

            <Separador />

            {/* Temperatura */}
            <FilaConfig
              titulo={`Temperatura (${config.temperatura})`}
              descripcion="Controla la creatividad de las respuestas. Más bajo = respuestas precisas y consistentes. Más alto = respuestas más variadas y creativas. Para un asistente recomendamos 0.2 — 0.3."
            >
              <div className="w-full max-w-xs">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.temperatura}
                  onChange={(e) => act({ temperatura: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-full appearance-none bg-borde-fuerte cursor-pointer"
                />
                <div className="flex justify-between text-xs text-texto-terciario mt-1.5">
                  <span>Preciso</span>
                  <span>Creativo</span>
                </div>
              </div>
            </FilaConfig>

            <Separador />

            {/* Máx tokens */}
            <FilaConfig
              titulo="Máx. tokens por respuesta"
              descripcion="Largo máximo de cada respuesta. 1024 es suficiente para la mayoría de consultas. Aumentalo solo si las respuestas se cortan."
            >
              <div className="w-32">
                <Input
                  tipo="number"
                  value={config.max_tokens.toString()}
                  onChange={(e) => act({ max_tokens: parseInt(e.target.value) || 4096 })}
                  compacto
                  formato={null}
                />
              </div>
            </FilaConfig>
          </SeccionConfig>

          {/* ── SECCIÓN: ACCESO A DATOS ── */}
          <SeccionConfig titulo="Acceso a datos" descripcion="Controlá qué módulos puede consultar la IA. Los datos siempre se filtran por los permisos individuales de cada usuario.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {MODULOS_DISPONIBLES.map(mod => {
                const activo = config.modulos_accesibles.includes(mod.id)
                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      const nuevos = activo
                        ? config.modulos_accesibles.filter(m => m !== mod.id)
                        : [...config.modulos_accesibles, mod.id]
                      act({ modulos_accesibles: nuevos })
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left bg-transparent cursor-pointer ${
                      activo ? 'border-texto-marca/30 bg-texto-marca/5' : 'border-borde-sutil hover:border-borde-fuerte'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      activo ? 'bg-texto-marca border-texto-marca' : 'bg-transparent border-borde-fuerte'
                    }`}>
                      {activo && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-texto-primario block">{mod.nombre}</span>
                      <span className="text-xs text-texto-terciario">{mod.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </SeccionConfig>
        </div>
      )}

      {/* ==================== TAB: ASISTENTES ==================== */}
      {subSeccion === 'asistentes' && (
        <div className="space-y-8">
          {/* Intro */}
          <p className="text-sm text-texto-terciario">
            Personalizá el comportamiento de los asistentes de IA. Cada sección configura un contexto diferente en el que Salix IA opera.
          </p>

          {/* Asistente General */}
          <AsistenteGeneral config={config} onActualizar={act} guardando={estado} />

          {/* Separador visual */}
          <div className="border-t border-white/[0.07]" />

          {/* Asistente de Presupuestos */}
          <AsistentePresupuestos config={config} onActualizar={act} />
        </div>
      )}

      {/* ==================== TAB: COPILOTO ==================== */}
      {subSeccion === 'copiloto' && (
        <TabCopiloto empresaId={empresa?.id} supabase={supabase} />
      )}
    </div>
  )
}

// ==================== TAB COPILOTO ====================

/** Tab de configuración de Salix IA Copiloto (chat flotante + WhatsApp) */
function TabCopiloto({ empresaId, supabase }: {
  empresaId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}) {
  const DEFAULTS_COPILOTO: ConfigCopiloto = {
    habilitado: false,
    nombre: 'Salix IA',
    personalidad: '',
    herramientas_habilitadas: HERRAMIENTAS_COPILOTO.map(h => h.id),
    whatsapp_copilot_habilitado: false,
    max_iteraciones_herramientas: 5,
  }

  const [copiloto, setCopiloto] = useState<ConfigCopiloto>(DEFAULTS_COPILOTO)
  const [cargando, setCargando] = useState(true)

  const guardarCopiloto = useCallback(async (datos: Record<string, unknown>) => {
    if (!empresaId) return false
    const { error } = await supabase
      .from('config_salix_ia')
      .upsert(
        { empresa_id: empresaId, ...datos, actualizado_en: new Date().toISOString() },
        { onConflict: 'empresa_id' }
      )
    return !error
  }, [empresaId, supabase])

  const { estado: estadoCopiloto, guardarInmediato: guardarCopilotoInm } = useAutoguardado({ onGuardar: guardarCopiloto })

  useEffect(() => {
    if (!empresaId) return
    const cargar = async () => {
      setCargando(true)
      const { data } = await supabase
        .from('config_salix_ia')
        .select('*')
        .eq('empresa_id', empresaId)
        .single()
      if (data) {
        setCopiloto({ ...DEFAULTS_COPILOTO, ...data })
      }
      setCargando(false)
    }
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, supabase])

  const actCop = (cambios: Partial<ConfigCopiloto>) => {
    setCopiloto(prev => ({ ...prev, ...cambios }))
    guardarCopilotoInm(cambios as Record<string, unknown>)
  }

  if (cargando) return <CargadorSeccion />

  // Agrupar herramientas por grupo
  const grupos = HERRAMIENTAS_COPILOTO.reduce<Record<string, typeof HERRAMIENTAS_COPILOTO>>((acc, h) => {
    if (!acc[h.grupo]) acc[h.grupo] = []
    acc[h.grupo].push(h)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-texto-terciario">
            Configurá el copiloto interno de Salix IA: el asistente que los miembros del equipo usan desde el chat flotante y por WhatsApp.
          </p>
        </div>
        <IndicadorGuardado estado={estadoCopiloto} />
      </div>

      {/* ── SECCIÓN: ESTADO GENERAL ── */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5 space-y-5">
        {/* Toggle habilitado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-texto-marca" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Copiloto Salix IA</h3>
              <p className="text-xs text-texto-terciario mt-0.5">
                Permite que los miembros usen el chat flotante dentro de Flux
              </p>
            </div>
          </div>
          <button
            onClick={() => actCop({ habilitado: !copiloto.habilitado })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-0 ${
              copiloto.habilitado ? 'bg-texto-marca' : 'bg-borde-fuerte'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              copiloto.habilitado ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Toggle WhatsApp copilot */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--canal-whatsapp)', opacity: 0.15 }}>
              <MessageSquare size={20} style={{ color: 'var(--canal-whatsapp)' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Copiloto por WhatsApp</h3>
              <p className="text-xs text-texto-terciario mt-0.5">
                Los miembros del equipo pueden enviar mensajes al número de WhatsApp de la empresa y son atendidos por Salix IA
              </p>
            </div>
          </div>
          <button
            onClick={() => actCop({ whatsapp_copilot_habilitado: !copiloto.whatsapp_copilot_habilitado })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-0 ${
              copiloto.whatsapp_copilot_habilitado ? 'bg-texto-marca' : 'bg-borde-fuerte'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              copiloto.whatsapp_copilot_habilitado ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* ── SECCIÓN: NOMBRE Y PERSONALIDAD ── */}
      <SeccionConfig titulo="Identidad del copiloto" descripcion="Personalizá el nombre y la personalidad de Salix IA para tu empresa.">
        <FilaConfig titulo="Nombre" descripcion="Cómo se presenta el copiloto al responder mensajes.">
          <div className="w-48">
            <Input
              value={copiloto.nombre}
              onChange={(e) => setCopiloto(prev => ({ ...prev, nombre: e.target.value }))}
              onBlur={() => actCop({ nombre: copiloto.nombre })}
              compacto
              formato={null}
            />
          </div>
        </FilaConfig>

        <Separador />

        <FilaConfig
          titulo="Personalidad"
          descripcion="Instrucciones adicionales sobre cómo debe responder: tono, estilo, restricciones específicas de tu empresa."
          vertical
        >
          <TextArea
            value={copiloto.personalidad}
            onChange={(e) => setCopiloto(prev => ({ ...prev, personalidad: e.target.value }))}
            onBlur={() => actCop({ personalidad: copiloto.personalidad })}
            rows={4}
            placeholder="Ej: Respondé siempre de manera formal. Cuando alguien pregunte por precios, aclará que son sin IVA..."
            compacto
          />
        </FilaConfig>

        <Separador />

        <FilaConfig
          titulo="Máx. iteraciones de herramientas"
          descripcion="Cuántas herramientas puede ejecutar en cadena antes de responder. Más = más preciso pero más lento y costoso."
        >
          <div className="w-20">
            <Input
              tipo="number"
              value={copiloto.max_iteraciones_herramientas.toString()}
              onChange={(e) => actCop({ max_iteraciones_herramientas: parseInt(e.target.value) || 5 })}
              compacto
              formato={null}
            />
          </div>
        </FilaConfig>
      </SeccionConfig>

      {/* ── SECCIÓN: HERRAMIENTAS ── */}
      <SeccionConfig titulo="Herramientas habilitadas" descripcion="Controlá qué acciones puede realizar el copiloto. Los permisos individuales de cada usuario siguen aplicando.">
        <div className="space-y-4">
          {/* Botones seleccionar/deseleccionar todo */}
          <div className="flex gap-2">
            <Boton
              variante="fantasma"
              tamano="xs"
              onClick={() => actCop({ herramientas_habilitadas: HERRAMIENTAS_COPILOTO.map(h => h.id) })}
            >
              Seleccionar todas
            </Boton>
            <Boton
              variante="fantasma"
              tamano="xs"
              onClick={() => actCop({ herramientas_habilitadas: [] })}
            >
              Deseleccionar todas
            </Boton>
          </div>

          {/* Herramientas agrupadas */}
          {Object.entries(grupos).map(([grupo, herramientas]) => (
            <div key={grupo}>
              <h4 className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-2">{grupo}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {herramientas.map(h => {
                  const activo = copiloto.herramientas_habilitadas.includes(h.id)
                  return (
                    <button
                      key={h.id}
                      onClick={() => {
                        const nuevas = activo
                          ? copiloto.herramientas_habilitadas.filter(id => id !== h.id)
                          : [...copiloto.herramientas_habilitadas, h.id]
                        actCop({ herramientas_habilitadas: nuevas })
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left bg-transparent cursor-pointer text-sm ${
                        activo
                          ? 'border-texto-marca/30 bg-texto-marca/5 text-texto-primario'
                          : 'border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        activo ? 'bg-texto-marca border-texto-marca' : 'bg-transparent border-borde-fuerte'
                      }`}>
                        {activo && <Check size={10} className="text-white" />}
                      </div>
                      {h.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </SeccionConfig>

      {/* Info */}
      <div className="rounded-xl bg-superficie-hover/40 p-4">
        <div className="flex items-start gap-2">
          <Shield size={14} className="text-texto-terciario shrink-0 mt-0.5" />
          <div className="text-xs text-texto-terciario space-y-1">
            <p><strong>Permisos individuales:</strong> Aunque una herramienta esté habilitada acá, cada usuario solo puede usarla si su rol tiene permiso para esa acción.</p>
            <p><strong>WhatsApp:</strong> Para que funcione el copiloto por WhatsApp, cada miembro debe tener su teléfono registrado en su perfil y Salix IA habilitado en su cuenta.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== LAYOUT HELPERS ====================

/** Sección con título y descripción, agrupa filas de configuración */
function SeccionConfig({ titulo, descripcion, children }: {
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-white/[0.07] pb-8 mb-8 last:border-b-0 last:mb-0 last:pb-0">
      <div className="mb-6">
        <h3 className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-1">{titulo}</h3>
        <p className="text-sm text-texto-terciario">{descripcion}</p>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  )
}

/** Fila de configuración: label+desc a la izquierda, control a la derecha. O vertical si se indica. */
function FilaConfig({ titulo, descripcion, children, vertical = false }: {
  titulo: string
  descripcion: string
  children: React.ReactNode
  vertical?: boolean
}) {
  if (vertical) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-texto-primario">{titulo}</h4>
          <p className="text-xs text-texto-terciario mt-0.5">{descripcion}</p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8">
      <div className="sm:w-1/2 sm:max-w-xs shrink-0">
        <h4 className="text-sm font-medium text-texto-primario">{titulo}</h4>
        <p className="text-xs text-texto-terciario mt-0.5">{descripcion}</p>
      </div>
      <div className="flex-1 flex items-center sm:justify-end">
        {children}
      </div>
    </div>
  )
}

function Separador() {
  return <div className="border-t border-white/[0.05]" />
}

// ==================== PROMPTS DEFAULTS ====================

const PROMPT_DEFAULT = `Sos Salix IA, el asistente inteligente integrado en Flux by Salix.

## Tu rol
Sos un asistente de negocio para el equipo de trabajo. Ayudás a consultar datos, resolver dudas operativas y dar información rápida sobre la empresa.

## Reglas de comportamiento
- Respondé siempre en español, de forma concisa y directa
- Usá máximo 2-3 oraciones por respuesta salvo que te pidan más detalle
- Cuando muestres datos (contactos, presupuestos, etc.) usá formato con saltos de línea, no párrafos largos
- Ejemplo de formato para un contacto:
  **Juan Pérez**
  📧 juan@empresa.com
  📱 +54 11 1234-5678
  🏷️ Cliente · Etapa: Negociación

## Restricciones
- Solo respondé sobre temas relacionados con la empresa y el software
- No respondas preguntas personales, recetas, chistes ni temas ajenos al negocio
- Si te preguntan algo fuera de alcance, decí: "Solo puedo ayudarte con temas de tu empresa dentro de Flux."
- Nunca inventes datos — si no tenés la información, decilo claramente
- Respetá los permisos del usuario: si no tiene acceso a un módulo, no le muestres esos datos

## Contexto
Tenés acceso a los módulos que el administrador habilitó. Siempre verificá que el usuario tenga permisos antes de mostrar información.`

const PROMPT_PRESUPUESTOS_DEFAULT = ''

// ==================== ASISTENTE GENERAL ====================

function AsistenteGeneral({ config, onActualizar, guardando }: {
  config: ConfigIA & { prompt_asistente?: string }
  onActualizar: (cambios: Partial<ConfigIA & { prompt_asistente: string }>) => void
  guardando: string
}) {
  const { t } = useTraduccion()
  const [prompt, setPrompt] = useState(config.prompt_asistente || PROMPT_DEFAULT)
  const [modalReset, setModalReset] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const esDefault = prompt === PROMPT_DEFAULT
  const modificado = prompt !== (config.prompt_asistente || PROMPT_DEFAULT)

  useEffect(() => {
    setPrompt(config.prompt_asistente || PROMPT_DEFAULT)
  }, [config.prompt_asistente])

  const guardar = () => {
    onActualizar({ prompt_asistente: prompt } as Partial<ConfigIA>)
  }

  const restablecer = () => {
    setPrompt(PROMPT_DEFAULT)
    onActualizar({ prompt_asistente: PROMPT_DEFAULT } as Partial<ConfigIA>)
    setModalReset(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
          <MessageSquare size={20} className="text-texto-marca" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-texto-primario">Asistente General</h3>
          <p className="text-xs text-texto-terciario mt-1">
            Configurá el comportamiento del <strong>chat flotante interno</strong> de Salix IA — el asistente que tu equipo usa dentro de Flux para consultar datos, resolver dudas y obtener información rápida.
          </p>
        </div>
      </div>

      {/* Editor de prompt */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-texto-primario">Instrucciones del asistente</span>
            {!esDefault && (
              <span className="text-xs bg-insignia-info/10 text-insignia-info px-1.5 py-0.5 rounded-full">Personalizado</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<RotateCcw size={12} />}
              onClick={() => setModalReset(true)}
              disabled={esDefault}
              className={esDefault ? 'opacity-30' : ''}
            >
              Restablecer
            </Boton>
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              titulo="Expandir editor"
              icono={<Maximize2 size={13} />}
              onClick={() => setExpandido(true)}
            />
          </div>
        </div>

        <div className="p-4">
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={guardar}
            placeholder="Escribí las instrucciones para el asistente..."
            variante="transparente"
            monoespacio
            compacto
            spellCheck={false}
            className="!text-xs !leading-relaxed"
            style={{ minHeight: '220px' }}
          />
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.07] flex items-center justify-between bg-superficie-hover/30">
          <span className="text-xs text-texto-terciario">
            {prompt.length} caracteres · Soporta Markdown
          </span>
          {modificado && (
            <Boton variante="primario" tamano="sm" onClick={guardar}>
              Guardar prompt
            </Boton>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl bg-superficie-hover/40 p-4">
        <h4 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2.5">Tips para un buen prompt</h4>
        <ul className="space-y-2 text-xs text-texto-terciario">
          {[
            'Definí el **rol** del asistente: qué es, para quién trabaja, en qué contexto.',
            'Indicá el **formato de respuesta**: corto, con saltos de línea, con emojis o sin ellos.',
            'Establecé **límites claros**: qué NO debe responder (temas fuera del negocio).',
            'Agregá **contexto de tu empresa**: rubro, productos, forma de atención, tono.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check size={14} className="text-insignia-exito shrink-0 mt-0.5" />
              <span dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      </div>

      {/* Modal expandido */}
      <Modal
        abierto={expandido}
        onCerrar={() => setExpandido(false)}
        titulo="Instrucciones del asistente"
        tamano="5xl"
        acciones={
          <div className="flex items-center gap-3">
            <span className="text-xs text-texto-terciario">{prompt.length} caracteres</span>
            <Boton variante="fantasma" tamano="sm" icono={<Minimize2 size={14} />} onClick={() => setExpandido(false)}>
              Minimizar
            </Boton>
            {modificado && (
              <Boton variante="primario" tamano="sm" onClick={() => { guardar(); setExpandido(false) }}>
                Guardar prompt
              </Boton>
            )}
          </div>
        }
      >
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribí las instrucciones para el asistente..."
          monoespacio
          spellCheck={false}
          autoFocus
          style={{ height: '70dvh' }}
        />
      </Modal>

      {modalReset && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => setModalReset(false)}
          onConfirmar={restablecer}
          titulo="¿Restablecer prompt?"
          descripcion="Se reemplazará tu prompt personalizado por el prompt por defecto de Salix IA. Esta acción no se puede deshacer."
          tipo="advertencia"
          etiquetaConfirmar="Restablecer"
        />
      )}
    </div>
  )
}

// ==================== ASISTENTE DE PRESUPUESTOS ====================

function AsistentePresupuestos({ config, onActualizar }: {
  config: ConfigIA
  onActualizar: (cambios: Partial<ConfigIA>) => void
}) {
  const [prompt, setPrompt] = useState(config.prompt_asistente_presupuestos || PROMPT_PRESUPUESTOS_DEFAULT)
  const [detalle, setDetalle] = useState(false)

  useEffect(() => {
    setPrompt(config.prompt_asistente_presupuestos || PROMPT_PRESUPUESTOS_DEFAULT)
  }, [config.prompt_asistente_presupuestos])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-insignia-info/10 flex items-center justify-center shrink-0">
          <Wand2 size={20} className="text-insignia-info" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-texto-primario">Asistente de Presupuestos</h3>
          <p className="text-xs text-texto-terciario mt-1">
            Configurá cómo Salix IA analiza descripciones de trabajo y propone líneas de presupuesto. Esto se usa cuando creás un presupuesto y activás el asistente.
          </p>
        </div>
      </div>

      {/* Comportamiento automático */}
      <div className="rounded-xl bg-superficie-hover/40 p-4">
        <button
          onClick={() => setDetalle(!detalle)}
          className="flex items-center gap-2 text-xs font-semibold text-texto-terciario uppercase tracking-wider bg-transparent border-none cursor-pointer p-0 hover:text-texto-secundario transition-colors w-full text-left"
        >
          Comportamiento automático
          <ChevronRight size={12} className={`transition-transform ${detalle ? 'rotate-90' : ''}`} />
        </button>
        {detalle && (
          <ul className="text-xs text-texto-terciario space-y-1.5 list-disc pl-4 mt-2.5">
            <li>Lee la descripción del trabajo y la desglosa en servicios/productos individuales</li>
            <li>Busca coincidencias exactas en el catálogo de productos de tu empresa</li>
            <li>Si no encuentra match exacto, propone crear un servicio nuevo con código y categoría</li>
            <li>Muestra sugerencias del catálogo que podrían coincidir para que elijas manualmente</li>
            <li>Redacta cada descripción de forma profesional, clara y técnica</li>
            <li>Respeta la nomenclatura de códigos existente de tu empresa</li>
          </ul>
        )}
      </div>

      {/* Prompt personalizado */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-medium text-texto-secundario">Instrucciones personalizadas</h4>
            <p className="text-xs text-texto-terciario mt-0.5">
              Agregá contexto de tu empresa: rubro, tipos de trabajo, terminología, aclaraciones.
            </p>
          </div>
          <Boton
            variante="fantasma"
            tamano="xs"
            icono={<RotateCcw size={12} />}
            onClick={() => {
              setPrompt(PROMPT_PRESUPUESTOS_DEFAULT)
              onActualizar({ prompt_asistente_presupuestos: PROMPT_PRESUPUESTOS_DEFAULT })
            }}
          >
            Restablecer
          </Boton>
        </div>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => onActualizar({ prompt_asistente_presupuestos: prompt })}
          rows={8}
          placeholder="Ej: Somos una empresa de herrería y reparación de portones. Un portón NO es lo mismo que una puerta peatonal..."
          monoespacio
        />
        <p className="text-[11px] text-texto-terciario mt-1.5">
          Este texto se envía junto con la descripción del trabajo. Usalo para aclarar terminología o reglas de tu negocio.
        </p>
      </div>
    </div>
  )
}

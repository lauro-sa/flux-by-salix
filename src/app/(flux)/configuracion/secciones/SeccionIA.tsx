'use client'

import { useState, useEffect, useCallback } from 'react'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import {
  Sparkles, MessageSquare, Wand2, Eye, EyeOff, RotateCcw, Maximize2, Minimize2,
  Check, Shield, Zap, CheckCircle,
} from 'lucide-react'
import { LogoAnthropic, LogoOpenAI, LogoGoogle, LogoXAI } from '@/componentes/ui/LogosIA'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { Modal } from '@/componentes/ui/Modal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useModulos } from '@/hooks/useModulos'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * SeccionIA — Configuración de inteligencia artificial.
 * Diseño: selector de proveedor con logos arriba, al elegir uno se muestra su config abajo.
 * El toggle habilita/deshabilita pero NO oculta el contenido.
 */

// ==================== PROVEEDORES ====================

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

type SubSeccion = 'salix-ia' | 'asistente-general' | 'asistente-creacion'

const SLUGS_IA = ['agente_ia', 'salix_ia', 'chatbot_inbox', 'automatizaciones']

export function SeccionIA() {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const { modulos, cargando: cargandoModulos, tieneModulo } = useModulos()
  const supabase = crearClienteNavegador()

  // Verificar si hay al menos un módulo de IA instalado
  const tieneAlgunModuloIA = SLUGS_IA.some(slug => tieneModulo(slug))

  const [config, setConfig] = useState<ConfigIA>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [subSeccion, setSubSeccion] = useState<SubSeccion>('salix-ia')
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

  // Si no tiene ningún módulo de IA → mostrar estado bloqueado
  if (!tieneAlgunModuloIA) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-texto-primario mb-1">Inteligencia Artificial</h2>
          <p className="text-sm text-texto-terciario">Configurá los proveedores de IA y los asistentes de tu empresa.</p>
        </div>

        <div className="flex flex-col items-center text-center py-12 px-6 bg-superficie-tarjeta border border-borde-sutil rounded-xl">
          <div className="w-16 h-16 rounded-2xl bg-superficie-elevada flex items-center justify-center mb-4">
            <Sparkles size={28} strokeWidth={1.5} className="text-texto-terciario" />
          </div>
          <h3 className="text-base font-semibold text-texto-primario mb-2">
            No tenés módulos de IA instalados
          </h3>
          <p className="text-sm text-texto-secundario max-w-md mb-6">
            Para configurar la inteligencia artificial, primero instalá al menos un módulo de IA desde la tienda de aplicaciones: Salix IA, Agente IA, Chatbot Inbox o Automatizaciones.
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-lg font-semibold text-texto-primario">Inteligencia Artificial</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-texto-marca/10 text-texto-marca">
              <Sparkles size={10} />
              Salix IA
            </span>
          </div>
          <p className="text-sm text-texto-terciario">Configurá los proveedores de IA y los asistentes de tu empresa.</p>
        </div>
        <IndicadorGuardado estado={estado} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-superficie-hover/50 rounded-lg p-1">
        {([
          { id: 'salix-ia' as const, icono: <Sparkles size={15} />, etiqueta: 'Salix IA' },
          { id: 'asistente-general' as const, icono: <MessageSquare size={15} />, etiqueta: 'Asistente General' },
          { id: 'asistente-creacion' as const, icono: <Wand2 size={15} />, etiqueta: 'Asistente de Creación' },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSubSeccion(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-transparent border-none cursor-pointer ${
              subSeccion === s.id ? 'bg-superficie-tarjeta text-texto-primario shadow-sm' : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            {s.icono}
            <span className="hidden sm:inline">{s.etiqueta}</span>
          </button>
        ))}
      </div>

      {/* ==================== SALIX IA ==================== */}
      {subSeccion === 'salix-ia' && (
        <div className="space-y-5">

          {/* Toggle + estado */}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-texto-marca/10 flex items-center justify-center">
                  <Zap size={20} className="text-texto-marca" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-texto-primario">Salix IA</h3>
                  <p className="text-xs text-texto-terciario">
                    {config.habilitado ? 'Habilitada para toda la empresa' : 'Deshabilitada — los usuarios no pueden usar IA'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => act({ habilitado: !config.habilitado })}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none shrink-0 ${
                  config.habilitado ? 'bg-texto-marca' : 'bg-borde-fuerte'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                  config.habilitado ? 'left-5.5' : 'left-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Elegí tu proveedor — siempre visible, se atenúa si está deshabilitado */}
          <div className={!config.habilitado ? 'opacity-40 pointer-events-none select-none' : ''}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-insignia-exito" />
              <h3 className="text-sm font-semibold text-texto-primario">Elegí tu {t('configuracion.ia.proveedor').toLowerCase()} de IA</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PROVEEDORES.map(p => {
                const seleccionado = config.proveedor_defecto === p.id
                const tieneKey = !!(config[`api_key_${p.id}` as keyof ConfigIA])

                return (
                  <button
                    key={p.id}
                    onClick={() => act({ proveedor_defecto: p.id })}
                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer text-left bg-superficie-tarjeta ${
                      seleccionado ? 'border-insignia-exito shadow-sm' : 'border-borde-sutil hover:border-borde-fuerte'
                    }`}
                  >
                    {/* Logo SVG oficial */}
                    <div className="w-10 h-10 rounded-xl bg-superficie-hover flex items-center justify-center shrink-0">
                      <p.Logo size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold block ${seleccionado ? 'text-insignia-exito' : 'text-texto-primario'}`}>
                        {p.nombre}
                      </span>
                      <span className="text-xs text-texto-terciario block truncate">{p.descripcion}</span>
                    </div>
                    {tieneKey && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-insignia-exito" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Config del proveedor seleccionado */}
          <div className={!config.habilitado ? 'opacity-40 pointer-events-none select-none' : ''}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-insignia-exito" />
              <h3 className="text-sm font-semibold text-texto-primario">
                Configurá tu {t('configuracion.ia.api_key')} de {proveedorActivo.nombre}
              </h3>
            </div>

            {/* Key actual si existe */}
            {apiKey && (
              <div className="bg-superficie-tarjeta border border-insignia-exito/20 rounded-xl p-4 mb-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-insignia-exito/10 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-insignia-exito" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-texto-primario block">{t('configuracion.ia.api_key')} configurada</span>
                  <span className="text-xs text-texto-terciario font-mono">{enmascararKey(apiKey)}</span>
                </div>
              </div>
            )}

            {/* Input para poner/reemplazar key */}
            <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-4">
              <label className="text-xs font-medium text-texto-secundario block mb-2">
                {apiKey ? `Reemplazar ${t('configuracion.ia.api_key')}` : `Ingresá tu ${t('configuracion.ia.api_key')}`}
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    tipo={keyVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, [keyField]: e.target.value }))}
                    placeholder={`sk-... o tu clave de ${proveedorActivo.nombre}`}
                    compacto
                    formato={null}
                    iconoDerecho={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setKeyVisible(!keyVisible)}
                        className="text-texto-terciario hover:text-texto-secundario bg-transparent border-none cursor-pointer p-0"
                      >
                        {keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                </div>
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={() => act({ [keyField]: config[keyField] })}
                >
                  {t('comun.guardar')} key
                </Boton>
              </div>
              <p className="text-xs text-texto-terciario mt-2">
                La API key se almacena cifrada y nunca es visible completa. Cada proveedor tiene su propia consola para ver el consumo.
              </p>
            </div>
          </div>

          {/* Modelo */}
          <div className={!config.habilitado ? 'opacity-40 pointer-events-none select-none' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-insignia-exito" />
              <h3 className="text-sm font-semibold text-texto-primario">Elegí el {t('configuracion.ia.modelo').toLowerCase()}</h3>
            </div>
            <p className="text-xs text-texto-terciario mb-3">
              Para consultas de Salix recomendamos el modelo más rápido y económico — la diferencia en calidad de respuesta es mínima.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {proveedorActivo.modelos.map(m => {
                const seleccionado = modeloActual === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => act({ [modeloField]: m.id })}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer bg-superficie-tarjeta ${
                      seleccionado ? 'border-texto-marca' : 'border-borde-sutil hover:border-borde-fuerte'
                    }`}
                  >
                    <span className={`text-sm font-semibold block ${seleccionado ? 'text-texto-marca' : 'text-texto-primario'}`}>
                      {m.nombre}
                    </span>
                    <span className="text-xs text-texto-terciario">{m.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Temperatura y tokens */}
          <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5 ${!config.habilitado ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-texto-secundario uppercase tracking-wider block mb-2">
                  Temperatura ({config.temperatura})
                </label>
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
                <p className="text-xs text-texto-terciario mt-2">
                  Para un asistente recomendamos <strong>0.2 — 0.3</strong>: respuestas directas y consistentes.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-texto-secundario uppercase tracking-wider block mb-2">
                  Máx. Tokens
                </label>
                <Input
                  tipo="number"
                  value={config.max_tokens.toString()}
                  onChange={(e) => act({ max_tokens: parseInt(e.target.value) || 4096 })}
                  compacto
                  formato={null}
                />
                <p className="text-xs text-texto-terciario mt-2">
                  Largo máximo de cada respuesta. <strong>1024</strong> es suficiente para la mayoría. Aumentalo solo si las respuestas se cortan.
                </p>
              </div>
            </div>
          </div>

          {/* Módulos accesibles */}
          <div className={!config.habilitado ? 'opacity-40 pointer-events-none select-none' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-insignia-exito" />
              <h3 className="text-sm font-semibold text-texto-primario">Módulos accesibles</h3>
            </div>
            <p className="text-xs text-texto-terciario mb-3">
              Qué datos puede consultar la IA. Siempre se filtran por los permisos del usuario que consulta.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer text-left ${
                      activo ? 'border-texto-marca/30 bg-texto-marca/5' : 'border-borde-sutil bg-transparent hover:bg-superficie-hover/50'
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
          </div>
        </div>
      )}

      {/* ==================== ASISTENTE GENERAL ==================== */}
      {subSeccion === 'asistente-general' && (
        <AsistenteGeneral config={config} onActualizar={act} guardando={estado} />
      )}

      {/* ==================== ASISTENTE DE CREACIÓN (PRESUPUESTOS) ==================== */}
      {subSeccion === 'asistente-creacion' && (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-insignia-info/10 flex items-center justify-center">
              <Wand2 size={20} className="text-insignia-info" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-texto-primario">Salix IA — Presupuestos</h3>
              <p className="text-xs text-texto-terciario">Configurá cómo Salix IA analiza descripciones de trabajo y propone líneas de presupuesto.</p>
            </div>
          </div>

          {/* Instrucciones generales (solo lectura) */}
          <div className="rounded-xl bg-superficie-hover/50 border border-borde-sutil p-4 mb-5">
            <p className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Comportamiento general (automático)</p>
            <ul className="text-xs text-texto-terciario space-y-1.5 list-disc pl-4">
              <li>Lee la descripción del trabajo y la desglosa en servicios/productos individuales</li>
              <li>Busca coincidencias exactas en el catálogo de productos de tu empresa</li>
              <li>Si no encuentra match exacto, propone crear un servicio nuevo con código y categoría</li>
              <li>Muestra sugerencias del catálogo que podrían coincidir para que elijas manualmente</li>
              <li>Redacta cada descripción de forma profesional, clara y técnica</li>
              <li>Respeta la nomenclatura de códigos existente de tu empresa</li>
            </ul>
          </div>

          {/* Prompt personalizado */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-texto-secundario">Instrucciones personalizadas</label>
                <p className="text-xs text-texto-terciario mt-0.5">
                  Agregá contexto de tu empresa: rubro, tipos de trabajo, terminología, aclaraciones.
                </p>
              </div>
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<RotateCcw size={12} />}
                onClick={() => {
                  act({ prompt_asistente_presupuestos: PROMPT_PRESUPUESTOS_DEFAULT })
                }}
              >
                Restablecer
              </Boton>
            </div>
            <textarea
              value={config.prompt_asistente_presupuestos || PROMPT_PRESUPUESTOS_DEFAULT}
              onChange={(e) => setConfig(prev => ({ ...prev, prompt_asistente_presupuestos: e.target.value }))}
              onBlur={() => act({ prompt_asistente_presupuestos: config.prompt_asistente_presupuestos })}
              rows={10}
              placeholder="Ej: Somos una empresa de herrería y reparación de portones. Un portón NO es lo mismo que una puerta peatonal..."
              className="w-full px-4 py-3 rounded-xl border border-borde-sutil bg-superficie-app text-sm text-texto-primario font-mono placeholder:text-texto-terciario/40 resize-y focus:outline-none focus:ring-2 focus:ring-texto-marca/30 focus:border-texto-marca transition-colors"
            />
            <p className="text-xxs text-texto-terciario mt-1.5">
              Este texto se envía junto con la descripción del trabajo. Usalo para aclarar terminología, reglas de tu negocio, o cualquier instrucción que la IA deba tener en cuenta.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== PROMPT DEFAULT ASISTENTE PRESUPUESTOS ====================

const PROMPT_PRESUPUESTOS_DEFAULT = ''

// ==================== PROMPT DEFAULT ====================

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

// ==================== COMPONENTE ASISTENTE GENERAL ====================

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

  // Sincronizar al cargar
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
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
            <MessageSquare size={20} className="text-texto-marca" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-texto-primario">{t('configuracion.ia.prompt_sistema')} del chat flotante</h3>
            <p className="text-sm text-texto-terciario mt-1">
              Este prompt configura el <strong>chat flotante interno de Salix IA</strong> — el asistente que aparece dentro de Flux para el equipo de trabajo. Se usa cuando un usuario hace preguntas, pide datos o necesita ayuda desde la app.
            </p>
            <p className="text-xs text-texto-terciario mt-2">
              No afecta al bot de WhatsApp, ni a los asistentes de creación, ni a otras integraciones externas. Dejalo vacío para usar el comportamiento por defecto.
            </p>
          </div>
        </div>
      </div>

      {/* Editor de prompt */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
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
              icono={<Maximize2 size={13} />}
              onClick={() => setExpandido(true)}
            />
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={guardar}
          placeholder="Escribí las instrucciones para el asistente..."
          className="w-full min-h-[400px] p-5 bg-transparent text-texto-primario text-sm leading-relaxed font-mono resize-y border-none outline-none placeholder:text-texto-terciario"
          spellCheck={false}
        />

        <div className="px-4 py-2.5 border-t border-borde-sutil flex items-center justify-between bg-superficie-hover/30">
          <span className="text-xs text-texto-terciario">
            {prompt.length} caracteres · Soporta Markdown
          </span>
          {modificado && (
            <Boton variante="primario" tamano="sm" onClick={guardar}>
              {t('comun.guardar')} prompt
            </Boton>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <h4 className="text-sm font-semibold text-texto-primario mb-3">Tips para un buen prompt</h4>
        <ul className="space-y-2 text-xs text-texto-terciario">
          <li className="flex items-start gap-2">
            <Check size={14} className="text-insignia-exito shrink-0 mt-0.5" />
            <span>Definí el <strong>rol</strong> del asistente: qué es, para quién trabaja, en qué contexto</span>
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="text-insignia-exito shrink-0 mt-0.5" />
            <span>Indicá el <strong>formato de respuesta</strong>: corto, con saltos de línea, con emojis o sin ellos</span>
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="text-insignia-exito shrink-0 mt-0.5" />
            <span>Establecé <strong>límites claros</strong>: qué NO debe responder (temas fuera del negocio)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="text-insignia-exito shrink-0 mt-0.5" />
            <span>Agregá <strong>contexto de tu empresa</strong>: rubro, productos, forma de atención, tono de comunicación</span>
          </li>
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
                {t('comun.guardar')} prompt
              </Boton>
            )}
          </div>
        }
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribí las instrucciones para el asistente..."
          className="w-full h-[70vh] p-4 bg-superficie-app text-texto-primario text-sm leading-relaxed font-mono resize-none border border-borde-sutil rounded-lg outline-none focus:border-borde-foco placeholder:text-texto-terciario"
          spellCheck={false}
          autoFocus
        />
      </Modal>

      {/* Modal restablecer */}
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Brain, MessageSquare, BookOpen, AlertTriangle, Activity, Plus, Pencil, Trash2, X, Maximize2, Globe, FileUp, Loader2 } from 'lucide-react'
import { Interruptor, Select, Input, Boton, Modal, Insignia } from '@/componentes/ui'
import type { ConfigAgenteIA, EntradaBaseConocimiento, LogAgenteIA } from '@/tipos/inbox'

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
}

// ─── Tabs ───

const TABS = [
  { id: 'general', etiqueta: 'General', icono: <Sparkles size={14} /> },
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

  // Guardar (autoguardado al cambiar) — usa setter funcional para evitar stale closures
  const guardar = useCallback(async (cambios: Partial<ConfigAgenteIA>) => {
    let nueva: ConfigAgenteIA = CONFIG_DEFAULTS
    setConfig(prev => {
      nueva = { ...prev, ...cambios }
      return nueva
    })
    // Pequeño delay para que el setState se procese
    await new Promise(r => setTimeout(r, 0))
    try {
      await fetch('/api/inbox/agente-ia/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
    } catch { /* silenciar */ }
  }, [])

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
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Agente IA
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
          etiqueta="Nombre del agente"
          value={config.nombre}
          onChange={(e) => guardar({ nombre: e.target.value })}
          placeholder="Valentina"
        />
        <Input
          etiqueta="Apodo (cómo le dicen)"
          value={config.apodo}
          onChange={(e) => guardar({ apodo: e.target.value })}
          placeholder="Vale, Valen..."
          ayuda="Opcional. Si el cliente lo llama por apodo, el agente lo reconoce."
        />
        <TextareaExpandible
          etiqueta="Personalidad"
          valor={config.personalidad}
          onChange={(v) => guardar({ personalidad: v })}
          placeholder="Sos un asistente profesional de ventas. Siempre amable y resolutivo..."
        />
        <TextareaExpandible
          etiqueta="Instrucciones del negocio"
          valor={config.instrucciones}
          onChange={(v) => guardar({ instrucciones: v })}
          placeholder="Horario: L-V 9-18hs. No ofrecer descuentos mayores al 15%. Derivar temas legales..."
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
          etiqueta="Modo de activación"
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
          etiqueta="Esperar antes de responder (segundos)"
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
          etiqueta="Tono"
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
          etiqueta="Largo de respuestas"
          valor={config.largo_respuesta}
          onChange={(v) => guardar({ largo_respuesta: v as ConfigAgenteIA['largo_respuesta'] })}
          opciones={[
            { valor: 'corto', etiqueta: 'Corto — 1 oración' },
            { valor: 'medio', etiqueta: 'Medio — 1 a 3 oraciones' },
            { valor: 'largo', etiqueta: 'Largo — 1 párrafo' },
          ]}
        />
        <Input
          etiqueta="Firma"
          value={config.firmar_como}
          onChange={(e) => guardar({ firmar_como: e.target.value })}
          placeholder="— Equipo de Soporte"
        />
        <Input
          etiqueta="Máx. respuestas seguidas sin humano"
          tipo="number"
          value={String(config.max_mensajes_auto)}
          onChange={(e) => guardar({ max_mensajes_auto: parseInt(e.target.value) || 5 })}
        />
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════
// Tab: Conocimiento
// ═══════════════════════════════════════════════

function TabConocimiento({ config, guardar }: TabProps) {
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
    }
    setModalAbierto(false)
    setEntradaEditando(null)
  }

  const eliminarEntrada = async (id: string) => {
    await fetch(`/api/inbox/agente-ia/base-conocimiento/${id}`, { method: 'DELETE' })
    setEntradas(prev => prev.filter(e => e.id !== id))
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
            etiqueta="Título"
            value={entradaEditando?.titulo || ''}
            onChange={(e) => setEntradaEditando(prev => prev ? { ...prev, titulo: e.target.value } : prev)}
            placeholder="Política de devoluciones"
          />
          <Select
            etiqueta="Categoría"
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

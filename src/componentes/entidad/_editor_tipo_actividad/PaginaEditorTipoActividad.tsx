'use client'

/**
 * PaginaEditorTipoActividad — Editor pantalla completa de tipos de actividad.
 * Reemplaza al modal ModalTipoActividad manteniendo toda la funcionalidad.
 *
 * Layout:
 * - Panel izq: ícono + preview + vencimiento + campos visibles + comportamiento
 * - Main: identidad (nombre, abreviación, color), módulos, siguiente actividad, valores por defecto
 */

import { useEffect, useState, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Save, Trash2, Check, Pipette } from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { MiniSelectorIcono } from '@/componentes/ui/MiniSelectorIcono'
import { PickerHSL } from '@/componentes/ui/_editor_texto/PickerHSL'
import { AnimatePresence, motion } from 'framer-motion'
import { PALETA_COLORES_TIPO_ACTIVIDAD } from '@/lib/colores_entidad'
import { useToast } from '@/componentes/feedback/Toast'
import type { TipoActividad } from '@/app/(flux)/actividades/configuracion/_tipos'

// ─── Constantes ───

const COLORES_TIPO = PALETA_COLORES_TIPO_ACTIVIDAD

const ICONOS_RAPIDOS = [
  'Phone', 'PhoneCall', 'Video', 'Mail', 'MessageSquare', 'MessageCircle',
  'Calendar', 'CalendarCheck', 'Clock', 'Timer', 'Bell', 'BellRing',
  'FileText', 'File', 'ClipboardList', 'ClipboardCheck', 'NotebookPen', 'BookOpen',
  'MapPin', 'Map', 'Navigation', 'Truck', 'Car', 'Plane',
  'Wrench', 'Hammer', 'Settings', 'Cog', 'Tool', 'PenTool',
  'DollarSign', 'CreditCard', 'Wallet', 'Receipt', 'ShoppingCart', 'ShoppingBag',
  'Package', 'Box', 'Archive', 'FolderOpen', 'Inbox', 'Send',
  'Users', 'UserPlus', 'UserCheck', 'Building2', 'Briefcase', 'GraduationCap',
  'Target', 'Flag', 'Award', 'Trophy', 'Star', 'Heart',
  'Zap', 'Rocket', 'Sparkles', 'Activity', 'TrendingUp', 'BarChart3',
  'AlertCircle', 'CheckCircle', 'XCircle', 'Info', 'HelpCircle', 'Shield',
  'Upload', 'Download', 'Link', 'Globe', 'Wifi', 'Camera',
]

const CAMPOS_DISPONIBLES = [
  { clave: 'campo_fecha', etiqueta: 'Fecha de vencimiento' },
  { clave: 'campo_descripcion', etiqueta: 'Descripción' },
  { clave: 'campo_responsable', etiqueta: 'Responsable' },
  { clave: 'campo_prioridad', etiqueta: 'Prioridad' },
  { clave: 'campo_checklist', etiqueta: 'Checklist' },
  { clave: 'campo_calendario', etiqueta: 'Agendar en calendario' },
]

/** Genera abreviación automática: iniciales de palabras significativas, o primeras 4 letras si es una sola palabra */
function generarAbreviacion(etiqueta: string): string {
  const stopWords = ['en', 'de', 'del', 'la', 'el', 'a', 'y', 'o', 'por', 'para', 'con', 'sin', 'al', 'los', 'las', 'un', 'una']
  const palabras = etiqueta.split(/\s+/).filter(p => p.length > 0 && !stopWords.includes(p.toLowerCase()))
  if (palabras.length >= 2) return palabras.map(p => p[0].toUpperCase()).join('')
  const palabra = palabras[0] || etiqueta
  return palabra.slice(0, palabra.length <= 5 ? palabra.length : 4).toUpperCase()
}

interface Props {
  tipo: TipoActividad | null
  tipos: TipoActividad[]
  miembros: { usuario_id: string; nombre: string; apellido: string }[]
  modulosDisponibles: { clave: string; etiqueta: string; grupo?: string }[]
  rutaVolver: string
  textoVolver?: string
}

export function PaginaEditorTipoActividad({
  tipo,
  tipos,
  miembros,
  modulosDisponibles,
  rutaVolver,
  textoVolver = 'Tipos de actividad',
}: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const esEdicion = !!tipo
  const esSistema = tipo?.es_sistema ?? false
  const [guardando, setGuardando] = useState(false)

  // Estado del formulario
  const [etiqueta, setEtiqueta] = useState(tipo?.etiqueta || '')
  const [abreviacion, setAbreviacion] = useState(tipo?.abreviacion || '')
  const [abreviacionManual, setAbreviacionManual] = useState(!!tipo?.abreviacion)
  const [clave, setClave] = useState(tipo?.clave || '')
  const [icono, setIcono] = useState(tipo?.icono || 'Activity')
  const [color, setColor] = useState(tipo?.color || '#5b5bd6')
  const [modulos, setModulos] = useState<string[]>(tipo?.modulos_disponibles || ['contactos'])
  const [diasVencimiento, setDiasVencimiento] = useState(tipo?.dias_vencimiento ?? 1)
  const [campos, setCampos] = useState({
    campo_fecha: tipo?.campo_fecha ?? true,
    campo_descripcion: tipo?.campo_descripcion ?? true,
    campo_responsable: tipo?.campo_responsable ?? true,
    campo_prioridad: tipo?.campo_prioridad ?? false,
    campo_checklist: tipo?.campo_checklist ?? false,
    campo_calendario: tipo?.campo_calendario ?? false,
  })
  const [autoCompletar, setAutoCompletar] = useState(tipo?.auto_completar ?? false)
  const [resumenPredeterminado, setResumenPredeterminado] = useState(tipo?.resumen_predeterminado || '')
  const [notaPredeterminada, setNotaPredeterminada] = useState(tipo?.nota_predeterminada || '')
  const [usuarioPredeterminado, setUsuarioPredeterminado] = useState(tipo?.usuario_predeterminado || '')
  const [siguienteTipoId, setSiguienteTipoId] = useState(tipo?.siguiente_tipo_id || '')
  const [tipoEncadenamiento, setTipoEncadenamiento] = useState<'sugerir' | 'activar'>(tipo?.tipo_encadenamiento || 'sugerir')

  // Picker de color
  const [pickerAbierto, setPickerAbierto] = useState(false)
  const pickerBotonRef = useRef<HTMLButtonElement>(null)
  const pickerDropdownRef = useRef<HTMLDivElement>(null)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!pickerAbierto || !pickerBotonRef.current) return
    const rect = pickerBotonRef.current.getBoundingClientRect()
    setPickerPos({ top: rect.bottom + 6, left: rect.left })
  }, [pickerAbierto])

  useEffect(() => {
    if (!pickerAbierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerBotonRef.current?.contains(target)) return
      if (pickerDropdownRef.current?.contains(target)) return
      setPickerAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerAbierto])

  // ─── Auto-generar clave + abreviación al tipear ───
  const manejarEtiqueta = (valor: string) => {
    setEtiqueta(valor)
    if (!esEdicion) {
      setClave(valor.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    }
    if (!abreviacionManual && valor.trim()) {
      setAbreviacion(generarAbreviacion(valor.trim()))
    } else if (!valor.trim()) {
      setAbreviacion('')
    }
  }

  const toggleModulo = (mod: string) => {
    setModulos(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])
  }

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!etiqueta.trim()) {
      mostrar('error', 'El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const datos: Record<string, unknown> = {
        etiqueta: etiqueta.trim(),
        abreviacion: abreviacion.trim() || null,
        icono,
        color,
        modulos_disponibles: modulos,
        dias_vencimiento: diasVencimiento,
        auto_completar: autoCompletar,
        resumen_predeterminado: resumenPredeterminado.trim() || null,
        nota_predeterminada: notaPredeterminada.trim() || null,
        usuario_predeterminado: usuarioPredeterminado || null,
        siguiente_tipo_id: siguienteTipoId || null,
        tipo_encadenamiento: tipoEncadenamiento,
        ...campos,
      }
      if (esEdicion) datos.id = tipo!.id
      else datos.clave = clave

      const res = await fetch('/api/actividades/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: esEdicion ? 'editar_tipo' : 'crear_tipo',
          datos,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al guardar')
      }
      mostrar('exito', esEdicion ? 'Tipo actualizado' : 'Tipo creado')
      router.push(rutaVolver)
    } catch (err) {
      mostrar('error', (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (!tipo || esSistema || tipo.es_predefinido) return
    if (!confirm(`¿Eliminar el tipo "${tipo.etiqueta}"? Las actividades existentes no se verán afectadas.`)) return
    try {
      const res = await fetch('/api/actividades/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'eliminar_tipo', datos: { id: tipo.id } }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Tipo eliminado')
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al eliminar')
    }
  }

  // ─── Acciones del cabecero ───
  const acciones = [
    ...(esEdicion && !esSistema && !tipo?.es_predefinido ? [{
      id: 'eliminar',
      etiqueta: 'Eliminar',
      icono: <Trash2 size={14} />,
      onClick: handleEliminar,
      variante: 'peligro' as const,
      alineadoIzquierda: true,
    }] : []),
    {
      id: 'guardar',
      etiqueta: esEdicion ? 'Guardar' : 'Crear tipo',
      icono: <Save size={14} />,
      onClick: handleGuardar,
      variante: 'primario' as const,
      cargando: guardando,
      deshabilitado: !etiqueta.trim(),
    },
  ]

  const IconoPreview = obtenerIcono(icono)
  const IconoMostrar: typeof IconoPreview = IconoPreview || (() => null)

  // ─── Panel izq: preview + vencimiento + campos + comportamiento ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Preview */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Vista previa
        </label>
        <div className="flex items-center gap-3 p-3 rounded-card border border-borde-sutil bg-superficie-tarjeta">
          <div
            className="size-10 rounded-card flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <IconoMostrar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-texto-primario truncate">{etiqueta || 'Nombre del tipo'}</p>
            {abreviacion && (
              <p className="text-xxs font-mono text-texto-terciario tracking-wider">{abreviacion}</p>
            )}
          </div>
        </div>
      </div>

      {/* Vencimiento */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Vencimiento
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[{ d: 0, label: 'Sin plazo' }, { d: 1, label: '1 día' }, { d: 2, label: '2 días' }, { d: 5, label: '5 días' }, { d: 7, label: '7 días' }].map(({ d, label }) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiasVencimiento(d)}
              className={`px-2.5 py-1 rounded-boton text-xs font-medium transition-all cursor-pointer border ${
                diasVencimiento === d
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte hover:text-texto-secundario'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Campos visibles */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Campos visibles
        </label>
        <div className="space-y-1.5">
          {CAMPOS_DISPONIBLES.map(campo => (
            <div
              key={campo.clave}
              className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-card border border-white/[0.06] bg-white/[0.03]"
            >
              <span className="text-xs text-texto-secundario">{campo.etiqueta}</span>
              <Interruptor
                activo={campos[campo.clave as keyof typeof campos]}
                onChange={(v) => setCampos(prev => ({ ...prev, [campo.clave]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Comportamiento */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Comportamiento
        </label>
        <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-card border border-white/[0.06] bg-white/[0.03]">
          <div>
            <p className="text-xs font-medium text-texto-secundario">Auto-completar al ejecutar</p>
            <p className="text-[11px] text-texto-terciario mt-0.5">Se completa al crear el documento</p>
          </div>
          <Interruptor activo={autoCompletar} onChange={setAutoCompletar} />
        </div>
      </div>
    </div>
  )

  return (
    <PlantillaEditor
      titulo={esEdicion ? (etiqueta || tipo?.etiqueta || 'Editar tipo') : 'Nuevo tipo de actividad'}
      subtitulo="Tipo de actividad — se usa en el selector al crear actividades"
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ IDENTIDAD: Ícono + Nombre + Abreviación + Colores ═══ */}
      <div className="space-y-4 pb-4 border-b border-borde-sutil">
        <div className="flex items-start gap-3">
          <MiniSelectorIcono valor={icono} color={color} onChange={setIcono} iconosRapidos={ICONOS_RAPIDOS} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  tipo="text"
                  value={etiqueta}
                  onChange={(e) => manejarEtiqueta(e.target.value)}
                  placeholder="Nombre: Llamada, Reunión, Visita..."
                  autoFocus
                  className="!text-base !font-semibold"
                />
              </div>
              <div className="w-20 shrink-0">
                <Input
                  tipo="text"
                  value={abreviacion}
                  onChange={(e) => { setAbreviacion(e.target.value.toUpperCase().slice(0, 6)); setAbreviacionManual(true) }}
                  placeholder="AUTO"
                  className="text-center text-[13px] tracking-wider"
                />
              </div>
            </div>
            {/* Colores inline */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {COLORES_TIPO.map(preset => {
                const sel = color.toLowerCase() === preset.color.toLowerCase()
                return (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => { setColor(preset.color); setPickerAbierto(false) }}
                    className={`relative size-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                      sel ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110' : ''
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    {sel && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                )
              })}
              {/* Gotero */}
              <div className="relative">
                <button
                  ref={pickerBotonRef}
                  type="button"
                  onClick={() => setPickerAbierto(!pickerAbierto)}
                  className={`relative size-5 rounded-full border border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                    pickerAbierto || !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                      ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110 border-transparent'
                      : 'border-borde-fuerte'
                  }`}
                  style={!COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? { backgroundColor: color } : undefined}
                  title="Color personalizado"
                >
                  {!COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                    ? <Check size={9} className="text-white drop-shadow-sm" />
                    : <Pipette size={9} className="text-texto-terciario" />}
                </button>
                {typeof window !== 'undefined' && createPortal(
                  <AnimatePresence>
                    {pickerAbierto && (
                      <motion.div
                        ref={pickerDropdownRef}
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="fixed bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden"
                        style={{ top: pickerPos.top, left: pickerPos.left, zIndex: 200 }}
                      >
                        <PickerHSL
                          valorInicial={color}
                          onAplicar={(c) => { setColor(c); setPickerAbierto(false) }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>,
                  document.body,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DISPONIBLE EN (módulos) ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Disponible en
        </label>
        <div className="flex flex-wrap gap-1.5">
          {modulosDisponibles.map(mod => {
            const activo = modulos.includes(mod.clave)
            return (
              <button
                key={mod.clave}
                type="button"
                onClick={() => toggleModulo(mod.clave)}
                className={`px-2.5 py-1 rounded-boton text-xs font-medium transition-all cursor-pointer border ${
                  activo
                    ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                    : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte hover:text-texto-secundario'
                }`}
              >
                {mod.etiqueta}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ SIGUIENTE ACTIVIDAD (encadenamiento) ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Siguiente actividad
        </label>
        <Select
          valor={siguienteTipoId}
          onChange={setSiguienteTipoId}
          placeholder="Ninguna — no encadenar"
          opciones={tipos.filter(t => t.activo && t.id !== tipo?.id).map(t => ({ valor: t.id, etiqueta: t.etiqueta }))}
        />
        {siguienteTipoId && (
          <div className="flex gap-1.5 mt-2">
            {(['sugerir', 'activar'] as const).map(modo => (
              <button
                key={modo}
                type="button"
                onClick={() => setTipoEncadenamiento(modo)}
                className={`flex-1 px-2.5 py-1.5 rounded-boton text-xs font-medium transition-all cursor-pointer border ${
                  tipoEncadenamiento === modo
                    ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                    : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
                }`}
              >
                {modo === 'sugerir' ? 'Sugerir al usuario' : 'Crear automática'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ VALORES POR DEFECTO ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Valores por defecto
        </label>
        <div className="space-y-2">
          <Input
            tipo="text"
            value={resumenPredeterminado}
            onChange={(e) => setResumenPredeterminado(e.target.value)}
            placeholder='Título: "Hablar sobre la propuesta"'
          />
          <Input
            tipo="text"
            value={notaPredeterminada}
            onChange={(e) => setNotaPredeterminada(e.target.value)}
            placeholder='Nota: "Revisar la oferta y hablar sobre los detalles"'
          />
          <Select
            valor={usuarioPredeterminado}
            onChange={setUsuarioPredeterminado}
            placeholder="Responsable: Sin asignar"
            opciones={miembros.map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}`.trim() }))}
          />
        </div>
      </div>
    </PlantillaEditor>
  )
}

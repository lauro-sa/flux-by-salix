'use client'

import { useState, useEffect, useRef } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Trash2, Check, Pipette, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import type { TipoActividad } from './SeccionTipos'
import { PALETA_COLORES_TIPO_ACTIVIDAD } from '@/lib/colores_entidad'

/**
 * ModalTipoActividad — Modal para crear o editar un tipo de actividad.
 * Incluye: nombre, icono, color (presets + gotero), módulos donde aplica,
 * vencimiento por defecto en días, campos habilitados.
 */

interface PropiedadesModal {
  abierto: boolean
  tipo: TipoActividad | null
  tipos: TipoActividad[]
  miembros: { usuario_id: string; nombre: string; apellido: string }[]
  modulosDisponibles: { clave: string; etiqueta: string; grupo?: string }[]
  guardando: boolean
  onGuardar: (datos: Record<string, unknown>) => void
  onCerrar: () => void
  onEliminar?: () => void
}

// Colores predefinidos para tipos de actividad (centralizados en colores_entidad.ts)
const COLORES_TIPO = PALETA_COLORES_TIPO_ACTIVIDAD

// Iconos populares para el mini selector inline
const ICONOS_RAPIDOS = [
  'Phone', 'Video', 'Mail', 'MessageSquare', 'Calendar', 'Clock',
  'FileText', 'ClipboardList', 'MapPin', 'Truck', 'Wrench', 'Hammer',
  'DollarSign', 'CreditCard', 'ShoppingCart', 'Package', 'Send', 'Upload',
  'Users', 'UserPlus', 'Building2', 'Briefcase', 'Target', 'Flag',
  'Star', 'Heart', 'Zap', 'AlertCircle', 'CheckCircle', 'Activity',
]

/** Mini selector de icono — popover compacto con búsqueda */
function MiniSelectorIcono({ valor, color, onChange }: { valor: string; color: string; onChange: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)
  const IconoActual = obtenerIcono(valor)

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const iconosFiltrados = busqueda.trim()
    ? Object.keys(LucideIcons).filter(k =>
        k !== 'default' && k !== 'createLucideIcon' && typeof (LucideIcons as Record<string, unknown>)[k] === 'object' &&
        k.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 40)
    : ICONOS_RAPIDOS

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button onClick={() => { setAbierto(!abierto); setBusqueda('') }}
        className="size-11 rounded-xl flex items-center justify-center cursor-pointer border border-borde-sutil hover:border-texto-marca/40 transition-colors"
        style={{ backgroundColor: color + '15', color }}
        title="Cambiar icono">
        {IconoActual && <IconoActual size={20} />}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg overflow-hidden w-[260px]"
          >
            {/* Buscador */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
              <Search size={13} className="text-texto-terciario shrink-0" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar icono..."
                className="flex-1 bg-transparent border-none text-xs text-texto-primario placeholder:text-texto-terciario outline-none"
                autoFocus />
            </div>
            {/* Grilla de iconos */}
            <div className="grid grid-cols-6 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
              {iconosFiltrados.map(nombre => {
                const Ic = obtenerIcono(nombre)
                if (!Ic) return null
                const sel = valor === nombre
                return (
                  <button key={nombre} onClick={() => { onChange(nombre); setAbierto(false) }}
                    className={`size-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors border-none ${
                      sel ? 'bg-texto-marca/15 text-texto-marca' : 'bg-transparent text-texto-terciario hover:bg-superficie-hover hover:text-texto-primario'
                    }`} title={nombre}>
                    <Ic size={16} />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Campos configurables por tipo
const CAMPOS_DISPONIBLES = [
  { clave: 'campo_fecha', etiqueta: 'Fecha de vencimiento', descripcion: 'Permite asignar una fecha límite' },
  { clave: 'campo_descripcion', etiqueta: 'Descripción', descripcion: 'Campo de texto para detalles' },
  { clave: 'campo_responsable', etiqueta: 'Responsable', descripcion: 'Asignar a un miembro del equipo' },
  { clave: 'campo_prioridad', etiqueta: 'Prioridad', descripcion: 'Nivel de urgencia (baja, normal, alta)' },
  { clave: 'campo_checklist', etiqueta: 'Checklist', descripcion: 'Lista de tareas dentro de la actividad' },
  { clave: 'campo_calendario', etiqueta: 'Agendar en calendario', descripcion: 'Al crear, permite agendar bloques en el calendario' },
]

function ModalTipoActividad({ abierto, tipo, tipos, miembros, modulosDisponibles, guardando, onGuardar, onCerrar, onEliminar }: PropiedadesModal) {
  const esEdicion = !!tipo

  // Estado del formulario
  const [etiqueta, setEtiqueta] = useState('')
  const [clave, setClave] = useState('')
  const [icono, setIcono] = useState('Activity')
  const [color, setColor] = useState('#5b5bd6')
  const [modulos, setModulos] = useState<string[]>(['contactos'])
  const [diasVencimiento, setDiasVencimiento] = useState(1)
  const [campos, setCampos] = useState({
    campo_fecha: true,
    campo_descripcion: true,
    campo_responsable: true,
    campo_prioridad: false,
    campo_checklist: false,
    campo_calendario: false,
  })
  const [autoCompletar, setAutoCompletar] = useState(false)
  const [resumenPredeterminado, setResumenPredeterminado] = useState('')
  const [notaPredeterminada, setNotaPredeterminada] = useState('')
  const [usuarioPredeterminado, setUsuarioPredeterminado] = useState('')
  const [siguienteTipoId, setSiguienteTipoId] = useState('')
  const [tipoEncadenamiento, setTipoEncadenamiento] = useState<'sugerir' | 'activar'>('sugerir')
  // Ref para el input color nativo (gotero)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Inicializar al abrir
  useEffect(() => {
    if (!abierto) return
    if (tipo) {
      setEtiqueta(tipo.etiqueta)
      setClave(tipo.clave)
      setIcono(tipo.icono)
      setColor(tipo.color)
      setModulos(tipo.modulos_disponibles)
      setDiasVencimiento(tipo.dias_vencimiento)
      setCampos({
        campo_fecha: tipo.campo_fecha,
        campo_descripcion: tipo.campo_descripcion,
        campo_responsable: tipo.campo_responsable,
        campo_prioridad: tipo.campo_prioridad,
        campo_checklist: tipo.campo_checklist,
        campo_calendario: tipo.campo_calendario ?? false,
      })
      setAutoCompletar(tipo.auto_completar ?? false)
      setResumenPredeterminado(tipo.resumen_predeterminado || '')
      setNotaPredeterminada(tipo.nota_predeterminada || '')
      setUsuarioPredeterminado(tipo.usuario_predeterminado || '')
      setSiguienteTipoId(tipo.siguiente_tipo_id || '')
      setTipoEncadenamiento(tipo.tipo_encadenamiento || 'sugerir')
    } else {
      setEtiqueta('')
      setClave('')
      setIcono('Activity')
      setColor('#5b5bd6')
      setModulos(['contactos'])
      setDiasVencimiento(1)
      setCampos({
        campo_fecha: true,
        campo_descripcion: true,
        campo_responsable: true,
        campo_prioridad: false,
        campo_checklist: false,
        campo_calendario: false,
      })
      setAutoCompletar(false)
      setResumenPredeterminado('')
      setNotaPredeterminada('')
      setUsuarioPredeterminado('')
      setSiguienteTipoId('')
      setTipoEncadenamiento('sugerir')
    }
  }, [abierto, tipo])

  // Auto-generar clave desde etiqueta (solo al crear)
  const manejarEtiqueta = (valor: string) => {
    setEtiqueta(valor)
    if (!esEdicion) {
      setClave(valor.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    }
  }

  // Toggle módulo
  const toggleModulo = (mod: string) => {
    setModulos(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }

  // Guardar
  const manejarGuardar = () => {
    if (!etiqueta.trim()) return
    const datos: Record<string, unknown> = {
      etiqueta: etiqueta.trim(),
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
    onGuardar(datos)
  }

  const IconoPreview = obtenerIcono(icono)

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Editar: ${tipo!.etiqueta}` : 'Nuevo tipo de actividad'}
      tamano="5xl"
      acciones={
        <div className="flex items-center gap-2 w-full">
          {onEliminar && (
            <Boton variante="fantasma" tamano="sm" icono={<Trash2 size={14} />}
              onClick={onEliminar} className="text-insignia-peligro-texto mr-auto">
              Eliminar
            </Boton>
          )}
          <div className="ml-auto flex gap-2">
            <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
            <Boton tamano="sm" onClick={manejarGuardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {esEdicion ? 'Guardar' : 'Crear tipo'}
            </Boton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ══ Identidad: Icono botón + Nombre + Colores debajo ══ */}
        <div className="flex items-start gap-3">
          {/* Botón icono con popover compacto */}
          <MiniSelectorIcono valor={icono} color={color} onChange={setIcono} />
          <div className="flex-1 min-w-0 space-y-2">
            <Input tipo="text" value={etiqueta}
              onChange={(e) => manejarEtiqueta(e.target.value)}
              placeholder="Nombre: Llamada, Reunión, Visita..."
              autoFocus />
            {/* Colores inline debajo del nombre */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {COLORES_TIPO.map(preset => {
                const sel = color.toLowerCase() === preset.color.toLowerCase()
                return (
                  <button key={preset.color} onClick={() => setColor(preset.color)}
                    className={`relative size-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                      sel ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110' : ''
                    }`} style={{ backgroundColor: preset.color }}>
                    {sel && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                )
              })}
              <button onClick={() => colorInputRef.current?.click()}
                className={`relative size-5 rounded-full border border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                  !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                    ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110 border-transparent' : 'border-borde-fuerte'
                }`}
                style={!COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? { backgroundColor: color } : undefined}>
                {COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? <Pipette size={9} className="text-texto-terciario" />
                  : <Check size={9} className="text-white drop-shadow-sm" />}
              </button>
              <input ref={colorInputRef} type="color" value={color}
                onChange={(e) => setColor(e.target.value)} className="sr-only" tabIndex={-1} />
            </div>
          </div>
        </div>

        {/* ══ Disponible en — tags planos toggleables ══ */}
        <div className="border-t border-borde-sutil pt-4">
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Disponible en</p>
          <div className="flex flex-wrap gap-1.5">
            {modulosDisponibles.map(mod => {
              const activo = modulos.includes(mod.clave)
              return (
                <button key={mod.clave} onClick={() => toggleModulo(mod.clave)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    activo
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte hover:text-texto-secundario'
                  }`}>
                  {mod.etiqueta}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ Grid 2 columnas con divisor central ══ */}
        <div className="border-t border-borde-sutil pt-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0">

            {/* ── COL IZQUIERDA ── */}
            <div className="space-y-5 md:pr-7">
              {/* Vencimiento */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Vencimiento</p>
                <div className="flex flex-wrap gap-1.5">
                  {[{ d: 0, label: 'Sin plazo' }, { d: 1, label: '1 día' }, { d: 2, label: '2 días' }, { d: 5, label: '5 días' }, { d: 7, label: '7 días' }].map(({ d, label }) => (
                    <button key={d} onClick={() => setDiasVencimiento(d)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                        diasVencimiento === d
                          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                          : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte hover:text-texto-secundario'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos visibles */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Campos visibles</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CAMPOS_DISPONIBLES.map(campo => (
                    <div key={campo.clave}
                      className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg border border-borde-sutil/60 bg-superficie-tarjeta/30">
                      <span className="text-xs text-texto-secundario">{campo.etiqueta}</span>
                      <Interruptor activo={campos[campo.clave as keyof typeof campos]}
                        onChange={(v) => setCampos(prev => ({ ...prev, [campo.clave]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Divisor vertical */}
            <div className="hidden md:block bg-borde-sutil" />

            {/* ── COL DERECHA ── */}
            <div className="space-y-5 md:pl-7 mt-5 md:mt-0">
              {/* Comportamiento */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Comportamiento</p>
                <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-borde-sutil/60 bg-superficie-tarjeta/30">
                  <div>
                    <p className="text-xs font-medium text-texto-secundario">Auto-completar al ejecutar</p>
                    <p className="text-[11px] text-texto-terciario mt-0.5">Se completa al crear el documento</p>
                  </div>
                  <Interruptor activo={autoCompletar} onChange={setAutoCompletar} />
                </div>
              </div>

              {/* Siguiente actividad */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Siguiente actividad</p>
                <Select valor={siguienteTipoId} onChange={setSiguienteTipoId}
                  placeholder="Ninguna — no encadenar"
                  opciones={tipos.filter(t => t.activo && t.id !== tipo?.id).map(t => ({ valor: t.id, etiqueta: t.etiqueta }))} />
                {siguienteTipoId && (
                  <div className="flex gap-1.5 mt-2">
                    {(['sugerir', 'activar'] as const).map(modo => (
                      <button key={modo} onClick={() => setTipoEncadenamiento(modo)}
                        className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                          tipoEncadenamiento === modo
                            ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                            : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
                        }`}>
                        {modo === 'sugerir' ? 'Sugerir' : 'Crear auto'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Valores por defecto */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Valores por defecto</p>
                <div className="space-y-2">
                  <Input tipo="text" value={resumenPredeterminado}
                    onChange={(e) => setResumenPredeterminado(e.target.value)}
                    placeholder='Título: "Hablar sobre la propuesta"' />
                  <Input tipo="text" value={notaPredeterminada}
                    onChange={(e) => setNotaPredeterminada(e.target.value)}
                    placeholder='Nota: "Revisar la oferta y hablar sobre los detalles"' />
                  <Select valor={usuarioPredeterminado}
                    onChange={setUsuarioPredeterminado} placeholder="Responsable: Sin asignar"
                    opciones={miembros.map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}`.trim() }))} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export { ModalTipoActividad }

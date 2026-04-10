'use client'

import { useState, useEffect, useRef } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Trash2, Check, Pipette } from 'lucide-react'
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
      <div className="space-y-6">
        {/* ══ Fila 1: Preview + Nombre + Icono + Color ══ */}
        <div className="flex items-start gap-5">
          {/* Preview live */}
          <div className="size-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '18', color }}>
            {IconoPreview && <IconoPreview size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <Input tipo="text" etiqueta="Nombre" value={etiqueta}
              onChange={(e) => manejarEtiqueta(e.target.value)}
              placeholder="Ej: Llamada, Reunión, Visita..." autoFocus />
          </div>
          <div className="shrink-0 w-44">
            <SelectorIcono valor={icono} onChange={setIcono} etiqueta="Icono" />
          </div>
        </div>

        {/* Color — compacto, bolitas chicas inline */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-texto-terciario shrink-0">Color</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {COLORES_TIPO.map(preset => {
              const sel = color.toLowerCase() === preset.color.toLowerCase()
              return (
                <Tooltip key={preset.color} contenido={preset.nombre}>
                  <button onClick={() => setColor(preset.color)}
                    className={`relative size-6 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                      sel ? 'ring-2 ring-offset-1 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                    }`} style={{ backgroundColor: preset.color }}>
                    {sel && <Check size={11} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                </Tooltip>
              )
            })}
            <button onClick={() => colorInputRef.current?.click()}
              className={`relative size-6 rounded-full border border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? 'ring-2 ring-offset-1 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent' : 'border-borde-fuerte'
              }`}
              style={!COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? { backgroundColor: color } : undefined}
              title="Color personalizado">
              {COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                ? <Pipette size={10} className="text-texto-terciario" />
                : <Check size={10} className="text-white drop-shadow-sm" />}
            </button>
            <input ref={colorInputRef} type="color" value={color}
              onChange={(e) => setColor(e.target.value)} className="sr-only" tabIndex={-1} />
          </div>
        </div>

        {/* ══ Grid 2 columnas: config izq + comportamiento der ══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-2 border-t border-borde-sutil">

          {/* ── COL IZQUIERDA ── */}
          <div className="space-y-5">
            {/* Disponible en — chips seleccionables compactos */}
            <div>
              <label className="text-xs font-medium text-texto-terciario block mb-2">Disponible en</label>
              {/* Seleccionados como badges */}
              {modulos.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {modulos.map(clave => {
                    const mod = modulosDisponibles.find(m => m.clave === clave)
                    return (
                      <span key={clave}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-medium bg-texto-marca/10 text-texto-marca">
                        {mod?.etiqueta || clave}
                        <button onClick={() => toggleModulo(clave)}
                          className="size-3.5 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer hover:bg-texto-marca/20 text-current">
                          <Check size={8} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {modulosDisponibles.filter(m => !modulos.includes(m.clave)).map(mod => (
                  <button key={mod.clave} onClick={() => toggleModulo(mod.clave)}
                    className="px-2 py-1 rounded-md text-xxs font-medium text-texto-terciario border border-borde-sutil bg-transparent cursor-pointer hover:border-texto-marca/30 hover:text-texto-secundario transition-colors">
                    {mod.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {/* Vencimiento — inline compacto */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-texto-terciario shrink-0">Vencimiento</label>
              <div className="flex rounded-md border border-borde-sutil overflow-hidden">
                {[0, 1, 2, 3, 5, 7].map(d => (
                  <button key={d} onClick={() => setDiasVencimiento(d)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border-none ${
                      diasVencimiento === d ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-terciario hover:bg-superficie-hover'
                    }`}>
                    {d === 0 ? 'Sin' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos habilitados — grilla 2 columnas compacta */}
            <div>
              <label className="text-xs font-medium text-texto-terciario block mb-2">Campos</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {CAMPOS_DISPONIBLES.map(campo => (
                  <label key={campo.clave}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-superficie-hover/50 transition-colors cursor-pointer">
                    <Interruptor activo={campos[campo.clave as keyof typeof campos]}
                      onChange={(v) => setCampos(prev => ({ ...prev, [campo.clave]: v }))} />
                    <span className="text-xs text-texto-primario">{campo.etiqueta}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── COL DERECHA ── */}
          <div className="space-y-5 md:border-l md:border-borde-sutil md:pl-8">
            {/* Auto-completar — switch compacto */}
            <label className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-superficie-hover/50 transition-colors cursor-pointer">
              <div>
                <p className="text-xs font-medium text-texto-primario">Auto-completar al ejecutar</p>
                <p className="text-xxs text-texto-terciario">Se completa al crear el documento desde la actividad</p>
              </div>
              <Interruptor activo={autoCompletar} onChange={setAutoCompletar} />
            </label>

            {/* Siguiente actividad */}
            <div className="space-y-3">
              <Select etiqueta="Siguiente actividad" valor={siguienteTipoId} onChange={setSiguienteTipoId}
                placeholder="Ninguna — no encadenar"
                opciones={tipos.filter(t => t.activo && t.id !== tipo?.id).map(t => ({ valor: t.id, etiqueta: t.etiqueta }))} />
              {siguienteTipoId && (
                <div className="flex gap-1.5">
                  {(['sugerir', 'activar'] as const).map(modo => (
                    <button key={modo} onClick={() => setTipoEncadenamiento(modo)}
                      className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                        tipoEncadenamiento === modo
                          ? 'bg-texto-marca text-white border-texto-marca'
                          : 'bg-superficie-tarjeta text-texto-terciario border-borde-sutil hover:border-borde-fuerte'
                      }`}>
                      {modo === 'sugerir' ? 'Sugerir' : 'Crear auto'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separador visual */}
            <div className="border-t border-borde-sutil" />

            {/* Defaults */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-texto-terciario">Valores al crear</p>
              <Input tipo="text" etiqueta="Título predeterminado" value={resumenPredeterminado}
                onChange={(e) => setResumenPredeterminado(e.target.value)}
                placeholder='Ej: "Hablar sobre la propuesta"' />
              <TextArea etiqueta="Nota predeterminada" value={notaPredeterminada}
                onChange={(e) => setNotaPredeterminada(e.target.value)}
                placeholder='Ej: "Revisar la oferta y hablar sobre los detalles"' rows={2} />
              <Select etiqueta="Responsable predeterminado" valor={usuarioPredeterminado}
                onChange={setUsuarioPredeterminado} placeholder="Sin asignar"
                opciones={miembros.map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}`.trim() }))} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export { ModalTipoActividad }

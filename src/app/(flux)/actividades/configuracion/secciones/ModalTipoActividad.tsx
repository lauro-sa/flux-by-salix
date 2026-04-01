'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Trash2, Check, Pipette } from 'lucide-react'
import type { TipoActividad } from './SeccionTipos'

/**
 * ModalTipoActividad — Modal para crear o editar un tipo de actividad.
 * Incluye: nombre, icono, color (presets + gotero), módulos donde aplica,
 * vencimiento por defecto en días, campos habilitados.
 */

interface PropiedadesModal {
  abierto: boolean
  tipo: TipoActividad | null
  modulosDisponibles: { clave: string; etiqueta: string; grupo?: string }[]
  guardando: boolean
  onGuardar: (datos: Record<string, unknown>) => void
  onCerrar: () => void
  onEliminar?: () => void
}

// Colores predefinidos para tipos de actividad
const COLORES_TIPO = [
  { color: '#e5484d', nombre: 'Rojo' },
  { color: '#f5a623', nombre: 'Naranja' },
  { color: '#e5a84c', nombre: 'Ámbar' },
  { color: '#46a758', nombre: 'Verde' },
  { color: '#0f766e', nombre: 'Esmeralda' },
  { color: '#7c93c4', nombre: 'Azul claro' },
  { color: '#3b82f6', nombre: 'Azul' },
  { color: '#8e4ec6', nombre: 'Violeta' },
  { color: '#5b5bd6', nombre: 'Índigo' },
  { color: '#ec4899', nombre: 'Rosa' },
  { color: '#889096', nombre: 'Gris' },
  { color: '#1e3a5f', nombre: 'Navy' },
]

// Campos configurables por tipo
const CAMPOS_DISPONIBLES = [
  { clave: 'campo_fecha', etiqueta: 'Fecha de vencimiento', descripcion: 'Permite asignar una fecha límite' },
  { clave: 'campo_descripcion', etiqueta: 'Descripción', descripcion: 'Campo de texto para detalles' },
  { clave: 'campo_responsable', etiqueta: 'Responsable', descripcion: 'Asignar a un miembro del equipo' },
  { clave: 'campo_prioridad', etiqueta: 'Prioridad', descripcion: 'Nivel de urgencia (baja, normal, alta)' },
  { clave: 'campo_checklist', etiqueta: 'Checklist', descripcion: 'Lista de tareas dentro de la actividad' },
]

function ModalTipoActividad({ abierto, tipo, modulosDisponibles, guardando, onGuardar, onCerrar, onEliminar }: PropiedadesModal) {
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
  })
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
      })
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
      })
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
      tamano="lg"
      acciones={
        <div className="flex items-center gap-2 w-full">
          {onEliminar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<Trash2 size={14} />}
              onClick={onEliminar}
              className="text-insignia-peligro-texto mr-auto"
            >
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
        {/* ── Preview + Nombre ── */}
        <div className="flex items-start gap-4">
          {/* Preview del icono con color */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '18', color }}
          >
            {IconoPreview && <IconoPreview size={28} />}
          </div>
          <div className="flex-1">
            <Input
              tipo="text"
              etiqueta="Nombre del tipo"
              value={etiqueta}
              onChange={(e) => manejarEtiqueta(e.target.value)}
              placeholder="Ej: Llamada, Reunión, Visita..."
              autoFocus
            />
          </div>
        </div>

        {/* ── Icono ── */}
        <SelectorIcono
          valor={icono}
          onChange={setIcono}
          etiqueta="Icono"
        />

        {/* ── Color ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5 items-center">
            {COLORES_TIPO.map(preset => {
              const seleccionado = color.toLowerCase() === preset.color.toLowerCase()
              return (
                <button
                  key={preset.color}
                  onClick={() => setColor(preset.color)}
                  title={preset.nombre}
                  className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                    seleccionado ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {seleccionado && (
                    <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />
                  )}
                </button>
              )
            })}

            {/* Gotero — abre el color picker nativo del navegador */}
            <button
              onClick={() => colorInputRef.current?.click()}
              className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
                  : 'border-borde-fuerte'
              }`}
              style={
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? { backgroundColor: color }
                  : undefined
              }
              title="Elegir color personalizado"
            >
              {COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? (
                <Pipette size={14} className="text-texto-terciario" />
              ) : (
                <Check size={14} className="text-white drop-shadow-sm" />
              )}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </div>

        {/* ── Módulos disponibles (agrupados) ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-3">Disponible en</label>
          {(() => {
            // Agrupar módulos por grupo
            const grupos = modulosDisponibles.reduce<Record<string, typeof modulosDisponibles>>((acc, mod) => {
              const g = mod.grupo || 'Otro'
              if (!acc[g]) acc[g] = []
              acc[g].push(mod)
              return acc
            }, {})

            return (
              <div className="space-y-3">
                {Object.entries(grupos).map(([grupo, mods]) => (
                  <div key={grupo}>
                    <p className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-1.5">{grupo}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mods.map(mod => {
                        const activo = modulos.includes(mod.clave)
                        return (
                          <button
                            key={mod.clave}
                            onClick={() => toggleModulo(mod.clave)}
                            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer border ${
                              activo
                                ? 'bg-texto-marca/10 text-texto-marca border-texto-marca/30'
                                : 'bg-superficie-hover text-texto-terciario border-transparent hover:text-texto-secundario'
                            }`}
                          >
                            {mod.etiqueta}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* ── Vencimiento por defecto ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Vencimiento por defecto</label>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-borde-fuerte overflow-hidden">
              {[0, 1, 2, 3, 5, 7].map(d => (
                <button
                  key={d}
                  onClick={() => setDiasVencimiento(d)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-none ${
                    diasVencimiento === d
                      ? 'bg-texto-marca text-white'
                      : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover'
                  }`}
                >
                  {d === 0 ? 'Sin' : `${d}d`}
                </button>
              ))}
            </div>
            <span className="text-xs text-texto-terciario">
              {diasVencimiento === 0 ? 'Sin fecha límite' : `${diasVencimiento} día${diasVencimiento > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* ── Campos habilitados ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-3">Campos habilitados</label>
          <div className="space-y-1">
            {CAMPOS_DISPONIBLES.map(campo => (
              <div
                key={campo.clave}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-superficie-hover/50 transition-colors"
              >
                <div>
                  <p className="text-sm text-texto-primario">{campo.etiqueta}</p>
                  <p className="text-xs text-texto-terciario">{campo.descripcion}</p>
                </div>
                <Interruptor
                  activo={campos[campo.clave as keyof typeof campos]}
                  onChange={(v) => setCampos(prev => ({ ...prev, [campo.clave]: v }))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export { ModalTipoActividad }

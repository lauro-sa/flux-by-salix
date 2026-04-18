'use client'

/**
 * PaginaEditorTipoEvento — Editor pantalla completa de tipos de evento del calendario.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trash2, Check, Pipette } from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { obtenerIcono, SelectorIcono } from '@/componentes/ui/SelectorIcono'
import { PALETA_COLORES_TIPO_ACTIVIDAD, COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import { useToast } from '@/componentes/feedback/Toast'
import type { TipoEventoCalendario } from '@/app/(flux)/calendario/configuracion/_tipos'

const COLORES_TIPO = PALETA_COLORES_TIPO_ACTIVIDAD

interface Props {
  tipo: TipoEventoCalendario | null
  rutaVolver: string
  textoVolver?: string
}

export function PaginaEditorTipoEvento({
  tipo,
  rutaVolver,
  textoVolver = 'Tipos de evento',
}: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const esEdicion = !!tipo

  const [etiqueta, setEtiqueta] = useState(tipo?.etiqueta || '')
  const [clave, setClave] = useState(tipo?.clave || '')
  const [icono, setIcono] = useState(tipo?.icono || 'Calendar')
  const [color, setColor] = useState(tipo?.color || COLOR_MARCA_DEFECTO)
  const [duracionDefault, setDuracionDefault] = useState(tipo?.duracion_default ?? 60)
  const [todoElDiaDefault, setTodoElDiaDefault] = useState(tipo?.todo_el_dia_default ?? false)
  const [guardando, setGuardando] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const manejarEtiqueta = (valor: string) => {
    setEtiqueta(valor)
    if (!esEdicion) {
      setClave(valor.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    }
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
        icono,
        color,
        duracion_default: duracionDefault,
        todo_el_dia_default: todoElDiaDefault,
      }
      if (esEdicion) datos.id = tipo!.id
      else datos.clave = clave

      const res = await fetch('/api/calendario/config', {
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
    if (!tipo || tipo.es_predefinido) return
    if (!confirm(`¿Eliminar el tipo "${tipo.etiqueta}"? Los eventos existentes no se verán afectados.`)) return
    try {
      const res = await fetch('/api/calendario/config', {
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

  const acciones = [
    ...(esEdicion && !tipo?.es_predefinido ? [{
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

  // ─── Panel izq: preview + duración + toggle todo el día ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Preview */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Vista previa
        </label>
        <div className="flex items-center gap-3 p-3 rounded-card border border-borde-sutil bg-superficie-tarjeta">
          <div
            className="size-12 rounded-modal flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '18', color }}
          >
            {IconoPreview && <IconoPreview size={22} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-texto-primario truncate">{etiqueta || 'Nombre del tipo'}</p>
            <p className="text-xxs text-texto-terciario">
              {todoElDiaDefault ? 'Todo el día' : `${duracionDefault >= 60 ? `${duracionDefault / 60}h` : `${duracionDefault} min`}`}
            </p>
          </div>
        </div>
      </div>

      {/* Duración por defecto */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Duración por defecto
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[15, 30, 45, 60, 90, 120].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => { setDuracionDefault(d); setTodoElDiaDefault(false) }}
              className={`px-2.5 py-1 rounded-boton text-xs font-medium transition-all cursor-pointer border ${
                !todoElDiaDefault && duracionDefault === d
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'bg-superficie-tarjeta/50 border-borde-sutil text-texto-terciario hover:border-borde-fuerte hover:text-texto-secundario'
              }`}
            >
              {d >= 60 ? `${d / 60}h` : `${d}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Todo el día */}
      <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-card border border-white/[0.06] bg-white/[0.03]">
        <div>
          <p className="text-xs font-medium text-texto-secundario">Todo el día por defecto</p>
          <p className="text-[11px] text-texto-terciario mt-0.5">Eventos de día completo</p>
        </div>
        <Interruptor activo={todoElDiaDefault} onChange={setTodoElDiaDefault} />
      </div>
    </div>
  )

  return (
    <PlantillaEditor
      titulo={esEdicion ? (etiqueta || tipo?.etiqueta || 'Editar tipo') : 'Nuevo tipo de evento'}
      subtitulo="Tipo de evento — se usa al crear eventos en el calendario"
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ IDENTIDAD ═══ */}
      <div className="space-y-4 pb-4 border-b border-borde-sutil">
        <div className="flex items-start gap-3">
          <div
            className="size-14 rounded-modal flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '18', color }}
          >
            {IconoPreview && <IconoPreview size={28} />}
          </div>
          <div className="flex-1 min-w-0">
            <Input
              value={etiqueta}
              onChange={(e) => manejarEtiqueta(e.target.value)}
              placeholder="Ej: Reunión, Llamada, Bloqueo..."
              autoFocus
              className="!text-base !font-semibold"
            />
          </div>
        </div>
      </div>

      {/* ═══ ICONO ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Ícono
        </label>
        <SelectorIcono valor={icono} onChange={setIcono} />
      </div>

      {/* ═══ COLOR ═══ */}
      <div className="pt-4 space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Color
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {COLORES_TIPO.map(preset => {
            const sel = color.toLowerCase() === preset.color.toLowerCase()
            return (
              <Tooltip key={preset.color} contenido={preset.nombre}>
                <button
                  type="button"
                  onClick={() => setColor(preset.color)}
                  className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                    sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {sel && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                </button>
              </Tooltip>
            )
          })}
          <button
            type="button"
            onClick={() => colorInputRef.current?.click()}
            className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
              !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
                : 'border-borde-fuerte'
            }`}
            style={!COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? { backgroundColor: color } : undefined}
            title="Elegir color personalizado"
          >
            {COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
              ? <Pipette size={14} className="text-texto-terciario" />
              : <Check size={14} className="text-white drop-shadow-sm" />}
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
    </PlantillaEditor>
  )
}

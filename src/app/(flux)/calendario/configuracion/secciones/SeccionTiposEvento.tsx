'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Check, Pipette } from 'lucide-react'
import { obtenerIcono, SelectorIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { PALETA_COLORES_TIPO_ACTIVIDAD, COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'

/**
 * SeccionTiposEvento — Lista de tipos de evento del calendario usando ListaConfiguracion unificada.
 */

export interface TipoEventoCalendario {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  duracion_default: number
  todo_el_dia_default: boolean
  orden: number
  activo: boolean
  es_predefinido: boolean
}

interface PropiedadesSeccionTipos {
  tipos: TipoEventoCalendario[]
  cargando: boolean
  onActualizar: (tipos: TipoEventoCalendario[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

const COLORES_TIPO = PALETA_COLORES_TIPO_ACTIVIDAD

function SeccionTiposEvento({ tipos, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionTipos) {
  const [orden, setOrden] = useState<TipoEventoCalendario[]>(tipos)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoEventoCalendario | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { setOrden(tipos) }, [tipos])

  const toggleActivo = useCallback(async (tipo: TipoEventoCalendario) => {
    const nuevoEstado = !tipo.activo
    const nuevos = orden.map(t => t.id === tipo.id ? { ...t, activo: nuevoEstado } : t)
    onActualizar(nuevos)
    await onAccionAPI('editar_tipo_evento', { id: tipo.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  const manejarReorden = useCallback(async (idsOrdenados: string[]) => {
    const mapa = new Map(orden.map(t => [t.id, t]))
    const nuevos = idsOrdenados.map(id => mapa.get(id)!).filter(Boolean)
    setOrden(nuevos)
    onActualizar(nuevos)
    await onAccionAPI('reordenar_tipos_evento', { orden: idsOrdenados })
  }, [orden, onActualizar, onAccionAPI])

  const crearTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const nuevo = await onAccionAPI('crear_tipo_evento', datos) as TipoEventoCalendario
      onActualizar([...orden, nuevo])
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  const editarTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const actualizado = await onAccionAPI('editar_tipo_evento', datos) as TipoEventoCalendario
      onActualizar(orden.map(t => t.id === actualizado.id ? actualizado : t))
      setTipoEditando(null)
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  const eliminarTipo = useCallback(async (id: string) => {
    await onAccionAPI('eliminar_tipo_evento', { id })
    onActualizar(orden.filter(t => t.id !== id))
  }, [orden, onActualizar, onAccionAPI])

  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await onAccionAPI('restablecer', {}) as { tipos: TipoEventoCalendario[] }
      onActualizar(res.tipos)
      setConfirmarRestablecer(false)
    } finally {
      setGuardando(false)
    }
  }, [onActualizar, onAccionAPI])

  if (cargando) return <CargadorSeccion />

  // ─── Mapear TipoEventoCalendario → ItemLista ──────────────────────
  const itemsLista: ItemLista[] = orden.map(tipo => {
    const Icono = obtenerIcono(tipo.icono)
    const etiquetaDuracion = tipo.todo_el_dia_default ? 'Todo el día' : `${tipo.duracion_default} min`
    return {
      id: tipo.id,
      nombre: tipo.etiqueta,
      icono: Icono ? <Icono size={20} /> : undefined,
      color: tipo.color,
      tags: [{ texto: etiquetaDuracion, variante: 'neutro' as const }],
      activo: tipo.activo,
      esPredefinido: tipo.es_predefinido,
    }
  })

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Tipos de evento"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
        controles="toggle-editar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Agregar tipo de evento',
          onClick: () => { setTipoEditando(null); setModalAbierto(true) },
        }]}
        onToggleActivo={(item) => {
          const tipo = orden.find(t => t.id === item.id)
          if (tipo) toggleActivo(tipo)
        }}
        onEditar={(item) => {
          const tipo = orden.find(t => t.id === item.id)
          if (tipo) { setTipoEditando(tipo); setModalAbierto(true) }
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
        onReordenar={manejarReorden}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
      />

      {/* Modal crear/editar tipo de evento */}
      <ModalTipoEvento
        abierto={modalAbierto}
        tipo={tipoEditando}
        guardando={guardando}
        onGuardar={tipoEditando ? editarTipo : crearTipo}
        onCerrar={() => { setModalAbierto(false); setTipoEditando(null) }}
        onEliminar={tipoEditando && !tipoEditando.es_predefinido ? () => eliminarTipo(tipoEditando.id) : undefined}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar tipo de evento"
        descripcion={`Se eliminará "${orden.find(t => t.id === confirmarEliminar)?.etiqueta || ''}". Los eventos existentes no se verán afectados.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={async () => {
          if (confirmarEliminar) {
            await eliminarTipo(confirmarEliminar)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer tipos de evento"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Los eventos existentes no se verán afectados."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

// ── Modal para crear/editar tipo de evento ──

interface PropiedadesModalTipoEvento {
  abierto: boolean
  tipo: TipoEventoCalendario | null
  guardando: boolean
  onGuardar: (datos: Record<string, unknown>) => void
  onCerrar: () => void
  onEliminar?: () => void
}

function ModalTipoEvento({ abierto, tipo, guardando, onGuardar, onCerrar, onEliminar }: PropiedadesModalTipoEvento) {
  const { t } = useTraduccion()
  const esEdicion = !!tipo

  const [etiqueta, setEtiqueta] = useState('')
  const [clave, setClave] = useState('')
  const [icono, setIcono] = useState('Calendar')
  const [color, setColor] = useState(COLOR_MARCA_DEFECTO)
  const [duracionDefault, setDuracionDefault] = useState(60)
  const [todoElDiaDefault, setTodoElDiaDefault] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierto) return
    if (tipo) {
      setEtiqueta(tipo.etiqueta)
      setClave(tipo.clave)
      setIcono(tipo.icono)
      setColor(tipo.color)
      setDuracionDefault(tipo.duracion_default)
      setTodoElDiaDefault(tipo.todo_el_dia_default)
    } else {
      setEtiqueta('')
      setClave('')
      setIcono('Calendar')
      setColor(COLOR_MARCA_DEFECTO)
      setDuracionDefault(60)
      setTodoElDiaDefault(false)
    }
  }, [abierto, tipo])

  const manejarEtiqueta = (valor: string) => {
    setEtiqueta(valor)
    if (!esEdicion) {
      setClave(valor.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    }
  }

  const manejarGuardar = () => {
    if (!etiqueta.trim()) return
    const datos: Record<string, unknown> = {
      etiqueta: etiqueta.trim(),
      icono, color,
      duracion_default: duracionDefault,
      todo_el_dia_default: todoElDiaDefault,
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
      titulo={esEdicion ? `Editar: ${tipo!.etiqueta}` : 'Nuevo tipo de evento'}
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
              {t('comun.eliminar')}
            </Boton>
          )}
          <div className="ml-auto flex gap-2">
            <Boton variante="secundario" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
            <Boton tamano="sm" onClick={manejarGuardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {esEdicion ? t('comun.guardar') : `${t('comun.crear')} tipo`}
            </Boton>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4">
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
              placeholder="Ej: Reunión, Llamada, Bloqueo..."
              autoFocus
            />
          </div>
        </div>

        <SelectorIcono valor={icono} onChange={setIcono} etiqueta="Icono" />

        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5 items-center">
            {COLORES_TIPO.map(preset => {
              const seleccionado = color.toLowerCase() === preset.color.toLowerCase()
              return (
                <Tooltip key={preset.color} contenido={preset.nombre}>
                  <button
                    onClick={() => setColor(preset.color)}
                    className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                      seleccionado ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    {seleccionado && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                </Tooltip>
              )
            })}
            <button
              onClick={() => colorInputRef.current?.click()}
              className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
                  : 'border-borde-fuerte'
              }`}
              style={
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? { backgroundColor: color } : undefined
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

        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Duración por defecto</label>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-borde-fuerte overflow-hidden">
              {[15, 30, 45, 60, 90, 120].map(d => (
                <button
                  key={d}
                  onClick={() => { setDuracionDefault(d); setTodoElDiaDefault(false) }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-none ${
                    !todoElDiaDefault && duracionDefault === d
                      ? 'bg-texto-marca text-white'
                      : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover'
                  }`}
                >
                  {d >= 60 ? `${d / 60}h` : `${d}m`}
                </button>
              ))}
            </div>
            <span className="text-xs text-texto-terciario">
              {todoElDiaDefault
                ? 'Todo el día'
                : duracionDefault >= 60
                  ? `${duracionDefault / 60} hora${duracionDefault > 60 ? 's' : ''}`
                  : `${duracionDefault} minutos`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-superficie-hover/50 transition-colors">
          <div>
            <p className="text-sm text-texto-primario">Todo el día por defecto</p>
            <p className="text-xs text-texto-terciario">Los eventos de este tipo se crearán como eventos de día completo</p>
          </div>
          <Interruptor activo={todoElDiaDefault} onChange={(v) => setTodoElDiaDefault(v)} />
        </div>
      </div>
    </Modal>
  )
}

export { SeccionTiposEvento }

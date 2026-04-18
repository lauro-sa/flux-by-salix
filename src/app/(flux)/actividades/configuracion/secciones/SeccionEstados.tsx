'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Check, Pipette } from 'lucide-react'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Input } from '@/componentes/ui/Input'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { PALETA_COLORES_ESTADO } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'

/**
 * SeccionEstados — Lista de estados de actividad usando ListaConfiguracion unificada.
 * Cada estado tiene un grupo de comportamiento: activo, completado, cancelado.
 */

export interface EstadoActividad {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  grupo: 'activo' | 'completado' | 'cancelado'
  orden: number
  activo: boolean
  es_predefinido: boolean
}

interface PropiedadesSeccionEstados {
  estados: EstadoActividad[]
  cargando: boolean
  onActualizar: (estados: EstadoActividad[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

const GRUPOS = [
  { valor: 'activo', etiqueta: 'Activo', descripcion: 'Visible en chatter, se puede posponer' },
  { valor: 'completado', etiqueta: 'Completado', descripcion: 'Pasa al timeline, acción terminada' },
  { valor: 'cancelado', etiqueta: 'Cancelado', descripcion: 'Estado terminal, sin acciones' },
]

const COLORES_ESTADO = PALETA_COLORES_ESTADO

function SeccionEstados({ estados, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionEstados) {
  const { t } = useTraduccion()
  const [orden, setOrden] = useState<EstadoActividad[]>(estados)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [estadoEditando, setEstadoEditando] = useState<EstadoActividad | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  // Form state para modal
  const [etiqueta, setEtiqueta] = useState('')
  const [icono, setIcono] = useState('Circle')
  const [color, setColor] = useState('#6b7280')
  const [grupo, setGrupo] = useState<string>('activo')

  useEffect(() => { setOrden(estados) }, [estados])

  const abrirModal = (estado?: EstadoActividad) => {
    if (estado) {
      setEstadoEditando(estado)
      setEtiqueta(estado.etiqueta)
      setIcono(estado.icono)
      setColor(estado.color)
      setGrupo(estado.grupo)
    } else {
      setEstadoEditando(null)
      setEtiqueta('')
      setIcono('Circle')
      setColor('#6b7280')
      setGrupo('activo')
    }
    setModalAbierto(true)
  }

  const toggleActivo = useCallback(async (estado: EstadoActividad) => {
    const nuevoEstado = !estado.activo
    const nuevos = orden.map(e => e.id === estado.id ? { ...e, activo: nuevoEstado } : e)
    onActualizar(nuevos)
    await onAccionAPI('editar_estado', { id: estado.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  const manejarReorden = useCallback(async (idsOrdenados: string[]) => {
    const mapa = new Map(orden.map(e => [e.id, e]))
    const nuevos = idsOrdenados.map(id => mapa.get(id)!).filter(Boolean)
    setOrden(nuevos)
    onActualizar(nuevos)
    await onAccionAPI('reordenar_estados', { orden: idsOrdenados })
  }, [orden, onActualizar, onAccionAPI])

  const eliminarEstado = useCallback(async (id: string) => {
    await onAccionAPI('eliminar_estado', { id })
    onActualizar(orden.filter(e => e.id !== id))
  }, [orden, onActualizar, onAccionAPI])

  const guardar = async () => {
    if (!etiqueta.trim()) return
    setGuardando(true)
    try {
      if (estadoEditando) {
        const actualizado = await onAccionAPI('editar_estado', {
          id: estadoEditando.id, etiqueta: etiqueta.trim(), icono, color, grupo,
        }) as EstadoActividad
        onActualizar(orden.map(e => e.id === actualizado.id ? actualizado : e))
      } else {
        const claveGen = etiqueta.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const nuevo = await onAccionAPI('crear_estado', {
          clave: claveGen, etiqueta: etiqueta.trim(), icono, color, grupo,
        }) as EstadoActividad
        onActualizar([...orden, nuevo])
      }
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <CargadorSeccion />

  // ─── Mapear EstadoActividad → ItemLista ───────────────────────────
  const itemsLista: ItemLista[] = orden.map(estado => {
    const Icono = obtenerIcono(estado.icono)
    return {
      id: estado.id,
      nombre: estado.etiqueta,
      icono: Icono ? <Icono size={15} /> : undefined,
      color: estado.color,
      activo: estado.activo,
      esPredefinido: estado.es_predefinido,
      grupo: estado.grupo,
    }
  })

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Estados de actividad"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
        controles="toggle-editar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Agregar estado',
          onClick: () => abrirModal(),
        }]}
        grupos={GRUPOS.map(g => ({
          clave: g.valor,
          etiqueta: g.etiqueta,
          descripcion: g.descripcion,
        }))}
        onToggleActivo={(item) => {
          const estado = orden.find(e => e.id === item.id)
          if (estado) toggleActivo(estado)
        }}
        onEditar={(item) => {
          const estado = orden.find(e => e.id === item.id)
          if (estado) abrirModal(estado)
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
        onReordenar={manejarReorden}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar estado"
        descripcion={`Se eliminará "${orden.find(e => e.id === confirmarEliminar)?.etiqueta || ''}". Las actividades existentes con este estado no se verán afectadas.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={async () => {
          if (confirmarEliminar) {
            await eliminarEstado(confirmarEliminar)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer estados de actividad"
        descripcion="Se eliminarán los estados personalizados y se reactivarán los predefinidos. Las actividades existentes no se verán afectadas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={async () => {
          setGuardando(true)
          try {
            const res = await onAccionAPI('restablecer', {}) as { estados: EstadoActividad[] }
            onActualizar(res.estados)
            setConfirmarRestablecer(false)
          } finally {
            setGuardando(false)
          }
        }}
        onCerrar={() => setConfirmarRestablecer(false)}
      />

      {/* Modal crear/editar estado */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={estadoEditando ? `Editar: ${estadoEditando.etiqueta}` : 'Nuevo estado'}
        tamano="md"
        acciones={
          <>
            <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>{t('comun.cancelar')}</Boton>
            <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {estadoEditando ? t('comun.guardar') : `${t('comun.crear')} estado`}
            </Boton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-card bg-superficie-hover/50">
            <div
              className="w-9 h-9 rounded-card flex items-center justify-center"
              style={{ backgroundColor: color + '18', color }}
            >
              {(() => { const I = obtenerIcono(icono); return I ? <I size={18} /> : null })()}
            </div>
            <span className="text-sm font-semibold text-texto-primario">{etiqueta || 'Nuevo estado'}</span>
          </div>

          <Input
            tipo="text"
            etiqueta="Nombre"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Ej: En progreso, Pausada..."
            autoFocus
          />

          <SelectorIcono valor={icono} onChange={setIcono} etiqueta="Icono" />

          <SelectorColorDots valor={color} onChange={setColor} colores={COLORES_ESTADO} />

          {/* Grupo de comportamiento */}
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-2">Grupo de comportamiento</label>
            <div className="space-y-1.5">
              {GRUPOS.map(g => (
                <Boton
                  key={g.valor}
                  variante={grupo === g.valor ? 'secundario' : 'fantasma'}
                  tamano="sm"
                  anchoCompleto
                  onClick={() => setGrupo(g.valor)}
                  className={grupo === g.valor ? 'bg-texto-marca/8 border-texto-marca/25' : ''}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      g.valor === 'activo' ? 'bg-insignia-advertencia' : g.valor === 'completado' ? 'bg-insignia-exito' : 'bg-texto-terciario'
                    }`} />
                    <div className="text-left">
                      <p className="text-sm font-medium">{g.etiqueta}</p>
                      <p className="text-xs text-texto-terciario">{g.descripcion}</p>
                    </div>
                  </div>
                </Boton>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Selector de color con dots + gotero nativo ──

function SelectorColorDots({ valor, onChange, colores }: { valor: string; onChange: (c: string) => void; colores: string[] }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const esCustom = !colores.some(c => c.toLowerCase() === valor.toLowerCase())

  return (
    <div>
      <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
      <div className="flex flex-wrap gap-2.5 items-center">
        {colores.map(c => {
          const sel = valor.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {sel && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
            </button>
          )
        })}
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
            esCustom
              ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
              : 'border-borde-fuerte'
          }`}
          style={esCustom ? { backgroundColor: valor } : undefined}
          title="Elegir color personalizado"
        >
          {esCustom ? (
            <Check size={14} className="text-white drop-shadow-sm" />
          ) : (
            <Pipette size={14} className="text-texto-terciario" />
          )}
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </div>
  )
}

export { SeccionEstados }

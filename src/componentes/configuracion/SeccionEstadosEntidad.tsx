'use client'

/**
 * SeccionEstadosEntidad — Lista de estados configurables para UNA entidad
 * puntual (cuota, conversación, presupuesto, etc.). Usa ListaConfiguracion
 * estándar.
 *
 * Estados del sistema → badge "Sistema", no editables/eliminables.
 * Estados propios → editables y eliminables.
 *
 * Se usa desde la pantalla de configuración de cada módulo:
 *   - /inbox/configuracion (tab: Estados de conversación)
 *   - /presupuestos/configuracion (tab: Estados de cuotas)
 *   - /actividades/configuracion ya tiene su propia sección (no usa este)
 *   - PRs 7-11 sumarán las demás entidades.
 *
 * Backend: GET /api/estados (listar) + POST/PATCH/DELETE /api/estados/items.
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { useToast } from '@/componentes/feedback/Toast'
import { useEstados, type EstadoConfig } from '@/hooks/useEstados'
import {
  ETIQUETAS_GRUPO,
  GRUPOS_ESTADO,
  type EntidadConEstado,
  type GrupoEstado,
} from '@/tipos/estados'

interface Props {
  entidadTipo: EntidadConEstado
}

const COLORES_DISPONIBLES = [
  '#6b7280', '#5b5bd6', '#16a34a', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#ec4899', '#84cc16', '#475569',
]

export function SeccionEstadosEntidad({ entidadTipo }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: estados = [], isLoading } = useEstados(entidadTipo)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<EstadoConfig | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Form state del modal
  const [clave, setClave] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [grupo, setGrupo] = useState<GrupoEstado>('activo')
  const [color, setColor] = useState('#6b7280')
  const [icono, setIcono] = useState('Circle')

  // Resetear cuando cambia entidad
  useEffect(() => {
    setModalAbierto(false)
    setEditando(null)
  }, [entidadTipo])

  const abrirModalNuevo = () => {
    setEditando(null)
    setClave('')
    setEtiqueta('')
    setGrupo('activo')
    setColor('#6b7280')
    setIcono('Circle')
    setModalAbierto(true)
  }

  const abrirModalEditar = (estado: EstadoConfig) => {
    if (estado.es_sistema) {
      toast.mostrar('info', 'Los estados del sistema no se pueden editar. Crea uno propio si necesitás personalizar.')
      return
    }
    setEditando(estado)
    setClave(estado.clave)
    setEtiqueta(estado.etiqueta)
    setGrupo(estado.grupo)
    setColor(estado.color)
    setIcono(estado.icono)
    setModalAbierto(true)
  }

  const refrescar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['estados', entidadTipo] })
  }, [queryClient, entidadTipo])

  const guardar = async () => {
    if (!etiqueta.trim()) {
      toast.mostrar('error', 'La etiqueta es obligatoria')
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        const res = await fetch(`/api/estados/items/${editando.id}?entidad_tipo=${entidadTipo}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            etiqueta: etiqueta.trim(),
            grupo,
            color,
            icono,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error al guardar')
        }
        toast.mostrar('exito', 'Estado actualizado')
      } else {
        if (!clave.trim()) {
          toast.mostrar('error', 'La clave es obligatoria')
          setGuardando(false)
          return
        }
        const res = await fetch('/api/estados/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entidad_tipo: entidadTipo,
            clave: clave.trim(),
            etiqueta: etiqueta.trim(),
            grupo,
            color,
            icono,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error al crear')
        }
        toast.mostrar('exito', 'Estado creado')
      }
      setModalAbierto(false)
      refrescar()
    } catch (err) {
      toast.mostrar('error', (err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    try {
      const res = await fetch(`/api/estados/items/${id}?entidad_tipo=${entidadTipo}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast.mostrar('exito', 'Estado eliminado')
      refrescar()
    } catch (err) {
      toast.mostrar('error', (err as Error).message)
    }
  }

  const toggleActivo = async (estado: EstadoConfig) => {
    if (estado.es_sistema) {
      toast.mostrar('info', 'Los estados del sistema no se pueden desactivar')
      return
    }
    try {
      const res = await fetch(`/api/estados/items/${estado.id}?entidad_tipo=${entidadTipo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !estado.activo }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      refrescar()
    } catch (err) {
      toast.mostrar('error', (err as Error).message)
    }
  }

  if (isLoading) return <CargadorSeccion />

  // Mapear estados → ItemLista
  const items: ItemLista[] = estados.map(e => {
    const Icono = obtenerIcono(e.icono)
    return {
      id: e.id,
      nombre: e.etiqueta,
      subtitulo: e.clave,
      icono: Icono ? <Icono size={15} /> : undefined,
      color: e.color,
      activo: e.activo,
      esSistema: e.es_sistema,
      grupo: e.grupo,
      badges: e.es_sistema
        ? [{ texto: 'Sistema', color: 'neutro' }]
        : undefined,
    }
  })

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Estados"
        descripcion="Los del sistema son la base. Podés agregar estados propios para tu empresa."
        items={items}
        controles="toggle-editar-borrar"
        acciones={[
          {
            tipo: 'fantasma',
            icono: <Plus size={16} />,
            soloIcono: true,
            titulo: 'Agregar estado',
            onClick: abrirModalNuevo,
          },
        ]}
        grupos={GRUPOS_ESTADO.map(g => ({
          clave: g,
          etiqueta: ETIQUETAS_GRUPO[g],
        }))}
        onToggleActivo={(item) => {
          const estado = estados.find(e => e.id === item.id)
          if (estado) toggleActivo(estado)
        }}
        onEditar={(item) => {
          const estado = estados.find(e => e.id === item.id)
          if (estado) abrirModalEditar(estado)
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar estado"
        descripcion={`Se eliminará "${estados.find(e => e.id === confirmarEliminar)?.etiqueta || ''}". Las entidades existentes con este estado no se verán afectadas, pero ya no aparecerá como opción.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={async () => {
          if (confirmarEliminar) {
            await eliminar(confirmarEliminar)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={editando ? `Editar: ${editando.etiqueta}` : 'Nuevo estado'}
        tamano="md"
        acciones={
          <>
            <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {editando ? 'Guardar' : 'Crear'}
            </Boton>
          </>
        }
      >
        <div className="space-y-4">
          {!editando && (
            <div>
              <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
                Clave técnica
              </label>
              <Input
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="ej. en_revision"
                className="mt-1"
              />
              <p className="text-[11px] text-texto-terciario mt-1">
                Identificador interno (snake_case, sin tildes). No se podrá cambiar después.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
              Etiqueta visible
            </label>
            <Input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="ej. En revisión"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
              Grupo de comportamiento
            </label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {GRUPOS_ESTADO.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrupo(g)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    grupo === g
                      ? 'bg-texto-marca/15 border border-texto-marca/40 text-texto-marca'
                      : 'border border-borde-sutil text-texto-terciario hover:bg-white/[0.03]'
                  }`}
                >
                  {ETIQUETAS_GRUPO[g]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
              Color
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {COLORES_DISPONIBLES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`size-5 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-superficie-tarjeta' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wider">
              Icono
            </label>
            <Input
              value={icono}
              onChange={(e) => setIcono(e.target.value)}
              placeholder="Circle"
              className="mt-1"
            />
            <p className="text-[11px] text-texto-terciario mt-1">
              Nombre del icono Lucide (ej: Circle, CheckCircle, AlertCircle).
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

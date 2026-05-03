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

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Check, Pipette } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { useToast } from '@/componentes/feedback/Toast'
import { useEstados, type EstadoConfig } from '@/hooks/useEstados'
import { PALETA_COLORES_ESTADO } from '@/lib/colores_entidad'
import {
  ETIQUETAS_GRUPO,
  type EntidadConEstado,
  type GrupoEstado,
} from '@/tipos/estados'

interface Props {
  entidadTipo: EntidadConEstado
}

// Grupos con descripción explicativa (igual que /actividades/configuracion).
// Los grupos clasifican el comportamiento del estado para que workflows
// futuros y reportes razonen sobre semántica, no sobre claves técnicas.
const GRUPOS: { valor: GrupoEstado; etiqueta: string; descripcion: string; colorBolita: string }[] = [
  { valor: 'inicial',    etiqueta: 'Inicial',    descripcion: 'Estado al crearse la entidad (ej: Borrador, Programada)',          colorBolita: 'bg-insignia-info' },
  { valor: 'activo',     etiqueta: 'Activo',     descripcion: 'En uso normal, en curso (ej: En progreso, Abierta)',                colorBolita: 'bg-insignia-advertencia' },
  { valor: 'espera',     etiqueta: 'En espera',  descripcion: 'Bloqueada esperando algo externo (ej: En espera, Pendiente aprobación)', colorBolita: 'bg-insignia-advertencia' },
  { valor: 'completado', etiqueta: 'Completado', descripcion: 'Terminó exitosamente (ej: Cobrada, Resuelta, Pagado)',               colorBolita: 'bg-insignia-exito' },
  { valor: 'cancelado',  etiqueta: 'Cancelado',  descripcion: 'Se canceló o rechazó (ej: Spam, Rechazado, Ausente)',                colorBolita: 'bg-insignia-peligro' },
  { valor: 'error',      etiqueta: 'Error',      descripcion: 'Terminó con error (ej: Fallido, Cerrado automático por inactividad)', colorBolita: 'bg-insignia-peligro' },
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
        grupos={GRUPOS.map(g => ({
          clave: g.valor,
          etiqueta: g.etiqueta,
          descripcion: g.descripcion,
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

      {/* Modal crear/editar — sigue el mismo patrón visual que
          /actividades/configuracion para consistencia entre módulos */}
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
            <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={!etiqueta.trim() || (!editando && !clave.trim())}>
              {editando ? 'Guardar' : 'Crear estado'}
            </Boton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Preview en vivo */}
          <div className="flex items-center gap-3 p-3 rounded-card bg-superficie-hover/50">
            <div
              className="w-9 h-9 rounded-card flex items-center justify-center"
              style={{ backgroundColor: color + '18', color }}
            >
              {(() => {
                const I = obtenerIcono(icono)
                return I ? <I size={18} /> : null
              })()}
            </div>
            <span className="text-sm font-semibold text-texto-primario">
              {etiqueta || 'Nuevo estado'}
            </span>
          </div>

          <Input
            tipo="text"
            etiqueta="Nombre"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Ej: En revisión, Aprobado, Pausado..."
            autoFocus
          />

          {!editando && (
            <Input
              tipo="text"
              etiqueta="Clave técnica"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Ej: en_revision"
              ayuda="Identificador interno usado por el sistema (snake_case, sin tildes ni espacios). No se podrá cambiar después de crear el estado."
            />
          )}

          <SelectorIcono valor={icono} onChange={setIcono} etiqueta="Icono" />

          <SelectorColorEstado valor={color} onChange={setColor} colores={PALETA_COLORES_ESTADO} />

          {/* Grupo de comportamiento — con descripción inline */}
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-1">
              Tipo de comportamiento
            </label>
            <p className="text-xs text-texto-terciario mb-3 leading-relaxed">
              Clasifica cómo se comporta este estado en la app. Lo usan los reportes,
              filtros y las automatizaciones para decidir qué hacer
              (ej: una automatización "cuando el documento se completa" reacciona
              a cualquier estado de tipo <strong className="text-texto-secundario">Completado</strong>,
              sin importar la clave técnica).
            </p>
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
                    <div className={`w-2 h-2 rounded-full shrink-0 ${g.colorBolita}`} />
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium">{g.etiqueta}</p>
                      <p className="text-xs text-texto-terciario leading-snug">{g.descripcion}</p>
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

// ─── Selector de color con paleta + gotero personalizado ──────
// Mismo patrón que SelectorColorDots de /actividades/configuracion.
// Permite elegir un color de la paleta del sistema o usar un color custom
// vía gotero nativo del navegador.

function SelectorColorEstado({
  valor,
  onChange,
  colores,
}: {
  valor: string
  onChange: (c: string) => void
  colores: string[]
}) {
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
              type="button"
              onClick={() => onChange(c)}
              className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Elegir color ${c}`}
            >
              {sel && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
            esCustom
              ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
              : 'border-borde-fuerte'
          }`}
          style={esCustom ? { backgroundColor: valor } : undefined}
          title="Elegir color personalizado"
          aria-label="Elegir color personalizado"
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
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

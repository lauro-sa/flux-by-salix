'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { ModalTipoActividad } from './ModalTipoActividad'

/**
 * SeccionTipos — Lista de tipos de actividad usando ListaConfiguracion unificada.
 * Soporta: drag-and-drop, toggle activo, editar via modal, restablecer.
 */

// Módulos y sub-módulos donde un tipo de actividad puede estar disponible
const MODULOS_DISPONIBLES = [
  { clave: 'contactos', etiqueta: 'Contactos', grupo: 'Principal' },
  { clave: 'inbox', etiqueta: 'Inbox', grupo: 'Principal' },
  { clave: 'visitas', etiqueta: 'Visitas', grupo: 'Principal' },
  { clave: 'calendario', etiqueta: 'Calendario', grupo: 'Principal' },
  { clave: 'presupuestos', etiqueta: 'Presupuestos', grupo: 'Documentos' },
  { clave: 'facturas', etiqueta: 'Facturas', grupo: 'Documentos' },
  { clave: 'ordenes', etiqueta: 'Órdenes de trabajo', grupo: 'Documentos' },
  { clave: 'informes', etiqueta: 'Informes', grupo: 'Documentos' },
  { clave: 'notas_credito', etiqueta: 'Notas de crédito', grupo: 'Documentos' },
  { clave: 'recibos', etiqueta: 'Recibos', grupo: 'Documentos' },
]

export interface TipoActividad {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  modulos_disponibles: string[]
  dias_vencimiento: number
  campo_fecha: boolean
  campo_descripcion: boolean
  campo_responsable: boolean
  campo_prioridad: boolean
  campo_checklist: boolean
  campo_calendario: boolean
  auto_completar: boolean
  resumen_predeterminado: string | null
  nota_predeterminada: string | null
  usuario_predeterminado: string | null
  siguiente_tipo_id: string | null
  tipo_encadenamiento: 'sugerir' | 'activar'
  orden: number
  activo: boolean
  es_predefinido: boolean
  es_sistema: boolean
}

interface PropiedadesSeccionTipos {
  tipos: TipoActividad[]
  miembros: { usuario_id: string; nombre: string; apellido: string }[]
  cargando: boolean
  onActualizar: (tipos: TipoActividad[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

function SeccionTipos({ tipos, miembros, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionTipos) {
  const [orden, setOrden] = useState<TipoActividad[]>(tipos)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoActividad | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { setOrden(tipos) }, [tipos])

  // Toggle activo/inactivo
  const toggleActivo = useCallback(async (tipo: TipoActividad) => {
    const nuevoEstado = !tipo.activo
    const nuevos = orden.map(t => t.id === tipo.id ? { ...t, activo: nuevoEstado } : t)
    onActualizar(nuevos)
    await onAccionAPI('editar_tipo', { id: tipo.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  // Reordenar con drag-and-drop
  const manejarReorden = useCallback(async (idsOrdenados: string[]) => {
    const mapa = new Map(orden.map(t => [t.id, t]))
    const nuevos = idsOrdenados.map(id => mapa.get(id)!).filter(Boolean)
    setOrden(nuevos)
    onActualizar(nuevos)
    await onAccionAPI('reordenar_tipos', { orden: idsOrdenados })
  }, [orden, onActualizar, onAccionAPI])

  // Crear tipo nuevo
  const crearTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const nuevo = await onAccionAPI('crear_tipo', datos) as TipoActividad
      onActualizar([...orden, nuevo])
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  // Editar tipo existente
  const editarTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const actualizado = await onAccionAPI('editar_tipo', datos) as TipoActividad
      onActualizar(orden.map(t => t.id === actualizado.id ? actualizado : t))
      setTipoEditando(null)
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  // Eliminar tipo custom
  const eliminarTipo = useCallback(async (id: string) => {
    await onAccionAPI('eliminar_tipo', { id })
    onActualizar(orden.filter(t => t.id !== id))
  }, [orden, onActualizar, onAccionAPI])

  // Restablecer valores de fábrica
  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await onAccionAPI('restablecer', {}) as { tipos: TipoActividad[] }
      onActualizar(res.tipos)
      setConfirmarRestablecer(false)
    } finally {
      setGuardando(false)
    }
  }, [onActualizar, onAccionAPI])

  if (cargando) return <CargadorSeccion />

  // ─── Mapear TipoActividad → ItemLista ───────────────────────────
  const itemsLista: ItemLista[] = orden.map(tipo => {
    const Icono = obtenerIcono(tipo.icono)
    return {
      id: tipo.id,
      nombre: tipo.etiqueta,
      icono: Icono ? <Icono size={20} /> : undefined,
      color: tipo.color,
      tags: tipo.modulos_disponibles.map(mod => ({ texto: mod, variante: 'neutro' as const })),
      activo: tipo.activo,
      esPredefinido: tipo.es_predefinido,
      esSistema: tipo.es_sistema,
      datos: { original: tipo },
    }
  })

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Tipos de actividad"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
        controles="toggle-editar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Agregar tipo',
          onClick: () => { setTipoEditando(null); setModalAbierto(true) },
        }]}
        onToggleActivo={(item) => {
          const tipo = orden.find(t => t.id === item.id)
          if (tipo) toggleActivo(tipo)
        }}
        onEditar={(item) => {
          const tipo = orden.find(t => t.id === item.id)
          if (tipo?.es_sistema) return // Tipos del sistema no se pueden editar
          if (tipo) { setTipoEditando(tipo); setModalAbierto(true) }
        }}
        onEliminar={(item) => {
          const tipo = orden.find(t => t.id === item.id)
          if (tipo?.es_sistema) return // Tipos del sistema no se pueden eliminar
          setConfirmarEliminar(item.id)
        }}
        onReordenar={manejarReorden}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
      />

      {/* Modal crear/editar tipo */}
      <ModalTipoActividad
        abierto={modalAbierto}
        tipo={tipoEditando}
        tipos={tipos}
        miembros={miembros}
        modulosDisponibles={MODULOS_DISPONIBLES}
        guardando={guardando}
        onGuardar={tipoEditando ? editarTipo : crearTipo}
        onCerrar={() => { setModalAbierto(false); setTipoEditando(null) }}
        onEliminar={tipoEditando && !tipoEditando.es_predefinido && !tipoEditando.es_sistema ? () => eliminarTipo(tipoEditando.id) : undefined}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar tipo de actividad"
        descripcion={`Se eliminará "${orden.find(t => t.id === confirmarEliminar)?.etiqueta || ''}". Las actividades existentes con este tipo no se verán afectadas.`}
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
        titulo="Restablecer tipos de actividad"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Las actividades existentes no se verán afectadas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

export { SeccionTipos, MODULOS_DISPONIBLES }

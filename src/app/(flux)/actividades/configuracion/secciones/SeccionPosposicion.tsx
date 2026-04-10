'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock } from 'lucide-react'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { ModalItemConfiguracion } from '@/componentes/ui/ModalItemConfiguracion'

/**
 * SeccionPosposicion — Configurar los presets de posposición.
 * Define los intervalos disponibles en la acción rápida de posponer (1 día, 3 días, etc.)
 */

interface PresetPosposicion {
  id: string
  etiqueta: string
  dias: number
}

interface PropiedadesSeccion {
  config: { presets_posposicion: PresetPosposicion[] } | null
  cargando: boolean
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

const PRESETS_DEFAULT: PresetPosposicion[] = [
  { id: '1d', etiqueta: '1 día', dias: 1 },
  { id: '3d', etiqueta: '3 días', dias: 3 },
  { id: '1s', etiqueta: '1 semana', dias: 7 },
  { id: '2s', etiqueta: '2 semanas', dias: 14 },
]

function formatearEtiquetaCorta(dias: number) {
  if (dias < 7) return `${dias}d`
  if (dias === 7) return '1 sem'
  if (dias === 14) return '2 sem'
  return `${Math.round(dias / 7)}sem`
}

function SeccionPosposicion({ config, cargando, onAccionAPI }: PropiedadesSeccion) {
  const [presets, setPresets] = useState<PresetPosposicion[]>(PRESETS_DEFAULT)
  const [guardando, setGuardando] = useState(false)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoPreset, setEditandoPreset] = useState<PresetPosposicion | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  useEffect(() => {
    if (config?.presets_posposicion) {
      setPresets(config.presets_posposicion)
    }
  }, [config])

  const guardar = useCallback(async (nuevos: PresetPosposicion[]) => {
    setPresets(nuevos)
    setGuardando(true)
    try {
      await onAccionAPI('actualizar_config', { presets_posposicion: nuevos })
    } finally {
      setGuardando(false)
    }
  }, [onAccionAPI])

  const agregar = () => {
    const nuevoDias = Math.max(...presets.map(p => p.dias), 0) + 7
    const nuevo: PresetPosposicion = {
      id: crypto.randomUUID(),
      etiqueta: `${nuevoDias} días`,
      dias: nuevoDias,
    }
    guardar([...presets, nuevo])
  }

  const actualizar = (id: string, dias: number) => {
    const etiqueta = dias === 1 ? '1 día' : dias < 7 ? `${dias} días` : dias === 7 ? '1 semana' : dias === 14 ? '2 semanas' : `${dias} días`
    guardar(presets.map(p => p.id === id ? { ...p, dias, etiqueta } : p))
  }

  const eliminar = async (id: string) => {
    await guardar(presets.filter(p => p.id !== id))
  }

  const restablecer = async () => {
    await guardar(PRESETS_DEFAULT)
    setConfirmarRestablecer(false)
  }

  if (cargando) return <CargadorSeccion />

  // ─── Mapear PresetPosposicion → ItemLista ──────────────────────────
  const itemsLista: ItemLista[] = presets.map(p => ({
    id: p.id,
    nombre: p.etiqueta,
    datos: { dias: p.dias },
  }))

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Opciones de posposición"
        descripcion="Arrastrá para reordenar. Este orden se refleja en la acción rápida de posponer."
        items={itemsLista}
        controles="solo-borrar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Agregar opción',
          onClick: () => { setEditandoPreset(null); setModalAbierto(true) },
        }]}
        onEditar={(item) => {
          const p = presets.find(pr => pr.id === item.id)
          if (p) { setEditandoPreset(p); setModalAbierto(true) }
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
        onReordenar={(idsOrdenados) => {
          const mapa = new Map(presets.map(p => [p.id, p]))
          const nuevos = idsOrdenados.map(id => mapa.get(id)!).filter(Boolean)
          guardar(nuevos)
        }}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
      />

      {/* Modal crear/editar preset */}
      <ModalItemConfiguracion
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setEditandoPreset(null) }}
        titulo={editandoPreset ? 'Editar intervalo' : 'Nuevo intervalo'}
        campos={[
          { tipo: 'numero', clave: 'dias', etiqueta: 'Días', placeholder: 'Ej: 7', min: 1, max: 365, sufijo: 'días de posposición' },
        ]}
        valores={editandoPreset ? { dias: editandoPreset.dias } : undefined}
        onGuardar={(valores) => {
          const dias = Number(valores.dias) || 1
          const etiqueta = dias === 1 ? '1 día' : dias < 7 ? `${dias} días` : dias === 7 ? '1 semana' : dias === 14 ? '2 semanas' : `${dias} días`
          if (editandoPreset) {
            guardar(presets.map(p => p.id === editandoPreset.id ? { ...p, dias, etiqueta } : p))
          } else {
            guardar([...presets, { id: crypto.randomUUID(), etiqueta, dias }])
          }
          setModalAbierto(false)
          setEditandoPreset(null)
        }}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar opción de posposición"
        descripcion={`Se eliminará la opción de ${presets.find(p => p.id === confirmarEliminar)?.etiqueta || ''}.`}
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

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer posposición"
        descripcion="Se restablecerán los intervalos a los valores por defecto (1 día, 3 días, 1 semana, 2 semanas)."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

export { SeccionPosposicion }

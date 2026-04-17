'use client'

import { useState } from 'react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalEditorPlantillaCorreo } from '@/componentes/entidad/ModalEditorPlantillaCorreo'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { Plus, FileText, RotateCcw } from 'lucide-react'
import type { PlantillaRespuesta } from '@/tipos/inbox'

/**
 * Sección de plantillas de correo — lista unificada con badge Sistema/Personal.
 * Las plantillas de sistema no se pueden eliminar y pueden restaurarse al original.
 */
export function SeccionPlantillasCorreo({
  canal,
  plantillas,
  onRecargar,
}: {
  canal: 'whatsapp' | 'correo'
  plantillas: PlantillaRespuesta[]
  onRecargar: () => void
}) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaRespuesta | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<PlantillaRespuesta | null>(null)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)

  const handleEliminar = async (p: PlantillaRespuesta) => {
    setEliminando(true)
    try {
      await fetch(`/api/correo/plantillas/${p.id}`, { method: 'DELETE' })
      onRecargar()
    } catch { /* silenciar */ }
    finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const handleRestaurar = async (p: PlantillaRespuesta) => {
    setRestaurando(true)
    try {
      await fetch(`/api/correo/plantillas/${p.id}/restaurar`, { method: 'POST' })
      onRecargar()
    } catch { /* silenciar */ }
    finally {
      setRestaurando(false)
      setConfirmarRestaurar(null)
    }
  }

  if (plantillas.length === 0) {
    return (
      <div className="space-y-4">
        <EstadoVacio
          icono={<FileText />}
          titulo="Sin plantillas"
          descripcion={`Creá tu primera plantilla de ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'} para agilizar respuestas.`}
        />
      </div>
    )
  }

  // ─── Helper: verificar si una plantilla de sistema fue modificada ───
  const fueModificada = (p: PlantillaRespuesta): boolean => {
    if (!p.es_sistema || !p.contenido_original_html || !p.asunto_original) return false
    return p.contenido_html !== p.contenido_original_html || p.asunto !== p.asunto_original
  }

  // ─── Mapear TODAS las plantillas a items de lista (unificada) ───
  const items: ItemLista[] = plantillas.map(p => {
    const esSistema = !!p.es_sistema
    const esPorDefecto = (p.variables || []).some((v: { clave: string }) => v.clave === '_es_por_defecto')
    const modificada = fueModificada(p)

    const badges: ItemLista['badges'] = []
    badges.push(esSistema
      ? { texto: 'Sistema', color: 'neutro' }
      : { texto: 'Personal', color: 'primario' },
    )
    if (modificada) badges.push({ texto: 'Modificada', color: 'advertencia' })
    if (esPorDefecto) badges.push({ texto: 'Por defecto', color: 'exito' })

    const tags: ItemLista['tags'] = []
    if (p.modulos.length > 0) {
      p.modulos.forEach(m => tags!.push({ texto: m }))
    }

    return {
      id: p.id,
      nombre: p.nombre,
      subtitulo: p.asunto || undefined,
      badges,
      tags,
      esSistema,
    }
  })

  return (
    <div className="space-y-6">
      <ListaConfiguracion
        titulo="Plantillas de correo"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={items}
        controles="editar-borrar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Nueva plantilla',
          onClick: () => { setPlantillaEditando(null); setModalAbierto(true) },
        }]}
        onEditar={(item) => {
          const p = plantillas.find(pl => pl.id === item.id)
          if (p) { setPlantillaEditando(p); setModalAbierto(true) }
        }}
        onEliminar={(item) => {
          const p = plantillas.find(pl => pl.id === item.id)
          if (p) setConfirmarEliminar(p)
        }}
        renderControlesExtra={(item) => {
          const p = plantillas.find(pl => pl.id === item.id)
          if (!p || !p.es_sistema || !fueModificada(p)) return null
          return (
            <button
              type="button"
              onClick={() => setConfirmarRestaurar(p)}
              title="Restaurar original"
              className="size-7 inline-flex items-center justify-center rounded-md text-insignia-advertencia hover:bg-insignia-advertencia/10 transition-colors cursor-pointer bg-transparent border-none"
            >
              <RotateCcw size={13} />
            </button>
          )
        }}
      />

      {/* Modal editor */}
      {canal === 'correo' && (
        <ModalEditorPlantillaCorreo
          abierto={modalAbierto}
          onCerrar={() => { setModalAbierto(false); setPlantillaEditando(null) }}
          plantilla={plantillaEditando}
          onGuardado={onRecargar}
        />
      )}

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar plantilla"
        descripcion={`¿Estás seguro de eliminar "${confirmarEliminar?.nombre}"?`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restaurar */}
      <ModalConfirmacion
        abierto={!!confirmarRestaurar}
        titulo="Restaurar plantilla"
        descripcion={`¿Restaurar "${confirmarRestaurar?.nombre}" a su contenido original? Se perderán los cambios realizados.`}
        etiquetaConfirmar="Restaurar"
        tipo="info"
        cargando={restaurando}
        onConfirmar={() => { if (confirmarRestaurar) handleRestaurar(confirmarRestaurar) }}
        onCerrar={() => setConfirmarRestaurar(null)}
      />
    </div>
  )
}

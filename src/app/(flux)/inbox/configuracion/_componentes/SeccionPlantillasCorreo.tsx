'use client'

import { useState } from 'react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalEditorPlantillaCorreo } from '@/componentes/entidad/ModalEditorPlantillaCorreo'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { Plus, FileText, Shield } from 'lucide-react'
import type { PlantillaRespuesta } from '@/tipos/inbox'

/**
 * Sección de plantillas de correo — usa ListaConfiguracion unificada.
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
  const [eliminando, setEliminando] = useState(false)

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

  // ─── Mapear PlantillaRespuesta → ItemLista ─────────────────────────
  const itemsLista: ItemLista[] = plantillas.map(p => {
    const tieneHtml = (p.contenido_html || '').includes('<') && (p.contenido_html || '').includes('>')
    const esPorDefecto = (p.variables || []).some((v: { clave: string }) => v.clave === '_es_por_defecto')

    const badges: ItemLista['badges'] = []
    if (esPorDefecto) badges.push({ texto: 'Por defecto', color: 'exito' })
    badges.push({ texto: tieneHtml ? 'HTML' : 'Visual', color: tieneHtml ? 'info' : 'neutro' })

    const tags: ItemLista['tags'] = []
    if (p.modulos.length > 0) {
      p.modulos.forEach(m => tags!.push({ texto: m }))
    } else {
      tags.push({ texto: 'Todos los módulos', variante: 'neutro' })
    }
    if (p.disponible_para === 'todos') tags.push({ texto: 'Todos los usuarios', variante: 'neutro' })
    if (p.disponible_para === 'roles') tags.push({ texto: 'Roles', variante: 'neutro' })
    if (p.disponible_para === 'usuarios') tags.push({ texto: 'Usuarios específicos', variante: 'neutro' })

    return {
      id: p.id,
      nombre: p.nombre,
      subtitulo: p.asunto || undefined,
      preview: p.contenido?.substring(0, 100),
      badges,
      tags,
    }
  })

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Plantillas de correo"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
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
    </div>
  )
}

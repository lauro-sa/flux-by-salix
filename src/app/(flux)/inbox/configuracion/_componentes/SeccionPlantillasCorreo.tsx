'use client'

import { useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalEditorPlantillaCorreo } from '@/componentes/entidad/ModalEditorPlantillaCorreo'
import {
  Plus, Trash2, FileText, Pencil, GripVertical, Shield, Loader2,
} from 'lucide-react'
import type { PlantillaRespuesta } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'

/**
 * Sección de plantillas de correo — lista con editor visual HTML.
 * Se usa en la configuración del inbox cuando la sección activa es "plantillas_correo".
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
  const { t } = useTraduccion()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const handleNueva = () => {
    setPlantillaEditando(null)
    setModalAbierto(true)
  }

  const handleEditar = (p: PlantillaRespuesta) => {
    setPlantillaEditando(p)
    setModalAbierto(true)
  }

  const handleEliminar = async (id: string) => {
    setEliminando(id)
    try {
      await fetch(`/api/inbox/plantillas/${id}`, { method: 'DELETE' })
      onRecargar()
    } catch { /* silenciar */ }
    finally { setEliminando(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          {canal === 'whatsapp' ? t('inbox.config.plantillas_whatsapp') : t('inbox.config.plantillas_correo')}
        </h3>
        <Boton variante="primario" tamano="sm" icono={<Plus size={14} />} onClick={handleNueva}>
          Nueva plantilla
        </Boton>
      </div>

      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
        Creá plantillas con variables como {'{{contacto.nombre}}'}, {'{{presupuesto.numero}}'} para respuestas rápidas.
        Podés definir en qué módulos se usan y quién puede acceder a ellas.
      </p>

      {plantillas.length === 0 ? (
        <EstadoVacio
          icono={<FileText />}
          titulo="Sin plantillas"
          descripcion={`Creá tu primera plantilla de ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'} para agilizar respuestas.`}
        />
      ) : (
        <div className="space-y-2">
          {plantillas.map((p) => {
            const tieneHtml = (p.contenido_html || '').includes('<') && (p.contenido_html || '').includes('>')
            const esPorDefecto = (p.variables || []).some((v: { clave: string }) => v.clave === '_es_por_defecto')
            return (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3.5 rounded-lg transition-colors hover:bg-[var(--superficie-hover)] cursor-pointer"
              style={{ border: '1px solid var(--borde-sutil)' }}
              onClick={() => handleEditar(p)}
            >
              <GripVertical size={14} style={{ color: 'var(--texto-terciario)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {p.nombre}
                  </p>
                  {esPorDefecto && <Insignia color="exito" tamano="sm">Por defecto</Insignia>}
                  {tieneHtml ? (
                    <Insignia color="info" tamano="sm">HTML</Insignia>
                  ) : (
                    <Insignia color="neutro" tamano="sm">Visual</Insignia>
                  )}
                </div>
                {p.asunto && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--texto-secundario)' }}>
                    {p.asunto}
                  </p>
                )}
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
                  {p.contenido?.substring(0, 100)}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {p.modulos.length > 0 ? p.modulos.map((m) => (
                    <Insignia key={m} color="primario" tamano="sm">{m}</Insignia>
                  )) : (
                    <Insignia color="neutro" tamano="sm">Todos los módulos</Insignia>
                  )}
                  {p.disponible_para === 'todos' && (
                    <Insignia color="neutro" tamano="sm">Todos los usuarios</Insignia>
                  )}
                  {p.disponible_para === 'roles' && (
                    <Insignia color="advertencia" tamano="sm"><Shield size={10} className="inline mr-0.5" />Roles</Insignia>
                  )}
                  {p.disponible_para === 'usuarios' && (
                    <Insignia color="advertencia" tamano="sm">Usuarios específicos</Insignia>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Boton
                  variante="fantasma" tamano="xs" soloIcono icono={<Pencil size={12} />}
                  onClick={() => handleEditar(p)}
                />
                <Boton
                  variante="peligro" tamano="xs" soloIcono
                  icono={eliminando === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  onClick={() => handleEliminar(p.id)}
                  disabled={eliminando === p.id}
                />
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Modal editor de plantilla (solo para correo) */}
      {canal === 'correo' && (
        <ModalEditorPlantillaCorreo
          abierto={modalAbierto}
          onCerrar={() => { setModalAbierto(false); setPlantillaEditando(null) }}
          plantilla={plantillaEditando}
          onGuardado={onRecargar}
        />
      )}
    </div>
  )
}

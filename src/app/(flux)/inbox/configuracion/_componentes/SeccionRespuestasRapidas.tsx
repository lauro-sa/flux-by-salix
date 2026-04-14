'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/componentes/feedback/Toast'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { Zap, Plus } from 'lucide-react'
import type { PlantillaRespuesta } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import { formatoWhatsAppAHtml } from './EditorWhatsApp'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'

/**
 * Sección de respuestas rápidas — usa ListaConfiguracion (misma plantilla que Pipeline/Etapas).
 * Soporta drag-and-drop para reordenar, con persistencia en BD (campo `orden`).
 */
export function SeccionRespuestasRapidas({
  plantillas,
  onRecargar,
  canalesPermitidos,
}: {
  plantillas: PlantillaRespuesta[]
  onRecargar: () => void
  canalesPermitidos?: ('whatsapp' | 'correo' | 'interno' | 'todos')[]
}) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState<PlantillaRespuesta | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Ordenar: primero por campo `orden`, luego alfabéticamente
  const respuestas = plantillas
    .filter(p => p.activo)
    .sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden
      return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
    })

  // Mapear a ItemLista para ListaConfiguracion
  const items: ItemLista[] = respuestas.map(p => ({
    id: p.id,
    nombre: p.nombre,
    subtitulo: p.contenido.slice(0, 120),
    icono: <Zap size={14} style={{ color: 'var(--texto-marca)' }} />,
    badges: [
      ...(p.categoria ? [{ texto: p.categoria, color: 'neutro' as const }] : []),
      {
        texto: p.canal === 'todos' ? t('comun.todos') : p.canal === 'whatsapp' ? t('inbox.canales.whatsapp') : t('inbox.canales.correo'),
        color: (p.canal === 'todos' ? 'primario' : p.canal === 'whatsapp' ? 'exito' : 'info') as 'primario' | 'exito' | 'info',
      },
    ],
  }))

  const guardar = async (datos: { nombre: string; contenido: string; contenido_html: string; categoria: string; canal: string }) => {
    setGuardando(true)
    try {
      if (editando) {
        await fetch(`/api/inbox/plantillas/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      } else {
        const maxOrden = respuestas.reduce((max, p) => Math.max(max, p.orden ?? 0), 0)
        await fetch('/api/inbox/plantillas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...datos, orden: maxOrden + 1 }),
        })
      }
      setModalAbierto(false)
      setEditando(null)
      onRecargar()
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!eliminando) return
    try {
      await fetch(`/api/inbox/plantillas/${eliminando.id}`, { method: 'DELETE' })
      setEliminando(null)
      onRecargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    }
  }

  // Persistir nuevo orden en BD tras drag-and-drop
  const manejarReorden = useCallback(async (idsOrdenados: string[]) => {
    try {
      await Promise.all(
        idsOrdenados.map((id, i) =>
          fetch(`/api/inbox/plantillas/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden: i }),
          })
        )
      )
      onRecargar()
    } catch {
      mostrar('error', 'Error al reordenar')
      onRecargar()
    }
  }, [onRecargar, mostrar])

  // Restaurar orden alfabético
  const restaurarOrdenAlfabetico = useCallback(async () => {
    try {
      await Promise.all(
        respuestas.map(p =>
          fetch(`/api/inbox/plantillas/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden: 0 }),
          })
        )
      )
      onRecargar()
      mostrar('exito', 'Orden restaurado a alfabético')
    } catch {
      mostrar('error', 'Error al restaurar el orden')
    }
  }, [respuestas, onRecargar, mostrar])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Respuestas rápidas
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
          Mensajes predefinidos que los agentes pueden insertar escribiendo <code
            className="px-1 py-0.5 rounded text-xxs"
            style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
          >/</code> en el compositor.
        </p>
      </div>

      <ListaConfiguracion
        titulo="Respuestas"
        descripcion="Arrastrá para reordenar. Este orden se refleja al escribir /."
        items={items}
        controles="editar-borrar"
        ordenable
        onReordenar={manejarReorden}
        onEditar={(item) => {
          const p = respuestas.find(r => r.id === item.id)
          if (p) { setEditando(p); setModalAbierto(true) }
        }}
        onEliminar={(item) => {
          const p = respuestas.find(r => r.id === item.id)
          if (p) setEliminando(p)
        }}
        acciones={[{
          tipo: 'secundario',
          icono: <Plus size={14} />,
          soloIcono: true,
          titulo: 'Nueva respuesta',
          onClick: () => { setEditando(null); setModalAbierto(true) },
        }]}
        restaurable={respuestas.some(p => p.orden !== 0)}
        onRestaurar={restaurarOrdenAlfabetico}
        textoRestablecer="Orden A-Z"
      />

      {/* Modal crear/editar */}
      {modalAbierto && (
        <ModalRespuestaRapida
          plantilla={editando}
          onGuardar={guardar}
          onCerrar={() => { setModalAbierto(false); setEditando(null) }}
          guardando={guardando}
          canalesPermitidos={canalesPermitidos}
        />
      )}

      {/* Modal confirmar eliminación */}
      {eliminando && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => setEliminando(null)}
          onConfirmar={eliminar}
          titulo="¿Eliminar respuesta rápida?"
          descripcion={`Se eliminará "${eliminando.nombre}". Los agentes ya no podrán usarla.`}
          tipo="peligro"
          etiquetaConfirmar={t('comun.eliminar')}
        />
      )}
    </div>
  )
}

/**
 * Modal para crear/editar respuesta rápida — textarea con preview estilo WhatsApp.
 */
function ModalRespuestaRapida({
  plantilla,
  onGuardar,
  onCerrar,
  guardando,
  canalesPermitidos,
}: {
  plantilla: PlantillaRespuesta | null
  onGuardar: (datos: { nombre: string; contenido: string; contenido_html: string; categoria: string; canal: string }) => void
  onCerrar: () => void
  guardando: boolean
  canalesPermitidos?: ('whatsapp' | 'correo' | 'interno' | 'todos')[]
}) {
  const { t } = useTraduccion()
  const [nombre, setNombre] = useState(plantilla?.nombre || '')
  const [categoria, setCategoria] = useState(plantilla?.categoria || '')
  const [canal, setCanal] = useState(plantilla?.canal || 'todos')
  const [contenido, setContenido] = useState(plantilla?.contenido || '')

  const manejarGuardar = () => {
    if (!nombre.trim() || !contenido.trim()) return
    onGuardar({
      nombre: nombre.trim(),
      contenido: contenido,
      contenido_html: formatoWhatsAppAHtml(contenido),
      categoria: categoria.trim(),
      canal,
    })
  }

  return (
    <Modal
      abierto={true}
      onCerrar={onCerrar}
      titulo={plantilla ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}
      tamano="3xl"
      acciones={
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
          <Boton
            variante="primario"
            tamano="sm"
            onClick={manejarGuardar}
            disabled={guardando || !nombre.trim() || !contenido.trim()}
          >
            {guardando ? t('contactos.guardando') : plantilla ? t('comun.guardar_cambios') : 'Crear respuesta'}
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
            Nombre (para buscar con /)
          </label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Presupuesto enviado, Saludo inicial, Horarios..."
            compacto
            formato={null}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
              Categoría (opcional)
            </label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: Ventas, Soporte, Info..."
              compacto
              formato={null}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
              Disponible en
            </label>
            <Select
              valor={canal}
              onChange={(v: string) => setCanal(v as 'correo' | 'whatsapp' | 'interno' | 'todos')}
              opciones={[
                { valor: 'todos', etiqueta: `${t('comun.todos')} los canales` },
                { valor: 'whatsapp', etiqueta: `Solo ${t('inbox.canales.whatsapp')}` },
                { valor: 'correo', etiqueta: `Solo ${t('inbox.canales.correo')}` },
              ].filter(o => !canalesPermitidos || canalesPermitidos.includes(o.valor as 'whatsapp' | 'correo' | 'interno' | 'todos'))}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
            Mensaje
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <TextArea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder={'Pegá o escribí tu mensaje acá...\n\nFormato WhatsApp:\n*negrita*  _cursiva_  ~tachado~'}
                style={{ minHeight: 220 }}
                spellCheck={false}
              />
              <p className="text-xxs mt-1.5" style={{ color: 'var(--texto-terciario)' }}>
                Emojis, saltos de línea y formato WhatsApp se conservan al enviar.
              </p>
            </div>

            <div>
              <div
                className="rounded-lg p-3 text-sm overflow-y-auto"
                style={{
                  background: 'var(--superficie-hover)',
                  border: '1px solid var(--borde-sutil)',
                  minHeight: 220,
                  maxHeight: 300,
                }}
              >
                {contenido ? (
                  <HtmlSeguro
                    html={formatoWhatsAppAHtml(contenido)}
                    className="text-sm leading-relaxed"
                  />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    Vista previa del mensaje...
                  </p>
                )}
              </div>
              <p className="text-xxs mt-1.5" style={{ color: 'var(--texto-terciario)' }}>
                Así se verá en WhatsApp
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-4 mt-2 px-2 py-1.5 rounded text-xxs"
            style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
          >
            <span><strong>*negrita*</strong></span>
            <span><em>_cursiva_</em></span>
            <span><del>~tachado~</del></span>
            <span><code>{'```código```'}</code></span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

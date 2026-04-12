'use client'

import { useState } from 'react'
import { useToast } from '@/componentes/feedback/Toast'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Plus, Trash2, Zap, Pencil } from 'lucide-react'
import type { PlantillaRespuesta } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import { formatoWhatsAppAHtml } from './EditorWhatsApp'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'

/**
 * Sección de respuestas rápidas — atajos de texto con formato que el agente inserta con `/` en el compositor.
 * Separadas de las plantillas de Meta (WhatsApp Business templates).
 */
export function SeccionRespuestasRapidas({
  plantillas,
  onRecargar,
}: {
  plantillas: PlantillaRespuesta[]
  onRecargar: () => void
}) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<PlantillaRespuesta | null>(null)
  const [eliminando, setEliminando] = useState<PlantillaRespuesta | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Solo las que NO son plantillas de Meta (canal 'todos' o cualquier canal)
  const respuestas = plantillas.filter(p => p.activo)

  const guardar = async (datos: { nombre: string; contenido: string; categoria: string; canal: string }) => {
    setGuardando(true)
    try {
      if (editando) {
        await fetch(`/api/inbox/plantillas/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      } else {
        await fetch('/api/inbox/plantillas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
      }
      setModalAbierto(false)
      setEditando(null)
      onRecargar()
    } catch {
      mostrar('error', 'Error al guardar la configuración')
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
      mostrar('error', 'Error al guardar la configuración')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Respuestas rápidas
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
            Mensajes predefinidos que los agentes pueden insertar escribiendo <code
              className="px-1 py-0.5 rounded text-xxs"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
            >/</code> en el compositor. Soportan formato de texto.
          </p>
        </div>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Plus size={14} />}
          onClick={() => { setEditando(null); setModalAbierto(true) }}
        >
          Nueva respuesta
        </Boton>
      </div>

      {respuestas.length === 0 ? (
        <EstadoVacio
          icono={<Zap />}
          titulo="Sin respuestas rápidas"
          descripcion="Creá respuestas predefinidas para que los agentes respondan más rápido. Pueden incluir formato (negrita, cursiva, listas, etc.)."
        />
      ) : (
        <div className="space-y-2">
          {respuestas.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 p-3 rounded-lg group transition-colors"
              style={{ border: '1px solid var(--borde-sutil)' }}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Zap size={14} style={{ color: 'var(--texto-marca)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {p.nombre}
                  </p>
                  {p.categoria && <Insignia color="neutro" tamano="sm">{p.categoria}</Insignia>}
                  <Insignia
                    color={p.canal === 'todos' ? 'primario' : p.canal === 'whatsapp' ? 'exito' : 'info'}
                    tamano="sm"
                  >
                    {p.canal === 'todos' ? t('comun.todos') : p.canal === 'whatsapp' ? t('inbox.canales.whatsapp') : t('inbox.canales.correo')}
                  </Insignia>
                </div>
                {/* Preview del contenido con formato */}
                {p.contenido_html ? (
                  <HtmlSeguro
                    html={p.contenido_html}
                    className="text-xs mt-1 line-clamp-2 prose-sm"
                  />
                ) : (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--texto-terciario)' }}>
                    {p.contenido}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo="Editar"
                  icono={<Pencil size={12} />}
                  onClick={() => { setEditando(p); setModalAbierto(true) }}
                />
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo="Eliminar"
                  icono={<Trash2 size={12} />}
                  onClick={() => setEliminando(p)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <ModalRespuestaRapida
          plantilla={editando}
          onGuardar={guardar}
          onCerrar={() => { setModalAbierto(false); setEditando(null) }}
          guardando={guardando}
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
}: {
  plantilla: PlantillaRespuesta | null
  onGuardar: (datos: { nombre: string; contenido: string; contenido_html: string; categoria: string; canal: string }) => void
  onCerrar: () => void
  guardando: boolean
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
        {/* Nombre */}
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

        {/* Categoría + Canal */}
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
              ]}
            />
          </div>
        </div>

        {/* Textarea + Preview lado a lado */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
            Mensaje
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Textarea */}
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

            {/* Preview estilo WhatsApp */}
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

          {/* Referencia rápida de formato */}
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

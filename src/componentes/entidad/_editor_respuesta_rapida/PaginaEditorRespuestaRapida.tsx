'use client'

/**
 * PaginaEditorRespuestaRapida — Editor a pantalla completa para respuestas rápidas.
 * Canal fijo (correo o whatsapp) — cada listado provee su canal y rutaApi.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Save, Send, Mail } from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import { useToast } from '@/componentes/feedback/Toast'
import { formatoWhatsAppAHtml } from '@/app/(flux)/whatsapp/_componentes/EditorWhatsApp'
import { OPCIONES_DISPONIBLE, OPCIONES_VISIBILIDAD } from '@/componentes/entidad/_editor_plantilla/constantes'
import type { PlantillaRespuesta } from '@/tipos/inbox'

interface Props {
  /** Plantilla a editar (null = nueva) */
  plantilla: PlantillaRespuesta | null
  /** Canal fijo del editor */
  canalFijo: 'correo' | 'whatsapp'
  /** Ruta base del endpoint REST (ej: '/api/correo/respuestas-rapidas') */
  rutaApi: string
  /** Ruta a la que volver */
  rutaVolver: string
  /** Texto del botón volver */
  textoVolver?: string
}

export function PaginaEditorRespuestaRapida({
  plantilla,
  canalFijo,
  rutaApi,
  rutaVolver,
  textoVolver = 'Respuestas rápidas',
}: Props) {
  const router = useRouter()
  const { mostrar } = useToast()
  const esEdicion = !!plantilla
  const canal = canalFijo

  // ─── Estado del formulario ───
  const [nombre, setNombre] = useState(plantilla?.nombre || '')
  const [contenido, setContenido] = useState(plantilla?.contenido || '')
  const [contenidoHtml, setContenidoHtml] = useState(plantilla?.contenido_html || plantilla?.contenido || '')
  const [visibilidad, setVisibilidad] = useState<string>(plantilla?.disponible_para || 'todos')
  const [modulos, setModulos] = useState<string[]>(plantilla?.modulos || [])
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<Array<{ id: string; nombre: string; correo: string }>>([])
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>(plantilla?.usuarios_permitidos || [])
  const [guardando, setGuardando] = useState(false)

  const esCorreo = canal !== 'whatsapp'
  const tieneContenido = esCorreo
    ? contenidoHtml.replace(/<[^>]*>/g, '').trim().length > 0
    : contenido.trim().length > 0

  // Cargar usuarios de la empresa si hay que mostrarlos
  useEffect(() => {
    if (visibilidad !== 'usuarios') return
    fetch('/api/usuarios').then(r => r.json()).then(d => setUsuariosEmpresa(d.usuarios || [])).catch(() => {})
  }, [visibilidad])

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!nombre.trim()) {
      mostrar('error', 'El nombre es obligatorio')
      return
    }
    if (!tieneContenido) {
      mostrar('error', 'Escribí el contenido del mensaje')
      return
    }

    setGuardando(true)
    try {
      const textoPlano = esCorreo
        ? contenidoHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        : contenido
      const htmlFinal = esCorreo ? contenidoHtml : formatoWhatsAppAHtml(contenido)

      const datos = {
        nombre: nombre.trim(),
        contenido: textoPlano,
        contenido_html: htmlFinal,
        categoria: '',
        modulos,
        disponible_para: visibilidad === 'solo_yo' ? 'usuarios' : visibilidad,
        usuarios_permitidos: visibilidad === 'usuarios' ? usuariosSeleccionados : [],
      }

      if (esEdicion && plantilla) {
        await fetch(`${rutaApi}/${plantilla.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        mostrar('exito', 'Respuesta actualizada')
      } else {
        await fetch(rutaApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        mostrar('exito', 'Respuesta creada')
      }
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Acciones del cabecero ───
  const acciones = [
    {
      id: 'guardar',
      etiqueta: esEdicion ? 'Guardar' : 'Crear respuesta',
      icono: <Save size={14} />,
      onClick: handleGuardar,
      variante: 'primario' as const,
      cargando: guardando,
    },
  ]

  // ─── Panel de configuración (izquierda) ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Visibilidad */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Quién la puede usar
        </label>
        <Select
          opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
          valor={visibilidad}
          onChange={setVisibilidad}
        />
      </div>

      {/* Selector de usuarios (si visibilidad = usuarios) */}
      {visibilidad === 'usuarios' && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Usuarios asignados ({usuariosSeleccionados.length})
          </label>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06]">
            {usuariosEmpresa.length > 0 ? usuariosEmpresa.map(u => {
              const seleccionado = usuariosSeleccionados.includes(u.id)
              return (
                <label
                  key={u.id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.04] ${seleccionado ? 'bg-texto-marca/8' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionado}
                    onChange={() => setUsuariosSeleccionados(prev =>
                      seleccionado ? prev.filter(id => id !== u.id) : [...prev, u.id]
                    )}
                    className="rounded accent-texto-marca"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-texto-primario">{u.nombre}</p>
                    <p className="text-xxs truncate text-texto-terciario">{u.correo}</p>
                  </div>
                </label>
              )
            }) : (
              <p className="px-3 py-3 text-xs text-center text-texto-terciario">Cargando...</p>
            )}
          </div>
        </div>
      )}

      {/* Disponible en (módulos) */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Disponible en
        </label>
        <div className="flex flex-wrap gap-1.5">
          {OPCIONES_DISPONIBLE.filter(o => o.valor !== 'todos').map(o => {
            const activo = modulos.includes(o.valor)
            return (
              <button
                type="button"
                key={o.valor}
                className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-all select-none border ${
                  activo
                    ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                    : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
                }`}
                onClick={() => setModulos(prev => activo ? prev.filter(m => m !== o.valor) : [...prev, o.valor])}
              >
                {o.etiqueta}
              </button>
            )
          })}
        </div>
        {modulos.length === 0 && (
          <p className="text-[11px] text-texto-terciario">Sin selección = disponible en todos los módulos</p>
        )}
      </div>
    </div>
  )

  const iconoCanal = canal === 'whatsapp'
    ? <MessageSquare size={14} className="text-[var(--canal-whatsapp)]" />
    : <Mail size={14} className="text-[var(--canal-correo)]" />

  return (
    <PlantillaEditor
      titulo={esEdicion ? (nombre || plantilla?.nombre || 'Editar respuesta') : 'Nueva respuesta rápida'}
      subtitulo="Respuesta rápida — se inserta escribiendo / en el compositor"
      insignias={
        <span className="inline-flex items-center gap-1 text-xxs px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-texto-terciario">
          {iconoCanal}
          {canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}
        </span>
      }
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ IDENTIDAD ═══ */}
      <div className="space-y-3 pb-4 border-b border-borde-sutil">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (para buscar con /) — ej: Saludo inicial, Horarios..."
          className="!text-base !font-semibold"
        />
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="pt-4">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
          Mensaje
        </label>

        {canal === 'whatsapp' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <TextArea
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder={'Pegá o escribí tu mensaje...\n\nFormato WhatsApp:\n*negrita*  _cursiva_  ~tachado~'}
                  style={{ minHeight: 320 }}
                  spellCheck={false}
                />
                <p className="text-xxs mt-1.5 text-texto-terciario">
                  Emojis, saltos de línea y formato WhatsApp se conservan al enviar.
                </p>
              </div>

              <div className="flex flex-col">
                <div
                  className="rounded-card p-3 text-sm overflow-y-auto bg-superficie-hover border border-borde-sutil"
                  style={{ minHeight: 320, maxHeight: 500 }}
                >
                  {contenido ? (
                    <HtmlSeguro
                      html={formatoWhatsAppAHtml(contenido)}
                      className="text-sm leading-relaxed"
                    />
                  ) : (
                    <p className="text-xs text-texto-terciario">Vista previa del mensaje...</p>
                  )}
                </div>
                <p className="text-xxs mt-1.5 text-texto-terciario flex items-center gap-1">
                  <Send size={10} /> Así se verá en WhatsApp
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 px-3 py-2 rounded-lg text-xxs bg-superficie-hover text-texto-terciario">
              <span><strong>*negrita*</strong></span>
              <span><em>_cursiva_</em></span>
              <span><del>~tachado~</del></span>
              <span><code>{'```código```'}</code></span>
            </div>
          </>
        ) : (
          <>
            <EditorTexto
              contenido={contenidoHtml}
              onChange={(html) => setContenidoHtml(html)}
              placeholder="Escribí el contenido de la respuesta rápida..."
              alturaMinima={400}
            />
            <p className="text-xxs mt-1.5 text-texto-terciario">
              Seleccioná texto para cambiar formato. Se inserta al escribir / en el compositor.
            </p>
          </>
        )}
      </div>
    </PlantillaEditor>
  )
}

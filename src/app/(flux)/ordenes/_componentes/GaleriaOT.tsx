'use client'

/**
 * GaleriaOT — Galería de fotos + notas para una sección de OT.
 *
 * Se usa tanto en Relevamiento (subtipo='relevamiento') como en Bitácora
 * (subtipo='bitacora'). El backend (`/api/ordenes/[id]/galeria`) maneja
 * los permisos según el subtipo:
 *   - Relevamiento: solo gestores escriben (admin/creador/cabecilla).
 *   - Bitácora: asignados de la OT escriben; cada autor edita lo suyo,
 *     los gestores editan todo.
 *
 * Layout: grid 1/2/3 columnas según viewport. Cada tarjeta muestra el
 * autor, fecha relativa, contenido y miniaturas de los adjuntos (click
 * abre en otra pestaña).
 *
 * Orden:
 *   - relevamiento → ASC (cronológico, refleja la visita).
 *   - bitacora     → DESC (más nuevo primero, feed de avances).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { useReportarCarga } from '@/hooks/useCargaGlobal'
import type { AdjuntoChatter, EntradaChatter, SubtipoChatter } from '@/tipos/chatter'

type EntradaGaleria = EntradaChatter

interface Props {
  ordenId: string
  /** Subtipo que define qué muestra y qué permisos aplica. */
  tipo: SubtipoChatter
  /** El usuario puede gestionar la OT (admin/creador/cabecilla). */
  puedeGestionar: boolean
  /** El usuario está asignado a la OT (cabecilla o común). Solo aplica
   *  a bitácora — habilita cargar entradas y editar las propias. */
  esAsignado?: boolean
  /** Id del usuario en sesión, usado para chequear ownership de bitácora. */
  usuarioActualId: string | null
  /** Texto del placeholder del editor de texto. */
  placeholder?: string
  /** Texto del estado vacío. */
  tituloVacio: string
  descripcionVacio: string
}

interface RespuestaListado {
  entradas: EntradaGaleria[]
  puedeGestionar: boolean
  esAsignado: boolean
}

export default function GaleriaOT({
  ordenId,
  tipo,
  puedeGestionar,
  esAsignado = false,
  usuarioActualId,
  placeholder = 'Describí lo que querés registrar…',
  tituloVacio,
  descripcionVacio,
}: Props) {
  const { mostrar: mostrarToast } = useToast()
  const { fechaRelativa } = useFormato()

  const [entradas, setEntradas] = useState<EntradaGaleria[]>([])
  const [cargando, setCargando] = useState(true)
  const [permisosServer, setPermisosServer] = useState({
    puedeGestionar,
    esAsignado,
  })

  // Editor: cuando es null, no se muestra. Cuando es 'nueva', es para crear.
  // Cuando es un id, es para editar esa entrada.
  const [editorAbierto, setEditorAbierto] = useState<'nueva' | string | null>(null)
  const [editorTexto, setEditorTexto] = useState('')
  const [editorAdjuntos, setEditorAdjuntos] = useState<AdjuntoChatter[]>([])
  const [editorGuardando, setEditorGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  // Subir adjuntos a la galería (fotos/documentos) puede tardar varios
  // segundos según tamaño y red — marca la BarraProgresoGlobal del header.
  useReportarCarga(subiendo, `galeria-ot-${ordenId}-${tipo}`)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/galeria?tipo=${tipo}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Error al cargar')
      }
      const data = (await res.json()) as RespuestaListado
      setEntradas(data.entradas ?? [])
      setPermisosServer({
        puedeGestionar: Boolean(data.puedeGestionar),
        esAsignado: Boolean(data.esAsignado),
      })
    } catch (e) {
      mostrarToast('error', e instanceof Error ? e.message : 'No se pudo cargar la galería')
    } finally {
      setCargando(false)
    }
  }, [ordenId, tipo, mostrarToast])

  useEffect(() => {
    cargar()
  }, [cargar])

  // ── Permisos derivados ──────────────────────────────────────────
  const puedeCrear = tipo === 'relevamiento'
    ? permisosServer.puedeGestionar
    : permisosServer.puedeGestionar || permisosServer.esAsignado

  function puedeEditar(entrada: EntradaGaleria) {
    if (permisosServer.puedeGestionar) return true
    if (tipo === 'relevamiento') return false
    return entrada.autor_id === usuarioActualId
  }

  // ── Editor ──────────────────────────────────────────────────────
  function abrirEditorNuevo() {
    setEditorAbierto('nueva')
    setEditorTexto('')
    setEditorAdjuntos([])
  }

  function abrirEditorEntrada(entrada: EntradaGaleria) {
    setEditorAbierto(entrada.id)
    setEditorTexto(entrada.contenido)
    setEditorAdjuntos(entrada.adjuntos ?? [])
  }

  function cerrarEditor() {
    setEditorAbierto(null)
    setEditorTexto('')
    setEditorAdjuntos([])
  }

  async function adjuntarArchivos(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return
    setSubiendo(true)
    try {
      const subidas: AdjuntoChatter[] = []
      for (const archivo of Array.from(archivos)) {
        const fd = new FormData()
        fd.append('archivo', archivo)
        fd.append('tipo', tipo)
        const res = await fetch(`/api/ordenes/${ordenId}/galeria/adjuntar`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'No se pudo subir')
        }
        const data = await res.json()
        subidas.push({
          url: data.url,
          nombre: data.nombre,
          tipo: data.tipo,
          tamano: data.tamano,
        })
      }
      setEditorAdjuntos(prev => [...prev, ...subidas])
    } catch (e) {
      mostrarToast('error', e instanceof Error ? e.message : 'No se pudo subir el archivo')
    } finally {
      setSubiendo(false)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    }
  }

  function quitarAdjunto(index: number) {
    setEditorAdjuntos(prev => prev.filter((_, i) => i !== index))
  }

  async function guardar() {
    const contenido = editorTexto.trim()
    if (contenido.length === 0 && editorAdjuntos.length === 0) {
      mostrarToast('error', 'Agregá una nota o una foto antes de guardar')
      return
    }
    setEditorGuardando(true)
    try {
      if (editorAbierto === 'nueva') {
        const res = await fetch(`/api/ordenes/${ordenId}/galeria`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tipo, contenido, adjuntos: editorAdjuntos }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'No se pudo guardar')
        }
      } else if (editorAbierto) {
        const res = await fetch(`/api/ordenes/${ordenId}/galeria/${editorAbierto}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contenido, adjuntos: editorAdjuntos }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'No se pudo editar')
        }
      }
      cerrarEditor()
      await cargar()
    } catch (e) {
      mostrarToast('error', e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setEditorGuardando(false)
    }
  }

  async function eliminar(entrada: EntradaGaleria) {
    if (!confirm('¿Eliminar esta entrada? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/galeria/${entrada.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'No se pudo eliminar')
      }
      await cargar()
    } catch (e) {
      mostrarToast('error', e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-texto-terciario">
        <Loader2 className="animate-spin" size={20} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra superior: contador + botón agregar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-texto-terciario">
          {entradas.length} {entradas.length === 1 ? 'entrada' : 'entradas'}
        </span>
        {puedeCrear && editorAbierto === null && (
          <Boton variante="secundario" tamano="sm" onClick={abrirEditorNuevo}>
            <Plus size={14} />
            Agregar
          </Boton>
        )}
      </div>

      {/* Editor inline (crear o editar). Aparece arriba de la lista. */}
      <AnimatePresence>
        {editorAbierto !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-card border border-borde-sutil bg-superficie-app p-3 space-y-3 overflow-hidden"
          >
            <textarea
              value={editorTexto}
              onChange={e => setEditorTexto(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full rounded-md border border-borde-sutil bg-superficie-tarjeta px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca/40"
            />

            {editorAdjuntos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editorAdjuntos.map((adj, i) => (
                  <div
                    key={`${adj.url}-${i}`}
                    className="relative w-20 h-20 rounded-md overflow-hidden border border-borde-sutil bg-superficie-tarjeta"
                  >
                    {adj.tipo.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={adj.url} alt={adj.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-texto-terciario">
                        <Paperclip size={20} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarAdjunto(i)}
                      className="absolute top-1 right-1 rounded-full bg-superficie-app/80 p-0.5 text-texto-primario hover:bg-superficie-app"
                      aria-label="Quitar adjunto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputArchivoRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={e => adjuntarArchivos(e.target.files)}
                />
                <Boton
                  variante="secundario"
                  tamano="sm"
                  onClick={() => inputArchivoRef.current?.click()}
                  disabled={subiendo}
                >
                  {subiendo ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  Adjuntar fotos
                </Boton>
              </div>
              <div className="flex items-center gap-2">
                <Boton variante="secundario" tamano="sm" onClick={cerrarEditor} disabled={editorGuardando}>
                  Cancelar
                </Boton>
                <Boton variante="primario" tamano="sm" onClick={guardar} disabled={editorGuardando || subiendo}>
                  {editorGuardando ? <Loader2 size={14} className="animate-spin" /> : null}
                  Guardar
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de entradas */}
      {entradas.length === 0 ? (
        <EstadoVacio
          icono={tipo === 'relevamiento' ? <Camera /> : <ClipboardList />}
          titulo={tituloVacio}
          descripcion={descripcionVacio}
        />
      ) : (
        <ul className="space-y-3">
          {entradas.map(entrada => (
            <li
              key={entrada.id}
              className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-texto-primario">
                    {entrada.autor_nombre || 'Usuario'}
                  </p>
                  <p className="text-xs text-texto-terciario">
                    {fechaRelativa(entrada.creado_en)}
                    {entrada.editado_en ? ' · editado' : ''}
                  </p>
                </div>
                {puedeEditar(entrada) && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEditorEntrada(entrada)}
                      className="p-1.5 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada"
                      aria-label="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(entrada)}
                      className="p-1.5 rounded-md text-texto-terciario hover:text-insignia-peligro hover:bg-superficie-elevada"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {entrada.contenido && (
                <p className="text-sm text-texto-primario whitespace-pre-wrap">
                  {entrada.contenido}
                </p>
              )}

              {entrada.adjuntos && entrada.adjuntos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {entrada.adjuntos.map((adj, i) => (
                    <a
                      key={`${entrada.id}-${i}`}
                      href={adj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-md overflow-hidden border border-borde-sutil bg-superficie-app hover:opacity-90 transition-opacity"
                    >
                      {adj.tipo.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={adj.url}
                          alt={adj.nombre}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-texto-terciario p-2">
                          <Paperclip size={20} />
                          <span className="text-[10px] text-center truncate w-full">{adj.nombre}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

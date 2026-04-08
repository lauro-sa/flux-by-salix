'use client'

/**
 * EditorNota — Editor rico inline para registrar notas internas en el chatter.
 * Usa TipTap (EditorTexto) para formato rico, permite adjuntar archivos.
 * Se usa en: PanelChatter cuando el usuario hace clic en "Registrar nota".
 */

import { useState, useRef } from 'react'
import { Send, Paperclip, X, FileText, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { Boton } from '@/componentes/ui/Boton'
import type { AdjuntoChatter } from '@/tipos/chatter'
import type { PropsEditorNota } from './tipos'

export function EditorNota({ entidadTipo, entidadId, notaEditando, onEnviado, onCancelar }: PropsEditorNota) {
  const esEdicion = !!notaEditando
  const [html, setHtml] = useState(notaEditando?.metadata?.contenido_html || '')
  const [textoPlano, setTextoPlano] = useState(notaEditando?.contenido || '')
  const [adjuntos, setAdjuntos] = useState<AdjuntoChatter[]>([])
  const [enviando, setEnviando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const tieneContenido = textoPlano.trim().length > 0

  // Extraer texto plano del HTML para validación
  const handleCambioHtml = (nuevoHtml: string) => {
    setHtml(nuevoHtml)
    const div = document.createElement('div')
    div.innerHTML = nuevoHtml
    setTextoPlano(div.textContent || '')
  }

  // Adjuntar archivo
  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files
    if (!archivos?.length) return

    setSubiendoArchivo(true)
    try {
      for (const archivo of Array.from(archivos)) {
        const formData = new FormData()
        formData.append('archivo', archivo)
        formData.append('carpeta', `chatter/${entidadTipo}/${entidadId}`)

        const res = await fetch('/api/storage/subir', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          setAdjuntos(prev => [...prev, {
            url: data.url,
            nombre: archivo.name,
            tipo: archivo.type,
            tamano: archivo.size,
          }])
        }
      }
    } catch {
      // Silencioso — el archivo no se adjunta
    }
    setSubiendoArchivo(false)
    // Limpiar input para permitir re-seleccionar el mismo archivo
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
  }

  // Quitar adjunto
  const quitarAdjunto = (indice: number) => {
    setAdjuntos(prev => prev.filter((_, i) => i !== indice))
  }

  // Enviar o actualizar nota
  const enviar = async () => {
    if (!tieneContenido || enviando) return

    setEnviando(true)
    try {
      const res = esEdicion
        ? await fetch('/api/chatter', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: notaEditando!.id,
              contenido: textoPlano.trim(),
              metadata: { ...notaEditando!.metadata, contenido_html: html },
            }),
          })
        : await fetch('/api/chatter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entidad_tipo: entidadTipo,
              entidad_id: entidadId,
              tipo: 'nota_interna',
              contenido: textoPlano.trim(),
              adjuntos,
              metadata: { contenido_html: html },
            }),
          })

      if (res.ok) {
        setHtml('')
        setTextoPlano('')
        setAdjuntos([])
        onEnviado()
      }
    } catch {
      // Silencioso
    }
    setEnviando(false)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="border border-insignia-advertencia/30 rounded-lg bg-insignia-advertencia/5 overflow-hidden">
        {/* Etiqueta */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-insignia-advertencia/20">
          <span className="text-xs font-medium text-insignia-advertencia">
            {esEdicion ? 'Editando nota' : 'Nota interna (solo visible para el equipo)'}
          </span>
          <button
            onClick={onCancelar}
            className="text-texto-terciario hover:text-texto-secundario transition-colors p-0.5 rounded"
          >
            <X size={14} />
          </button>
        </div>

        {/* Editor TipTap */}
        <div className="[&_.tiptap]:min-h-[80px] [&_.tiptap]:max-h-[200px] [&_.tiptap]:overflow-y-auto [&>div]:border-0 [&>div]:rounded-none [&>div]:shadow-none [&>div]:ring-0 [&>div:focus-within]:ring-0">
          <EditorTexto
            contenido={html}
            onChange={handleCambioHtml}
            placeholder="Escribí una nota interna..."
            alturaMinima={80}
            autoEnfocar
          />
        </div>

        {/* Adjuntos */}
        {adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-insignia-advertencia/20">
            {adjuntos.map((adj, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-superficie-tarjeta px-2 py-1 rounded border border-borde-sutil">
                <FileText size={11} className="text-texto-terciario" />
                <span className="truncate max-w-[120px]">{adj.nombre}</span>
                <button onClick={() => quitarAdjunto(i)} className="text-texto-terciario hover:text-insignia-peligro ml-0.5">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Barra inferior: adjuntar + enviar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-insignia-advertencia/20 bg-insignia-advertencia/3">
          <div className="flex items-center gap-1">
            <input
              ref={inputArchivoRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleArchivo}
            />
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              titulo="Adjuntar archivo"
              icono={subiendoArchivo ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              onClick={() => inputArchivoRef.current?.click()}
              disabled={subiendoArchivo}
            />
          </div>

          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tamano="xs" onClick={onCancelar}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              tamano="xs"
              icono={<Send size={13} />}
              onClick={enviar}
              disabled={!tieneContenido || enviando}
              cargando={enviando}
            >
              {esEdicion ? 'Guardar' : 'Registrar'}
            </Boton>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

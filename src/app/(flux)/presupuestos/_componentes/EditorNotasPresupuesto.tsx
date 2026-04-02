'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Reorder, useDragControls, AnimatePresence } from 'framer-motion'
import { GripVertical, Plus, X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import dynamic from 'next/dynamic'
const EditorTexto = dynamic(() => import('@/componentes/ui/EditorTexto').then(m => m.EditorTexto), { ssr: false })

/**
 * EditorNotasPresupuesto — Lista de notas/condiciones reordenables con formato rico.
 *
 * Cada item usa el EditorTexto existente (TipTap con toolbar flotante completo).
 * Enter crea nuevo item, Shift+Enter salto de línea, Backspace en vacío borra.
 * Drag para reordenar. Seleccionar texto muestra el toolbar de formato completo.
 *
 * Almacena como JSON array de HTML strings en la BD (campo text).
 * Compatible con datos legacy (texto plano o HTML suelto).
 *
 * Se usa en: nuevo presupuesto, edición presupuesto, configuración presupuestos.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropiedadesEditorNotas {
  valor: string
  onChange: (valor: string) => void
  onBlur?: () => void
  placeholder?: string
  soloLectura?: boolean
  etiqueta?: string
}

interface ItemNota {
  id: string
  html: string
}

// ── Serialización ────────────────────────────────────────────────────────────

function parsearValor(valor: string): ItemNota[] {
  if (!valor || !valor.trim()) return []
  try {
    const parsed = JSON.parse(valor)
    if (Array.isArray(parsed)) {
      return parsed.map((html: string, i: number) => ({
        id: `n-${Date.now()}-${i}`,
        html: html || '',
      }))
    }
  } catch { /* no es JSON, tratar como legacy */ }
  if (!valor.includes('<')) {
    return valor.split('\n').filter(l => l.trim()).map((l, i) => ({
      id: `n-${Date.now()}-${i}`,
      html: `<p>${l}</p>`,
    }))
  }
  return [{ id: `n-${Date.now()}-0`, html: valor }]
}

function serializarItems(items: ItemNota[]): string {
  const htmls = items.map(i => i.html).filter(h => {
    const limpio = h.replace(/<[^>]*>/g, '').trim()
    return limpio.length > 0
  })
  if (htmls.length === 0) return ''
  return JSON.stringify(htmls)
}

function nuevoId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Item reordenable ─────────────────────────────────────────────────────────

function ItemReordenable({
  item,
  indice,
  soloLectura,
  enfocado,
  placeholder,
  onCambiar,
  onBorrar,
  onEnter,
  onBackspaceVacio,
  onFoco,
}: {
  item: ItemNota
  indice: number
  soloLectura: boolean
  enfocado: boolean
  placeholder: string
  onCambiar: (id: string, html: string) => void
  onBorrar: (id: string) => void
  onEnter: (indice: number) => void
  onBackspaceVacio: (indice: number) => void
  onFoco: (indice: number) => void
}) {
  const controles = useDragControls()

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={controles}
      className={[
        'flex items-center gap-2 group rounded-lg px-3 py-1 transition-colors duration-150',
        enfocado
          ? 'bg-superficie-app'
          : 'hover:bg-superficie-app/60',
      ].join(' ')}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.12 }}
    >
      {/* Drag handle — usa button nativo porque necesita onPointerDown para el drag */}
      {!soloLectura && (
        <button
          type="button"
          onPointerDown={(e) => controles.start(e)}
          className="cursor-grab active:cursor-grabbing text-texto-terciario/0 group-hover:text-texto-terciario transition-colors touch-none shrink-0"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* Editor rico — usa el EditorTexto completo con toolbar flotante */}
      <div className="flex-1 min-w-0">
        <EditorTexto
          contenido={item.html}
          onChange={(html) => onCambiar(item.id, html)}
          placeholder={indice === 0 ? placeholder : 'Otra nota...'}
          soloLectura={soloLectura}
          alturaMinima={0}
          className="border-0 bg-transparent shadow-none !ring-0 focus-within:!ring-0 [&_.tiptap]:!min-h-0"
          onEnter={() => onEnter(indice)}
          onBackspaceVacio={() => onBackspaceVacio(indice)}
          onFoco={() => onFoco(indice)}
          autoEnfocar={enfocado}
        />
      </div>

      {/* Botón borrar */}
      {!soloLectura && (
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<X size={13} />}
          titulo="Eliminar nota"
          onClick={() => onBorrar(item.id)}
          className="text-texto-terciario/0 group-hover:text-texto-terciario shrink-0"
        />
      )}
    </Reorder.Item>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EditorNotasPresupuesto({
  valor,
  onChange,
  onBlur,
  placeholder = 'Escribe una nota...',
  soloLectura = false,
  etiqueta,
}: PropiedadesEditorNotas) {
  const [items, setItems] = useState<ItemNota[]>(() => parsearValor(valor))
  const [indiceFoco, setIndiceFoco] = useState<number | null>(null)
  const valorExternoRef = useRef(valor)

  // Sincronizar cuando el valor externo cambia (carga, plantilla, etc.)
  useEffect(() => {
    if (valor !== valorExternoRef.current) {
      valorExternoRef.current = valor
      setItems(parsearValor(valor))
    }
  }, [valor])

  // Emitir cambios al padre fuera del ciclo de render (evita setState durante render)
  const emitirPendienteRef = useRef<ItemNota[] | null>(null)
  useEffect(() => {
    if (emitirPendienteRef.current !== null) {
      const serializado = serializarItems(emitirPendienteRef.current)
      emitirPendienteRef.current = null
      valorExternoRef.current = serializado
      onChange(serializado)
    }
  })

  const emitir = useCallback((nuevos: ItemNota[]) => {
    emitirPendienteRef.current = nuevos
  }, [])

  const cambiarHtml = useCallback((id: string, html: string) => {
    setItems(prev => {
      const nuevos = prev.map(i => i.id === id ? { ...i, html } : i)
      emitir(nuevos)
      return nuevos
    })
  }, [emitir])

  const borrarItem = useCallback((id: string) => {
    setItems(prev => {
      if (prev.length <= 1) {
        const nuevos = [{ ...prev[0], html: '<p></p>' }]
        emitir(nuevos)
        return nuevos
      }
      const nuevos = prev.filter(i => i.id !== id)
      emitir(nuevos)
      return nuevos
    })
  }, [emitir])

  const insertarDespues = useCallback((indice: number) => {
    const nuevo: ItemNota = { id: nuevoId(), html: '<p></p>' }
    setItems(prev => {
      const nuevos = [...prev]
      nuevos.splice(indice + 1, 0, nuevo)
      return nuevos
    })
    setIndiceFoco(indice + 1)
  }, [])

  const backspaceVacio = useCallback((indice: number) => {
    setItems(prev => {
      if (prev.length <= 1) return prev
      const nuevos = prev.filter((_, i) => i !== indice)
      emitir(nuevos)
      return nuevos
    })
    setIndiceFoco(Math.max(0, indice - 1))
  }, [emitir])

  const reordenar = useCallback((nuevos: ItemNota[]) => {
    setItems(nuevos)
    emitir(nuevos)
  }, [emitir])

  const agregarNuevo = useCallback(() => {
    const nuevo: ItemNota = { id: nuevoId(), html: '<p></p>' }
    setItems(prev => [...prev, nuevo])
    setIndiceFoco(items.length)
  }, [items.length])

  // Sin items: botón para crear
  if (items.length === 0 && !soloLectura) {
    return (
      <div>
        {etiqueta && (
          <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider block mb-2">
            {etiqueta}
          </span>
        )}
        <Boton variante="fantasma" tamano="xs" icono={<Plus size={13} />} onClick={() => {
            setItems([{ id: nuevoId(), html: '<p></p>' }])
            setIndiceFoco(0)
          }}>
          Agregar {etiqueta?.toLowerCase() || 'item'}
        </Boton>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div onBlur={(e) => {
      // Solo disparar si el foco sale completamente del editor (no entre items internos)
      if (onBlur && !e.currentTarget.contains(e.relatedTarget as Node)) {
        onBlur()
      }
    }}>
      {etiqueta && (
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider block mb-2">
          {etiqueta}
        </span>
      )}

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={reordenar}
        className="space-y-px"
      >
        <AnimatePresence initial={false}>
          {items.map((item, indice) => (
            <ItemReordenable
              key={item.id}
              item={item}
              indice={indice}
              soloLectura={soloLectura}
              enfocado={indiceFoco === indice}
              placeholder={placeholder}
              onCambiar={cambiarHtml}
              onBorrar={borrarItem}
              onEnter={insertarDespues}
              onBackspaceVacio={backspaceVacio}
              onFoco={setIndiceFoco}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Botón agregar */}
      {!soloLectura && (
        <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarNuevo} className="mt-1.5">
          Agregar
        </Boton>
      )}
    </div>
  )
}

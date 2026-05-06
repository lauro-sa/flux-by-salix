'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { leerCampoDot } from '@/lib/workflows/resolver-variables'
import type {
  FuenteVariables,
  VariableDisponible,
} from '@/lib/workflows/variables-disponibles'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { ExpresionVariable } from './parsear-expresion'

/**
 * Popover de selección de variables del editor de flujos
 * (sub-PR 19.3b).
 *
 * Estructura:
 *   ┌─ Buscador (foco automático) ──── X ──┐
 *   │ Tabs: Entidad · Contacto · Empresa · │
 *   │       Sistema · Cambio · Actor       │
 *   ├──────────────────────────────────────┤
 *   │ Variable                              │
 *   │   ruta → preview                      │
 *   │   [helpers compatibles en hover →]    │
 *   ├──────────────────────────────────────┤
 *   │ kbd ↑↓ navegar · ↵ insertar · esc     │
 *   └──────────────────────────────────────┘
 *
 * Dos formas de invocar (D6b):
 *   • Tipear `{{` → el InputConVariables abre el picker en modo
 *     "insertar" en la posición del caret.
 *   • Click en ícono `{}` del input → modo "descubrir" (lista jerárquica).
 *
 * Helpers en hover (caveat: solo PC; en mobile se difiere a 19.3c con
 * bottom-sheet propio): cuando el usuario hover sobre una variable,
 * aparece una sub-fila con los helpers compatibles según `tipoValor`.
 *
 * Búsqueda global (caveat): match en etiqueta + ruta + descripcion.
 * Tabs son filtros opcionales — la búsqueda matchea en todas las
 * fuentes por defecto.
 */

// =============================================================
// Helpers compatibles por tipo de valor
// =============================================================

const HELPERS_POR_TIPO: Record<VariableDisponible['tipoValor'], string[]> = {
  string: ['mayusculas', 'minusculas', 'capitalizar', 'nombre_corto', 'truncar'],
  number: ['moneda', 'numero', 'porcentaje'],
  fecha: ['fecha', 'fecha_corta', 'fecha_hora', 'hora', 'dia_semana', 'fecha_relativa'],
  boolean: [],
}

// =============================================================
// Tipos
// =============================================================

interface PropsPickerVariables {
  abierto: boolean
  /** Posición ancla en pantalla (la del input). */
  ancla: { top: number; left: number; width: number } | null
  /** Fuentes que mostramos en los tabs. Filtradas por el disparador. */
  fuentes: FuenteVariables[]
  /** Contexto enriquecido del preview (para mostrar valores resueltos). */
  contexto: ContextoVariables
  /** Texto inicial del buscador (ej. cuando se abre desde `{{x`). */
  textoInicial?: string
  /** Llamado al elegir una variable (con o sin helper). */
  onSeleccionar: (expresion: ExpresionVariable) => void
  onCerrar: () => void
}

// =============================================================
// Componente
// =============================================================

export default function PickerVariables({
  abierto,
  ancla,
  fuentes,
  contexto,
  textoInicial = '',
  onSeleccionar,
  onCerrar,
}: PropsPickerVariables) {
  const { t } = useTraduccion()
  const [busqueda, setBusqueda] = useState(textoInicial)
  const [fuenteActiva, setFuenteActiva] = useState<string | null>(null)
  const refBuscador = useRef<HTMLInputElement>(null)
  const refPopover = useRef<HTMLDivElement>(null)
  const [hoverItem, setHoverItem] = useState<VariableDisponible | null>(null)

  // Reset al abrir.
  useEffect(() => {
    if (abierto) {
      setBusqueda(textoInicial)
      setFuenteActiva(null)
      setTimeout(() => refBuscador.current?.focus(), 30)
    }
  }, [abierto, textoInicial])

  // Cerrar al click fuera.
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (refPopover.current?.contains(e.target as Node)) return
      onCerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, onCerrar])

  // Esc cierra.
  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCerrar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [abierto, onCerrar])

  // Items visibles según búsqueda + tab activo.
  const items = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const todasVariables: Array<{ fuente: FuenteVariables; variable: VariableDisponible }> = []
    for (const fuente of fuentes) {
      if (fuenteActiva && fuente.clave !== fuenteActiva) continue
      for (const variable of fuente.variables) {
        todasVariables.push({ fuente, variable })
      }
    }
    if (!q) return todasVariables
    return todasVariables.filter(({ variable }) => {
      const etiqueta = t(variable.claveI18nEtiqueta).toLowerCase()
      const desc = variable.claveI18nDescripcion ? t(variable.claveI18nDescripcion).toLowerCase() : ''
      return (
        etiqueta.includes(q) ||
        variable.ruta.toLowerCase().includes(q) ||
        desc.includes(q)
      )
    })
  }, [fuentes, fuenteActiva, busqueda, t])

  if (!abierto || !ancla) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={refPopover}
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.12 }}
        className="fixed rounded-popover border border-borde-sutil bg-superficie-elevada shadow-elevada overflow-hidden z-50"
        style={{
          top: ancla.top + 4,
          left: ancla.left,
          width: 360,
        }}
        role="dialog"
        aria-label={t('flujos.picker.titulo')}
      >
        {/* Buscador */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
          <Search size={14} className="shrink-0 text-texto-terciario" />
          <input
            ref={refBuscador}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t('flujos.picker.buscador_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
          />
          {busqueda.length > 0 && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="shrink-0 p-0.5 rounded hover:bg-superficie-hover text-texto-terciario"
              aria-label={t('flujos.picker.limpiar_busqueda')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Tabs por fuente */}
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-borde-sutil">
          <button
            type="button"
            onClick={() => setFuenteActiva(null)}
            className={[
              'shrink-0 text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer',
              fuenteActiva === null
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-terciario hover:bg-superficie-hover',
            ].join(' ')}
          >
            {t('flujos.picker.tab_todas')}
          </button>
          {fuentes.map((f) => (
            <button
              key={f.clave}
              type="button"
              onClick={() => setFuenteActiva(f.clave)}
              className={[
                'shrink-0 text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer',
                fuenteActiva === f.clave
                  ? 'bg-texto-marca/15 text-texto-marca'
                  : 'text-texto-terciario hover:bg-superficie-hover',
              ].join(' ')}
            >
              {t(f.claveI18nEtiqueta)}
            </button>
          ))}
        </div>

        {/* Lista de variables */}
        <div className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-texto-terciario">
              {t('flujos.picker.sin_resultados')}
            </p>
          ) : (
            items.map(({ variable }) => {
              const etiqueta = t(variable.claveI18nEtiqueta)
              const preview = obtenerPreview(variable.ruta, contexto)
              const helpers = HELPERS_POR_TIPO[variable.tipoValor]
              const enHover = hoverItem === variable
              return (
                <div
                  key={variable.ruta}
                  onMouseEnter={() => setHoverItem(variable)}
                  onMouseLeave={() => setHoverItem(null)}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSeleccionar({ ruta: variable.ruta, helpers: [] })
                      onCerrar()
                    }}
                    className="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-superficie-hover transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium text-texto-primario truncate">
                      {etiqueta}
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-texto-terciario truncate">{`{{${variable.ruta}}}`}</code>
                      {preview && (
                        <span className="text-texto-marca truncate">→ {preview}</span>
                      )}
                    </span>
                  </button>

                  {/* Helpers en hover (PC) */}
                  {enHover && helpers.length > 0 && (
                    <div className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 flex-wrap gap-1 max-w-[150px] justify-end">
                      {helpers.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSeleccionar({
                              ruta: variable.ruta,
                              helpers: [{ nombre: h, args: argsDefaultDelHelper(h) }],
                            })
                            onCerrar()
                          }}
                          className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-secundario hover:border-texto-marca hover:text-texto-marca transition-colors cursor-pointer"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-borde-sutil text-xxs text-texto-terciario">
          <span>{t('flujos.picker.hint_navegacion')}</span>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// =============================================================
// Helpers internos
// =============================================================

function obtenerPreview(ruta: string, contexto: ContextoVariables): string | null {
  const valor = leerCampoDot(ruta, contexto)
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor).slice(0, 40)
  }
  return null
}

function argsDefaultDelHelper(nombre: string): Array<string | number | boolean | null> {
  // truncar(N) usa default 50 — los demás no tienen args.
  if (nombre === 'truncar') return [50]
  return []
}

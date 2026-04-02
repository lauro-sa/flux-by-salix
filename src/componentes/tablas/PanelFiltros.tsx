'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Check, BookmarkPlus, Bookmark, Star } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import type { FiltroTabla } from '@/componentes/tablas/tipos-tabla'
import type { VistaGuardada, EstadoDetector } from '@/hooks/useVistasGuardadas'

/* ════════════════════════════════════════════
   Sub-componente: Dropdown individual de filtro
   ════════════════════════════════════════════ */

/** Dropdown individual de un filtro — se posiciona debajo de su botón trigger */
export function DropdownFiltro({ filtro, onCerrar }: { filtro: FiltroTabla; onCerrar: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onCerrar])

  const opcionesFiltradas = filtro.opciones?.filter(op =>
    !busqueda || op.etiqueta.toLowerCase().includes(busqueda.toLowerCase())
  ) || []

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-1 w-52 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg z-50 overflow-hidden"
    >
      {/* Selección / Múltiple */}
      {(filtro.tipo === 'seleccion' || filtro.tipo === 'multiple') && filtro.opciones && (
        <div className="flex flex-col">
          {/* Buscador si >6 opciones */}
          {filtro.opciones.length > 6 && (
            <div className="p-2 pb-0">
              <input
                type="text"
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-borde-foco"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1.5 flex flex-col gap-px">
            {opcionesFiltradas.map(op => {
              const seleccionado = filtro.tipo === 'multiple'
                ? Array.isArray(filtro.valor) && filtro.valor.includes(op.valor)
                : op.valor === filtro.valor
              return (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => {
                    if (filtro.tipo === 'multiple') {
                      const actual = Array.isArray(filtro.valor) ? filtro.valor : []
                      filtro.onChange(seleccionado ? actual.filter(v => v !== op.valor) : [...actual, op.valor])
                    } else {
                      filtro.onChange(op.valor === filtro.valor ? '' : op.valor)
                      if (op.valor !== filtro.valor) onCerrar()
                    }
                  }}
                  className={[
                    'flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded-lg cursor-pointer transition-colors border-none',
                    seleccionado
                      ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                      : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                  ].join(' ')}
                >
                  {filtro.tipo === 'multiple' && (
                    <span
                      className="inline-flex items-center justify-center size-3.5 rounded border shrink-0 transition-colors"
                      style={seleccionado ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : { borderColor: 'var(--borde-fuerte)' }}
                    >
                      {seleccionado && <Check size={8} className="text-texto-inverso" />}
                    </span>
                  )}
                  <span className="flex-1 truncate">{op.etiqueta}</span>
                  {filtro.tipo === 'seleccion' && seleccionado && <Check size={13} className="shrink-0" />}
                </button>
              )
            })}
          </div>
          {/* Limpiar para múltiple */}
          {filtro.tipo === 'multiple' && Array.isArray(filtro.valor) && filtro.valor.length > 0 && (
            <div className="border-t border-borde-sutil p-1.5">
              <button
                type="button"
                onClick={() => { filtro.onChange([]); onCerrar() }}
                className="w-full text-xs text-texto-terciario hover:text-texto-primario py-1 cursor-pointer border-none bg-transparent transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fecha */}
      {filtro.tipo === 'fecha' && (
        <div className="p-2.5 flex flex-col gap-2">
          <input
            type="date"
            autoFocus
            value={typeof filtro.valor === 'string' ? filtro.valor : ''}
            onChange={(e) => { filtro.onChange(e.target.value); if (e.target.value) onCerrar() }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario outline-none focus:border-borde-foco"
          />
          {filtro.valor && (
            <button
              type="button"
              onClick={() => { filtro.onChange(''); onCerrar() }}
              className="text-xs text-texto-terciario hover:text-texto-primario cursor-pointer border-none bg-transparent transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Sección de filtro dentro del panel
   ════════════════════════════════════════════ */

/** Sección de filtro dentro del panel — adapta UI según tipo (pills, seleccion, multiple, fecha) */
export function SeccionFiltroPanel({ filtro }: { filtro: FiltroTabla }) {
  // Pills: botones horizontales con "Todos" al inicio
  if (filtro.tipo === 'pills' && filtro.opciones) {
    const valorActual = typeof filtro.valor === 'string' ? filtro.valor : ''
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => filtro.onChange('')}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors',
              !valorActual ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover',
            ].join(' ')}>
            Todos
          </button>
          {filtro.opciones.map(op => (
            <button key={op.valor} type="button"
              onClick={() => filtro.onChange(op.valor === valorActual ? '' : op.valor)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors',
                op.valor === valorActual ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover',
              ].join(' ')}>
              {op.etiqueta}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Selección / Múltiple: lista vertical con check/checkbox
  if ((filtro.tipo === 'seleccion' || filtro.tipo === 'multiple') && filtro.opciones) {
    const valorActual = typeof filtro.valor === 'string' ? filtro.valor : ''
    const valoresActuales = Array.isArray(filtro.valor) ? filtro.valor : []
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        {/* "Todos" como primera opción */}
        <button type="button"
          onClick={() => filtro.onChange(filtro.tipo === 'multiple' ? [] : '')}
          className={[
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left cursor-pointer border-none transition-colors',
            (filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual)
              ? 'bg-superficie-seleccionada text-texto-marca font-medium'
              : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
          ].join(' ')}>
          <Check size={13} className={(filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual) ? 'text-texto-marca' : 'text-transparent'} />
          <span className="flex-1">Todos</span>
          {(filtro.tipo === 'multiple' ? valoresActuales.length === 0 : !valorActual) && <Check size={13} className="text-texto-marca" />}
        </button>
        {filtro.opciones.map(op => {
          const sel = filtro.tipo === 'multiple'
            ? valoresActuales.includes(op.valor)
            : op.valor === valorActual
          return (
            <button key={op.valor} type="button"
              onClick={() => {
                if (filtro.tipo === 'multiple') {
                  filtro.onChange(sel ? valoresActuales.filter(v => v !== op.valor) : [...valoresActuales, op.valor])
                } else {
                  filtro.onChange(op.valor === valorActual ? '' : op.valor)
                }
              }}
              className={[
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left cursor-pointer border-none transition-colors',
                sel ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
              ].join(' ')}>
              {filtro.tipo === 'multiple' ? (
                <span className="inline-flex items-center justify-center size-3.5 rounded border shrink-0 transition-colors"
                  style={sel ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : { borderColor: 'var(--borde-fuerte)' }}>
                  {sel && <Check size={8} className="text-texto-inverso" />}
                </span>
              ) : (
                <span className={`size-3.5 shrink-0 ${sel ? '' : 'opacity-0'}`}>{sel && <Check size={13} className="text-texto-marca" />}</span>
              )}
              <span className="flex-1">{op.etiqueta}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Fecha
  if (filtro.tipo === 'fecha') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{filtro.etiqueta}</span>
        <div className="flex items-center gap-2">
          <input type="date" value={typeof filtro.valor === 'string' ? filtro.valor : ''}
            onChange={(e) => filtro.onChange(e.target.value)}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario outline-none focus:border-borde-foco" />
          {filtro.valor && (
            <button type="button" onClick={() => filtro.onChange('')}
              className="size-6 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

/* ════════════════════════════════════════════
   Sub-componente: Guardar vista inline
   ════════════════════════════════════════════ */

/** Botón inline para guardar la vista actual */
export function GuardarVistaInline({ onGuardar }: { onGuardar: (nombre: string) => void }) {
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const { t } = useTraduccion()

  if (!creando) {
    return (
      <button type="button" onClick={() => setCreando(true)}
        className="flex items-center gap-1.5 text-sm text-texto-marca font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:underline mt-1">
        <BookmarkPlus size={13} />
        Guardar actual
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input type="text" autoFocus value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && nombre.trim()) { onGuardar(nombre.trim()); setNombre(''); setCreando(false) }
          if (e.key === 'Escape') { setNombre(''); setCreando(false) }
        }}
        placeholder="Nombre..."
        className="flex-1 px-2 py-1 rounded-lg border border-borde-foco bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none" />
      <button type="button" disabled={!nombre.trim()}
        onClick={() => { if (nombre.trim()) { onGuardar(nombre.trim()); setNombre(''); setCreando(false) } }}
        className="text-xs font-medium text-texto-marca cursor-pointer border-none bg-transparent disabled:opacity-40">
        {t('comun.guardar')}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Panel de vistas guardadas
   ════════════════════════════════════════════ */

/** Sección de vistas guardadas — se renderiza inline dentro del panel de filtros */
export function PanelVistasGuardadas({
  vistasGuardadas,
  detector,
  onAplicarVista,
  onGuardarVista,
  onEliminarVista,
  onSobrescribirVista,
  onMarcarPredefinida,
}: {
  vistasGuardadas?: VistaGuardada[]
  detector?: { tipo: EstadoDetector; vistaActiva: VistaGuardada | null }
  onAplicarVista?: (id: string) => void
  onGuardarVista?: (nombre: string) => void
  onEliminarVista?: (id: string) => void
  onSobrescribirVista?: (id: string) => void
  onMarcarPredefinida?: (id: string) => void
}) {
  const { t } = useTraduccion()
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoVista, setCreandoVista] = useState(false)

  const tieneContenido = (vistasGuardadas && vistasGuardadas.length > 0) || (onGuardarVista && detector?.tipo !== 'default')
  if (!tieneContenido) return null

  return (
    <div className="border-t border-borde-sutil p-3 flex flex-col gap-2">
      {/* Vistas guardadas */}
      {vistasGuardadas && vistasGuardadas.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Vistas guardadas</span>
          {vistasGuardadas.map((v) => {
            const esActiva = detector?.vistaActiva?.id === v.id
            return (
              <div key={v.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-superficie-hover transition-colors"
                onClick={() => onAplicarVista?.(v.id)}>
                <Bookmark size={13} className={esActiva ? 'text-texto-marca fill-current' : 'text-texto-terciario'} />
                <span className={`flex-1 text-sm ${esActiva ? 'font-semibold text-texto-marca' : 'text-texto-primario'}`}>{v.nombre}</span>
                {v.predefinida && <Star size={11} className="text-texto-marca fill-current shrink-0" />}
                {esActiva && <Check size={13} className="text-texto-marca" />}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  {onMarcarPredefinida && !v.predefinida && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onMarcarPredefinida(v.id) }}
                      className="size-5 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-marca transition-colors"
                      title="Marcar como predefinida"><Star size={11} /></button>
                  )}
                  {onEliminarVista && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onEliminarVista(v.id) }}
                      className="size-5 inline-flex items-center justify-center rounded-md hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-colors"
                      title="Eliminar vista"><X size={11} /></button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sobrescribir */}
      {detector?.tipo === 'sin_guardar' && vistasGuardadas && vistasGuardadas.length > 0 && onSobrescribirVista && (
        <div className="flex flex-col gap-1">
          <span className="text-xxs text-texto-terciario">Sobrescribir:</span>
          <div className="flex flex-wrap gap-1">
            {vistasGuardadas.map((v) => (
              <button key={v.id} type="button" onClick={() => onSobrescribirVista(v.id)}
                className="text-xs px-2 py-0.5 rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover cursor-pointer transition-colors">
                {v.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guardar como vista nueva */}
      {onGuardarVista && detector?.tipo !== 'default' && (
        <div className="flex flex-col gap-1.5">
          {!creandoVista ? (
            <button type="button" onClick={() => setCreandoVista(true)}
              className="flex items-center gap-1.5 text-sm text-texto-marca font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:underline">
              <BookmarkPlus size={13} />
              Guardar vista
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input type="text" autoFocus value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nombreNueva.trim()) { onGuardarVista(nombreNueva.trim()); setNombreNueva(''); setCreandoVista(false) }
                  if (e.key === 'Escape') { setNombreNueva(''); setCreandoVista(false) }
                }}
                placeholder="Nombre..."
                className="flex-1 px-2 py-1 rounded-lg border border-borde-foco bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none" />
              <button type="button" disabled={!nombreNueva.trim()}
                onClick={() => { if (nombreNueva.trim()) { onGuardarVista(nombreNueva.trim()); setNombreNueva(''); setCreandoVista(false) } }}
                className="text-xs font-medium text-texto-marca cursor-pointer border-none bg-transparent disabled:opacity-40">
                {t('comun.guardar')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

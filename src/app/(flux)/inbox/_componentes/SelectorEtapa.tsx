'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, Loader2 } from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import type { EtapaConversacion, TipoCanal } from '@/tipos/inbox'

/**
 * SelectorEtapa — Dropdown compacto para cambiar la etapa de una conversación.
 * Muestra la etapa actual como pill con color, y despliega la lista de etapas activas.
 * Se usa en: panel derecho (info de contacto) de conversaciones WhatsApp y correo.
 */

interface PropiedadesSelectorEtapa {
  conversacionId: string
  tipoCanal: 'whatsapp' | 'correo'
  etapaActualId: string | null
  onCambio: (etapaId: string | null) => void
}

/** Obtiene las etapas activas del canal desde la API */
async function obtenerEtapas(tipoCanal: TipoCanal): Promise<EtapaConversacion[]> {
  const res = await fetch(`/api/inbox/etapas?tipo_canal=${tipoCanal}`)
  if (!res.ok) return []
  const datos = await res.json()
  return datos.etapas ?? datos ?? []
}

/** Actualiza la etapa de una conversación via PATCH */
async function actualizarEtapa(conversacionId: string, etapaId: string | null): Promise<boolean> {
  const res = await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa_id: etapaId }),
  })
  return res.ok
}

function SelectorEtapa({
  conversacionId,
  tipoCanal,
  etapaActualId,
  onCambio,
}: PropiedadesSelectorEtapa) {
  const [etapas, setEtapas] = useState<EtapaConversacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  /* Cargar etapas al montar */
  useEffect(() => {
    setCargando(true)
    obtenerEtapas(tipoCanal)
      .then(setEtapas)
      .finally(() => setCargando(false))
  }, [tipoCanal])

  /* Etapa actualmente seleccionada */
  const etapaActual = etapas.find(e => e.id === etapaActualId) ?? null

  /* Manejar selección de una etapa */
  const seleccionar = useCallback(async (etapaId: string | null) => {
    if (etapaId === etapaActualId) {
      setAbierto(false)
      return
    }

    setGuardando(true)
    const ok = await actualizarEtapa(conversacionId, etapaId)
    setGuardando(false)

    if (ok) {
      onCambio(etapaId)
    }
    setAbierto(false)
  }, [conversacionId, etapaActualId, onCambio])

  /* Contenido del popover: lista de etapas */
  const contenidoPopover = (
    <div className="py-1.5">
      {/* Texto de ayuda */}
      <p
        className="px-3 pb-2 text-xs leading-relaxed"
        style={{ color: 'var(--texto-terciario)' }}
      >
        Etapa del pipeline — Indica en qué punto está esta conversación
      </p>

      {/* Separador */}
      <div className="h-px mx-2 mb-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Opción: sin etapa */}
      <button
        type="button"
        onClick={() => seleccionar(null)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors duration-100 cursor-pointer min-h-[44px]"
        style={{
          color: etapaActualId === null ? 'var(--texto-primario)' : 'var(--texto-secundario)',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={e => { (e.currentTarget.style.backgroundColor) = 'var(--superficie-hover)' }}
        onMouseLeave={e => { (e.currentTarget.style.backgroundColor) = 'transparent' }}
      >
        <X size={14} style={{ color: 'var(--texto-terciario)' }} />
        <span>Sin etapa</span>
        {etapaActualId === null && (
          <span className="ml-auto text-xs" style={{ color: 'var(--texto-terciario)' }}>Actual</span>
        )}
      </button>

      {/* Separador */}
      <div className="h-px mx-2 my-1" style={{ backgroundColor: 'var(--borde-sutil)' }} />

      {/* Lista de etapas activas */}
      {cargando ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
        </div>
      ) : (
        etapas.filter(e => e.activa).map(etapa => (
          <button
            key={etapa.id}
            type="button"
            onClick={() => seleccionar(etapa.id)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors duration-100 cursor-pointer min-h-[44px]"
            style={{
              color: etapa.id === etapaActualId ? 'var(--texto-primario)' : 'var(--texto-secundario)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={e => { (e.currentTarget.style.backgroundColor) = 'var(--superficie-hover)' }}
            onMouseLeave={e => { (e.currentTarget.style.backgroundColor) = 'transparent' }}
          >
            {/* Dot de color */}
            <span
              className="shrink-0 size-3 rounded-full"
              style={{ backgroundColor: etapa.color }}
            />

            {/* Icono (emoji) + etiqueta */}
            {etapa.icono && <span className="text-sm">{etapa.icono}</span>}
            <span className="truncate">{etapa.etiqueta}</span>

            {/* Indicador de selección actual */}
            {etapa.id === etapaActualId && (
              <span className="ml-auto text-xs" style={{ color: 'var(--texto-terciario)' }}>Actual</span>
            )}
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Popover
        contenido={contenidoPopover}
        abierto={abierto}
        onCambio={setAbierto}
        ancho={260}
        alineacion="inicio"
      >
        {/* Trigger: pill con la etapa actual */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={guardando}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer min-h-[36px] border"
          style={etapaActual ? {
            backgroundColor: `${etapaActual.color}15`,
            color: etapaActual.color,
            borderColor: `${etapaActual.color}30`,
          } : {
            backgroundColor: 'var(--superficie-tarjeta)',
            color: 'var(--texto-secundario)',
            borderColor: 'var(--borde-sutil)',
          }}
        >
          {guardando ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              {/* Dot de color o placeholder */}
              {etapaActual ? (
                <span
                  className="shrink-0 size-2.5 rounded-full"
                  style={{ backgroundColor: etapaActual.color }}
                />
              ) : (
                <span
                  className="shrink-0 size-2.5 rounded-full"
                  style={{ backgroundColor: 'var(--texto-terciario)' }}
                />
              )}

              {/* Icono + nombre */}
              {etapaActual?.icono && <span className="text-sm">{etapaActual.icono}</span>}
              <span className="truncate max-w-[140px]">
                {etapaActual?.etiqueta ?? 'Sin etapa'}
              </span>

              <ChevronDown
                size={14}
                className="shrink-0 ml-0.5"
                style={{ opacity: 0.6 }}
              />
            </>
          )}
        </motion.button>
      </Popover>
    </div>
  )
}

export { SelectorEtapa }
export type { PropiedadesSelectorEtapa }

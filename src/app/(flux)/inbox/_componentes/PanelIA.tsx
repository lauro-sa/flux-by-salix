'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  Sparkles, MessageSquare, FileText, Heart,
  Copy, Check, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'

/**
 * Panel de IA integrado en PanelCorreo.
 * Permite: sugerir respuestas, resumir conversación, analizar sentimiento.
 * Se muestra como barra colapsable sobre el compositor de respuesta.
 */

interface PropiedadesPanelIA {
  conversacionId: string
  onInsertarTexto: (texto: string) => void
  /** Resumen guardado previamente (de la conversación) */
  resumenExistente?: string | null
  sentimientoExistente?: string | null
}

const COLORES_SENTIMIENTO: Record<string, string> = {
  positivo: 'exito',
  neutro: 'neutro',
  negativo: 'peligro',
  urgente: 'advertencia',
}

export function PanelIA({
  conversacionId,
  onInsertarTexto,
  resumenExistente,
  sentimientoExistente,
}: PropiedadesPanelIA) {
  const [expandido, setExpandido] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [accionActiva, setAccionActiva] = useState<string | null>(null)

  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [resumen, setResumen] = useState<string | null>(resumenExistente || null)
  const [sentimiento, setSentimiento] = useState<{
    sentimiento: string
    confianza: number
    resumen: string
  } | null>(sentimientoExistente ? { sentimiento: sentimientoExistente, confianza: 0, resumen: '' } : null)

  const [copiado, setCopiado] = useState<number | null>(null)

  const ejecutarAccion = useCallback(async (accion: 'sugerir_respuesta' | 'resumir' | 'analizar_sentimiento') => {
    setCargando(true)
    setAccionActiva(accion)

    try {
      const res = await fetch('/api/inbox/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: conversacionId, accion }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error de IA')
      }

      const data = await res.json()

      switch (accion) {
        case 'sugerir_respuesta':
          setSugerencias(data.sugerencias || [])
          break
        case 'resumir':
          setResumen(data.resumen || null)
          break
        case 'analizar_sentimiento':
          setSentimiento(data)
          break
      }
    } catch (err) {
      console.error('Error IA:', err)
    } finally {
      setCargando(false)
      setAccionActiva(null)
    }
  }, [conversacionId])

  const copiarSugerencia = (texto: string, indice: number) => {
    navigator.clipboard.writeText(texto)
    setCopiado(indice)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
      {/* Barra toggle */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs transition-colors"
        style={{ color: 'var(--texto-terciario)' }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: 'var(--texto-marca)' }} />
          <span className="font-medium">Asistente IA</span>
          {sentimiento && (
            <Insignia
              color={COLORES_SENTIMIENTO[sentimiento.sentimiento] as 'exito' | 'neutro' | 'peligro' | 'advertencia' || 'neutro'}
              tamano="sm"
            >
              {sentimiento.sentimiento}
            </Insignia>
          )}
        </div>
        {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Panel expandido */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {/* Acciones */}
              <div className="flex flex-wrap gap-1.5">
                <Boton
                  variante="secundario"
                  tamano="xs"
                  icono={cargando && accionActiva === 'sugerir_respuesta'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <MessageSquare size={12} />
                  }
                  onClick={() => ejecutarAccion('sugerir_respuesta')}
                  disabled={cargando}
                >
                  Sugerir respuestas
                </Boton>
                <Boton
                  variante="secundario"
                  tamano="xs"
                  icono={cargando && accionActiva === 'resumir'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <FileText size={12} />
                  }
                  onClick={() => ejecutarAccion('resumir')}
                  disabled={cargando}
                >
                  Resumir
                </Boton>
                <Boton
                  variante="secundario"
                  tamano="xs"
                  icono={cargando && accionActiva === 'analizar_sentimiento'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Heart size={12} />
                  }
                  onClick={() => ejecutarAccion('analizar_sentimiento')}
                  disabled={cargando}
                >
                  Sentimiento
                </Boton>
              </div>

              {/* Sugerencias de respuesta */}
              {sugerencias.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                    Respuestas sugeridas:
                  </p>
                  {sugerencias.map((sug, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors group"
                      style={{ background: 'var(--superficie-hover)' }}
                      onClick={() => onInsertarTexto(sug)}
                    >
                      <p className="flex-1 text-xs" style={{ color: 'var(--texto-secundario)' }}>
                        {sug}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); copiarSugerencia(sug, i) }}
                          className="p-1 rounded"
                          style={{ color: 'var(--texto-terciario)' }}
                        >
                          {copiado === i ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                    Click en una sugerencia para insertarla en el compositor
                  </p>
                </div>
              )}

              {/* Resumen */}
              {resumen && (
                <div
                  className="p-2 rounded-lg text-xs"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  <p className="text-xxs font-medium mb-1" style={{ color: 'var(--texto-terciario)' }}>
                    Resumen:
                  </p>
                  {resumen}
                </div>
              )}

              {/* Sentimiento */}
              {sentimiento && sentimiento.resumen && (
                <div
                  className="p-2 rounded-lg text-xs"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                      Análisis:
                    </span>
                    <Insignia
                      color={COLORES_SENTIMIENTO[sentimiento.sentimiento] as 'exito' | 'neutro' | 'peligro' | 'advertencia' || 'neutro'}
                      tamano="sm"
                    >
                      {sentimiento.sentimiento} ({sentimiento.confianza}%)
                    </Insignia>
                  </div>
                  {sentimiento.resumen}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, AlertCircle } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { AtajoTeclado } from '@/componentes/ui/AtajoTeclado'
import { PanelFlotanteCascada } from '@/componentes/ui/PanelFlotanteCascada'
import { EncabezadoSalix } from './salix-ia/EncabezadoSalix'
import { InputSalix } from './salix-ia/InputSalix'
import { SelectorModoSalix } from './salix-ia/SelectorModoSalix'
import { EstadoVacioSalix } from './salix-ia/EstadoVacioSalix'
import { EstadoAnalizandoSalix } from './salix-ia/EstadoAnalizandoSalix'
import { EstadoResultadosSalix } from './salix-ia/EstadoResultadosSalix'
import { useSecuenciaAnalisis } from './salix-ia/useSecuenciaAnalisis'
import {
  type LineaPropuestaIA,
  type SugerenciaIA,
  type ModoAsistente,
  type EstadoPanel,
  modoABackend,
} from './salix-ia/tipos'

/**
 * PanelAsistenteIA — Panel lateral del asistente Salix IA para presupuestos.
 *
 * Estructura general:
 *  - EncabezadoSalix: logo + status dot vivo + cerrar.
 *  - InputSalix: textarea con counter + acciones, border pulsa cuando piensa.
 *  - SelectorModoSalix: Redactar / Crear / Desglosar + microcopy.
 *  - CTA "Analizar con Salix IA" (con shortcut ⌘+↩).
 *  - Cuerpo según estado:
 *      vacio       → EstadoVacioSalix (4 templates clickeables)
 *      analizando  → EstadoAnalizandoSalix (checklist 3 pasos + skeletons)
 *      resultados  → EstadoResultadosSalix (header + progress + cards)
 *      error       → mensaje y reintento
 *  - Footer: CTA "Agregar N al presupuesto" cuando hay aceptadas.
 *
 * Shortcuts globales mientras el panel está abierto:
 *  - Esc: cerrar
 *  - Cmd/Ctrl + Enter: analizar
 *
 * La API pública (interface re-exportada y props del componente) se
 * mantiene compatible con el panel anterior para no tocar EditorPresupuesto.
 */

// Re-exportar tipo público para que los consumidores existentes sigan
// importando desde acá sin cambios.
export type { LineaPropuestaIA, SugerenciaIA } from './salix-ia/tipos'

interface PropsPanelAsistenteIA {
  abierto: boolean
  onCerrar: () => void
  /** Callback cuando el usuario confirma las líneas aceptadas. */
  onAplicarLineas: (lineas: LineaPropuestaIA[]) => void
  /** Callback para crear un servicio nuevo en el catálogo (no se invoca
   *  directamente en este panel — se delega al editor que lo recibe junto
   *  con la línea). Se mantiene en la interfaz por compat con el padre. */
  onCrearServicio: (linea: LineaPropuestaIA) => Promise<{ codigo: string; id: string } | null>
}

// Modo inicial: prioriza localStorage, default 'desglosar'.
function modoInicial(): ModoAsistente {
  if (typeof window === 'undefined') return 'desglosar'
  const guardado = localStorage.getItem('flux_asistente_modo')
  if (guardado === 'redactar' || guardado === 'crear' || guardado === 'desglosar') return guardado
  // Compat con valores legacy del panel anterior:
  if (guardado === 'simple') return 'redactar'
  if (guardado === 'paquete') return 'crear'
  if (guardado === 'detallado') return 'desglosar'
  return 'desglosar'
}

export function PanelAsistenteIA({ abierto, onCerrar, onAplicarLineas }: PropsPanelAsistenteIA) {
  const [modo, setModo] = useState<ModoAsistente>(modoInicial)
  const [descripcion, setDescripcion] = useState('')
  const [estadoPanel, setEstadoPanel] = useState<EstadoPanel>('vacio')
  const [lineas, setLineas] = useState<LineaPropuestaIA[]>([])
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([])
  const [error, setError] = useState('')
  const secuencia = useSecuenciaAnalisis({ duracionMinima: 2400 })

  const aceptadas = lineas.filter(l => l.estado === 'aceptada')

  // ─── Analizar ───
  const analizar = useCallback(async () => {
    if (!descripcion.trim()) return
    setError('')
    setLineas([])
    setSugerencias([])
    setEstadoPanel('analizando')
    secuencia.comenzar()

    try {
      const res = await fetch('/api/presupuestos/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          modo: modoABackend[modo],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'Error al analizar')
        setEstadoPanel('error')
        secuencia.cancelar()
        return
      }

      const data = await res.json()
      const lineasNuevas: LineaPropuestaIA[] = (data.lineas || []).map((l: LineaPropuestaIA) => ({
        ...l,
        estado: 'pendiente' as const,
        crear_servicio: l.es_nuevo,
      }))

      await secuencia.terminar()
      setLineas(lineasNuevas)
      setSugerencias(data.sugerencias || [])
      setEstadoPanel('resultados')
    } catch {
      setError('Error de conexión')
      setEstadoPanel('error')
      secuencia.cancelar()
    }
  }, [descripcion, modo, secuencia])

  // Re-analizar al cambiar de modo (si ya hay descripción y resultados).
  const reanalizarSiCorresponde = useCallback((nuevoModo: ModoAsistente) => {
    setModo(nuevoModo)
    if (descripcion.trim() && (lineas.length > 0 || estadoPanel === 'resultados')) {
      // Ejecuta en el próximo tick para que `modo` ya esté actualizado
      setTimeout(() => analizar(), 0)
    }
  }, [descripcion, lineas.length, estadoPanel, analizar])

  // ─── Acciones sobre líneas ───
  const cambiarEstadoLinea = useCallback((idx: number, estado: NonNullable<LineaPropuestaIA['estado']>) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, estado } : l))
  }, [])

  const editarDescripcion = useCallback((idx: number, nueva: string) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, descripcion_editada: nueva } : l))
  }, [])

  const usarSimilar = useCallback((idxLinea: number, sug: SugerenciaIA) => {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idxLinea) return l
      return {
        ...l,
        producto_id: sug.producto_id,
        codigo: sug.codigo,
        referencia_interna: sug.referencia_interna,
        nombre: sug.nombre,
        unidad: sug.unidad,
        impuesto_id: sug.impuesto_id,
        es_nuevo: false,
        crear_servicio: false,
        estado: 'aceptada' as const,
      }
    }))
    setSugerencias(prev => prev.filter(s => s.para_linea !== idxLinea))
  }, [])

  const aplicar = useCallback(() => {
    if (aceptadas.length === 0) return
    onAplicarLineas(aceptadas)
    setLineas([])
    setSugerencias([])
    setDescripcion('')
    setEstadoPanel('vacio')
    onCerrar()
  }, [aceptadas, onAplicarLineas, onCerrar])

  // ─── Shortcuts globales ───
  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCerrar()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (aceptadas.length > 0 && estadoPanel === 'resultados') aplicar()
        else analizar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [abierto, onCerrar, analizar, aplicar, aceptadas.length, estadoPanel])

  return (
    <PanelFlotanteCascada
      id="armador-presupuesto"
      etiqueta="Armador"
      colorAcento="rgb(167, 139, 250)"
      abierto={abierto}
      onCerrar={onCerrar}
    >
          <EncabezadoSalix
            estado={estadoPanel}
            cantidadResultados={lineas.length}
            onCerrar={onCerrar}
          />

          {/* Input + selector + CTA — siempre visibles arriba */}
          <div className="px-5 py-4 space-y-3 border-b border-borde-sutil">
            <InputSalix
              valor={descripcion}
              onChange={setDescripcion}
              pensando={estadoPanel === 'analizando'}
              onAtajoAnalizar={analizar}
            />

            <SelectorModoSalix
              valor={modo}
              onChange={reanalizarSiCorresponde}
              disabled={estadoPanel === 'analizando'}
            />

            <Boton
              variante="secundario"
              anchoCompleto
              onClick={analizar}
              disabled={!descripcion.trim() || estadoPanel === 'analizando'}
              className="relative overflow-hidden border-insignia-primario/40 bg-insignia-primario-fondo hover:bg-insignia-primario-fondo/70 py-3.5"
            >
              <span className="flex items-center justify-between gap-3 w-full">
                <span className="flex items-center gap-2 text-insignia-primario-texto font-semibold">
                  <Sparkles size={15} />
                  Analizar con Salix IA
                </span>
                <AtajoTeclado tamano="md">⌘ ↩</AtajoTeclado>
              </span>
            </Boton>

            {error && (
              <div className="flex items-center gap-2 text-xs text-insignia-peligro">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Cuerpo dinámico según estado */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {estadoPanel === 'vacio' && (
                <motion.div key="vacio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <EstadoVacioSalix onElegirPlantilla={setDescripcion} />
                </motion.div>
              )}

              {estadoPanel === 'analizando' && (
                <motion.div key="analizando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <EstadoAnalizandoSalix pasos={secuencia.pasos} />
                </motion.div>
              )}

              {estadoPanel === 'resultados' && lineas.length > 0 && (
                <motion.div key="resultados" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <EstadoResultadosSalix
                    lineas={lineas}
                    sugerencias={sugerencias}
                    modo={modo}
                    onCambiarEstadoLinea={cambiarEstadoLinea}
                    onEditarDescripcion={editarDescripcion}
                    onUsarSimilar={usarSimilar}
                    onReanalizar={analizar}
                  />
                </motion.div>
              )}

              {estadoPanel === 'error' && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-center justify-center text-center h-full px-8 py-12 gap-3">
                  <AlertCircle size={36} className="text-insignia-peligro/60" />
                  <p className="text-sm text-texto-secundario">{error || 'Algo salió mal con el análisis'}</p>
                  <Boton variante="secundario" tamano="sm" onClick={analizar} disabled={!descripcion.trim()}>
                    Reintentar
                  </Boton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer aplicar */}
          {aceptadas.length > 0 && estadoPanel === 'resultados' && (
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="px-5 py-3.5 border-t border-borde-sutil bg-superficie-app"
            >
              <Boton
                anchoCompleto
                icono={<Check size={14} />}
                onClick={aplicar}
                className="!justify-between"
              >
                <span className="flex items-center justify-between w-full">
                  <span>
                    Agregar {aceptadas.length} al presupuesto
                  </span>
                  <AtajoTeclado tamano="md">⌘ ↩</AtajoTeclado>
                </span>
              </Boton>
            </motion.div>
          )}
    </PanelFlotanteCascada>
  )
}

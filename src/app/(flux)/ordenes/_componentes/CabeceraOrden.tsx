'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, CheckCircle2, Ban, RotateCcw, Play, Pause, Send, PenLine } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { useTraduccion } from '@/lib/i18n'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  ETIQUETAS_ESTADO_OT, COLORES_ESTADO_OT,
  ETIQUETAS_PRIORIDAD_OT, COLORES_PRIORIDAD_OT,
  TRANSICIONES_ESTADO_OT,
  type EstadoOrdenTrabajo, type PrioridadOrdenTrabajo,
} from '@/tipos/orden-trabajo'

/**
 * CabeceraOrden — Header del detalle de orden de trabajo.
 * Muestra numero, estado (con dropdown de transiciones), prioridad,
 * botón publicar/despublicar, y botones de acción según permisos.
 */

interface Props {
  numero: string
  titulo: string
  estado: EstadoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  publicada: boolean
  /** Puede editar: publicar/despublicar, cancelar, editar campos. */
  puedeGestionar: boolean
  /** Puede avanzar el flujo: iniciar, completar, reabrir, reactivar. */
  puedeCompletar: boolean
  onCambiarEstado: (estado: EstadoOrdenTrabajo) => void
  onPublicar: () => void
  onDespublicar: () => void
  guardando?: boolean
}

export default function CabeceraOrden({
  numero, titulo, estado, prioridad,
  publicada, puedeGestionar, puedeCompletar,
  onCambiarEstado, onPublicar, onDespublicar,
  guardando,
}: Props) {
  const { t } = useTraduccion()
  const router = useRouter()
  const { obtenerRutaModulo } = useNavegacion()
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(false)
  const refMenu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuEstadoAbierto) return
    const cerrar = (e: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) setMenuEstadoAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuEstadoAbierto])

  const transicionesValidas = TRANSICIONES_ESTADO_OT[estado] || []
  const coloresEstado = COLORES_ESTADO_OT[estado]
  const coloresPrioridad = COLORES_PRIORIDAD_OT[prioridad]

  // Botón de acción principal según estado (avanzar ciclo = permiso 'completar').
  const accionPrincipal = (() => {
    if (!puedeCompletar) return null
    switch (estado) {
      case 'abierta':
        return { label: 'Iniciar', estado: 'en_progreso' as EstadoOrdenTrabajo, icono: Play, variante: 'primario' as const }
      case 'en_progreso':
        return { label: t('ordenes.completar'), estado: 'completada' as EstadoOrdenTrabajo, icono: CheckCircle2, variante: 'primario' as const }
      case 'en_espera':
        return { label: 'Reanudar', estado: 'en_progreso' as EstadoOrdenTrabajo, icono: Play, variante: 'primario' as const }
      case 'completada':
        return { label: t('ordenes.reabrir'), estado: 'en_progreso' as EstadoOrdenTrabajo, icono: RotateCcw, variante: 'secundario' as const }
      case 'cancelada':
        return { label: t('ordenes.reactivar'), estado: 'abierta' as EstadoOrdenTrabajo, icono: RotateCcw, variante: 'secundario' as const }
      default:
        return null
    }
  })()

  const puedeCancelar = puedeGestionar && transicionesValidas.includes('cancelada')

  return (
    <div className="px-4 sm:px-6 pt-4 pb-4 border-b border-borde-sutil">
      {/* Fila 1: Volver + Numero + Badge borrador */}
      <div className="flex items-center gap-3 mb-2">
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<ArrowLeft size={18} />}
          onClick={() => router.push(obtenerRutaModulo('/ordenes'))}
          titulo="Volver al listado"
        />
        <h1 className="text-xl sm:text-2xl font-semibold text-texto-secundario">{numero}</h1>
        {!publicada && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-boton text-xs font-medium bg-insignia-advertencia-fondo text-insignia-advertencia-texto">
            <PenLine size={11} />
            Borrador
          </span>
        )}
      </div>

      {/* Fila 2: Titulo */}
      <p className="text-base sm:text-lg text-texto-primario font-medium mb-3 pl-0 sm:pl-9">{titulo}</p>

      {/* Fila 3: Estado + Prioridad + Publicar + Acciones */}
      <div className="flex items-center gap-2 flex-wrap pl-0 sm:pl-9">
        {/* Estado con dropdown (solo si puede editar) */}
        <div ref={refMenu} className="relative">
          <button
            type="button"
            onClick={() => puedeGestionar && transicionesValidas.length > 0 && setMenuEstadoAbierto(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-sm font-medium transition-colors ${coloresEstado.fondo} ${coloresEstado.texto} ${!puedeGestionar ? 'cursor-default' : ''}`}
          >
            {ETIQUETAS_ESTADO_OT[estado]}
            {puedeGestionar && transicionesValidas.length > 0 && <ChevronDown size={14} />}
          </button>

          {menuEstadoAbierto && puedeGestionar && transicionesValidas.length > 0 && (
            <div className="absolute top-full mt-1 left-0 z-50 min-w-44 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1">
              {transicionesValidas.map(nuevoEstado => {
                const colores = COLORES_ESTADO_OT[nuevoEstado]
                return (
                  <button
                    key={nuevoEstado}
                    type="button"
                    onClick={() => { onCambiarEstado(nuevoEstado); setMenuEstadoAbierto(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-superficie-tarjeta text-texto-secundario hover:text-texto-primario"
                  >
                    <span className={`w-2 h-2 rounded-full ${colores.fondo}`} />
                    {ETIQUETAS_ESTADO_OT[nuevoEstado]}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Prioridad badge */}
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${coloresPrioridad.fondo} ${coloresPrioridad.texto}`}>
          {ETIQUETAS_PRIORIDAD_OT[prioridad]}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Grupo de acciones (segmented control: redondeado solo en las puntas) */}
        <GrupoBotones>
          {/* Botón Publicar / Despublicar (solo admin/cabecilla) */}
          {puedeGestionar && (
            publicada ? (
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Pause size={15} />}
                onClick={onDespublicar}
                disabled={guardando}
              >
                <span className="hidden sm:inline">Despublicar</span>
              </Boton>
            ) : (
              <Boton
                variante="primario"
                tamano="sm"
                icono={<Send size={15} />}
                onClick={onPublicar}
                disabled={guardando}
              >
                <span className="hidden sm:inline">Publicar</span>
              </Boton>
            )
          )}

          {/* Botón acción principal */}
          {accionPrincipal && (
            <Boton
              variante={accionPrincipal.variante}
              tamano="sm"
              icono={<accionPrincipal.icono size={15} />}
              onClick={() => onCambiarEstado(accionPrincipal.estado)}
              disabled={guardando}
            >
              <span className="hidden sm:inline">{accionPrincipal.label}</span>
            </Boton>
          )}

          {/* Cancelar */}
          {puedeCancelar && (
            <Boton
              variante="peligro"
              tamano="sm"
              icono={<Ban size={15} />}
              onClick={() => onCambiarEstado('cancelada')}
              disabled={guardando}
            >
              <span className="hidden sm:inline">{t('ordenes.cancelar_orden')}</span>
            </Boton>
          )}
        </GrupoBotones>
      </div>
    </div>
  )
}

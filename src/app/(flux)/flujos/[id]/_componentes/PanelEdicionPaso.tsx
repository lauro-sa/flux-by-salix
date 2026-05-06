'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Eye } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import {
  iconoDefaultAccion,
  iconoDefaultDisparador,
} from '@/lib/workflows/iconos-flujo'
import { etiquetaDisparador } from '@/lib/workflows/etiquetas-disparador'
import { claveI18nTituloPaso } from '@/lib/workflows/categorias-pasos'
import { posicionPaso } from '@/lib/workflows/posicion-paso'
import HeaderPanel from './_panel/HeaderPanel'
import SubHeaderPanel from './_panel/SubHeaderPanel'
import FooterPanel from './_panel/FooterPanel'
import PanelEsperar from './_panel/secciones/PanelEsperar'
import PanelTerminar from './_panel/secciones/PanelTerminar'
import PanelDisparadorCron from './_panel/secciones/PanelDisparadorCron'
import PanelDisparadorActividadCompletada from './_panel/secciones/PanelDisparadorActividadCompletada'
import PanelTipoPendiente from './_panel/secciones/PanelTipoPendiente'
import type { AccionConId } from '@/lib/workflows/ids-pasos'
import type {
  AccionEsperar,
  AccionTerminarFlujo,
  AccionWorkflow,
  DisparadorActividadCompletada,
  DisparadorTiempoCron,
  DisparadorWorkflow,
  TipoAccion,
  TipoDisparador,
} from '@/tipos/workflow'

/**
 * Panel lateral derecho del editor visual de flujos (sub-PR 19.3a).
 *
 * Reemplaza al `PanelEdicionPasoPlaceholder` con campos editables reales.
 * Slide-in 480px en desktop, full-screen en mobile (un sub-PR posterior
 * lo convierte en bottom-sheet 80%h con drag handle).
 *
 * Estructura:
 *   • Header — ícono del tipo + título legible + cerrar.
 *   • SubHeader — chips de tipo, posición, contexto branch.
 *   • Banner gris si modo solo lectura.
 *   • Cuerpo scrolleable con secciones colapsables específicas del tipo.
 *   • Footer — eliminar paso (rojo) + cerrar (o solo cerrar en lectura).
 *
 * Tipos soportados con editor real en 19.3a:
 *   accion:      esperar, terminar_flujo
 *   disparador:  tiempo.cron, actividad.completada
 *
 * El resto cae en `PanelTipoPendiente`. La cobertura completa llega
 * en 19.3b (tipos con variables) y 19.3c (Branch + genéricos).
 *
 * NO toca la mecánica de apertura/cierre — la sigue gestionando
 * `EditorFlujo` vía las props `abierto` + `onCerrar`. Acá solo pintamos
 * el contenido cuando hay selección.
 */

type Seleccion =
  | { tipo: 'disparador' }
  | { tipo: 'paso'; id: string }

interface Props {
  abierto: boolean
  onCerrar: () => void
  seleccion: Seleccion | null
  /** Disparador actual del flujo (jsonb opaco, narrowing en runtime). */
  disparador: { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null
  /** Árbol de pasos con ids estables (raíz). */
  pasosRaiz: AccionConId[]
  soloLectura: boolean
  onActualizarPaso: (id: string, parche: Partial<AccionWorkflow>) => void
  onEliminarPaso: (id: string) => void
  onActualizarDisparador: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelEdicionPaso({
  abierto,
  onCerrar,
  seleccion,
  disparador,
  pasosRaiz,
  soloLectura,
  onActualizarPaso,
  onEliminarPaso,
  onActualizarDisparador,
}: Props) {
  const { t } = useTraduccion()

  // ─── Datos derivados de la selección actual ──────────────────────
  const datos = (() => {
    if (!seleccion) return null

    if (seleccion.tipo === 'disparador') {
      const tipo = (disparador?.tipo ?? null) as TipoDisparador | null
      const Icono = tipo ? iconoDefaultDisparador(tipo) : null
      const tipoLegible = tipo
        ? etiquetaDisparador(t, tipo)
        : t('flujos.editor.panel.titulo_default')
      return {
        modo: 'disparador' as const,
        Icono,
        titulo: tipoLegible,
        tipoLegible,
        tipo,
      }
    }

    // Buscar el paso por id en el árbol (raíz + ramas).
    const paso = encontrarPaso(pasosRaiz, seleccion.id)
    const tipo = (paso?.tipo ?? null) as TipoAccion | null
    const Icono = tipo ? iconoDefaultAccion(tipo) : null
    const tipoLegible = tipo
      ? (() => {
          const clave = claveI18nTituloPaso(tipo)
          const traducido = t(clave)
          return traducido === clave ? tipo : traducido
        })()
      : t('flujos.editor.panel.titulo_default')
    const posicion = posicionPaso(pasosRaiz, seleccion.id)
    return {
      modo: 'paso' as const,
      Icono,
      titulo: tipoLegible,
      tipoLegible,
      tipo,
      paso,
      posicion,
    }
  })()

  return (
    <AnimatePresence>
      {abierto && datos && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-y-0 right-0 z-30 w-full md:w-[480px] bg-superficie-app border-l border-borde-sutil flex flex-col shadow-2xl"
          role="dialog"
          aria-label={datos.titulo}
        >
          <HeaderPanel Icono={datos.Icono} titulo={datos.titulo} onCerrar={onCerrar} />

          {datos.modo === 'paso' ? (
            <SubHeaderPanel
              modo="paso"
              tipoLegible={datos.tipoLegible}
              posicion={datos.posicion}
            />
          ) : (
            <SubHeaderPanel modo="disparador" tipoLegible={datos.tipoLegible} />
          )}

          {soloLectura && (
            <div
              role="status"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-superficie-tarjeta border-b border-borde-sutil text-xs text-texto-secundario"
            >
              <Eye size={14} className="shrink-0 text-texto-terciario" />
              {t('flujos.editor.panel.banner_lectura')}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {datos.modo === 'disparador'
              ? renderDisparador(datos.tipo, disparador, soloLectura, onActualizarDisparador, datos.tipoLegible)
              : renderPaso(datos.paso ?? null, soloLectura, (parche) => {
                  if (seleccion?.tipo === 'paso') onActualizarPaso(seleccion.id, parche)
                }, datos.tipoLegible)}
          </div>

          <FooterPanel
            modo={datos.modo}
            soloLectura={soloLectura}
            onCerrar={onCerrar}
            onEliminar={() => {
              if (seleccion?.tipo === 'paso') {
                onEliminarPaso(seleccion.id)
              }
            }}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/**
 * Render del cuerpo según el tipo del disparador. Discriminamos por
 * `tipo` y narrowing manual del shape (el editor lee el flujo como
 * jsonb opaco — no podemos confiar en runtime hasta validar).
 */
function renderDisparador(
  tipo: TipoDisparador | null,
  disparadorRaw: { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null,
  soloLectura: boolean,
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void,
  tipoLegible: string,
) {
  if (!tipo || !disparadorRaw) {
    return <PanelTipoPendiente tipoLegible={tipoLegible} />
  }

  if (tipo === 'tiempo.cron') {
    const configuracion = disparadorRaw.configuracion ?? {}
    const expresion =
      typeof (configuracion as Record<string, unknown>).expresion === 'string'
        ? ((configuracion as Record<string, unknown>).expresion as string)
        : '0 9 * * *'
    const disparador: DisparadorTiempoCron = {
      tipo: 'tiempo.cron',
      configuracion: { expresion },
    }
    return (
      <PanelDisparadorCron
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'actividad.completada') {
    const configuracion = disparadorRaw.configuracion ?? {}
    const tipoClave = (configuracion as Record<string, unknown>).tipo_clave
    const disparador: DisparadorActividadCompletada = {
      tipo: 'actividad.completada',
      configuracion: typeof tipoClave === 'string' ? { tipo_clave: tipoClave } : {},
    }
    return (
      <PanelDisparadorActividadCompletada
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  return <PanelTipoPendiente tipoLegible={tipoLegible} />
}

/**
 * Render del cuerpo según el tipo del paso. Mismo criterio de narrowing
 * en runtime: leemos el shape del paso del estado del editor (que viene
 * de un jsonb opaco) y solo pasamos a los componentes hijos cuando el
 * shape mínimo está OK.
 */
function renderPaso(
  paso: AccionConId | null,
  soloLectura: boolean,
  onCambiar: (parche: Partial<AccionWorkflow>) => void,
  tipoLegible: string,
) {
  if (!paso) {
    return <PanelTipoPendiente tipoLegible={tipoLegible} />
  }

  if (paso.tipo === 'esperar') {
    return (
      <PanelEsperar
        paso={paso as AccionEsperar}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (paso.tipo === 'terminar_flujo') {
    return (
      <PanelTerminar
        paso={paso as AccionTerminarFlujo}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  return <PanelTipoPendiente tipoLegible={tipoLegible} />
}

/**
 * Búsqueda recursiva del paso por id en raíz + ramas. Versión tolerante
 * — si la estructura del jsonb está rota, devuelve null silenciosamente
 * en lugar de lanzar.
 */
function encontrarPaso(pasos: AccionConId[], id: string): AccionConId | null {
  for (const p of pasos) {
    if (p.id === id) return p
    if (p.tipo === 'condicion_branch') {
      const si = (p.acciones_si as AccionConId[] | undefined) ?? []
      const enSi = encontrarPaso(si, id)
      if (enSi) return enSi
      const no = (p.acciones_no as AccionConId[] | undefined) ?? []
      const enNo = encontrarPaso(no, id)
      if (enNo) return enNo
    }
  }
  return null
}

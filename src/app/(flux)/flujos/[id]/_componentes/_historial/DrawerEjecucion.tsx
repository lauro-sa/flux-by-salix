'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2, RefreshCcw, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { Boton } from '@/componentes/ui/Boton'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import EstadoEjecucionPill from './EstadoEjecucionPill'
import TimelineEjecucion from './TimelineEjecucion'
import {
  duracionSegundos,
  formatearDuracion,
  tipoDisparadoPor,
} from './formato-ejecucion'
import { useDetalleEjecucion } from './hooks/useDetalleEjecucion'

/**
 * DrawerEjecucion — detalle de una ejecución (sub-PR 19.6).
 *
 * Desktop: side-drawer derecho 480px slide-in (Framer Motion). Mobile:
 * BottomSheet `alto` (85dvh) reusando el componente UI ya validado en
 * 19.3d/19.5. Cero modificación de los reusables.
 *
 * Estados que maneja:
 *   - Cargando: skeleton / spinner.
 *   - No encontrada (404): empty state + botón cerrar (caveat D8). El
 *     listado detrás queda utilizable.
 *   - Error genérico (500/red): mensaje + botón reintentar.
 *   - OK: header con pill + meta + timeline + footer (acciones en commit 4).
 *
 * Atajo Esc: lo gestiona el editor padre via useAtajosEditorFlujo —
 * acá solo exponemos onCerrar.
 */

interface Props {
  abierto: boolean
  ejecucionId: string | null
  enMobile: boolean
  onCerrar: () => void
}

export default function DrawerEjecucion({
  abierto,
  ejecucionId,
  enMobile,
  onCerrar,
}: Props) {
  const { t } = useTraduccion()
  const detalle = useDetalleEjecucion(abierto ? ejecucionId : null)

  // Cuerpo común para desktop y mobile: cambia el contenedor de afuera,
  // pero la parte interna (header + body + footer) es la misma.
  const contenido = (
    <ContenidoDrawer
      abierto={abierto}
      detalle={detalle}
      onCerrar={onCerrar}
      t={t}
    />
  )

  if (enMobile) {
    return (
      <BottomSheet
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={t('flujos.historial.drawer.titulo')}
        altura="alto"
        sinPadding
      >
        {contenido}
      </BottomSheet>
    )
  }

  return (
    <AnimatePresence>
      {abierto && (
        <>
          {/* Backdrop sutil para no apagar la página entera; el editor
              detrás sigue legible. Click en backdrop cierra el drawer. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCerrar}
            className="fixed inset-0 z-30 bg-superficie-app/30 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <motion.aside
            key="drawer-ejecucion"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed top-0 right-0 z-40 h-dvh w-full max-w-[480px] bg-superficie-app border-l border-borde-sutil shadow-2xl flex flex-col"
            role="dialog"
            aria-label={t('flujos.historial.drawer.titulo')}
          >
            {contenido}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Contenido (header + body + footer) ─────────────────────────────

function ContenidoDrawer({
  abierto,
  detalle,
  onCerrar,
  t,
}: {
  abierto: boolean
  detalle: ReturnType<typeof useDetalleEjecucion>
  onCerrar: () => void
  t: ReturnType<typeof useTraduccion>['t']
}) {
  // Si el drawer no está abierto, no renderizamos el cuerpo cargado
  // (BottomSheet desmonta solo el wrapper; nosotros desmontamos el
  // contenido para liberar el query cache de detalle). Esto es lo que
  // hace que abrir el drawer en otra ejecución dispare un fetch nuevo.
  if (!abierto) return null

  // Cargando inicial
  if (detalle.cargando && !detalle.ejecucion) {
    return (
      <div className="flex flex-col h-full">
        <CabeceraDrawer onCerrar={onCerrar} t={t} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-texto-terciario" size={20} />
        </div>
      </div>
    )
  }

  // 404 — caveat D8: empty state + cerrar; listado utilizable detrás
  if (detalle.noEncontrada) {
    return (
      <div className="flex flex-col h-full">
        <CabeceraDrawer onCerrar={onCerrar} t={t} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-texto-terciario">
          <AlertTriangle size={28} className="mb-3 opacity-60" strokeWidth={1.6} />
          <p className="text-sm font-medium text-texto-secundario">
            {t('flujos.historial.drawer.no_encontrada_titulo')}
          </p>
          <p className="mt-1 text-xs max-w-xs">
            {t('flujos.historial.drawer.no_encontrada_desc')}
          </p>
          <Boton variante="secundario" tamano="sm" onClick={onCerrar} className="mt-4">
            {t('flujos.historial.drawer.cerrar')}
          </Boton>
        </div>
      </div>
    )
  }

  // Error genérico (red caída, 500) — distinto del 404
  if (detalle.error) {
    return (
      <div className="flex flex-col h-full">
        <CabeceraDrawer onCerrar={onCerrar} t={t} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-texto-terciario">
          <AlertTriangle
            size={28}
            className="mb-3 text-insignia-peligro-texto"
            strokeWidth={1.6}
          />
          <p className="text-sm font-medium text-texto-secundario">
            {t('flujos.historial.drawer.error_titulo')}
          </p>
          <p className="mt-1 text-xs max-w-xs">
            {t('flujos.historial.drawer.error_desc')}
          </p>
          <Boton
            variante="secundario"
            tamano="sm"
            icono={<RefreshCcw size={13} />}
            onClick={detalle.recargar}
            className="mt-4"
          >
            {t('flujos.historial.drawer.reintentar')}
          </Boton>
        </div>
      </div>
    )
  }

  const ej = detalle.ejecucion
  if (!ej) return null

  const dur = duracionSegundos(ej.inicio_en, ej.fin_en)
  const tipoDisp = tipoDisparadoPor(ej.disparado_por)

  return (
    <div className="flex flex-col h-full min-h-0">
      <CabeceraDrawer onCerrar={onCerrar} t={t} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Bloque meta arriba: estado + fecha + duración + origen. */}
        <div className="px-4 py-3 border-b border-borde-sutil flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <EstadoEjecucionPill estado={ej.estado} tamano="md" />
            <span className="text-xs text-texto-terciario">
              {formatearDuracion(dur)}
            </span>
          </div>
          <FechasMeta inicio_en={ej.inicio_en} fin_en={ej.fin_en} creado_en={ej.creado_en} />
          <div className="text-xxs text-texto-terciario">
            {tipoDisp
              ? t(`flujos.historial.disparado_por.${tipoDisp}`)
              : t('flujos.historial.disparado_por.desconocido')}
          </div>
        </div>

        {/* Timeline real */}
        <div className="px-4 py-4">
          <TimelineEjecucion log={ej.log} pendientes={ej.acciones_pendientes} />
        </div>
      </div>

      {/* Footer reservado para acciones — placeholder en commit 3, las
          conecta el commit 4 (Reejecutar / Cancelar / Copiar log). */}
      <div className="border-t border-borde-sutil px-4 py-3 flex items-center justify-end gap-2">
        <Boton variante="secundario" tamano="sm" onClick={onCerrar}>
          {t('flujos.historial.drawer.cerrar')}
        </Boton>
      </div>
    </div>
  )
}

// ─── Cabecera del drawer ────────────────────────────────────────────

function CabeceraDrawer({
  onCerrar,
  t,
}: {
  onCerrar: () => void
  t: ReturnType<typeof useTraduccion>['t']
}) {
  return (
    <header className="px-4 py-3 border-b border-borde-sutil flex items-center gap-2 shrink-0">
      <h2 className="text-sm font-semibold text-texto-primario">
        {t('flujos.historial.drawer.titulo')}
      </h2>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onCerrar}
        className="p-1.5 rounded-boton text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover transition-colors"
        aria-label={t('flujos.historial.drawer.cerrar')}
      >
        <X size={14} />
      </button>
    </header>
  )
}

// ─── Bloque de fechas formateadas ───────────────────────────────────

function FechasMeta({
  inicio_en,
  fin_en,
  creado_en,
}: {
  inicio_en: string | null
  fin_en: string | null
  creado_en: string
}) {
  const formato = useFormato()
  const { t } = useTraduccion()

  // Si NO hay inicio_en (caso esperando/pendiente) mostramos solo
  // creado_en. Si hay ambos, mostramos rango compacto.
  if (!inicio_en) {
    return (
      <div className="flex flex-col gap-0.5 text-xxs font-mono text-texto-terciario">
        <span>
          {t('flujos.historial.drawer.creado_en')}:{' '}
          {formato.fecha(creado_en, { conHora: true })}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 text-xxs font-mono text-texto-terciario">
      <span>
        {t('flujos.historial.drawer.inicio')}:{' '}
        {formato.fecha(inicio_en, { conHora: true })}
      </span>
      {fin_en && (
        <span>
          {t('flujos.historial.drawer.fin')}:{' '}
          {formato.fecha(fin_en, { conHora: true })}
        </span>
      )}
    </div>
  )
}


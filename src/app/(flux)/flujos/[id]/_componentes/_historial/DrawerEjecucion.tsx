'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  ClipboardCopy,
  Loader2,
  RefreshCcw,
  RotateCcw,
  X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useToast } from '@/componentes/feedback/Toast'
import { Boton } from '@/componentes/ui/Boton'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import EstadoEjecucionPill from './EstadoEjecucionPill'
import TimelineEjecucion from './TimelineEjecucion'
import {
  duracionSegundos,
  formatearDuracion,
  tipoDisparadoPor,
} from './formato-ejecucion'
import {
  useDetalleEjecucion,
  type DetalleEjecucion,
} from './hooks/useDetalleEjecucion'

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
  flujoId: string
  enMobile: boolean
  onCerrar: () => void
}

export default function DrawerEjecucion({
  abierto,
  ejecucionId,
  flujoId,
  enMobile,
  onCerrar,
}: Props) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const queryClient = useQueryClient()
  const detalle = useDetalleEjecucion(abierto ? ejecucionId : null)

  // ─── Acciones (sub-PR 19.6 commit 4) ────────────────────────────
  // Estado de modales de confirmación + accionEnCurso para deshabilitar
  // botones mientras corre el fetch. Cualquier acción exitosa invalida
  // el cache del listado de ejecuciones del flujo (key del 19.6 commit 2)
  // para que la fila se actualice.
  const [confirmandoReejecutar, setConfirmandoReejecutar] = useState(false)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [accionEnCurso, setAccionEnCurso] = useState<
    'reejecutar' | 'cancelar' | null
  >(null)

  const invalidarListado = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`ejecuciones-${flujoId}`] })
  }, [queryClient, flujoId])

  const onConfirmarReejecutar = useCallback(async () => {
    if (!ejecucionId || accionEnCurso) return
    setAccionEnCurso('reejecutar')
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/reejecutar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrar('exito', t('flujos.historial.acciones.reejecutar_ok'))
      invalidarListado()
      // La ejecución NUEVA tiene id distinto al original. Cerramos el
      // drawer — la fila nueva aparece arriba en el listado y el
      // usuario decide si abrirla.
      setConfirmandoReejecutar(false)
      onCerrar()
    } catch (err) {
      mostrar(
        'error',
        err instanceof Error
          ? err.message
          : t('flujos.historial.acciones.reejecutar_error'),
      )
    } finally {
      setAccionEnCurso(null)
    }
  }, [ejecucionId, accionEnCurso, mostrar, t, invalidarListado, onCerrar])

  const onConfirmarCancelar = useCallback(async () => {
    if (!ejecucionId || accionEnCurso) return
    setAccionEnCurso('cancelar')
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/cancelar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      // Caveat D6 del coordinador: el endpoint devuelve 409 cuando la
      // ejecución cambió de estado entre la lectura del cliente y la
      // llamada (race con el worker que la completó). Convertimos ese
      // caso en toast amigable en vez de error técnico — el detalle
      // también se recarga para que el usuario vea el estado nuevo.
      if (res.status === 409) {
        const cuerpo = (await res.json().catch(() => ({}))) as { codigo?: string }
        const claveToast =
          cuerpo.codigo === 'corriendo_no_cancelable'
            ? 'flujos.historial.acciones.cancelar_corriendo'
            : 'flujos.historial.acciones.cancelar_ya_termino'
        mostrar('info', t(claveToast))
        detalle.recargar()
        invalidarListado()
        setConfirmandoCancelar(false)
        return
      }
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrar('exito', t('flujos.historial.acciones.cancelar_ok'))
      detalle.recargar()
      invalidarListado()
      setConfirmandoCancelar(false)
    } catch (err) {
      mostrar(
        'error',
        err instanceof Error
          ? err.message
          : t('flujos.historial.acciones.cancelar_error'),
      )
    } finally {
      setAccionEnCurso(null)
    }
  }, [ejecucionId, accionEnCurso, mostrar, t, detalle, invalidarListado])

  const onCopiarLog = useCallback(async (ejecucion: DetalleEjecucion) => {
    const json = JSON.stringify(
      { ejecucion_id: ejecucion.id, log: ejecucion.log },
      null,
      2,
    )
    try {
      await navigator.clipboard.writeText(json)
      mostrar('exito', t('flujos.historial.acciones.copiar_log_ok'))
    } catch {
      mostrar('error', t('flujos.historial.acciones.copiar_log_error'))
    }
  }, [mostrar, t])

  // Cuerpo común para desktop y mobile: cambia el contenedor de afuera,
  // pero la parte interna (header + body + footer) es la misma.
  const contenido = (
    <ContenidoDrawer
      abierto={abierto}
      detalle={detalle}
      accionEnCurso={accionEnCurso}
      onCerrar={onCerrar}
      onPedirReejecutar={() => setConfirmandoReejecutar(true)}
      onPedirCancelar={() => setConfirmandoCancelar(true)}
      onCopiarLog={onCopiarLog}
      t={t}
    />
  )

  // Modales de confirmación reusables para desktop y mobile. Se
  // renderizan al lado del drawer (Modal usa portal). Por separar el
  // mount del drawer no se desmontan al cerrar el drawer mientras corre
  // la acción.
  const modales = (
    <>
      <ModalConfirmacion
        abierto={confirmandoReejecutar}
        onCerrar={() => setConfirmandoReejecutar(false)}
        onConfirmar={() => void onConfirmarReejecutar()}
        titulo={t('flujos.historial.acciones.confirmar_reejecutar.titulo')}
        descripcion={t('flujos.historial.acciones.confirmar_reejecutar.descripcion')}
        tipo="peligro"
        etiquetaConfirmar={t('flujos.historial.acciones.confirmar_reejecutar.confirmar')}
        cargando={accionEnCurso === 'reejecutar'}
      />
      <ModalConfirmacion
        abierto={confirmandoCancelar}
        onCerrar={() => setConfirmandoCancelar(false)}
        onConfirmar={() => void onConfirmarCancelar()}
        titulo={t('flujos.historial.acciones.confirmar_cancelar.titulo')}
        descripcion={t('flujos.historial.acciones.confirmar_cancelar.descripcion')}
        tipo="advertencia"
        etiquetaConfirmar={t('flujos.historial.acciones.confirmar_cancelar.confirmar')}
        cargando={accionEnCurso === 'cancelar'}
      />
    </>
  )

  if (enMobile) {
    return (
      <>
        <BottomSheet
          abierto={abierto}
          onCerrar={onCerrar}
          titulo={t('flujos.historial.drawer.titulo')}
          altura="alto"
          sinPadding
        >
          {contenido}
        </BottomSheet>
        {modales}
      </>
    )
  }

  return (
    <>
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
      {modales}
    </>
  )
}

// ─── Contenido (header + body + footer) ─────────────────────────────

function ContenidoDrawer({
  abierto,
  detalle,
  accionEnCurso,
  onCerrar,
  onPedirReejecutar,
  onPedirCancelar,
  onCopiarLog,
  t,
}: {
  abierto: boolean
  detalle: ReturnType<typeof useDetalleEjecucion>
  accionEnCurso: 'reejecutar' | 'cancelar' | null
  onCerrar: () => void
  onPedirReejecutar: () => void
  onPedirCancelar: () => void
  onCopiarLog: (ej: DetalleEjecucion) => void
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

      {/* Footer con acciones (sub-PR 19.6 commit 4).
          Layout: izquierda Copiar log (utilitario, sin permisos);
          derecha Cancelar / Reejecutar / Cerrar. Copiar y Cancelar /
          Reejecutar se muestran sólo si el endpoint de detalle marcó
          `permisos.{cancelar, reejecutar}`. El usuario sin permiso
          igualmente puede ver y copiar el log para soporte. */}
      <div className="border-t border-borde-sutil px-3 py-3 flex items-center gap-2 flex-wrap">
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<ClipboardCopy size={13} />}
          onClick={() => onCopiarLog(ej)}
          tooltip={t('flujos.historial.acciones.copiar_log_tooltip')}
        >
          <span className="hidden sm:inline">
            {t('flujos.historial.acciones.copiar_log')}
          </span>
        </Boton>
        <div className="flex-1" />
        {ej.permisos.cancelar && (
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={<Ban size={13} />}
            onClick={onPedirCancelar}
            disabled={accionEnCurso !== null}
            className="text-insignia-peligro-texto hover:bg-insignia-peligro-fondo/40"
          >
            {t('flujos.historial.acciones.cancelar')}
          </Boton>
        )}
        {ej.permisos.reejecutar && (
          <Boton
            variante="secundario"
            tamano="sm"
            icono={<RotateCcw size={13} />}
            onClick={onPedirReejecutar}
            disabled={accionEnCurso !== null}
            cargando={accionEnCurso === 'reejecutar'}
          >
            {t('flujos.historial.acciones.reejecutar')}
          </Boton>
        )}
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


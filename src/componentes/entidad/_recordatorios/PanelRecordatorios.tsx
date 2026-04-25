'use client'

/**
 * PanelRecordatorios — Panel flotante de recordatorios.
 * Desktop: panel lateral derecho (420px) con slide-in.
 * Mobile: pantalla completa slide-up, respeta safe-areas (iOS notch + home indicator).
 *
 * Ahora con más espacio vertical:
 *  - Hero con ícono grande + resumen (activos · vencidos · hoy).
 *  - Tabs grandes y táctiles.
 *  - Lista activa agrupada cronológicamente: Vencidos → Hoy → Mañana → Esta semana → Próximos.
 *  - Formulario aireado con chips de fecha rápidos.
 *
 * Se usa en: PlantillaApp (speed-dial).
 */

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlarmClock, Plus, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useRecordatorios } from './useRecordatorios'
import { FormularioRecordatorio } from './FormularioRecordatorio'
import { ItemRecordatorio } from './ItemRecordatorio'
import { PreviewRecordatorio } from './PreviewRecordatorio'
import { ModalConfirmarEliminar } from './ModalConfirmarEliminar'
import { type Recordatorio, hoyISO } from './tipos'

interface PropiedadesPanelRecordatorios {
  abierto: boolean
  onCerrar: () => void
}

type ClaveTab = 'crear' | 'activos' | 'completados'

/* ─── Agrupación cronológica para la lista de activos ─── */

interface GrupoActivos {
  clave: 'vencidos' | 'hoy' | 'manana' | 'semana' | 'proximos'
  etiqueta: string
  acento?: string
  items: Recordatorio[]
}

function agruparActivos(recordatorios: Recordatorio[]): GrupoActivos[] {
  const hoy = hoyISO()
  const manana = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()
  const finSemana = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })()

  const grupos: Record<GrupoActivos['clave'], Recordatorio[]> = {
    vencidos: [], hoy: [], manana: [], semana: [], proximos: [],
  }

  for (const r of recordatorios) {
    if (r.fecha < hoy) grupos.vencidos.push(r)
    else if (r.fecha === hoy) grupos.hoy.push(r)
    else if (r.fecha === manana) grupos.manana.push(r)
    else if (r.fecha < finSemana) grupos.semana.push(r)
    else grupos.proximos.push(r)
  }

  const resultado: GrupoActivos[] = []
  if (grupos.vencidos.length) resultado.push({ clave: 'vencidos', etiqueta: 'Vencidos', acento: 'var(--insignia-peligro-texto)', items: grupos.vencidos })
  if (grupos.hoy.length) resultado.push({ clave: 'hoy', etiqueta: 'Hoy', acento: 'var(--texto-marca)', items: grupos.hoy })
  if (grupos.manana.length) resultado.push({ clave: 'manana', etiqueta: 'Mañana', items: grupos.manana })
  if (grupos.semana.length) resultado.push({ clave: 'semana', etiqueta: 'Esta semana', items: grupos.semana })
  if (grupos.proximos.length) resultado.push({ clave: 'proximos', etiqueta: 'Próximos', items: grupos.proximos })
  return resultado
}

/* ─── Tabs táctiles (aprovechan el ancho del panel) ─── */

function TabsRecordatorios({
  activo, onCambiar, editandoId, activos, completados,
}: {
  activo: ClaveTab
  onCambiar: (t: ClaveTab) => void
  editandoId: string | null
  activos: number
  completados: number
}) {
  const tabs: { clave: ClaveTab; etiqueta: string; icono: React.ReactNode; contador?: number }[] = [
    { clave: 'crear', etiqueta: editandoId ? 'Editar' : 'Crear', icono: <Plus size={14} /> },
    { clave: 'activos', etiqueta: 'Activos', icono: <Clock size={14} />, contador: activos },
    { clave: 'completados', etiqueta: 'Hechos', icono: <CheckCircle2 size={14} />, contador: completados },
  ]

  return (
    <div className="px-3 py-2 shrink-0">
      {/* Segmented control — pill contenedora con activo deslizable */}
      <div
        className="flex items-center gap-0.5 p-1 rounded-full border"
        style={{
          background: 'rgba(255,255,255,0.025)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {tabs.map(({ clave, etiqueta, icono, contador }) => {
          const esActivo = activo === clave
          return (
            <button
              key={clave}
              onClick={() => onCambiar(clave)}
              className={`relative flex-1 min-h-[34px] flex items-center justify-center gap-1.5 px-2.5 rounded-full text-[13px] font-medium transition-colors ${
                esActivo ? 'text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {/* Indicador activo deslizable (layoutId comparte transición entre tabs) */}
              {esActivo && (
                <motion.span
                  layoutId="tab-recordatorios-activo"
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(127,119,221,0.32), rgba(99,91,199,0.20))',
                    border: '1px solid rgba(127,119,221,0.45)',
                    boxShadow:
                      '0 4px 14px rgba(60,50,160,0.25), inset 0 1px 0 rgba(255,255,255,0.14)',
                  }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {icono}
                <span>{etiqueta}</span>
                {contador !== undefined && contador > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-none ${
                      esActivo
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.08] text-white/55'
                    }`}
                  >
                    {contador > 99 ? '99+' : contador}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Header hero ─── */

function HeaderHero({
  activos, vencidos, hoy, onCerrar,
}: {
  activos: number
  vencidos: number
  hoy: number
  onCerrar: () => void
}) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-11 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <AlarmClock className="size-5 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-texto-primario leading-tight">Recordatorios</h3>
            <p className="text-xs text-texto-terciario mt-0.5">
              {activos === 0
                ? 'Nada pendiente por ahora'
                : `${activos} ${activos === 1 ? 'recordatorio activo' : 'recordatorios activos'}`}
            </p>
          </div>
        </div>
        <button
          onClick={onCerrar}
          className="size-9 -mr-1 -mt-1 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors flex items-center justify-center shrink-0"
          title="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Resumen en pills — solo si hay algo que mostrar */}
      {(vencidos > 0 || hoy > 0) && (
        <div className="flex items-center gap-2 mt-3">
          {vencidos > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-insignia-peligro/10 text-insignia-peligro-texto border border-insignia-peligro/20">
              <AlertTriangle size={12} strokeWidth={2} />
              {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}
            </span>
          )}
          {hoy > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-texto-marca/10 text-texto-marca border border-texto-marca/20">
              <Clock size={12} strokeWidth={2} />
              {hoy} {hoy === 1 ? 'para hoy' : 'para hoy'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Lista agrupada de activos ─── */

function ListaAgrupada({
  grupos, onToggleCompletar, onEliminar, onEditar,
}: {
  grupos: GrupoActivos[]
  onToggleCompletar: (id: string, completado: boolean) => void
  onEliminar: (r: Recordatorio) => void
  onEditar: (r: Recordatorio) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.clave}>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: g.acento || 'var(--texto-terciario)' }}
            >
              {g.etiqueta}
            </span>
            <span className="text-[11px] font-medium text-texto-terciario/70">
              {g.items.length}
            </span>
            <span className="flex-1 h-px bg-white/[0.05]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <AnimatePresence>
              {g.items.map((r, idx) => (
                <ItemRecordatorio
                  key={r.id}
                  recordatorio={r}
                  indice={idx}
                  onToggleCompletar={onToggleCompletar}
                  onEliminar={onEliminar}
                  onEditar={onEditar}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  )
}

/* ─── Componente principal ─── */

function PanelRecordatorios({ abierto, onCerrar }: PropiedadesPanelRecordatorios) {
  const esMovil = useEsMovil()
  const estado = useRecordatorios()

  const {
    setAbierto,
    tab, setTab,
    activos, completados, cargando, vencidos,
    titulo, fecha, creando, crear, editandoId, limpiarFormulario,
    toggleCompletar, intentarEliminar, eliminarDirecto, editarRecordatorio,
    previewModal, setPreviewModal,
    previewToast, setPreviewToast,
    confirmarEliminar, setConfirmarEliminar,
  } = estado

  // Disparar la carga de datos cuando el panel se abre
  useEffect(() => {
    setAbierto(abierto)
  }, [abierto, setAbierto])

  // Cuando el panel se abre vía evento global (chip del dashboard, etc.), mostrar
  // la lista de activos (no el formulario de crear, que es el default del hook).
  useEffect(() => {
    const mostrarActivos = () => setTab('activos')
    window.addEventListener('flux:abrir-recordatorios', mostrarActivos)
    return () => window.removeEventListener('flux:abrir-recordatorios', mostrarActivos)
  }, [setTab])

  // Cerrar con Escape en desktop
  useEffect(() => {
    if (!abierto || esMovil) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, esMovil, onCerrar])

  const gruposActivos = useMemo(() => agruparActivos(activos), [activos])
  const cantidadHoy = gruposActivos.find((g) => g.clave === 'hoy')?.items.length ?? 0

  const contenido = (
    <div className="flex flex-col h-full min-h-0">
      <HeaderHero
        activos={activos.length}
        vencidos={vencidos}
        hoy={cantidadHoy}
        onCerrar={onCerrar}
      />

      <TabsRecordatorios
        activo={tab as ClaveTab}
        onCambiar={(t) => { if (t !== 'crear') limpiarFormulario(); setTab(t) }}
        editandoId={editandoId}
        activos={activos.length}
        completados={completados.length}
      />

      {/* Contenido del tab */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-auto-oculto">
        {tab === 'crear' && (
          <div className="px-4 py-4">
            <FormularioRecordatorio estado={estado} />
          </div>
        )}

        {tab === 'activos' && (
          <div className="px-4 py-4">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-6 border-2 border-texto-terciario/25 border-t-texto-marca rounded-full animate-spin" />
              </div>
            ) : activos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="size-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                  <AlarmClock size={28} strokeWidth={1.2} className="text-texto-terciario/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-texto-primario">Sin recordatorios activos</p>
                  <p className="text-xs text-texto-terciario mt-1">Creá uno para no olvidar lo importante</p>
                </div>
                <Boton tamano="sm" variante="secundario" onClick={() => setTab('crear')} icono={<Plus size={14} />}>
                  Crear recordatorio
                </Boton>
              </div>
            ) : (
              <ListaAgrupada
                grupos={gruposActivos}
                onToggleCompletar={toggleCompletar}
                onEliminar={intentarEliminar}
                onEditar={editarRecordatorio}
              />
            )}
          </div>
        )}

        {tab === 'completados' && (
          <div className="px-4 py-4">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-6 border-2 border-texto-terciario/25 border-t-texto-marca rounded-full animate-spin" />
              </div>
            ) : completados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="size-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                  <CheckCircle2 size={28} strokeWidth={1.2} className="text-texto-terciario/60" />
                </div>
                <p className="text-sm font-medium text-texto-primario">Sin recordatorios completados</p>
                <p className="text-xs text-texto-terciario -mt-2">Cuando marques uno como hecho, aparecerá acá</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <AnimatePresence>
                  {completados.map((r, idx) => (
                    <ItemRecordatorio
                      key={r.id}
                      recordatorio={r}
                      indice={idx}
                      onToggleCompletar={toggleCompletar}
                      onEliminar={intentarEliminar}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pie — botón crear/guardar (solo en tab crear) */}
      {tab === 'crear' && (
        <div
          className="border-t border-white/[0.07] px-4 py-3 flex items-center gap-2 shrink-0"
          style={{ paddingBottom: esMovil ? 'max(env(safe-area-inset-bottom, 0px), 12px)' : undefined }}
        >
          <button
            type="button"
            onClick={crear}
            disabled={!titulo.trim() || !fecha || creando}
            className="salix-btn-primario flex-1"
          >
            {creando && <Loader2 className="size-4 animate-spin" />}
            <span>{editandoId ? 'Guardar cambios' : 'Crear recordatorio'}</span>
          </button>
          <button
            type="button"
            onClick={() => { limpiarFormulario(); if (editandoId) setTab('activos'); else onCerrar() }}
            className="salix-btn-fantasma"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )

  // Mobile: pantalla completa (slide-up)
  if (esMovil) {
    return (
      <>
        {createPortal(
          <AnimatePresence>
            {abierto && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                className="salix-glass salix-panel fixed inset-0 z-[80] flex flex-col"
                style={{
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  height: 'calc(var(--vh, 1vh) * 100)',
                }}
              >
                {contenido}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        <PreviewRecordatorio
          previewModal={previewModal}
          onCerrarModal={() => setPreviewModal(false)}
          previewToast={previewToast}
          onCerrarToast={() => setPreviewToast(false)}
        />
        <ModalConfirmarEliminar
          recordatorio={confirmarEliminar}
          onCerrar={() => setConfirmarEliminar(null)}
          onConfirmar={eliminarDirecto}
        />
      </>
    )
  }

  // Desktop: panel lateral derecho
  return (
    <>
      {createPortal(
        <AnimatePresence>
          {abierto && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCerrar}
                className="fixed inset-0 bg-black/20 z-[68]"
              />
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="salix-glass salix-panel fixed top-0 right-0 h-full w-[460px] max-w-[92vw] z-[69] flex flex-col border-l border-white/[0.07] shadow-2xl"
              >
                {contenido}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <PreviewRecordatorio
        previewModal={previewModal}
        onCerrarModal={() => setPreviewModal(false)}
        previewToast={previewToast}
        onCerrarToast={() => setPreviewToast(false)}
      />
      <ModalConfirmarEliminar
        recordatorio={confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
        onConfirmar={eliminarDirecto}
      />
    </>
  )
}

export { PanelRecordatorios }

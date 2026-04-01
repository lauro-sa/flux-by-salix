'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlarmClock, Plus, Clock, CheckCircle2, Circle, Trash2,
  Repeat, Bell, Maximize2, Eye, CalendarDays, X,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Modal } from '@/componentes/ui/Modal'
import { SelectorRecurrencia, textoRecurrencia, RECURRENCIA_DEFAULT, type ConfigRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { sonidos } from '@/hooks/useSonido'
import { useToast } from '@/componentes/feedback/Toast'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * RecordatoriosHeader — Ícono en el header que abre un popover con mini-app de recordatorios.
 * Tabs: Crear | Activos | Completados.
 * Opciones de alerta: solo notificación en campana o también abrir modal al momento.
 * Se usa en: NotificacionesHeader.tsx (al lado de los 3 íconos de notificaciones).
 */

/* ─── Tipos ─── */

interface Recordatorio {
  id: string
  titulo: string
  descripcion?: string | null
  fecha: string
  hora?: string | null
  repetir: string
  recurrencia?: ConfigRecurrencia | null
  alerta_modal?: boolean
  completado: boolean
  completado_en?: string | null
  creado_en: string
}

/* ─── Helpers ─── */

function formatearFecha(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const mañana = new Date(hoy)
  mañana.setDate(mañana.getDate() + 1)

  if (d.getTime() === hoy.getTime()) return 'Hoy'
  if (d.getTime() === mañana.getTime()) return 'Mañana'

  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

function mañanaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

/* ─── Componente ─── */

function RecordatoriosHeader() {
  const { mostrar } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState('crear')
  const [activos, setActivos] = useState<Recordatorio[]>([])
  const [completados, setCompletados] = useState<Recordatorio[]>([])
  const [cargando, setCargando] = useState(false)

  /* Form crear */
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState<string | null>(mañanaISO())
  const [usarHora, setUsarHora] = useState(false)
  const [hora, setHora] = useState<string | null>('09:00')
  const [recurrencia, setRecurrencia] = useState<ConfigRecurrencia>(RECURRENCIA_DEFAULT)
  const [alertaModal, setAlertaModal] = useState(false)
  const [creando, setCreando] = useState(false)
  const [previewModal, setPreviewModal] = useState(false)
  const [previewToast, setPreviewToast] = useState(false)
  const [mostrarNota, setMostrarNota] = useState(false)

  /* Cargar recordatorios */
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resActivos, resCompletados] = await Promise.all([
        fetch('/api/recordatorios?estado=activos&limite=20'),
        fetch('/api/recordatorios?estado=completados&limite=20'),
      ])
      if (resActivos.ok) {
        const data = await resActivos.json()
        setActivos(data.recordatorios || [])
      }
      if (resCompletados.ok) {
        const data = await resCompletados.json()
        setCompletados(data.recordatorios || [])
      }
    } catch { mostrar('error', 'Error al procesar recordatorio') }
    setCargando(false)
  }, [])

  useEffect(() => {
    if (abierto) cargar()
  }, [abierto, cargar])

  /* Crear recordatorio */
  const crear = async () => {
    if (!titulo.trim() || !fecha) return
    setCreando(true)
    try {
      const res = await fetch('/api/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          fecha,
          hora: usarHora ? hora : null,
          repetir: recurrencia.frecuencia,
          recurrencia: recurrencia.frecuencia !== 'ninguno' ? recurrencia : null,
          alerta_modal: alertaModal,
        }),
      })
      if (res.ok) {
        setTitulo('')
        setDescripcion('')
        setFecha(mañanaISO())
        setUsarHora(false)
        setHora('09:00')
        setRecurrencia(RECURRENCIA_DEFAULT)
        setAlertaModal(false)
        setMostrarNota(false)
        setTab('activos')
        cargar()
      }
    } catch { mostrar('error', 'Error al procesar recordatorio') }
    setCreando(false)
  }

  /* Completar / descompletar */
  const toggleCompletar = async (id: string, completado: boolean) => {
    try {
      await fetch('/api/recordatorios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completado }),
      })
      cargar()
    } catch { mostrar('error', 'Error al procesar recordatorio') }
  }

  /* Eliminar — con confirmación si es recurrente */
  const [confirmarEliminar, setConfirmarEliminar] = useState<Recordatorio | null>(null)

  const intentarEliminar = (r: Recordatorio) => {
    if (r.repetir !== 'ninguno') {
      setAbierto(false)
      setTimeout(() => setConfirmarEliminar(r), 200)
    } else {
      eliminarDirecto(r.id)
    }
  }

  const eliminarDirecto = async (id: string) => {
    try {
      await fetch('/api/recordatorios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      cargar()
    } catch { mostrar('error', 'Error al procesar recordatorio') }
    setConfirmarEliminar(null)
  }

  /* Contar activos vencidos (fecha pasada) */
  const vencidos = activos.filter((r) => r.fecha < hoyISO()).length

  const contenido = (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <div className="flex items-center gap-2">
          <AlarmClock size={16} className="text-texto-terciario" />
          <h3 className="text-sm font-semibold text-texto-primario">Recordatorios</h3>
          {activos.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xxs font-bold bg-texto-marca text-white">
              {activos.length}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2 shrink-0">
        <Tabs
          tabs={[
            { clave: 'crear', etiqueta: 'Crear', icono: <Plus size={13} /> },
            { clave: 'activos', etiqueta: 'Activos', contador: activos.length, icono: <Clock size={13} /> },
            { clave: 'completados', etiqueta: 'Completados', icono: <CheckCircle2 size={13} /> },
          ]}
          activo={tab}
          onChange={setTab}
        />
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'crear' && (
          <div className="flex flex-col gap-3">
            {/* 1. Título — sin label, hero element */}
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="¿Qué necesitas recordar?"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-borde-sutil bg-superficie-app text-sm font-medium text-texto-primario placeholder:text-texto-placeholder placeholder:font-normal focus:outline-none focus:border-texto-marca transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter' && titulo.trim()) crear() }}
            />

            {/* 2. Fecha + Hora — compacto, sin labels */}
            <div className="grid grid-cols-2 gap-2">
              <SelectorFecha
                valor={fecha}
                onChange={(v) => setFecha(v || mañanaISO())}
                limpiable={false}
              />
              <div className="flex items-center gap-2">
                {usarHora ? (
                  <div className="flex-1">
                    <SelectorHora
                      valor={hora}
                      onChange={setHora}
                      pasoMinutos={15}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setUsarHora(true)}
                    className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-superficie-hover text-xs text-texto-terciario hover:text-texto-secundario cursor-pointer border-none transition-colors"
                  >
                    <Clock size={13} />
                    Todo el día
                  </button>
                )}
                {usarHora && (
                  <button
                    onClick={() => setUsarHora(false)}
                    className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors"
                    title="Cambiar a todo el día"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Repetir — Select compacto + panel expandible */}
            <SelectorRecurrencia
              valor={recurrencia}
              onChange={setRecurrencia}
              fechaReferencia={fecha}
              compacto
            />

            {/* 4. Alerta — fila inline con toggle + preview */}
            <div className="flex items-center gap-2 px-1">
              <Bell size={14} className="text-texto-terciario shrink-0" />
              <span className="text-xs text-texto-secundario flex-1">
                {alertaModal ? 'Notificación + modal' : 'Solo notificación'}
              </span>
              <Interruptor activo={alertaModal} onChange={setAlertaModal} />
              <button
                onClick={() => {
                  setAbierto(false)
                  setTimeout(() => {
                    if (alertaModal) { setPreviewModal(true) } else { setPreviewToast(true) }
                    sonidos.notificacion()
                  }, 200)
                }}
                className="shrink-0 flex items-center justify-center size-7 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors"
                title="Vista previa"
              >
                <Eye size={13} />
              </button>
            </div>

            {/* 5. + Agregar nota — colapsado */}
            <AnimatePresence>
              {!mostrarNota ? (
                <button
                  onClick={() => setMostrarNota(true)}
                  className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-secundario bg-transparent border-none cursor-pointer transition-colors px-1 py-0.5"
                >
                  <Plus size={13} />
                  Agregar nota
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                >
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={2}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-borde-sutil bg-superficie-app text-xs text-texto-primario placeholder:text-texto-placeholder resize-none focus:outline-none focus:border-texto-marca transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {tab === 'activos' && (
          <div className="flex flex-col gap-0.5">
            {cargando ? (
              <div className="flex items-center justify-center py-8">
                <div className="size-5 border-2 border-texto-terciario/30 border-t-texto-marca rounded-full animate-spin" />
              </div>
            ) : activos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-texto-terciario">
                <AlarmClock size={28} strokeWidth={1.2} className="opacity-40" />
                <p className="text-sm">Sin recordatorios activos</p>
                <Boton tamano="sm" variante="fantasma" onClick={() => setTab('crear')}>
                  <Plus size={14} />
                  Crear uno
                </Boton>
              </div>
            ) : (
              <AnimatePresence>
                {activos.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="group flex items-start gap-2.5 py-2.5 px-1 rounded-lg hover:bg-superficie-hover transition-colors"
                  >
                    <button
                      onClick={() => toggleCompletar(r.id, true)}
                      className="shrink-0 mt-0.5 bg-transparent border-none cursor-pointer text-texto-terciario hover:text-texto-marca transition-colors p-0"
                      title="Completar"
                    >
                      <Circle size={16} strokeWidth={1.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto-primario truncate">{r.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xxs ${r.fecha < hoyISO() ? 'text-insignia-peligro-texto font-semibold' : 'text-texto-terciario'}`}>
                          {formatearFecha(r.fecha)}
                        </span>
                        {r.hora && <span className="text-xxs text-texto-terciario">{r.hora}</span>}
                        {r.repetir !== 'ninguno' && (
                          <span className="text-xxs text-texto-terciario flex items-center gap-0.5" title={r.recurrencia ? textoRecurrencia(r.recurrencia!) : r.repetir}>
                            <Repeat size={10} />
                            {r.recurrencia ? textoRecurrencia(r.recurrencia!) : r.repetir}
                          </span>
                        )}
                        {r.alerta_modal && (
                          <span className="text-xxs text-texto-terciario flex items-center gap-0.5" title="Se abre modal al momento">
                            <Maximize2 size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => intentarEliminar(r)}
                      className="shrink-0 self-center opacity-0 group-hover:opacity-100 flex items-center justify-center size-7 rounded-md bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-insignia-peligro-texto transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}

        {tab === 'completados' && (
          <div className="flex flex-col gap-0.5">
            {cargando ? (
              <div className="flex items-center justify-center py-8">
                <div className="size-5 border-2 border-texto-terciario/30 border-t-texto-marca rounded-full animate-spin" />
              </div>
            ) : completados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-texto-terciario">
                <CheckCircle2 size={28} strokeWidth={1.2} className="opacity-40" />
                <p className="text-sm">Sin recordatorios completados</p>
              </div>
            ) : (
              <AnimatePresence>
                {completados.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="group flex items-start gap-2.5 py-2.5 px-1 rounded-lg hover:bg-superficie-hover transition-colors"
                  >
                    <button
                      onClick={() => toggleCompletar(r.id, false)}
                      className="shrink-0 mt-0.5 bg-transparent border-none cursor-pointer text-insignia-exito hover:text-texto-marca transition-colors p-0"
                      title="Descompletar"
                    >
                      <CheckCircle2 size={16} strokeWidth={1.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-texto-terciario line-through truncate">{r.titulo}</p>
                      <span className="text-xxs text-texto-terciario">{formatearFecha(r.fecha)}</span>
                    </div>
                    <button
                      onClick={() => intentarEliminar(r)}
                      className="shrink-0 self-center opacity-0 group-hover:opacity-100 flex items-center justify-center size-7 rounded-md bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-insignia-peligro-texto transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>

      {/* Pie — botón crear (solo en tab crear) */}
      {tab === 'crear' && (
        <div className="border-t border-borde-sutil px-4 py-3 flex items-center gap-2 shrink-0">
          <Boton
            onClick={crear}
            cargando={creando}
            disabled={!titulo.trim() || !fecha}
            tamano="sm"
          >
            Crear recordatorio
          </Boton>
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={() => { setTitulo(''); setDescripcion(''); setAbierto(false) }}
          >
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Popover
        abierto={abierto}
        onCambio={setAbierto}
        alineacion="fin"
        ancho={400}
        offset={10}
        contenido={contenido}
      >
        <button
          className="relative flex items-center justify-center size-8 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:text-texto-secundario transition-colors"
          title="Recordatorios"
        >
          <AlarmClock size={17} strokeWidth={1.75} />
          {vencidos > 0 && (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-insignia-peligro-texto" />
          )}
        </button>
      </Popover>

      {/* ── Preview: Modal de recordatorio ── */}
      <Modal
        abierto={previewModal}
        onCerrar={() => setPreviewModal(false)}
        titulo="Recordatorio"
        tamano="sm"
        acciones={
          <div className="flex items-center gap-2">
            <Boton variante="fantasma" tamano="sm" onClick={() => setPreviewModal(false)}>Descartar</Boton>
            <Boton variante="secundario" tamano="sm" onClick={() => setPreviewModal(false)}>Posponer 30 min</Boton>
            <Boton tamano="sm" onClick={() => setPreviewModal(false)}>Completar</Boton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
              <AlarmClock size={20} className="text-texto-marca" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-texto-primario">Llamar a Juan Pérez</h4>
              <p className="text-sm text-texto-terciario mt-0.5">Confirmar disponibilidad para la reunión del viernes</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-texto-secundario">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-texto-terciario" />
              <span>Hoy, 31 Mar 2026</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-texto-terciario" />
              <span>15:00</span>
            </div>
          </div>

          <div className="px-3 py-2.5 rounded-lg bg-superficie-hover text-xs text-texto-terciario italic">
            Este es un ejemplo de cómo se vería el modal cuando llegue el momento del recordatorio.
          </div>
        </div>
      </Modal>

      {/* ── Preview: Toast de notificación ── */}
      <AnimatePresence>
        {previewToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-6 z-[10000] w-[360px] border border-borde-sutil rounded-2xl shadow-elevada overflow-hidden"
            style={{ backgroundColor: 'var(--superficie-elevada)', top: 'calc(var(--header-alto) + 12px)' }}
          >
            <div className="flex items-start gap-3 p-4">
              <div className="size-9 rounded-xl bg-texto-marca/10 flex items-center justify-center shrink-0">
                <AlarmClock size={18} className="text-texto-marca" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-texto-marca">Recordatorio</span>
                  <span className="text-xxs text-texto-terciario">Ahora</span>
                </div>
                <p className="text-sm font-medium text-texto-primario mt-0.5">Llamar a Juan Pérez</p>
                <p className="text-xs text-texto-terciario mt-0.5">Confirmar disponibilidad para la reunión del viernes</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xxs text-texto-terciario">
                    <CalendarDays size={11} />
                    <span>Hoy</span>
                  </div>
                  <div className="flex items-center gap-1 text-xxs text-texto-terciario">
                    <Clock size={11} />
                    <span>15:00</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreviewToast(false)}
                className="shrink-0 flex items-center justify-center size-6 rounded-md bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex border-t border-borde-sutil">
              <button
                onClick={() => setPreviewToast(false)}
                className="flex-1 py-2.5 text-xs font-medium text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors"
              >
                Descartar
              </button>
              <div className="w-px bg-borde-sutil" />
              <button
                onClick={() => setPreviewToast(false)}
                className="flex-1 py-2.5 text-xs font-medium text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors"
              >
                Posponer
              </button>
              <div className="w-px bg-borde-sutil" />
              <button
                onClick={() => setPreviewToast(false)}
                className="flex-1 py-2.5 text-xs font-medium text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors"
              >
                Completar
              </button>
            </div>
            <div className="px-3 py-1.5 bg-superficie-hover text-center">
              <span className="text-xxs text-texto-terciario italic">Vista previa — así se vería la notificación</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal confirmación eliminar recurrente ── */}
      <Modal
        abierto={!!confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(null)}
        titulo="Eliminar recordatorio recurrente"
        tamano="sm"
        acciones={
          <div className="flex items-center gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setConfirmarEliminar(null)}>Cancelar</Boton>
            <Boton variante="peligro" tamano="sm" onClick={() => confirmarEliminar && eliminarDirecto(confirmarEliminar.id)}>Eliminar</Boton>
          </div>
        }
      >
        {confirmarEliminar && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-texto-primario">
              Vas a eliminar <strong>{confirmarEliminar.titulo}</strong> que se repite{' '}
              <strong>
                {confirmarEliminar.recurrencia
                  ? textoRecurrencia(confirmarEliminar.recurrencia!).toLowerCase()
                  : confirmarEliminar.repetir}
              </strong>.
            </p>
            <p className="text-sm text-texto-terciario">
              Se eliminará este recordatorio y no volverá a aparecer. Esta acción no se puede deshacer.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}

export { RecordatoriosHeader }

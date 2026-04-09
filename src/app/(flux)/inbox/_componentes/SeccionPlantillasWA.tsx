'use client'

/**
 * SeccionPlantillasWA — Sección de configuración para gestionar plantillas de WhatsApp (Meta Business).
 * Lista plantillas locales, permite CRUD, sincronizar con Meta, y filtrar por estado/categoría.
 * Se usa en: inbox/configuracion (pestaña plantillas_wa).
 */

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { Input } from '@/componentes/ui/Input'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useToast } from '@/componentes/feedback/Toast'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import {
  Plus, Trash2, Pencil, RefreshCw, Loader2, FileText,
  Search, CheckCircle2, Clock, XCircle, AlertTriangle, Ban, Pause, Save,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ModalEditorPlantillaWA } from './ModalEditorPlantillaWA'
import type { PlantillaWhatsApp, EstadoMeta, CanalInbox } from '@/tipos/inbox'

/** Etiquetas legibles de módulos */
const ETIQUETA_MODULO: Record<string, string> = {
  inbox: 'Inbox',
  presupuestos: 'Presupuestos',
  contactos: 'Contactos',
  ordenes: 'Órdenes',
  actividades: 'Actividades',
}

// ─── Constantes ───

const FILTROS_ESTADO: { valor: EstadoMeta | 'TODOS'; etiqueta: string; color: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todas', color: 'neutro' },
  { valor: 'BORRADOR', etiqueta: 'Borradores', color: 'neutro' },
  { valor: 'PENDING', etiqueta: 'En revisión', color: 'advertencia' },
  { valor: 'APPROVED', etiqueta: 'Aprobadas', color: 'exito' },
  { valor: 'REJECTED', etiqueta: 'Rechazadas', color: 'peligro' },
  { valor: 'ERROR', etiqueta: 'Error', color: 'peligro' },
]

const ICONO_ESTADO: Record<EstadoMeta, typeof CheckCircle2> = {
  BORRADOR: Save,
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  DISABLED: Ban,
  PAUSED: Pause,
  ERROR: AlertTriangle,
}

const COLOR_ESTADO: Record<EstadoMeta, string> = {
  BORRADOR: 'neutro',
  PENDING: 'advertencia',
  APPROVED: 'exito',
  REJECTED: 'peligro',
  DISABLED: 'peligro',
  PAUSED: 'advertencia',
  ERROR: 'peligro',
}

const ETIQUETA_ESTADO: Record<EstadoMeta, string> = {
  BORRADOR: 'Borrador',
  PENDING: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  DISABLED: 'Deshabilitada',
  PAUSED: 'Pausada',
  ERROR: 'Error',
}

// ─── Props ───

interface Props {
  canalesWhatsApp: CanalInbox[]
  onRecargar: () => void
}

// ─── Componente ───

export function SeccionPlantillasWA({ canalesWhatsApp, onRecargar }: Props) {
  const { mostrar } = useToast()
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoMeta | 'TODOS'>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [canalSeleccionado, setCanalSeleccionado] = useState<string>('')

  // Modal editor
  const [modalAbierto, setModalAbierto] = useState(false)
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaWhatsApp | null>(null)

  // Modal confirmación eliminar
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<PlantillaWhatsApp | null>(null)

  // Auto-seleccionar primer canal
  useEffect(() => {
    if (canalesWhatsApp.length > 0 && !canalSeleccionado) {
      setCanalSeleccionado(canalesWhatsApp[0].id)
    }
  }, [canalesWhatsApp])

  // Cargar plantillas
  const cargar = useCallback(async () => {
    if (!canalSeleccionado) return
    setCargando(true)
    try {
      const res = await fetch(`/api/inbox/whatsapp/plantillas?canal_id=${canalSeleccionado}`)
      const data = await res.json()
      setPlantillas(data.plantillas || [])
    } catch {
      setPlantillas([])
    } finally {
      setCargando(false)
    }
  }, [canalSeleccionado])

  useEffect(() => { cargar() }, [cargar])

  // Sincronizar con Meta
  const sincronizar = useCallback(async () => {
    if (!canalSeleccionado) return
    setSincronizando(true)
    try {
      const res = await fetch('/api/inbox/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'sincronizar', canal_id: canalSeleccionado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      mostrar('exito', `Sincronizado: ${data.sincronizadas} actualizadas, ${data.creadas} nuevas (${data.total_meta} en Meta)`)
      cargar()
    } catch (err) {
      mostrar('error', `Error al sincronizar: ${(err as Error).message}`)
    } finally {
      setSincronizando(false)
    }
  }, [canalSeleccionado, cargar])

  // Eliminar
  const eliminar = useCallback(async (plantilla: PlantillaWhatsApp) => {
    setEliminandoId(plantilla.id)
    try {
      const res = await fetch('/api/inbox/whatsapp/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'eliminar', id: plantilla.id, canal_id: canalSeleccionado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      mostrar('exito', 'Plantilla eliminada')
      cargar()
    } catch (err) {
      mostrar('error', (err as Error).message)
    } finally {
      setEliminandoId(null)
      setConfirmEliminar(null)
    }
  }, [canalSeleccionado, cargar])

  // Filtrar plantillas
  const plantillasFiltradas = plantillas.filter(p => {
    if (filtroEstado !== 'TODOS' && p.estado_meta !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !p.nombre_api.toLowerCase().includes(q)) return false
    }
    return true
  })

  // ─── Sin canales ───

  if (canalesWhatsApp.length === 0) {
    return (
      <EstadoVacio
        icono={<IconoWhatsApp size={32} />}
        titulo="Sin cuenta de WhatsApp"
        descripcion="Configurá una cuenta de WhatsApp Business primero para gestionar plantillas."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Plantillas de WhatsApp
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
            Gestioná las plantillas aprobadas por Meta para iniciar conversaciones o enviar notificaciones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Boton
            variante="secundario"
            tamano="sm"
            icono={sincronizando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            onClick={sincronizar}
            disabled={sincronizando}
          >
            Sincronizar con Meta
          </Boton>
          <Boton
            variante="primario"
            tamano="sm"
            icono={<Plus size={14} />}
            onClick={() => { setPlantillaEditando(null); setModalAbierto(true) }}
          >
            Nueva plantilla
          </Boton>
        </div>
      </div>

      {/* Selector de canal (si hay más de 1) */}
      {canalesWhatsApp.length > 1 && (
        <Select
          etiqueta="Cuenta de WhatsApp"
          valor={canalSeleccionado}
          opciones={canalesWhatsApp.map(c => ({ valor: c.id, etiqueta: c.nombre }))}
          onChange={setCanalSeleccionado}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Pills de estado */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTROS_ESTADO.map(f => (
            <button
              key={f.valor}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filtroEstado === f.valor
                  ? 'ring-1 ring-[var(--texto-marca)] bg-[var(--superficie-hover)]'
                  : 'hover:bg-[var(--superficie-hover)]'
              }`}
              style={{ color: filtroEstado === f.valor ? 'var(--texto-marca)' : 'var(--texto-secundario)' }}
              onClick={() => setFiltroEstado(f.valor)}
            >
              {f.etiqueta}
              {f.valor !== 'TODOS' && (
                <span className="ml-1 opacity-60">
                  {plantillas.filter(p => p.estado_meta === f.valor).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="sm:ml-auto w-full sm:w-56">
          <Input
            value={busqueda}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
            placeholder="Buscar plantilla..."
            icono={<Search size={14} />}
          />
        </div>
      </div>

      {/* Lista */}
      {cargando ? (
        <CargadorSeccion />
      ) : plantillasFiltradas.length === 0 ? (
        <EstadoVacio
          icono={<FileText />}
          titulo={busqueda || filtroEstado !== 'TODOS' ? 'Sin resultados' : 'Sin plantillas'}
          descripcion={
            busqueda || filtroEstado !== 'TODOS'
              ? 'Probá ajustando los filtros.'
              : 'Creá tu primera plantilla o sincronizá las existentes desde Meta.'
          }
        />
      ) : (
        <div className="space-y-2">
          {plantillasFiltradas.map((p) => {
            const IconoEst = ICONO_ESTADO[p.estado_meta]
            const colorEst = COLOR_ESTADO[p.estado_meta]
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3.5 rounded-lg transition-colors hover:bg-[var(--superficie-hover)] cursor-pointer"
                style={{ border: '1px solid var(--borde-sutil)' }}
                onClick={() => { setPlantillaEditando(p); setModalAbierto(true) }}
              >
                <div className="flex-shrink-0">
                  <IconoEst size={16} style={{ color: `var(--insignia-${colorEst === 'neutro' ? 'info' : colorEst})` }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                      {p.nombre}
                    </p>
                    <Insignia color={colorEst as 'exito' | 'peligro' | 'advertencia' | 'neutro'} tamano="sm">
                      {ETIQUETA_ESTADO[p.estado_meta]}
                    </Insignia>
                    <Insignia color="primario" tamano="sm">{p.categoria}</Insignia>
                    <Insignia color="neutro" tamano="sm">{IDIOMAS_MAPA[p.idioma] || p.idioma}</Insignia>
                  </div>
                  <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--texto-terciario)' }}>
                    {p.nombre_api}
                  </p>
                  {p.componentes?.cuerpo?.texto && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--texto-secundario)' }}>
                      {p.componentes.cuerpo.texto.substring(0, 120)}
                    </p>
                  )}
                  {p.error_meta && (
                    <p className="text-xs mt-1" style={{ color: 'var(--insignia-peligro)' }}>
                      {p.error_meta}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Disponible en:</span>
                    {p.modulos && p.modulos.length > 0 ? (
                      p.modulos.map(m => (
                        <span
                          key={m}
                          className="text-xxs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)',
                            color: 'var(--texto-marca)',
                          }}
                        >
                          {ETIQUETA_MODULO[m] || m}
                        </span>
                      ))
                    ) : (
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Todos los módulos</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Boton
                    variante="fantasma" tamano="xs" soloIcono titulo="Editar"
                    icono={<Pencil size={12} />}
                    onClick={() => { setPlantillaEditando(p); setModalAbierto(true) }}
                  />
                  <Boton
                    variante="peligro" tamano="xs" soloIcono titulo="Eliminar"
                    icono={eliminandoId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    onClick={() => setConfirmEliminar(p)}
                    disabled={eliminandoId === p.id}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal editor */}
      <ModalEditorPlantillaWA
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setPlantillaEditando(null) }}
        plantilla={plantillaEditando}
        canalId={canalSeleccionado}
        onGuardado={() => { cargar(); onRecargar() }}
      />

      {/* Modal confirmación eliminar */}
      <ModalConfirmacion
        abierto={!!confirmEliminar}
        onCerrar={() => setConfirmEliminar(null)}
        onConfirmar={() => { if (confirmEliminar) eliminar(confirmEliminar) }}
        titulo="Eliminar plantilla"
        descripcion={
          confirmEliminar && !['BORRADOR', 'ERROR'].includes(confirmEliminar.estado_meta)
            ? `Esta plantilla también se eliminará de Meta. ¿Estás seguro de eliminar "${confirmEliminar.nombre}"?`
            : `¿Estás seguro de eliminar "${confirmEliminar?.nombre}"?`
        }
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
      />
    </div>
  )
}

// ─── Mapa de idiomas para display ───

const IDIOMAS_MAPA: Record<string, string> = {
  es: 'ES',
  es_AR: 'ES-AR',
  es_MX: 'ES-MX',
  en: 'EN',
  en_US: 'EN-US',
  pt_BR: 'PT-BR',
  fr: 'FR',
  it: 'IT',
  de: 'DE',
}

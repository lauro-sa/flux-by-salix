'use client'

/**
 * SeccionPlantillasWA — Plantillas de WhatsApp usando ListaConfiguracion unificada.
 * Lista plantillas locales, permite CRUD, sincronizar con Meta, y filtrar por estado.
 */

import { useState, useEffect, useCallback } from 'react'
import { Select } from '@/componentes/ui/Select'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useToast } from '@/componentes/feedback/Toast'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import {
  Plus, RefreshCw, Loader2, FileText,
  CheckCircle2, Clock, XCircle, AlertTriangle, Ban, Pause, Save,
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

const FILTROS_ESTADO: { valor: EstadoMeta | 'TODOS'; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todas' },
  { valor: 'BORRADOR', etiqueta: 'Borradores' },
  { valor: 'PENDING', etiqueta: 'En revisión' },
  { valor: 'APPROVED', etiqueta: 'Aprobadas' },
  { valor: 'REJECTED', etiqueta: 'Rechazadas' },
  { valor: 'ERROR', etiqueta: 'Error' },
]

const ICONO_ESTADO: Record<EstadoMeta, typeof CheckCircle2> = {
  BORRADOR: Save, PENDING: Clock, APPROVED: CheckCircle2,
  REJECTED: XCircle, DISABLED: Ban, PAUSED: Pause, ERROR: AlertTriangle,
}

const COLOR_ESTADO: Record<EstadoMeta, string> = {
  BORRADOR: 'neutro', PENDING: 'advertencia', APPROVED: 'exito',
  REJECTED: 'peligro', DISABLED: 'peligro', PAUSED: 'advertencia', ERROR: 'peligro',
}

const ETIQUETA_ESTADO: Record<EstadoMeta, string> = {
  BORRADOR: 'Borrador', PENDING: 'En revisión', APPROVED: 'Aprobada',
  REJECTED: 'Rechazada', DISABLED: 'Deshabilitada', PAUSED: 'Pausada', ERROR: 'Error',
}

const IDIOMAS_MAPA: Record<string, string> = {
  es: 'ES', es_AR: 'ES-AR', es_MX: 'ES-MX', en: 'EN', en_US: 'EN-US',
  pt_BR: 'PT-BR', fr: 'FR', it: 'IT', de: 'DE',
}

interface Props {
  canalesWhatsApp: CanalInbox[]
  onRecargar: () => void
}

export function SeccionPlantillasWA({ canalesWhatsApp, onRecargar }: Props) {
  const { mostrar } = useToast()
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([])

  const [filtroEstado, setFiltroEstado] = useState<EstadoMeta | 'TODOS'>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [canalSeleccionado, setCanalSeleccionado] = useState<string>('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaWhatsApp | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<PlantillaWhatsApp | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  useEffect(() => {
    if (canalesWhatsApp.length > 0 && !canalSeleccionado) {
      setCanalSeleccionado(canalesWhatsApp[0].id)
    }
  }, [canalesWhatsApp])

  const cargar = useCallback(async () => {
    if (!canalSeleccionado) return
    setCargando(true)
    try {
      const res = await fetch(`/api/inbox/whatsapp/plantillas?canal_id=${canalSeleccionado}`)
      const data = await res.json()
      setPlantillas(data.plantillas || [])
    } catch { setPlantillas([]) }
    finally { setCargando(false) }
  }, [canalSeleccionado])

  useEffect(() => { cargar() }, [cargar])

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
      mostrar('exito', `Sincronizado: ${data.sincronizadas} actualizadas, ${data.creadas} nuevas`)
      cargar()
    } catch (err) {
      mostrar('error', `Error al sincronizar: ${(err as Error).message}`)
    } finally { setSincronizando(false) }
  }, [canalSeleccionado, cargar])

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
    } catch (err) { mostrar('error', (err as Error).message) }
    finally { setEliminandoId(null); setConfirmEliminar(null) }
  }, [canalSeleccionado, cargar])

  // Filtrar
  const plantillasFiltradas = plantillas.filter(p => {
    if (filtroEstado !== 'TODOS' && p.estado_meta !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !p.nombre_api.toLowerCase().includes(q)) return false
    }
    return true
  })

  if (canalesWhatsApp.length === 0) {
    return (
      <EstadoVacio
        icono={<IconoWhatsApp size={32} />}
        titulo="Sin cuenta de WhatsApp"
        descripcion="Configurá una cuenta de WhatsApp Business primero para gestionar plantillas."
      />
    )
  }

  if (cargando) return <CargadorSeccion />

  // ─── Mapear PlantillaWhatsApp → ItemLista ──────────────────────────
  const itemsLista: ItemLista[] = plantillasFiltradas.map(p => {
    const IconoEst = ICONO_ESTADO[p.estado_meta]
    const colorBadge = COLOR_ESTADO[p.estado_meta]

    const badges: ItemLista['badges'] = [
      { texto: ETIQUETA_ESTADO[p.estado_meta], color: colorBadge as 'exito' | 'peligro' | 'advertencia' | 'neutro' },
      { texto: p.categoria, color: 'primario' },
      { texto: IDIOMAS_MAPA[p.idioma] || p.idioma, color: 'neutro' },
    ]

    const tags: ItemLista['tags'] = []
    if (p.modulos && p.modulos.length > 0) {
      p.modulos.forEach(m => tags.push({ texto: ETIQUETA_MODULO[m] || m }))
    }

    return {
      id: p.id,
      nombre: p.nombre,
      subtitulo: p.nombre_api,
      preview: p.componentes?.cuerpo?.texto?.substring(0, 120),
      icono: <IconoEst size={16} />,
      color: `var(--insignia-${colorBadge === 'neutro' ? 'info' : colorBadge})`,
      badges,
      tags: tags.length > 0 ? tags : undefined,
    }
  })

  return (
    <div className="space-y-4">
      {/* Selector de canal (si hay más de 1) */}
      {canalesWhatsApp.length > 1 && (
        <Select
          etiqueta="Cuenta de WhatsApp"
          valor={canalSeleccionado}
          opciones={canalesWhatsApp.map(c => ({ valor: c.id, etiqueta: c.nombre }))}
          onChange={setCanalSeleccionado}
        />
      )}

      <ListaConfiguracion
        titulo="Plantillas de WhatsApp"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
        controles="editar-borrar"
        ordenable
        acciones={[
          {
            tipo: 'fantasma',
            icono: <Plus size={16} />,
            soloIcono: true,
            titulo: 'Nueva plantilla',
            onClick: () => { setPlantillaEditando(null); setModalAbierto(true) },
          },
        ]}
        filtros={FILTROS_ESTADO.map(f => ({
          clave: f.valor,
          etiqueta: f.etiqueta,
          contador: f.valor === 'TODOS' ? undefined : plantillas.filter(p => p.estado_meta === f.valor).length,
        }))}
        filtroActivo={filtroEstado}
        onCambioFiltro={(clave) => setFiltroEstado(clave as EstadoMeta | 'TODOS')}
        buscador
        placeholderBuscador="Buscar plantilla..."
        textoBuscador={busqueda}
        onBuscar={setBusqueda}
        onEditar={(item) => {
          const p = plantillas.find(pl => pl.id === item.id)
          if (p) { setPlantillaEditando(p); setModalAbierto(true) }
        }}
        onEliminar={(item) => {
          const p = plantillas.find(pl => pl.id === item.id)
          if (p) setConfirmEliminar(p)
        }}
        restaurable
        onRestaurar={sincronizar}
        textoRestablecer={sincronizando ? 'Sincronizando...' : 'Sincronizar con Meta'}
        iconoRestablecer={sincronizando ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
      />

      {/* Modal editor */}
      <ModalEditorPlantillaWA
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setPlantillaEditando(null) }}
        plantilla={plantillaEditando}
        canalId={canalSeleccionado}
        onGuardado={() => { cargar(); onRecargar() }}
      />

      {/* Confirmar eliminar */}
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

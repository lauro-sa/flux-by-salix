'use client'

/**
 * Listado de tipos de actividad — pantalla completa.
 * Usa PlantillaListado + TablaDinamica + drag-and-drop para reordenar.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  Plus, Tag, Trash2, RotateCcw, Calendar, Type, Zap, Eye, EyeOff,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import type { TipoActividad } from '../_tipos'

const I = 13

export default function PaginaListadoTiposActividad() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()

  useEffect(() => {
    setMigajaDinamica('/actividades/configuracion/tipos', 'Tipos de actividad')
  }, [setMigajaDinamica])

  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<TipoActividad | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [restableciendo, setRestableciendo] = useState(false)

  const [filtroActivo, setFiltroActivo] = useState<string>('')
  const [filtroOrigen, setFiltroOrigen] = useState<string>('')
  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1, [filtroActivo, filtroOrigen])

  // ─── Cargar ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/actividades/config')
      const data = await res.json()
      setTipos(data.tipos || [])
    } catch {
      mostrar('error', 'Error al cargar tipos')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Acciones ───
  const ejecutarAccion = async (accion: string, datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, datos }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Error')
    }
    return res.json()
  }

  const handleToggleActivo = async (t: TipoActividad) => {
    const nuevoEstado = !t.activo
    setTipos(prev => prev.map(x => x.id === t.id ? { ...x, activo: nuevoEstado } : x))
    try {
      await ejecutarAccion('editar_tipo', { id: t.id, activo: nuevoEstado })
    } catch {
      mostrar('error', 'Error al cambiar estado')
      cargar()
    }
  }

  const handleEliminar = async (t: TipoActividad) => {
    setEliminando(true)
    try {
      await ejecutarAccion('eliminar_tipo', { id: t.id })
      mostrar('exito', 'Tipo eliminado')
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const handleRestablecer = async () => {
    setRestableciendo(true)
    try {
      await ejecutarAccion('restablecer', {})
      mostrar('exito', 'Tipos restablecidos')
      cargar()
    } catch {
      mostrar('error', 'Error al restablecer')
    } finally {
      setRestableciendo(false)
      setConfirmarRestablecer(false)
    }
  }

  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(tipos.map(t => [t.id, t]))
    const nuevos: TipoActividad[] = []
    idsOrdenados.forEach((id, i) => {
      const t = mapa.get(id)
      if (t) nuevos.push({ ...t, orden: i })
    })
    setTipos(nuevos)
    try {
      await ejecutarAccion('reordenar_tipos', { orden: idsOrdenados })
    } catch {
      mostrar('error', 'Error al reordenar')
      cargar()
    }
  }

  // ─── Filtrado ───
  const tiposFiltrados = tipos.filter(t => {
    if (busquedaDebounced) {
      const q = busquedaDebounced.toLowerCase()
      if (!t.etiqueta.toLowerCase().includes(q) && !t.clave.toLowerCase().includes(q)) return false
    }
    if (filtroActivo === 'activo' && !t.activo) return false
    if (filtroActivo === 'inactivo' && t.activo) return false
    if (filtroOrigen === 'sistema' && !t.es_sistema) return false
    if (filtroOrigen === 'predefinido' && !t.es_predefinido) return false
    if (filtroOrigen === 'personalizado' && (t.es_sistema || t.es_predefinido)) return false
    return true
  })

  // ─── Columnas ───
  const columnas: ColumnaDinamica<TipoActividad>[] = [
    {
      clave: 'etiqueta', etiqueta: 'Tipo', ancho: 260, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      render: (t) => {
        const Icono = obtenerIcono(t.icono)
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-8 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${t.color}20`, color: t.color }}
            >
              {Icono ? <Icono size={15} /> : null}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-texto-primario truncate">{t.etiqueta}</div>
              {t.abreviacion && (
                <div className="text-[11px] font-mono text-texto-terciario tracking-wider">{t.abreviacion}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'modulos', etiqueta: 'Disponible en', ancho: 200, grupo: 'Clasificación', icono: <Tag size={I} />,
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {(t.modulos_disponibles || []).slice(0, 3).map(m => (
            <span key={m} className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
              {m}
            </span>
          ))}
          {(t.modulos_disponibles || []).length > 3 && (
            <span className="text-[11px] text-texto-terciario">+{t.modulos_disponibles.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      clave: 'dias_vencimiento', etiqueta: 'Vencimiento', ancho: 110, ordenable: true, grupo: 'Comportamiento', icono: <Calendar size={I} />,
      render: (t) => (
        <span className="text-xs text-texto-secundario">
          {t.dias_vencimiento === 0 ? 'Sin plazo' : `${t.dias_vencimiento} día${t.dias_vencimiento !== 1 ? 's' : ''}`}
        </span>
      ),
    },
    {
      clave: 'origen', etiqueta: 'Origen', ancho: 120, grupo: 'Clasificación',
      render: (t) => (
        <Insignia color={t.es_sistema ? 'neutro' : t.es_predefinido ? 'info' : 'primario'} tamano="sm">
          {t.es_sistema ? 'Sistema' : t.es_predefinido ? 'Predefinido' : 'Personalizado'}
        </Insignia>
      ),
    },
    {
      clave: 'activo', etiqueta: 'Activo', ancho: 90, grupo: 'Estado',
      render: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Interruptor activo={t.activo} onChange={() => handleToggleActivo(t)} />
        </div>
      ),
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 50, grupo: 'Metadata',
      render: (t) => (!t.es_sistema && !t.es_predefinido) ? (
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<Trash2 size={13} />}
          titulo="Eliminar"
          onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(t) }}
          className="text-insignia-peligro"
        />
      ) : null,
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Tipos de actividad"
        icono={<Zap size={20} />}
        accionPrincipal={{
          etiqueta: 'Nuevo tipo',
          icono: <Plus size={14} />,
          onClick: () => router.push('/actividades/configuracion/tipos/nueva'),
        }}
        acciones={[
          {
            id: 'restablecer',
            etiqueta: 'Restablecer predefinidos',
            icono: <RotateCcw size={14} />,
            onClick: () => setConfirmarRestablecer(true),
          },
        ]}
      >
        <TablaDinamica
          columnas={columnas}
          datos={tiposFiltrados}
          claveFila={(t) => t.id}
          totalRegistros={tiposFiltrados.length}
          registrosPorPagina={25}
          vistas={['lista']}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o clave..."
          filtros={[
            {
              id: 'activo', etiqueta: 'Estado', tipo: 'pills' as const,
              valor: filtroActivo, onChange: (v) => setFiltroActivo(v as string),
              opciones: [
                { valor: 'activo', etiqueta: 'Activos' },
                { valor: 'inactivo', etiqueta: 'Inactivos' },
              ],
            },
            {
              id: 'origen', etiqueta: 'Origen', tipo: 'pills' as const,
              valor: filtroOrigen, onChange: (v) => setFiltroOrigen(v as string),
              opciones: [
                { valor: 'sistema', etiqueta: 'Sistema' },
                { valor: 'predefinido', etiqueta: 'Predefinido' },
                { valor: 'personalizado', etiqueta: 'Personalizado' },
              ],
            },
          ]}
          onLimpiarFiltros={() => { setFiltroActivo(''); setFiltroOrigen('') }}
          onClickFila={(t) => {
            if (t.es_sistema) {
              mostrar('info', 'Los tipos de sistema no se pueden editar')
              return
            }
            router.push(`/actividades/configuracion/tipos/${t.id}`)
          }}
          idModulo="tipos_actividad"
          filasReordenables
          onReordenarFilas={handleReordenar}
          estadoVacio={
            <EstadoVacio
              icono={<Zap size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin tipos'}
              descripcion={cargando ? '' : 'Creá tu primer tipo de actividad o restablecé los predefinidos.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/actividades/configuracion/tipos/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nuevo tipo
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar tipo"
        descripcion={`Se eliminará "${confirmarEliminar?.etiqueta}". Las actividades existentes no se verán afectadas.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer tipos"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Las actividades existentes no se verán afectadas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={restableciendo}
        onConfirmar={handleRestablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </>
  )
}

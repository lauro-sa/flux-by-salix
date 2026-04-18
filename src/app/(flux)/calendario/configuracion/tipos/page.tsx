'use client'

/**
 * Listado de tipos de evento del calendario — pantalla completa.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { Plus, Calendar, Trash2, RotateCcw, Type, Clock } from 'lucide-react'
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
import type { TipoEventoCalendario } from '../_tipos'

const I = 13

export default function PaginaListadoTiposEvento() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()

  useEffect(() => {
    setMigajaDinamica('/calendario/configuracion/tipos', 'Tipos de evento')
  }, [setMigajaDinamica])

  const [tipos, setTipos] = useState<TipoEventoCalendario[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<TipoEventoCalendario | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [restableciendo, setRestableciendo] = useState(false)

  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/calendario/config')
      const data = await res.json()
      setTipos(data.tipos || [])
    } catch {
      mostrar('error', 'Error al cargar tipos')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  const ejecutarAccion = async (accion: string, datos: Record<string, unknown>) => {
    const res = await fetch('/api/calendario/config', {
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

  const handleToggleActivo = async (t: TipoEventoCalendario) => {
    setTipos(prev => prev.map(x => x.id === t.id ? { ...x, activo: !x.activo } : x))
    try {
      await ejecutarAccion('editar_tipo', { id: t.id, activo: !t.activo })
    } catch {
      mostrar('error', 'Error al cambiar estado')
      cargar()
    }
  }

  const handleEliminar = async (t: TipoEventoCalendario) => {
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

  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(tipos.map(t => [t.id, t]))
    const nuevos: TipoEventoCalendario[] = []
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

  const tiposFiltrados = tipos.filter(t => {
    if (!busquedaDebounced) return true
    return t.etiqueta.toLowerCase().includes(busquedaDebounced.toLowerCase())
  })

  const columnas: ColumnaDinamica<TipoEventoCalendario>[] = [
    {
      clave: 'etiqueta', etiqueta: 'Tipo', ancho: 240, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
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
            <div className="text-sm font-medium text-texto-primario truncate">{t.etiqueta}</div>
          </div>
        )
      },
    },
    {
      clave: 'duracion', etiqueta: 'Duración', ancho: 140, grupo: 'Comportamiento', icono: <Clock size={I} />,
      render: (t) => (
        <span className="text-xs text-texto-secundario">
          {t.todo_el_dia_default
            ? 'Todo el día'
            : t.duracion_default >= 60
              ? `${t.duracion_default / 60}h`
              : `${t.duracion_default} min`}
        </span>
      ),
    },
    {
      clave: 'origen', etiqueta: 'Origen', ancho: 120, grupo: 'Clasificación',
      render: (t) => (
        <Insignia color={t.es_predefinido ? 'info' : 'primario'} tamano="sm">
          {t.es_predefinido ? 'Predefinido' : 'Personalizado'}
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
      render: (t) => !t.es_predefinido ? (
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
        titulo="Tipos de evento"
        icono={<Calendar size={20} />}
        accionPrincipal={{
          etiqueta: 'Nuevo tipo',
          icono: <Plus size={14} />,
          onClick: () => router.push('/calendario/configuracion/tipos/nueva'),
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
          placeholder="Buscar por nombre..."
          onClickFila={(t) => router.push(`/calendario/configuracion/tipos/${t.id}`)}
          idModulo="tipos_evento"
          filasReordenables
          onReordenarFilas={handleReordenar}
          estadoVacio={
            <EstadoVacio
              icono={<Calendar size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin tipos'}
              descripcion={cargando ? '' : 'Creá tu primer tipo de evento o restablecé los predefinidos.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/calendario/configuracion/tipos/nueva')}>
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
        descripcion={`Se eliminará "${confirmarEliminar?.etiqueta}". Los eventos existentes no se verán afectados.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer tipos"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Los eventos existentes no se verán afectados."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={restableciendo}
        onConfirmar={handleRestablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </>
  )
}

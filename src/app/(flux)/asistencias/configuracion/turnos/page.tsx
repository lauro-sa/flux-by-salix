'use client'

/**
 * Listado de turnos laborales — pantalla completa.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  Plus, Clock, Trash2, Type, Calendar, Users,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { normalizarBusqueda } from '@/lib/validaciones'
import type { TurnoLaboral, DiasConfig } from '@/componentes/entidad/_editor_turno_laboral/PaginaEditorTurnoLaboral'

const I = 13

interface Sector {
  id: string
  nombre: string
  turno_id: string | null
}

export default function PaginaListadoTurnos() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()

  useEffect(() => {
    setMigajaDinamica('/asistencias/configuracion/turnos', 'Turnos laborales')
  }, [setMigajaDinamica])

  const [turnos, setTurnos] = useState<TurnoLaboral[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<TurnoLaboral | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1)

  // ─── Cargar ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resT, resC] = await Promise.all([
        fetch('/api/asistencias/turnos'),
        fetch('/api/asistencias/config'),
      ])
      const [dataT, dataC] = await Promise.all([resT.json(), resC.json()])
      setTurnos(dataT.turnos || [])
      setSectores(dataC.sectores || [])
    } catch {
      mostrar('error', 'Error al cargar turnos')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Acciones ───
  const handleEliminar = async (t: TurnoLaboral) => {
    setEliminando(true)
    try {
      await fetch('/api/asistencias/turnos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      mostrar('exito', 'Turno eliminado')
      cargar()
    } catch {
      mostrar('error', 'Error al eliminar')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    // Actualización optimista
    const mapa = new Map(turnos.map(t => [t.id, t]))
    const nuevos: TurnoLaboral[] = []
    idsOrdenados.forEach((id, i) => {
      const t = mapa.get(id)
      if (t) nuevos.push({ ...t, orden: i } as TurnoLaboral)
    })
    setTurnos(nuevos)
    try {
      await fetch('/api/asistencias/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'reordenar',
          ordenes: idsOrdenados.map((id, i) => ({ id, orden: i })),
        }),
      })
    } catch {
      mostrar('error', 'Error al reordenar')
      cargar()
    }
  }

  // ─── Filtrado (solo turnos personalizados, el default viene de config empresa) ───
  const turnosFiltrados = turnos
    .filter(t => !t.es_default)
    .filter(t => {
      if (!busquedaDebounced) return true
      return normalizarBusqueda(t.nombre).includes(normalizarBusqueda(busquedaDebounced))
    })

  // ─── Resumen de horario ───
  const resumirHorario = (dias: DiasConfig): string => {
    const diasActivos = (['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const)
      .filter(d => dias[d]?.activo)
    if (diasActivos.length === 0) return 'Sin días activos'
    const primero = dias[diasActivos[0]]
    const etiquetas: Record<string, string> = {
      lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
      viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
    }
    return `${diasActivos.map(d => etiquetas[d]).join(', ')} · ${primero.desde} a ${primero.hasta}`
  }

  // ─── Columnas ───
  const columnas: ColumnaDinamica<TurnoLaboral>[] = [
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 220, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      render: (t) => (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-8 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--insignia-info-fondo)', color: 'var(--insignia-info-texto)' }}
          >
            <Clock size={15} />
          </div>
          <div className="text-sm font-medium text-texto-primario truncate">{t.nombre}</div>
        </div>
      ),
    },
    {
      clave: 'horario', etiqueta: 'Horario', ancho: 260, grupo: 'Identidad', icono: <Calendar size={I} />,
      render: (t) => (
        <span className="text-sm text-texto-secundario">{resumirHorario(t.dias)}</span>
      ),
    },
    {
      clave: 'flexible', etiqueta: 'Tipo', ancho: 130, grupo: 'Comportamiento',
      render: (t) => (
        <Insignia color={t.flexible ? 'info' : 'neutro'} tamano="sm">
          {t.flexible ? 'Flexible' : `${t.tolerancia_min} min tolerancia`}
        </Insignia>
      ),
    },
    {
      clave: 'sectores', etiqueta: 'Sectores', ancho: 160, grupo: 'Comportamiento', icono: <Users size={I} />,
      render: (t) => {
        const cant = sectores.filter(s => s.turno_id === t.id).length
        return (
          <span className="text-xs text-texto-terciario">
            {cant === 0 ? 'Ninguno' : cant === 1 ? '1 sector' : `${cant} sectores`}
          </span>
        )
      },
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 50, grupo: 'Metadata',
      render: (t) => (
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<Trash2 size={13} />}
          titulo="Eliminar"
          onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(t) }}
          className="text-insignia-peligro"
        />
      ),
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Turnos laborales"
        icono={<Clock size={20} />}
        accionPrincipal={{
          etiqueta: 'Nuevo turno',
          icono: <Plus size={14} />,
          onClick: () => router.push('/asistencias/configuracion/turnos/nueva'),
        }}
      >
        <TablaDinamica
          columnas={columnas}
          datos={turnosFiltrados}
          claveFila={(t) => t.id}
          totalRegistros={turnosFiltrados.length}
          registrosPorPagina={25}
          vistas={['lista']}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre..."
          onClickFila={(t) => router.push(`/asistencias/configuracion/turnos/${t.id}`)}
          idModulo="turnos_laborales"
          filasReordenables
          onReordenarFilas={handleReordenar}
          opcionesOrden={[
            { etiqueta: 'Nombre A→Z', clave: 'nombre', direccion: 'asc' },
            { etiqueta: 'Nombre Z→A', clave: 'nombre', direccion: 'desc' },
          ]}
          estadoVacio={
            <EstadoVacio
              icono={<Clock size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin turnos personalizados'}
              descripcion={cargando ? '' : 'Todos tus empleados usan el horario predeterminado de la empresa. Creá un turno personalizado para sectores con horarios diferentes.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/asistencias/configuracion/turnos/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nuevo turno
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar turno"
        descripcion={`Se eliminará "${confirmarEliminar?.nombre}". Los empleados con este turno volverán al predeterminado.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />
    </>
  )
}

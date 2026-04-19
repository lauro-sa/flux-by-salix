'use client'

/**
 * Listado de condiciones de pago — pantalla completa.
 * Las condiciones viven en presupuestos_config.condiciones_pago (array JSON),
 * no tienen tabla propia ni auditoría individual.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  Plus, Clock, Trash2, RotateCcw, Star, Calendar, Tag, Type,
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
import { normalizarBusqueda } from '@/lib/validaciones'
import type { CondicionPago } from '@/tipos/presupuesto'

const I = 13

export default function PaginaListadoCondicionesPago() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()

  useEffect(() => {
    setMigajaDinamica('/presupuestos/configuracion/condiciones-pago', 'Condiciones de pago')
  }, [setMigajaDinamica])

  const [condiciones, setCondiciones] = useState<CondicionPago[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<CondicionPago | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const { busqueda, setBusqueda, busquedaDebounced } = useBusquedaDebounce('', 1, [filtroTipo])

  // ─── Cargar ───
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/presupuestos/config')
      const data = await res.json()
      setCondiciones((data.condiciones_pago as CondicionPago[]) || [])
    } catch {
      mostrar('error', 'Error al cargar condiciones')
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  // ─── Persistir array completo en config ───
  const guardarArray = async (nuevas: CondicionPago[]) => {
    try {
      await fetch('/api/presupuestos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condiciones_pago: nuevas }),
      })
      setCondiciones(nuevas)
    } catch {
      mostrar('error', 'Error al guardar')
    }
  }

  // ─── Acciones por fila ───
  const handleToggleActivo = (c: CondicionPago) => {
    guardarArray(condiciones.map(x => x.id === c.id ? { ...x, activo: !(x.activo !== false) } : x))
  }

  const handleMarcarPredeterminada = (c: CondicionPago) => {
    guardarArray(condiciones.map(x => ({ ...x, predeterminado: x.id === c.id })))
  }

  const handleEliminar = async (c: CondicionPago) => {
    setEliminando(true)
    try {
      await guardarArray(condiciones.filter(x => x.id !== c.id))
      mostrar('exito', 'Condición eliminada')
    } finally {
      setEliminando(false)
      setConfirmarEliminar(null)
    }
  }

  const eliminarLote = async (ids: Set<string>) => {
    const nuevas = condiciones.filter(c => !ids.has(c.id))
    await guardarArray(nuevas)
    mostrar('exito', `${ids.size} condición(es) eliminada(s)`)
  }

  // ─── Reordenar (drag-and-drop) ───
  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(condiciones.map(c => [c.id, c]))
    const nuevas = idsOrdenados
      .map(id => mapa.get(id))
      .filter((c): c is CondicionPago => c !== undefined)
    await guardarArray(nuevas)
  }

  // ─── Filtrado ───
  const condicionesFiltradas = condiciones.filter(c => {
    if (busquedaDebounced) {
      const q = normalizarBusqueda(busquedaDebounced)
      if (!normalizarBusqueda(c.label).includes(q) && !normalizarBusqueda(c.notaPlanPago || '').includes(q)) return false
    }
    if (filtroTipo && c.tipo !== filtroTipo) return false
    return true
  })

  // ─── Columnas ───
  const columnas: ColumnaDinamica<CondicionPago>[] = [
    {
      clave: 'label', etiqueta: 'Nombre', ancho: 220, ordenable: true, grupo: 'Identidad', icono: <Type size={I} />,
      render: (c) => (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: c.tipo === 'hitos' ? 'var(--insignia-violeta-fondo)' : 'var(--insignia-neutro-fondo)',
              color: c.tipo === 'hitos' ? 'var(--insignia-violeta-texto)' : 'var(--insignia-neutro-texto)',
            }}
          >
            <Clock size={13} />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium text-texto-primario truncate">{c.label}</span>
            {c.predeterminado && <Star size={11} className="text-texto-marca fill-current shrink-0" />}
          </div>
        </div>
      ),
    },
    {
      clave: 'tipo', etiqueta: 'Tipo', ancho: 110, grupo: 'Clasificación', icono: <Tag size={I} />,
      render: (c) => (
        <Insignia color={c.tipo === 'hitos' ? 'violeta' : 'neutro'} tamano="sm">
          {c.tipo === 'hitos' ? 'Hitos' : 'Plazo fijo'}
        </Insignia>
      ),
    },
    {
      clave: 'detalle', etiqueta: 'Detalle', ancho: 280, grupo: 'Identidad', icono: <Calendar size={I} />,
      render: (c) => {
        if (c.tipo === 'plazo_fijo') {
          return (
            <span className="text-sm text-texto-secundario">
              {c.diasVencimiento === 0 ? 'Contado' : `${c.diasVencimiento} días`}
            </span>
          )
        }
        const detalle = (c.hitos || []).map(h => `${h.porcentaje}% ${h.descripcion}`).join(' + ')
        return (
          <span
            className="text-sm text-texto-secundario block whitespace-normal leading-tight"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {detalle}
          </span>
        )
      },
    },
    {
      clave: 'activo', etiqueta: 'Activa', ancho: 90, grupo: 'Estado',
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Interruptor
            activo={c.activo !== false}
            onChange={() => handleToggleActivo(c)}
          />
        </div>
      ),
    },
    {
      clave: 'predeterminado', etiqueta: 'Predeterminada', ancho: 130, grupo: 'Estado',
      render: (c) => c.predeterminado
        ? (
          <span className="inline-flex items-center gap-1 text-xxs text-texto-marca">
            <Star size={11} className="fill-current" />
            Sí
          </span>
        )
        : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMarcarPredeterminada(c) }}
            className="text-xxs text-texto-terciario hover:text-texto-marca transition-colors cursor-pointer bg-transparent border-none"
          >
            Marcar
          </button>
        ),
    },
    {
      clave: 'acciones', etiqueta: '', ancho: 50, grupo: 'Metadata',
      render: (c) => (
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<Trash2 size={13} />}
          titulo="Eliminar"
          onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(c) }}
          className="text-insignia-peligro"
        />
      ),
    },
  ]

  return (
    <>
      <PlantillaListado
        titulo="Condiciones de pago"
        icono={<Clock size={20} />}
        accionPrincipal={{
          etiqueta: 'Nueva condición',
          icono: <Plus size={14} />,
          onClick: () => router.push('/presupuestos/configuracion/condiciones-pago/nueva'),
        }}
        acciones={[
          {
            id: 'restablecer',
            etiqueta: 'Restablecer predeterminadas',
            icono: <RotateCcw size={14} />,
            onClick: async () => {
              mostrar('info', 'Usar la opción "Restablecer" de la config general de presupuestos')
            },
          },
        ]}
      >
        <TablaDinamica
          columnas={columnas}
          datos={condicionesFiltradas}
          claveFila={(c) => c.id}
          totalRegistros={condicionesFiltradas.length}
          registrosPorPagina={25}
          vistas={['lista']}
          seleccionables
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre o nota..."
          filtros={[
            {
              id: 'tipo', etiqueta: 'Tipo', tipo: 'pills' as const,
              valor: filtroTipo, onChange: (v) => setFiltroTipo(v as string),
              opciones: [
                { valor: 'plazo_fijo', etiqueta: 'Plazo fijo' },
                { valor: 'hitos', etiqueta: 'Por hitos' },
              ],
            },
          ]}
          onLimpiarFiltros={() => { setFiltroTipo('') }}
          onClickFila={(c) => router.push(`/presupuestos/configuracion/condiciones-pago/${c.id}`)}
          accionesLote={[
            {
              id: 'eliminar',
              etiqueta: 'Eliminar',
              icono: <Trash2 size={14} />,
              onClick: eliminarLote,
              peligro: true,
              atajo: 'Supr',
              grupo: 'peligro' as const,
            },
          ]}
          idModulo="condiciones_pago"
          filasReordenables
          onReordenarFilas={handleReordenar}
          opcionesOrden={[
            { etiqueta: 'Nombre A→Z', clave: 'label', direccion: 'asc' },
            { etiqueta: 'Nombre Z→A', clave: 'label', direccion: 'desc' },
          ]}
          estadoVacio={
            <EstadoVacio
              icono={<Clock size={52} strokeWidth={1} />}
              titulo={cargando ? 'Cargando...' : 'Sin condiciones'}
              descripcion={cargando ? '' : 'Creá tu primera condición de pago para usar al armar presupuestos.'}
              accion={!cargando
                ? (
                  <Boton onClick={() => router.push('/presupuestos/configuracion/condiciones-pago/nueva')}>
                    <Plus size={14} className="mr-1.5" />
                    Nueva condición
                  </Boton>
                )
                : null}
            />
          }
        />
      </PlantillaListado>

      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar condición"
        descripcion={`¿Estás seguro de eliminar "${confirmarEliminar?.label}"?`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        cargando={eliminando}
        onConfirmar={() => { if (confirmarEliminar) handleEliminar(confirmarEliminar) }}
        onCerrar={() => setConfirmarEliminar(null)}
      />
    </>
  )
}

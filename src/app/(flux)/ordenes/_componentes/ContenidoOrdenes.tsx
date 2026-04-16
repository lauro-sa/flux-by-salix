'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Wrench, Hammer, Trash2 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
// Insignia no se usa — los badges de estado/prioridad se renderizan con <span> y clases dinámicas
import { useToast } from '@/componentes/feedback/Toast'
import {
  ETIQUETAS_ESTADO_OT, COLORES_ESTADO_OT, ETIQUETAS_PRIORIDAD_OT, COLORES_PRIORIDAD_OT,
  type EstadoOrdenTrabajo, type PrioridadOrdenTrabajo,
} from '@/tipos/orden-trabajo'

/**
 * ContenidoOrdenes — Listado interactivo de órdenes de trabajo.
 * Reutiliza PlantillaListado + TablaDinamica con datos reales desde la API.
 */

interface FilaOrden {
  id: string
  numero: string
  estado: EstadoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  titulo: string
  descripcion: string | null
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  contacto_direccion: string | null
  presupuesto_id: string | null
  presupuesto_numero: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  fecha_fin_real: string | null
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

const POR_PAGINA = 50

export default function ContenidoOrdenes() {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { mostrar: mostrarToast } = useToast()

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') || '')
  const [filtroPrioridad, setFiltroPrioridad] = useState(searchParams.get('prioridad') || '')

  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce(
    searchParams.get('q') || '',
    Number(searchParams.get('pagina')) || 1,
    [filtroEstado, filtroPrioridad],
    true,
  )

  // Sincronizar filtros → URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (busquedaDebounced) params.set('q', busquedaDebounced)
    if (filtroEstado) params.set('estado', filtroEstado)
    if (filtroPrioridad) params.set('prioridad', filtroPrioridad)
    if (pagina > 1) params.set('pagina', String(pagina))
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }, [busquedaDebounced, filtroEstado, filtroPrioridad, pagina, pathname])

  const { datos: ordenes, total, cargando, cargandoInicial } = useListado<FilaOrden>({
    clave: 'ordenes',
    url: '/api/ordenes',
    parametros: {
      busqueda: busquedaDebounced,
      estado: filtroEstado || undefined,
      prioridad: filtroPrioridad || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.ordenes || []) as FilaOrden[],
    extraerTotal: (json) => (json.total || 0) as number,
  })

  // Enviar a papelera en lote
  const enviarAPapeleraLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/ordenes/${id}`, { method: 'DELETE' })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['ordenes'] })
      mostrarToast('exito', `${ids.size} orden${ids.size !== 1 ? 'es' : ''} enviada${ids.size !== 1 ? 's' : ''} a papelera`)
    } catch {
      mostrarToast('error', 'Error al enviar a papelera')
    }
  }, [mostrarToast, queryClient])

  // ── Columnas ──

  const columnas: ColumnaDinamica<FilaOrden>[] = [
    {
      clave: 'numero',
      etiqueta: t('ordenes.numero'),
      ancho: 120,
      ordenable: true,
      render: (fila) => (
        <span className="font-medium text-texto-primario">{fila.numero}</span>
      ),
    },
    {
      clave: 'titulo',
      etiqueta: t('ordenes.titulo_campo'),
      ancho: 250,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-primario line-clamp-2 whitespace-normal leading-snug">{fila.titulo}</span>
      ),
    },
    {
      clave: 'contacto_nombre',
      etiqueta: t('ordenes.cliente'),
      ancho: 180,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-secundario">{fila.contacto_nombre || '—'}</span>
      ),
    },
    {
      clave: 'estado',
      etiqueta: t('comun.estado'),
      ancho: 130,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETAS_ESTADO_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => {
        const colores = COLORES_ESTADO_OT[fila.estado]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colores.fondo} ${colores.texto}`}>
            {ETIQUETAS_ESTADO_OT[fila.estado]}
          </span>
        )
      },
    },
    {
      clave: 'prioridad',
      etiqueta: 'Prioridad',
      ancho: 110,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETAS_PRIORIDAD_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => {
        const colores = COLORES_PRIORIDAD_OT[fila.prioridad]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colores.fondo} ${colores.texto}`}>
            {ETIQUETAS_PRIORIDAD_OT[fila.prioridad]}
          </span>
        )
      },
    },
    {
      clave: 'presupuesto_numero',
      etiqueta: t('ordenes.presupuesto_origen'),
      ancho: 130,
      render: (fila) => fila.presupuesto_numero ? (
        <span className="text-texto-terciario">{fila.presupuesto_numero}</span>
      ) : <span className="text-texto-terciario">—</span>,
    },
    {
      clave: 'asignado_nombre',
      etiqueta: t('ordenes.asignado'),
      ancho: 160,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-secundario">{fila.asignado_nombre || '—'}</span>
      ),
    },
    {
      clave: 'creado_en',
      etiqueta: t('ordenes.fecha'),
      ancho: 130,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-terciario text-xs">
          {formato.fecha(fila.creado_en, { corta: true })}
        </span>
      ),
    },
  ]

  // ── Render tarjeta ──

  const renderTarjeta = (fila: FilaOrden) => {
    const coloresEstado = COLORES_ESTADO_OT[fila.estado]
    const coloresPrioridad = COLORES_PRIORIDAD_OT[fila.prioridad]
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-texto-primario text-sm">{fila.numero}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coloresEstado.fondo} ${coloresEstado.texto}`}>
            {ETIQUETAS_ESTADO_OT[fila.estado]}
          </span>
        </div>
        <p className="text-sm text-texto-primario truncate">{fila.titulo}</p>
        {fila.contacto_nombre && (
          <p className="text-xs text-texto-terciario">{fila.contacto_nombre}</p>
        )}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coloresPrioridad.fondo} ${coloresPrioridad.texto}`}>
            {ETIQUETAS_PRIORIDAD_OT[fila.prioridad]}
          </span>
          {fila.asignado_nombre && (
            <span className="text-xs text-texto-terciario">{fila.asignado_nombre}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <PlantillaListado
      titulo={t('ordenes.titulo')}
      icono={<Wrench size={20} />}
      accionPrincipal={
        tienePermiso('ordenes_trabajo', 'crear')
          ? { etiqueta: t('ordenes.nueva'), icono: <PlusCircle size={14} />, onClick: () => router.push('/ordenes/nuevo') }
          : undefined
      }
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/ordenes/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        datos={ordenes}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas']}
        renderTarjeta={renderTarjeta}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por número, título o cliente..."
        idModulo="ordenes"
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        accionesLote={[
          {
            id: 'eliminar',
            etiqueta: 'Enviar a papelera',
            icono: <Trash2 size={14} />,
            onClick: enviarAPapeleraLote,
            peligro: true,
          },
        ]}
        onClickFila={(fila) => router.push(`/ordenes/${fila.id}`)}
        estadoVacio={
          <EstadoVacio
            icono={<Hammer size={52} strokeWidth={1} />}
            titulo={t('ordenes.sin_ordenes')}
            descripcion={t('ordenes.sin_ordenes_desc')}
            accion={
              tienePermiso('ordenes_trabajo', 'crear') ? (
                <Boton onClick={() => router.push('/ordenes/nuevo')}>Crear primera orden</Boton>
              ) : undefined
            }
          />
        }
      />
    </PlantillaListado>
  )
}

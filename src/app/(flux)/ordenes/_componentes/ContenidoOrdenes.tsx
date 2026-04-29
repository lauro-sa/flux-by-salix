'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useFiltrosUrl } from '@/hooks/useFiltrosUrl'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Wrench, Hammer, Trash2, MapPin, User, FileText, CalendarClock, Bell } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { PieAccionesTarjeta, type AccionTarjeta } from '@/componentes/tablas/PieAccionesTarjeta'
import { LineaInfoTarjeta } from '@/componentes/tablas/LineaInfoTarjeta'
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
  contacto_whatsapp: string | null
  contacto_direccion: string | null
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_telefono: string | null
  presupuesto_id: string | null
  presupuesto_numero: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  publicada: boolean
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
  return (
    <GuardPagina modulo="ordenes_trabajo">
      <ContenidoOrdenesInterno />
    </GuardPagina>
  )
}

function ContenidoOrdenesInterno() {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { mostrar: mostrarToast } = useToast()

  // Filtros con sync bidireccional URL ↔ estado (ver useFiltrosUrl).
  // Mantiene los filtros al volver de un detalle por migajas o botón atrás.
  const filtros = useFiltrosUrl({
    pathname: '/ordenes',
    campos: {
      estado: { defecto: [] as string[] },
      prioridad: { defecto: [] as string[] },
      tipo_contacto: { defecto: [] as string[] },
      asignado_a: { defecto: [] as string[] },
      sin_asignar: { defecto: false },
      creado_por: { defecto: '' },
      con_presupuesto: { defecto: '' },
      vencida: { defecto: '' },
      publicada: { defecto: '' },
      fecha: { defecto: '' },
      anio: { defecto: '' },
    },
    busqueda: { claveUrl: 'q' },
    pagina: { defecto: 1 },
  })

  // Aliases para compatibilidad con el resto del componente.
  const f = filtros.valores
  const filtroEstado = f.estado
  const filtroPrioridad = f.prioridad
  const filtroTipoContacto = f.tipo_contacto
  const filtroAsignados = f.asignado_a
  const filtroSinAsignar = f.sin_asignar
  const filtroCreadoPor = f.creado_por
  const filtroConPresupuesto = f.con_presupuesto
  const filtroVencida = f.vencida
  const filtroPublicada = f.publicada
  const filtroFecha = f.fecha
  const filtroAnio = f.anio
  const setFiltroEstado = (v: string[]) => filtros.set('estado', v)
  const setFiltroPrioridad = (v: string[]) => filtros.set('prioridad', v)
  const setFiltroTipoContacto = (v: string[]) => filtros.set('tipo_contacto', v)
  const setFiltroAsignados = (v: string[]) => filtros.set('asignado_a', v)
  const setFiltroSinAsignar = (v: boolean) => filtros.set('sin_asignar', v)
  const setFiltroCreadoPor = (v: string) => filtros.set('creado_por', v)
  const setFiltroConPresupuesto = (v: string) => filtros.set('con_presupuesto', v)
  const setFiltroVencida = (v: string) => filtros.set('vencida', v)
  const setFiltroPublicada = (v: string) => filtros.set('publicada', v)
  const setFiltroFecha = (v: string) => filtros.set('fecha', v)
  const setFiltroAnio = (v: string) => filtros.set('anio', v)
  const busqueda = filtros.busquedaInput
  const setBusqueda = filtros.setBusquedaInput
  const busquedaDebounced = filtros.busquedaActiva
  const pagina = filtros.pagina
  const setPagina = filtros.setPagina

  const { datos: ordenes, total, cargando, cargandoInicial } = useListado<FilaOrden>({
    clave: 'ordenes',
    url: '/api/ordenes',
    parametros: {
      busqueda: busquedaDebounced,
      estado: filtroEstado.length > 0 ? filtroEstado.join(',') : undefined,
      prioridad: filtroPrioridad.length > 0 ? filtroPrioridad.join(',') : undefined,
      tipo_contacto: filtroTipoContacto.length > 0 ? filtroTipoContacto.join(',') : undefined,
      asignado_a: filtroAsignados.length > 0 ? filtroAsignados.join(',') : undefined,
      sin_asignar: filtroSinAsignar ? 'true' : undefined,
      creado_por: filtroCreadoPor || undefined,
      con_presupuesto: filtroConPresupuesto || undefined,
      vencida: filtroVencida || undefined,
      publicada: filtroPublicada || undefined,
      fecha: filtroFecha || undefined,
      anio: filtroAnio || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.ordenes || []) as FilaOrden[],
    extraerTotal: (json) => (json.total || 0) as number,
  })

  // ── Cargar opciones para los filtros ──

  /** Tipos de contacto para el filtro "Tipo de cliente" */
  const { data: tiposContactoData } = useQuery({
    queryKey: ['ordenes-filtros-tipos-contacto'],
    queryFn: () => fetch('/api/contactos/tipos').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesTiposContacto = useMemo(() => {
    const items = (tiposContactoData?.tipos_contacto || []) as { clave: string; etiqueta: string }[]
    return items.map(t => ({ valor: t.clave, etiqueta: t.etiqueta }))
  }, [tiposContactoData])

  /** Miembros para "Asignado" y "Creado por" */
  const { data: miembrosData } = useQuery({
    queryKey: ['miembros-empresa'],
    queryFn: () => fetch('/api/miembros').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesMiembros = useMemo(() => {
    const items = (miembrosData?.miembros || []) as { usuario_id: string; nombre: string | null; apellido: string | null }[]
    return items.map(m => ({
      valor: m.usuario_id,
      etiqueta: `${m.nombre || ''} ${m.apellido || ''}`.trim() || 'Sin nombre',
    }))
  }, [miembrosData])

  /** Años disponibles — los últimos 6 años */
  const opcionesAnios = useMemo(() => {
    const actual = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => {
      const a = actual - i
      return { valor: String(a), etiqueta: String(a) }
    })
  }, [])

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

  // Avisar llegada al cliente desde la tarjeta. Replica la misma lógica del
  // botón "Avisar llegada" del detalle de la OT (VistaOrdenTrabajo.tsx):
  // si la OT tiene "dirigido a" (atención) priorizamos esa persona — es el
  // contacto específico para coordinar la llegada al lugar; si no, caemos al
  // contacto principal (whatsapp > teléfono).
  const avisarLlegada = useCallback((fila: FilaOrden) => {
    const tieneAtencion = !!fila.atencion_nombre && !!fila.atencion_telefono
    const nombreAviso = tieneAtencion ? fila.atencion_nombre! : (fila.contacto_nombre || '')
    const telAviso = tieneAtencion
      ? fila.atencion_telefono!
      : (fila.contacto_whatsapp || fila.contacto_telefono || '')

    const numero = telAviso.replace(/[^+\d]/g, '')
    if (!numero) {
      mostrarToast('error', 'No hay teléfono/WhatsApp cargado para avisar')
      return
    }
    const direccion = fila.contacto_direccion || ''
    const mensaje = encodeURIComponent(
      `Hola${nombreAviso ? ` ${nombreAviso}` : ''}, le avisamos que estamos llegando${direccion ? ` a ${direccion}` : ''} para realizar el trabajo de la OT #${fila.numero}.`
    )
    window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank')
    mostrarToast('exito', `Aviso de llegada enviado${nombreAviso ? ` a ${nombreAviso}` : ''}`)
  }, [mostrarToast])

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
      clave: 'publicada',
      etiqueta: 'Publicada',
      ancho: 110,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'true', etiqueta: 'Publicadas' },
        { valor: 'false', etiqueta: 'Sin publicar' },
      ],
      render: (fila) => {
        // Estados terminales: la publicación ya fue consumida, se muestra apagada
        const terminada = fila.estado === 'completada' || fila.estado === 'cancelada'
        if (!fila.publicada) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-naranja-fondo text-insignia-naranja-texto">Sin publicar</span>
        }
        if (terminada) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-superficie-hover/60 text-texto-terciario">Publicada</span>
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-exito-fondo text-insignia-exito-texto">Publicada</span>
      },
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

    // Datos para el footer mobile: avisar llegada (WhatsApp pre-armado al
    // cliente o al "dirigido a") e ir al destino (Google Maps con direcciones).
    // Priorizamos el teléfono de atención > whatsapp > teléfono principal —
    // misma resolución que hace `avisarLlegada` para no mostrar el botón
    // habilitado y después fallar con un toast.
    const telParaAvisar = fila.atencion_telefono
      || fila.contacto_whatsapp
      || fila.contacto_telefono
      || ''
    const numeroAviso = telParaAvisar.replace(/[^\d]/g, '')
    const urlMapa = fila.contacto_direccion
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fila.contacto_direccion)}&travelmode=driving`
      : null

    const fechaFin = fila.fecha_fin_estimada
    const vencida = !!fechaFin && new Date(fechaFin) < new Date() && fila.estado !== 'completada'

    return (
      <div className="flex flex-col">
        <div className="p-4 flex flex-col gap-3">
          {/* Cabecera: número OT + estado.
              pr-7 reserva espacio para el checkbox absolute de la tabla. */}
          <div className="flex items-start justify-between gap-2 pr-7">
            <span className="font-mono text-sm font-bold text-texto-primario">{fila.numero}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${coloresEstado.fondo} ${coloresEstado.texto}`}>
              {ETIQUETAS_ESTADO_OT[fila.estado]}
            </span>
          </div>

          {/* Título de la OT (sin truncar, en 1 col mobile entra) + presupuesto
              vinculado como subtítulo si existe. */}
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-texto-primario leading-snug">
              {fila.titulo}
            </p>
            {fila.presupuesto_numero && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <FileText size={11} className="shrink-0 text-texto-terciario/70" />
                {fila.presupuesto_numero}
              </p>
            )}
          </div>

          {/* Píldora de prioridad (alta/media/baja con su color semántico).
              Las medias no son ruido — son la mayoría — pero igual la mostramos
              porque el contexto es operativo (saber qué priorizar). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coloresPrioridad.fondo} ${coloresPrioridad.texto}`}>
              {ETIQUETAS_PRIORIDAD_OT[fila.prioridad]}
            </span>
          </div>

          {/* Meta: contacto + dirección + asignado + fecha estimada de fin.
              Mismo patrón ícono+texto que el resto de los listados. */}
          {(fila.contacto_nombre || fila.contacto_direccion || fila.asignado_nombre || fechaFin) && (
            <div className="border-t border-borde-sutil pt-3 flex flex-col gap-2">
              {fila.contacto_nombre && (
                <LineaInfoTarjeta icono={<User size={13} />} truncar>
                  {fila.contacto_nombre}
                </LineaInfoTarjeta>
              )}
              {fila.contacto_direccion && (
                <LineaInfoTarjeta icono={<MapPin size={13} />} alineacion="start">
                  {urlMapa ? (
                    <a
                      href={urlMapa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-texto-marca transition-colors underline decoration-borde-sutil decoration-dotted underline-offset-2"
                    >
                      {fila.contacto_direccion}
                    </a>
                  ) : fila.contacto_direccion}
                </LineaInfoTarjeta>
              )}
              {fila.asignado_nombre && (
                <LineaInfoTarjeta icono={<Hammer size={13} />} truncar>
                  {fila.asignado_nombre}
                </LineaInfoTarjeta>
              )}
              {fechaFin && (
                <span className="flex items-center gap-2.5 text-xs">
                  <CalendarClock size={13} className={`shrink-0 ${vencida ? 'text-insignia-peligro-texto' : 'text-texto-terciario/70'}`} />
                  <span className={vencida ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}>
                    {formato.fecha(fechaFin, { corta: true })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer mobile: 2 acciones de campo — avisar al cliente que se está
            llegando (WhatsApp con mensaje pre-armado) e ir al destino (abre
            Google Maps con direcciones). */}
        <div className="sm:hidden">
          <PieAccionesTarjeta acciones={[
            {
              id: 'avisar',
              icono: <Bell size={16} className="shrink-0" />,
              etiqueta: 'Avisar llegada',
              onClick: () => avisarLlegada(fila),
              deshabilitado: !numeroAviso,
            },
            {
              id: 'navegar',
              icono: <MapPin size={16} className="shrink-0" />,
              etiqueta: 'Navegar',
              href: urlMapa || undefined,
              target: '_blank',
              deshabilitado: !urlMapa,
            },
          ] satisfies AccionTarjeta[]} />
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
        gridTarjetas="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por número, título, cliente, dirección..."
        idModulo="ordenes"
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        filtros={[
          // ── Identidad ──
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstado,
            onChange: (v) => setFiltroEstado(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: Object.entries(ETIQUETAS_ESTADO_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
            descripcion: 'Filtrá por uno o más estados de la orden de trabajo.',
          },
          {
            id: 'prioridad', etiqueta: 'Prioridad', tipo: 'multiple-compacto' as const,
            valor: filtroPrioridad,
            onChange: (v) => setFiltroPrioridad(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: Object.entries(ETIQUETAS_PRIORIDAD_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
            descripcion: 'Nivel de prioridad asignado a la orden.',
          },
          {
            id: 'tipo_contacto', etiqueta: 'Tipo de cliente', tipo: 'multiple-compacto' as const,
            valor: filtroTipoContacto,
            onChange: (v) => setFiltroTipoContacto(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesTiposContacto,
            descripcion: 'Órdenes según el tipo del contacto vinculado (persona, empresa, edificio, etc.).',
          },
          // ── Asignación ──
          {
            id: 'asignado_a', etiqueta: 'Asignado a', tipo: 'multiple-compacto' as const,
            valor: filtroAsignados,
            onChange: (v) => setFiltroAsignados(Array.isArray(v) ? v : []),
            opciones: opcionesMiembros,
            descripcion: 'Órdenes asignadas a uno o más miembros (cumple si al menos uno coincide).',
          },
          {
            id: 'sin_asignar', etiqueta: 'Sin asignar', tipo: 'pills' as const,
            valor: filtroSinAsignar ? 'true' : '',
            onChange: (v) => setFiltroSinAsignar(v === 'true'),
            opciones: [{ valor: 'true', etiqueta: 'Sí' }],
            descripcion: 'Órdenes que no tienen ningún miembro asignado todavía.',
          },
          {
            id: 'creado_por', etiqueta: 'Creado por', tipo: 'seleccion-compacto' as const,
            valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
            opciones: opcionesMiembros,
            descripcion: 'Mostrá solo las órdenes creadas por el miembro elegido.',
          },
          // ── Comercial ──
          {
            id: 'con_presupuesto', etiqueta: 'Con presupuesto', tipo: 'pills' as const,
            valor: filtroConPresupuesto, onChange: (v) => setFiltroConPresupuesto(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Órdenes generadas a partir de un presupuesto vs creadas manualmente.',
          },
          {
            id: 'vencida', etiqueta: 'Vencida', tipo: 'pills' as const,
            valor: filtroVencida, onChange: (v) => setFiltroVencida(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Órdenes con fecha estimada de fin pasada y aún no completadas ni canceladas.',
          },
          {
            id: 'publicada', etiqueta: 'Publicada', tipo: 'pills' as const,
            valor: filtroPublicada, onChange: (v) => setFiltroPublicada(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No (borrador)' },
            ],
            descripcion: 'Órdenes ya publicadas (visibles para los asignados) vs borradores internos.',
          },
          // ── Período ──
          {
            id: 'fecha', etiqueta: 'Fecha programada', tipo: 'pills' as const,
            valor: filtroFecha, onChange: (v) => setFiltroFecha(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: 'semana', etiqueta: 'Esta semana' },
              { valor: 'vencidas', etiqueta: 'Vencidas' },
              { valor: 'futuras', etiqueta: 'Futuras' },
            ],
            descripcion: 'Filtrá por proximidad de la fecha de inicio o vencimiento.',
          },
          {
            id: 'anio', etiqueta: 'Año', tipo: 'seleccion-compacto' as const,
            valor: filtroAnio, onChange: (v) => setFiltroAnio(v as string),
            opciones: opcionesAnios,
            descripcion: 'Órdenes creadas durante el año seleccionado.',
          },
        ]}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['estado', 'prioridad', 'tipo_contacto'] },
          { id: 'asignacion', etiqueta: 'Asignación', filtros: ['asignado_a', 'sin_asignar', 'creado_por'] },
          { id: 'comercial', etiqueta: 'Comercial', filtros: ['con_presupuesto', 'vencida', 'publicada'] },
          { id: 'periodo', etiqueta: 'Período', filtros: ['fecha', 'anio'] },
        ]}
        onLimpiarFiltros={filtros.limpiar}
        opcionesOrden={[
          { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
          { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
          { etiqueta: 'N° ↑', clave: 'numero', direccion: 'asc' },
          { etiqueta: 'N° ↓', clave: 'numero', direccion: 'desc' },
          { etiqueta: 'Cliente A-Z', clave: 'contacto_nombre', direccion: 'asc' },
          { etiqueta: 'Cliente Z-A', clave: 'contacto_nombre', direccion: 'desc' },
          { etiqueta: 'Próximas a vencer', clave: 'fecha_fin_estimada', direccion: 'asc' },
          { etiqueta: 'Recién iniciadas', clave: 'fecha_inicio', direccion: 'desc' },
        ]}
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

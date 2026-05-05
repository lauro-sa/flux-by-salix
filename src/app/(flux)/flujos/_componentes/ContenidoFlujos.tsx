'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Workflow, Filter, Activity, Tag, Copy, Play, Pause, Trash2 } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useRol } from '@/hooks/useRol'
import { useFiltrosUrl } from '@/hooks/useFiltrosUrl'
import { useListado } from '@/hooks/useListado'
import { useFormato } from '@/hooks/useFormato'
import { useToast } from '@/componentes/feedback/Toast'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { FiltroTabla, GrupoFiltros } from '@/componentes/tablas/tipos-tabla'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Modal } from '@/componentes/ui/Modal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { LineaInfoTarjeta } from '@/componentes/tablas/LineaInfoTarjeta'
import { PieAccionesTarjeta, type AccionTarjeta } from '@/componentes/tablas/PieAccionesTarjeta'
import {
  ENTIDADES_CON_ESTADO,
  ETIQUETAS_ENTIDAD,
} from '@/tipos/estados'
import {
  TIPOS_DISPARADOR,
  type EstadoFlujo,
  type TipoDisparador,
} from '@/tipos/workflow'
import {
  etiquetaDisparador,
} from '@/lib/workflows/etiquetas-disparador'
import type { PlantillaSugerida } from '@/lib/workflows/plantillas-sugeridas'
import { iconoLucide } from './iconos-plantilla'
import EstadoVacioFlujos from './EstadoVacioFlujos'
import ModalNuevoFlujo from './ModalNuevoFlujo'
import { MenuFilaFlujo } from './MenuFilaFlujo'

/**
 * ContenidoFlujos — Listado central /flujos.
 *
 * Sub-PR 19.1 del módulo Flujos. Pantalla equivalente a /contactos pero
 * para flujos: tabla densa con columnas (estado, nombre, módulo,
 * disparador, última ejecución, ejecuciones 30d, acciones), filtros
 * agrupados (Identidad / Comportamiento / Actividad), modal "+ Nuevo
 * flujo" con dos pestañas, y estado vacío educativo con plantillas
 * sugeridas filtradas por módulos instalados.
 *
 * Las acciones de fila (Editar / Duplicar / Activar/Pausar / Eliminar)
 * se exponen vía el menú "tres puntos" `MenuFilaFlujo`. Los permisos UI
 * se evalúan por fila con `useRol.tienePermiso`. Las transiciones
 * (activar/pausar) y el delete-with-history conviven con los endpoints
 * del PR 18.x sin modificarlos.
 *
 * Diseño visual: PlantillaListado (header con acción principal) +
 * TablaDinamica (toolbar + tabla + paginador) — mismo patrón que
 * /contactos, /actividades, /productos.
 */

// =============================================================
// Tipo de fila — exactamente lo que devuelve GET /api/flujos
// =============================================================

interface FilaFlujo {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string | null
  estado: EstadoFlujo
  activo: boolean
  disparador: { tipo?: TipoDisparador; configuracion?: { entidad_tipo?: string } } | null
  condiciones: unknown
  acciones: unknown
  borrador_jsonb: unknown | null
  ultima_ejecucion_tiempo: string | null
  icono: string | null
  color: string | null
  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
  ultima_ejecucion_en: string | null
  total_ejecuciones_30d: number
}

const POR_PAGINA = 50

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoFlujos({ datosInicialesJson }: Props) {
  return (
    <GuardPagina modulo="flujos">
      <ContenidoFlujosInterno datosInicialesJson={datosInicialesJson} />
    </GuardPagina>
  )
}

function ContenidoFlujosInterno({ datosInicialesJson }: Props) {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { mostrar: mostrarToast } = useToast()

  // Permisos por acción (calculamos una vez para uso UI)
  const puedeCrear = tienePermiso('flujos', 'crear')
  const puedeEditar = tienePermiso('flujos', 'editar')
  const puedeEliminar = tienePermiso('flujos', 'eliminar')
  const puedeActivar = tienePermiso('flujos', 'activar')

  // -----------------------------------------------------------------
  // Filtros con sync URL ↔ estado (mismo patrón que /contactos)
  // -----------------------------------------------------------------
  const filtros = useFiltrosUrl({
    pathname: '/flujos',
    campos: {
      estado: { defecto: '' },
      modulo: { defecto: '' },
      tipo_disparador: { defecto: [] as string[] },
      creado_rango: { defecto: '' },
      fecha_ultima_ejecucion: { defecto: '' },
    },
    busqueda: { claveUrl: 'q' },
    pagina: { defecto: 1 },
  })

  const f = filtros.valores
  const busquedaInput = filtros.busquedaInput
  const setBusquedaInput = filtros.setBusquedaInput
  const busquedaActiva = filtros.busquedaActiva
  const pagina = filtros.pagina
  const setPagina = filtros.setPagina

  const sinFiltros =
    !busquedaActiva &&
    !f.estado &&
    !f.modulo &&
    f.tipo_disparador.length === 0 &&
    !f.creado_rango &&
    !f.fecha_ultima_ejecucion &&
    pagina === 1

  // -----------------------------------------------------------------
  // Listado
  // -----------------------------------------------------------------
  const { datos: flujos, total, recargar } = useListado<FilaFlujo>({
    clave: 'flujos',
    url: '/api/flujos',
    parametros: {
      q: busquedaActiva,
      estado: f.estado || undefined,
      modulo: f.modulo || undefined,
      tipo_disparador: f.tipo_disparador.length ? f.tipo_disparador.join(',') : undefined,
      creado_rango: f.creado_rango || undefined,
      fecha_ultima_ejecucion: f.fecha_ultima_ejecucion || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.flujos || []) as FilaFlujo[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

  // -----------------------------------------------------------------
  // Acciones: activar / pausar / eliminar / duplicar
  // -----------------------------------------------------------------
  const refrescar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['flujos'] })
    recargar()
  }, [queryClient, recargar])

  const activarFlujo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/flujos/${id}/activar`, { method: 'POST' })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrarToast('exito', t('flujos.toast.activado'))
      refrescar()
    } catch (err) {
      mostrarToast('error', err instanceof Error ? err.message : t('flujos.toast.error_activar'))
    }
  }, [mostrarToast, t, refrescar])

  const pausarFlujo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/flujos/${id}/pausar`, { method: 'POST' })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrarToast('exito', t('flujos.toast.pausado'))
      refrescar()
    } catch (err) {
      mostrarToast('error', err instanceof Error ? err.message : t('flujos.toast.error_pausar'))
    }
  }, [mostrarToast, t, refrescar])

  // -----------------------------------------------------------------
  // Modales
  // -----------------------------------------------------------------
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)
  const [pestanaModal, setPestanaModal] = useState<'plantilla' | 'cero'>('plantilla')
  const [plantillaInicial, setPlantillaInicial] = useState<PlantillaSugerida | null>(null)

  const [eliminarPendiente, setEliminarPendiente] = useState<FilaFlujo | null>(null)
  const [cargandoEliminar, setCargandoEliminar] = useState(false)

  const [duplicarPendiente, setDuplicarPendiente] = useState<FilaFlujo | null>(null)
  const [nombreDuplicado, setNombreDuplicado] = useState('')
  const [cargandoDuplicar, setCargandoDuplicar] = useState(false)

  function abrirModalNuevo(pestana: 'plantilla' | 'cero', plantilla: PlantillaSugerida | null = null) {
    setPestanaModal(pestana)
    setPlantillaInicial(plantilla)
    setModalNuevoAbierto(true)
  }

  function abrirModalDuplicar(flujo: FilaFlujo) {
    setDuplicarPendiente(flujo)
    setNombreDuplicado(`${flujo.nombre} ${t('flujos.modal_duplicar.sufijo_copia')}`)
  }

  async function confirmarDuplicar() {
    if (!duplicarPendiente || !nombreDuplicado.trim()) return
    setCargandoDuplicar(true)
    try {
      const res = await fetch('/api/flujos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreDuplicado.trim(),
          basado_en_flujo_id: duplicarPendiente.id,
        }),
      })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { flujo?: { id: string } }
      mostrarToast('exito', t('flujos.toast.duplicado'))
      setDuplicarPendiente(null)
      refrescar()
      if (data.flujo?.id) {
        router.push(`/flujos/${data.flujo.id}`)
      }
    } catch (err) {
      mostrarToast('error', err instanceof Error ? err.message : t('flujos.toast.error_duplicar'))
    } finally {
      setCargandoDuplicar(false)
    }
  }

  async function confirmarEliminar() {
    if (!eliminarPendiente) return
    setCargandoEliminar(true)
    try {
      const res = await fetch(`/api/flujos/${eliminarPendiente.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrarToast('exito', t('flujos.toast.eliminado'))
      setEliminarPendiente(null)
      refrescar()
    } catch (err) {
      mostrarToast('error', err instanceof Error ? err.message : t('flujos.toast.error_eliminar'))
    } finally {
      setCargandoEliminar(false)
    }
  }

  // -----------------------------------------------------------------
  // Definición de columnas
  // -----------------------------------------------------------------
  const columnas: ColumnaDinamica<FilaFlujo>[] = useMemo(() => [
    {
      clave: 'estado',
      etiqueta: t('flujos.columna_estado'),
      ancho: 120,
      grupo: 'Estado',
      icono: <Activity size={12} />,
      render: (fila) => <PillEstado estado={fila.estado} />,
      obtenerValor: (fila) => fila.estado,
    },
    {
      clave: 'nombre',
      etiqueta: t('flujos.columna_nombre'),
      ancho: 320,
      obligatoria: true,
      grupo: 'Identidad',
      icono: <Workflow size={12} />,
      render: (fila) => <CeldaNombre fila={fila} />,
      obtenerValor: (fila) => fila.nombre,
    },
    {
      clave: 'modulo',
      etiqueta: t('flujos.columna_modulo'),
      ancho: 160,
      grupo: 'Identidad',
      icono: <Tag size={12} />,
      render: (fila) => <CeldaModulo fila={fila} />,
      obtenerValor: (fila) => fila.disparador?.configuracion?.entidad_tipo ?? '',
    },
    {
      clave: 'disparador',
      etiqueta: t('flujos.columna_disparador'),
      ancho: 200,
      grupo: 'Identidad',
      icono: <Filter size={12} />,
      render: (fila) => <CeldaDisparador fila={fila} />,
      obtenerValor: (fila) => fila.disparador?.tipo ?? '',
    },
    {
      clave: 'ultima_ejecucion_en',
      etiqueta: t('flujos.columna_ultima_ejecucion'),
      ancho: 160,
      grupo: 'Actividad',
      tipo: 'fecha',
      render: (fila) => fila.ultima_ejecucion_en
        ? <span className="text-xs text-texto-secundario">{formato.fechaRelativa(fila.ultima_ejecucion_en)}</span>
        : <span className="text-xs text-texto-terciario italic">{t('flujos.tooltip_sin_ejecutar')}</span>,
      obtenerValor: (fila) => fila.ultima_ejecucion_en ?? '',
    },
    {
      clave: 'total_ejecuciones_30d',
      etiqueta: t('flujos.columna_ejecuciones'),
      ancho: 130,
      grupo: 'Actividad',
      tipo: 'numero',
      alineacion: 'right',
      render: (fila) => (
        <span className="text-xs font-mono text-texto-secundario">
          {fila.total_ejecuciones_30d ?? 0}
        </span>
      ),
      obtenerValor: (fila) => fila.total_ejecuciones_30d ?? 0,
    },
    {
      clave: 'auditoria',
      etiqueta: '',
      ancho: 60,
      grupo: 'Sistema',
      render: (fila) => (
        <IndicadorEditado
          entidadId={fila.id}
          nombreCreador={fila.creado_por_nombre}
          fechaCreacion={fila.creado_en}
          nombreEditor={fila.editado_por_nombre}
          fechaEdicion={fila.actualizado_en !== fila.creado_en ? fila.actualizado_en : null}
          tablaAuditoria="auditoria_flujos"
          campoReferencia="flujo_id"
        />
      ),
    },
    {
      clave: 'acciones',
      etiqueta: '',
      ancho: 56,
      alineacion: 'center',
      render: (fila) => (
        <MenuFilaFlujo
          estado={fila.estado}
          permisos={{
            editar: puedeEditar,
            eliminar: puedeEliminar,
            activar: puedeActivar,
            crear: puedeCrear,
          }}
          onEditar={() => router.push(`/flujos/${fila.id}`)}
          onDuplicar={() => abrirModalDuplicar(fila)}
          onActivar={() => activarFlujo(fila.id)}
          onPausar={() => pausarFlujo(fila.id)}
          onEliminar={() => setEliminarPendiente(fila)}
        />
      ),
    },
  ], [t, formato, puedeEditar, puedeEliminar, puedeActivar, puedeCrear, router, activarFlujo, pausarFlujo])

  // -----------------------------------------------------------------
  // Definición de filtros + grupos
  // -----------------------------------------------------------------
  // Caveat 3 del coordinador: pills tri-state de estado SOLO en el toolbar
  // (siempre visibles, arriba de la tabla), NO dentro del panel avanzado.
  // Por eso `estado` NO está en `filtrosDef` ni en `gruposFiltros` — se
  // renderiza como `<PillsEstado>` arriba de la TablaDinamica. La columna
  // de display tampoco es filtrable inline, así no hay redundancia.
  const filtrosDef: FiltroTabla[] = useMemo(() => [
    {
      id: 'modulo',
      etiqueta: t('flujos.filtro_modulo'),
      tipo: 'seleccion-compacto',
      icono: <Tag size={12} />,
      valor: f.modulo,
      onChange: (v) => filtros.set('modulo', v as string),
      opciones: ENTIDADES_CON_ESTADO.map((e) => ({
        valor: e,
        etiqueta: ETIQUETAS_ENTIDAD[e],
      })),
      descripcion: t('flujos.filtro_modulo_desc'),
    },
    {
      id: 'tipo_disparador',
      etiqueta: t('flujos.filtro_tipo_disparador'),
      tipo: 'multiple-compacto',
      icono: <Filter size={12} />,
      valor: f.tipo_disparador,
      onChange: (v) => filtros.set('tipo_disparador', v as string[]),
      opciones: TIPOS_DISPARADOR.map((tipo) => ({
        valor: tipo,
        etiqueta: etiquetaDisparador(t, tipo),
      })),
      descripcion: t('flujos.filtro_tipo_disparador_desc'),
    },
    {
      id: 'creado_rango',
      etiqueta: t('flujos.filtro_creado'),
      tipo: 'pills',
      valor: f.creado_rango,
      onChange: (v) => filtros.set('creado_rango', v as string),
      opciones: [
        { valor: 'hoy', etiqueta: 'Hoy' },
        { valor: '7d', etiqueta: '7 días' },
        { valor: '30d', etiqueta: '30 días' },
        { valor: '90d', etiqueta: '90 días' },
        { valor: 'este_ano', etiqueta: 'Este año' },
      ],
      descripcion: t('flujos.filtro_creado_desc'),
    },
    {
      id: 'fecha_ultima_ejecucion',
      etiqueta: t('flujos.filtro_ultima_ejec'),
      tipo: 'pills',
      valor: f.fecha_ultima_ejecucion,
      onChange: (v) => filtros.set('fecha_ultima_ejecucion', v as string),
      opciones: [
        { valor: 'hoy', etiqueta: 'Hoy' },
        { valor: '7d', etiqueta: '7 días' },
        { valor: '30d', etiqueta: '30 días' },
      ],
      descripcion: t('flujos.filtro_ultima_ejec_desc'),
    },
  ], [t, f.modulo, f.tipo_disparador, f.creado_rango, f.fecha_ultima_ejecucion, filtros])

  const gruposFiltros: GrupoFiltros[] = useMemo(() => [
    {
      id: 'identidad',
      etiqueta: t('flujos.grupo_identidad'),
      filtros: ['modulo'],
    },
    {
      id: 'comportamiento',
      etiqueta: t('flujos.grupo_comportamiento'),
      filtros: ['tipo_disparador'],
    },
    {
      id: 'actividad',
      etiqueta: t('flujos.grupo_actividad'),
      filtros: ['creado_rango', 'fecha_ultima_ejecucion'],
    },
  ], [t])

  // -----------------------------------------------------------------
  // Render: tarjeta para mobile
  // -----------------------------------------------------------------
  const renderTarjeta = useCallback((fila: FilaFlujo) => {
    const accionesTarjeta: AccionTarjeta[] = []
    if (puedeCrear) {
      accionesTarjeta.push({
        id: 'duplicar',
        etiqueta: t('flujos.accion.duplicar'),
        icono: <Copy size={14} />,
        onClick: () => abrirModalDuplicar(fila),
      })
    }
    if (puedeActivar && fila.estado !== 'activo') {
      accionesTarjeta.push({
        id: 'activar',
        etiqueta: t('flujos.accion.activar'),
        icono: <Play size={14} />,
        onClick: () => activarFlujo(fila.id),
      })
    }
    if (puedeActivar && fila.estado === 'activo') {
      accionesTarjeta.push({
        id: 'pausar',
        etiqueta: t('flujos.accion.pausar'),
        icono: <Pause size={14} />,
        onClick: () => pausarFlujo(fila.id),
      })
    }
    if (puedeEliminar) {
      accionesTarjeta.push({
        id: 'eliminar',
        etiqueta: t('flujos.accion.eliminar'),
        icono: <Trash2 size={14} />,
        onClick: () => setEliminarPendiente(fila),
        color: 'var(--insignia-peligro-texto)',
      })
    }

    return (
      <div className="flex flex-col gap-3 p-4 rounded-popover border border-borde-sutil bg-superficie-tarjeta">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <PillEstado estado={fila.estado} />
            <h3 className="text-sm font-semibold text-texto-primario truncate flex-1">
              {fila.nombre}
            </h3>
            {tieneBorradorPendiente(fila) && (
              <span
                className="size-2 shrink-0 rounded-full bg-insignia-advertencia-texto"
                title={t('flujos.tooltip_borrador_pendiente')}
              />
            )}
          </div>
        </div>
        <LineaInfoTarjeta icono={<Tag size={12} />}>
          {fila.disparador?.configuracion?.entidad_tipo
            ? ETIQUETAS_ENTIDAD[fila.disparador.configuracion.entidad_tipo as keyof typeof ETIQUETAS_ENTIDAD] ?? '—'
            : '—'}
        </LineaInfoTarjeta>
        <LineaInfoTarjeta icono={<Filter size={12} />}>
          {etiquetaDisparador(t, fila.disparador?.tipo)}
        </LineaInfoTarjeta>
        <LineaInfoTarjeta icono={<Activity size={12} />}>
          {fila.ultima_ejecucion_en
            ? formato.fechaRelativa(fila.ultima_ejecucion_en)
            : t('flujos.tooltip_sin_ejecutar')}
        </LineaInfoTarjeta>
        <div
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => router.push(`/flujos/${fila.id}`)}
        >
          <span className="text-xs text-texto-terciario">
            {fila.total_ejecuciones_30d ?? 0} {t('flujos.columna_ejecuciones')}
          </span>
        </div>
        <PieAccionesTarjeta acciones={accionesTarjeta} />
      </div>
    )
  }, [puedeCrear, puedeActivar, puedeEliminar, t, formato, activarFlujo, pausarFlujo, router])

  const onLimpiarFiltros = useCallback(() => {
    filtros.setMultiple({
      estado: '',
      modulo: '',
      tipo_disparador: [],
      creado_rango: '',
      fecha_ultima_ejecucion: '',
    })
    setBusquedaInput('')
  }, [filtros, setBusquedaInput])

  const tablaTieneFiltrosOBusqueda = !sinFiltros

  return (
    <>
      <PlantillaListado
        titulo={t('flujos.titulo')}
        accionPrincipal={puedeCrear ? {
          etiqueta: t('flujos.nuevo'),
          icono: <Workflow size={14} />,
          onClick: () => abrirModalNuevo('plantilla', null),
        } : undefined}
      >
        {/* Pills tri-state SIEMPRE visibles arriba del toolbar de la tabla
            (caveat 3 del coordinador). Fuera del panel avanzado y fuera
            de la columna de display, sin redundancia. */}
        <PillsEstado
          valor={f.estado}
          onChange={(v) => filtros.set('estado', v)}
        />

        <TablaDinamica<FilaFlujo>
          columnas={columnas}
          datos={flujos}
          claveFila={(f) => f.id}
          totalRegistros={total}
          registrosPorPagina={POR_PAGINA}
          paginaExterna={pagina}
          onCambiarPagina={setPagina}
          busqueda={busquedaInput}
          onBusqueda={setBusquedaInput}
          placeholder={t('flujos.buscar_placeholder')}
          filtros={filtrosDef}
          gruposFiltros={gruposFiltros}
          onLimpiarFiltros={onLimpiarFiltros}
          idModulo="flujos"
          vistas={['lista', 'tarjetas']}
          renderTarjeta={renderTarjeta}
          onClickFila={(fila) => router.push(`/flujos/${fila.id}`)}
          estadoVacio={
            // Estado vacío educativo SOLO cuando no hay flujos y no hay
            // filtros aplicados. Si hay filtros y no matchea nada,
            // TablaDinamica muestra su estado "sin resultados" propio.
            !tablaTieneFiltrosOBusqueda && total === 0 ? (
              <EstadoVacioFlujos
                puedeCrear={puedeCrear}
                onUsarPlantilla={(p) => abrirModalNuevo('plantilla', p)}
                onCrearDesdeCero={() => abrirModalNuevo('cero', null)}
              />
            ) : undefined
          }
        />
      </PlantillaListado>

      {/* Modal "+ Nuevo flujo" */}
      <ModalNuevoFlujo
        abierto={modalNuevoAbierto}
        onCerrar={() => setModalNuevoAbierto(false)}
        pestanaInicial={pestanaModal}
        plantillaInicial={plantillaInicial}
        onCreado={refrescar}
      />

      {/* Modal duplicar — input mínimo con sufijo "(copia)" */}
      <Modal
        abierto={!!duplicarPendiente}
        onCerrar={() => setDuplicarPendiente(null)}
        titulo={t('flujos.modal_duplicar.titulo')}
        tamano="md"
        accionPrimaria={{
          etiqueta: t('flujos.modal_duplicar.confirmar'),
          onClick: () => void confirmarDuplicar(),
          cargando: cargandoDuplicar,
          disabled: !nombreDuplicado.trim(),
        }}
        accionSecundaria={{
          etiqueta: t('comun.cancelar'),
          onClick: () => setDuplicarPendiente(null),
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto-terciario">
            {t('flujos.modal_duplicar.descripcion')}
          </p>
          <Input
            etiqueta={t('flujos.modal_duplicar.nombre_label')}
            value={nombreDuplicado}
            onChange={(e) => setNombreDuplicado(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Confirmación dura para eliminar */}
      <ModalConfirmacion
        abierto={!!eliminarPendiente}
        onCerrar={() => setEliminarPendiente(null)}
        onConfirmar={() => void confirmarEliminar()}
        titulo={t('flujos.confirmar_eliminar.titulo')}
        descripcion={t('flujos.confirmar_eliminar.descripcion')}
        tipo="peligro"
        etiquetaConfirmar={t('flujos.confirmar_eliminar.confirmar')}
        cargando={cargandoEliminar}
      />
    </>
  )
}

// =============================================================
// Sub-componentes de celda (locales — no se reusan fuera del listado)
// =============================================================

const COLOR_ESTADO_FLUJO: Record<EstadoFlujo, ColorInsignia> = {
  activo: 'exito',
  pausado: 'advertencia',
  borrador: 'neutro',
}

function PillEstado({ estado }: { estado: EstadoFlujo }) {
  const { t } = useTraduccion()
  return (
    <Insignia color={COLOR_ESTADO_FLUJO[estado]} tamano="sm">
      {t(`flujos.estados.${estado}`)}
    </Insignia>
  )
}

/**
 * `borrador_jsonb !== null && estado === 'activo'` — punto amarillo solo
 * cuando un flujo activo tiene cambios sin publicar. El caso edge
 * "Pausado con borrador" queda como TODO para 19.2: cuando aterrice el
 * editor con la lógica de publicación, ahí decidimos si mostrar también
 * el indicador en pausados.
 */
function tieneBorradorPendiente(fila: FilaFlujo): boolean {
  return fila.borrador_jsonb !== null && fila.estado === 'activo'
}

function CeldaNombre({ fila }: { fila: FilaFlujo }) {
  const { t } = useTraduccion()
  const Icono = iconoLucide(fila.icono)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 text-texto-terciario">
        <Icono size={14} strokeWidth={1.6} />
      </span>
      <span className="text-sm font-medium text-texto-primario truncate">
        {fila.nombre}
      </span>
      {tieneBorradorPendiente(fila) && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-insignia-advertencia-texto"
          title={t('flujos.tooltip_borrador_pendiente')}
        />
      )}
    </div>
  )
}

function CeldaModulo({ fila }: { fila: FilaFlujo }) {
  const tipo = fila.disparador?.configuracion?.entidad_tipo
  if (!tipo || !(tipo in ETIQUETAS_ENTIDAD)) {
    return <span className="text-xs text-texto-terciario">—</span>
  }
  return (
    <Insignia color="neutro" tamano="sm" variante="outline">
      {ETIQUETAS_ENTIDAD[tipo as keyof typeof ETIQUETAS_ENTIDAD]}
    </Insignia>
  )
}

function CeldaDisparador({ fila }: { fila: FilaFlujo }) {
  const { t } = useTraduccion()
  const tipo = fila.disparador?.tipo
  if (!tipo) {
    return <span className="text-xs text-texto-terciario italic">{t('flujos.disparador.sin_disparador')}</span>
  }
  return (
    <span className="text-xs text-texto-secundario">
      {etiquetaDisparador(t, tipo)}
    </span>
  )
}

// =============================================================
// Pills tri-state del toolbar (Todos / Activos / Pausados / Borradores)
// =============================================================
// Componente local — vive SIEMPRE arriba de la TablaDinamica, no entra
// en `filtros: FiltroTabla[]`. Decisión D(a) corregida del coordinador
// (caveat 3): pills siempre visibles en el toolbar, no dentro del panel
// avanzado. Patrón consistente con el mockup descriptivo §B.
//
// Click en una pill activa el filtro; click en la pill activa la
// desactiva (vuelve a "Todos"). Click directo en "Todos" también limpia.
// El click corre `setPagina(1)` implícitamente vía `useFiltrosUrl` —
// cuando cambia `f.estado`, el debounce y el resetear-página lo manejan
// las dependencias del useEffect interno del hook.

function PillsEstado({
  valor,
  onChange,
}: {
  valor: string
  onChange: (v: string) => void
}) {
  const { t } = useTraduccion()
  const opciones: Array<{ valor: string; etiqueta: string }> = [
    { valor: '', etiqueta: t('flujos.filtro_todos') },
    { valor: 'activo', etiqueta: t('flujos.filtro_activos') },
    { valor: 'pausado', etiqueta: t('flujos.filtro_pausados') },
    { valor: 'borrador', etiqueta: t('flujos.filtro_borradores') },
  ]

  return (
    <div
      role="tablist"
      aria-label={t('flujos.columna_estado')}
      className="flex flex-wrap items-center gap-1.5 px-2 sm:px-6 -mt-2 mb-1"
    >
      {opciones.map((op) => {
        const activa = valor === op.valor
        return (
          <button
            key={op.valor || 'todos'}
            role="tab"
            type="button"
            aria-selected={activa}
            onClick={() => onChange(activa && op.valor !== '' ? '' : op.valor)}
            className={[
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors duration-100',
              activa
                ? 'bg-superficie-seleccionada text-texto-marca border-texto-marca/30'
                : 'bg-transparent text-texto-terciario border-borde-sutil hover:border-borde-fuerte hover:text-texto-secundario',
            ].join(' ')}
          >
            {op.etiqueta}
          </button>
        )
      })}
    </div>
  )
}


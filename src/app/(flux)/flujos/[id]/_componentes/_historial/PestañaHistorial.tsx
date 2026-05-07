'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock,
  Filter,
  History,
  Tag,
} from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type {
  ColumnaDinamica,
  FiltroTabla,
  GrupoFiltros,
} from '@/componentes/tablas/tipos-tabla'
import { LineaInfoTarjeta } from '@/componentes/tablas/LineaInfoTarjeta'
import {
  ESTADOS_EJECUCION,
  type EstadoEjecucion,
} from '@/tipos/workflow'
import {
  RAW_CLASS_COMUNES,
  TIPOS_DISPARADO_POR,
  duracionSegundos,
  formatearDuracion,
  tipoDisparadoPor,
  type TipoDisparadoPor,
} from './formato-ejecucion'
import EstadoEjecucionPill from './EstadoEjecucionPill'
import { useFiltrosHistorial } from './hooks/useFiltrosHistorial'
import {
  useListadoEjecuciones,
  type FilaEjecucion,
} from './hooks/useListadoEjecuciones'

/**
 * PestañaHistorial — listado de ejecuciones del flujo (sub-PR 19.6).
 *
 * Filtros viven en `useState` local efímero (decisión coordinador
 * commit 2): la URL queda limpia con `?vista=historial` + `?ejecucion=<id>`,
 * sin params de filtros. Cero modificación de `useFiltrosUrl`. Si en el
 * futuro emerge dolor de "compartir links con filtros aplicados", se
 * sube a un PR aislado dedicado al hook reusable.
 *
 * Click en fila → escribe `?ejecucion=<id>` en URL preservando `vista`.
 * El drawer (sub-PR 19.6 commit 3) lee ese param y se abre.
 *
 * Empty states:
 *   - Sin ejecuciones (total === 0 sin filtros): mensaje educativo.
 *   - Sin resultados (total === 0 con filtros): hint + botón limpiar.
 *   - Dataset grande (>1000 sin filtros): hint sugiriendo filtrar
 *     por fecha (caveat D7).
 */

const POR_PAGINA = 50
const UMBRAL_DATASET_GRANDE = 1000

interface Props {
  flujoId: string
}

export default function PestañaHistorial({ flujoId }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const router = useRouter()

  const filtros = useFiltrosHistorial()

  const {
    datos: ejecuciones,
    total,
    cargandoInicial,
  } = useListadoEjecuciones({
    flujoId,
    estados: filtros.estados,
    disparadoPorTipos: filtros.disparadoPorTipos,
    creadoRango: filtros.creadoRango,
    errorRawClass: filtros.errorRawClass,
    pagina: filtros.pagina,
    porPagina: POR_PAGINA,
  })

  // ─── Click en fila: escribir ?ejecucion=<id> preservando ?vista ───
  // El drawer del commit 3 va a leer este param y abrir el detalle.
  const onClickFila = useCallback(
    (fila: FilaEjecucion) => {
      const url = new URL(window.location.href)
      url.searchParams.set('vista', 'historial')
      url.searchParams.set('ejecucion', fila.id)
      router.replace(url.pathname + url.search, { scroll: false })
    },
    [router],
  )

  // ─── Columnas ────────────────────────────────────────────────────
  const columnas: ColumnaDinamica<FilaEjecucion>[] = useMemo(() => [
    {
      clave: 'estado',
      etiqueta: t('flujos.historial.columnas.estado'),
      ancho: 130,
      grupo: 'Estado',
      icono: <Activity size={12} />,
      render: (fila) => <EstadoEjecucionPill estado={fila.estado} />,
      obtenerValor: (fila) => fila.estado,
    },
    {
      clave: 'creado_en',
      etiqueta: t('flujos.historial.columnas.fecha'),
      ancho: 180,
      obligatoria: true,
      grupo: 'Cuándo',
      icono: <CalendarDays size={12} />,
      tipo: 'fecha',
      render: (fila) => (
        <div className="flex flex-col">
          <span className="text-xs text-texto-secundario">
            {formato.fechaRelativa(fila.creado_en)}
          </span>
          <span className="text-xxs text-texto-terciario">
            {formato.fecha(fila.creado_en, { conHora: true })}
          </span>
        </div>
      ),
      obtenerValor: (fila) => fila.creado_en,
    },
    {
      clave: 'disparado_por',
      etiqueta: t('flujos.historial.columnas.disparado_por'),
      ancho: 160,
      grupo: 'Origen',
      icono: <Filter size={12} />,
      render: (fila) => {
        const tipo = tipoDisparadoPor(fila.disparado_por)
        return (
          <span className="text-xs text-texto-secundario">
            {tipo
              ? t(`flujos.historial.disparado_por.${tipo}`)
              : t('flujos.historial.disparado_por.desconocido')}
          </span>
        )
      },
      obtenerValor: (fila) => tipoDisparadoPor(fila.disparado_por) ?? '',
    },
    {
      clave: 'entidad',
      etiqueta: t('flujos.historial.columnas.entidad'),
      ancho: 200,
      grupo: 'Origen',
      icono: <Tag size={12} />,
      render: (fila) => <CeldaEntidad fila={fila} />,
      obtenerValor: (fila) => extraerEntidadResumen(fila) ?? '',
    },
    {
      clave: 'duracion',
      etiqueta: t('flujos.historial.columnas.duracion'),
      ancho: 100,
      grupo: 'Cuándo',
      icono: <Clock size={12} />,
      tipo: 'numero',
      alineacion: 'right',
      render: (fila) => (
        <span className="text-xs font-mono text-texto-secundario">
          {formatearDuracion(duracionSegundos(fila.inicio_en, fila.fin_en))}
        </span>
      ),
      obtenerValor: (fila) => duracionSegundos(fila.inicio_en, fila.fin_en) ?? 0,
    },
  ], [t, formato])

  // ─── Filtros + grupos ────────────────────────────────────────────
  const filtrosDef: FiltroTabla[] = useMemo(() => [
    {
      id: 'estado',
      etiqueta: t('flujos.historial.filtros.estado'),
      tipo: 'multiple-compacto',
      icono: <Activity size={12} />,
      valor: filtros.estados,
      onChange: (v) => filtros.setEstados(v as EstadoEjecucion[]),
      opciones: ESTADOS_EJECUCION.map((e) => ({
        valor: e,
        etiqueta: t(`flujos.historial.estados.${e}`),
      })),
      descripcion: t('flujos.historial.filtros.estado_desc'),
    },
    {
      id: 'disparado_por',
      etiqueta: t('flujos.historial.filtros.disparado_por'),
      tipo: 'multiple-compacto',
      icono: <Filter size={12} />,
      valor: filtros.disparadoPorTipos,
      onChange: (v) => filtros.setDisparadoPorTipos(v as TipoDisparadoPor[]),
      opciones: TIPOS_DISPARADO_POR.map((tipo) => ({
        valor: tipo,
        etiqueta: t(`flujos.historial.disparado_por.${tipo}`),
      })),
      descripcion: t('flujos.historial.filtros.disparado_por_desc'),
    },
    {
      id: 'creado_rango',
      etiqueta: t('flujos.historial.filtros.creado_rango'),
      tipo: 'pills',
      valor: filtros.creadoRango,
      onChange: (v) => filtros.setCreadoRango(v as string),
      opciones: [
        { valor: 'hoy', etiqueta: t('flujos.historial.preset_fecha.hoy') },
        { valor: '7d', etiqueta: t('flujos.historial.preset_fecha.7d') },
        { valor: '30d', etiqueta: t('flujos.historial.preset_fecha.30d') },
        { valor: '90d', etiqueta: t('flujos.historial.preset_fecha.90d') },
      ],
      descripcion: t('flujos.historial.filtros.creado_rango_desc'),
    },
    {
      id: 'error_raw_class',
      etiqueta: t('flujos.historial.filtros.error_raw_class'),
      tipo: 'multiple-compacto',
      icono: <AlertTriangle size={12} />,
      valor: filtros.errorRawClass,
      onChange: (v) => filtros.setErrorRawClass(v as string[]),
      opciones: RAW_CLASS_COMUNES.map((rc) => ({
        valor: rc,
        // raw_class es un identificador técnico (el motor lo emite así
        // en el log). No traducimos: el dev/soporte lo busca tal cual.
        etiqueta: rc,
      })),
      descripcion: t('flujos.historial.filtros.error_raw_class_desc'),
    },
  ], [t, filtros])

  const gruposFiltros: GrupoFiltros[] = useMemo(() => [
    {
      id: 'estado',
      etiqueta: t('flujos.historial.grupos.estado'),
      filtros: ['estado', 'error_raw_class'],
    },
    {
      id: 'cuando',
      etiqueta: t('flujos.historial.grupos.cuando'),
      filtros: ['creado_rango'],
    },
    {
      id: 'origen',
      etiqueta: t('flujos.historial.grupos.origen'),
      filtros: ['disparado_por'],
    },
  ], [t])

  // ─── Empty state custom ──────────────────────────────────────────
  // Cuando NO hay filtros aplicados y total === 0: el flujo nunca
  // ejecutó (o todas las ejecuciones se borraron por retención).
  const sinEjecucionesEnAbsoluto =
    filtros.estaEnDefecto && total === 0 && !cargandoInicial

  // Hint de dataset grande (caveat D7): si total > 1000 sin filtros,
  // sugerimos filtrar por fecha para que la paginación sea manejable.
  const datasetGrande = filtros.estaEnDefecto && total > UMBRAL_DATASET_GRANDE

  const renderTarjeta = useCallback(
    (fila: FilaEjecucion) => (
      <div className="flex flex-col gap-3 p-4 rounded-popover border border-borde-sutil bg-superficie-tarjeta">
        <div className="flex items-start justify-between gap-3">
          <EstadoEjecucionPill estado={fila.estado} />
          <span className="text-xs text-texto-terciario">
            {formato.fechaRelativa(fila.creado_en)}
          </span>
        </div>
        <LineaInfoTarjeta icono={<Filter size={12} />}>
          {(() => {
            const tipo = tipoDisparadoPor(fila.disparado_por)
            return tipo
              ? t(`flujos.historial.disparado_por.${tipo}`)
              : t('flujos.historial.disparado_por.desconocido')
          })()}
        </LineaInfoTarjeta>
        <LineaInfoTarjeta icono={<Tag size={12} />}>
          {extraerEntidadResumen(fila) ??
            t('flujos.historial.entidad_sin_referencia')}
        </LineaInfoTarjeta>
        <LineaInfoTarjeta icono={<Clock size={12} />}>
          {formatearDuracion(duracionSegundos(fila.inicio_en, fila.fin_en))}
        </LineaInfoTarjeta>
      </div>
    ),
    [formato, t],
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {datasetGrande && (
        <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-4">
          <div className="rounded-card border border-insignia-info-texto/30 bg-insignia-info-fondo/40 px-3 py-2 text-xs text-texto-secundario flex items-start gap-2">
            <CalendarDays size={14} className="text-insignia-info-texto shrink-0 mt-0.5" />
            <span>{t('flujos.historial.hint_dataset_grande').replace('{{n}}', String(total))}</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <TablaDinamica<FilaEjecucion>
          columnas={columnas}
          datos={ejecuciones}
          claveFila={(f) => f.id}
          totalRegistros={total}
          registrosPorPagina={POR_PAGINA}
          paginaExterna={filtros.pagina}
          onCambiarPagina={filtros.setPagina}
          busqueda={filtros.busquedaInput}
          onBusqueda={filtros.setBusquedaInput}
          placeholder={t('flujos.historial.busqueda_placeholder')}
          filtros={filtrosDef}
          gruposFiltros={gruposFiltros}
          onLimpiarFiltros={filtros.limpiar}
          idModulo={`flujos-historial-${flujoId}`}
          vistas={['lista', 'tarjetas']}
          renderTarjeta={renderTarjeta}
          onClickFila={onClickFila}
          estadoVacio={
            sinEjecucionesEnAbsoluto ? (
              <div className="flex flex-col items-center justify-center text-center py-16 text-texto-terciario">
                <History size={28} className="mb-3 opacity-40" strokeWidth={1.6} />
                <p className="text-sm font-medium text-texto-secundario">
                  {t('flujos.historial.empty.sin_ejecuciones_titulo')}
                </p>
                <p className="mt-1 text-xs max-w-md">
                  {t('flujos.historial.empty.sin_ejecuciones_desc')}
                </p>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}

// ─── Helpers UI locales ──────────────────────────────────────────────

/**
 * Lee el resumen de la entidad disparadora del contexto_inicial.
 * El shape es `{ entidad: { tipo, id, ...campos } }` — convención del
 * dispatcher. Si no hay entidad (cron sin contexto), devuelve null.
 */
function extraerEntidadResumen(fila: FilaEjecucion): string | null {
  const ctx = fila.contexto_inicial as Record<string, unknown> | null | undefined
  if (!ctx || typeof ctx !== 'object') return null
  const ent = ctx.entidad as Record<string, unknown> | null | undefined
  if (!ent || typeof ent !== 'object') return null
  // Probamos campos comunes en orden de preferencia. titulo > nombre >
  // numero > id (último recurso para que el usuario vea algo).
  const candidatos = ['titulo', 'nombre', 'numero', 'id']
  for (const k of candidatos) {
    const v = ent[k]
    if (typeof v === 'string' && v.trim().length > 0) return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

function CeldaEntidad({ fila }: { fila: FilaEjecucion }) {
  const { t } = useTraduccion()
  const resumen = extraerEntidadResumen(fila)
  if (!resumen) {
    return (
      <span className="text-xs text-texto-terciario italic">
        {t('flujos.historial.entidad_sin_referencia')}
      </span>
    )
  }
  return <span className="text-xs text-texto-secundario truncate">{resumen}</span>
}

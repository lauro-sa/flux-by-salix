'use client'

/**
 * SeccionFlujosModulo — sección "Flujos de [Módulo]" que vive dentro
 * de cada `/<modulo>/configuracion?seccion=flujos` (sub-PR 19.7,
 * §1.10 + §5.5 del plan UX).
 *
 * Estructura vertical en dos bloques:
 *
 *   1. **Lista compacta** de flujos del módulo (max 5 + "Ver todos").
 *      Solo lectura, click → editor central. Si hay 0 flujos del
 *      módulo, este bloque se omite por completo (no mostrar
 *      "Sin flujos").
 *   2. **Grid de plantillas curadas** del módulo. Click en card →
 *      crea un flujo borrador y navega al editor con `?plantilla=<id>`
 *      (mismo flow que el modal "+ Nuevo flujo" del 19.1, vía hook
 *      compartido `useCrearFlujo`).
 *
 * Permisos (D5 del plan de scope):
 *   - Sin `flujos.ver` → componente devuelve null (cero fetch).
 *   - Con `flujos.ver` pero sin `flujos.crear` → bloque 1 visible,
 *     bloque 2 oculto (las plantillas sin botón no aportan).
 *
 * Filtros (D-extra del plan de scope):
 *   - `modulos`: lista de `entidad_tipo` para módulos cuyos
 *     disparadores tienen entidad asociada (presupuesto, cuota,
 *     actividad, visita, …). Se manda como `?modulo=<csv>`.
 *   - `tiposDisparador`: lista de tipos de disparador para módulos
 *     cuyos disparadores NO tienen `entidad_tipo` (inbox.*, y en
 *     el futuro tiempo.cron si emerge la necesidad). Es prop genérica
 *     — no es un hack específico de inbox. Se manda como
 *     `?tipo_disparador=<csv>`.
 *
 * Mobile (D7): grid de plantillas colapsa a 1 columna; lista mantiene
 * estructura full-width.
 *
 * Diferido a sub-PRs futuros (queda anotado en project_workflows.md):
 *   - El link "Ver todos" usa el primer ítem de `modulos` cuando
 *     hay multi (ej: presupuesto+cuota → ?modulo=presupuesto).
 *     Soporte CSV en URL del listado central es scope creep aquí.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { Workflow, ChevronRight, Sparkles, ArrowRight } from 'lucide-react'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useRol } from '@/hooks/useRol'
import { useModulos } from '@/hooks/useModulos'
import { useListado } from '@/hooks/useListado'
import {
  plantillasDisponibles,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import { CardPlantilla } from '@/app/(flux)/flujos/_componentes/EstadoVacioFlujos'
import { useCrearFlujo } from '@/app/(flux)/flujos/_componentes/useCrearFlujo'
import { iconoLucide } from '@/app/(flux)/flujos/_componentes/iconos-plantilla'
import type { EstadoFlujo } from '@/tipos/workflow'
import { construirParametrosListado } from './parametros-listado'

// =============================================================
// Tipo local — solo los campos que la sección consume del listado.
// El endpoint devuelve más; declaramos lo mínimo para que el día
// que cambie un campo no usado no nos rompa.
// =============================================================

interface FilaFlujoSeccion {
  id: string
  nombre: string
  estado: EstadoFlujo
  icono: string | null
  color: string | null
  ultima_ejecucion_en: string | null
  total_ejecuciones_30d: number | null
}

// =============================================================
// Pill de estado — local. Misma paleta que el listado central
// pero redefinida acá para no acoplar a un componente privado de
// otro archivo (los pills del listado central viven dentro de su
// `ContenidoFlujos.tsx` y no están exportados).
// =============================================================

const COLOR_ESTADO: Record<EstadoFlujo, ColorInsignia> = {
  activo: 'exito',
  pausado: 'advertencia',
  borrador: 'neutro',
}

function PillEstado({ estado }: { estado: EstadoFlujo }) {
  const { t } = useTraduccion()
  return (
    <Insignia color={COLOR_ESTADO[estado]} tamano="sm">
      {t(`flujos.estados.${estado}`)}
    </Insignia>
  )
}

// =============================================================
// Props del componente
// =============================================================

interface Props {
  /**
   * Lista de `entidad_tipo` para filtrar el listado por módulo. Ej:
   * `['actividad']`, `['visita']`, `['presupuesto', 'cuota']`. Se
   * manda como `?modulo=<csv>` al endpoint.
   */
  modulos?: readonly string[]
  /**
   * Lista de tipos de disparador. Filtro alternativo para módulos
   * cuyos disparadores NO tienen `entidad_tipo` (ej: inbox.* hoy,
   * potencialmente tiempo.cron mañana). Se manda como
   * `?tipo_disparador=<csv>`.
   */
  tiposDisparador?: readonly string[]
  /**
   * Slugs de `PlantillaSugerida.modulo` para filtrar el catálogo.
   * Ej: `['cuota', 'presupuesto']` para presupuestos+cuotas,
   * `['inbox_whatsapp']` para inbox.
   */
  modulosPlantillas: readonly string[]
  /**
   * URL al listado central con filtro pre-aplicado. Ej:
   * `/flujos?modulo=presupuesto`. Si hay multi módulos (ej:
   * presupuesto+cuota), apuntar al primero — el listado central
   * todavía no soporta CSV en URL.
   */
  hrefVerTodos: string
  /**
   * Clave única para el cache de useListado. Permite que distintas
   * páginas de configuración no compartan caché aunque pidan
   * (casualmente) los mismos parámetros.
   */
  claveCache: string
}

// =============================================================
// Componente
// =============================================================

export function SeccionFlujosModulo({
  modulos,
  tiposDisparador,
  modulosPlantillas,
  hrefVerTodos,
  claveCache,
}: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const { tienePermiso } = useRol()
  const { tieneModulo } = useModulos()

  const puedeVer = tienePermiso('flujos', 'ver')
  const puedeCrear = tienePermiso('flujos', 'crear')

  // ─── Listado de flujos del módulo ───────────────────────────────
  // Se monta solo si hay permiso `ver`. El hook respeta `habilitado`
  // y no dispara fetch cuando es false (mismo patrón que la sección
  // del chatter en 19.6).

  const parametros = useMemo(
    () => construirParametrosListado({ modulos, tiposDisparador }),
    [modulos, tiposDisparador],
  )

  const { datos, total, cargandoInicial } = useListado<FilaFlujoSeccion>({
    clave: claveCache,
    url: '/api/flujos',
    parametros,
    extraerDatos: (json) => (json.flujos || []) as FilaFlujoSeccion[],
    extraerTotal: (json) => (json.total || 0) as number,
    habilitado: puedeVer,
  })

  // ─── Plantillas curadas filtradas por módulo ────────────────────
  // `plantillasDisponibles` ya filtra por módulos instalados; encima
  // filtramos por la lista que pasó la página de configuración.

  const plantillasFiltradas = useMemo<PlantillaSugerida[]>(() => {
    const todas = plantillasDisponibles(tieneModulo)
    return todas.filter((p) => modulosPlantillas.includes(p.modulo))
  }, [tieneModulo, modulosPlantillas])

  // ─── Hook de creación desde plantilla (compartido con ModalNuevoFlujo) ─
  const { creando, crearDesdePlantilla } = useCrearFlujo()

  // ─── Reglas de visibilidad ──────────────────────────────────────
  if (!puedeVer) return null

  const mostrarLista = total > 0
  const mostrarPlantillas = puedeCrear && plantillasFiltradas.length > 0
  // Defensivo: si no hay nada para mostrar, devolvemos null.
  // En módulos cubiertos por 19.7 esto solo pasa cuando el usuario
  // no tiene `crear` Y no tiene flujos creados todavía.
  if (!mostrarLista && !mostrarPlantillas) return null

  return (
    <div className="flex flex-col gap-6">
      {mostrarLista && (
        <BloqueListado
          total={total}
          datos={datos}
          cargandoInicial={cargandoInicial}
          hrefVerTodos={hrefVerTodos}
          formatearFecha={(iso) => formato.fechaRelativa(iso)}
        />
      )}

      {mostrarPlantillas && (
        <BloquePlantillas
          plantillas={plantillasFiltradas}
          deshabilitado={creando}
          onUsar={(p) => void crearDesdePlantilla(p)}
        />
      )}
    </div>
  )
}

// =============================================================
// Bloque 1 — Lista compacta de flujos del módulo
// =============================================================

interface PropsBloqueListado {
  total: number
  datos: FilaFlujoSeccion[]
  cargandoInicial: boolean
  hrefVerTodos: string
  formatearFecha: (iso: string) => string
}

function BloqueListado({
  total,
  datos,
  cargandoInicial,
  hrefVerTodos,
  formatearFecha,
}: PropsBloqueListado) {
  const { t } = useTraduccion()
  const hayMas = total > datos.length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow size={14} className="text-texto-terciario shrink-0" />
          <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            {t('flujos.seccion_modulo.lista_titulo')}
          </span>
          <span className="text-xxs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <Link
          href={hrefVerTodos}
          className="text-xs text-texto-marca hover:underline flex items-center gap-1"
        >
          {t('flujos.seccion_modulo.lista_ver_todos')}
          <ArrowRight size={12} />
        </Link>
      </div>

      <ul className="flex flex-col rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
        {cargandoInicial && datos.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-texto-terciario">
            {t('flujos.seccion_modulo.cargando')}
          </li>
        ) : (
          datos.map((flujo) => (
            <FilaFlujoModulo
              key={flujo.id}
              flujo={flujo}
              fechaRelativa={
                flujo.ultima_ejecucion_en
                  ? formatearFecha(flujo.ultima_ejecucion_en)
                  : null
              }
            />
          ))
        )}
      </ul>

      {hayMas && (
        <Link
          href={hrefVerTodos}
          className="text-xs text-texto-terciario hover:text-texto-secundario self-end flex items-center gap-1"
        >
          {`+${total - datos.length} ${t('flujos.seccion_modulo.lista_mas_sufijo')}`}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

function FilaFlujoModulo({
  flujo,
  fechaRelativa,
}: {
  flujo: FilaFlujoSeccion
  fechaRelativa: string | null
}) {
  const { t } = useTraduccion()
  const Icono = iconoLucide(flujo.icono)
  return (
    <li>
      <Link
        href={`/flujos/${flujo.id}`}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-superficie-hover transition-colors border-b border-borde-sutil last:border-b-0"
      >
        <div className="size-8 shrink-0 rounded-md border border-borde-sutil bg-superficie-app flex items-center justify-center text-texto-terciario">
          <Icono size={14} strokeWidth={1.6} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-texto-primario truncate">
            {flujo.nombre}
          </span>
          <span className="text-xxs text-texto-terciario">
            {fechaRelativa
              ? `${t('flujos.seccion_modulo.ultima_ejecucion_prefijo')}${fechaRelativa}`
              : t('flujos.seccion_modulo.sin_ejecutar')}
          </span>
        </div>
        <div className="shrink-0">
          <PillEstado estado={flujo.estado} />
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 text-texto-terciario"
          strokeWidth={1.6}
        />
      </Link>
    </li>
  )
}

// =============================================================
// Bloque 2 — Grid de plantillas curadas
// =============================================================

function BloquePlantillas({
  plantillas,
  deshabilitado,
  onUsar,
}: {
  plantillas: PlantillaSugerida[]
  deshabilitado: boolean
  onUsar: (p: PlantillaSugerida) => void
}) {
  const { t } = useTraduccion()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-texto-marca shrink-0" />
        <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
          {t('flujos.seccion_modulo.plantillas_titulo')}
        </span>
      </div>
      <p className="text-xs text-texto-terciario leading-relaxed max-w-2xl">
        {t('flujos.seccion_modulo.plantillas_descripcion')}
      </p>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${deshabilitado ? 'opacity-60 pointer-events-none' : ''}`}
        aria-busy={deshabilitado}
      >
        {plantillas.map((p) => (
          <CardPlantilla key={p.id} plantilla={p} onClick={() => onUsar(p)} />
        ))}
      </div>
    </div>
  )
}

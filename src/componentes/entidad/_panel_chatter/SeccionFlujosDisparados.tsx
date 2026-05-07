'use client'

/**
 * SeccionFlujosDisparados — sección "Flujos disparados" en el chatter
 * de cualquier entidad (sub-PR 19.6 commit 5).
 *
 * Lista las últimas ejecuciones que tuvieron a esta entidad como
 * disparadora. Click en una fila navega al editor del flujo en tab
 * Historial con `?ejecucion=<id>` — el drawer del editor abre en esa
 * ejecución (decisión D5: una sola fuente de verdad para el detalle).
 *
 * Reglas de visibilidad:
 *   - Si el usuario no tiene permiso `flujos.ver`, la sección no se
 *     monta (cero fetch, cero ruido).
 *   - Si el endpoint devuelve 0 ejecuciones, tampoco se renderiza
 *     (criterio: cero ruido cuando no hay nada que mostrar).
 *
 * Deuda potencial anotada por el coordinador: si en el futuro emerge
 * dolor por "salir del contexto" al hacer click, se puede mover el
 * drawer a montarse in-place dentro del chatter en vez de navegar al
 * editor. No bloquea ahora.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { Workflow } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useRol } from '@/hooks/useRol'
import { useListado } from '@/hooks/useListado'
import EstadoEjecucionPill from '@/app/(flux)/flujos/[id]/_componentes/_historial/EstadoEjecucionPill'
import type { EjecucionFlujo } from '@/tipos/workflow'

const POR_PAGINA = 5

interface FilaEjecucionChatter extends EjecucionFlujo {
  flujo_nombre: string | null
  flujo_estado: string | null
}

interface Props {
  entidadTipo: string
  entidadId: string
}

export function SeccionFlujosDisparados({ entidadTipo, entidadId }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const { tienePermiso } = useRol()
  const puedeVerFlujos = tienePermiso('flujos', 'ver')

  // Sólo carga si el usuario tiene permiso. El hook respeta `habilitado`
  // y no dispara fetch cuando es false — evita ruido en el panel para
  // usuarios sin acceso al módulo de flujos.
  const { datos, total } = useListado<FilaEjecucionChatter>({
    clave: `chatter-flujos-${entidadTipo}-${entidadId}`,
    url: '/api/ejecuciones',
    parametros: {
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      pagina: 1,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.ejecuciones || []) as FilaEjecucionChatter[],
    extraerTotal: (json) => (json.total || 0) as number,
    habilitado: puedeVerFlujos,
  })

  // Sin permiso o sin ejecuciones → no renderizamos la sección entera.
  // La idea es que el chatter no tenga un encabezado vacío diciendo
  // "Sin flujos" cada vez que se abre — sólo aparece cuando hay algo.
  if (!puedeVerFlujos || total === 0) return null

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta">
      <div className="px-3 py-2 border-b border-borde-sutil flex items-center gap-1.5">
        <Workflow size={13} className="text-texto-terciario shrink-0" />
        <span className="text-xs font-semibold text-texto-primario">
          {t('flujos.historial.chatter.titulo')}
        </span>
        <span className="text-xxs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded-full">
          {total}
        </span>
      </div>

      <ul className="flex flex-col">
        {datos.map((ej) => (
          <FilaEjecucionFlujo
            key={ej.id}
            ejecucion={ej}
            fechaRelativa={formato.fechaRelativa(ej.creado_en)}
          />
        ))}
      </ul>
    </div>
  )
}

// ─── Fila ────────────────────────────────────────────────────────────

function FilaEjecucionFlujo({
  ejecucion,
  fechaRelativa,
}: {
  ejecucion: FilaEjecucionChatter
  fechaRelativa: string
}) {
  const { t } = useTraduccion()
  // Link directo al editor del flujo en tab Historial con drawer abierto
  // en esta ejecución — el editor lee el query y monta el drawer.
  const href = useMemo(
    () =>
      `/flujos/${ejecucion.flujo_id}?vista=historial&ejecucion=${ejecucion.id}`,
    [ejecucion.flujo_id, ejecucion.id],
  )

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 px-3 py-2 hover:bg-superficie-hover transition-colors border-b border-borde-sutil last:border-b-0"
      >
        <div className="size-7 shrink-0 rounded-md border border-borde-sutil bg-superficie-app flex items-center justify-center text-texto-terciario">
          <Workflow size={13} strokeWidth={1.6} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-texto-primario truncate">
            {ejecucion.flujo_nombre ??
              t('flujos.historial.chatter.flujo_sin_nombre')}
          </span>
          <span className="text-xxs text-texto-terciario">{fechaRelativa}</span>
        </div>
        <div className="shrink-0">
          <EstadoEjecucionPill estado={ejecucion.estado} />
        </div>
      </Link>
    </li>
  )
}

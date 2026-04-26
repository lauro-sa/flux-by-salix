'use client'

/**
 * WidgetOrdenesResumen — Stat card pequeña con métricas operativas de
 * Órdenes de Trabajo: activas vs completadas del mes + tiempo promedio
 * de cierre. Diseño compacto para grid de pequeños.
 */

import { useRouter } from 'next/navigation'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'

interface Props {
  porEstado: Record<string, number>
  completadasMes: number
  tiempoPromedioCierreDias: number
  total: number
}

export function WidgetOrdenesResumen({
  porEstado, completadasMes, tiempoPromedioCierreDias, total,
}: Props) {
  const router = useRouter()

  // Activas = abiertas + en progreso + esperando (todo lo que no está cerrado)
  const cantActivas = (porEstado.abierta || 0) + (porEstado.en_progreso || 0) + (porEstado.esperando || 0)
  const cantEnProgreso = porEstado.en_progreso || 0
  const cantEsperando = porEstado.esperando || 0
  const cantAbiertas = porEstado.abierta || 0

  if (total === 0) return null

  return (
    <div className="h-full rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-borde-sutil/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <ClipboardList size={14} className="text-texto-marca" />
          <h3 className="text-xs font-semibold text-texto-primario truncate">Órdenes de trabajo</h3>
          <InfoBoton
            titulo="Órdenes de trabajo"
            tamano={12}
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra el <strong className="text-texto-primario">estado operativo de tu
                    producción</strong>: cuántos trabajos tenés en curso, cuántos terminaste este mes y
                    qué tan rápido los completás.
                  </p>
                ),
              },
              {
                titulo: 'Qué es una OT',
                contenido: (
                  <p>
                    Una <strong className="text-texto-primario">Orden de Trabajo</strong> se genera cuando
                    un presupuesto se aprueba y empieza la ejecución. Mientras el Pipeline mide la parte
                    comercial (vender), las OT miden la parte operativa (entregar).
                  </p>
                ),
              },
              {
                titulo: 'Estados de una OT',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">Abierta:</strong> creada pero todavía no
                      arrancó la ejecución.
                    </li>
                    <li>
                      <strong className="text-texto-primario">En progreso:</strong> el equipo está
                      trabajando ahora mismo.
                    </li>
                    <li>
                      <strong className="text-texto-primario">Esperando:</strong> pausada por algún motivo
                      (faltan materiales, aprobación del cliente, etc.).
                    </li>
                    <li>
                      <strong className="text-insignia-exito-texto">Completada:</strong> terminada y
                      entregada.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Tiempo de cierre',
                contenido: (
                  <p>
                    Es el <strong className="text-texto-primario">promedio de días</strong> que pasan
                    entre que se crea una OT y se completa. Te dice qué tan eficiente es tu producción.
                  </p>
                ),
              },
              {
                titulo: 'Cómo interpretarlo',
                contenido: (
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>Si tenés muchas OT en <strong>&quot;Esperando&quot;</strong>, hay cuellos de botella —revisá qué las traba.</li>
                    <li>Si las completadas del mes bajan vs el promedio, tu equipo está produciendo menos.</li>
                    <li>Si el tiempo de cierre sube, los trabajos se están alargando.</li>
                  </ul>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot;:</strong>{' '}
                      <span className="text-texto-terciario">los presupuestos en estado &quot;Orden de
                      venta&quot; del Pipeline son los que tienen una OT activa. Si vendés más rápido de
                      lo que producís, se acumula el backlog.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Cobros&quot;:</strong>{' '}
                      <span className="text-texto-terciario">una OT completada normalmente dispara un
                      cobro final. Si las OT se completan pero los cobros no llegan, hay morosidad.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => router.push('/ordenes')}
          className="text-xxs text-texto-terciario hover:text-texto-marca transition-colors shrink-0"
          aria-label="Ver órdenes"
        >
          <ArrowRight size={11} />
        </button>
      </div>

      {/* KPI principal */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[10px] uppercase tracking-widest text-texto-terciario mb-1">Activas</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-light tabular-nums text-texto-primario leading-none">
            {cantActivas}
          </span>
          <span className="text-xxs text-texto-terciario">
            de {total} totales
          </span>
        </div>
      </div>

      {/* Desglose por estado */}
      <div className="px-4 pb-3 pt-1 space-y-1 text-xxs">
        {cantAbiertas > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-texto-terciario">Abiertas</span>
            <span className="font-medium tabular-nums text-texto-secundario">{cantAbiertas}</span>
          </div>
        )}
        {cantEnProgreso > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-texto-terciario">En progreso</span>
            <span className="font-medium tabular-nums text-texto-marca">{cantEnProgreso}</span>
          </div>
        )}
        {cantEsperando > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-texto-terciario">Esperando</span>
            <span className="font-medium tabular-nums text-insignia-advertencia-texto">{cantEsperando}</span>
          </div>
        )}
      </div>

      {/* Footer: completadas del mes + tiempo promedio (pegado al fondo) */}
      <div className="mt-auto border-t border-borde-sutil/40 px-4 py-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-texto-terciario">Mes</p>
          <p className="text-sm font-semibold tabular-nums text-insignia-exito-texto leading-tight">
            {completadasMes}
            <span className="text-xxs text-texto-terciario font-normal ml-1">
              {completadasMes === 1 ? 'completada' : 'completadas'}
            </span>
          </p>
        </div>
        {tiempoPromedioCierreDias > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-texto-terciario">Cierre prom.</p>
            <p className="text-sm font-semibold tabular-nums text-texto-primario leading-tight">
              {tiempoPromedioCierreDias}
              <span className="text-xxs text-texto-terciario font-normal ml-1">
                {tiempoPromedioCierreDias === 1 ? 'día' : 'días'}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

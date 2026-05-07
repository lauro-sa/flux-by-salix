'use client'

import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import type { EstadoEjecucion } from '@/tipos/workflow'
import { colorEstadoEjecucion } from './formato-ejecucion'

/**
 * EstadoEjecucionPill — pill semántica para el estado de una ejecución.
 *
 * Reusada en: tabla de historial (columna estado), drawer de detalle
 * (header con pill grande), chatter "Flujos disparados" (chip de fila).
 *
 * El tamaño se controla con `tamano` siguiendo el contrato de `Insignia`.
 * Las claves de i18n viven en `flujos.historial.estados.*`.
 */
export default function EstadoEjecucionPill({
  estado,
  tamano = 'sm',
}: {
  estado: EstadoEjecucion
  tamano?: 'sm' | 'md'
}) {
  const { t } = useTraduccion()
  return (
    <Insignia color={colorEstadoEjecucion(estado)} tamano={tamano}>
      {t(`flujos.historial.estados.${estado}`)}
    </Insignia>
  )
}

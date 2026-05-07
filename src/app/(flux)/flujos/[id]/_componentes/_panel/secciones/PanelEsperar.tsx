'use client'

import { useMemo } from 'react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import type { AccionEsperar, AccionWorkflow } from '@/tipos/workflow'

/**
 * Panel para `accion: esperar` (sub-PR 19.3a).
 *
 * El shape `AccionEsperar` admite dos modos mutuamente exclusivos:
 *   • `duracion_ms`  — delay relativo (1s mínimo, 30 días máximo).
 *   • `hasta_fecha`  — esperar hasta un timestamp absoluto.
 *
 * En 19.3a solo soportamos `duracion_ms` (caso del 95%). El modo
 * "hasta_fecha" llega en un sub-PR posterior con selector de fecha
 * dedicado. Si llegamos a un paso con `hasta_fecha` ya guardado, lo
 * mostramos como ayuda en read-only — el usuario puede seguir editando
 * la duración pero no la fecha desde acá.
 *
 * Conversión cantidad ↔ ms:
 *   minutos  → ms / 60_000
 *   horas    → ms / 3_600_000
 *   dias     → ms / 86_400_000
 *
 * La unidad "que más alto da con módulo cero" es la default al cargar.
 * Si guardamos siempre como ms y reconstruimos al pintar, evitamos
 * pérdida de precisión por doble conversión.
 */

type Unidad = 'min' | 'hora' | 'dia'

const FACTOR: Record<Unidad, number> = {
  min: 60_000,
  hora: 3_600_000,
  dia: 86_400_000,
}

/** Devuelve la unidad "más natural" para mostrar un valor en ms. */
function unidadNatural(ms: number): Unidad {
  if (ms % FACTOR.dia === 0 && ms >= FACTOR.dia) return 'dia'
  if (ms % FACTOR.hora === 0 && ms >= FACTOR.hora) return 'hora'
  return 'min'
}

interface Props {
  paso: AccionEsperar
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
}

export default function PanelEsperar({ paso, soloLectura, onCambiar }: Props) {
  const { t } = useTraduccion()

  // Valor actual en ms (default 1 minuto si no hay ninguno guardado).
  const ms = typeof paso.duracion_ms === 'number' ? paso.duracion_ms : 60_000
  const unidad = useMemo<Unidad>(() => unidadNatural(ms), [ms])
  const cantidad = Math.max(1, Math.round(ms / FACTOR[unidad]))

  const opcionesUnidad = [
    { valor: 'min', etiqueta: t('flujos.editor.panel.esperar.unidad_min') },
    { valor: 'hora', etiqueta: t('flujos.editor.panel.esperar.unidad_hora') },
    { valor: 'dia', etiqueta: t('flujos.editor.panel.esperar.unidad_dia') },
  ]

  const handleCantidad = (valor: string) => {
    const n = Number(valor)
    if (!Number.isFinite(n) || n <= 0) return
    onCambiar({ duracion_ms: Math.round(n * FACTOR[unidad]), hasta_fecha: undefined })
  }

  const handleUnidad = (nuevo: string) => {
    const u = nuevo as Unidad
    onCambiar({ duracion_ms: cantidad * FACTOR[u], hasta_fecha: undefined })
  }

  // Si el paso tiene `hasta_fecha` configurado, lo señalamos como ayuda
  // read-only para no perder visibilidad del modo absoluto.
  const tieneFechaAbsoluta = typeof paso.hasta_fecha === 'string' && paso.hasta_fecha.length > 0

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.tiempo')}>
        <div className="grid grid-cols-2 gap-3">
          <Input
            tipo="number"
            etiqueta={t('flujos.editor.panel.esperar.cantidad_label')}
            value={cantidad}
            onChange={(e) => handleCantidad(e.target.value)}
            disabled={soloLectura}
            min={1}
            formato={null}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-texto-secundario">
              {t('flujos.editor.panel.esperar.unidad_label')}
            </span>
            {soloLectura ? (
              <div className="text-sm text-texto-secundario py-2">
                {opcionesUnidad.find((o) => o.valor === unidad)?.etiqueta ?? unidad}
              </div>
            ) : (
              <Select opciones={opcionesUnidad} valor={unidad} onChange={handleUnidad} />
            )}
          </div>
        </div>
        <p className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.esperar.ayuda')}
        </p>
        {tieneFechaAbsoluta && (
          <p className="text-xs text-insignia-advertencia-texto leading-relaxed">
            {t('flujos.editor.panel.esperar.ayuda_fecha_absoluta').replace(
              '{{fecha}}',
              paso.hasta_fecha as string,
            )}
          </p>
        )}
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <p className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.avanzado.proximamente')}
        </p>
      </SeccionPanel>
    </>
  )
}

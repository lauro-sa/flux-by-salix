'use client'

import { useEffect, useState } from 'react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Texto reactivo del indicador de guardado del header del editor.
 *
 *   guardando=true                  → "Guardando..."
 *   ultimoGuardado=null              → ""        (sin guardar todavía)
 *   ultimoGuardado=hace <60s         → "Guardado"
 *   ultimoGuardado=hace 1 a 59 min   → "Guardado hace 5 min"
 *   ultimoGuardado=hace ≥ 1 h        → "Guardado hace 2 h"
 *
 * Implementado con `setInterval` cada 30 s para que el "hace X min"
 * avance sin re-renders innecesarios. Si `guardando` o
 * `ultimoGuardado` cambian, el estado se recalcula al toque.
 */

export function useIndicadorGuardado(
  guardando: boolean,
  ultimoGuardado: number | null,
): string {
  const { t } = useTraduccion()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (guardando || ultimoGuardado === null) return
    const id = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(id)
  }, [guardando, ultimoGuardado])

  if (guardando) return t('flujos.editor.indicador.guardando')
  if (ultimoGuardado === null) return ''

  // Mantener referencia a `tick` para que TS no lo flague como unused
  // y el lector entienda que el cálculo siguiente depende del tiempo.
  void tick

  const segundos = Math.max(0, Math.floor((Date.now() - ultimoGuardado) / 1000))
  if (segundos < 60) return t('flujos.editor.indicador.guardado')
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) {
    return t('flujos.editor.indicador.guardado_hace_min').replace('{{n}}', String(minutos))
  }
  const horas = Math.floor(minutos / 60)
  return t('flujos.editor.indicador.guardado_hace_h').replace('{{n}}', String(horas))
}

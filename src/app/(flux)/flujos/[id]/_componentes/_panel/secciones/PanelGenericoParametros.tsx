'use client'

import { useEffect, useState } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'

/**
 * Panel JSON crudo + cartel honesto para tipos de acción aún sin UI
 * dedicada (sub-PR 19.3d).
 *
 * Aplica a: webhook_saliente, esperar_evento, crear_orden_trabajo,
 * crear_visita.
 *
 * Comportamiento:
 *   • Cartel arriba: explica qué tipo es y advierte que es JSON crudo,
 *     que si no parsea el cambio no se guarda.
 *   • Textarea con JSON formateado (indent 2) del campo `parametros`.
 *   • Validación on-blur: si parsea OK, mergea via `onCambiar`. Si
 *     falla, marca borde rojo y conserva el último valor válido en el
 *     state interno — el cambio NO sube al hook, así no rompemos el
 *     PUT diff-only.
 *   • Botón "Formatear" que re-indenta si parsea OK.
 *
 * Diseño honesto: el cartel le dice al usuario exactamente qué pasa
 * si el JSON está mal. Cero magia.
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  /** Etiqueta legible del tipo (ej: "Crear orden de trabajo"). */
  tipoLegible: string
}

export default function PanelGenericoParametros({
  paso,
  soloLectura,
  onCambiar,
  tipoLegible,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}

  // Texto del textarea (siempre lo más legible disponible).
  const [borrador, setBorrador] = useState(() => JSON.stringify(params, null, 2))
  const [error, setError] = useState<string | null>(null)

  // Si el `paso` cambia desde fuera (ej: undo/redo del editor o reload),
  // re-sincronizamos el borrador siempre que NO esté en estado de error
  // (para no pisar lo que el usuario está editando).
  useEffect(() => {
    if (!error) {
      setBorrador(JSON.stringify(params, null, 2))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso])

  const validarYGuardar = (texto: string) => {
    try {
      const parsed = JSON.parse(texto)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError(t('flujos.editor.panel.generico_json.error_no_objeto'))
        return
      }
      setError(null)
      onCambiar({ parametros: parsed as Record<string, unknown> } as Partial<AccionWorkflow>)
    } catch {
      setError(t('flujos.editor.panel.generico_json.error_parse'))
    }
  }

  const formatear = () => {
    try {
      const parsed = JSON.parse(borrador)
      const formateado = JSON.stringify(parsed, null, 2)
      setBorrador(formateado)
      setError(null)
    } catch {
      setError(t('flujos.editor.panel.generico_json.error_parse'))
    }
  }

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <div className="rounded-md border border-insignia-info/40 bg-insignia-info/5 px-3 py-2.5 text-xs text-texto-secundario leading-relaxed">
        <p className="font-medium text-texto-primario mb-1">
          {t('flujos.editor.panel.generico_json.cartel_titulo').replace('{{tipo}}', tipoLegible)}
        </p>
        <p>{t('flujos.editor.panel.generico_json.cartel_descripcion')}</p>
        <p className="mt-1 text-texto-terciario">
          {t('flujos.editor.panel.generico_json.cartel_aviso_no_guarda')}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <textarea
          value={borrador}
          onChange={(e) => {
            setBorrador(e.target.value)
            // Validación liviana en cada keystroke para feedback rápido,
            // pero el guardado real es onBlur.
            try {
              JSON.parse(e.target.value)
              setError(null)
            } catch {
              // Silencioso — el error se persiste si seguimos mal en blur.
            }
          }}
          onBlur={(e) => validarYGuardar(e.target.value)}
          disabled={soloLectura}
          spellCheck={false}
          rows={10}
          className={[
            'w-full rounded-input bg-superficie-tarjeta px-3 py-2 text-sm font-mono outline-none transition-colors resize-y',
            error
              ? 'border-2 border-insignia-peligro'
              : 'border border-borde-fuerte focus:border-borde-foco focus:shadow-foco',
          ].join(' ')}
        />
        {error && (
          <span className="text-xs text-insignia-peligro-texto leading-relaxed">{error}</span>
        )}
      </div>

      {!soloLectura && (
        <button
          type="button"
          onClick={formatear}
          className="self-start text-xs text-texto-secundario hover:text-texto-primario underline cursor-pointer"
        >
          {t('flujos.editor.panel.generico_json.formatear')}
        </button>
      )}
    </SeccionPanel>
  )
}

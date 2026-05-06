'use client'

import { Trash2 } from 'lucide-react'
import { Select } from '@/componentes/ui/Select'
import { useTraduccion } from '@/lib/i18n'
import InputConVariables from '../../../_picker/InputConVariables'
import { OPERADORES_BUILDER, type DefinicionOperador } from './operadores'
import type { CondicionHoja, OperadorComparacion } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Fila individual del builder de condiciones del Branch (sub-PR 19.3c).
 *
 * Layout horizontal en desktop, vertical compacto en mobile:
 *   [Variable {{...}}]  [op ▾]  [Valor {{...}}]   [×]
 *
 * Variable y valor usan `InputConVariables` para que ambos acepten
 * picker de variables. El operador es un `Select` con los símbolos
 * canónicos definidos en `operadores.ts`.
 *
 * Si el operador es unario (`existe` / `no_existe`), el input de valor
 * desaparece — la condición no necesita comparar nada, solo verifica
 * presencia del campo.
 */

interface Props {
  condicion: CondicionHoja
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
  soloLectura: boolean
  onCambiar: (nueva: CondicionHoja) => void
  onEliminar: () => void
}

export default function FilaCondicion({
  condicion,
  fuentes,
  contexto,
  soloLectura,
  onCambiar,
  onEliminar,
}: Props) {
  const { t } = useTraduccion()

  const opcionesOperador = OPERADORES_BUILDER.map((op: DefinicionOperador) => ({
    valor: op.motor,
    etiqueta: `${op.simbolo}  ${t(op.claveI18nEtiqueta)}`,
  }))

  const definicion = OPERADORES_BUILDER.find((o) => o.motor === condicion.operador) ?? OPERADORES_BUILDER[0]
  const valorComoString = (() => {
    if (condicion.valor === undefined || condicion.valor === null) return ''
    if (typeof condicion.valor === 'string') return condicion.valor
    return String(condicion.valor)
  })()

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-2">
      <div className="flex-1 min-w-0">
        <InputConVariables
          valor={condicion.campo}
          onChange={(v) => onCambiar({ ...condicion, campo: v })}
          placeholder={t('flujos.editor.panel.branch.fila.variable_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
          ariaLabel={t('flujos.editor.panel.branch.fila.variable_label')}
        />
      </div>

      <div className="md:w-[150px] shrink-0">
        {soloLectura ? (
          <div className="text-sm text-texto-secundario py-2 px-3">
            {definicion.simbolo}
          </div>
        ) : (
          <Select
            opciones={opcionesOperador}
            valor={condicion.operador}
            onChange={(v) => onCambiar({ ...condicion, operador: v as OperadorComparacion })}
          />
        )}
      </div>

      {definicion.requiereValor && (
        <div className="flex-1 min-w-0">
          <InputConVariables
            valor={valorComoString}
            onChange={(v) => onCambiar({ ...condicion, valor: v })}
            placeholder={t('flujos.editor.panel.branch.fila.valor_placeholder')}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.branch.fila.valor_label')}
          />
        </div>
      )}

      {!soloLectura && (
        <button
          type="button"
          onClick={onEliminar}
          aria-label={t('flujos.editor.panel.branch.fila.eliminar')}
          className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-texto-terciario hover:bg-insignia-peligro-fondo/50 hover:text-insignia-peligro-texto transition-colors cursor-pointer self-start mt-0.5"
        >
          <Trash2 size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}

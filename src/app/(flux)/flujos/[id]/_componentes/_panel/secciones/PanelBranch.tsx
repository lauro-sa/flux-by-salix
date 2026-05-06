'use client'

import { Plus } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import FilaCondicion from './_branch/FilaCondicion'
import type {
  AccionCondicionBranch,
  AccionWorkflow,
  CondicionCompuesta,
  CondicionHoja,
  CondicionWorkflow,
} from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: condicion_branch` (sub-PR 19.3c).
 *
 * Constructor visual con operador uniforme Y/O (sin paréntesis anidados,
 * regla del plan §1.7.3). El JSON resultante SIEMPRE tiene shape
 * `CondicionCompuesta` aunque haya una sola fila — un solo formato de
 * ida/vuelta sin branching.
 *
 * El motor SOPORTA anidación (PROFUNDIDAD_MAX = 5 runtime, tope
 * estructural en 10 según `tipos/workflow.ts → esCondicionWorkflow`).
 * En 19.3c NO la exponemos visualmente para mantener el builder simple
 * — deuda diferida a un sub-PR posterior cuando aparezca la necesidad
 * real (caveat aceptado del coordinador).
 *
 * Las acciones de las ramas (acciones_si / acciones_no) NO se editan
 * desde este panel — viven en el canvas como sub-listas dentro del
 * branch card. Se reordenan ahí, se agregan ahí, se eliminan ahí.
 */

interface Props {
  paso: AccionCondicionBranch
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

/**
 * Normaliza la condición del paso a `CondicionCompuesta`. Si viene una
 * `CondicionHoja` (compatibilidad hacia atrás con builds que guardaron
 * un solo nivel directo), la envolvemos. Si está vacía / inválida,
 * arrancamos con una compuesta vacía.
 */
function asegurarCompuesta(c: CondicionWorkflow): CondicionCompuesta {
  if (typeof c === 'object' && c !== null && Array.isArray((c as CondicionCompuesta).condiciones)) {
    return c as CondicionCompuesta
  }
  // Si es hoja, envolver. Si está vacía, arrancar limpio.
  if (typeof c === 'object' && c !== null && typeof (c as CondicionHoja).campo === 'string') {
    return { operador: 'y', condiciones: [c as CondicionHoja] }
  }
  return { operador: 'y', condiciones: [] }
}

function condicionVacia(): CondicionHoja {
  return { campo: '', operador: 'igual', valor: '' }
}

export default function PanelBranch({ paso, soloLectura, onCambiar, fuentes, contexto }: Props) {
  const { t } = useTraduccion()
  const compuesta = asegurarCompuesta(paso.condicion)

  const escribir = (nueva: CondicionCompuesta) => {
    onCambiar({ condicion: nueva } as Partial<AccionWorkflow>)
  }

  const cambiarFila = (idx: number, nueva: CondicionHoja) => {
    const condiciones = [...compuesta.condiciones]
    condiciones[idx] = nueva
    escribir({ ...compuesta, condiciones })
  }

  const agregarFila = () => {
    escribir({ ...compuesta, condiciones: [...compuesta.condiciones, condicionVacia()] })
  }

  const eliminarFila = (idx: number) => {
    escribir({
      ...compuesta,
      condiciones: compuesta.condiciones.filter((_, i) => i !== idx),
    })
  }

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.condiciones')}>
        {/* Operador uniforme Y / O */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-texto-secundario shrink-0">
            {t('flujos.editor.panel.branch.operador_label')}
          </span>
          <div className="inline-flex rounded-md border border-borde-sutil overflow-hidden">
            <button
              type="button"
              onClick={() => !soloLectura && escribir({ ...compuesta, operador: 'y' })}
              disabled={soloLectura}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors',
                compuesta.operador === 'y'
                  ? 'bg-texto-marca/15 text-texto-marca'
                  : 'text-texto-secundario hover:bg-superficie-hover',
                soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              ].join(' ')}
            >
              {t('flujos.editor.panel.branch.operador_y')}
            </button>
            <button
              type="button"
              onClick={() => !soloLectura && escribir({ ...compuesta, operador: 'o' })}
              disabled={soloLectura}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors border-l border-borde-sutil',
                compuesta.operador === 'o'
                  ? 'bg-texto-marca/15 text-texto-marca'
                  : 'text-texto-secundario hover:bg-superficie-hover',
                soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              ].join(' ')}
            >
              {t('flujos.editor.panel.branch.operador_o')}
            </button>
          </div>
        </div>

        <p className="text-xs text-texto-terciario leading-relaxed">
          {compuesta.operador === 'y'
            ? t('flujos.editor.panel.branch.ayuda_y')
            : t('flujos.editor.panel.branch.ayuda_o')}
        </p>

        {/* Filas */}
        {compuesta.condiciones.length === 0 ? (
          <p className="text-xs text-texto-terciario py-3 text-center">
            {t('flujos.editor.panel.branch.sin_condiciones')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {compuesta.condiciones.map((c, idx) => {
              // Solo soportamos hojas en el builder. Si una condición es
              // compuesta (anidada), la mostramos en read-only para no
              // perderla y dejar al usuario re-editarla manual en JSON
              // futuro.
              if (Array.isArray((c as CondicionCompuesta).condiciones)) {
                return (
                  <div
                    key={idx}
                    className="rounded border border-insignia-advertencia/40 bg-insignia-advertencia/5 p-2 text-xs text-texto-secundario"
                  >
                    {t('flujos.editor.panel.branch.fila_anidada_no_editable')}
                  </div>
                )
              }
              return (
                <FilaCondicion
                  key={idx}
                  condicion={c as CondicionHoja}
                  fuentes={fuentes}
                  contexto={contexto}
                  soloLectura={soloLectura}
                  onCambiar={(nueva) => cambiarFila(idx, nueva)}
                  onEliminar={() => eliminarFila(idx)}
                />
              )
            })}
          </div>
        )}

        {!soloLectura && (
          <button
            type="button"
            onClick={agregarFila}
            className="self-start inline-flex items-center gap-1.5 h-8 px-2.5 text-sm font-medium rounded-md text-texto-marca hover:bg-texto-marca/10 transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.8} />
            {t('flujos.editor.panel.branch.agregar_condicion')}
          </button>
        )}
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.avanzado')} defaultAbierto={false}>
        <p className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.branch.ayuda_avanzado')}
        </p>
      </SeccionPanel>
    </>
  )
}

'use client'

import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorMiembro from '../selectores/SelectorMiembro'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: asignar_usuario` (sub-PR 19.3c).
 *
 * Asigna un usuario a la entidad disparadora. Shape de `parametros`
 * convenido en este sub-PR (el motor todavía no implementa esta acción
 * — sub-PR 15.X+ podrá leer estas claves):
 *   {
 *     entidad_id?: string  // {{entidad.id}} por default
 *     usuario_id: string   // del SelectorMiembro
 *   }
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelAsignarUsuario({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const usuarioId = typeof params.usuario_id === 'string' ? params.usuario_id : null
  const entidadId = typeof params.entidad_id === 'string' ? params.entidad_id : ''

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.asignar.usuario_label')}
        </span>
        <SelectorMiembro
          valor={usuarioId}
          onChange={(id) => cambiar({ usuario_id: id })}
          disabled={soloLectura}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.asignar.entidad_id_label')}
        </span>
        <InputConVariables
          valor={entidadId}
          onChange={(v) => cambiar({ entidad_id: v.length > 0 ? v : undefined })}
          placeholder="{{entidad.id}}"
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.asignar.entidad_id_ayuda')}
        </span>
      </div>
    </SeccionPanel>
  )
}

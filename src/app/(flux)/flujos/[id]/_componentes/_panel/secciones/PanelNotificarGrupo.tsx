'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel para `accion: notificar_grupo` (sub-PR 19.3c, ajustado en 19.3d).
 *
 * Notifica a un grupo de usuarios por su clave técnica (ej: "ventas",
 * "soporte").
 *
 * TODO (sub-PR 19.3d, deuda explícita): el coordinador validó que NO
 * existe endpoint `/api/grupos` ni equivalente con shape compatible al
 * hook `useAutocompleteRemoto`. Por la regla "no crear endpoint nuevo
 * en 19.3d", se difiere el SelectorGrupo. Migrar este Input texto a
 * `SelectorGrupo` cuando se implemente el endpoint en un sub-PR
 * posterior (probablemente cuando se aborde el módulo de
 * configuración de grupos / roles).
 *
 * Shape de parametros:
 *   {
 *     grupo_clave: string
 *     titulo: string
 *     cuerpo?: string
 *   }
 */

interface Props {
  paso: AccionGenerica
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelNotificarGrupo({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const grupoClave = typeof params.grupo_clave === 'string' ? params.grupo_clave : ''
  const titulo = typeof params.titulo === 'string' ? params.titulo : ''
  const cuerpo = typeof params.cuerpo === 'string' ? params.cuerpo : ''

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <Input
        etiqueta={t('flujos.editor.panel.notificar_grupo.grupo_label')}
        placeholder={t('flujos.editor.panel.notificar_grupo.grupo_placeholder')}
        value={grupoClave}
        onChange={(e) => cambiar({ grupo_clave: e.target.value })}
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.notificar_grupo.grupo_ayuda')}
      />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.notificar_grupo.titulo_label')}
        </span>
        <InputConVariables
          valor={titulo}
          onChange={(v) => cambiar({ titulo: v })}
          placeholder={t('flujos.editor.panel.notificar_grupo.titulo_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.notificar_grupo.cuerpo_label')}
        </span>
        <InputConVariables
          valor={cuerpo}
          onChange={(v) => cambiar({ cuerpo: v.length > 0 ? v : undefined })}
          placeholder={t('flujos.editor.panel.notificar_grupo.cuerpo_placeholder')}
          contexto={contexto}
          fuentes={fuentes}
          soloLectura={soloLectura}
        />
      </div>
    </SeccionPanel>
  )
}

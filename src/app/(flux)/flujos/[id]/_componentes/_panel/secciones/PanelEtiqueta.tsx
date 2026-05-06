'use client'

import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import type { AccionGenerica, AccionWorkflow } from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel compartido para `accion: agregar_etiqueta` y `quitar_etiqueta`
 * (sub-PR 19.3c).
 *
 * Shape de parametros:
 *   { entidad_id?: string; etiqueta_clave: string }
 *
 * El componente recibe `modo` ('agregar' | 'quitar') solo para mostrar
 * los textos correctos — el resto de la UI es idéntico.
 *
 * Selector de etiquetas con autocomplete contra el catálogo de
 * etiquetas configurables: deuda diferida (no había endpoint listo
 * en el grep de 19.3c). Mientras tanto, Input con clave técnica.
 */

interface Props {
  paso: AccionGenerica
  modo: 'agregar' | 'quitar'
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEtiqueta({
  paso,
  modo,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const params = paso.parametros ?? {}
  const claveEtiqueta = typeof params.etiqueta_clave === 'string' ? params.etiqueta_clave : ''
  const entidadId = typeof params.entidad_id === 'string' ? params.entidad_id : ''

  const cambiar = (parche: Record<string, unknown>) =>
    onCambiar({ parametros: { ...params, ...parche } } as Partial<AccionWorkflow>)

  const claveLabel = `flujos.editor.panel.etiqueta.${modo}_label`
  const clavePh = `flujos.editor.panel.etiqueta.${modo}_placeholder`

  return (
    <SeccionPanel titulo={t('flujos.editor.panel.seccion.basicos')}>
      <Input
        etiqueta={t(claveLabel)}
        placeholder={t(clavePh)}
        value={claveEtiqueta}
        onChange={(e) => cambiar({ etiqueta_clave: e.target.value })}
        disabled={soloLectura}
        formato={null}
        ayuda={t('flujos.editor.panel.etiqueta.clave_ayuda')}
      />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          {t('flujos.editor.panel.etiqueta.entidad_id_label')}
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
          {t('flujos.editor.panel.etiqueta.entidad_id_ayuda')}
        </span>
      </div>
    </SeccionPanel>
  )
}

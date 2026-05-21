'use client'

import { useTraduccion } from '@/lib/i18n'
import PanelEnviarCorreoTexto from './PanelEnviarCorreoTexto'
import PanelEnviarCorreoPlantilla from './PanelEnviarCorreoPlantilla'
import PanelEnviarRespuestaRapidaCorreo from './PanelEnviarRespuestaRapidaCorreo'
import type {
  AccionEnviarCorreoPlantilla,
  AccionEnviarRespuestaRapidaCorreo,
  AccionGenerica,
  AccionWorkflow,
} from '@/tipos/workflow'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'

/**
 * Panel unificado para enviar correo en sus 3 variantes (texto libre,
 * plantilla, respuesta rápida). En lugar de exponer 3 acciones
 * separadas en el catálogo, el catálogo muestra una sola "Enviar
 * correo" y dentro del panel un toggle elige el modo.
 *
 * Ventajas para el usuario:
 *   • Una sola decisión "voy a mandar un correo" — el modo se elige
 *     después según conveniencia.
 *   • Cambiar de modo sin tener que eliminar el paso y crear otro.
 *
 * Internamente cada modo sigue siendo un tipo distinto en el motor
 * (`enviar_correo_texto`, `enviar_correo_plantilla`,
 * `enviar_respuesta_rapida_correo`). Al cambiar el toggle se aplica
 * un parche que cambia el `tipo` + limpia los campos del modo
 * anterior (los seteamos a undefined para que no queden zombies en
 * el JSON guardado).
 */

type TipoCorreo =
  | 'enviar_correo_texto'
  | 'enviar_correo_plantilla'
  | 'enviar_respuesta_rapida_correo'

interface PasoCorreo {
  tipo: TipoCorreo
  parametros?: Record<string, unknown>
  plantilla_id?: string
  respuesta_rapida_id?: string
  destinatario_override?: string
  _preview_asunto?: string | null
  _preview_cuerpo?: string | null
}

interface Props {
  paso: PasoCorreo
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

export default function PanelEnviarCorreoUnificado({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const modo = paso.tipo

  /**
   * Cambia el modo limpiando los campos del modo anterior. El merge
   * que hace `actualizarPasoPorId` es shallow (`{...p, ...parche}`),
   * así que para "borrar" un campo hay que pasarlo explícito como
   * undefined. Sin esto, queda data zombie en el JSON guardado.
   */
  const cambiarA = (nuevoTipo: TipoCorreo) => {
    if (soloLectura || nuevoTipo === modo) return
    const parche: Record<string, unknown> = { tipo: nuevoTipo }
    // Limpieza por tipo destino: solo conservamos los campos válidos.
    if (nuevoTipo === 'enviar_correo_texto') {
      parche.plantilla_id = undefined
      parche.respuesta_rapida_id = undefined
      parche.destinatario_override = undefined
      parche.parametros = { destinatario: '', asunto: '', cuerpo: '' }
    } else if (nuevoTipo === 'enviar_correo_plantilla') {
      parche.respuesta_rapida_id = undefined
      parche.parametros = undefined
      parche.plantilla_id = paso.plantilla_id ?? ''
      parche.destinatario_override = paso.destinatario_override ?? ''
    } else if (nuevoTipo === 'enviar_respuesta_rapida_correo') {
      parche.plantilla_id = undefined
      parche.parametros = undefined
      parche.respuesta_rapida_id = paso.respuesta_rapida_id ?? ''
      parche.destinatario_override = paso.destinatario_override ?? ''
    }
    onCambiar(parche as Partial<AccionWorkflow>)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle de modo — mismo patrón que el branch builder. */}
      <div className="px-4 pt-3">
        <div className="inline-flex rounded-md border border-borde-sutil overflow-hidden flex-wrap">
          <BotonModo
            activo={modo === 'enviar_correo_texto'}
            onClick={() => cambiarA('enviar_correo_texto')}
            soloLectura={soloLectura}
          >
            {t('flujos.editor.panel.correo_unificado.modo_texto')}
          </BotonModo>
          <BotonModo
            activo={modo === 'enviar_correo_plantilla'}
            onClick={() => cambiarA('enviar_correo_plantilla')}
            soloLectura={soloLectura}
            conBorde
          >
            {t('flujos.editor.panel.correo_unificado.modo_plantilla')}
          </BotonModo>
          <BotonModo
            activo={modo === 'enviar_respuesta_rapida_correo'}
            onClick={() => cambiarA('enviar_respuesta_rapida_correo')}
            soloLectura={soloLectura}
            conBorde
          >
            {t('flujos.editor.panel.correo_unificado.modo_respuesta')}
          </BotonModo>
        </div>
      </div>

      {/* Panel específico según modo — reusamos los 3 paneles
          existentes sin cambios en su lógica interna. */}
      {modo === 'enviar_correo_texto' && (
        <PanelEnviarCorreoTexto
          paso={paso as AccionGenerica}
          soloLectura={soloLectura}
          onCambiar={onCambiar}
          fuentes={fuentes}
          contexto={contexto}
        />
      )}
      {modo === 'enviar_correo_plantilla' && (
        <PanelEnviarCorreoPlantilla
          paso={paso as AccionEnviarCorreoPlantilla & { _preview_asunto?: string | null; _preview_cuerpo?: string | null }}
          soloLectura={soloLectura}
          onCambiar={onCambiar}
          fuentes={fuentes}
          contexto={contexto}
        />
      )}
      {modo === 'enviar_respuesta_rapida_correo' && (
        <PanelEnviarRespuestaRapidaCorreo
          paso={paso as AccionEnviarRespuestaRapidaCorreo & { _preview_asunto?: string | null; _preview_cuerpo?: string | null }}
          soloLectura={soloLectura}
          onCambiar={onCambiar}
          fuentes={fuentes}
          contexto={contexto}
        />
      )}
    </div>
  )
}

function BotonModo({
  activo,
  onClick,
  soloLectura,
  conBorde = false,
  children,
}: {
  activo: boolean
  onClick: () => void
  soloLectura: boolean
  conBorde?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soloLectura}
      className={[
        'px-3 py-1.5 text-xs font-medium transition-colors',
        conBorde ? 'border-l border-borde-sutil' : '',
        activo
          ? 'bg-texto-marca/15 text-texto-marca'
          : 'text-texto-secundario hover:bg-superficie-hover',
        soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

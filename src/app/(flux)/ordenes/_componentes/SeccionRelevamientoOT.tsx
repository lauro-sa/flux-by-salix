'use client'

/**
 * SeccionRelevamientoOT — fotos + notas técnicas que vinieron del
 * relevamiento de la visita (sembradas automáticamente por
 * `sembrarRelevamientoOT`) más las que un gestor agregue manualmente
 * mientras la OT está abierta.
 *
 * Permisos:
 *   - Lectura: cualquiera que ve la OT.
 *   - Escritura/edición/eliminación: gestor (admin/creador/cabecilla).
 *
 * Si la OT todavía no tiene visita vinculada, se muestra un aviso
 * informativo sugiriendo vincular una (UI de vinculación queda fuera de
 * scope de esta primera versión — el botón es opt-out vía `onVisitaCambio`
 * que el caller decide cómo manejar).
 */

import { LinkIcon } from 'lucide-react'
import GaleriaOT from './GaleriaOT'

interface Props {
  ordenId: string
  visitaId: string | null
  contactoId: string | null
  puedeGestionar: boolean
  usuarioActualId: string | null
  onVisitaCambio?: (nuevaVisitaId: string | null) => void
}

export default function SeccionRelevamientoOT({
  ordenId,
  visitaId,
  puedeGestionar,
  usuarioActualId,
}: Props) {
  return (
    <div className="space-y-3">
      {!visitaId && (
        <div className="rounded-card border border-borde-sutil bg-superficie-app p-3 flex items-start gap-3">
          <LinkIcon size={16} className="text-texto-terciario mt-0.5 shrink-0" />
          <div className="text-xs text-texto-terciario">
            Esta orden todavía no tiene una visita vinculada. Cuando se vincule,
            el relevamiento de esa visita aparecerá acá automáticamente. Mientras
            tanto, podés cargar fotos y notas manualmente si tenés permisos de
            gestión.
          </div>
        </div>
      )}

      <GaleriaOT
        ordenId={ordenId}
        tipo="relevamiento"
        puedeGestionar={puedeGestionar}
        usuarioActualId={usuarioActualId}
        placeholder="Describí lo relevado: estado del equipo, mediciones, observaciones técnicas…"
        tituloVacio="Sin relevamiento todavía"
        descripcionVacio="Cuando se complete la visita, las fotos y notas se sembrarán acá. También podés agregarlas manualmente si tenés permisos."
      />
    </div>
  )
}

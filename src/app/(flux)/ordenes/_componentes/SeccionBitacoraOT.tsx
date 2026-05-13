'use client'

/**
 * SeccionBitacoraOT — feed cronológico de avances que los asignados cargan
 * durante la ejecución de la OT (fotos + notas de imprevistos, progresos).
 *
 * Permisos:
 *   - Lectura: cualquiera que ve la OT.
 *   - Creación: asignados a la OT o gestores.
 *   - Edición/eliminación: el autor de la entrada, o un gestor.
 *
 * Orden DESC (más nuevo primero), gestionado por la API.
 */

import GaleriaOT from './GaleriaOT'

interface Props {
  ordenId: string
  usuarioActualId: string | null
  puedeGestionar: boolean
  esAsignado: boolean
}

export default function SeccionBitacoraOT({
  ordenId,
  usuarioActualId,
  puedeGestionar,
  esAsignado,
}: Props) {
  return (
    <GaleriaOT
      ordenId={ordenId}
      tipo="bitacora"
      puedeGestionar={puedeGestionar}
      esAsignado={esAsignado}
      usuarioActualId={usuarioActualId}
      placeholder="Registrá el avance, un imprevisto, una foto del progreso…"
      tituloVacio="Bitácora vacía"
      descripcionVacio="Acá van las fotos y notas que carguen los asignados durante la ejecución de la OT."
    />
  )
}

'use client'

/**
 * Crear nueva plantilla de correo — página completa.
 * Usa PaginaEditorPlantilla con plantilla=null.
 */

import { PaginaEditorPlantilla } from '@/componentes/entidad/_editor_plantilla/PaginaEditorPlantilla'

export default function PaginaNuevaPlantillaCorreo() {
  return (
    <PaginaEditorPlantilla
      plantilla={null}
      rutaVolver="/inbox/configuracion/plantillas-correo"
      textoVolver="Plantillas de correo"
    />
  )
}

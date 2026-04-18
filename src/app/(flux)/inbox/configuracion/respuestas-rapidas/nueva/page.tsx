'use client'

import { PaginaEditorRespuestaRapida } from '@/componentes/entidad/_editor_respuesta_rapida/PaginaEditorRespuestaRapida'

export default function PaginaNuevaRespuestaCorreo() {
  return (
    <PaginaEditorRespuestaRapida
      plantilla={null}
      canalFijo="correo"
      rutaApi="/api/correo/respuestas-rapidas"
      rutaVolver="/inbox/configuracion/respuestas-rapidas"
      textoVolver="Respuestas rápidas"
    />
  )
}

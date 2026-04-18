'use client'

import { PaginaEditorRespuestaRapida } from '@/componentes/entidad/_editor_respuesta_rapida/PaginaEditorRespuestaRapida'

export default function PaginaNuevaRespuestaWhatsApp() {
  return (
    <PaginaEditorRespuestaRapida
      plantilla={null}
      canalFijo="whatsapp"
      rutaApi="/api/whatsapp/respuestas-rapidas"
      rutaVolver="/whatsapp/configuracion/respuestas-rapidas"
      textoVolver="Respuestas rápidas"
    />
  )
}

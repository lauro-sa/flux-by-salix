'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Route, MessageSquare, Bot } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Inbox.
 * Próximamente: canales, enrutamiento, respuestas automáticas.
 */
export default function PaginaConfiguracionInbox() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'canales', etiqueta: 'Canales', icono: <MessageSquare size={16} />, deshabilitada: true },
    { id: 'enrutamiento', etiqueta: 'Enrutamiento', icono: <Route size={16} />, deshabilitada: true },
    { id: 'respuestas', etiqueta: 'Respuestas automáticas', icono: <Bot size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Inbox"
      volverTexto="Inbox"
      onVolver={() => router.push('/inbox')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar canales de comunicación, reglas de enrutamiento y respuestas automáticas."
      />
    </PlantillaConfiguracion>
  )
}

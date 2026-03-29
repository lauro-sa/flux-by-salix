'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, MapPin, FileText, Clock } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Visitas.
 * Próximamente: plantillas de visita, check-in/out, reportes automáticos.
 */
export default function PaginaConfiguracionVisitas() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'plantillas', etiqueta: 'Plantillas', icono: <FileText size={16} />, deshabilitada: true },
    { id: 'checkin', etiqueta: 'Check-in / Check-out', icono: <MapPin size={16} />, deshabilitada: true },
    { id: 'horarios', etiqueta: 'Horarios', icono: <Clock size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Visitas"
      descripcion="Tipos de visita, formularios y configuración de recorridos."
      iconoHeader={<MapPin size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Visitas"
      onVolver={() => router.push('/visitas')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar plantillas de visita, reglas de check-in/check-out y reportes automáticos."
      />
    </PlantillaConfiguracion>
  )
}

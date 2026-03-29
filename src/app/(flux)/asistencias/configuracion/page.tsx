'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Clock, CalendarCheck, AlertTriangle } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Asistencias.
 * Próximamente: horarios laborales, reglas de asistencia, horas extra.
 */
export default function PaginaConfiguracionAsistencias() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'horarios', etiqueta: 'Horarios laborales', icono: <Clock size={16} />, deshabilitada: true },
    { id: 'reglas', etiqueta: 'Reglas de asistencia', icono: <CalendarCheck size={16} />, deshabilitada: true },
    { id: 'extras', etiqueta: 'Horas extra', icono: <AlertTriangle size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Asistencias"
      descripcion="Horarios, tolerancias, alertas y reglas de asistencia."
      iconoHeader={<CalendarCheck size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Asistencias"
      onVolver={() => router.push('/asistencias')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar horarios laborales, reglas de asistencia y políticas de horas extra."
      />
    </PlantillaConfiguracion>
  )
}

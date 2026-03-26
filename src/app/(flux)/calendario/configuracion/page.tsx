'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, RefreshCw, CalendarOff, Eye } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Calendario.
 * Próximamente: sincronización, festivos, disponibilidad.
 */
export default function PaginaConfiguracionCalendario() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'sincronizacion', etiqueta: 'Sincronización', icono: <RefreshCw size={16} />, deshabilitada: true },
    { id: 'festivos', etiqueta: 'Festivos', icono: <CalendarOff size={16} />, deshabilitada: true },
    { id: 'disponibilidad', etiqueta: 'Disponibilidad', icono: <Eye size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Calendario"
      volverTexto="Calendario"
      onVolver={() => router.push('/calendario')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar sincronización con calendarios externos, días festivos y reglas de disponibilidad."
      />
    </PlantillaConfiguracion>
  )
}

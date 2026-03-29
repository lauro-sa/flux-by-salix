'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, FileText, CalendarClock, Download } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Informes.
 * Próximamente: plantillas, programación, exportación.
 */
export default function PaginaConfiguracionInformes() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'plantillas', etiqueta: 'Plantillas', icono: <FileText size={16} />, deshabilitada: true },
    { id: 'programacion', etiqueta: 'Programación', icono: <CalendarClock size={16} />, deshabilitada: true },
    { id: 'exportacion', etiqueta: 'Exportación', icono: <Download size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Informes"
      descripcion="Plantillas, programación y formatos de exportación de informes."
      iconoHeader={<FileText size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Informes"
      onVolver={() => router.push('/informes')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar plantillas de informes, programación automática y opciones de exportación."
      />
    </PlantillaConfiguracion>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, CheckCircle, Clock, FileText } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Presupuestos.
 * Próximamente: reglas de aprobación, vigencia, plantillas.
 */
export default function PaginaConfiguracionPresupuestos() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'aprobacion', etiqueta: 'Aprobación', icono: <CheckCircle size={16} />, deshabilitada: true },
    { id: 'vigencia', etiqueta: 'Vigencia', icono: <Clock size={16} />, deshabilitada: true },
    { id: 'plantillas', etiqueta: 'Plantillas', icono: <FileText size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Presupuestos"
      volverTexto="Presupuestos"
      onVolver={() => router.push('/presupuestos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar reglas de aprobación, períodos de vigencia y plantillas de presupuesto."
      />
    </PlantillaConfiguracion>
  )
}

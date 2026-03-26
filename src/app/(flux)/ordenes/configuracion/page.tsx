'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Hash, GitBranch, CreditCard } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Órdenes.
 * Próximamente: numeración, flujos de aprobación, condiciones de pago.
 */
export default function PaginaConfiguracionOrdenes() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'numeracion', etiqueta: 'Numeración', icono: <Hash size={16} />, deshabilitada: true },
    { id: 'aprobacion', etiqueta: 'Flujos de aprobación', icono: <GitBranch size={16} />, deshabilitada: true },
    { id: 'pagos', etiqueta: 'Condiciones de pago', icono: <CreditCard size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Órdenes"
      volverTexto="Órdenes"
      onVolver={() => router.push('/ordenes')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar numeración automática, flujos de aprobación y condiciones de pago."
      />
    </PlantillaConfiguracion>
  )
}

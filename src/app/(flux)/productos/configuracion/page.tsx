'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Tag, Layers, DollarSign } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Productos.
 * Próximamente: categorías, variantes, reglas de precios.
 */
export default function PaginaConfiguracionProductos() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'categorias', etiqueta: 'Categorías', icono: <Tag size={16} />, deshabilitada: true },
    { id: 'variantes', etiqueta: 'Variantes', icono: <Layers size={16} />, deshabilitada: true },
    { id: 'precios', etiqueta: 'Precios', icono: <DollarSign size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Productos"
      volverTexto="Productos"
      onVolver={() => router.push('/productos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar categorías, variantes de producto y reglas de precios."
      />
    </PlantillaConfiguracion>
  )
}

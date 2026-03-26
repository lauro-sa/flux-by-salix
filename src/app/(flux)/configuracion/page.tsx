'use client'

import { useState } from 'react'
import { Building2, Globe, Users2, Sparkles, Trash2 } from 'lucide-react'
import { useRol } from '@/hooks/useRol'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { SeccionGeneral } from './secciones/SeccionGeneral'
import { SeccionEstructura } from './secciones/SeccionEstructura'
import { SeccionRegional } from './secciones/SeccionRegional'
import { SeccionIA } from './secciones/SeccionIA'
import { SeccionPeligro } from './secciones/SeccionPeligro'

/**
 * Página de configuración de empresa.
 * Usa PlantillaConfiguracion con menú lateral en desktop y tabs en mobile.
 * Solo propietario y administrador pueden acceder.
 */
export default function PaginaConfiguracion() {
  const { esPropietario } = useRol()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Building2 size={16} /> },
    { id: 'estructura', etiqueta: 'Estructura', icono: <Users2 size={16} /> },
    { id: 'regional', etiqueta: 'Regionalización', icono: <Globe size={16} /> },
    { id: 'ia', etiqueta: 'Inteligencia Artificial', icono: <Sparkles size={16} /> },
    ...(esPropietario ? [{
      id: 'peligro',
      etiqueta: 'Zona peligrosa',
      icono: <Trash2 size={16} />,
    }] : []),
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración"
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {seccionActiva === 'general' && <SeccionGeneral />}
      {seccionActiva === 'estructura' && <SeccionEstructura />}
      {seccionActiva === 'regional' && <SeccionRegional />}
      {seccionActiva === 'ia' && <SeccionIA />}
      {seccionActiva === 'peligro' && esPropietario && <SeccionPeligro />}
    </PlantillaConfiguracion>
  )
}

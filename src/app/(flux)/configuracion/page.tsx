'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
 * Acepta ?seccion=ia para abrir directo en una sección (ej: link desde config inbox).
 */
export default function PaginaConfiguracion() {
  const router = useRouter()
  const { esPropietario } = useRol()
  const searchParams = useSearchParams()
  const seccionInicial = searchParams.get('seccion') || 'general'
  const tabInicial = searchParams.get('tab') || undefined
  const [seccionActiva, setSeccionActiva] = useState(seccionInicial)

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
      descripcion="Ajustes generales de tu empresa, estructura, regionalización e inteligencia artificial."
      iconoHeader={<Building2 size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Inicio"
      onVolver={() => router.push('/')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {seccionActiva === 'general' && <SeccionGeneral />}
      {seccionActiva === 'estructura' && <SeccionEstructura tabInicial={tabInicial} />}
      {seccionActiva === 'regional' && <SeccionRegional />}
      {seccionActiva === 'ia' && <SeccionIA />}
      {seccionActiva === 'peligro' && esPropietario && <SeccionPeligro />}
    </PlantillaConfiguracion>
  )
}

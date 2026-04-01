'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, MessageCircle, Code, Megaphone } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { SeccionCampanasCorreo } from './_componentes/SeccionCampanasCorreo'
import { SeccionCampanasWhatsApp } from './_componentes/SeccionCampanasWhatsApp'
import { SeccionTracking } from './_componentes/SeccionTracking'

/**
 * Marketing — Página principal del módulo.
 * Usa PlantillaConfiguracion con menú lateral para las 3 subsecciones:
 * 1. Campañas de Correo (email marketing masivo)
 * 2. Campañas de WhatsApp (mensajes masivos con plantillas)
 * 3. Tracking Web (pixel de seguimiento para sitios web)
 */
export default function PaginaMarketing() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('correo')

  const secciones: SeccionConfig[] = [
    { id: 'correo', etiqueta: 'Campañas de correo', icono: <Mail size={16} />, grupo: 'Campañas' },
    { id: 'whatsapp', etiqueta: 'Campañas de WhatsApp', icono: <MessageCircle size={16} />, grupo: 'Campañas' },
    { id: 'tracking', etiqueta: 'Tracking web', icono: <Code size={16} />, grupo: 'Analíticas' },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Marketing"
      descripcion="Campañas de correo y WhatsApp, tracking web y analíticas. Todo integrado con tus contactos."
      iconoHeader={<Megaphone size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Inicio"
      onVolver={() => router.push('/dashboard')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {seccionActiva === 'correo' && <SeccionCampanasCorreo />}
      {seccionActiva === 'whatsapp' && <SeccionCampanasWhatsApp />}
      {seccionActiva === 'tracking' && <SeccionTracking />}
    </PlantillaConfiguracion>
  )
}

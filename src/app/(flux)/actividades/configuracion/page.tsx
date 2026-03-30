'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Bell, Tag, Zap } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useTraduccion } from '@/lib/i18n'

/**
 * Página de configuración de Actividades.
 * Próximamente: tipos de actividad, notificaciones, automatizaciones.
 */
export default function PaginaConfiguracionActividades() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')
  const { t } = useTraduccion()

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'tipos', etiqueta: t('actividades.tipos_actividad'), icono: <Tag size={16} />, deshabilitada: true },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, deshabilitada: true },
    { id: 'automatizaciones', etiqueta: 'Automatizaciones', icono: <Zap size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo={t('actividades.config_titulo')}
      descripcion={t('actividades.config_desc')}
      iconoHeader={<Zap size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto={t('actividades.titulo')}
      onVolver={() => router.push('/actividades')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo={t('comun.proximamente')}
        descripcion={t('comun.proximamente_desc')}
      />
    </PlantillaConfiguracion>
  )
}

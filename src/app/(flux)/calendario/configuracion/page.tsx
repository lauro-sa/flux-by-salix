'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, RefreshCw, CalendarOff, Eye } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useTraduccion } from '@/lib/i18n'

/**
 * Página de configuración de Calendario.
 * Próximamente: sincronización, festivos, disponibilidad.
 */
export default function PaginaConfiguracionCalendario() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')
  const { t } = useTraduccion()

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'sincronizacion', etiqueta: t('calendario.sincronizacion'), icono: <RefreshCw size={16} />, deshabilitada: true },
    { id: 'festivos', etiqueta: t('calendario.festivos'), icono: <CalendarOff size={16} />, deshabilitada: true },
    { id: 'disponibilidad', etiqueta: t('calendario.disponibilidad'), icono: <Eye size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo={t('calendario.config_titulo')}
      descripcion={t('calendario.config_desc')}
      iconoHeader={<CalendarOff size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto={t('calendario.titulo')}
      onVolver={() => router.push('/calendario')}
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

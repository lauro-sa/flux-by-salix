'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Hash, GitBranch, CreditCard } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useRol } from '@/hooks/useRol'

/**
 * Página de configuración de Órdenes.
 * Próximamente: numeración, flujos de aprobación, condiciones de pago.
 */
export default function PaginaConfiguracionOrdenes() {
  const router = useRouter()
  const { esPropietario, tienePermiso, cargando: cargandoPermisos } = useRol()
  const puedeVer = esPropietario || tienePermiso('config_ordenes_trabajo', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'numeracion', etiqueta: 'Numeración', icono: <Hash size={16} />, deshabilitada: true },
    { id: 'aprobacion', etiqueta: 'Flujos de aprobación', icono: <GitBranch size={16} />, deshabilitada: true },
    { id: 'pagos', etiqueta: 'Condiciones de pago', icono: <CreditCard size={16} />, deshabilitada: true },
  ]

  // Guard de acceso: después de todos los hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/ordenes')} />

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Órdenes"
      descripcion="Numeración, estados, flujos de trabajo y métodos de pago."
      iconoHeader={<GitBranch size={22} style={{ color: 'var(--texto-marca)' }} />}
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

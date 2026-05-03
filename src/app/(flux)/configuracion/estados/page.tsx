'use client'

/**
 * Página de configuración de estados configurables.
 *
 * Pestañas por entidad ya migrada al sistema genérico (cuotas,
 * conversaciones). Para cada entidad muestra:
 *   - Estados del sistema (read-only, badge "Sistema")
 *   - Estados propios de la empresa (editables)
 *   - Botón "+ Nuevo estado" para agregar uno propio
 *
 * Las nuevas entidades se suman automáticamente a medida que se migran
 * (PRs 7-11): basta agregarlas al mapeo TABLA_ESTADOS_POR_ENTIDAD.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks } from 'lucide-react'
import { useRol } from '@/hooks/useRol'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { TABLA_ESTADOS_POR_ENTIDAD } from '@/lib/estados/mapeo'
import { ETIQUETAS_ENTIDAD, type EntidadConEstado } from '@/tipos/estados'
import { SeccionEstadosEntidad } from './_componentes/SeccionEstadosEntidad'

export default function PaginaConfigEstados() {
  const router = useRouter()
  const { esPropietario, tienePermiso } = useRol()

  // Permite acceso a propietarios y a quienes tengan permiso de config_empresa.
  const puedeVer = esPropietario || tienePermiso('config_empresa', 'ver')

  // Construir las pestañas dinámicamente desde el mapeo: una por cada
  // entidad ya migrada al sistema genérico.
  const entidadesMigradas = Object.keys(TABLA_ESTADOS_POR_ENTIDAD) as EntidadConEstado[]

  const secciones: SeccionConfig[] = entidadesMigradas.map(entidad => ({
    id: entidad,
    etiqueta: ETIQUETAS_ENTIDAD[entidad],
  }))

  const [seccionActiva, setSeccionActiva] = useState<EntidadConEstado>(
    (entidadesMigradas[0] as EntidadConEstado) ?? 'cuota',
  )

  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/')} />

  return (
    <PlantillaConfiguracion
      titulo="Estados configurables"
      descripcion="Personalizá los estados de cada entidad. Los estados del sistema sirven como base; podés crear, editar y eliminar los propios de tu empresa."
      iconoHeader={<ListChecks size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Configuración"
      onVolver={() => router.push('/configuracion')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={(id) => setSeccionActiva(id as EntidadConEstado)}
    >
      <SeccionEstadosEntidad entidadTipo={seccionActiva} />
    </PlantillaConfiguracion>
  )
}

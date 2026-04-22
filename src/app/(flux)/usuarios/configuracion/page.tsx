'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Shield, KeyRound, UserCog } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useRol } from '@/hooks/useRol'

/**
 * Página de configuración de Usuarios.
 * Próximamente: roles, permisos, políticas de seguridad.
 */
export default function PaginaConfiguracionUsuarios() {
  const router = useRouter()
  const { esPropietario, tienePermiso, cargando: cargandoPermisos } = useRol()
  const puedeVer = esPropietario || tienePermiso('config_usuarios', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'roles', etiqueta: 'Roles', icono: <UserCog size={16} />, deshabilitada: true },
    { id: 'permisos', etiqueta: 'Permisos', icono: <Shield size={16} />, deshabilitada: true },
    { id: 'seguridad', etiqueta: 'Seguridad', icono: <KeyRound size={16} />, deshabilitada: true },
  ]

  // Guard de acceso: después de todos los hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/usuarios')} />

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Usuarios"
      descripcion="Roles, permisos y políticas de seguridad de tu equipo."
      iconoHeader={<Shield size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Usuarios"
      onVolver={() => router.push('/usuarios')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar roles personalizados, permisos granulares y políticas de seguridad."
      />
    </PlantillaConfiguracion>
  )
}

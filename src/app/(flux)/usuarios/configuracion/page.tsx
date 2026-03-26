'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Shield, KeyRound, UserCog } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * Página de configuración de Usuarios.
 * Próximamente: roles, permisos, políticas de seguridad.
 */
export default function PaginaConfiguracionUsuarios() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'roles', etiqueta: 'Roles', icono: <UserCog size={16} />, deshabilitada: true },
    { id: 'permisos', etiqueta: 'Permisos', icono: <Shield size={16} />, deshabilitada: true },
    { id: 'seguridad', etiqueta: 'Seguridad', icono: <KeyRound size={16} />, deshabilitada: true },
  ]

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Usuarios"
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

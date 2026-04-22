'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, FileText, FolderTree, Clock } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useRol } from '@/hooks/useRol'

/**
 * Página de configuración de Documentos.
 * Próximamente: plantillas, carpetas predeterminadas, retención.
 */
export default function PaginaConfiguracionDocumentos() {
  const router = useRouter()
  const { esPropietario, tienePermiso, cargando: cargandoPermisos } = useRol()
  const puedeVer = esPropietario || tienePermiso('config_empresa', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('general')

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'plantillas', etiqueta: 'Plantillas', icono: <FileText size={16} />, deshabilitada: true },
    { id: 'carpetas', etiqueta: 'Carpetas', icono: <FolderTree size={16} />, deshabilitada: true },
    { id: 'retencion', etiqueta: 'Retención', icono: <Clock size={16} />, deshabilitada: true },
  ]

  // Guard de acceso: después de todos los hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/')} />

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Documentos"
      descripcion="Tipos de documento, carpetas y políticas de almacenamiento."
      iconoHeader={<FileText size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Documentos"
      onVolver={() => router.push('/documentos')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      <EstadoVacio
        icono={<Settings2 />}
        titulo="Próximamente"
        descripcion="Acá podrás configurar plantillas de documentos, estructura de carpetas y políticas de retención."
      />
    </PlantillaConfiguracion>
  )
}

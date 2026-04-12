'use client'

import type { ReactNode } from 'react'
import { SkeletonTabla } from './SkeletonTabla'
import { EstadoVacio } from './EstadoVacio'
import { AlertTriangle } from 'lucide-react'

interface Props {
  /** Indica si los datos están cargando */
  cargando: boolean
  /** Error opcional — si existe, muestra el estado de error */
  error?: string | null
  /** Si los datos están vacíos (después de cargar) */
  vacio?: boolean
  /** Contenido cuando hay datos */
  children: ReactNode
  /** Componente de carga personalizado (default: SkeletonTabla) */
  skeleton?: ReactNode
  /** Props para el estado vacío */
  vacioTitulo?: string
  vacioDescripcion?: string
  vacioIcono?: ReactNode
  vacioAccion?: ReactNode
}

/**
 * ContenedorConEstado — Wrapper reutilizable para manejar los 3 estados de datos:
 * cargando, error y vacío. Evita repetir el patrón if/else en cada componente.
 * Se usa en: listas, tablas, configuraciones, dashboards.
 */
export function ContenedorConEstado({
  cargando,
  error,
  vacio,
  children,
  skeleton,
  vacioTitulo = 'Sin datos',
  vacioDescripcion,
  vacioIcono,
  vacioAccion,
}: Props) {
  if (cargando) {
    return <>{skeleton || <SkeletonTabla />}</>
  }

  if (error) {
    return (
      <EstadoVacio
        icono={<AlertTriangle />}
        titulo="Error al cargar"
        descripcion={error}
      />
    )
  }

  if (vacio) {
    return (
      <EstadoVacio
        icono={vacioIcono}
        titulo={vacioTitulo}
        descripcion={vacioDescripcion}
        accion={vacioAccion}
      />
    )
  }

  return <>{children}</>
}

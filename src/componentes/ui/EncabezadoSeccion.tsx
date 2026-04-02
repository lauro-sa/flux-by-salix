import type { ReactNode } from 'react'

interface PropiedadesEncabezadoSeccion {
  /** Título principal de la sección */
  titulo: string
  /** Descripción debajo del título */
  descripcion?: string
  /** Elemento opcional a la derecha (botón, badge, etc.) */
  accion?: ReactNode
}

/**
 * EncabezadoSeccion — Título + descripción + acción opcional.
 * Se usa en secciones de configuración, páginas de detalle, paneles.
 */
function EncabezadoSeccion({ titulo, descripcion, accion }: PropiedadesEncabezadoSeccion) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-texto-primario mb-1">{titulo}</h2>
        {descripcion && (
          <p className="text-base text-texto-terciario">{descripcion}</p>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  )
}

export { EncabezadoSeccion, type PropiedadesEncabezadoSeccion }

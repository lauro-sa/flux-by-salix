'use client'

import { type ReactNode } from 'react'
import { Avatar } from '@/componentes/ui/Avatar'

/* ─── Tipos ─── */

/** Metadato suelto en la línea inferior del cabezal (ej: "Desde 12 mar 2023", "CUIT 20-...") */
export interface MetadatoPersona {
  id: string
  etiqueta: string
  valor: string
  icono?: ReactNode
}

interface PropiedadesCabezaloPersona {
  /** Etiqueta pequeña arriba (ej: "EMPLEADO", "CLIENTE", "PROVEEDOR") */
  etiquetaTipo?: string
  /** Nombre completo (se usa para el avatar también) */
  nombre: string
  /** Foto opcional (si no hay, se muestran iniciales coloreadas) */
  foto?: string | null
  /** Subtítulo inmediato debajo del nombre (ej: "Mecánico senior", "Cliente frecuente") */
  subtitulo?: string
  /** Badge de estado junto al título (ej: Activo/Suspendido, Al día/Moroso) */
  badge?: ReactNode
  /** Metadatos en línea separados por puntos (fecha alta, CUIT, documento, etc.) */
  metadatos?: MetadatoPersona[]
  /** Acciones a la derecha (ej: botones de navegación, editar) */
  acciones?: ReactNode
  /** Tamaño del avatar. Default 'lg' (48px) */
  tamanoAvatar?: 'md' | 'lg' | 'xl'
  className?: string
}

/**
 * CabezaloPersona — Cabezal de página de detalle de una persona/entidad.
 * Se usa en: detalle de empleado en nómina, ficha de contacto, detalle de proveedor,
 * perfil de miembro, etc. Presenta avatar grande + identidad + metadatos clave.
 *
 * Estructura:
 *   [Avatar]  ETIQUETA · Badge
 *             Nombre grande
 *             Subtítulo · Meta 1 · Meta 2 · Meta 3
 *                                                   [Acciones]
 */
function CabezaloPersona({
  etiquetaTipo,
  nombre,
  foto,
  subtitulo,
  badge,
  metadatos = [],
  acciones,
  tamanoAvatar = 'lg',
  className = '',
}: PropiedadesCabezaloPersona) {
  return (
    <div className={`flex items-start gap-4 ${className}`}>
      <Avatar nombre={nombre} foto={foto} tamano={tamanoAvatar} />

      <div className="flex-1 min-w-0">
        {/* Etiqueta + badge en línea */}
        {(etiquetaTipo || badge) && (
          <div className="flex items-center gap-2 mb-0.5">
            {etiquetaTipo && (
              <span className="text-[10px] font-semibold text-texto-terciario uppercase tracking-wider">
                {etiquetaTipo}
              </span>
            )}
            {badge}
          </div>
        )}

        {/* Nombre */}
        <h1 className="text-xl sm:text-2xl font-bold text-texto-primario truncate">
          {nombre}
        </h1>

        {/* Subtítulo + metadatos en línea */}
        {(subtitulo || metadatos.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {subtitulo && (
              <span className="text-xs text-texto-terciario">{subtitulo}</span>
            )}
            {subtitulo && metadatos.length > 0 && (
              <span className="text-xs text-texto-terciario/60">·</span>
            )}
            {metadatos.map((m, idx) => (
              <span key={m.id} className="text-xs text-texto-terciario inline-flex items-center gap-1">
                {m.icono}
                <span>{m.etiqueta} <span className="text-texto-secundario">{m.valor}</span></span>
                {idx < metadatos.length - 1 && <span className="text-texto-terciario/60 ml-1">·</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {acciones && <div className="shrink-0">{acciones}</div>}
    </div>
  )
}

export { CabezaloPersona, type PropiedadesCabezaloPersona }

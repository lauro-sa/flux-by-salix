/**
 * Separador — Línea divisoria con etiqueta opcional.
 * Se usa en: separar secciones de formularios, grupos de opciones.
 */
function Separador({ etiqueta, className = '' }: { etiqueta?: string; className?: string }) {
  if (etiqueta) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-borde-sutil" />
        <span className="text-xs text-texto-terciario font-medium">{etiqueta}</span>
        <div className="flex-1 h-px bg-borde-sutil" />
      </div>
    )
  }
  return <div className={`h-px bg-borde-sutil ${className}`} />
}

export { Separador }

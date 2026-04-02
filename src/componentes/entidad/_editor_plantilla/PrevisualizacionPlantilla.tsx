'use client'

/**
 * PrevisualizacionPlantilla — Vista previa del correo con variables resueltas.
 * Renderiza el asunto y contenido HTML con datos reales o de ejemplo.
 * Se usa en: ModalEditorPlantillaCorreo, tab de vista previa.
 */

import DOMPurify from 'isomorphic-dompurify'

interface PropiedadesPrevisualizacionPlantilla {
  asunto: string
  contenidoHtml: string
  contactoPreview: Record<string, unknown> | null
  documentoPreview: { numero: string } | null
  resolverPreview: (texto: string) => string
}

export function PrevisualizacionPlantilla({
  asunto,
  contenidoHtml,
  contactoPreview,
  documentoPreview,
  resolverPreview,
}: PropiedadesPrevisualizacionPlantilla) {
  return (
    <div className="space-y-4">
      {/* Asunto resuelto */}
      {asunto.trim() && (
        <div className="px-4 py-2.5 rounded-lg" style={{ border: '1px solid var(--borde-sutil)' }}>
          <span className="text-xxs uppercase tracking-wider font-semibold mr-2" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
          <span className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>{resolverPreview(asunto)}</span>
        </div>
      )}

      {/* Contenido resuelto */}
      <div className="px-4 py-3 rounded-lg" style={{ border: '1px solid var(--borde-sutil)', minHeight: 220 }}>
        <div
          className="text-sm leading-relaxed [&_p]:my-2 [&_p:empty]:my-2 [&_p:empty]:min-h-[1em] [&_br]:block [&_br]:content-[''] [&_br]:my-1"
          style={{ color: 'var(--texto-primario)' }}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(resolverPreview(contenidoHtml) || '<span style="opacity: 0.4">Sin contenido</span>', { FORBID_TAGS: ['script', 'object', 'embed', 'form', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'] }),
          }}
        />
      </div>

      {/* Nota informativa sobre la fuente de datos */}
      <p className="text-xxs text-center" style={{ color: 'var(--texto-terciario)' }}>
        {contactoPreview && documentoPreview
          ? `Datos reales de "${`${contactoPreview.nombre} ${contactoPreview.apellido || ''}`.trim()}" y documento ${documentoPreview.numero}.`
          : contactoPreview
            ? `Datos reales de "${`${contactoPreview.nombre} ${contactoPreview.apellido || ''}`.trim()}". Documento de ejemplo.`
            : documentoPreview
              ? `Contacto de ejemplo. Documento real ${documentoPreview.numero}.`
              : 'Datos de ejemplo. Elegí un contacto o documento arriba para ver con datos reales.'
        }
      </p>
    </div>
  )
}

'use client'

/**
 * BuscadorDocumentoPreview — Selector de documento para la vista previa de plantillas.
 * Carga documentos recientes o filtrados por contacto.
 * Se usa en: ModalEditorPlantillaCorreo, sección de selección de documento para preview.
 */

import { useState, useEffect } from 'react'
import { PenLine, ChevronDown } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import type { DocumentoResultado } from './tipos'

interface PropiedadesBuscadorDocumentoPreview {
  contactoId?: string | null
  onSeleccionar: (doc: DocumentoResultado) => void
}

export function BuscadorDocumentoPreview({
  contactoId,
  onSeleccionar,
}: PropiedadesBuscadorDocumentoPreview) {
  const { locale } = useFormato()
  const [docs, setDocs] = useState<DocumentoResultado[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [cargando, setCargando] = useState(false)

  // Cargar documentos recientes (o del contacto si hay)
  useEffect(() => {
    setCargando(true)
    const url = contactoId
      ? `/api/presupuestos?contacto_id=${contactoId}&limite=8`
      : '/api/presupuestos?limite=8'
    fetch(url)
      .then(r => r.json())
      .then(data => setDocs(data.presupuestos || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [contactoId])

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setMostrar(!mostrar)}
        onBlur={() => setTimeout(() => setMostrar(false), 200)}
        className="w-full flex items-center gap-1.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 rounded"
        style={{ borderBottom: '1.5px solid var(--borde-fuerte)' }}
      >
        <span className="flex-1 text-sm" style={{ color: 'var(--texto-terciario)' }}>Elegir documento...</span>
        <ChevronDown size={14} style={{ color: 'var(--texto-terciario)' }} />
      </button>

      {mostrar && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-elevada max-h-[280px] overflow-y-auto"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
        >
          {cargando ? (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
          ) : docs.length > 0 ? (
            <div className="py-1">
              {docs.map(d => (
                <button
                  key={d.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                  onMouseDown={(e) => { e.preventDefault(); onSeleccionar(d); setMostrar(false) }}
                >
                  <PenLine size={14} style={{ color: 'var(--texto-terciario)' }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{d.numero}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--texto-terciario)' }}>
                      {d.contacto_nombre || 'Sin contacto'} · {d.estado}
                    </p>
                  </div>
                  {d.total_final && (
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>
                      {d.moneda === 'USD' ? 'US$' : '$'} {Number(d.total_final).toLocaleString(locale)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-terciario)' }}>Sin documentos</p>
          )}
        </div>
      )}
    </div>
  )
}

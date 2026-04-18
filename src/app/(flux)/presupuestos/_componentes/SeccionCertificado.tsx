'use client'

/**
 * SeccionCertificado — Banner de aceptación digital del presupuesto.
 * Se usa en: EditorPresupuesto.tsx
 */

import { CheckCircle2, FileText } from 'lucide-react'

interface PropsSeccionCertificado {
  pdfFirmadoUrl: string
}

export default function SeccionCertificado({ pdfFirmadoUrl }: PropsSeccionCertificado) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-insignia-exito/5 border border-insignia-exito/20 rounded-card">
      <CheckCircle2 size={18} className="text-insignia-exito shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-texto-primario">Presupuesto aceptado por el cliente</p>
        <p className="text-xs text-texto-terciario">Certificado de aceptación digital con firma</p>
      </div>
      <a
        href={pdfFirmadoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-medium text-insignia-exito hover:underline shrink-0"
      >
        <FileText size={14} />
        Ver certificado
      </a>
    </div>
  )
}

'use client'

/**
 * SeccionEmisor — Muestra los datos del emisor (empresa) en el presupuesto.
 * Se usa en: EditorPresupuesto.tsx
 */

import { Phone, Mail } from 'lucide-react'
import type { DatosEmpresa } from './tipos-editor'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'

interface PropsSeccionEmisor {
  datosEmpresa: DatosEmpresa | null
  nombreEmpresa: string
}

export default function SeccionEmisor({ datosEmpresa, nombreEmpresa }: PropsSeccionEmisor) {
  const datosFiscales = (datosEmpresa?.datos_fiscales || {}) as Record<string, string>

  return (
    <div className="px-6 py-3">
      <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">Emisor</span>
      <div className="mt-2 space-y-1">
        <p className="text-base font-semibold text-texto-primario">
          {datosEmpresa?.nombre || nombreEmpresa || '—'}
        </p>
        {(datosFiscales.cuit || datosFiscales.condicion_iva) && (
          <p className="text-xs text-texto-secundario">
            {datosFiscales.cuit && `CUIT ${datosFiscales.cuit}`}
            {datosFiscales.cuit && datosFiscales.condicion_iva && ' · '}
            {datosFiscales.condicion_iva?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </p>
        )}
        {(datosEmpresa?.telefono || datosEmpresa?.correo) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {datosEmpresa?.telefono && (
              <span className="text-xs text-texto-secundario flex items-center gap-1">
                <Phone size={11} className="text-texto-terciario" />
                <TextoTelefono valor={datosEmpresa.telefono} />
              </span>
            )}
            {datosEmpresa?.correo && (
              <span className="text-xs text-texto-secundario flex items-center gap-1">
                <Mail size={11} className="text-texto-terciario" />
                {datosEmpresa.correo}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

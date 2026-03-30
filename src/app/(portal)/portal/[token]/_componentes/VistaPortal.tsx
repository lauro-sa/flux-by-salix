'use client'

/**
 * VistaPortal — Componente principal del portal público de presupuestos.
 * Flujo: info → acciones → aceptar → scroll a firma → post-firma muestra banco + comprobante.
 * Basado en PaginaPortalDocumento.jsx del sistema anterior.
 * Se usa en: /portal/[token]/page.tsx
 */

import { useState, useRef, useEffect } from 'react'
import { Copy, Check, Upload, FileText } from 'lucide-react'
import type { DatosPortal } from '@/tipos/portal'
import CabeceraPortal from './CabeceraPortal'
import InfoDocumento from './InfoDocumento'
import AccionesPortal from './AccionesPortal'
import FirmaDocumento from './FirmaDocumento'
import DetalleLineas from './DetalleLineas'
import SeccionNotas from './SeccionNotas'
import PiePortal from './PiePortal'

interface Props {
  datos: DatosPortal
}

export default function VistaPortal({ datos }: Props) {
  const { presupuesto, empresa, vendedor, datos_bancarios, moneda_simbolo } = datos

  const [mostrarFirma, setMostrarFirma] = useState(false)
  const [aceptado, setAceptado] = useState(false)
  const [rechazado, setRechazado] = useState(false)
  const [firmaNombre, setFirmaNombre] = useState<string | null>(null)
  const [firmaBase64, setFirmaBase64] = useState<string | null>(null)
  const [cbuCopiado, setCbuCopiado] = useState(false)
  const [aliasCopiado, setAliasCopiado] = useState(false)
  const [comprobantes, setComprobantes] = useState<{ nombre: string; base64: string }[]>([])

  const firmaRef = useRef<HTMLDivElement>(null)
  const pagoRef = useRef<HTMLDivElement>(null)

  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean).join(' ') || ''

  // Scroll a firma al aceptar
  useEffect(() => {
    if (mostrarFirma && firmaRef.current) {
      firmaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [mostrarFirma])

  // Scroll a pago después de firmar
  useEffect(() => {
    if (aceptado && pagoRef.current) {
      setTimeout(() => pagoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [aceptado])

  const handleAceptar = () => {
    setMostrarFirma(true)
  }

  const handleFirmar = (datosF: { base64: string | null; nombre: string }) => {
    // TODO: enviar firma al backend
    setFirmaNombre(datosF.nombre)
    setFirmaBase64(datosF.base64)
    setAceptado(true)
    setMostrarFirma(false)
  }

  const handleRechazar = () => {
    // TODO: enviar rechazo al backend
    setRechazado(true)
  }

  const copiarAlPortapapeles = (texto: string, tipo: 'cbu' | 'alias') => {
    navigator.clipboard.writeText(texto)
    if (tipo === 'cbu') { setCbuCopiado(true); setTimeout(() => setCbuCopiado(false), 2000) }
    else { setAliasCopiado(true); setTimeout(() => setAliasCopiado(false), 2000) }
  }

  const subirComprobante = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      setComprobantes(prev => [...prev, { nombre: file.name, base64: reader.result as string }])
      // TODO: enviar comprobante al backend
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div>
      {/* Cabecera */}
      <CabeceraPortal empresa={empresa} />

      {/* Contenido principal */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Info del documento */}
        <InfoDocumento presupuesto={presupuesto} />

        {/* Acciones: PDF, WhatsApp, llamar, aceptar/rechazar */}
        <AccionesPortal
          pdfUrl={presupuesto.pdf_url}
          vendedorTelefono={vendedor.telefono}
          presupuestoNumero={presupuesto.numero}
          contactoNombre={nombreContacto}
          onAceptar={handleAceptar}
          onRechazar={handleRechazar}
          aceptado={aceptado}
          rechazado={rechazado}
        />

        {/* Panel de firma (se despliega al aceptar, con scroll automático) */}
        {mostrarFirma && (
          <div ref={firmaRef}>
            <FirmaDocumento
              nombrePredeterminado={presupuesto.atencion_nombre || nombreContacto}
              onFirmar={handleFirmar}
              onCancelar={() => setMostrarFirma(false)}
            />
          </div>
        )}

        {/* Banner de aceptado con firma */}
        {aceptado && firmaNombre && (
          <div className="rounded-xl bg-insignia-exito/10 border border-insignia-exito/20 p-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-insignia-exito/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={16} className="text-insignia-exito" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-insignia-exito">Presupuesto aceptado</p>
                <p className="text-xs text-texto-secundario mt-1">Firmado por {firmaNombre}</p>
                {firmaBase64 && (
                  <img src={firmaBase64} alt="Firma" className="max-h-[60px] mt-2 opacity-70" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Sección de pago (se muestra después de aceptar) ── */}
        {aceptado && datos_bancarios && (
          <div ref={pagoRef} className="space-y-4">
            <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
              <div className="px-5 py-4 border-b border-borde-sutil">
                <h3 className="text-base font-semibold text-texto-primario">Datos para transferencia</h3>
                <p className="text-sm text-texto-terciario mt-0.5">Realizá la transferencia y adjuntá el comprobante</p>
              </div>

              <div className="p-5 space-y-3">
                {datos_bancarios.banco && (
                  <div className="flex justify-between text-sm">
                    <span className="text-texto-terciario">Banco</span>
                    <span className="text-texto-primario font-medium">{datos_bancarios.banco}</span>
                  </div>
                )}
                {datos_bancarios.titular && (
                  <div className="flex justify-between text-sm">
                    <span className="text-texto-terciario">Titular</span>
                    <span className="text-texto-primario font-medium">{datos_bancarios.titular}</span>
                  </div>
                )}
                {datos_bancarios.cbu && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-texto-terciario">CBU</span>
                    <button
                      onClick={() => copiarAlPortapapeles(datos_bancarios!.cbu, 'cbu')}
                      className="flex items-center gap-1.5 font-mono text-marca-500 font-medium hover:text-marca-600 transition-colors"
                    >
                      {datos_bancarios.cbu}
                      {cbuCopiado ? <Check size={14} className="text-insignia-exito" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
                {datos_bancarios.alias && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-texto-terciario">Alias</span>
                    <button
                      onClick={() => copiarAlPortapapeles(datos_bancarios!.alias, 'alias')}
                      className="flex items-center gap-1.5 font-mono text-marca-500 font-medium hover:text-marca-600 transition-colors"
                    >
                      {datos_bancarios.alias}
                      {aliasCopiado ? <Check size={14} className="text-insignia-exito" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Subir comprobante */}
              <div className="px-5 py-4 border-t border-borde-sutil space-y-3">
                <p className="text-sm font-medium text-texto-secundario">Comprobante de transferencia</p>

                {comprobantes.length > 0 && (
                  <div className="space-y-2">
                    {comprobantes.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-texto-secundario bg-superficie-app rounded-lg px-3 py-2">
                        <FileText size={14} className="text-insignia-exito shrink-0" />
                        <span className="truncate flex-1">{c.nombre}</span>
                        <Check size={14} className="text-insignia-exito shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-borde-fuerte cursor-pointer hover:border-marca-500 hover:bg-marca-500/5 transition-colors text-sm text-texto-terciario">
                  <Upload size={16} />
                  {comprobantes.length > 0 ? 'Adjuntar otro comprobante' : 'Adjuntar comprobante'}
                  <input type="file" accept="image/*,.pdf" onChange={subirComprobante} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Datos bancarios sin aceptar (solo lectura, si no hay flujo de firma) */}
        {!aceptado && datos_bancarios && (
          <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil p-4 space-y-2 text-sm">
            <h3 className="text-[11px] text-texto-terciario uppercase tracking-wider font-medium mb-2">
              Datos para transferencia
            </h3>
            {datos_bancarios.banco && (
              <div className="flex justify-between"><span className="text-texto-terciario">Banco</span><span className="text-texto-primario font-medium">{datos_bancarios.banco}</span></div>
            )}
            {datos_bancarios.titular && (
              <div className="flex justify-between"><span className="text-texto-terciario">Titular</span><span className="text-texto-primario font-medium">{datos_bancarios.titular}</span></div>
            )}
            {datos_bancarios.cbu && (
              <div className="flex justify-between"><span className="text-texto-terciario">CBU</span><span className="font-mono text-texto-primario">{datos_bancarios.cbu}</span></div>
            )}
            {datos_bancarios.alias && (
              <div className="flex justify-between"><span className="text-texto-terciario">Alias</span><span className="font-mono text-texto-primario">{datos_bancarios.alias}</span></div>
            )}
          </div>
        )}

        {/* Detalle de líneas */}
        {presupuesto.lineas.length > 0 && (
          <DetalleLineas
            lineas={presupuesto.lineas}
            simbolo={moneda_simbolo}
            subtotalNeto={presupuesto.subtotal_neto}
            totalImpuestos={presupuesto.total_impuestos}
            descuentoGlobal={presupuesto.descuento_global}
            descuentoGlobalMonto={presupuesto.descuento_global_monto}
            totalFinal={presupuesto.total_final}
          />
        )}

        {/* Notas y condiciones */}
        <SeccionNotas
          notasHtml={presupuesto.notas_html}
          condicionesHtml={presupuesto.condiciones_html}
        />
      </main>

      {/* Footer */}
      <PiePortal empresa={empresa} />
    </div>
  )
}

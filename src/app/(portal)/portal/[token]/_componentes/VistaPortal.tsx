'use client'

/**
 * VistaPortal — Componente principal del portal público de presupuestos.
 * Flujo: info → acciones → firma → post-firma: cuotas/pago + comprobantes.
 * Estado persistido via API (no se pierde al refrescar).
 * Se usa en: /portal/[token]/page.tsx
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTraduccion } from '@/lib/i18n'
import type { DatosPortal, EstadoPortal, ComprobantePortal } from '@/tipos/portal'
import CabeceraPortal from './CabeceraPortal'
import InfoDocumento from './InfoDocumento'
import AccionesPortal from './AccionesPortal'
import FirmaDocumento from './FirmaDocumento'
import DetalleLineas from './DetalleLineas'
import SeccionNotas from './SeccionNotas'
import SeccionCuotas from './SeccionCuotas'
import PiePortal from './PiePortal'

interface Props {
  datos: DatosPortal
}

export default function VistaPortal({ datos }: Props) {
  const { t } = useTraduccion()
  const { presupuesto, empresa, vendedor, datos_bancarios, moneda_simbolo } = datos

  // Estado persistido (inicializado desde el servidor)
  const [estadoCliente, setEstadoCliente] = useState<EstadoPortal>(datos.estado_cliente || 'visto')
  const [firmaNombre, setFirmaNombre] = useState<string | null>(datos.firma?.nombre || null)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(datos.firma?.url || null)
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(datos.motivo_rechazo || null)
  const [comprobantes, setComprobantes] = useState<ComprobantePortal[]>(datos.comprobantes || [])

  // Estado de UI
  const [mostrarFirma, setMostrarFirma] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [cargandoComprobante, setCargandoComprobante] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firmaRef = useRef<HTMLDivElement>(null)
  const pagoRef = useRef<HTMLDivElement>(null)

  const colorMarca = empresa.color_marca || '#6366f1'
  const nombreContacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido]
    .filter(Boolean).join(' ') || ''

  // Extraer el token de la URL para las llamadas API
  const token = typeof window !== 'undefined' ? window.location.pathname.split('/portal/')[1] : ''

  // Scroll a firma al aceptar
  useEffect(() => {
    if (mostrarFirma && firmaRef.current) {
      firmaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [mostrarFirma])

  // Scroll a pago después de firmar
  useEffect(() => {
    if (estadoCliente === 'aceptado' && pagoRef.current && !mostrarFirma) {
      setTimeout(() => pagoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [estadoCliente, mostrarFirma])

  // Limpiar error después de 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // ── Acciones con persistencia ──

  const ejecutarAccion = useCallback(async (body: Record<string, unknown>) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/${token}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      return await res.json()
    } catch {
      setError(t('portal.error_accion'))
      return null
    } finally {
      setCargando(false)
    }
  }, [token, t])

  const handleAceptar = () => {
    setMostrarFirma(true)
  }

  const handleFirmar = async (datosF: { base64: string | null; nombre: string; modo: string }) => {
    const resultado = await ejecutarAccion({
      accion: 'aceptar',
      firma_base64: datosF.base64,
      firma_nombre: datosF.nombre,
      firma_modo: datosF.modo,
    })
    if (resultado?.ok) {
      setEstadoCliente('aceptado')
      setFirmaNombre(datosF.nombre)
      setFirmaUrl(resultado.firma_url || datosF.base64)
      setMostrarFirma(false)
    }
  }

  const handleRechazar = async (motivo: string) => {
    const resultado = await ejecutarAccion({
      accion: 'rechazar',
      motivo,
    })
    if (resultado?.ok) {
      setEstadoCliente('rechazado')
      setMotivoRechazo(motivo || null)
    }
  }

  const handleCancelar = async () => {
    const resultado = await ejecutarAccion({ accion: 'cancelar' })
    if (resultado?.ok) {
      setEstadoCliente('visto')
      setFirmaNombre(null)
      setFirmaUrl(null)
    }
  }

  const handleSubirComprobante = async (datosComp: {
    archivo_base64: string
    nombre_archivo: string
    tipo_archivo: string
    cuota_id: string | null
    monto: string | null
  }) => {
    setCargandoComprobante(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/${token}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'comprobante', ...datosComp }),
      })
      if (!res.ok) throw new Error()
      const resultado = await res.json()
      if (resultado?.comprobante) {
        setComprobantes(prev => [...prev, resultado.comprobante])
      }
    } catch {
      setError(t('portal.error_accion'))
    } finally {
      setCargandoComprobante(false)
    }
  }

  const puedeAccionar = estadoCliente === 'visto' || estadoCliente === 'pendiente'

  return (
    <div>
      {/* Cabecera */}
      <CabeceraPortal empresa={empresa} />

      {/* Contenido principal */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error toast */}
        {error && (
          <div className="rounded-xl bg-estado-error/10 border border-estado-error/20 px-4 py-3 text-sm text-estado-error text-center">
            {error}
          </div>
        )}

        {/* Info del documento (con total prominente, referencia, vendedor) */}
        <InfoDocumento
          presupuesto={presupuesto}
          vendedorNombre={vendedor.nombre}
          monedaSimbolo={moneda_simbolo}
          estadoCliente={estadoCliente}
          colorMarca={colorMarca}
        />

        {/* Acciones: PDF, WhatsApp, llamar, aceptar/rechazar/cancelar */}
        <AccionesPortal
          pdfUrl={presupuesto.pdf_url}
          vendedorTelefono={vendedor.telefono}
          presupuestoNumero={presupuesto.numero}
          contactoNombre={nombreContacto}
          estadoCliente={estadoCliente}
          colorMarca={colorMarca}
          firmaNombre={firmaNombre}
          firmaUrl={firmaUrl}
          motivoRechazo={motivoRechazo}
          onAceptar={handleAceptar}
          onRechazar={handleRechazar}
          onCancelar={handleCancelar}
          cargando={cargando}
        />

        {/* Panel de firma (se despliega al aceptar, con scroll automático) */}
        {mostrarFirma && puedeAccionar && (
          <div ref={firmaRef}>
            <FirmaDocumento
              nombrePredeterminado={presupuesto.atencion_nombre || nombreContacto}
              onFirmar={handleFirmar}
              onCancelar={() => setMostrarFirma(false)}
            />
          </div>
        )}

        {/* ── Sección de pagos (se muestra después de aceptar) ── */}
        {estadoCliente === 'aceptado' && (datos_bancarios || presupuesto.cuotas.length > 0) && (
          <div ref={pagoRef}>
            <SeccionCuotas
              cuotas={presupuesto.cuotas}
              comprobantes={comprobantes}
              datosBancarios={datos_bancarios}
              monedaSimbolo={moneda_simbolo}
              totalFinal={presupuesto.total_final}
              colorMarca={colorMarca}
              onSubirComprobante={handleSubirComprobante}
              cargandoComprobante={cargandoComprobante}
            />
          </div>
        )}

        {/* Datos bancarios read-only (antes de aceptar, si hay datos) */}
        {estadoCliente !== 'aceptado' && datos_bancarios && (
          <DatosBancariosReadonly datos={datos_bancarios} />
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

// ── Datos bancarios en modo lectura (antes de aceptar) ──
function DatosBancariosReadonly({ datos }: { datos: { banco: string; titular: string; cbu: string; alias: string } }) {
  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil p-4 space-y-2 text-sm">
      <h3 className="text-xs text-texto-terciario uppercase tracking-wider font-medium mb-2">
        Datos para transferencia
      </h3>
      {datos.banco && (
        <div className="flex justify-between">
          <span className="text-texto-terciario">Banco</span>
          <span className="text-texto-primario font-medium">{datos.banco}</span>
        </div>
      )}
      {datos.titular && (
        <div className="flex justify-between">
          <span className="text-texto-terciario">Titular</span>
          <span className="text-texto-primario font-medium">{datos.titular}</span>
        </div>
      )}
      {datos.cbu && (
        <div className="flex justify-between">
          <span className="text-texto-terciario">CBU</span>
          <span className="font-mono text-texto-primario">{datos.cbu}</span>
        </div>
      )}
      {datos.alias && (
        <div className="flex justify-between">
          <span className="text-texto-terciario">Alias</span>
          <span className="font-mono text-texto-primario">{datos.alias}</span>
        </div>
      )}
    </div>
  )
}

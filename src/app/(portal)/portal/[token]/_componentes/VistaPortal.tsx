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
import LineaTiempoPortal from './LineaTiempoPortal'
import MiniChat from './MiniChat'
import PiePortal from './PiePortal'
import { DELAY_NOTIFICACION } from '@/lib/constantes/timeouts'

interface Props {
  datos: DatosPortal
}

export default function VistaPortal({ datos }: Props) {
  const { t } = useTraduccion()
  const { presupuesto, empresa, vendedor, datos_bancarios, moneda_simbolo, locale } = datos

  // Estado persistido (inicializado desde el servidor)
  const [estadoCliente, setEstadoCliente] = useState<EstadoPortal>(datos.estado_cliente || 'visto')
  const [firmaNombre, setFirmaNombre] = useState<string | null>(datos.firma?.nombre || null)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(datos.firma?.url || null)
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(datos.motivo_rechazo || null)
  const [comprobantes, setComprobantes] = useState<ComprobantePortal[]>(datos.comprobantes || [])
  const [mensajes, setMensajes] = useState(datos.mensajes || [])
  const [cuotas, setCuotas] = useState(presupuesto.cuotas)
  const [estadoPresupuesto, setEstadoPresupuesto] = useState(presupuesto.estado)

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

  // Polling: recargar mensajes, comprobantes, cuotas y estado cada 15s
  useEffect(() => {
    if (!token) return
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`/api/portal/${token}`)
        if (res.ok) {
          const data = await res.json()
          if (data.mensajes) setMensajes(data.mensajes)
          if (data.comprobantes) setComprobantes(data.comprobantes)
          if (data.presupuesto?.cuotas) setCuotas(data.presupuesto.cuotas)
          if (data.presupuesto?.estado) setEstadoPresupuesto(data.presupuesto.estado)
        }
      } catch { /* silencioso */ }
    }, 15000)
    return () => clearInterval(intervalo)
  }, [token])

  // Limpiar error después de 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), DELAY_NOTIFICACION)
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
          <div className="rounded-card bg-estado-error/10 border border-estado-error/20 px-4 py-3 text-sm text-estado-error text-center">
            {error}
          </div>
        )}

        {/* Info del documento */}
        <InfoDocumento
          presupuesto={presupuesto}
          vendedorNombre={vendedor.nombre}
          estadoCliente={estadoCliente}
          colorMarca={colorMarca}
        />

        {/* Línea de tiempo — progreso del presupuesto */}
        <LineaTiempoPortal
          estadoCliente={estadoCliente}
          cuotas={cuotas}
          comprobantes={comprobantes}
          monedaSimbolo={moneda_simbolo}
          totalFinal={presupuesto.total_final}
          colorMarca={colorMarca}
          estadoPresupuesto={estadoPresupuesto}
        />

        {/* Acciones: PDF, WhatsApp, llamar, aceptar/rechazar/cancelar */}
        <AccionesPortal
          pdfUrl={presupuesto.pdf_url}
          empresaTelefono={empresa.telefono}
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
          fechaVencimiento={presupuesto.fecha_vencimiento}
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

        {/* ── Sección de pagos (solo después de aceptar) ── */}
        {estadoCliente === 'aceptado' && (
          <div ref={pagoRef}>
            <SeccionCuotas
              cuotas={cuotas}
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

        {/* Mini chat cliente-vendedor */}
        <MiniChat
          mensajes={mensajes}
          nombreCliente={nombreContacto || 'Cliente'}
          colorMarca={colorMarca}
          token={token}
          locale={locale}
          onMensajeEnviado={(msg) => setMensajes(prev => [...prev, msg])}
        />

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


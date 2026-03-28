'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Search, X, MapPin, Mail, Phone, Trash2, History,
  Calendar as CalendarIcon, Lock, ArrowLeft,
  Send, Printer, FileCheck, Eye, Receipt, Ban, RotateCcw,
  Cloud, CloudOff, Info, RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TablaLineas } from '../_componentes/TablaLineas'
import { Boton } from '@/componentes/ui/Boton'
import EditorNotasPresupuesto from '../_componentes/EditorNotasPresupuesto'
import { Insignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useNavegacion } from '@/hooks/useNavegacion'
import type {
  PresupuestoConLineas, LineaPresupuesto, TipoLinea,
  Impuesto, UnidadMedida, CondicionPago, ConfigPresupuestos,
  EstadoPresupuesto,
} from '@/tipos/presupuesto'
import { ETIQUETAS_ESTADO, TRANSICIONES_ESTADO } from '@/tipos/presupuesto'
import BarraEstadoPresupuesto from '../_componentes/BarraEstadoPresupuesto'

// Símbolos de moneda
const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€',
}

// Transiciones importadas desde tipos centralizados

// Contacto resumido
interface ContactoResumido {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  condicion_iva: string | null
  direcciones: { texto: string | null; es_principal: boolean }[]
}

// Vinculación
interface Vinculacion {
  id: string
  vinculado_id: string
  puesto: string | null
  vinculado: {
    id: string
    nombre: string
    apellido: string | null
    correo: string | null
    telefono: string | null
    tipo_contacto: { clave: string; etiqueta: string } | null
  }
}

// Datos empresa emisora
interface DatosEmpresa {
  nombre: string
  telefono: string | null
  correo: string | null
  datos_fiscales: Record<string, unknown> | null
}

export default function PaginaDetallePresupuesto() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const nav = useNavegacion()
  const { empresa } = useEmpresa()

  const [presupuesto, setPresupuesto] = useState<PresupuestoConLineas | null>(null)
  const [config, setConfig] = useState<ConfigPresupuestos | null>(null)
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Campos editables
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([])
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([])
  const [notasHtml, setNotasHtml] = useState('')
  const [condicionesHtml, setCondicionesHtml] = useState('')
  const [referencia, setReferencia] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const [condicionPagoId, setCondicionPagoId] = useState('')
  const [diasVencimiento, setDiasVencimiento] = useState(30)

  // Buscador contacto
  const [busquedaContacto, setBusquedaContacto] = useState('')
  const [resultadosContacto, setResultadosContacto] = useState<ContactoResumido[]>([])
  const [menuContactoAbierto, setMenuContactoAbierto] = useState(false)
  const menuContactoRef = useRef<HTMLDivElement>(null)

  // Vinculaciones para "Dirigido a"
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([])

  // Cargar presupuesto, config y datos empresa
  useEffect(() => {
    Promise.all([
      fetch(`/api/presupuestos/${id}`).then(r => r.json()),
      fetch('/api/presupuestos/config').then(r => r.json()),
      fetch('/api/empresas/actualizar').then(r => r.json()),
    ]).then(([pres, conf, empData]) => {
      setPresupuesto(pres)
      setConfig(conf)
      if (empData.empresa) setDatosEmpresa(empData.empresa)
      setLineas(pres.lineas || [])
      setColumnasVisibles((pres.columnas_lineas as string[]) || conf.columnas_lineas_default || [])
      setNotasHtml(pres.notas_html || '')
      setCondicionesHtml(pres.condiciones_html || '')
      setReferencia(pres.referencia || '')
      setMoneda(pres.moneda || 'ARS')
      setCondicionPagoId(pres.condicion_pago_id || '')
      setDiasVencimiento(pres.dias_vencimiento || 30)
      setCargando(false)

      // Inicializar snapshot con valores cargados para dirty tracking
      guardadoRef.current = {
        notas_html: pres.notas_html || '',
        condiciones_html: pres.condiciones_html || '',
        referencia: pres.referencia || '',
        moneda: pres.moneda || 'ARS',
        condicion_pago_id: pres.condicion_pago_id || '',
        dias_vencimiento: pres.dias_vencimiento || 30,
        fecha_emision: pres.fecha_emision || '',
        columnas_lineas: (pres.columnas_lineas as string[]) || conf.columnas_lineas_default || [],
      }

      // Breadcrumb
      nav.setMigajaDinamica(`/presupuestos/${id}`, pres.numero || 'Detalle')

      // Cargar vinculaciones del contacto
      if (pres.contacto_id) {
        fetch(`/api/contactos/${pres.contacto_id}`)
          .then(r => r.json())
          .then(data => setVinculaciones(data.vinculaciones || []))
          .catch(() => {})
      }
    }).catch(() => setCargando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Snapshot del último estado guardado — para comparar y no guardar si no cambió nada
  const guardadoRef = useRef<Record<string, unknown>>({})

  // Autoguardar — solo persiste si el valor realmente cambió
  const autoguardar = useCallback((campos: Record<string, unknown>) => {
    // Filtrar campos que realmente cambiaron vs último guardado
    const cambios: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(campos)) {
      const anterior = guardadoRef.current[clave]
      if (JSON.stringify(valor) !== JSON.stringify(anterior)) {
        cambios[clave] = valor
      }
    }
    if (Object.keys(cambios).length === 0) return

    // Actualizar snapshot
    Object.assign(guardadoRef.current, cambios)

    setGuardando(true)
    fetch(`/api/presupuestos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setPresupuesto(prev => prev ? { ...prev, ...data } : null)
        }
      })
      .catch(() => {})
      .finally(() => setGuardando(false))
  }, [id])

  // Cambiar estado
  const cambiarEstado = async (nuevoEstado: EstadoPresupuesto) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/presupuestos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (res.ok) {
        const actualizado = await res.json()
        setPresupuesto(prev => prev ? { ...prev, ...actualizado } : null)
      }
    } catch { /* silenciar */ } finally {
      setGuardando(false)
    }
  }

  // CRUD de líneas
  const agregarLinea = useCallback(async (tipo: TipoLinea) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const impDefault = impuestos.find(i => i.activo && i.porcentaje > 0)
    try {
      const res = await fetch(`/api/presupuestos/${id}/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_linea: tipo,
          impuesto_label: tipo === 'producto' && impDefault ? impDefault.label : null,
          impuesto_porcentaje: tipo === 'producto' && impDefault ? String(impDefault.porcentaje) : '0',
        }),
      })
      if (res.ok) {
        const nuevas = await res.json()
        setLineas(prev => [...prev, ...(Array.isArray(nuevas) ? nuevas : [nuevas])])
        recargarTotales()
      }
    } catch { /* silenciar */ }
  }, [id, config])

  const editarLinea = useCallback((lineaId: string, campo: string, valor: string) => {
    setLineas(prev => {
      const nuevas = prev.map(l => {
        if (l.id !== lineaId) return l
        const act = { ...l, [campo]: valor }
        if (act.tipo_linea === 'producto') {
          const cant = parseFloat(act.cantidad || '1')
          const precio = parseFloat(act.precio_unitario || '0')
          const desc = parseFloat(act.descuento || '0')
          const impPct = parseFloat(act.impuesto_porcentaje || '0')
          const sub = cant * precio * (1 - desc / 100)
          act.subtotal = sub.toFixed(2)
          act.impuesto_monto = (sub * impPct / 100).toFixed(2)
          act.total = (sub + sub * impPct / 100).toFixed(2)
        }
        return act
      })

      // Persistir la línea actualizada (ya viene del blur de la celda)
      const lineaActualizada = nuevas.find(l => l.id === lineaId)
      if (lineaActualizada) {
        fetch(`/api/presupuestos/${id}/lineas`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...lineaActualizada, id: lineaId }),
        }).then(() => recargarTotales()).catch(() => {})
      }

      return nuevas
    })
  }, [id])

  const eliminarLinea = useCallback(async (lineaId: string) => {
    setLineas(prev => prev.filter(l => l.id !== lineaId))
    await fetch(`/api/presupuestos/${id}/lineas`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linea_id: lineaId }),
    })
    recargarTotales()
  }, [id])

  const reordenarLineas = useCallback(async (nuevosIds: string[]) => {
    setLineas(prev => {
      const mapa = new Map(prev.map(l => [l.id, l]))
      return nuevosIds.map((lid, idx) => ({ ...mapa.get(lid)!, orden: idx }))
    })
    await fetch(`/api/presupuestos/${id}/lineas`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reordenar: nuevosIds.map((lid, idx) => ({ id: lid, orden: idx })) }),
    })
  }, [id])

  const recargarTotales = useCallback(async () => {
    try {
      const res = await fetch(`/api/presupuestos/${id}`)
      const data = await res.json()
      setPresupuesto(prev => prev ? {
        ...prev,
        subtotal_neto: data.subtotal_neto,
        total_impuestos: data.total_impuestos,
        total_final: data.total_final,
        descuento_global_monto: data.descuento_global_monto,
      } : null)
    } catch { /* silenciar */ }
  }, [id])

  // Buscar contactos
  useEffect(() => {
    if (!busquedaContacto.trim()) { setResultadosContacto([]); return }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busquedaContacto)}&por_pagina=8`)
        const data = await res.json()
        setResultadosContacto(data.contactos || [])
      } catch { /* silenciar */ }
    }, 300)
    return () => clearTimeout(timeout)
  }, [busquedaContacto])

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (menuContactoRef.current && !menuContactoRef.current.contains(e.target as Node)) setMenuContactoAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  // Enviar presupuesto — cambia estado a enviado (TODO: integrar envío email con PDF)
  const handleEnviar = async () => {
    await cambiarEstado('enviado')
  }
  // TODO: Implementar envío como factura proforma (mismo email con label diferente)
  const handleEnviarProforma = () => { /* pendiente: integrar proforma */ }
  // TODO: Implementar generación de PDF e impresión
  const handleImprimir = () => { /* pendiente: integrar PDF */ }
  // TODO: Implementar vista previa del portal público del cliente
  const handleVistaPrevia = () => { /* pendiente: integrar portal */ }

  // Descartar/eliminar presupuesto
  const descartarPresupuesto = async () => {
    try {
      const res = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (data.accion === 'cancelado') {
        // No se pudo eliminar — hay presupuestos posteriores, se canceló
        setPresupuesto(prev => prev ? { ...prev, estado: 'cancelado' } : null)
        return
      }

      // Eliminado definitivamente
      router.push('/presupuestos')
    } catch (err) {
      console.error('Error al descartar presupuesto:', err)
    }
  }

  if (cargando || !presupuesto || !config) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 py-6">
        <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-borde-sutil animate-pulse">
            <div className="h-8 w-48 bg-superficie-app rounded-lg mb-3" />
            <div className="h-5 w-32 bg-superficie-app rounded-lg" />
          </div>
          <div className="px-6 py-8 space-y-4 animate-pulse">
            <div className="h-4 w-64 bg-superficie-app rounded" />
            <div className="h-4 w-40 bg-superficie-app rounded" />
          </div>
        </div>
      </div>
    )
  }

  const simbolo = SIMBOLO_MONEDA[presupuesto.moneda] || '$'
  const fmt = (v: string | number) => {
    const num = typeof v === 'number' ? v : parseFloat(v || '0')
    return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  const condiciones = (config.condiciones_pago || []) as CondicionPago[]
  const monedas = (config.monedas || []) as { id: string; label: string; simbolo: string; activo: boolean }[]
  const impuestosList = (config.impuestos || []) as Impuesto[]
  const unidadesList = (config.unidades || []) as UnidadMedida[]
  const esEditable = presupuesto.estado === 'borrador'
  const estadosPosibles = TRANSICIONES_ESTADO[presupuesto.estado as EstadoPresupuesto] || []
  const condSeleccionada = condiciones.find(c => c.id === condicionPagoId)
  const estaCancelado = presupuesto.estado === 'cancelado'

  // Datos fiscales emisor
  const fiscalEmisor = datosEmpresa?.datos_fiscales as Record<string, Record<string, string>> | null
  const paisFiscal = fiscalEmisor ? Object.keys(fiscalEmisor)[0] : null
  const datosFiscalesPais = paisFiscal ? fiscalEmisor?.[paisFiscal] : null

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-6 space-y-5">
      {/* ─── Contenedor principal ─── */}
      <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">

        {/* ─── Cabecera: 3 filas como el otro software ─── */}
        <div className="px-6 pt-5 pb-4 border-b border-borde-sutil">
          {/* Fila 1: Título (número del presupuesto) */}
          <h1 className="text-2xl sm:text-3xl font-semibold text-texto-secundario mb-2">{presupuesto.numero}</h1>

          {/* Fila 2: Iconos izquierda + Barra de estados derecha */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              <button
                className={`size-7 rounded-full flex items-center justify-center transition-all ${
                  guardando ? 'text-texto-marca animate-pulse' : 'text-texto-terciario hover:bg-superficie-app'
                }`}
                title={guardando ? 'Guardando...' : 'Guardado'}
              >
                <Cloud size={16} />
              </button>
              <button
                onClick={descartarPresupuesto}
                className="size-7 rounded-full flex items-center justify-center text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10 transition-colors"
                title="Eliminar presupuesto"
              >
                <X size={16} />
              </button>
              <button
                className="size-7 rounded-full flex items-center justify-center text-texto-terciario hover:bg-superficie-app transition-colors"
                title="Información del documento"
              >
                <Info size={16} />
              </button>
              <button
                className="size-7 rounded-full flex items-center justify-center text-texto-terciario hover:bg-superficie-app transition-colors"
                title="Regenerar PDF"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="ml-auto">
              <BarraEstadoPresupuesto
                estadoActual={presupuesto.estado as EstadoPresupuesto}
              />
            </div>
          </div>

          {/* Fila 3: Botones de acción — orden según estado */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              // Botón base reutilizable
              const BotonAccion = ({ onClick, icono: Icono, label, variante = 'default', disabled = false }: {
                onClick: () => void; icono: typeof Send; label: string; variante?: string; disabled?: boolean
              }) => (
                <button
                  onClick={onClick}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    variante === 'primario'
                      ? 'bg-marca-500 text-white hover:bg-marca-600 disabled:opacity-50'
                      : variante === 'peligro'
                        ? 'bg-estado-error/10 text-estado-error border border-estado-error/20 hover:bg-estado-error/20'
                        : 'text-texto-secundario bg-superficie-app border border-borde-sutil hover:bg-superficie-elevada disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <Icono size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )

              // Orden dinámico según estado (replicando el otro software)
              const esEnviado = presupuesto.estado === 'enviado'

              if (estaCancelado) {
                return (
                  <BotonAccion onClick={() => cambiarEstado('borrador')} icono={RotateCcw} label="Restablecer como Borrador" />
                )
              }

              const siguienteEstado = estadosPosibles.find(e => e !== 'cancelado' && e !== 'borrador')

              return (
                <>
                  {esEnviado ? (
                    <>
                      {siguienteEstado && <BotonAccion onClick={() => cambiarEstado(siguienteEstado)} icono={FileCheck} label="Confirmar" variante="primario" />}
                      <BotonAccion onClick={handleImprimir} icono={Printer} label="Imprimir" />
                      <BotonAccion onClick={handleEnviarProforma} icono={Receipt} label="Enviar Factura Proforma" />
                      <BotonAccion onClick={handleEnviar} icono={Send} label="Enviar" />
                      <BotonAccion onClick={handleVistaPrevia} icono={Eye} label="Vista previa" />
                      <BotonAccion onClick={() => cambiarEstado('cancelado')} icono={Ban} label="Cancelar" variante="peligro" />
                    </>
                  ) : (
                    <>
                      <BotonAccion onClick={handleEnviar} icono={Send} label="Enviar" />
                      <BotonAccion onClick={handleEnviarProforma} icono={Receipt} label="Enviar Factura Proforma" />
                      <BotonAccion onClick={handleImprimir} icono={Printer} label="Imprimir" />
                      {siguienteEstado && <BotonAccion onClick={() => cambiarEstado(siguienteEstado)} icono={FileCheck} label="Confirmar" variante="primario" />}
                      <BotonAccion onClick={handleVistaPrevia} icono={Eye} label="Vista previa" />
                      {!estaCancelado && estadosPosibles.includes('cancelado') && (
                        <BotonAccion onClick={() => cambiarEstado('cancelado')} icono={Ban} label="Cancelar" variante="peligro" />
                      )}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>

        {/* Banner de bloqueo si no es borrador */}
        {!esEditable && (
          <div className="px-6 py-3 bg-insignia-advertencia/10 border-b border-insignia-advertencia/20 flex items-center gap-2">
            <Lock size={14} className="text-insignia-advertencia" />
            <span className="text-sm text-texto-secundario">
              Este documento está en estado <strong>{ETIQUETAS_ESTADO[presupuesto.estado as EstadoPresupuesto]}</strong> y no se puede editar.
            </span>
            {estadosPosibles.includes('borrador') && (
              <button
                onClick={() => cambiarEstado('borrador')}
                className="text-sm text-marca-500 hover:underline ml-1"
              >
                Volver a Borrador
              </button>
            )}
          </div>
        )}

        {/* ─── EMISOR ─── */}
        <div className="px-6 py-4 border-b border-borde-sutil">
          <span className="text-[11px] text-texto-terciario font-medium uppercase tracking-wider">Emisor</span>
          <div className="mt-1">
            <p className="text-sm font-semibold text-texto-primario">
              {datosEmpresa?.nombre || empresa?.nombre || '—'}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-texto-secundario mt-0.5">
              {datosFiscalesPais?.numero_identificacion && (
                <span>CUIT {datosFiscalesPais.numero_identificacion}</span>
              )}
              {datosFiscalesPais?.condicion_iva && (
                <span>· {datosFiscalesPais.condicion_iva.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              )}
              {datosEmpresa?.telefono && <span>· {datosEmpresa.telefono}</span>}
              {datosEmpresa?.correo && <span>· {datosEmpresa.correo}</span>}
            </div>
          </div>
        </div>

        {/* ─── CLIENTE + DATOS (grid) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-borde-sutil">

          {/* Columna izquierda: Cliente + Dirigido a */}
          <div className="px-6 py-4 border-b lg:border-b-0 lg:border-r border-borde-sutil space-y-4">
            <div>
              <span className="text-[11px] text-texto-terciario font-medium uppercase tracking-wider">Cliente</span>

              {presupuesto.contacto_nombre ? (
                <div className="mt-2 p-3 bg-superficie-app rounded-lg border border-borde-sutil">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-texto-primario">
                          {presupuesto.contacto_nombre} {presupuesto.contacto_apellido || ''}
                        </span>
                        {presupuesto.contacto_tipo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario">
                            {presupuesto.contacto_tipo}
                          </span>
                        )}
                      </div>
                      {presupuesto.contacto_identificacion && (
                        <p className="text-xs text-texto-secundario">
                          {presupuesto.contacto_identificacion}
                          {presupuesto.contacto_condicion_iva && ` · ${presupuesto.contacto_condicion_iva.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
                        </p>
                      )}
                      {presupuesto.contacto_direccion && (
                        <p className="text-xs text-texto-terciario flex items-center gap-1">
                          <MapPin size={12} />
                          {presupuesto.contacto_direccion}
                        </p>
                      )}
                    </div>
                    {presupuesto.contacto_id && (
                      <button
                        onClick={() => router.push(`/contactos/${presupuesto.contacto_id}`)}
                        className="p-1 rounded hover:bg-superficie-tarjeta text-texto-terciario"
                        title="Ver contacto"
                      >
                        <ArrowLeft size={14} className="rotate-[135deg]" />
                      </button>
                    )}
                  </div>
                </div>
              ) : esEditable ? (
                <div className="relative mt-2" ref={menuContactoRef}>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-terciario" />
                    <input
                      type="text"
                      value={busquedaContacto}
                      onChange={(e) => { setBusquedaContacto(e.target.value); setMenuContactoAbierto(true) }}
                      onFocus={() => setMenuContactoAbierto(true)}
                      placeholder="Escribí para encontrar un contacto..."
                      className="w-full pl-9 pr-4 py-2.5 bg-superficie-app border border-borde-sutil rounded-lg text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 transition-colors"
                    />
                  </div>
                  <AnimatePresence>
                    {menuContactoAbierto && resultadosContacto.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-xl z-30 max-h-[280px] overflow-y-auto"
                      >
                        {resultadosContacto.map(c => (
                          <button
                            key={c.id}
                            onClick={async () => {
                              setMenuContactoAbierto(false)
                              setBusquedaContacto('')
                              const res = await fetch(`/api/presupuestos/${id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contacto_id: c.id }),
                              })
                              if (res.ok) {
                                const act = await res.json()
                                setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                                // Cargar vinculaciones
                                fetch(`/api/contactos/${c.id}`)
                                  .then(r => r.json())
                                  .then(data => setVinculaciones(data.vinculaciones || []))
                                  .catch(() => {})
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-superficie-tarjeta transition-colors"
                          >
                            <div className="size-8 rounded-full bg-marca-500/10 text-marca-500 flex items-center justify-center font-bold text-xs shrink-0">
                              {c.nombre[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-texto-primario truncate">{c.nombre} {c.apellido || ''}</div>
                              <div className="text-xs text-texto-terciario truncate">{c.correo || c.codigo}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-sm text-texto-terciario mt-2">Sin cliente asignado</p>
              )}
            </div>

            {/* DIRIGIDO A */}
            {presupuesto.atencion_nombre ? (
              <div>
                <span className="text-[11px] text-texto-terciario font-medium uppercase tracking-wider">Dirigido a</span>
                <div className="mt-2 p-3 bg-superficie-app rounded-lg border border-borde-sutil space-y-0.5">
                  <p className="text-sm font-semibold text-texto-primario">{presupuesto.atencion_nombre}</p>
                  {presupuesto.atencion_correo && (
                    <p className="text-xs text-texto-secundario flex items-center gap-1"><Mail size={12} /> {presupuesto.atencion_correo}</p>
                  )}
                  {presupuesto.atencion_cargo && (
                    <p className="text-xs text-texto-terciario">{presupuesto.atencion_cargo}</p>
                  )}
                  <p className="text-[10px] text-texto-terciario mt-1">Aparecerá como &quot;Atención:&quot; en el PDF del documento</p>
                </div>
              </div>
            ) : vinculaciones.length > 0 && esEditable ? (
              <div>
                <span className="text-[11px] text-texto-terciario font-medium uppercase tracking-wider">Dirigido a</span>
                <p className="text-[10px] text-texto-terciario mt-0.5 mb-2">Aparecerá como &quot;Atención:&quot; en el PDF del documento</p>
                <div className="space-y-1">
                  {vinculaciones.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        autoguardar({
                          atencion_contacto_id: v.vinculado.id,
                          atencion_nombre: `${v.vinculado.nombre} ${v.vinculado.apellido || ''}`.trim(),
                          atencion_correo: v.vinculado.correo,
                        })
                        setPresupuesto(prev => prev ? {
                          ...prev,
                          atencion_contacto_id: v.vinculado.id,
                          atencion_nombre: `${v.vinculado.nombre} ${v.vinculado.apellido || ''}`.trim(),
                          atencion_correo: v.vinculado.correo,
                        } : null)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-superficie-app transition-colors border border-transparent hover:border-borde-sutil"
                    >
                      <div className="size-7 rounded-full bg-superficie-app text-texto-terciario flex items-center justify-center text-xs font-bold">
                        {v.vinculado.nombre[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-texto-primario truncate">
                          {v.vinculado.nombre} {v.vinculado.apellido || ''}
                        </div>
                        <div className="text-xs text-texto-terciario truncate">
                          {v.puesto || v.vinculado.correo || ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Columna derecha: Datos del presupuesto */}
          <div className="px-6 py-4">
            <div className="space-y-3">
              {/* Fecha emisión */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide shrink-0">Fecha</span>
                <div className="w-48">
                  {esEditable ? (
                    <SelectorFecha
                      valor={presupuesto.fecha_emision?.split('T')[0] || ''}
                      onChange={(v) => v && autoguardar({ fecha_emision: v })}
                      limpiable={false}
                    />
                  ) : (
                    <span className="text-sm text-texto-primario">{formatoFecha(presupuesto.fecha_emision)}</span>
                  )}
                </div>
              </div>

              {/* Fecha vencimiento — días + fecha */}
              {(() => {
                const bloqueada = !!(config as unknown as Record<string, unknown> | null)?.validez_bloqueada
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide shrink-0">Vencimiento</span>
                      {esEditable && !bloqueada && (
                        <span className="text-xs text-texto-terciario tabular-nums">({diasVencimiento} días)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {esEditable && !bloqueada && (
                        <input
                          type="number"
                          min={1}
                          value={diasVencimiento}
                          onChange={(e) => {
                            const dias = Math.max(1, parseInt(e.target.value) || 1)
                            setDiasVencimiento(dias)
                          }}
                          onBlur={() => autoguardar({ dias_vencimiento: diasVencimiento })}
                          onFocus={(e) => e.target.select()}
                          className="w-16 bg-transparent border border-borde-sutil rounded-lg px-2 py-1.5 text-xs font-mono text-texto-primario text-center outline-none focus:border-marca-500 transition-colors"
                          title="Días de validez"
                        />
                      )}
                      <div className="w-36">
                        {esEditable ? (
                          <SelectorFecha
                            valor={presupuesto.fecha_vencimiento?.split('T')[0] || ''}
                            onChange={(v) => {
                              if (!v || bloqueada) return
                              const emision = new Date((presupuesto.fecha_emision || '').split('T')[0] + 'T00:00:00')
                              const venc = new Date(v + 'T00:00:00')
                              const diff = Math.round((venc.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24))
                              setDiasVencimiento(Math.max(1, diff))
                              autoguardar({ dias_vencimiento: Math.max(1, diff) })
                            }}
                            limpiable={false}
                            disabled={bloqueada}
                          />
                        ) : (
                          <span className={`text-sm ${presupuesto.fecha_vencimiento && new Date(presupuesto.fecha_vencimiento) < new Date() ? 'text-estado-error font-medium' : 'text-texto-primario'}`}>
                            {presupuesto.fecha_vencimiento ? formatoFecha(presupuesto.fecha_vencimiento) : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="border-t border-borde-sutil" />

              {/* Condición de pago */}
              {esEditable ? (
                <Select
                  etiqueta="Términos de pago"
                  valor={condicionPagoId}
                  onChange={(v) => {
                    setCondicionPagoId(v)
                    const cond = condiciones.find(c => c.id === v)
                    autoguardar({
                      condicion_pago_id: v,
                      condicion_pago_label: cond?.label,
                      condicion_pago_tipo: cond?.tipo,
                    })
                  }}
                  opciones={[
                    { valor: '', etiqueta: 'Sin condición' },
                    ...condiciones.map(c => ({ valor: c.id, etiqueta: c.label })),
                  ]}
                />
              ) : (
                <div>
                  <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide block mb-1">Términos de pago</span>
                  <span className="text-sm text-texto-primario">{presupuesto.condicion_pago_label || 'Sin condición'}</span>
                </div>
              )}

              {/* Desglose hitos */}
              {condSeleccionada?.tipo === 'hitos' && condSeleccionada.hitos.length > 0 && (
                <div className="space-y-1 bg-superficie-app/50 rounded-lg px-3 py-2">
                  {condSeleccionada.hitos.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-texto-secundario">{h.descripcion}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-texto-terciario">{h.porcentaje}%</span>
                        <span className="text-texto-primario font-mono">
                          {fmt(parseFloat(presupuesto.total_final || '0') * h.porcentaje / 100)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-borde-sutil" />

              {/* Referencia */}
              <div>
                <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide block mb-1.5">Referencia</span>
                {esEditable ? (
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    onBlur={() => autoguardar({ referencia })}
                    placeholder="Orden de compra, PO..."
                    className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2 text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 transition-colors"
                  />
                ) : (
                  <span className="text-sm text-texto-primario">{presupuesto.referencia || '—'}</span>
                )}
              </div>

              {/* Moneda */}
              {esEditable ? (
                <Select
                  etiqueta="Moneda"
                  valor={moneda}
                  onChange={(v) => { setMoneda(v); autoguardar({ moneda: v }) }}
                  opciones={monedas.filter(m => m.activo).map(m => ({
                    valor: m.id,
                    etiqueta: `${m.simbolo} ${m.label}`,
                  }))}
                />
              ) : (
                <div>
                  <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide block mb-1">Moneda</span>
                  <span className="text-sm text-texto-primario">{simbolo} {monedas.find(m => m.id === presupuesto.moneda)?.label || presupuesto.moneda}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── TABLA DE LÍNEAS ─── */}
        <div className="px-6 py-4">
          <TablaLineas
            lineas={lineas}
            columnasVisibles={columnasVisibles}
            impuestos={impuestosList}
            unidades={unidadesList}
            moneda={presupuesto.moneda}
            simboloMoneda={simbolo}
            soloLectura={!esEditable}
            onAgregarLinea={agregarLinea}
            onEditarLinea={editarLinea}
            onEliminarLinea={eliminarLinea}
            onReordenar={reordenarLineas}
            onCambiarColumnas={(cols) => {
              setColumnasVisibles(cols)
              autoguardar({ columnas_lineas: cols })
            }}
          />
        </div>

        {/* ─── TOTALES ─── */}
        <div className="px-6 py-4 border-t border-borde-sutil">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-texto-secundario">Subtotal</span>
                <span className="font-mono text-texto-primario">{fmt(presupuesto.subtotal_neto)}</span>
              </div>
              {parseFloat(presupuesto.total_impuestos || '0') !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-texto-secundario">Impuestos</span>
                  <span className="font-mono text-texto-primario">{fmt(presupuesto.total_impuestos)}</span>
                </div>
              )}
              <div className="border-t border-borde-sutil pt-2 flex justify-between text-base font-bold">
                <span className="text-texto-primario">Total</span>
                <span className="font-mono text-texto-marca">{fmt(presupuesto.total_final)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── NOTAS ─── */}
        <div className="border-t border-borde-sutil px-6 py-4">
          <EditorNotasPresupuesto
            valor={notasHtml}
            onChange={(v) => setNotasHtml(v)}
            onBlur={() => autoguardar({ notas_html: notasHtml })}
            placeholder="Escribe una nota..."
            soloLectura={!esEditable}
            etiqueta="Notas"
          />
        </div>

        {/* ─── CONDICIONES / TÉRMINOS ─── */}
        <div className="border-t border-borde-sutil px-6 py-4">
          <EditorNotasPresupuesto
            valor={condicionesHtml}
            onChange={(v) => setCondicionesHtml(v)}
            onBlur={() => autoguardar({ condiciones_html: condicionesHtml })}
            placeholder="Escribe una condición..."
            soloLectura={!esEditable}
            etiqueta="Condiciones / Términos"
          />
        </div>

        {/* ─── HISTORIAL ─── */}
        {presupuesto.historial && presupuesto.historial.length > 0 && (
          <div className="px-6 py-4 border-t border-borde-sutil">
            <span className="text-[11px] text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1 mb-3">
              <History size={12} /> Historial
            </span>
            <div className="space-y-2">
              {presupuesto.historial.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-xs">
                  <Insignia color={COLOR_ESTADO_DOCUMENTO[h.estado] || 'neutro'}>
                    {ETIQUETAS_ESTADO[h.estado as EstadoPresupuesto] || h.estado}
                  </Insignia>
                  <span className="text-texto-terciario">
                    {new Date(h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {h.usuario_nombre && <span className="text-texto-terciario">— {h.usuario_nombre}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

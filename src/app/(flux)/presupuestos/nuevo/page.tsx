'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Cloud, X, Mail, Phone, ExternalLink,
} from 'lucide-react'
import { TablaLineas } from '../_componentes/TablaLineas'
import EditorNotasPresupuesto from '../_componentes/EditorNotasPresupuesto'
import SelectorContactoPresupuesto from '../_componentes/SelectorContactoPresupuesto'
import SelectorPlantilla from '../_componentes/SelectorPlantilla'
import BarraEstadoPresupuesto from '../_componentes/BarraEstadoPresupuesto'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'
import type {
  LineaPresupuesto, TipoLinea, Impuesto, UnidadMedida,
  CondicionPago, ConfigPresupuestos,
} from '@/tipos/presupuesto'

// Símbolos de moneda
const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€',
}

// Contacto del buscador
interface ContactoResumido {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  datos_fiscales: Record<string, string> | null
  condicion_iva: string | null
  direcciones: { texto: string | null; es_principal: boolean }[]
}

// Vinculación de un contacto
interface Vinculacion {
  id: string
  vinculado_id: string
  puesto: string | null
  recibe_documentos: boolean
  vinculado: {
    id: string
    nombre: string
    apellido: string | null
    correo: string | null
    telefono: string | null
    tipo_contacto: { clave: string; etiqueta: string } | null
  }
}

// Datos fiscales de la empresa emisora
interface DatosEmpresa {
  nombre: string
  telefono: string | null
  correo: string | null
  datos_fiscales: Record<string, unknown> | null
}

// Línea temporal
interface LineaTemporal extends Omit<LineaPresupuesto, 'presupuesto_id'> {
  _temp: true
}

export default function PaginaNuevoPresupuesto() {
  const router = useRouter()
  const { empresa } = useEmpresa()
  const { usuario } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [config, setConfig] = useState<ConfigPresupuestos | null>(null)
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresa | null>(null)
  const [plantillaId, setPlantillaId] = useState<string | null>(null)

  // Estado post-creación: la página se transforma en editor sin navegar
  const [presupuestoId, setPresupuestoId] = useState<string | null>(null)
  const [numeroPresupuesto, setNumeroPresupuesto] = useState<string | null>(null)

  // Contacto
  const [contactoId, setContactoId] = useState<string | null>(null)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<ContactoResumido | null>(null)

  // Dirigido a (vinculación)
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([])
  const [atencionId, setAtencionId] = useState<string | null>(null)
  const [atencionSeleccionada, setAtencionSeleccionada] = useState<Vinculacion['vinculado'] | null>(null)

  // Datos del presupuesto
  const [moneda, setMoneda] = useState('ARS')
  const [condicionPagoId, setCondicionPagoId] = useState('')
  const [diasVencimiento, setDiasVencimiento] = useState(30)
  const [referencia, setReferencia] = useState('')
  const [notasHtml, setNotasHtml] = useState('')
  const [condicionesHtml, setCondicionesHtml] = useState('')
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().split('T')[0])

  // Líneas
  const [lineas, setLineas] = useState<LineaTemporal[]>([])
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([
    'producto', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento', 'impuesto', 'subtotal',
  ])

  // Cargar config y datos empresa al montar
  useEffect(() => {
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => {
        setConfig(data)
        if (data.moneda_predeterminada) setMoneda(data.moneda_predeterminada)
        if (data.dias_vencimiento_predeterminado) setDiasVencimiento(data.dias_vencimiento_predeterminado)
        if (data.notas_predeterminadas) setNotasHtml(data.notas_predeterminadas)
        if (data.condiciones_predeterminadas) setCondicionesHtml(data.condiciones_predeterminadas)
        if (data.columnas_lineas_default) setColumnasVisibles(data.columnas_lineas_default as string[])
        const condiciones = (data.condiciones_pago || []) as CondicionPago[]
        const defecto = condiciones.find(c => c.predeterminado)
        if (defecto) setCondicionPagoId(defecto.id)
      })
      .catch(() => {})
  }, [])

  // Cargar datos de la empresa emisora
  useEffect(() => {
    if (!empresa?.id) return
    fetch('/api/empresas/actualizar')
      .then(r => r.json())
      .then(data => {
        if (data.empresa) setDatosEmpresa(data.empresa)
      })
      .catch(() => {})
  }, [empresa?.id])

  // Ref para evitar doble creación
  const creandoRef = useRef(false)

  // Crear presupuesto — se dispara al seleccionar contacto o con la nubecita
  // Usa refs para tener siempre los valores actuales sin recrear la función
  const contactoIdRef = useRef(contactoId)
  contactoIdRef.current = contactoId
  const configRef = useRef(config)
  configRef.current = config
  const condicionPagoIdRef = useRef(condicionPagoId)
  condicionPagoIdRef.current = condicionPagoId
  const monedaRef = useRef(moneda)
  monedaRef.current = moneda
  const diasVencimientoRef = useRef(diasVencimiento)
  diasVencimientoRef.current = diasVencimiento
  const referenciaRef = useRef(referencia)
  referenciaRef.current = referencia
  const notasHtmlRef = useRef(notasHtml)
  notasHtmlRef.current = notasHtml
  const condicionesHtmlRef = useRef(condicionesHtml)
  condicionesHtmlRef.current = condicionesHtml
  const columnasVisiblesRef = useRef(columnasVisibles)
  columnasVisiblesRef.current = columnasVisibles
  const lineasRef = useRef(lineas)
  lineasRef.current = lineas

  const crearPresupuesto = useCallback(async () => {
    const cId = contactoIdRef.current
    if (!cId || creandoRef.current) return
    creandoRef.current = true

    // Generar número optimista al instante (el título cambia ya)
    const cfg = configRef.current
    const sec = (cfg as unknown as Record<string, unknown>)?.secuencia as { prefijo?: string; siguiente?: number; digitos?: number } | undefined
    const prefijo = sec?.prefijo || 'P'
    const siguiente = sec?.siguiente || 1
    const digitos = sec?.digitos || 4
    const numeroOptimista = `${prefijo}-${String(siguiente).padStart(digitos, '0')}`
    setNumeroPresupuesto(numeroOptimista)
    setGuardando(true)

    try {
      const conds = (cfg?.condiciones_pago || []) as CondicionPago[]
      const condSel = conds.find(c => c.id === condicionPagoIdRef.current) || conds.find(c => c.predeterminado)

      const payload = {
        contacto_id: cId,
        moneda: monedaRef.current,
        condicion_pago_id: condSel?.id || condicionPagoIdRef.current || undefined,
        condicion_pago_label: condSel?.label,
        condicion_pago_tipo: condSel?.tipo,
        dias_vencimiento: condSel?.tipo === 'plazo_fijo' ? condSel.diasVencimiento : diasVencimientoRef.current,
        referencia: referenciaRef.current || undefined,
        notas_html: notasHtmlRef.current || undefined,
        condiciones_html: condicionesHtmlRef.current || undefined,
        columnas_lineas: columnasVisiblesRef.current,
        lineas: lineasRef.current.filter(l => l.descripcion || l.codigo_producto).map(l => ({
          tipo_linea: l.tipo_linea,
          orden: l.orden,
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion,
          descripcion_detalle: l.descripcion_detalle,
          cantidad: l.cantidad,
          unidad: l.unidad,
          precio_unitario: l.precio_unitario,
          descuento: l.descuento,
          impuesto_label: l.impuesto_label,
          impuesto_porcentaje: l.impuesto_porcentaje,
          monto: l.monto,
        })),
      }

      const res = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const presupuesto = await res.json()
        setPresupuestoId(presupuesto.id)
        // Corregir número si el servidor dio uno distinto
        if (presupuesto.numero !== numeroOptimista) {
          setNumeroPresupuesto(presupuesto.numero)
        }
        // Inicializar snapshot con el estado recién creado
        guardadoRef.current = {
          notas_html: notasHtmlRef.current || '',
          condiciones_html: condicionesHtmlRef.current || '',
          referencia: referenciaRef.current || '',
          moneda: monedaRef.current,
          condicion_pago_id: condicionPagoIdRef.current || '',
          dias_vencimiento: diasVencimientoRef.current,
          columnas_lineas: columnasVisiblesRef.current,
        }
        setGuardando(false)
        window.history.replaceState(null, '', `/presupuestos/${presupuesto.id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Error al crear presupuesto:', res.status, err)
        setNumeroPresupuesto(null)
        creandoRef.current = false
        setGuardando(false)
      }
    } catch (err) {
      console.error('Error al crear presupuesto:', err)
      setNumeroPresupuesto(null)
      creandoRef.current = false
      setGuardando(false)
    }
  }, [router])

  // Seleccionar contacto → cargar datos, vinculaciones y pre-crear presupuesto
  const seleccionarContacto = useCallback(async (contacto: ContactoResumido) => {
    setContactoId(contacto.id)
    setContactoSeleccionado(contacto)
    setAtencionId(null)
    setAtencionSeleccionada(null)

    // Actualizar ref inmediatamente para que crearPresupuesto lo vea
    contactoIdRef.current = contacto.id

    // Cargar vinculaciones del contacto para "Dirigido a"
    try {
      const res = await fetch(`/api/contactos/${contacto.id}`)
      const data = await res.json()
      setVinculaciones(data.vinculaciones || [])
    } catch {
      setVinculaciones([])
    }

    // Pre-crear presupuesto como borrador inmediatamente
    // Así no se pierde si el usuario navega atrás o cierra
    crearPresupuesto()
  }, [crearPresupuesto])

  // Autoguardado post-creación (PATCH al presupuesto ya creado)
  const presupuestoIdRef = useRef(presupuestoId)
  presupuestoIdRef.current = presupuestoId

  // Snapshot del último estado guardado — para comparar y no guardar si no cambió nada
  const guardadoRef = useRef<Record<string, unknown>>({})

  // Guardar inmediato — para selects, fechas, checkboxes (acciones definitivas)
  const autoguardar = useCallback((campos: Record<string, unknown>) => {
    const pid = presupuestoIdRef.current
    if (!pid) return

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
    fetch(`/api/presupuestos/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    })
      .catch(() => {})
      .finally(() => setGuardando(false))
  }, [])

  // Descartar/eliminar presupuesto
  const descartarPresupuesto = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (pid) {
      try {
        await fetch(`/api/presupuestos/${pid}`, { method: 'DELETE' })
      } catch { /* silenciar */ }
    }
    router.push('/presupuestos')
  }, [router])

  // Limpiar contacto
  const limpiarContacto = useCallback(() => {
    setContactoId(null)
    setContactoSeleccionado(null)
    setVinculaciones([])
    setAtencionId(null)
    setAtencionSeleccionada(null)
  }, [])

  // Seleccionar "Dirigido a"
  const seleccionarAtencion = useCallback((vinc: Vinculacion) => {
    setAtencionId(vinc.vinculado.id)
    setAtencionSeleccionada(vinc.vinculado)
  }, [])

  // Agregar línea — si ya se creó el presupuesto, persiste en la API
  const agregarLinea = useCallback(async (tipo: TipoLinea) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const impDefault = impuestos.find(i => i.activo && i.porcentaje > 0)
    const pid = presupuestoIdRef.current

    if (pid) {
      // Presupuesto ya creado → persistir directamente
      try {
        const res = await fetch(`/api/presupuestos/${pid}/lineas`, {
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
          setLineas(prev => [...prev, ...(Array.isArray(nuevas) ? nuevas : [nuevas])] as LineaTemporal[])
        }
      } catch { /* silenciar */ }
    } else {
      // Aún no se creó → línea temporal en memoria
      const nuevaLinea: LineaTemporal = {
        _temp: true,
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tipo_linea: tipo,
        orden: lineas.length,
        codigo_producto: null,
        descripcion: tipo === 'seccion' ? '' : null,
        descripcion_detalle: null,
        cantidad: '1',
        unidad: null,
        precio_unitario: '0',
        descuento: '0',
        impuesto_label: tipo === 'producto' && impDefault ? impDefault.label : null,
        impuesto_porcentaje: tipo === 'producto' && impDefault ? String(impDefault.porcentaje) : '0',
        subtotal: '0',
        impuesto_monto: '0',
        total: '0',
        monto: tipo === 'descuento' ? '0' : null,
      }
      setLineas(prev => [...prev, nuevaLinea])
    }
  }, [lineas.length, config])

  // Editar línea con recálculo — si ya se creó el presupuesto, autoguarda
  const editarLinea = useCallback((id: string, campo: string, valor: string) => {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l
      const actualizada = { ...l, [campo]: valor }

      if (actualizada.tipo_linea === 'producto') {
        const cantidad = parseFloat(actualizada.cantidad || '1')
        const precio = parseFloat(actualizada.precio_unitario || '0')
        const desc = parseFloat(actualizada.descuento || '0')
        const impPct = parseFloat(actualizada.impuesto_porcentaje || '0')
        const subtotal = cantidad * precio * (1 - desc / 100)
        const impMonto = subtotal * impPct / 100
        actualizada.subtotal = subtotal.toFixed(2)
        actualizada.impuesto_monto = impMonto.toFixed(2)
        actualizada.total = (subtotal + impMonto).toFixed(2)
      }

      return actualizada
    }))

    // Persistir línea en la API (ya viene del blur de la celda, es cambio confirmado)
    const pid = presupuestoIdRef.current
    if (pid) {
      // Leer la línea actualizada del state más reciente via ref
      setTimeout(async () => {
        const linea = lineasRef.current.find(l => l.id === id)
        if (!linea) return
        await fetch(`/api/presupuestos/${pid}/lineas`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...linea, id }),
        })
      }, 0)
    }
  }, [])

  const eliminarLinea = useCallback(async (id: string) => {
    setLineas(prev => prev.filter(l => l.id !== id))
    const pid = presupuestoIdRef.current
    if (pid) {
      await fetch(`/api/presupuestos/${pid}/lineas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea_id: id }),
      })
    }
  }, [])

  const reordenarLineas = useCallback(async (nuevosIds: string[]) => {
    setLineas(prev => {
      const mapa = new Map(prev.map(l => [l.id, l]))
      return nuevosIds.map((id, idx) => {
        const linea = mapa.get(id)!
        return { ...linea, orden: idx }
      })
    })
    const pid = presupuestoIdRef.current
    if (pid) {
      await fetch(`/api/presupuestos/${pid}/lineas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reordenar: nuevosIds.map((lid, idx) => ({ id: lid, orden: idx })) }),
      })
    }
  }, [])

  // Calcular totales
  const totales = (() => {
    let subtotal = 0
    let impuestos = 0
    for (const l of lineas) {
      if (l.tipo_linea === 'producto') {
        subtotal += parseFloat(l.subtotal || '0')
        impuestos += parseFloat(l.impuesto_monto || '0')
      } else if (l.tipo_linea === 'descuento') {
        subtotal += parseFloat(l.monto || '0')
      }
    }
    return { subtotal, impuestos, total: subtotal + impuestos }
  })()

  const simbolo = SIMBOLO_MONEDA[moneda] || '$'
  const fmt = (n: number) => `${simbolo} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const condiciones = (config?.condiciones_pago || []) as CondicionPago[]
  const monedas = (config?.monedas || []) as { id: string; label: string; simbolo: string; activo: boolean }[]
  const impuestosList = (config?.impuestos || []) as Impuesto[]
  const unidadesList = (config?.unidades || []) as UnidadMedida[]
  const condSeleccionada = condiciones.find(c => c.id === condicionPagoId)

  // Fecha vencimiento calculada
  const fechaVenc = (() => {
    const f = new Date(fechaEmision)
    const dias = condSeleccionada?.tipo === 'plazo_fijo' ? condSeleccionada.diasVencimiento : diasVencimiento
    f.setDate(f.getDate() + dias)
    return f
  })()

  const formatearFecha = (d: Date | string) => {
    const fecha = typeof d === 'string' ? new Date(d) : d
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Datos fiscales del emisor
  const fiscalEmisor = datosEmpresa?.datos_fiscales as Record<string, Record<string, string>> | null
  const paisFiscal = fiscalEmisor ? Object.keys(fiscalEmisor)[0] : null
  const datosFiscalesPais = paisFiscal ? fiscalEmisor?.[paisFiscal] : null

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-6 space-y-5">
      {/* ─── Contenedor principal ─── */}
      <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">

        {/* ─── Cabecera: 3 filas como el otro software ─── */}
        <div className="px-6 pt-5 pb-4 border-b border-borde-sutil">
          {/* Fila 1: Título — cambia de "Nuevo" a "P-0005" instantáneamente */}
          <h1 className="text-2xl sm:text-3xl font-semibold text-texto-primario mb-2">
            {numeroPresupuesto || 'Nuevo'}
          </h1>

          {/* Fila 2: Iconos izquierda + Barra de estados derecha */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {/* Nubecita: antes de crear = guardar, después de crear = estado guardado */}
              <button
                onClick={presupuestoId ? () => autoguardar({}) : crearPresupuesto}
                disabled={!contactoId || guardando}
                className={`size-7 rounded-full flex items-center justify-center transition-all ${
                  guardando
                    ? 'text-texto-marca animate-pulse'
                    : presupuestoId
                      ? 'text-texto-terciario'
                      : contactoId
                        ? 'text-texto-terciario hover:text-texto-marca hover:bg-superficie-app cursor-pointer'
                        : 'text-texto-terciario/30 cursor-not-allowed'
                }`}
                title={guardando ? 'Guardando...' : presupuestoId ? 'Guardado' : contactoId ? 'Guardar presupuesto' : 'Seleccioná un cliente primero'}
              >
                <Cloud size={16} />
              </button>
              {/* X: antes de crear = descartar, después de crear = eliminar */}
              <button
                onClick={descartarPresupuesto}
                className={`size-7 rounded-full flex items-center justify-center transition-colors ${
                  presupuestoId
                    ? 'text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10'
                    : 'text-texto-terciario hover:bg-superficie-app'
                }`}
                title={presupuestoId ? 'Eliminar presupuesto' : 'Descartar'}
              >
                <X size={16} />
              </button>
            </div>
            <div className="ml-auto">
              <BarraEstadoPresupuesto estadoActual="borrador" />
            </div>
          </div>

          {/* Fila 3: Indicación */}
          {!contactoId && !presupuestoId && (
            <p className="text-sm text-texto-terciario">
              Seleccioná un cliente para crear el presupuesto
            </p>
          )}
        </div>

        {/* ─── EMISOR ─── */}
        <div className="px-6 py-3">
          <span className="text-[11px] font-bold text-texto-secundario uppercase tracking-wider">Emisor</span>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-sm font-semibold text-texto-primario">
              {datosEmpresa?.nombre || empresa?.nombre || '—'}
            </p>
            {(datosFiscalesPais?.numero_identificacion || datosFiscalesPais?.condicion_iva) && (
              <p className="text-xs text-texto-secundario">
                {datosFiscalesPais?.numero_identificacion && `CUIT ${datosFiscalesPais.numero_identificacion}`}
                {datosFiscalesPais?.numero_identificacion && datosFiscalesPais?.condicion_iva && ' · '}
                {datosFiscalesPais?.condicion_iva?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            )}
            {(datosEmpresa?.telefono || datosEmpresa?.correo) && (
              <p className="text-xs text-texto-secundario">
                {datosEmpresa.telefono}
                {datosEmpresa.telefono && datosEmpresa.correo && ' · '}
                {datosEmpresa.correo}
              </p>
            )}
          </div>
        </div>

        {/* ─── CLIENTE + DATOS DEL PRESUPUESTO (grid plano) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 px-6 pb-3 border-b border-borde-sutil">

          {/* ── Columna izquierda: Cliente + Dirigido a ── */}
          <div className="space-y-3 py-3">
            {/* CLIENTE */}
            <div className="bg-superficie-app/30 rounded-lg px-3 py-3 -mx-3">
              <span className="text-[11px] font-bold text-texto-secundario uppercase tracking-wider">
                Cliente
              </span>
              <div className="mt-1.5">
                <SelectorContactoPresupuesto
                  contacto={contactoSeleccionado ? {
                    id: contactoSeleccionado.id,
                    nombre: contactoSeleccionado.nombre,
                    apellido: contactoSeleccionado.apellido,
                    correo: contactoSeleccionado.correo,
                    telefono: contactoSeleccionado.telefono,
                    tipo_contacto: contactoSeleccionado.tipo_contacto,
                    numero_identificacion: contactoSeleccionado.numero_identificacion,
                    condicion_iva: contactoSeleccionado.condicion_iva || null,
                    direccion: contactoSeleccionado.direcciones?.find(d => d.es_principal)?.texto || null,
                  } : null}
                  onChange={(c) => {
                    if (c) {
                      seleccionarContacto(c)
                    } else {
                      limpiarContacto()
                    }
                  }}
                  onSeleccionarConDirigidoA={async (padre, hijoId) => {
                    // Cargar padre como cliente
                    await seleccionarContacto(padre)
                    // Buscar datos del hijo para setear como dirigido a
                    try {
                      const res = await fetch(`/api/contactos/${hijoId}`)
                      const hijo = await res.json()
                      if (hijo) {
                        setAtencionId(hijo.id)
                        setAtencionSeleccionada({
                          id: hijo.id,
                          nombre: hijo.nombre,
                          apellido: hijo.apellido,
                          correo: hijo.correo,
                          telefono: hijo.telefono,
                          tipo_contacto: hijo.tipo_contacto,
                        })
                      }
                    } catch { /* silenciar */ }
                  }}
                />
              </div>
            </div>

            {/* DIRIGIDO A */}
            {contactoSeleccionado && vinculaciones.length > 0 && (
              <div className="bg-superficie-app/30 rounded-lg px-3 py-3 -mx-3">
                <span className="text-[11px] font-bold text-texto-secundario uppercase tracking-wider">
                  Dirigido a
                </span>

                {atencionSeleccionada ? (
                  <div className="mt-1.5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-texto-primario">
                          {atencionSeleccionada.nombre} {atencionSeleccionada.apellido || ''}
                        </p>
                        {atencionSeleccionada.correo && (
                          <p className="text-xs text-texto-secundario flex items-center gap-1.5">
                            <Mail size={13} className="text-texto-terciario shrink-0" />
                            {atencionSeleccionada.correo}
                          </p>
                        )}
                        {atencionSeleccionada.telefono && (
                          <p className="text-xs text-texto-secundario flex items-center gap-1.5">
                            <Phone size={13} className="text-texto-terciario shrink-0" />
                            {atencionSeleccionada.telefono}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setAtencionId(null); setAtencionSeleccionada(null) }}
                          className="text-xs px-2 py-0.5 rounded text-texto-terciario hover:text-texto-marca hover:bg-marca-500/10 transition-colors"
                        >
                          Cambiar
                        </button>
                        <button
                          onClick={() => router.push(`/contactos/${atencionSeleccionada.id}`)}
                          className="size-6 rounded flex items-center justify-center text-texto-terciario hover:text-texto-marca hover:bg-marca-500/10 transition-colors"
                          title="Ver ficha del contacto"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-texto-terciario mt-2">
                      Aparecerá como &quot;Atención:&quot; en el PDF del documento
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {vinculaciones.map(v => (
                      <button
                        key={v.id}
                        onClick={() => seleccionarAtencion(v)}
                        className="w-full flex items-center gap-2 px-2 py-2 text-left rounded hover:bg-superficie-app transition-colors"
                      >
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
                )}
              </div>
            )}
          </div>

          {/* ── Columna derecha: Datos del presupuesto ── */}
          <div className="py-3">
            {/* Fila TIPO + PLANTILLA */}
            <div className="grid grid-cols-2 gap-4 py-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide shrink-0">Tipo:</span>
                <span className="text-sm text-texto-primario">Presupuesto</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide shrink-0">Plantilla:</span>
                <SelectorPlantilla
                  plantillas={((config?.plantillas || []) as Array<{ id: string; nombre: string; creado_por: string; [k: string]: unknown }>)}
                  plantillaActual={plantillaId}
                  predeterminadaId={((config?.plantillas_predeterminadas || {}) as Record<string, string>)[usuario?.id || ''] || null}
                  usuarioId={usuario?.id || ''}
                  onCargar={(tpl) => {
                    setPlantillaId(tpl.id)
                    if (tpl.moneda) setMoneda(tpl.moneda)
                    if (tpl.condicion_pago_id) setCondicionPagoId(tpl.condicion_pago_id)
                    if (tpl.dias_vencimiento !== undefined) setDiasVencimiento(tpl.dias_vencimiento)
                    if (tpl.lineas) setLineas(tpl.lineas as LineaTemporal[])
                    if (tpl.notas_html) setNotasHtml(tpl.notas_html)
                    if (tpl.condiciones_html) setCondicionesHtml(tpl.condiciones_html)
                  }}
                  onGuardarComo={async (nombre) => {
                    const nuevaPlantilla = {
                      id: `tpl_${Date.now()}`,
                      nombre,
                      creado_por: usuario?.id || '',
                      moneda,
                      condicion_pago_id: condicionPagoId,
                      condicion_pago_label: condiciones.find(c => c.id === condicionPagoId)?.label,
                      condicion_pago_tipo: condiciones.find(c => c.id === condicionPagoId)?.tipo,
                      dias_vencimiento: diasVencimiento,
                      lineas: lineas.map(({ _temp, ...rest }) => rest),
                      notas_html: notasHtml,
                      condiciones_html: condicionesHtml,
                    }
                    const plantillasActuales = (config?.plantillas || []) as unknown[]
                    await fetch('/api/presupuestos/config', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plantillas: [...plantillasActuales, nuevaPlantilla] }),
                    })
                    setConfig(prev => prev ? { ...prev, plantillas: [...plantillasActuales, nuevaPlantilla] } as ConfigPresupuestos : null)
                    setPlantillaId(nuevaPlantilla.id)
                  }}
                  onGuardarCambios={async () => {
                    const plantillas = ((config?.plantillas || []) as Array<{ id: string; [k: string]: unknown }>).map(p =>
                      p.id === plantillaId ? {
                        ...p,
                        moneda,
                        condicion_pago_id: condicionPagoId,
                        dias_vencimiento: diasVencimiento,
                        lineas: lineas.map(({ _temp, ...rest }) => rest),
                        notas_html: notasHtml,
                        condiciones_html: condicionesHtml,
                      } : p
                    )
                    await fetch('/api/presupuestos/config', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plantillas }),
                    })
                    setConfig(prev => prev ? { ...prev, plantillas } as ConfigPresupuestos : null)
                  }}
                  onEliminar={async (id) => {
                    const plantillas = ((config?.plantillas || []) as Array<{ id: string }>).filter(p => p.id !== id)
                    await fetch('/api/presupuestos/config', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plantillas }),
                    })
                    setConfig(prev => prev ? { ...prev, plantillas } as ConfigPresupuestos : null)
                    if (plantillaId === id) setPlantillaId(null)
                  }}
                  onTogglePredeterminada={async (id) => {
                    const preds = (config?.plantillas_predeterminadas || {}) as Record<string, string>
                    const uid = usuario?.id || ''
                    const nuevasPreds = preds[uid] === id
                      ? Object.fromEntries(Object.entries(preds).filter(([k]) => k !== uid))
                      : { ...preds, [uid]: id }
                    await fetch('/api/presupuestos/config', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plantillas_predeterminadas: nuevasPreds }),
                    })
                    setConfig(prev => prev ? { ...prev, plantillas_predeterminadas: nuevasPreds } as ConfigPresupuestos : null)
                  }}
                  onLimpiar={() => setPlantillaId(null)}
                />
              </div>
            </div>

            {/* Bloque fechas + condición pago */}
            <div className="bg-superficie-app/30 rounded-lg px-3 py-1 -mx-3">
              {/* Fecha */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide">Fecha</span>
                <div className="w-44">
                  <SelectorFecha
                    valor={fechaEmision}
                    onChange={(v) => { if (v) { setFechaEmision(v); autoguardar({ fecha_emision: v }) } }}
                    limpiable={false}
                  />
                </div>
              </div>

              {/* Vencimiento */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide">Vencimiento</span>
                <div className="w-44">
                  <SelectorFecha
                    valor={fechaVenc.toISOString().split('T')[0]}
                    onChange={(v) => {
                      if (!v) return
                      const emision = new Date(fechaEmision + 'T00:00:00')
                      const venc = new Date(v + 'T00:00:00')
                      const diff = Math.round((venc.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24))
                      setDiasVencimiento(Math.max(0, diff))
                      autoguardar({ dias_vencimiento: Math.max(0, diff) })
                    }}
                    limpiable={false}
                  />
                </div>
              </div>

              {/* Términos de pago */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide shrink-0">Términos de pago</span>
                <div className="w-44">
                  <Select
                    valor={condicionPagoId}
                    onChange={(v) => {
                      setCondicionPagoId(v)
                      const cond = condiciones.find(c => c.id === v)
                      if (cond?.tipo === 'plazo_fijo') setDiasVencimiento(cond.diasVencimiento)
                      autoguardar({
                        condicion_pago_id: v || null,
                        condicion_pago_label: cond?.label || null,
                        condicion_pago_tipo: cond?.tipo || null,
                        ...(cond?.tipo === 'plazo_fijo' ? { dias_vencimiento: cond.diasVencimiento } : {}),
                      })
                    }}
                    opciones={[
                      { valor: '', etiqueta: 'Sin condición' },
                      ...condiciones.map(c => ({ valor: c.id, etiqueta: c.label })),
                    ]}
                    variante="plano"
                  />
                </div>
              </div>
            </div>

            {/* Desglose cuotas (hitos) */}
            {condSeleccionada?.tipo === 'hitos' && condSeleccionada.hitos.length > 0 && (
              <div className="bg-superficie-app/30 rounded-lg px-3 py-2 -mx-3 mt-1 space-y-1.5">
                {condSeleccionada.hitos.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-texto-secundario">{h.descripcion}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-texto-terciario">{h.porcentaje}%</span>
                      <span className="text-texto-primario font-mono tabular-nums">{fmt(totales.total * h.porcentaje / 100)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bloque referencia + moneda */}
            <div className="bg-superficie-app/30 rounded-lg px-3 py-1 -mx-3 mt-3">
              {/* Referencia */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide">Referencia</span>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  onBlur={() => autoguardar({ referencia })}
                  placeholder="Orden de compra, PO..."
                  className="w-44 bg-transparent border-b border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 transition-colors py-0.5 text-right"
                />
              </div>

              {/* Moneda */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide">Moneda</span>
                <div className="w-44">
                  <Select
                    valor={moneda}
                    onChange={(v) => { setMoneda(v); autoguardar({ moneda: v }) }}
                    opciones={monedas.filter(m => m.activo).map(m => ({
                      valor: m.id,
                      etiqueta: `${m.simbolo} ${m.label}`,
                    }))}
                    variante="plano"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TABLA DE LÍNEAS (full width) ─── */}
        <div className="px-6 py-4">
          <TablaLineas
            lineas={lineas as unknown as LineaPresupuesto[]}
            columnasVisibles={columnasVisibles}
            impuestos={impuestosList}
            unidades={unidadesList}
            moneda={moneda}
            simboloMoneda={simbolo}
            onAgregarLinea={agregarLinea}
            onEditarLinea={editarLinea}
            onEliminarLinea={eliminarLinea}
            onReordenar={reordenarLineas}
            onCambiarColumnas={(cols) => { setColumnasVisibles(cols); autoguardar({ columnas_lineas: cols }) }}
          />
        </div>

        {/* ─── TOTALES ─── */}
        <div className="px-6 py-4 border-t border-borde-sutil">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-texto-secundario">Subtotal</span>
                <span className="font-mono text-texto-primario">{fmt(totales.subtotal)}</span>
              </div>
              {totales.impuestos !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-texto-secundario">Impuestos</span>
                  <span className="font-mono text-texto-primario">{fmt(totales.impuestos)}</span>
                </div>
              )}
              <div className="border-t border-borde-sutil pt-2 flex justify-between text-base font-bold">
                <span className="text-texto-primario">Total</span>
                <span className="font-mono text-texto-marca">{fmt(totales.total)}</span>
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
            etiqueta="Condiciones / Términos"
          />
        </div>
      </div>
    </div>
  )
}

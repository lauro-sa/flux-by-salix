'use client'

/**
 * EditorPresupuesto — Componente unificado para crear y editar presupuestos.
 * Reemplaza la lógica duplicada de nuevo/page.tsx y [id]/page.tsx.
 * Se usa en: presupuestos/nuevo/page.tsx, presupuestos/[id]/page.tsx
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Cloud, X, Mail, Phone, ExternalLink,
  Send, Printer, FileCheck, Eye, Receipt, Ban, RotateCcw,
  Lock, Info, RefreshCw, History, Loader2, CheckCircle2, FileText,
} from 'lucide-react'
import { TablaLineas } from './TablaLineas'
import EditorNotasPresupuesto from './EditorNotasPresupuesto'
import SelectorContactoPresupuesto from './SelectorContactoPresupuesto'
import SelectorPlantilla from './SelectorPlantilla'
import BarraEstadoPresupuesto from './BarraEstadoPresupuesto'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import type {
  PresupuestoConLineas, LineaPresupuesto, TipoLinea,
  Impuesto, UnidadMedida, CondicionPago, ConfigPresupuestos,
  EstadoPresupuesto,
} from '@/tipos/presupuesto'
import { ETIQUETAS_ESTADO, TRANSICIONES_ESTADO } from '@/tipos/presupuesto'
import type {
  ContactoResumido, Vinculacion, DatosEmpresa, LineaTemporal,
} from './tipos-editor'
import { SIMBOLO_MONEDA } from './tipos-editor'

// ─── Props del componente ───────────────────────────────────────────────────

interface PropsEditorPresupuesto {
  modo: 'crear' | 'editar'
  /** Requerido si modo === 'editar' */
  presupuestoId?: string
  /** Callback cuando se crea el presupuesto (modo crear) */
  onCreado?: (id: string, numero: string) => void
  /** Callback cuando se descarta/elimina */
  onDescartado?: () => void
  /** Callback cuando se carga el título (número del presupuesto) */
  onTituloCargado?: (titulo: string) => void
}

export default function EditorPresupuesto({
  modo,
  presupuestoId: presupuestoIdProp,
  onCreado,
  onDescartado,
  onTituloCargado,
}: PropsEditorPresupuesto) {
  const router = useRouter()
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const { usuario } = useAuth()

  // ─── Estado compartido ──────────────────────────────────────────────────

  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(modo === 'editar')
  const [config, setConfig] = useState<ConfigPresupuestos | null>(null)
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresa | null>(null)

  // Presupuesto cargado (solo modo editar)
  const [presupuesto, setPresupuesto] = useState<PresupuestoConLineas | null>(null)

  // Estado post-creación (solo modo crear): la página se transforma en editor sin navegar
  const [presupuestoIdCreado, setPresupuestoIdCreado] = useState<string | null>(null)
  const [numeroPresupuesto, setNumeroPresupuesto] = useState<string | null>(null)

  // Plantilla (solo modo crear)
  const [plantillaId, setPlantillaId] = useState<string | null>(null)

  // ID efectivo del presupuesto (creado o prop)
  const idPresupuesto = modo === 'editar' ? presupuestoIdProp! : presupuestoIdCreado

  // Contacto (modo crear)
  const [contactoId, setContactoId] = useState<string | null>(null)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<ContactoResumido | null>(null)

  // Dirigido a (vinculación)
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([])
  const [atencionId, setAtencionId] = useState<string | null>(null)
  const [atencionSeleccionada, setAtencionSeleccionada] = useState<Vinculacion['vinculado'] | null>(null)

  // Campos editables
  const [moneda, setMoneda] = useState('ARS')
  const [condicionPagoId, setCondicionPagoId] = useState('')
  const [diasVencimiento, setDiasVencimiento] = useState(30)
  const [referencia, setReferencia] = useState('')
  const [notasHtml, setNotasHtml] = useState('')
  const [condicionesHtml, setCondicionesHtml] = useState('')
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().split('T')[0])

  // Líneas
  const [lineas, setLineas] = useState<(LineaPresupuesto | LineaTemporal)[]>([])
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([
    'producto', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento', 'impuesto', 'subtotal',
  ])

  // Snapshot del último estado guardado — para dirty tracking
  const guardadoRef = useRef<Record<string, unknown>>({})

  // ─── MODO CREAR: Cargar config al montar ────────────────────────────────

  useEffect(() => {
    if (modo !== 'crear') return
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => {
        setConfig(data)
        if (data.moneda_predeterminada) setMoneda(data.moneda_predeterminada)
        if (data.notas_predeterminadas) setNotasHtml(data.notas_predeterminadas)
        if (data.condiciones_predeterminadas) setCondicionesHtml(data.condiciones_predeterminadas)
        if (data.columnas_lineas_default) setColumnasVisibles(data.columnas_lineas_default as string[])
        if (data.dias_vencimiento_predeterminado != null) setDiasVencimiento(data.dias_vencimiento_predeterminado)
        const condiciones = (data.condiciones_pago || []) as CondicionPago[]
        const defecto = condiciones.find(c => c.predeterminado)
        if (defecto) setCondicionPagoId(defecto.id)
      })
      .catch(() => {})
  }, [modo])

  // MODO CREAR: Aplicar plantilla predeterminada del usuario
  const plantillaAplicadaRef = useRef(false)
  useEffect(() => {
    if (modo !== 'crear' || !config || !usuario?.id || plantillaAplicadaRef.current) return
    const preds = (config.plantillas_predeterminadas || {}) as Record<string, string>
    const tplId = preds[usuario.id]
    if (!tplId) return
    const plantillas = (config.plantillas || []) as Array<{ id: string; [k: string]: unknown }>
    const tpl = plantillas.find(p => p.id === tplId)
    if (!tpl) return

    plantillaAplicadaRef.current = true
    setPlantillaId(tpl.id)
    if (tpl.moneda) setMoneda(tpl.moneda as string)
    if (tpl.condicion_pago_id) setCondicionPagoId(tpl.condicion_pago_id as string)
    if (tpl.dias_vencimiento != null) setDiasVencimiento(tpl.dias_vencimiento as number)
    if (tpl.lineas) setLineas(tpl.lineas as LineaTemporal[])
    if (tpl.notas_html) setNotasHtml(tpl.notas_html as string)
    if (tpl.condiciones_html) setCondicionesHtml(tpl.condiciones_html as string)
  }, [modo, config, usuario?.id])

  // MODO CREAR: Cargar datos de la empresa emisora
  useEffect(() => {
    if (modo !== 'crear' || !empresa?.id) return
    fetch('/api/empresas/actualizar')
      .then(r => r.json())
      .then(data => { if (data.empresa) setDatosEmpresa(data.empresa) })
      .catch(() => {})
  }, [modo, empresa?.id])

  // ─── MODO EDITAR: Cargar presupuesto + config + empresa en paralelo ─────

  useEffect(() => {
    if (modo !== 'editar' || !presupuestoIdProp) return
    Promise.all([
      fetch(`/api/presupuestos/${presupuestoIdProp}`).then(r => r.json()),
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
      if (pres.fecha_emision) setFechaEmision(pres.fecha_emision.split('T')[0])
      setCargando(false)

      // Inicializar snapshot para dirty tracking
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

      // Notificar título
      onTituloCargado?.(pres.numero || 'Detalle')

      // Cargar vinculaciones del contacto
      if (pres.contacto_id) {
        fetch(`/api/contactos/${pres.contacto_id}`)
          .then(r => r.json())
          .then(data => setVinculaciones(data.vinculaciones || []))
          .catch(() => {})
      }
    }).catch(() => setCargando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, presupuestoIdProp])

  // ─── Refs para valores actuales (evita recrear callbacks) ───────────────

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
  const presupuestoIdRef = useRef(idPresupuesto)
  presupuestoIdRef.current = idPresupuesto

  // ─── MODO CREAR: Crear presupuesto ──────────────────────────────────────

  const creandoRef = useRef(false)

  const crearPresupuesto = useCallback(async () => {
    const cId = contactoIdRef.current
    if (!cId || creandoRef.current) return
    creandoRef.current = true

    // Generar número optimista al instante
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
        const presupuestoCreado = await res.json()
        setPresupuestoIdCreado(presupuestoCreado.id)
        // Corregir número si el servidor dio uno distinto
        if (presupuestoCreado.numero !== numeroOptimista) {
          setNumeroPresupuesto(presupuestoCreado.numero)
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
        // Notificar al padre y cambiar URL sin navegar
        onCreado?.(presupuestoCreado.id, presupuestoCreado.numero)
        window.history.replaceState(null, '', `/presupuestos/${presupuestoCreado.id}`)
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
  }, [onCreado])

  // ─── Autoguardado con dirty tracking ────────────────────────────────────

  // Set de promesas pendientes para esperar antes de generar PDF
  const promesasPendientesRef = useRef<Set<Promise<void>>>(new Set())
  const registrarPromesa = useCallback((p: Promise<void>) => {
    promesasPendientesRef.current.add(p)
    p.finally(() => promesasPendientesRef.current.delete(p))
  }, [])
  const esperarGuardados = useCallback(() => {
    return Promise.all(Array.from(promesasPendientesRef.current))
  }, [])

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
    const promesa = fetch(`/api/presupuestos/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    })
      .then(async (res) => {
        if (modo === 'editar' && res.ok) {
          const data = await res.json()
          setPresupuesto(prev => prev ? { ...prev, ...data } : null)
        }
      })
      .catch(() => {})
      .finally(() => setGuardando(false))
    registrarPromesa(promesa)
  }, [modo])

  // ─── Cambiar estado (solo modo editar) ──────────────────────────────────

  const cambiarEstado = async (nuevoEstado: EstadoPresupuesto) => {
    if (!idPresupuesto) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
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

  // ─── Descartar/eliminar presupuesto ─────────────────────────────────────

  const descartarPresupuesto = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (pid) {
      try {
        const res = await fetch(`/api/presupuestos/${pid}`, { method: 'DELETE' })
        const data = await res.json()

        // En modo editar, si no se pudo eliminar se cancela
        if (modo === 'editar' && data.accion === 'cancelado') {
          setPresupuesto(prev => prev ? { ...prev, estado: 'cancelado' } : null)
          return
        }
      } catch { /* silenciar */ }
    }
    onDescartado?.()
    router.push('/presupuestos')
  }, [modo, router, onDescartado])

  // ─── Contacto: seleccionar y limpiar (modo crear) ──────────────────────

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
    crearPresupuesto()
  }, [crearPresupuesto])

  const limpiarContacto = useCallback(() => {
    setContactoId(null)
    setContactoSeleccionado(null)
    setVinculaciones([])
    setAtencionId(null)
    setAtencionSeleccionada(null)
  }, [])

  // Seleccionar "Dirigido a" (modo crear)
  const seleccionarAtencion = useCallback((vinc: Vinculacion) => {
    setAtencionId(vinc.vinculado.id)
    setAtencionSeleccionada(vinc.vinculado)
  }, [])

  // ─── CRUD de líneas ────────────────────────────────────────────────────

  const agregarLinea = useCallback(async (tipo: TipoLinea) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const impDefault = impuestos.find(i => i.activo && i.porcentaje > 0)
    const pid = presupuestoIdRef.current

    if (pid) {
      // Presupuesto ya creado — persistir directamente
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
          setLineas(prev => [...prev, ...(Array.isArray(nuevas) ? nuevas : [nuevas])])
          if (modo === 'editar') recargarTotales()
        }
      } catch { /* silenciar */ }
    } else {
      // Aún no se creó — línea temporal en memoria (solo modo crear)
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
  }, [lineas.length, config, modo])

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

      // Persistir la línea actualizada
      const pid = presupuestoIdRef.current
      if (pid) {
        const lineaActualizada = nuevas.find(l => l.id === lineaId)
        if (lineaActualizada) {
          const p = fetch(`/api/presupuestos/${pid}/lineas`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...lineaActualizada, id: lineaId }),
          }).then(() => { if (modo === 'editar') recargarTotales() }).catch(() => {})
          registrarPromesa(p)
        }
      }

      return nuevas
    })
  }, [modo])

  const eliminarLinea = useCallback(async (lineaId: string) => {
    setLineas(prev => prev.filter(l => l.id !== lineaId))
    const pid = presupuestoIdRef.current
    if (pid) {
      await fetch(`/api/presupuestos/${pid}/lineas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea_id: lineaId }),
      })
      if (modo === 'editar') recargarTotales()
    }
  }, [modo])

  const reordenarLineas = useCallback(async (nuevosIds: string[]) => {
    setLineas(prev => {
      const mapa = new Map(prev.map(l => [l.id, l]))
      return nuevosIds.map((lid, idx) => ({ ...mapa.get(lid)!, orden: idx }))
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

  // Recargar totales desde el servidor (solo modo editar)
  const recargarTotales = useCallback(async () => {
    if (!presupuestoIdRef.current) return
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoIdRef.current}`)
      const data = await res.json()
      setPresupuesto(prev => prev ? {
        ...prev,
        subtotal_neto: data.subtotal_neto,
        total_impuestos: data.total_impuestos,
        total_final: data.total_final,
        descuento_global_monto: data.descuento_global_monto,
      } : null)
    } catch { /* silenciar */ }
  }, [])

  // ─── Guardar todo el estado actual (para PDF y acciones críticas) ────────

  const guardarTodo = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (!pid) return
    // Esperar guardados en curso
    await esperarGuardados()
    // Solo guardar campos que realmente cambiaron vs último guardado
    const camposActuales: Record<string, unknown> = {
      notas_html: notasHtml,
      condiciones_html: condicionesHtml,
      referencia,
      moneda,
      condicion_pago_id: condicionPagoId,
      dias_vencimiento: diasVencimiento,
      fecha_emision: fechaEmision,
      columnas_lineas: columnasVisibles,
    }
    const cambios: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(camposActuales)) {
      if (JSON.stringify(valor) !== JSON.stringify(guardadoRef.current[clave])) {
        cambios[clave] = valor
      }
    }
    if (Object.keys(cambios).length === 0) return // Sin cambios reales
    Object.assign(guardadoRef.current, cambios)
    await fetch(`/api/presupuestos/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    }).catch(() => {})
  }, [esperarGuardados, notasHtml, condicionesHtml, referencia, moneda, condicionPagoId, diasVencimiento, fechaEmision, columnasVisibles])

  // ─── Acciones de estado (modo editar) ───────────────────────────────────

  const handleEnviar = async () => {
    if (idPresupuesto) {
      // Guardar todo antes de enviar
      await guardarTodo()
    }
    await cambiarEstado('enviado')
    if (idPresupuesto) {
      // Generar PDF + token del portal en paralelo (fire-and-forget)
      Promise.all([
        fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forzar: false }),
        }),
        fetch(`/api/presupuestos/${idPresupuesto}/portal`, { method: 'POST' }),
      ]).catch(() => {})
    }
  }
  const handleEnviarProforma = () => { /* pendiente: integrar proforma */ }
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const handleImprimir = async () => {
    if (!idPresupuesto || generandoPdf) return
    setGenerandoPdf(true)
    try {
      // Guardar TODO el estado actual antes de generar PDF
      await guardarTodo()
      // forzar: false → si no hubo cambios desde la última generación, devuelve el existente
      const res = await fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vista_previa: true, forzar: false }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al generar el PDF')
        return
      }
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } catch {
      alert('Error al generar el PDF')
    } finally {
      setGenerandoPdf(false)
    }
  }
  const handleVistaPrevia = async () => {
    const pid = idPresupuesto
    if (!pid) return
    try {
      const res = await fetch(`/api/presupuestos/${pid}/portal`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {})
        window.open(data.url, '_blank')
      }
    } catch { /* silenciar */ }
  }

  // ─── Cálculos derivados ─────────────────────────────────────────────────

  // Totales: en modo editar vienen del servidor, en modo crear se calculan localmente
  const totales = (() => {
    if (modo === 'editar' && presupuesto) {
      return {
        subtotal: parseFloat(presupuesto.subtotal_neto || '0'),
        impuestos: parseFloat(presupuesto.total_impuestos || '0'),
        total: parseFloat(presupuesto.total_final || '0'),
      }
    }
    // Modo crear: cálculo local
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
  const fmt = (v: string | number) => {
    const num = typeof v === 'number' ? v : parseFloat(v || '0')
    return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const condiciones = (config?.condiciones_pago || []) as CondicionPago[]
  const monedas = (config?.monedas || []) as { id: string; label: string; simbolo: string; activo: boolean }[]
  const impuestosList = (config?.impuestos || []) as Impuesto[]
  const unidadesList = (config?.unidades || []) as UnidadMedida[]
  const condSeleccionada = condiciones.find(c => c.id === condicionPagoId)

  // Modo editar: estado actual y transiciones
  const estadoActual = (presupuesto?.estado || 'borrador') as EstadoPresupuesto
  const esEditable = modo === 'crear' || estadoActual === 'borrador'
  const estadosPosibles = modo === 'editar' ? (TRANSICIONES_ESTADO[estadoActual] || []) : []
  const estaCancelado = modo === 'editar' && estadoActual === 'cancelado'

  // Datos fiscales emisor
  const datosFiscales = (datosEmpresa?.datos_fiscales || {}) as Record<string, string>

  // Fecha de vencimiento de la oferta — siempre calculada desde emisión + días
  const fechaVenc = (() => {
    const f = new Date(fechaEmision)
    f.setDate(f.getDate() + diasVencimiento)
    return f
  })()

  const formatearFecha = (d: Date | string) => {
    const fecha = typeof d === 'string' ? new Date(d) : d
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Validez bloqueada
  const bloqueada = !!(config as Record<string, unknown> | null)?.validez_bloqueada

  // ─── Loading state (solo modo editar) ───────────────────────────────────

  if (cargando || (modo === 'editar' && (!presupuesto || !config))) {
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

  // ─── Título ─────────────────────────────────────────────────────────────

  const titulo = modo === 'editar'
    ? presupuesto!.numero
    : (numeroPresupuesto || 'Nuevo')

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-6 space-y-5">
      {/* ─── Contenedor principal ─── */}
      <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">

        {/* ─── Cabecera ─── */}
        <div className="px-6 pt-5 pb-4 border-b border-borde-sutil">
          {/* Fila 1: Título */}
          <h1 className={`text-2xl sm:text-3xl font-semibold mb-2 ${
            modo === 'editar' ? 'text-texto-secundario' : 'text-texto-primario'
          }`}>
            {titulo}
          </h1>

          {/* Fila 2: Iconos izquierda + Barra de estados derecha */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {/* Nubecita */}
              <button
                onClick={modo === 'crear' && !idPresupuesto ? crearPresupuesto : () => autoguardar({})}
                disabled={modo === 'crear' && (!contactoId || guardando)}
                className={`size-7 rounded-full flex items-center justify-center transition-all ${
                  guardando
                    ? 'text-texto-marca animate-pulse'
                    : modo === 'crear' && !idPresupuesto
                      ? contactoId
                        ? 'text-texto-terciario hover:text-texto-marca hover:bg-superficie-app cursor-pointer'
                        : 'text-texto-terciario/30 cursor-not-allowed'
                      : 'text-texto-terciario hover:bg-superficie-app'
                }`}
                title={guardando ? 'Guardando...' : idPresupuesto ? 'Guardado' : modo === 'crear' && contactoId ? 'Guardar presupuesto' : 'Selecciona un cliente primero'}
              >
                <Cloud size={16} />
              </button>
              {/* X: descartar/eliminar */}
              <button
                onClick={descartarPresupuesto}
                className={`size-7 rounded-full flex items-center justify-center transition-colors ${
                  idPresupuesto
                    ? 'text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10'
                    : 'text-texto-terciario hover:bg-superficie-app'
                }`}
                title={idPresupuesto ? 'Eliminar presupuesto' : 'Descartar'}
              >
                <X size={16} />
              </button>
              {/* Info y RefreshCw en modo editar o post-creación */}
              {(modo === 'editar' || presupuestoIdCreado) && (
                <>
                  <button
                    className="size-7 rounded-full flex items-center justify-center text-texto-terciario hover:bg-superficie-app transition-colors"
                    title="Informacion del documento"
                  >
                    <Info size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!idPresupuesto || generandoPdf) return
                      setGenerandoPdf(true)
                      try {
                        // Guardar TODO el estado actual antes de regenerar
                        await guardarTodo()
                        const res = await fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ forzar: true }),
                        })
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}))
                          alert(err.error || 'Error al regenerar el PDF')
                        }
                      } catch {
                        alert('Error al regenerar el PDF')
                      } finally {
                        setGenerandoPdf(false)
                      }
                    }}
                    disabled={generandoPdf}
                    className={`size-7 rounded-full flex items-center justify-center text-texto-terciario hover:bg-superficie-app transition-colors ${generandoPdf ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title="Regenerar PDF"
                  >
                    <RefreshCw size={16} className={generandoPdf ? 'animate-spin' : ''} />
                  </button>
                </>
              )}
            </div>
            <div className="ml-auto">
              <BarraEstadoPresupuesto estadoActual={estadoActual} />
            </div>
          </div>

          {/* Fila 3: Botones de acción (modo editar o post-creación) */}
          {(modo === 'editar' || presupuestoIdCreado) && (
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                // Botón base reutilizable
                const BotonAccion = ({ onClick, icono: Icono, label, variante = 'default', disabled = false, animarIcono = false }: {
                  onClick: () => void; icono: typeof Send; label: string; variante?: string; disabled?: boolean; animarIcono?: boolean
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
                    <Icono size={15} className={animarIcono ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )

                const esEnviado = estadoActual === 'enviado'

                if (estaCancelado) {
                  return (
                    <BotonAccion onClick={() => cambiarEstado('borrador')} icono={RotateCcw} label={t('documentos.restablecer_borrador')} />
                  )
                }

                const siguienteEstado = estadosPosibles.find(e => e !== 'cancelado' && e !== 'borrador')

                return (
                  <>
                    {esEnviado ? (
                      <>
                        {siguienteEstado && <BotonAccion onClick={() => cambiarEstado(siguienteEstado)} icono={FileCheck} label={t('comun.confirmar')} variante="primario" />}
                        <BotonAccion onClick={handleImprimir} icono={generandoPdf ? Loader2 : Printer} label={generandoPdf ? 'Generando...' : t('documentos.imprimir')} disabled={generandoPdf} animarIcono={generandoPdf} />
                        <BotonAccion onClick={handleEnviarProforma} icono={Receipt} label="Enviar Factura Proforma" />
                        <BotonAccion onClick={handleEnviar} icono={Send} label={t('documentos.enviar')} />
                        <BotonAccion onClick={handleVistaPrevia} icono={Eye} label={t('documentos.vista_previa')} />
                        <BotonAccion onClick={() => cambiarEstado('cancelado')} icono={Ban} label={t('comun.cancelar')} variante="peligro" />
                      </>
                    ) : (
                      <>
                        <BotonAccion onClick={handleEnviar} icono={Send} label={t('documentos.enviar')} />
                        <BotonAccion onClick={handleEnviarProforma} icono={Receipt} label="Enviar Factura Proforma" />
                        <BotonAccion onClick={handleImprimir} icono={generandoPdf ? Loader2 : Printer} label={generandoPdf ? 'Generando...' : t('documentos.imprimir')} disabled={generandoPdf} animarIcono={generandoPdf} />
                        {siguienteEstado && <BotonAccion onClick={() => cambiarEstado(siguienteEstado)} icono={FileCheck} label={t('comun.confirmar')} variante="primario" />}
                        <BotonAccion onClick={handleVistaPrevia} icono={Eye} label={t('documentos.vista_previa')} />
                        {!estaCancelado && estadosPosibles.includes('cancelado') && (
                          <BotonAccion onClick={() => cambiarEstado('cancelado')} icono={Ban} label={t('comun.cancelar')} variante="peligro" />
                        )}
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Indicación modo crear sin contacto */}
          {modo === 'crear' && !contactoId && !idPresupuesto && (
            <p className="text-sm text-texto-terciario">
              Selecciona un cliente para crear el presupuesto
            </p>
          )}
        </div>

        {/* ─── Banner de bloqueo (solo modo editar, si no es editable) ─── */}
        {modo === 'editar' && !esEditable && (
          <div className="px-6 py-3 bg-insignia-advertencia/10 border-b border-insignia-advertencia/20 flex items-center gap-2">
            <Lock size={14} className="text-insignia-advertencia" />
            <span className="text-sm text-texto-secundario">
              Este documento esta en estado <strong>{ETIQUETAS_ESTADO[estadoActual]}</strong> y no se puede editar.
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
        <div className="px-6 py-3">
          <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">Emisor</span>
          <div className="mt-2 space-y-1">
            <p className="text-base font-semibold text-texto-primario">
              {datosEmpresa?.nombre || empresa?.nombre || '—'}
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
                    {datosEmpresa.telefono}
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

        {/* ─── CLIENTE + DATOS DEL PRESUPUESTO (grid plano) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 px-6 pb-3 border-b border-borde-sutil">

          {/* ── Columna izquierda: Cliente + Dirigido a ── */}
          <div className="space-y-3 py-3">
            {/* CLIENTE */}
            <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg px-3 py-3 -mx-3">
              <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
                {t('documentos.cliente')}
              </span>
              <div className="mt-1.5">
                {modo === 'crear' ? (
                  /* Modo crear: usa SelectorContactoPresupuesto con onChange que pre-crea */
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
                      await seleccionarContacto(padre)
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
                ) : (
                  /* Modo editar: usa SelectorContactoPresupuesto con datos del presupuesto */
                  <SelectorContactoPresupuesto
                    contacto={presupuesto?.contacto_nombre ? {
                      id: presupuesto.contacto_id || '',
                      nombre: presupuesto.contacto_nombre,
                      apellido: presupuesto.contacto_apellido || null,
                      correo: presupuesto.contacto_correo || null,
                      telefono: presupuesto.contacto_telefono || null,
                      tipo_contacto: presupuesto.contacto_tipo ? { clave: presupuesto.contacto_tipo, etiqueta: presupuesto.contacto_tipo } : null,
                      numero_identificacion: presupuesto.contacto_identificacion || null,
                      condicion_iva: presupuesto.contacto_condicion_iva || null,
                      direccion: presupuesto.contacto_direccion || null,
                    } : null}
                    onChange={async (c) => {
                      if (c) {
                        // Cambiar contacto en el presupuesto existente
                        const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
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
                      }
                    }}
                    soloLectura={!esEditable}
                  />
                )}
              </div>
            </div>

            {/* DIRIGIDO A */}
            {modo === 'crear' && contactoSeleccionado && vinculaciones.length > 0 && (
              <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg px-3 py-3 -mx-3">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
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
                    <p className="text-xxs text-texto-terciario mt-2">
                      Aparecera como &quot;Atencion:&quot; en el PDF del documento
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

            {/* DIRIGIDO A — modo editar */}
            {modo === 'editar' && presupuesto?.atencion_nombre && (
              <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg px-3 py-3 -mx-3">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
                  Dirigido a
                </span>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm font-semibold text-texto-primario">{presupuesto.atencion_nombre}</p>
                  {presupuesto.atencion_correo && (
                    <p className="text-xs text-texto-secundario flex items-center gap-1"><Mail size={12} /> {presupuesto.atencion_correo}</p>
                  )}
                  {presupuesto.atencion_cargo && (
                    <p className="text-xs text-texto-terciario">{presupuesto.atencion_cargo}</p>
                  )}
                  <p className="text-xxs text-texto-terciario mt-1">Aparecera como &quot;Atencion:&quot; en el PDF del documento</p>
                </div>
              </div>
            )}

            {/* DIRIGIDO A — modo editar, vinculaciones disponibles, sin selección previa */}
            {modo === 'editar' && !presupuesto?.atencion_nombre && vinculaciones.length > 0 && esEditable && (
              <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg px-3 py-3 -mx-3">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
                  Dirigido a
                </span>
                <p className="text-xxs text-texto-terciario mt-0.5 mb-2">Aparecera como &quot;Atencion:&quot; en el PDF del documento</p>
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
            )}
          </div>

          {/* ── Columna derecha: Datos del presupuesto ── */}
          <div className="py-3">
            {/* Fila TIPO + PLANTILLA (solo modo crear) */}
            <div className={`grid gap-4 py-2 mb-2 ${modo === 'crear' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-texto-secundario uppercase tracking-wide shrink-0">Tipo:</span>
                <span className="text-sm text-texto-primario">{t('documentos.tipos.presupuesto')}</span>
              </div>
              {modo === 'crear' && (
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
                        lineas: lineas.map(l => {
                          const { ...rest } = l as LineaTemporal
                          const { _temp, ...sinTemp } = rest
                          return sinTemp
                        }),
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
                          lineas: lineas.map(l => {
                            const { ...rest } = l as LineaTemporal
                            const { _temp, ...sinTemp } = rest
                            return sinTemp
                          }),
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
                    onEliminar={async (tplId) => {
                      const plantillas = ((config?.plantillas || []) as Array<{ id: string }>).filter(p => p.id !== tplId)
                      await fetch('/api/presupuestos/config', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plantillas }),
                      })
                      setConfig(prev => prev ? { ...prev, plantillas } as ConfigPresupuestos : null)
                      if (plantillaId === tplId) setPlantillaId(null)
                    }}
                    onTogglePredeterminada={async (tplId) => {
                      const preds = (config?.plantillas_predeterminadas || {}) as Record<string, string>
                      const uid = usuario?.id || ''
                      const nuevasPreds = preds[uid] === tplId
                        ? Object.fromEntries(Object.entries(preds).filter(([k]) => k !== uid))
                        : { ...preds, [uid]: tplId }
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
              )}
            </div>

            {/* Datos del presupuesto — agrupados con divide-y */}
            {(() => {
              const fila = "flex items-center justify-between py-2.5"
              const etiqueta = "text-xs font-medium text-texto-secundario uppercase tracking-wide"
              const valorAncho = "w-52"
              return (
                <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg -mx-3 divide-y divide-borde-sutil/50">
                  {/* ── Referencia ── */}
                  <div className="px-3 py-1">
                    <div className={fila}>
                      <span className={etiqueta}>Referencia</span>
                      {esEditable ? (
                        <input
                          type="text"
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          onBlur={() => autoguardar({ referencia })}
                          placeholder="PO, orden de compra..."
                          className={`${valorAncho} bg-transparent border-b border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 transition-colors py-0.5 text-right`}
                        />
                      ) : (
                        <span className="text-sm text-texto-primario">{referencia || '—'}</span>
                      )}
                    </div>
                  </div>

                  {/* ── Fechas ── */}
                  <div className="px-3 py-1">
                    <div className={fila}>
                      <span className={etiqueta}>Emision</span>
                      <div className={valorAncho}>
                        {esEditable ? (
                          <SelectorFecha
                            valor={modo === 'editar' ? (presupuesto?.fecha_emision?.split('T')[0] || '') : fechaEmision}
                            onChange={(v) => {
                              if (!v) return
                              if (modo === 'crear') setFechaEmision(v)
                              autoguardar({ fecha_emision: v })
                            }}
                            limpiable={false}
                          />
                        ) : (
                          <span className="text-sm text-texto-primario">
                            {presupuesto?.fecha_emision ? formatearFecha(presupuesto.fecha_emision) : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={fila}>
                      <span className={etiqueta}>Validez</span>
                      <div className="flex items-center gap-3">
                        {esEditable && !bloqueada && (
                          <input
                            type="number"
                            min={1}
                            value={diasVencimiento}
                            onChange={(e) => setDiasVencimiento(Math.max(1, parseInt(e.target.value) || 1))}
                            onBlur={() => autoguardar({ dias_vencimiento: diasVencimiento })}
                            onFocus={(e) => e.target.select()}
                            className="w-14 bg-superficie-tarjeta border border-borde-fuerte rounded-md px-1 py-2 text-sm font-mono text-texto-primario text-center outline-none focus:border-borde-foco focus:shadow-foco transition-all"
                            title="Dias de validez"
                          />
                        )}
                        <div className={valorAncho}>
                          {esEditable ? (
                            <SelectorFecha
                              valor={fechaVenc.toISOString().split('T')[0]}
                              onChange={(v) => {
                                if (!v || bloqueada) return
                                const emision = new Date(fechaEmision + 'T00:00:00')
                                const venc = new Date(v + 'T00:00:00')
                                const diff = Math.round((venc.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24))
                                setDiasVencimiento(Math.max(1, diff))
                                autoguardar({ dias_vencimiento: Math.max(1, diff) })
                              }}
                              limpiable={false}
                              disabled={bloqueada}
                            />
                          ) : (
                            <span className={`text-sm ${presupuesto?.fecha_vencimiento && new Date(presupuesto.fecha_vencimiento) < new Date() ? 'text-estado-error font-medium' : 'text-texto-primario'}`}>
                              {presupuesto?.fecha_vencimiento ? formatearFecha(presupuesto.fecha_vencimiento) : '—'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Condiciones de pago + Moneda ── */}
                  <div className="px-3 py-1">
                    <div className={fila}>
                      <span className={etiqueta}>{t('documentos.condiciones_pago')}</span>
                      <div className={valorAncho}>
                        {esEditable ? (
                          <Select
                            valor={condicionPagoId}
                            onChange={(v) => {
                              setCondicionPagoId(v)
                              const cond = condiciones.find(c => c.id === v)
                              autoguardar({
                                condicion_pago_id: v || null,
                                condicion_pago_label: cond?.label || null,
                                condicion_pago_tipo: cond?.tipo || null,
                              })
                            }}
                            opciones={[
                              { valor: '', etiqueta: 'Sin condicion' },
                              ...condiciones.map(c => ({ valor: c.id, etiqueta: c.label })),
                            ]}
                            variante="plano"
                          />
                        ) : (
                          <span className="text-sm text-texto-primario">
                            {presupuesto?.condicion_pago_label || 'Sin condicion'}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Desglose cuotas (hitos) inline */}
                    {condSeleccionada?.tipo === 'hitos' && condSeleccionada.hitos.length > 0 && (
                      <div className="pb-2 space-y-1">
                        {condSeleccionada.hitos.map(h => (
                          <div key={h.id} className="flex items-center justify-between text-xs pl-1">
                            <span className="text-texto-terciario">{h.descripcion}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-texto-terciario">{h.porcentaje}%</span>
                              <span className="text-texto-primario font-mono tabular-nums">{fmt(totales.total * h.porcentaje / 100)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={fila}>
                      <span className={etiqueta}>{t('documentos.moneda')}</span>
                      <div className={valorAncho}>
                        {esEditable ? (
                          <Select
                            valor={moneda}
                            onChange={(v) => { setMoneda(v); autoguardar({ moneda: v }) }}
                            opciones={monedas.filter(m => m.activo).map(m => ({
                              valor: m.id,
                              etiqueta: `${m.simbolo} ${m.label}`,
                            }))}
                            variante="plano"
                          />
                        ) : (
                          <span className="text-sm text-texto-primario">
                            {simbolo} {monedas.find(m => m.id === (presupuesto?.moneda || moneda))?.label || moneda}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ─── TABLA DE LINEAS ─── */}
        <div className="px-6 py-4">
          <TablaLineas
            lineas={lineas as unknown as LineaPresupuesto[]}
            columnasVisibles={columnasVisibles}
            impuestos={impuestosList}
            unidades={unidadesList}
            moneda={moneda}
            simboloMoneda={simbolo}
            soloLectura={!esEditable}
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
                <span className="text-texto-secundario">{t('documentos.subtotal')}</span>
                <span className="font-mono text-texto-primario">{fmt(totales.subtotal)}</span>
              </div>
              {totales.impuestos !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-texto-secundario">{t('documentos.impuesto')}</span>
                  <span className="font-mono text-texto-primario">{fmt(totales.impuestos)}</span>
                </div>
              )}
              <div className="border-t border-borde-sutil pt-2 flex justify-between text-base font-bold">
                <span className="text-texto-primario">{t('documentos.total')}</span>
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
            soloLectura={!esEditable}
            etiqueta={t('documentos.notas')}
          />
        </div>

        {/* ─── CONDICIONES / TERMINOS ─── */}
        <div className="border-t border-borde-sutil px-6 py-4">
          <EditorNotasPresupuesto
            valor={condicionesHtml}
            onChange={(v) => setCondicionesHtml(v)}
            onBlur={() => autoguardar({ condiciones_html: condicionesHtml })}
            placeholder="Escribe una condicion..."
            soloLectura={!esEditable}
            etiqueta={t('documentos.terminos')}
          />
        </div>

        {/* ─── HISTORIAL (solo modo editar) ─── */}
        {modo === 'editar' && presupuesto?.historial && presupuesto.historial.length > 0 && (
          <div className="px-6 py-4 border-t border-borde-sutil">
            <span className="text-xs text-texto-terciario font-medium uppercase tracking-wider flex items-center gap-1 mb-3">
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

      {/* ─── Certificado de aceptación (si existe) ─── */}
      {modo === 'editar' && presupuesto?.pdf_firmado_url && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-insignia-exito/5 border border-insignia-exito/20 rounded-xl">
          <CheckCircle2 size={18} className="text-insignia-exito shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-texto-primario">Presupuesto aceptado por el cliente</p>
            <p className="text-xs text-texto-terciario">Certificado de aceptación digital con firma</p>
          </div>
          <a
            href={presupuesto.pdf_firmado_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-insignia-exito hover:underline shrink-0"
          >
            <FileText size={14} />
            Ver certificado
          </a>
        </div>
      )}

      {/* ─── Panel de actividad (Chatter) ─── */}
      {modo === 'editar' && idPresupuesto && (
        <PanelChatter
          entidadTipo="presupuesto"
          entidadId={idPresupuesto}
        />
      )}
    </div>
  )
}

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
  Sparkles,
} from 'lucide-react'
import { ModalEnviarDocumento, type CanalCorreoEmpresa, type AdjuntoDocumento, type DatosEnvioDocumento, type DatosBorradorCorreo, type DatosPlantillaCorreo } from '@/componentes/entidad/ModalEnviarDocumento'
import { TablaLineas } from './TablaLineas'
import dynamic from 'next/dynamic'
import type { LineaPropuestaIA } from './PanelAsistenteIA'
const PanelAsistenteIA = dynamic(() => import('./PanelAsistenteIA').then(m => m.PanelAsistenteIA), { ssr: false })
import EditorNotasPresupuesto from './EditorNotasPresupuesto'
import SelectorContactoPresupuesto from './SelectorContactoPresupuesto'
import SelectorPlantilla from './SelectorPlantilla'
import { useRol } from '@/hooks/useRol'
import BarraEstadoPresupuesto from './BarraEstadoPresupuesto'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import { useEnvioPendiente } from '@/hooks/useEnvioPendiente'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { useEsPantallaAncha } from '@/hooks/useEsPantallaAncha'
import { usePreferencias } from '@/hooks/usePreferencias'
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
  /** Contacto a precargar al crear (viene de actividades u otros módulos) */
  contactoIdInicial?: string
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
  contactoIdInicial,
  onCreado,
  onDescartado,
  onTituloCargado,
}: PropsEditorPresupuesto) {
  const router = useRouter()
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()
  const { usuario } = useAuth()
  const { esPropietario, esAdmin } = useRol()
  const { programarEnvio } = useEnvioPendiente()
  const esPantallaAncha = useEsPantallaAncha()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()
  const sinLateral = preferencias.chatter_sin_lateral
  const chatterLateral = esPantallaAncha && !sinLateral.includes('*') && !sinLateral.includes('presupuestos')

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

  // Asistente IA
  const [panelIA, setPanelIA] = useState(false)
  const [productosProvisionales, setProductosProvisionales] = useState<string[]>([])

  // Modal enviar documento por correo
  const [modalEnviarAbierto, setModalEnviarAbierto] = useState(false)
  const [correoLibre, setCorreoLibre] = useState(false) // true = desde chatter (sin plantilla, sin PDF, sin portal)
  const [canalesCorreo, setCanalesCorreo] = useState<CanalCorreoEmpresa[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').PlantillaCorreo[]>([])
  const [plantillaCorreoPredeterminadaId, setPlantillaCorreoPredeterminadaId] = useState<string | null>(null)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [urlPortalReal, setUrlPortalReal] = useState<string | null>(null)
  const [snapshotCorreo, setSnapshotCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').SnapshotCorreo | null>(null)

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
        // Preferencia del usuario (localStorage) tiene prioridad sobre config de empresa
        const columnasGuardadas = (() => { try { const c = localStorage.getItem('flux_columnas_presupuesto'); return c ? JSON.parse(c) : null } catch { return null } })()
        if (columnasGuardadas?.length) setColumnasVisibles(columnasGuardadas)
        else if (data.columnas_lineas_default) setColumnasVisibles(data.columnas_lineas_default as string[])
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

      // Cargar datos completos del contacto (whatsapp, direcciones, vinculaciones)
      if (pres.contacto_id) {
        fetch(`/api/contactos/${pres.contacto_id}`)
          .then(r => r.json())
          .then(data => {
            setVinculaciones(data.vinculaciones || [])
            if (data?.id) {
              setContactoSeleccionado({
                id: data.id,
                nombre: data.nombre,
                apellido: data.apellido,
                correo: data.correo,
                telefono: data.telefono,
                whatsapp: data.whatsapp || null,
                codigo: data.codigo || '',
                tipo_contacto: data.tipo_contacto || null,
                numero_identificacion: data.numero_identificacion || null,
                datos_fiscales: data.datos_fiscales || null,
                condicion_iva: data.datos_fiscales?.condicion_iva || null,
                direcciones: data.direcciones || [],
              })
            }
          })
          .catch(() => {})
      }
      // Cargar datos completos del "dirigido a" si existe
      if (pres.atencion_contacto_id) {
        setAtencionId(pres.atencion_contacto_id)
        fetch(`/api/contactos/${pres.atencion_contacto_id}`)
          .then(r => r.json())
          .then(data => {
            if (data?.id) {
              setAtencionSeleccionada({
                id: data.id,
                nombre: data.nombre,
                apellido: data.apellido,
                correo: data.correo,
                telefono: data.telefono,
                whatsapp: data.whatsapp || null,
                tipo_contacto: data.tipo_contacto,
              })
            }
          })
          .catch(() => {})
      }
      // Cargar URL del portal si existe
      fetch(`/api/presupuestos/${presupuestoIdProp}/portal`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.url) setUrlPortalReal(data.url) })
        .catch(() => {})
    }).catch(() => setCargando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, presupuestoIdProp])

  // ─── Precargar contacto si viene de actividades u otro módulo ────────────
  useEffect(() => {
    if (modo !== 'crear' || !contactoIdInicial || contactoId) return
    fetch(`/api/contactos/${contactoIdInicial}`)
      .then(r => { if (r.ok) return r.json(); throw new Error() })
      .then(data => {
        setContactoId(data.id)
        setContactoSeleccionado({
          id: data.id,
          nombre: data.nombre,
          apellido: data.apellido,
          correo: data.correo,
          telefono: data.telefono,
          whatsapp: data.whatsapp || null,
          codigo: data.codigo || '',
          tipo_contacto: data.tipo_contacto || null,
          numero_identificacion: data.numero_identificacion || null,
          datos_fiscales: data.datos_fiscales || null,
          condicion_iva: data.datos_fiscales?.condicion_iva || null,
          direcciones: data.direcciones || [],
        })
        // Usar vinculaciones que ya vienen del contacto
        setVinculaciones(data.vinculaciones || [])
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoIdInicial])

  // ─── Cargar canales de correo y plantillas de la empresa ─────────────────
  useEffect(() => {
    fetch('/api/inbox/canales?tipo=correo&modulo=presupuestos')
      .then(r => r.json())
      .then(data => {
        const canales = (data.canales || [])
          .filter((c: { activo: boolean }) => c.activo)
          .map((c: { id: string; nombre: string; proveedor: string; config_conexion: Record<string, string> }) => ({
            id: c.id,
            nombre: c.nombre,
            email: c.config_conexion?.email || c.config_conexion?.usuario || c.nombre,
            predeterminado: false,
          }))
        // Prioridad: canal marcado por tipo de contacto > canal principal > primero
        const porTipo = canales.find((c: { _predeterminado_tipo?: boolean }) => c._predeterminado_tipo)
        const principal = canales.find((c: { es_principal?: boolean }) => c.es_principal)
        const elegido = porTipo || principal || canales[0]
        if (elegido) elegido.predeterminado = true
        setCanalesCorreo(canales)
      })
      .catch(() => {})

    // Cargar plantillas de correo y detectar predeterminada
    fetch('/api/inbox/plantillas?canal=correo')
      .then(r => r.json())
      .then(data => {
        const todas = data.plantillas || []
        const pls = todas.map((p: { id: string; nombre: string; asunto: string; contenido_html: string; canal_id?: string; creado_por?: string; disponible_para?: string }) => ({
          id: p.id,
          nombre: p.nombre,
          asunto: p.asunto || '',
          contenido_html: p.contenido_html || '',
          canal_id: p.canal_id || null,
          creado_por: p.creado_por || '',
          disponible_para: (p.disponible_para || 'todos') as 'todos' | 'roles' | 'usuarios',
        }))
        setPlantillasCorreo(pls)
        // Detectar plantilla predeterminada (tiene _es_por_defecto en variables y modulo presupuestos)
        const pred = todas.find((p: { variables?: { clave: string }[]; modulos?: string[] }) =>
          (p.variables || []).some(v => v.clave === '_es_por_defecto') &&
          (p.modulos || []).includes('presupuestos')
        )
        if (pred) setPlantillaCorreoPredeterminadaId(pred.id)
      })
      .catch(() => {})
  }, [])

  // ─── Recargar plantillas de correo ───────────────────────────────────────
  const recargarPlantillasCorreo = useCallback(() => {
    fetch('/api/inbox/plantillas?canal=correo')
      .then(r => r.json())
      .then(data => {
        const todas = data.plantillas || []
        const pls = todas.map((p: { id: string; nombre: string; asunto: string; contenido_html: string; canal_id?: string; creado_por?: string; disponible_para?: string }) => ({
          id: p.id,
          nombre: p.nombre,
          asunto: p.asunto || '',
          contenido_html: p.contenido_html || '',
          canal_id: p.canal_id || null,
          creado_por: p.creado_por || '',
          disponible_para: (p.disponible_para || 'todos') as 'todos' | 'roles' | 'usuarios',
        }))
        setPlantillasCorreo(pls)
        const pred = todas.find((p: { variables?: { clave: string }[]; modulos?: string[] }) =>
          (p.variables || []).some((v: { clave: string }) => v.clave === '_es_por_defecto') &&
          (p.modulos || []).includes('presupuestos')
        )
        setPlantillaCorreoPredeterminadaId(pred ? pred.id : null)
      })
      .catch(() => {})
  }, [])

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
  const presupuestoRef = useRef(presupuesto)
  presupuestoRef.current = presupuesto

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
        // Confirmar productos provisorios creados por IA
        if (productosProvisionales.length > 0) {
          Promise.all(productosProvisionales.map(id =>
            fetch(`/api/productos/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ es_provisorio: false }),
            })
          )).catch(() => {})
          setProductosProvisionales([])
        }

        onCreado?.(presupuestoCreado.id, presupuestoCreado.numero)
        window.history.replaceState(null, '', `/presupuestos/${presupuestoCreado.id}`)
      } else {
        const textoError = await res.text().catch(() => '')
        let err = {}
        try { err = JSON.parse(textoError) } catch {}
        console.error('Error al crear presupuesto:', res.status, textoError, err)
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
    // Eliminar productos provisorios que creó la IA
    if (productosProvisionales.length > 0) {
      Promise.all(productosProvisionales.map(id =>
        fetch(`/api/productos/${id}`, { method: 'DELETE' })
      )).catch(() => {})
      setProductosProvisionales([])
    }

    onDescartado?.()
    router.push('/presupuestos')
  }, [modo, router, onDescartado, productosProvisionales])

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
    const impDefault = impuestos.find(i => i.activo && i.predeterminado) || impuestos.find(i => i.activo && i.porcentaje > 0)
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

  // ─── Asistente IA: aplicar líneas propuestas ───
  const aplicarLineasIA = useCallback(async (lineasIA: LineaPropuestaIA[]) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const pid = presupuestoIdRef.current

    for (const lineaIA of lineasIA) {
      // Buscar impuesto por id
      const imp = lineaIA.impuesto_id ? impuestos.find(i => i.id === lineaIA.impuesto_id) : null
      const impDefault = impuestos.find(i => i.activo && i.predeterminado) || impuestos.find(i => i.activo && i.porcentaje > 0)
      const impFinal = imp || impDefault

      if (pid) {
        // Presupuesto ya creado — persistir directamente
        try {
          const res = await fetch(`/api/presupuestos/${pid}/lineas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo_linea: 'producto',
              codigo_producto: lineaIA.referencia_interna || lineaIA.codigo || null,
              descripcion: lineaIA.nombre,
              descripcion_detalle: lineaIA.descripcion_editada || lineaIA.descripcion_venta || null,
              cantidad: '1',
              unidad: lineaIA.unidad || null,
              precio_unitario: '0',
              impuesto_label: impFinal ? impFinal.label : null,
              impuesto_porcentaje: impFinal ? String(impFinal.porcentaje) : '0',
            }),
          })
          if (res.ok) {
            const nuevas = await res.json()
            setLineas(prev => [...prev, ...(Array.isArray(nuevas) ? nuevas : [nuevas])])
          }
        } catch { /* silenciar */ }
      } else {
        // Línea temporal en memoria
        const nuevaLinea: LineaTemporal = {
          _temp: true,
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tipo_linea: 'producto',
          orden: lineas.length,
          codigo_producto: lineaIA.referencia_interna || lineaIA.codigo || null,
          descripcion: lineaIA.nombre,
          descripcion_detalle: lineaIA.descripcion_editada || lineaIA.descripcion_venta || null,
          cantidad: '1',
          unidad: lineaIA.unidad || null,
          precio_unitario: '0',
          descuento: '0',
          impuesto_label: impFinal ? impFinal.label : null,
          impuesto_porcentaje: impFinal ? String(impFinal.porcentaje) : '0',
          subtotal: '0',
          impuesto_monto: '0',
          total: '0',
          monto: null,
        }
        setLineas(prev => [...prev, nuevaLinea])
      }
    }

    if (pid && modo === 'editar') recargarTotales()
  }, [config, lineas.length, modo])

  // ─── Asistente IA: crear servicio nuevo en catálogo ───
  const crearServicioDesdeIA = useCallback(async (linea: LineaPropuestaIA): Promise<{ codigo: string; id: string } | null> => {
    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: linea.nombre,
          tipo: 'servicio',
          categoria: linea.categoria_sugerida || null,
          referencia_interna: linea.codigo || null,
          descripcion_venta: linea.descripcion_editada || linea.descripcion_venta || null,
          unidad: linea.unidad || 'unidad',
          puede_venderse: true,
          origen: 'asistente_salix',
          es_provisorio: true,
        }),
      })
      if (res.ok) {
        const producto = await res.json()
        setProductosProvisionales(prev => [...prev, producto.id])
        return { codigo: producto.codigo, id: producto.id }
      }
    } catch { /* silenciar */ }
    return null
  }, [])

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

  const handleEnviar = () => {
    // Limpiar snapshot previo (apertura normal, no deshacer)
    setSnapshotCorreo(null)
    // Abrir modal inmediatamente — sin esperar guardado ni PDF
    setModalEnviarAbierto(true)
    // Guardar + generar PDF y portal en background para que estén listos al enviar
    if (idPresupuesto) {
      guardarTodo().then(() => {
        Promise.all([
          fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forzar: false }),
          }).then(r => r.json()).then(data => {
            // Actualizar pdf_url en el estado para que esté disponible al enviar
            if (data.url) {
              setPresupuesto(prev => prev ? { ...prev, pdf_url: data.url } : null)
            }
          }).catch(() => {}),
          fetch(`/api/presupuestos/${idPresupuesto}/portal`, { method: 'POST' })
            .then(r => r.json())
            .then(data => { if (data.url) setUrlPortalReal(data.url) })
            .catch(() => {}),
        ]).catch(() => {})
      })
    }
  }

  // Callback de envío de correo desde el modal — usa envío diferido con countdown
  const handleEnviarCorreo = useCallback(async (datos: DatosEnvioDocumento) => {
    // Cambiar estado a enviado si aún no lo está (esto sí es inmediato)
    const estadoActual = presupuesto?.estado || 'borrador'
    if (estadoActual === 'borrador') {
      await cambiarEstado('enviado')
    }

    // Nombre del contacto para el CTA y pie
    const nombreContactoCorreo = atencionSeleccionada
      ? `${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()
      : contactoSeleccionado
        ? `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim()
        : presupuesto?.contacto_nombre
          ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
          : ''

    const numDoc = numeroPresupuesto || presupuesto?.numero || ''
    const etiqueta = t('documentos.tipos.presupuesto')

    // Construir HTML final con CTA portal (si tildado) + pie empresa + dark mode
    const htmlFinal = construirHtmlCorreoDocumento({
      htmlCuerpo: datos.html,
      incluirPortal: datos.incluir_enlace_portal,
      portal: urlPortalReal ? {
        url: urlPortalReal,
        etiquetaTipo: etiqueta,
        tituloDocumento: `${etiqueta} ${numDoc}`,
        nombreContacto: nombreContactoCorreo,
      } : undefined,
      colorMarca: empresa?.color_marca || null,
      empresa: {
        nombre: datosEmpresa?.nombre || empresa?.nombre || '',
        telefono: datosEmpresa?.telefono || null,
        correo: datosEmpresa?.correo || null,
      },
    })

    // Si es programado, enviar directo (no tiene sentido el countdown)
    if (datos.programado_para) {
      const res = await fetch('/api/inbox/correo/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: datos.canal_id, correo_para: datos.correo_para,
          correo_cc: datos.correo_cc.length > 0 ? datos.correo_cc : undefined,
          correo_cco: datos.correo_cco.length > 0 ? datos.correo_cco : undefined,
          correo_asunto: datos.asunto, texto: datos.texto, html: htmlFinal,
          adjuntos_ids: datos.adjuntos_ids.length > 0 ? datos.adjuntos_ids : undefined,
          pdf_url: presupuestoRef.current?.pdf_url || undefined,
          pdf_nombre: presupuestoRef.current?.numero ? `${presupuestoRef.current.numero}.pdf` : undefined,
          tipo: 'nuevo', programado_para: datos.programado_para,
          entidad_tipo: 'presupuesto', entidad_id: idPresupuesto,
        }),
      })
      if (res.ok) setModalEnviarAbierto(false)
      return
    }

    // Cerrar modal inmediatamente — el toast de countdown toma el control
    setModalEnviarAbierto(false)

    // Función de envío real (se ejecuta cuando termina el countdown o se clickea "Enviar ya")
    // Usa ref para tener el pdf_url más reciente (puede actualizarse mientras el countdown corre)
    const enviarFn = async () => {
      const pres = presupuestoRef.current
      await fetch('/api/inbox/correo/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: datos.canal_id, correo_para: datos.correo_para,
          correo_cc: datos.correo_cc.length > 0 ? datos.correo_cc : undefined,
          correo_cco: datos.correo_cco.length > 0 ? datos.correo_cco : undefined,
          correo_asunto: datos.asunto, texto: datos.texto, html: htmlFinal,
          adjuntos_ids: datos.adjuntos_ids.length > 0 ? datos.adjuntos_ids : undefined,
          pdf_url: pres?.pdf_url || undefined,
          pdf_nombre: pres?.numero ? `${pres.numero}.pdf` : undefined,
          tipo: 'nuevo',
          entidad_tipo: 'presupuesto', entidad_id: idPresupuesto,
        }),
      })
    }

    // Guardar snapshot del estado del modal para poder restaurar al deshacer
    const snapshot = datos._snapshot || null
    setSnapshotCorreo(snapshot)

    // Descripción para el toast
    const descripcionToast = `Para: ${datos.correo_para[0]} — ${datos.asunto || '(Sin asunto)'}`

    // Programar con countdown de 30 segundos
    programarEnvio(enviarFn, {
      descripcion: descripcionToast,
      onDeshacer: () => {
        // Restaurar snapshot y reabrir el modal
        setSnapshotCorreo(snapshot)
        setModalEnviarAbierto(true)
        // Revertir estado si lo cambiamos
        if (estadoActual === 'borrador') {
          cambiarEstado('borrador').catch(() => {})
        }
      },
    })
  }, [presupuesto?.estado, presupuesto?.numero, presupuesto?.contacto_nombre, presupuesto?.contacto_apellido, cambiarEstado, atencionSeleccionada, contactoSeleccionado, numeroPresupuesto, idPresupuesto, empresa?.color_marca, empresa?.nombre, datosEmpresa, t, programarEnvio])
  // Guardar borrador de correo (cerrar modal sin enviar)
  const handleGuardarBorrador = useCallback(async (datos: DatosBorradorCorreo) => {
    // Por ahora guardamos en localStorage; a futuro puede ir a la BD
    if (idPresupuesto) {
      try {
        localStorage.setItem(`borrador_correo_${idPresupuesto}`, JSON.stringify(datos))
      } catch { /* silenciar */ }
    }
    setModalEnviarAbierto(false)
  }, [idPresupuesto])

  // Guardar como plantilla de correo
  const handleGuardarPlantilla = useCallback(async (datos: DatosPlantillaCorreo) => {
    try {
      await fetch('/api/inbox/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.nombre,
          canal: 'correo',
          asunto: datos.asunto,
          contenido: datos.contenido_html.replace(/<[^>]+>/g, '').trim(),
          contenido_html: datos.contenido_html,
          modulos: ['presupuestos'],
          disponible_para: 'usuarios',
        }),
      })
      recargarPlantillasCorreo()
    } catch (err) {
      console.error('Error al guardar plantilla:', err)
    }
  }, [recargarPlantillasCorreo])

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

  // Totales: siempre se calculan desde las líneas para reflejar cambios en tiempo real
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
    <div className={`w-full mx-auto px-4 py-6 ${
      chatterLateral ? 'max-w-[1600px] flex gap-5 items-start' : 'max-w-[1200px] space-y-5'
    }`}>
      {/* ─── Contenido principal (se comprime cuando chatter está lateral) ─── */}
      <div className={`space-y-5 ${chatterLateral ? 'flex-1 min-w-0' : ''}`}>
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
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<Cloud size={16} />} onClick={modo === 'crear' && !idPresupuesto ? crearPresupuesto : () => autoguardar({})} disabled={modo === 'crear' && (!contactoId || guardando)} titulo={guardando ? 'Guardando...' : idPresupuesto ? 'Guardado' : modo === 'crear' && contactoId ? 'Guardar presupuesto' : 'Selecciona un cliente primero'} className={guardando ? 'text-texto-marca animate-pulse' : ''} />
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={16} />} onClick={descartarPresupuesto} titulo={idPresupuesto ? 'Eliminar presupuesto' : 'Descartar'} className={idPresupuesto ? 'text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10' : ''} />
              {/* Info y RefreshCw en modo editar o post-creación */}
              {(modo === 'editar' || presupuestoIdCreado) && (
                <>
                  <Boton variante="fantasma" tamano="xs" soloIcono icono={<Info size={16} />} titulo="Informacion del documento" />
                  <Boton variante="fantasma" tamano="xs" soloIcono icono={<RefreshCw size={16} className={generandoPdf ? 'animate-spin' : ''} />} onClick={async () => {
                      if (!idPresupuesto || generandoPdf) return
                      setGenerandoPdf(true)
                      try {
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
                    }} disabled={generandoPdf} titulo="Regenerar PDF" />
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
                const BotonAccion = ({ onClick, icono: Icono, label, variante = 'default', disabled = false, animarIcono = false }: {
                  onClick: () => void; icono: typeof Send; label: string; variante?: string; disabled?: boolean; animarIcono?: boolean
                }) => (
                  <Boton
                    onClick={onClick}
                    disabled={disabled}
                    variante={variante === 'primario' ? 'primario' : variante === 'peligro' ? 'peligro' : 'secundario'}
                    tamano="sm"
                    icono={<Icono size={15} className={animarIcono ? 'animate-spin' : ''} />}
                  >
                    <span className="hidden sm:inline">{label}</span>
                  </Boton>
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
              <Boton variante="fantasma" tamano="xs" onClick={() => cambiarEstado('borrador')} className="ml-1">Volver a Borrador</Boton>
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
                      whatsapp: contactoSeleccionado.whatsapp || null,
                      tipo_contacto: contactoSeleccionado.tipo_contacto,
                      numero_identificacion: contactoSeleccionado.numero_identificacion,
                      condicion_iva: contactoSeleccionado.condicion_iva || null,
                      direccion: contactoSeleccionado.direcciones?.find(d => d.es_principal)?.texto || null,
                      direcciones: contactoSeleccionado.direcciones || [],
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
                            whatsapp: hijo.whatsapp || null,
                            tipo_contacto: hijo.tipo_contacto,
                          })
                        }
                      } catch { /* silenciar */ }
                    }}
                  />
                ) : (
                  /* Modo editar: usa datos completos del contacto si están cargados, sino fallback al snapshot */
                  <SelectorContactoPresupuesto
                    contacto={contactoSeleccionado ? {
                      id: contactoSeleccionado.id,
                      nombre: contactoSeleccionado.nombre,
                      apellido: contactoSeleccionado.apellido,
                      correo: contactoSeleccionado.correo,
                      telefono: contactoSeleccionado.telefono,
                      whatsapp: contactoSeleccionado.whatsapp || null,
                      tipo_contacto: contactoSeleccionado.tipo_contacto,
                      numero_identificacion: contactoSeleccionado.numero_identificacion,
                      condicion_iva: contactoSeleccionado.condicion_iva || null,
                      direccion: contactoSeleccionado.direcciones?.find(d => d.es_principal)?.texto || presupuesto?.contacto_direccion || null,
                      direcciones: contactoSeleccionado.direcciones || [],
                    } : presupuesto?.contacto_nombre ? {
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
                      } else {
                        // Limpiar contacto del presupuesto
                        const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ contacto_id: null }),
                        })
                        if (res.ok) {
                          const act = await res.json()
                          setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                          setVinculaciones([])
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
                          <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                            <Mail size={13} className="shrink-0" />
                            {atencionSeleccionada.correo}
                          </p>
                        )}
                        {(atencionSeleccionada.whatsapp || atencionSeleccionada.telefono) && (
                          <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                            <Phone size={13} className="shrink-0" />
                            {atencionSeleccionada.whatsapp || atencionSeleccionada.telefono}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Boton variante="fantasma" tamano="xs" onClick={() => { setAtencionId(null); setAtencionSeleccionada(null) }}>Cambiar</Boton>
                        <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={13} />} onClick={() => router.push(`/contactos/${atencionSeleccionada.id}`)} titulo="Ver ficha del contacto" />
                      </div>
                    </div>
                    <p className="text-xxs text-texto-terciario mt-2">
                      Aparecera como &quot;Atencion:&quot; en el PDF del documento
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {vinculaciones.map(v => (
                      <Boton
                        key={v.id}
                        variante="fantasma"
                        tamano="sm"
                        onClick={() => seleccionarAtencion(v)}
                        className="w-full text-left px-2 py-2 h-auto"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-texto-primario truncate">
                            {v.vinculado.nombre} {v.vinculado.apellido || ''}
                          </div>
                          <div className="text-xs text-texto-terciario truncate">
                            {v.puesto || v.vinculado.correo || ''}
                          </div>
                        </div>
                      </Boton>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DIRIGIDO A — modo editar, con selección previa */}
            {modo === 'editar' && presupuesto?.atencion_nombre && (
              <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg px-3 py-3 -mx-3">
                <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
                  Dirigido a
                </span>
                <div className="mt-1.5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-texto-primario">{presupuesto.atencion_nombre}</p>
                      {(atencionSeleccionada?.correo || presupuesto.atencion_correo) && (
                        <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                          <Mail size={13} className="shrink-0" />
                          {atencionSeleccionada?.correo || presupuesto.atencion_correo}
                        </p>
                      )}
                      {(atencionSeleccionada?.whatsapp || atencionSeleccionada?.telefono) && (
                        <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                          <Phone size={13} className="shrink-0" />
                          {atencionSeleccionada.whatsapp || atencionSeleccionada.telefono}
                        </p>
                      )}
                      {presupuesto.atencion_cargo && (
                        <p className="text-xs text-texto-terciario">{presupuesto.atencion_cargo}</p>
                      )}
                    </div>
                    {esEditable && (
                      <div className="flex items-center gap-1 shrink-0">
                        {vinculaciones.length > 0 && (
                          <Boton variante="fantasma" tamano="xs" onClick={() => {
                              autoguardar({
                                atencion_contacto_id: null as unknown as string,
                                atencion_nombre: '',
                                atencion_correo: '',
                              })
                              setPresupuesto(prev => prev ? {
                                ...prev,
                                atencion_contacto_id: null,
                                atencion_nombre: null,
                                atencion_correo: null,
                              } : null)
                              setAtencionId(null)
                              setAtencionSeleccionada(null)
                            }}>Cambiar</Boton>
                        )}
                        {presupuesto.atencion_contacto_id && (
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={13} />} onClick={() => router.push(`/contactos/${presupuesto.atencion_contacto_id}`)} titulo="Ver ficha del contacto" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xxs text-texto-terciario mt-2">Aparecera como &quot;Atencion:&quot; en el PDF del documento</p>
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
                    <Boton
                      key={v.id}
                      variante="fantasma"
                      tamano="sm"
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
                        setAtencionId(v.vinculado.id)
                        setAtencionSeleccionada(v.vinculado)
                      }}
                      className="w-full text-left px-3 py-2 h-auto border border-transparent hover:border-borde-sutil"
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
                    </Boton>
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
                    puedeEliminarTodas={esPropietario || esAdmin}
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
                        <Input
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          onBlur={() => autoguardar({ referencia })}
                          placeholder="PO, orden de compra..."
                          formato={null}
                          variante="plano"
                          compacto
                          className={`${valorAncho} text-right pl-3`}
                        />
                      ) : (
                        <span className="text-sm text-texto-primario">{referencia || '—'}</span>
                      )}
                    </div>
                  </div>

                  {/* ── Fechas (grid único de 3 columnas compartido) ── */}
                  <div className="px-3 py-1 grid grid-cols-[1fr_2.5rem_auto] items-center gap-x-3">
                    {/* Fila Emisión */}
                    <span className={`${etiqueta} py-2.5`}>Emisión</span>
                    <div className="py-2.5" />
                    <div className="py-2.5 w-40">
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
                    {/* Fila Validez */}
                    <span className={`${etiqueta} py-2.5`}>Validez</span>
                    <div className="py-2.5">
                      {esEditable && !bloqueada ? (
                        <Input
                          tipo="number"
                          min={1}
                          value={diasVencimiento}
                          onChange={(e) => setDiasVencimiento(Math.max(1, parseInt(e.target.value) || 1))}
                          onBlur={() => autoguardar({ dias_vencimiento: diasVencimiento })}
                          onFocus={(e) => e.target.select()}
                          formato={null}
                          compacto
                          className="!w-10 font-mono text-center text-xs !px-1 !py-1"
                          title="Dias de validez"
                        />
                      ) : (
                        <span className="text-xs text-texto-terciario font-mono text-center block">{diasVencimiento}d</span>
                      )}
                    </div>
                    <div className="py-2.5 w-40">
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
          {/* Botón Asistente IA */}
          {esEditable && (
            <div className="flex justify-end mb-3">
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Sparkles size={14} />}
                onClick={() => setPanelIA(true)}
              >
                Salix IA
              </Boton>
            </div>
          )}

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
            onCambiarColumnas={(cols) => {
              setColumnasVisibles(cols)
              autoguardar({ columnas_lineas: cols })
              // Persistir preferencia del usuario para futuros presupuestos
              try { localStorage.setItem('flux_columnas_presupuesto', JSON.stringify(cols)) } catch {}
            }}
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

      {/* Cierre del wrapper de contenido principal (modo lateral) */}
      </div>

      {/* ─── Panel de actividad (Chatter) ─── */}
      {modo === 'editar' && idPresupuesto && (
        <PanelChatter
          entidadTipo="presupuesto"
          entidadId={idPresupuesto}
          contacto={(() => {
            // Prioridad: dirigido a > contacto principal > snapshot presupuesto
            const atencion = atencionSeleccionada
            const cto = contactoSeleccionado
            return {
              id: atencion?.id || cto?.id || presupuesto?.contacto_id || undefined,
              nombre: atencion
                ? `${atencion.nombre} ${atencion.apellido || ''}`.trim()
                : cto
                  ? `${cto.nombre} ${cto.apellido || ''}`.trim()
                  : presupuesto?.contacto_nombre
                    ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
                    : undefined,
              correo: atencion?.correo || cto?.correo || presupuesto?.contacto_correo || undefined,
              whatsapp: atencion?.whatsapp || cto?.whatsapp || undefined,
              telefono: atencion?.telefono || cto?.telefono || presupuesto?.contacto_telefono || undefined,
            }
          })()}
          tipoDocumento="Presupuesto"
          datosDocumento={{
            numero: presupuesto?.numero || numeroPresupuesto || '',
            total: presupuesto?.total_final ? `$${Number(presupuesto.total_final).toLocaleString('es-AR')}` : '',
            fecha: presupuesto?.fecha_emision ? new Date(presupuesto.fecha_emision).toLocaleDateString('es-AR') : '',
            estado: presupuesto?.estado || '',
            empresaNombre: datosEmpresa?.nombre || empresa?.nombre || '',
            urlPortal: urlPortalReal || undefined,
          }}
          onAbrirCorreo={() => { setCorreoLibre(true); setModalEnviarAbierto(true) }}
          adjuntosDocumento={presupuesto?.pdf_url ? [{
            url: presupuesto.pdf_url,
            nombre: `${presupuesto.numero || 'Presupuesto'}.pdf`,
            tipo: 'application/pdf',
            miniatura_url: presupuesto.pdf_miniatura_url || undefined,
            origen: 'PDF del presupuesto',
          }] : []}
          modo={chatterLateral ? 'lateral' : 'inferior'}
          seccion="presupuestos"
          sinLateral={sinLateral}
          onCambiarSinLateral={(nuevo) => guardarPreferencia({ chatter_sin_lateral: nuevo })}
          className={chatterLateral ? 'w-[380px] shrink-0 sticky top-4 max-h-[calc(100dvh-3rem)]' : ''}
        />
      )}

      {/* ─── Panel Asistente IA ─── */}
      <PanelAsistenteIA
        abierto={panelIA}
        onCerrar={() => setPanelIA(false)}
        onAplicarLineas={aplicarLineasIA}
        onCrearServicio={crearServicioDesdeIA}
      />

      {/* ─── Modal enviar documento por correo ─── */}
      <ModalEnviarDocumento
        abierto={modalEnviarAbierto}
        onCerrar={() => { setModalEnviarAbierto(false); setCorreoLibre(false) }}
        onEnviar={handleEnviarCorreo}
        canales={canalesCorreo}
        plantillas={correoLibre ? [] : plantillasCorreo}
        correosDestinatario={
          atencionSeleccionada?.correo
            ? [atencionSeleccionada.correo]
            : presupuesto?.atencion_correo
              ? [presupuesto.atencion_correo]
              : contactoSeleccionado?.correo
                ? [contactoSeleccionado.correo]
                : presupuesto?.contacto_correo
                  ? [presupuesto.contacto_correo]
                  : []
        }
        nombreDestinatario={
          atencionSeleccionada
            ? `${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()
            : presupuesto?.atencion_nombre
              ? presupuesto.atencion_nombre
              : contactoSeleccionado
                ? `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim()
                : presupuesto?.contacto_nombre
                  ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
                  : ''
        }
        asuntoPredeterminado={correoLibre ? '' : (() => {
          const num = numeroPresupuesto || presupuesto?.numero || ''
          const nombreDest = atencionSeleccionada
            ? `${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()
            : contactoSeleccionado
              ? `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim()
              : presupuesto?.contacto_nombre
                ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
                : ''
          return nombreDest ? `${num} - ${nombreDest}` : `${t('documentos.tipos.presupuesto')} ${num}`
        })()}
        adjuntoDocumento={
          presupuesto?.pdf_url ? {
            id: presupuesto.id,
            nombre_archivo: `${presupuesto.numero || 'Presupuesto'}.pdf`,
            tipo_mime: 'application/pdf',
            tamano_bytes: 0,
            url: presupuesto.pdf_url,
            miniatura_url: presupuesto.pdf_miniatura_url,
          } : null
        }
        urlPortal={urlPortalReal}
        pdfDesactivadoInicial={correoLibre}
        portalDesactivadoInicial={correoLibre}
        enviando={enviandoCorreo}
        tipoDocumento={t('documentos.tipos.presupuesto')}
        onGuardarBorrador={handleGuardarBorrador}
        onGuardarPlantilla={handleGuardarPlantilla}
        snapshotRestaurar={correoLibre ? undefined : snapshotCorreo}
        plantillaPredeterminadaId={correoLibre ? undefined : plantillaCorreoPredeterminadaId}
        onCambiarPredeterminada={(esPropietario || esAdmin) ? async (tplId) => {
          // Guardar/quitar _es_por_defecto via PATCH a la plantilla
          if (tplId) {
            // Quitar predeterminada anterior si existe
            if (plantillaCorreoPredeterminadaId && plantillaCorreoPredeterminadaId !== tplId) {
              await fetch(`/api/inbox/plantillas/${plantillaCorreoPredeterminadaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: [] }),
              })
            }
            // Marcar nueva predeterminada
            await fetch(`/api/inbox/plantillas/${tplId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                variables: [{ clave: '_es_por_defecto', etiqueta: 'Por defecto', origen: 'metadata' }],
              }),
            })
            setPlantillaCorreoPredeterminadaId(tplId)
          } else {
            // Quitar predeterminada
            if (plantillaCorreoPredeterminadaId) {
              await fetch(`/api/inbox/plantillas/${plantillaCorreoPredeterminadaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: [] }),
              })
            }
            setPlantillaCorreoPredeterminadaId(null)
          }
        } : undefined}
        usuarioId={usuario?.id || ''}
        esAdmin={esPropietario || esAdmin}
        onGuardarCambiosPlantilla={async (id, datos) => {
          await fetch(`/api/inbox/plantillas/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asunto: datos.asunto,
              contenido_html: datos.contenido_html,
              contenido: datos.contenido_html.replace(/<[^>]*>/g, ''),
            }),
          })
          recargarPlantillasCorreo()
        }}
        onCrearPlantilla={async (nombre, datos) => {
          await fetch('/api/inbox/plantillas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre,
              canal: 'correo',
              asunto: datos.asunto,
              contenido: datos.contenido_html.replace(/<[^>]*>/g, ''),
              contenido_html: datos.contenido_html,
              modulos: ['presupuestos'],
              disponible_para: datos.paraTodos ? 'todos' : 'usuarios',
            }),
          })
          recargarPlantillasCorreo()
        }}
        onEliminarPlantilla={async (id) => {
          await fetch(`/api/inbox/plantillas/${id}`, { method: 'DELETE' })
          recargarPlantillasCorreo()
        }}
        contextoVariables={{
          contacto: {
            nombre: contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || '',
            apellido: contactoSeleccionado?.apellido || presupuesto?.contacto_apellido || '',
            nombre_completo: `${contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || ''} ${contactoSeleccionado?.apellido || presupuesto?.contacto_apellido || ''}`.trim(),
            correo: contactoSeleccionado?.correo || presupuesto?.contacto_correo || '',
            telefono: contactoSeleccionado?.telefono || presupuesto?.contacto_telefono || '',
            tipo: contactoSeleccionado?.tipo_contacto?.etiqueta || presupuesto?.contacto_tipo || '',
            numero_identificacion: contactoSeleccionado?.numero_identificacion || presupuesto?.contacto_identificacion || '',
            condicion_iva: contactoSeleccionado?.condicion_iva || presupuesto?.contacto_condicion_iva || '',
            direccion_completa: contactoSeleccionado?.direcciones?.find(d => d.es_principal)?.texto || contactoSeleccionado?.direcciones?.[0]?.texto || presupuesto?.contacto_direccion || '',
            calle: (() => { const d = contactoSeleccionado?.direcciones?.find(d => d.es_principal) || contactoSeleccionado?.direcciones?.[0]; return d ? [d.calle, d.numero].filter(Boolean).join(' ') : '' })(),
            ciudad: (contactoSeleccionado?.direcciones?.find(d => d.es_principal) || contactoSeleccionado?.direcciones?.[0])?.ciudad || '',
            provincia: (contactoSeleccionado?.direcciones?.find(d => d.es_principal) || contactoSeleccionado?.direcciones?.[0])?.provincia || '',
            codigo_postal: (contactoSeleccionado?.direcciones?.find(d => d.es_principal) || contactoSeleccionado?.direcciones?.[0])?.codigo_postal || '',
          },
          presupuesto: (() => {
            const totalFinal = totales.total
            // Calcular adelanto y restante desde hitos de la condición de pago
            const hitos = condSeleccionada?.tipo === 'hitos' ? condSeleccionada.hitos : []
            const primerHito = hitos[0]
            const porcentajeAdelanto = primerHito?.porcentaje || 0
            const montoAdelanto = totalFinal * porcentajeAdelanto / 100
            // Monto restante = total - adelanto (lo que falta pagar después del adelanto)
            const montoRestante = totalFinal - montoAdelanto
            // Saldo pendiente = total - suma de cuotas cobradas
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cuotasCobradas = (presupuesto as any)?.cuotas_cobradas
            const totalPagado = typeof cuotasCobradas === 'number' ? cuotasCobradas : 0
            const saldoPendiente = totalFinal - totalPagado

            return {
              numero: presupuesto?.numero || numeroPresupuesto || '',
              estado: presupuesto?.estado || 'borrador',
              moneda: presupuesto?.moneda || moneda,
              total_neto: presupuesto?.subtotal_neto || totales.subtotal,
              total_impuestos: presupuesto?.total_impuestos || totales.impuestos,
              total_con_iva: presupuesto?.total_final || totalFinal,
              condicion_pago_label: presupuesto?.condicion_pago_label || condSeleccionada?.label || '',
              porcentaje_adelanto: porcentajeAdelanto,
              monto_adelanto: montoAdelanto,
              monto_restante: montoRestante,
              saldo_pendiente: saldoPendiente,
              pagado: totalPagado,
              fecha_emision: presupuesto?.fecha_emision || fechaEmision,
              fecha_vencimiento: presupuesto?.fecha_vencimiento || '',
              referencia: presupuesto?.referencia || referencia,
              contacto_nombre: contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || '',
              contacto_correo: contactoSeleccionado?.correo || presupuesto?.contacto_correo || '',
            }
          })(),
          empresa: {
            nombre: datosEmpresa?.nombre || '',
            correo_contacto: datosEmpresa?.correo || '',
            telefono: datosEmpresa?.telefono || '',
          },
          dirigido_a: {
            nombre: atencionSeleccionada?.nombre || presupuesto?.atencion_nombre || '',
            apellido: atencionSeleccionada?.apellido || '',
            nombre_completo: atencionSeleccionada
              ? `${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()
              : presupuesto?.atencion_nombre || '',
            correo: atencionSeleccionada?.correo || presupuesto?.atencion_correo || '',
            telefono: atencionSeleccionada?.telefono || '',
            cargo: presupuesto?.atencion_cargo || '',
            // Los demás campos (whatsapp, cuit, dirección) se cargarán si ampliamos Vinculacion
            empresa_nombre: contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || '',
          },
        }}
      />
    </div>
  )
}

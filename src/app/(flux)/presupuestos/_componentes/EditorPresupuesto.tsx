'use client'

/**
 * EditorPresupuesto — Componente orquestador para crear y editar presupuestos.
 * Contiene toda la lógica de estado y delega el render a sub-componentes.
 * Se usa en: presupuestos/nuevo/page.tsx, presupuestos/[id]/page.tsx
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { ModalEnviarDocumento, type CanalCorreoEmpresa, type DatosEnvioDocumento, type DatosBorradorCorreo, type DatosPlantillaCorreo } from '@/componentes/entidad/ModalEnviarDocumento'
import { TablaLineas, type OriginalCatalogo } from './TablaLineas'
import dynamic from 'next/dynamic'
import type { LineaPropuestaIA } from './PanelAsistenteIA'
const PanelAsistenteIA = dynamic(() => import('./PanelAsistenteIA').then(m => m.PanelAsistenteIA), { ssr: false })
import EditorNotasPresupuesto from './EditorNotasPresupuesto'
import { useRol } from '@/hooks/useRol'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Modal } from '@/componentes/ui/Modal'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import { useEnvioPendiente } from '@/hooks/useEnvioPendiente'
import { useToast } from '@/componentes/feedback/Toast'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useEsPantallaAncha } from '@/hooks/useEsPantallaAncha'
import { usePreferencias } from '@/hooks/usePreferencias'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import type {
  PresupuestoConLineas, LineaPresupuesto, TipoLinea,
  Impuesto, UnidadMedida, CondicionPago, ConfigPresupuestos,
  EstadoPresupuesto,
} from '@/tipos/presupuesto'
import { TRANSICIONES_ESTADO } from '@/tipos/presupuesto'
import type {
  ContactoResumido, Vinculacion, DatosEmpresa, LineaTemporal,
} from './tipos-editor'

// ─── Sub-componentes extraídos ──────────────────────────────────────────────
import CabeceraPresupuesto, { BannerBloqueo } from './CabeceraPresupuesto'
import SeccionEmisor from './SeccionEmisor'
import SeccionCliente from './SeccionCliente'
import SeccionDatosPresupuesto from './SeccionDatosPresupuesto'
import SeccionTotales from './SeccionTotales'
import SeccionHistorial from './SeccionHistorial'
import SeccionCertificado from './SeccionCertificado'

// ─── Props del componente ───────────────────────────────────────────────────

interface PropsEditorPresupuesto {
  modo: 'crear' | 'editar'
  /** Requerido si modo === 'editar' */
  presupuestoId?: string
  /** Contacto a precargar al crear (viene de actividades u otros módulos) */
  contactoIdInicial?: string
  /** ID de la actividad origen — si se pasa, el backend la auto-completa al crear */
  actividadOrigenId?: string
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
  actividadOrigenId,
  onCreado,
  onDescartado,
  onTituloCargado,
}: PropsEditorPresupuesto) {
  const router = useRouter()
  const { t } = useTraduccion()
  const formato = useFormato()
  const { empresa } = useEmpresa()
  const { usuario } = useAuth()
  const { esPropietario, esAdmin, tienePermiso } = useRol()
  const { programarEnvio } = useEnvioPendiente()
  const { mostrar: mostrarToast } = useToast()
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
  const [correoLibre, setCorreoLibre] = useState(false)
  const [canalesCorreo, setCanalesCorreo] = useState<CanalCorreoEmpresa[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').PlantillaCorreo[]>([])
  const [plantillaCorreoPredeterminadaId, setPlantillaCorreoPredeterminadaId] = useState<string | null>(null)
  const [enviandoCorreo] = useState(false)
  const [urlPortalReal, setUrlPortalReal] = useState<string | null>(null)
  const [snapshotCorreo, setSnapshotCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').SnapshotCorreo | null>(null)
  const [pdfCongeladoUrl, setPdfCongeladoUrl] = useState<string | null>(null)

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
  const [lineaRecienAgregada, setLineaRecienAgregada] = useState<string | null>(null)
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([
    'producto', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento', 'impuesto', 'subtotal',
  ])

  // Originales del catálogo por lineaId — para detectar cambios en nombre/descripción
  const [originalesCatalogo, setOriginalesCatalogo] = useState<Map<string, OriginalCatalogo>>(new Map())

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

      onTituloCargado?.(pres.numero || 'Detalle')

      // Cargar contacto, atención y portal EN PARALELO (antes eran seriales)
      const fetchsSecundarios: Promise<void>[] = []

      if (pres.contacto_id) {
        fetchsSecundarios.push(
          fetch(`/api/contactos/${pres.contacto_id}`)
            .then(r => r.json())
            .then(data => {
              setVinculaciones(data.vinculaciones || [])
              if (data?.id) {
                setContactoSeleccionado({
                  id: data.id, nombre: data.nombre, apellido: data.apellido,
                  correo: data.correo, telefono: data.telefono,
                  whatsapp: data.whatsapp || null, codigo: data.codigo || '',
                  tipo_contacto: data.tipo_contacto || null,
                  numero_identificacion: data.numero_identificacion || null,
                  datos_fiscales: data.datos_fiscales || null,
                  condicion_iva: data.datos_fiscales?.condicion_iva || null,
                  direcciones: data.direcciones || [],
                })
              }
            })
            .catch(() => {})
        )
      }
      if (pres.atencion_contacto_id) {
        setAtencionId(pres.atencion_contacto_id)
        fetchsSecundarios.push(
          fetch(`/api/contactos/${pres.atencion_contacto_id}`)
            .then(r => r.json())
            .then(data => {
              if (data?.id) {
                setAtencionSeleccionada({
                  id: data.id, nombre: data.nombre, apellido: data.apellido,
                  correo: data.correo, telefono: data.telefono,
                  whatsapp: data.whatsapp || null, tipo_contacto: data.tipo_contacto,
                })
              }
            })
            .catch(() => {})
        )
      }
      fetchsSecundarios.push(
        fetch(`/api/presupuestos/${presupuestoIdProp}/portal`)
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.url) setUrlPortalReal(data.url) })
          .catch(() => {})
      )

      // Contar re-emisiones desde chatter si el presupuesto fue re-emitido
      if (pres.fecha_emision_original) {
        fetchsSecundarios.push(
          fetch(`/api/chatter?entidad_tipo=presupuesto&entidad_id=${presupuestoIdProp}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.entradas) {
                const count = (data.entradas as { metadata?: { accion?: string } }[])
                  .filter(e => e.metadata?.accion === 're_emision').length
                setCantidadReEmisiones(count)
              }
            })
            .catch(() => {})
        )
      }

      Promise.all(fetchsSecundarios)
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
          id: data.id, nombre: data.nombre, apellido: data.apellido,
          correo: data.correo, telefono: data.telefono,
          whatsapp: data.whatsapp || null, codigo: data.codigo || '',
          tipo_contacto: data.tipo_contacto || null,
          numero_identificacion: data.numero_identificacion || null,
          datos_fiscales: data.datos_fiscales || null,
          condicion_iva: data.datos_fiscales?.condicion_iva || null,
          direcciones: data.direcciones || [],
        })
        setVinculaciones(data.vinculaciones || [])
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoIdInicial])

  // ─── Cargar canales de correo y plantillas de la empresa ─────────────────
  useEffect(() => {
    fetch('/api/correo/canales?modulo=presupuestos')
      .then(r => r.json())
      .then(data => {
        const canales = (data.canales || [])
          .filter((c: { activo: boolean }) => c.activo)
          .map((c: { id: string; nombre: string; proveedor: string; config_conexion: Record<string, string> }) => ({
            id: c.id, nombre: c.nombre,
            email: c.config_conexion?.email || c.config_conexion?.usuario || c.nombre,
            predeterminado: false,
          }))
        const porTipo = canales.find((c: { _predeterminado_tipo?: boolean }) => c._predeterminado_tipo)
        const principal = canales.find((c: { es_principal?: boolean }) => c.es_principal)
        const elegido = porTipo || principal || canales[0]
        if (elegido) elegido.predeterminado = true
        setCanalesCorreo(canales)
      })
      .catch(() => {})

    fetch('/api/correo/plantillas')
      .then(r => r.json())
      .then(data => {
        const todas = data.plantillas || []
        const pls = todas.map((p: { id: string; nombre: string; asunto: string; contenido_html: string; canal_id?: string; creado_por?: string; disponible_para?: string }) => ({
          id: p.id, nombre: p.nombre, asunto: p.asunto || '',
          contenido_html: p.contenido_html || '', canal_id: p.canal_id || null,
          creado_por: p.creado_por || '',
          disponible_para: (p.disponible_para || 'todos') as 'todos' | 'roles' | 'usuarios',
        }))
        setPlantillasCorreo(pls)
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
    fetch('/api/correo/plantillas')
      .then(r => r.json())
      .then(data => {
        const todas = data.plantillas || []
        const pls = todas.map((p: { id: string; nombre: string; asunto: string; contenido_html: string; canal_id?: string; creado_por?: string; disponible_para?: string }) => ({
          id: p.id, nombre: p.nombre, asunto: p.asunto || '',
          contenido_html: p.contenido_html || '', canal_id: p.canal_id || null,
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
        actividad_origen_id: actividadOrigenId || undefined,
        lineas: lineasRef.current.filter(l => l.descripcion || l.codigo_producto).map(l => ({
          tipo_linea: l.tipo_linea, orden: l.orden, codigo_producto: l.codigo_producto,
          descripcion: l.descripcion, descripcion_detalle: l.descripcion_detalle,
          cantidad: l.cantidad, unidad: l.unidad, precio_unitario: l.precio_unitario,
          descuento: l.descuento, impuesto_label: l.impuesto_label,
          impuesto_porcentaje: l.impuesto_porcentaje, monto: l.monto,
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
        if (presupuestoCreado.numero !== numeroOptimista) {
          setNumeroPresupuesto(presupuestoCreado.numero)
        }
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

  const promesasPendientesRef = useRef<Set<Promise<void>>>(new Set())
  const debounceLineasRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const registrarPromesa = useCallback((p: Promise<void>) => {
    promesasPendientesRef.current.add(p)
    p.finally(() => promesasPendientesRef.current.delete(p))
  }, [])
  const enviarPatchLineaRef = useRef<(lineaId: string) => void>(() => {})
  const esperarGuardados = useCallback(async () => {
    // Forzar envío de líneas con debounce pendiente
    for (const [lineaId, timeout] of debounceLineasRef.current.entries()) {
      clearTimeout(timeout)
      debounceLineasRef.current.delete(lineaId)
      enviarPatchLineaRef.current(lineaId)
    }
    // Esperar a que todas las promesas terminen
    await Promise.all(Array.from(promesasPendientesRef.current))
  }, [])

  const autoguardar = useCallback((campos: Record<string, unknown>) => {
    const pid = presupuestoIdRef.current
    if (!pid) return

    const cambios: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(campos)) {
      const anterior = guardadoRef.current[clave]
      if (JSON.stringify(valor) !== JSON.stringify(anterior)) {
        cambios[clave] = valor
      }
    }
    if (Object.keys(cambios).length === 0) return

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
    // Actualización optimista: cambiar UI al instante
    const estadoAnterior = presupuesto?.estado
    setPresupuesto(prev => prev ? { ...prev, estado: nuevoEstado } : null)
    try {
      const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (res.ok) {
        const actualizado = await res.json()
        setPresupuesto(prev => prev ? { ...prev, ...actualizado } : null)
      } else {
        // Revertir si falló
        setPresupuesto(prev => prev ? { ...prev, estado: estadoAnterior || prev.estado } : null)
      }
    } catch {
      setPresupuesto(prev => prev ? { ...prev, estado: estadoAnterior || prev.estado } : null)
    }
  }

  // ─── Wrapper: interceptar cambio de estado si el presupuesto está vencido ──
  const estadosDeAvance: EstadoPresupuesto[] = ['enviado', 'confirmado_cliente', 'orden_venta']

  const cambiarEstadoConValidacion = (nuevoEstado: EstadoPresupuesto) => {
    // Solo validar vencimiento en estados de avance, no al volver a borrador o cancelar
    if (estadosDeAvance.includes(nuevoEstado)) {
      const fVenc = presupuesto?.fecha_vencimiento || fechaVenc.toISOString()
      const vencida = new Date(fVenc) < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')
      if (vencida) {
        // Proponer nueva fecha: hoy + días de validez actuales
        const hoy = new Date()
        const nueva = new Date(hoy)
        nueva.setDate(nueva.getDate() + diasVencimiento)
        setModalVencimiento({
          estadoPendiente: nuevoEstado,
          nuevaFecha: nueva.toISOString().split('T')[0],
        })
        return
      }
    }
    cambiarEstado(nuevoEstado)
  }

  const confirmarVencimientoYCambiarEstado = async () => {
    if (!modalVencimiento) return
    const { estadoPendiente, nuevaFecha } = modalVencimiento
    // Actualizar la fecha de vencimiento primero
    autoguardar({ fecha_vencimiento: nuevaFecha + 'T00:00:00.000Z' })
    setPresupuesto(prev => prev ? { ...prev, fecha_vencimiento: nuevaFecha + 'T00:00:00.000Z' } : null)
    setModalVencimiento(null)
    // Luego cambiar estado
    await cambiarEstado(estadoPendiente)
  }

  // ─── Descartar/eliminar presupuesto ─────────────────────────────────────

  const descartarPresupuesto = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (pid) {
      try {
        const res = await fetch(`/api/presupuestos/${pid}`, { method: 'DELETE' })
        const data = await res.json()
        if (modo === 'editar' && data.accion === 'cancelado') {
          setPresupuesto(prev => prev ? { ...prev, estado: 'cancelado' } : null)
          return
        }
      } catch { /* silenciar */ }
    }
    if (productosProvisionales.length > 0) {
      Promise.all(productosProvisionales.map(id =>
        fetch(`/api/productos/${id}`, { method: 'DELETE' })
      )).catch(() => {})
      setProductosProvisionales([])
    }
    onDescartado?.()
    // Si vino desde el dashboard, volver ahí
    const desde = new URLSearchParams(window.location.search).get('desde')
    router.push(desde === 'dashboard' ? '/dashboard' : '/presupuestos')
  }, [modo, router, onDescartado, productosProvisionales])

  // ─── Contacto: seleccionar y limpiar (modo crear) ──────────────────────

  const seleccionarContacto = useCallback(async (contacto: ContactoResumido) => {
    setContactoId(contacto.id)
    setContactoSeleccionado(contacto)
    setAtencionId(null)
    setAtencionSeleccionada(null)
    contactoIdRef.current = contacto.id

    try {
      const res = await fetch(`/api/contactos/${contacto.id}`)
      const data = await res.json()
      setVinculaciones(data.vinculaciones || [])
    } catch {
      setVinculaciones([])
    }

    crearPresupuesto()
  }, [crearPresupuesto])

  const limpiarContacto = useCallback(() => {
    setContactoId(null)
    setContactoSeleccionado(null)
    setVinculaciones([])
    setAtencionId(null)
    setAtencionSeleccionada(null)
  }, [])

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
          const lista = Array.isArray(nuevas) ? nuevas : [nuevas]
          setLineas(prev => [...prev, ...lista])
          if (lista[0]?.id) setLineaRecienAgregada(lista[0].id)
          if (modo === 'editar') recargarTotalesRef.current()
        }
      } catch { /* silenciar */ }
    } else {
      const idTemp = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const nuevaLinea: LineaTemporal = {
        _temp: true,
        id: idTemp,
        tipo_linea: tipo, orden: lineas.length, codigo_producto: null,
        descripcion: tipo === 'seccion' ? '' : null, descripcion_detalle: null,
        cantidad: '1', unidad: null, precio_unitario: '0', descuento: '0',
        impuesto_label: tipo === 'producto' && impDefault ? impDefault.label : null,
        impuesto_porcentaje: tipo === 'producto' && impDefault ? String(impDefault.porcentaje) : '0',
        subtotal: '0', impuesto_monto: '0', total: '0',
        monto: tipo === 'descuento' ? '0' : null,
      }
      setLineas(prev => [...prev, nuevaLinea])
      setLineaRecienAgregada(idTemp)
    }
  }, [lineas.length, config, modo])

  // ─── Asistente IA: aplicar líneas propuestas ───
  const aplicarLineasIA = useCallback(async (lineasIA: LineaPropuestaIA[]) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const pid = presupuestoIdRef.current

    for (const lineaIA of lineasIA) {
      const imp = lineaIA.impuesto_id ? impuestos.find(i => i.id === lineaIA.impuesto_id) : null
      const impDefault = impuestos.find(i => i.activo && i.predeterminado) || impuestos.find(i => i.activo && i.porcentaje > 0)
      const impFinal = imp || impDefault

      if (pid) {
        try {
          const res = await fetch(`/api/presupuestos/${pid}/lineas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo_linea: 'producto',
              codigo_producto: lineaIA.referencia_interna || lineaIA.codigo || null,
              descripcion: lineaIA.nombre,
              descripcion_detalle: lineaIA.descripcion_editada || lineaIA.descripcion_venta || null,
              cantidad: '1', unidad: lineaIA.unidad || null, precio_unitario: '0',
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
        const nuevaLinea: LineaTemporal = {
          _temp: true,
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tipo_linea: 'producto', orden: lineas.length,
          codigo_producto: lineaIA.referencia_interna || lineaIA.codigo || null,
          descripcion: lineaIA.nombre,
          descripcion_detalle: lineaIA.descripcion_editada || lineaIA.descripcion_venta || null,
          cantidad: '1', unidad: lineaIA.unidad || null, precio_unitario: '0',
          descuento: '0',
          impuesto_label: impFinal ? impFinal.label : null,
          impuesto_porcentaje: impFinal ? String(impFinal.porcentaje) : '0',
          subtotal: '0', impuesto_monto: '0', total: '0', monto: null,
        }
        setLineas(prev => [...prev, nuevaLinea])
      }
    }

    if (pid && modo === 'editar') recargarTotalesRef.current()
  }, [config, lineas.length, modo])

  // ─── Asistente IA: crear servicio nuevo en catálogo ───
  const crearServicioDesdeIA = useCallback(async (linea: LineaPropuestaIA): Promise<{ codigo: string; id: string } | null> => {
    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: linea.nombre, tipo: 'servicio',
          categoria: linea.categoria_sugerida || null,
          referencia_interna: linea.codigo || null,
          descripcion_venta: linea.descripcion_editada || linea.descripcion_venta || null,
          unidad: linea.unidad || 'unidad', puede_venderse: true,
          origen: 'asistente_salix', es_provisorio: true,
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

  // Debounce por línea para agrupar cambios rápidos (ej. al seleccionar producto del catálogo
  // que dispara 5-6 onEditar seguidos) en un solo PATCH al backend
  const lineasRefActual = useRef(lineas)
  lineasRefActual.current = lineas

  const recargarTotalesRef = useRef<() => Promise<void>>(async () => {})
  const enviarPatchLinea = useCallback((lineaId: string) => {
    const pid = presupuestoIdRef.current
    if (!pid) return
    const lineaActualizada = lineasRefActual.current.find(l => l.id === lineaId)
    if (!lineaActualizada) return
    const p = fetch(`/api/presupuestos/${pid}/lineas`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lineaActualizada, id: lineaId }),
    }).then(() => { if (modo === 'editar') recargarTotalesRef.current() }).catch(() => {})
    registrarPromesa(p)
  }, [modo, registrarPromesa])
  enviarPatchLineaRef.current = enviarPatchLinea

  const editarLinea = useCallback((lineaId: string, campo: string, valor: string) => {
    setLineas(prev => {
      return prev.map(l => {
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
    })

    // Debounce: esperar 150ms para agrupar múltiples ediciones rápidas en un solo PATCH
    const prevTimeout = debounceLineasRef.current.get(lineaId)
    if (prevTimeout) clearTimeout(prevTimeout)
    debounceLineasRef.current.set(lineaId, setTimeout(() => {
      debounceLineasRef.current.delete(lineaId)
      enviarPatchLinea(lineaId)
    }, 150))
  }, [enviarPatchLinea])

  const eliminarLinea = useCallback(async (lineaId: string) => {
    setLineas(prev => prev.filter(l => l.id !== lineaId))
    const pid = presupuestoIdRef.current
    if (pid) {
      await fetch(`/api/presupuestos/${pid}/lineas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea_id: lineaId }),
      })
      if (modo === 'editar') recargarTotalesRef.current()
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

  // ─── Catálogo: almacenar originales, actualizar, revertir ───────────────

  const registrarOriginalCatalogo = useCallback((lineaId: string, producto: { id: string; nombre: string; descripcion_venta: string | null }) => {
    setOriginalesCatalogo(prev => {
      const nuevo = new Map(prev)
      nuevo.set(lineaId, { producto_id: producto.id, nombre: producto.nombre, descripcion_venta: producto.descripcion_venta })
      return nuevo
    })
  }, [])

  const actualizarCatalogo = useCallback(async (lineaId: string) => {
    const original = originalesCatalogo.get(lineaId)
    if (!original) return
    const linea = lineasRefActual.current.find(l => l.id === lineaId)
    if (!linea) return

    const cambios: Record<string, string | null> = {}
    if ((linea.descripcion || '') !== original.nombre) cambios.nombre = linea.descripcion || ''
    if (linea.descripcion_detalle !== undefined) cambios.descripcion_venta = linea.descripcion_detalle

    if (Object.keys(cambios).length === 0) return

    const res = await fetch(`/api/productos/${original.producto_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    })
    if (res.ok) {
      // Actualizar originales para que la barra desaparezca
      setOriginalesCatalogo(prev => {
        const nuevo = new Map(prev)
        nuevo.set(lineaId, {
          ...original,
          nombre: linea.descripcion || original.nombre,
          descripcion_venta: linea.descripcion_detalle ?? original.descripcion_venta,
        })
        return nuevo
      })
      mostrarToast('exito', 'Producto actualizado en el catálogo')
    } else {
      mostrarToast('error', 'Error al actualizar el catálogo')
    }
  }, [originalesCatalogo, mostrarToast])

  const revertirCatalogo = useCallback((lineaId: string) => {
    const original = originalesCatalogo.get(lineaId)
    if (!original) return
    editarLinea(lineaId, 'descripcion', original.nombre)
    if (original.descripcion_venta !== null) {
      editarLinea(lineaId, 'descripcion_detalle', original.descripcion_venta)
    }
  }, [originalesCatalogo, editarLinea])

  const puedeEditarProductos = tienePermiso('productos', 'editar')

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
  recargarTotalesRef.current = recargarTotales

  // ─── Guardar todo el estado actual (para PDF y acciones críticas) ────────

  const guardarTodo = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (!pid) return
    await esperarGuardados()
    const camposActuales: Record<string, unknown> = {
      notas_html: notasHtml, condiciones_html: condicionesHtml,
      referencia, moneda, condicion_pago_id: condicionPagoId,
      dias_vencimiento: diasVencimiento, fecha_emision: fechaEmision,
      columnas_lineas: columnasVisibles,
    }
    const cambios: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(camposActuales)) {
      if (JSON.stringify(valor) !== JSON.stringify(guardadoRef.current[clave])) {
        cambios[clave] = valor
      }
    }
    if (Object.keys(cambios).length === 0) return
    Object.assign(guardadoRef.current, cambios)
    await fetch(`/api/presupuestos/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    }).catch(() => {})
  }, [esperarGuardados, notasHtml, condicionesHtml, referencia, moneda, condicionPagoId, diasVencimiento, fechaEmision, columnasVisibles])

  // ─── Acciones de estado (modo editar) ───────────────────────────────────

  const handleEnviar = () => {
    setSnapshotCorreo(null)
    setModalEnviarAbierto(true)
    if (idPresupuesto) {
      guardarTodo().then(async () => {
        // 1. Generar/actualizar PDF normal (con ediciones actuales)
        try {
          const resPdf = await fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forzar: true }),
          })
          const dataPdf = await resPdf.json()
          if (dataPdf.url) {
            setPresupuesto(prev => prev ? { ...prev, pdf_url: dataPdf.url } : null)
          }
        } catch { /* silenciar */ }

        // 2. Congelar copia del PDF actualizado (sin Puppeteer, solo copia en Storage)
        try {
          const resCongelado = await fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ congelado: true }),
          })
          const dataCongelado = await resCongelado.json()
          if (dataCongelado.url) setPdfCongeladoUrl(dataCongelado.url)
        } catch { /* silenciar */ }

        // 3. Generar enlace portal en paralelo
        try {
          const resPortal = await fetch(`/api/presupuestos/${idPresupuesto}/portal`, { method: 'POST' })
          const dataPortal = await resPortal.json()
          if (dataPortal.url) setUrlPortalReal(dataPortal.url)
        } catch { /* silenciar */ }
      })
    }
  }

  const handleEnviarCorreo = useCallback(async (datos: DatosEnvioDocumento) => {
    const estadoActual = presupuesto?.estado || 'borrador'
    if (estadoActual === 'borrador') {
      await cambiarEstado('enviado') // El envío no bloquea por vencimiento — el correo siempre debe salir
    }

    // Si nunca se congeló un PDF en el chatter, guardar la versión actual como "versión original"
    const pid = presupuestoIdRef.current
    if (pid && pdfCongeladoUrl) {
      try {
        const resChatter = await fetch(`/api/chatter?entidad_tipo=presupuesto&entidad_id=${pid}`)
        if (resChatter.ok) {
          const dataChatter = await resChatter.json()
          const tieneAdjuntoPdf = (dataChatter.entradas || []).some(
            (e: { adjuntos?: { tipo?: string }[] }) => e.adjuntos?.some(a => a.tipo === 'application/pdf')
          )
          if (!tieneAdjuntoPdf) {
            const numPresup = presupuestoRef.current?.numero || ''
            await fetch('/api/chatter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entidad_tipo: 'presupuesto', entidad_id: pid, tipo: 'sistema',
                contenido: 'Versión original del documento archivada',
                adjuntos: [{
                  url: pdfCongeladoUrl,
                  nombre: numPresup ? `${numPresup}_original.pdf` : 'version_original.pdf',
                  tipo: 'application/pdf',
                }],
                metadata: { accion: 'pdf_generado' },
              }),
            })
          }
        }
      } catch { /* silenciar */ }
    }

    const nombreContactoCorreo = atencionSeleccionada
      ? `${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()
      : contactoSeleccionado
        ? `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim()
        : presupuesto?.contacto_nombre
          ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
          : ''

    const numDoc = numeroPresupuesto || presupuesto?.numero || ''
    const etiqueta = t('documentos.tipos.presupuesto')

    const htmlFinal = construirHtmlCorreoDocumento({
      htmlCuerpo: datos.html,
      incluirPortal: datos.incluir_enlace_portal,
      portal: urlPortalReal ? {
        url: urlPortalReal, etiquetaTipo: etiqueta,
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
          pdf_url: pdfCongeladoUrl || presupuestoRef.current?.pdf_url || undefined,
          pdf_nombre: presupuestoRef.current?.pdf_nombre_archivo || (presupuestoRef.current?.numero ? `${presupuestoRef.current.numero}.pdf` : undefined),
          pdf_congelado_url: pdfCongeladoUrl || undefined,
          tipo: 'nuevo', programado_para: datos.programado_para,
          entidad_tipo: 'presupuesto', entidad_id: idPresupuesto,
        }),
      })
      if (res.ok) setModalEnviarAbierto(false)
      return
    }

    setModalEnviarAbierto(false)

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
          pdf_url: pdfCongeladoUrl || pres?.pdf_url || undefined,
          pdf_nombre: pres?.numero ? `${pres.numero}.pdf` : undefined,
          pdf_congelado_url: pdfCongeladoUrl || undefined,
          tipo: 'nuevo',
          entidad_tipo: 'presupuesto', entidad_id: idPresupuesto,
        }),
      })
    }

    const snapshot = datos._snapshot || null
    setSnapshotCorreo(snapshot)

    const descripcionToast = `Para: ${datos.correo_para[0]} — ${datos.asunto || '(Sin asunto)'}`

    programarEnvio(enviarFn, {
      descripcion: descripcionToast,
      onDeshacer: () => {
        setSnapshotCorreo(snapshot)
        setModalEnviarAbierto(true)
        if (estadoActual === 'borrador') {
          cambiarEstado('borrador').catch(() => {})
        }
      },
    })
  }, [presupuesto?.estado, presupuesto?.numero, presupuesto?.contacto_nombre, presupuesto?.contacto_apellido, cambiarEstado, atencionSeleccionada, contactoSeleccionado, numeroPresupuesto, idPresupuesto, empresa?.color_marca, empresa?.nombre, datosEmpresa, t, programarEnvio, pdfCongeladoUrl])

  const handleGuardarBorrador = useCallback(async (datos: DatosBorradorCorreo) => {
    if (idPresupuesto) {
      try { localStorage.setItem(`borrador_correo_${idPresupuesto}`, JSON.stringify(datos)) } catch { /* silenciar */ }
    }
    setModalEnviarAbierto(false)
  }, [idPresupuesto])

  const handleGuardarPlantilla = useCallback(async (datos: DatosPlantillaCorreo) => {
    try {
      await fetch('/api/correo/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.nombre, asunto: datos.asunto,
          contenido: datos.contenido_html.replace(/<[^>]+>/g, '').trim(),
          contenido_html: datos.contenido_html,
          modulos: ['presupuestos'], disponible_para: 'usuarios',
        }),
      })
      recargarPlantillasCorreo()
    } catch (err) {
      console.error('Error al guardar plantilla:', err)
    }
  }, [recargarPlantillasCorreo])

  const handleEnviarProforma = () => { /* pendiente: integrar proforma */ }
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [deshacerReEmision, setDeshacerReEmision] = useState<(() => Promise<void>) | null>(null)
  const [confirmarReEmision, setConfirmarReEmision] = useState(false)
  const [cantidadReEmisiones, setCantidadReEmisiones] = useState(0)
  const [modalVencimiento, setModalVencimiento] = useState<{ estadoPendiente: EstadoPresupuesto; nuevaFecha: string } | null>(null)
  const handleImprimir = async () => {
    if (!idPresupuesto || generandoPdf) return
    setGenerandoPdf(true)
    try {
      await guardarTodo()
      // Generar/actualizar el PDF
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
      const { nombre_archivo } = await res.json()
      // Abrir el PDF vía proxy — el nombre del archivo va como último segmento de la URL
      // para que Chrome lo use en el diálogo de impresión y "Guardar como"
      const nombreUrl = encodeURIComponent(nombre_archivo || `${presupuesto?.numero || 'Presupuesto'}.pdf`)
      window.open(`/api/presupuestos/${idPresupuesto}/pdf/archivo/${nombreUrl}`, '_blank')
    } catch {
      alert('Error al generar el PDF')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const ejecutarReEmision = useCallback(async () => {
    const pid = presupuestoIdRef.current
    if (!pid) return
    setConfirmarReEmision(false)

    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const dias = diasVencimientoRef.current
    const venc = new Date(hoy)
    venc.setDate(venc.getDate() + dias)
    const vencStr = venc.toISOString()

    const fechaOriginal = presupuesto?.fecha_emision_original || presupuesto?.fecha_emision || fechaEmision
    const fechaAnterior = presupuesto?.fecha_emision || fechaEmision
    const fechaVencAnterior = presupuesto?.fecha_vencimiento || vencStr
    const esPrimeraReEmision = !presupuesto?.fecha_emision_original

    let numReEmision = 1
    try {
      const resChatter = await fetch(`/api/chatter?entidad_tipo=presupuesto&entidad_id=${pid}`)
      if (resChatter.ok) {
        const dataChatter = await resChatter.json()
        numReEmision = ((dataChatter.entradas || []).filter((e: { metadata?: { accion?: string } }) => e.metadata?.accion === 're_emision').length) + 1
      }
    } catch { /* silenciar */ }

    // Congelar PDF de la versión anterior antes de cambiar fechas
    let pdfAnteriorUrl: string | null = null
    try {
      const resPdf = await fetch(`/api/presupuestos/${pid}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ congelado: true, forzar: true }),
      })
      if (resPdf.ok) {
        const dataPdf = await resPdf.json()
        if (dataPdf.url) pdfAnteriorUrl = dataPdf.url
      }
    } catch { /* silenciar */ }

    setFechaEmision(hoyStr)

    // Cambiar estado a borrador para permitir edición
    await cambiarEstado('borrador')

    autoguardar({
      fecha_emision: hoyStr,
      fecha_vencimiento: vencStr,
      ...(!presupuesto?.fecha_emision_original ? { fecha_emision_original: fechaOriginal } : {}),
    })

    const fmtFecha = (f: string) => formato.fecha(f)
    const numPresup = presupuestoRef.current?.numero || ''
    try {
      // Adjuntar PDF congelado de la versión anterior al chatter
      const adjuntos = pdfAnteriorUrl ? [{
        url: pdfAnteriorUrl,
        nombre: numPresup ? `${numPresup}_v${numReEmision - 1 || 'anterior'}.pdf` : 'version_anterior.pdf',
        tipo: 'application/pdf',
      }] : undefined

      await fetch('/api/chatter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidad_tipo: 'presupuesto', entidad_id: pid, tipo: 'sistema',
          contenido: `Re-emisión ${numReEmision} — Emisión anterior: ${fmtFecha(fechaAnterior)} → Nueva: ${fmtFecha(hoyStr)}`,
          adjuntos,
          metadata: {
            accion: 're_emision', numero_re_emision: numReEmision,
            fecha_emision_anterior: fechaAnterior, fecha_emision_nueva: hoyStr,
          },
        }),
      })
    } catch { /* silenciar */ }

    // Actualizar el conteo visible de re-emisiones
    setCantidadReEmisiones(numReEmision)

    // Deshacer: restaurar fechas y estado anteriores
    const estadoPrevio = presupuesto?.estado || 'borrador'
    const deshacer = async () => {
      setFechaEmision(fechaAnterior)
      if (estadoPrevio !== 'borrador') {
        await cambiarEstado(estadoPrevio)
      }
      const datosRestaurar: Record<string, unknown> = {
        fecha_emision: fechaAnterior,
        fecha_vencimiento: fechaVencAnterior,
      }
      if (esPrimeraReEmision) {
        datosRestaurar.fecha_emision_original = null
      }
      autoguardar(datosRestaurar)
    }
    setDeshacerReEmision(() => deshacer)
  }, [presupuesto?.fecha_emision_original, presupuesto?.fecha_emision, presupuesto?.fecha_vencimiento, presupuesto?.estado, fechaEmision, autoguardar, cambiarEstado])

  const handleReEmitir = useCallback(() => {
    setConfirmarReEmision(true)
  }, [])

  // Generar orden de trabajo desde este presupuesto
  const [generandoOT, setGenerandoOT] = useState(false)
  const handleGenerarOT = useCallback(async () => {
    if (!idPresupuesto || generandoOT) return
    setGenerandoOT(true)
    try {
      const res = await fetch('/api/ordenes/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_id: idPresupuesto }),
      })
      if (!res.ok) {
        const err = await res.json()
        mostrarToast('error', err.error || 'Error al generar orden de trabajo')
        return
      }
      const data = await res.json()
      mostrarToast('exito', `Orden de trabajo ${data.orden?.numero} generada`)
      router.push(`/ordenes/${data.orden?.id}`)
    } catch {
      mostrarToast('error', 'Error al generar orden de trabajo')
    } finally {
      setGenerandoOT(false)
    }
  }, [idPresupuesto, generandoOT, mostrarToast, router])

  const handleVistaPrevia = async () => {
    const pid = idPresupuesto
    if (!pid) return
    try {
      await guardarTodo()
      // Regenerar PDF solo si hay cambios (forzar: false usa caché inteligente)
      await fetch(`/api/presupuestos/${pid}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forzar: false }),
      }).catch(() => {})

      const res = await fetch(`/api/presupuestos/${pid}/portal`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data.token) {
        // Clipboard: siempre la URL oficial del backend (dominio de producción)
        if (data.url) await navigator.clipboard.writeText(data.url).catch(() => {})
        // Abrir: usar origin del navegador para que funcione en cualquier puerto local
        window.open(`${window.location.origin}/portal/${data.token}`, '_blank')
      }
    } catch { /* silenciar */ }
  }

  const handleRegenerarPdf = async () => {
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
  }

  // ─── Cálculos derivados ─────────────────────────────────────────────────

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

  // Detectar si la plantilla cargada fue modificada
  const plantillaModificada = useMemo(() => {
    if (!plantillaId) return false
    const tpl = ((config?.plantillas || []) as Array<{ id: string; moneda?: string; condicion_pago_id?: string; dias_vencimiento?: number; lineas?: unknown[]; notas_html?: string; condiciones_html?: string }>).find(p => p.id === plantillaId)
    if (!tpl) return false
    if (tpl.moneda && tpl.moneda !== moneda) return true
    if (tpl.condicion_pago_id && tpl.condicion_pago_id !== condicionPagoId) return true
    if (tpl.dias_vencimiento !== undefined && tpl.dias_vencimiento !== diasVencimiento) return true
    if ((tpl.notas_html || '') !== (notasHtml || '')) return true
    if ((tpl.condiciones_html || '') !== (condicionesHtml || '')) return true
    const tplLineasLen = Array.isArray(tpl.lineas) ? tpl.lineas.length : 0
    if (tplLineasLen !== lineas.length) return true
    return false
  }, [plantillaId, config?.plantillas, moneda, condicionPagoId, diasVencimiento, notasHtml, condicionesHtml, lineas.length])

  const simbolo = new Intl.NumberFormat(formato.locale, { style: 'currency', currency: moneda || formato.codigoMoneda, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(p => p.type === 'currency')?.value || '$'
  const fmt = (v: string | number) => {
    const num = typeof v === 'number' ? v : parseFloat(v || '0')
    return new Intl.NumberFormat(formato.locale, {
      style: 'currency', currency: moneda || formato.codigoMoneda,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(num)
  }

  const condiciones = (config?.condiciones_pago || []) as CondicionPago[]
  const monedas = (config?.monedas || []) as { id: string; label: string; simbolo: string; activo: boolean }[]
  const impuestosList = (config?.impuestos || []) as Impuesto[]
  const unidadesList = (config?.unidades || []) as UnidadMedida[]

  const estadoActual = (presupuesto?.estado || 'borrador') as EstadoPresupuesto
  const esEditable = modo === 'crear' || estadoActual === 'borrador'
  const estadosPosibles = modo === 'editar' ? (TRANSICIONES_ESTADO[estadoActual] || []) : []
  const estaCancelado = modo === 'editar' && estadoActual === 'cancelado'

  const fechaVenc = (() => {
    const f = new Date(fechaEmision)
    f.setDate(f.getDate() + diasVencimiento)
    return f
  })()

  const bloqueada = !!(config as Record<string, unknown> | null)?.validez_bloqueada

  // ─── Loading state (solo modo editar) ───────────────────────────────────

  if (cargando || (modo === 'editar' && (!presupuesto || !config))) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 py-6">
        <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-borde-sutil animate-pulse">
            <div className="h-8 w-48 bg-superficie-app rounded-card mb-3" />
            <div className="h-5 w-32 bg-superficie-app rounded-card" />
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
      chatterLateral
        ? 'max-w-[1600px] flex gap-3 items-start grupo-doc-chatter-lateral'
        : 'max-w-[1200px] space-y-3 grupo-doc-chatter-stacked'
    }`}>
      {/* ─── Contenido principal (se comprime cuando chatter está lateral) ─── */}
      <div className={`space-y-5 ${chatterLateral ? 'flex-1 min-w-0' : ''}`}>
      {/* ─── Contenedor principal ─── */}
      <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil overflow-hidden">

        {/* ─── Cabecera ─── */}
        <CabeceraPresupuesto
          modo={modo}
          titulo={titulo}
          estadoActual={estadoActual}
          esEditable={esEditable}
          estaCancelado={estaCancelado}
          estadosPosibles={estadosPosibles}
          guardando={guardando}
          generandoPdf={generandoPdf}
          contactoId={contactoId}
          idPresupuesto={idPresupuesto}
          presupuestoIdCreado={presupuestoIdCreado}
          fechaEmision={fechaEmision}
          presupuestoFechaEmision={presupuesto?.fecha_emision}
          cantidadReEmisiones={cantidadReEmisiones}
          onGuardar={() => autoguardar({})}
          onDescartar={descartarPresupuesto}
          onRegenerarPdf={handleRegenerarPdf}
          onCambiarEstado={cambiarEstadoConValidacion}
          onEnviar={handleEnviar}
          onEnviarProforma={handleEnviarProforma}
          onImprimir={handleImprimir}
          onVistaPrevia={handleVistaPrevia}
          onReEmitir={handleReEmitir}
          onCrearPresupuesto={crearPresupuesto}
          onGenerarOT={handleGenerarOT}
          generandoOT={generandoOT}
        />

        {/* ─── Banner deshacer re-emisión ─── */}
        {deshacerReEmision && (
          <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-insignia-advertencia/10 border-b border-insignia-advertencia/20">
            <p className="text-sm text-insignia-advertencia">Se re-emitió el presupuesto con la fecha de hoy</p>
            <div className="flex items-center gap-2 shrink-0">
              <Boton
                variante="fantasma"
                tamano="xs"
                onClick={async () => {
                  await deshacerReEmision()
                  setDeshacerReEmision(null)
                }}
              >
                Deshacer
              </Boton>
              <Boton variante="fantasma" tamano="xs" onClick={() => setDeshacerReEmision(null)} className="text-texto-terciario">
                Cerrar
              </Boton>
            </div>
          </div>
        )}

        {/* ─── Banner de bloqueo (solo modo editar, si no es editable) ─── */}
        {modo === 'editar' && !esEditable && (
          <BannerBloqueo
            estadoActual={estadoActual}
            estadosPosibles={estadosPosibles}
            onCambiarEstado={cambiarEstado}
          />
        )}

        {/* ─── EMISOR ─── */}
        <SeccionEmisor
          datosEmpresa={datosEmpresa}
          nombreEmpresa={empresa?.nombre || ''}
        />

        {/* ─── CLIENTE + DATOS DEL PRESUPUESTO (grid plano) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 px-6 pb-3 border-b border-borde-sutil">

          {/* ── Columna izquierda: Cliente + Dirigido a ── */}
          <SeccionCliente
            modo={modo}
            esEditable={esEditable}
            contactoSeleccionado={contactoSeleccionado}
            vinculaciones={vinculaciones}
            atencionId={atencionId}
            atencionSeleccionada={atencionSeleccionada}
            presupuesto={presupuesto}
            idPresupuesto={idPresupuesto}
            onSeleccionarContacto={seleccionarContacto}
            onLimpiarContacto={limpiarContacto}
            onSeleccionarAtencion={seleccionarAtencion}
            onCambiarContactoEditar={async (c) => {
              if (c) {
                const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contacto_id: c.id, atencion_contacto_id: null, atencion_nombre: null, atencion_correo: null }),
                })
                if (res.ok) {
                  const act = await res.json()
                  setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                  setContactoId(c.id)
                  setContactoSeleccionado(c as ContactoResumido)
                  setAtencionId(null)
                  setAtencionSeleccionada(null)
                  fetch(`/api/contactos/${c.id}`)
                    .then(r => r.json())
                    .then(data => setVinculaciones(data.vinculaciones || []))
                    .catch(() => {})
                }
              } else {
                const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contacto_id: null, atencion_contacto_id: null, atencion_nombre: null, atencion_correo: null }),
                })
                if (res.ok) {
                  const act = await res.json()
                  setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                  setContactoId(null)
                  setContactoSeleccionado(null)
                  setVinculaciones([])
                  setAtencionId(null)
                  setAtencionSeleccionada(null)
                }
              }
            }}
            onCambiarAtencionEditar={(vincId, vinculado, datosAutoguardar) => {
              if (datosAutoguardar) {
                autoguardar(datosAutoguardar)
                if (vincId) {
                  // Seleccionar
                  setPresupuesto(prev => prev ? {
                    ...prev,
                    atencion_contacto_id: vincId,
                    atencion_nombre: datosAutoguardar.atencion_nombre as string,
                    atencion_correo: datosAutoguardar.atencion_correo as string,
                  } : null)
                } else {
                  // Limpiar
                  setPresupuesto(prev => prev ? {
                    ...prev,
                    atencion_contacto_id: null,
                    atencion_nombre: null,
                    atencion_correo: null,
                  } : null)
                }
              }
              setAtencionId(vincId)
              setAtencionSeleccionada(vinculado)
            }}
            onSeleccionarConDirigidoA={async (padre, hijoId) => {
              await seleccionarContacto(padre)
              try {
                const res = await fetch(`/api/contactos/${hijoId}`)
                const hijo = await res.json()
                if (hijo) {
                  setAtencionId(hijo.id)
                  setAtencionSeleccionada({
                    id: hijo.id, nombre: hijo.nombre, apellido: hijo.apellido,
                    correo: hijo.correo, telefono: hijo.telefono,
                    whatsapp: hijo.whatsapp || null, tipo_contacto: hijo.tipo_contacto,
                  })
                }
              } catch { /* silenciar */ }
            }}
          />

          {/* ── Columna derecha: Datos del presupuesto ── */}
          <SeccionDatosPresupuesto
            modo={modo}
            esEditable={esEditable}
            referencia={referencia}
            fechaEmision={fechaEmision}
            diasVencimiento={diasVencimiento}
            condicionPagoId={condicionPagoId}
            moneda={moneda}
            plantillaId={plantillaId}
            config={config}
            presupuesto={presupuesto}
            condiciones={condiciones}
            monedas={monedas}
            totalDocumento={totales.total}
            subtotalNeto={totales.subtotal}
            simbolo={simbolo}
            bloqueada={bloqueada}
            fechaVenc={fechaVenc}
            usuarioId={usuario?.id || ''}
            esPropietario={esPropietario}
            esAdmin={esAdmin}
            lineas={lineas}
            notasHtml={notasHtml}
            condicionesHtml={condicionesHtml}
            onReferenciaChange={setReferencia}
            onReferenciaBlur={() => autoguardar({ referencia })}
            onFechaEmisionChange={(v) => {
              if (modo === 'crear') setFechaEmision(v)
              autoguardar({ fecha_emision: v })
            }}
            onDiasVencimientoChange={setDiasVencimiento}
            onDiasVencimientoBlur={() => autoguardar({ dias_vencimiento: diasVencimiento })}
            onCondicionPagoChange={(v) => {
              setCondicionPagoId(v)
              const cond = condiciones.find(c => c.id === v)
              autoguardar({
                condicion_pago_id: v || null,
                condicion_pago_label: cond?.label || null,
                condicion_pago_tipo: cond?.tipo || null,
              })
            }}
            onMonedaChange={(v) => { setMoneda(v); autoguardar({ moneda: v }) }}
            onPlantillaIdChange={setPlantillaId}
            onCargarPlantilla={(tpl) => {
              setPlantillaId(tpl.id)
              if (tpl.moneda) setMoneda(tpl.moneda)
              if (tpl.condicion_pago_id) setCondicionPagoId(tpl.condicion_pago_id)
              if (tpl.dias_vencimiento !== undefined) setDiasVencimiento(tpl.dias_vencimiento)
              if (tpl.lineas) setLineas(tpl.lineas as LineaTemporal[])
              if (tpl.notas_html) setNotasHtml(tpl.notas_html)
              if (tpl.condiciones_html) setCondicionesHtml(tpl.condiciones_html)
            }}
            onGuardarComoPlantilla={async (nombre) => {
              const nuevaPlantilla = {
                id: `tpl_${Date.now()}`, nombre,
                creado_por: usuario?.id || '', moneda,
                condicion_pago_id: condicionPagoId,
                condicion_pago_label: condiciones.find(c => c.id === condicionPagoId)?.label,
                condicion_pago_tipo: condiciones.find(c => c.id === condicionPagoId)?.tipo,
                dias_vencimiento: diasVencimiento,
                lineas: lineas.map(l => {
                  const { ...rest } = l as LineaTemporal
                  const { _temp, ...sinTemp } = rest
                  return sinTemp
                }),
                notas_html: notasHtml, condiciones_html: condicionesHtml,
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
            onGuardarCambiosPlantilla={async () => {
              const plantillas = ((config?.plantillas || []) as Array<{ id: string; [k: string]: unknown }>).map(p =>
                p.id === plantillaId ? {
                  ...p, moneda, condicion_pago_id: condicionPagoId,
                  dias_vencimiento: diasVencimiento,
                  lineas: lineas.map(l => {
                    const { ...rest } = l as LineaTemporal
                    const { _temp, ...sinTemp } = rest
                    return sinTemp
                  }),
                  notas_html: notasHtml, condiciones_html: condicionesHtml,
                } : p
              )
              await fetch('/api/presupuestos/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plantillas }),
              })
              setConfig(prev => prev ? { ...prev, plantillas } as ConfigPresupuestos : null)
            }}
            onEliminarPlantilla={async (tplId) => {
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
            onAutoguardar={autoguardar}
            onSetConfig={setConfig}
            plantillaModificada={plantillaModificada}
          />
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
            lineaRecienAgregada={lineaRecienAgregada}
            onAgregarLinea={agregarLinea}
            onEditarLinea={editarLinea}
            onEliminarLinea={eliminarLinea}
            onReordenar={reordenarLineas}
            onCambiarColumnas={(cols) => {
              setColumnasVisibles(cols)
              autoguardar({ columnas_lineas: cols })
              try { localStorage.setItem('flux_columnas_presupuesto', JSON.stringify(cols)) } catch {}
            }}
            originalesCatalogo={originalesCatalogo}
            onProductoSeleccionado={registrarOriginalCatalogo}
            onActualizarCatalogo={actualizarCatalogo}
            onRevertirCatalogo={revertirCatalogo}
            puedeEditarProductos={puedeEditarProductos}
            presupuestoGuardado={!!presupuestoIdRef.current}
          />
        </div>

        {/* ─── TOTALES ─── */}
        <SeccionTotales
          subtotal={totales.subtotal}
          impuestos={totales.impuestos}
          total={totales.total}
          fmt={fmt}
        />

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
          <SeccionHistorial historial={presupuesto.historial} />
        )}
      </div>

      {/* ─── Certificado de aceptación (si existe) ─── */}
      {modo === 'editar' && presupuesto?.pdf_firmado_url && (
        <SeccionCertificado pdfFirmadoUrl={presupuesto.pdf_firmado_url} />
      )}

      {/* Cierre del wrapper de contenido principal (modo lateral) */}
      </div>

      {/* ─── Panel de actividad (Chatter) ─── */}
      {modo === 'editar' && idPresupuesto && (
        <PanelChatter
          entidadTipo="presupuesto"
          entidadId={idPresupuesto}
          contactoPrincipal={contactoSeleccionado ? {
            id: contactoSeleccionado.id,
            nombre: `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim(),
          } : presupuesto?.contacto_id ? {
            id: presupuesto.contacto_id,
            nombre: `${presupuesto.contacto_nombre || ''} ${presupuesto.contacto_apellido || ''}`.trim(),
          } : null}
          contacto={(() => {
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
            total: presupuesto?.total_final ? fmt(presupuesto.total_final) : '',
            fecha: presupuesto?.fecha_emision ? formato.fecha(presupuesto.fecha_emision) : '',
            estado: presupuesto?.estado || '',
            empresaNombre: datosEmpresa?.nombre || empresa?.nombre || '',
            urlPortal: urlPortalReal || undefined,
            // Entidades crudas para que el catálogo resuelva variables como
            // documento_total, documento_fecha_vencimiento, etc. con datos reales.
            entidades: presupuesto ? {
              presupuesto: presupuesto as unknown as Record<string, unknown>,
            } : undefined,
          }}
          onAbrirCorreo={() => { setCorreoLibre(true); setModalEnviarAbierto(true) }}
          adjuntosDocumento={presupuesto?.pdf_url ? [{
            url: presupuesto.pdf_url,
            nombre: presupuesto.pdf_nombre_archivo || `${presupuesto.numero || 'Presupuesto'}.pdf`,
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
            nombre_archivo: presupuesto.pdf_nombre_archivo || `${presupuesto.numero || 'Presupuesto'}.pdf`,
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
          if (tplId) {
            if (plantillaCorreoPredeterminadaId && plantillaCorreoPredeterminadaId !== tplId) {
              await fetch(`/api/correo/plantillas/${plantillaCorreoPredeterminadaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: [] }),
              })
            }
            await fetch(`/api/correo/plantillas/${tplId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                variables: [{ clave: '_es_por_defecto', etiqueta: 'Por defecto', origen: 'metadata' }],
              }),
            })
            setPlantillaCorreoPredeterminadaId(tplId)
          } else {
            if (plantillaCorreoPredeterminadaId) {
              await fetch(`/api/correo/plantillas/${plantillaCorreoPredeterminadaId}`, {
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
          await fetch(`/api/correo/plantillas/${id}`, {
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
          await fetch('/api/correo/plantillas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre, asunto: datos.asunto,
              contenido: datos.contenido_html.replace(/<[^>]*>/g, ''),
              contenido_html: datos.contenido_html,
              modulos: ['presupuestos'],
              disponible_para: datos.paraTodos ? 'todos' : 'usuarios',
            }),
          })
          recargarPlantillasCorreo()
        }}
        onEliminarPlantilla={async (id) => {
          await fetch(`/api/correo/plantillas/${id}`, { method: 'DELETE' })
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
            ...(() => {
              const d = contactoSeleccionado?.direcciones?.find(d => d.es_principal) || contactoSeleccionado?.direcciones?.[0]
              return {
                direccion: d?.texto || presupuesto?.contacto_direccion || '',
                calle: d?.calle || '', numero_calle: d?.numero || '',
                piso: d?.piso || '', barrio: d?.barrio || '',
                ciudad: d?.ciudad || '', provincia: d?.provincia || '',
                pais: d?.pais || '', codigo_postal: d?.codigo_postal || '',
                timbre: d?.timbre || '',
              }
            })(),
          },
          presupuesto: (() => {
            const totalFinal = totales.total
            const condSeleccionada = condiciones.find(c => c.id === condicionPagoId)
            const hitos = condSeleccionada?.tipo === 'hitos' ? (condSeleccionada.hitos || []) : []

            // Construir contexto de cuotas desde hitos
            const cuotasCtx: Record<string, unknown> = { cantidad_cuotas: hitos.length }
            hitos.slice(0, 3).forEach((h: { porcentaje?: number; descripcion?: string }, i: number) => {
              const pct = h.porcentaje || 0
              const monto = totalFinal * pct / 100
              cuotasCtx[`cuota_${i + 1}_descripcion`] = h.descripcion || `Cuota ${i + 1}`
              cuotasCtx[`cuota_${i + 1}_porcentaje`] = pct
              cuotasCtx[`cuota_${i + 1}_monto`] = monto
            })
            if (hitos.length > 0) {
              const primera = hitos[0] as { porcentaje?: number; descripcion?: string }
              const ultima = hitos[hitos.length - 1] as { porcentaje?: number; descripcion?: string }
              cuotasCtx.adelanto_porcentaje = primera.porcentaje || 0
              cuotasCtx.adelanto_monto = totalFinal * ((primera.porcentaje || 0) / 100)
              cuotasCtx.adelanto_descripcion = primera.descripcion || 'Adelanto'
              cuotasCtx.pago_final_porcentaje = ultima.porcentaje || 0
              cuotasCtx.pago_final_monto = totalFinal * ((ultima.porcentaje || 0) / 100)
              cuotasCtx.pago_final_descripcion = ultima.descripcion || 'Pago final'
              cuotasCtx.cuotas_intermedias = Math.max(0, hitos.length - 2)
            }

            return {
              numero: presupuesto?.numero || numeroPresupuesto || '',
              estado: presupuesto?.estado || 'borrador',
              moneda: presupuesto?.moneda || moneda,
              subtotal_neto: presupuesto?.subtotal_neto || totales.subtotal,
              total_impuestos: presupuesto?.total_impuestos || totales.impuestos,
              total_final: presupuesto?.total_final || totalFinal,
              descuento_global: presupuesto?.descuento_global || 0,
              descuento_global_monto: presupuesto?.descuento_global_monto || 0,
              condicion_pago_label: presupuesto?.condicion_pago_label || condSeleccionada?.label || '',
              fecha_emision: presupuesto?.fecha_emision || fechaEmision,
              fecha_vencimiento: presupuesto?.fecha_vencimiento || '',
              referencia: presupuesto?.referencia || referencia,
              contacto_nombre: contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || '',
              contacto_correo: contactoSeleccionado?.correo || presupuesto?.contacto_correo || '',
              ...cuotasCtx,
            }
          })(),
          empresa: {
            nombre: datosEmpresa?.nombre || '',
            correo: datosEmpresa?.correo || '',
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
            empresa_nombre: contactoSeleccionado?.nombre || presupuesto?.contacto_nombre || '',
          },
        }}
      />

      {/* ─── Modal confirmación re-emisión ─── */}
      <ModalConfirmacion
        abierto={confirmarReEmision}
        onCerrar={() => setConfirmarReEmision(false)}
        onConfirmar={ejecutarReEmision}
        titulo="Re-emitir presupuesto"
        descripcion="Se actualizará la fecha de emisión a hoy y se recalculará el vencimiento. Podés deshacer esta acción después."
        tipo="advertencia"
        etiquetaConfirmar="Re-emitir"
      />

      {/* ─── Modal presupuesto vencido ─── */}
      <Modal
        abierto={!!modalVencimiento}
        onCerrar={() => setModalVencimiento(null)}
        titulo="Presupuesto vencido"
        tamano="sm"
        acciones={
          <div className="flex items-center gap-2 justify-end">
            <Boton variante="secundario" tamano="sm" onClick={() => setModalVencimiento(null)}>
              Cancelar
            </Boton>
            <Boton variante="primario" tamano="sm" onClick={confirmarVencimientoYCambiarEstado}>
              Actualizar y continuar
            </Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-card bg-insignia-advertencia/10 border border-insignia-advertencia/20">
            <AlertTriangle size={20} className="text-insignia-advertencia shrink-0 mt-0.5" />
            <p className="text-sm text-texto-secundario">
              Este presupuesto está vencido. Para continuar, actualizá la fecha de vencimiento.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-texto-secundario uppercase tracking-wide">
              Nueva fecha de vencimiento
            </label>
            <SelectorFecha
              valor={modalVencimiento?.nuevaFecha || ''}
              onChange={(v) => {
                if (v && modalVencimiento) {
                  setModalVencimiento({ ...modalVencimiento, nuevaFecha: v })
                }
              }}
              limpiable={false}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

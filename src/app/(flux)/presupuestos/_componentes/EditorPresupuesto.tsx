'use client'

/**
 * EditorPresupuesto — Componente orquestador para crear y editar presupuestos.
 * Contiene toda la lógica de estado y delega el render a sub-componentes.
 * Se usa en: presupuestos/nuevo/page.tsx, presupuestos/[id]/page.tsx
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, AlertTriangle, FileText } from 'lucide-react'
import { CargaIcono } from '@/componentes/carga'
import { ModalEnviarDocumento, type CanalCorreoEmpresa, type DatosEnvioDocumento, type DatosBorradorCorreo, type DatosPlantillaCorreo } from '@/componentes/entidad/ModalEnviarDocumento'
import { TablaLineas, type OriginalCatalogo } from './TablaLineas'
import dynamic from 'next/dynamic'
import type { LineaPropuestaIA } from './PanelAsistenteIA'
const PanelAsistenteIA = dynamic(() => import('./PanelAsistenteIA').then(m => m.PanelAsistenteIA), { ssr: false })
import { registrarArmador } from '@/lib/salix-ia/armador-presupuesto-bus'
import { useMinimizable } from '@/hooks/useMinimizable'
import { useReportarCarga } from '@/hooks/useCargaGlobal'
import EditorNotasPresupuesto from './EditorNotasPresupuesto'
import { useRol } from '@/hooks/useRol'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Modal } from '@/componentes/ui/Modal'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import { useEnvioPendiente } from '@/hooks/useEnvioPendiente'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useToast } from '@/componentes/feedback/Toast'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useEsPantallaAncha } from '@/hooks/useEsPantallaAncha'
import { usePreferencias } from '@/hooks/usePreferencias'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import type { RefPanelChatter } from '@/componentes/entidad/_panel_chatter/tipos'
import type {
  PresupuestoConLineas, LineaPresupuesto, TipoLinea,
  Impuesto, UnidadMedida, CondicionPago, ConfigPresupuestos,
  EstadoPresupuesto,
} from '@/tipos/presupuesto'
import { TRANSICIONES_ESTADO } from '@/tipos/presupuesto'
import type {
  ContactoResumido, Vinculacion, DatosEmpresa, LineaTemporal,
} from './tipos-editor'
import { unirVinculaciones } from './tipos-editor'
import { useReportarGuardado } from '@/hooks/useIndicadorGuardado'
import { sincronizarRecursosEnvio, type ResultadoSincronizacionEnvio } from '@/lib/presupuestos/sincronizar-recursos-envio'

// ─── Sub-componentes extraídos ──────────────────────────────────────────────
import CabeceraPresupuesto, { BannerBloqueo, BannerEdicionAdmin } from './CabeceraPresupuesto'
import SeccionEmisor from './SeccionEmisor'
import SeccionCliente from './SeccionCliente'
import SeccionDatosPresupuesto from './SeccionDatosPresupuesto'
import SeccionTotales from './SeccionTotales'
import SeccionHistorial from './SeccionHistorial'
import SeccionCertificado from './SeccionCertificado'
import { ModalRegistrarPago } from './ModalRegistrarPago'
import type { EntradaChatter } from '@/tipos/chatter'
import type { PresupuestoPago } from '@/tipos/presupuesto-pago'

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
  /** Número precargado server-side (P-0042). Se usa para mostrar el nombre
   *  real del documento en el cargador mientras se hidrata el cliente. */
  numeroInicial?: string | null
}

export default function EditorPresupuesto({
  modo,
  presupuestoId: presupuestoIdProp,
  contactoIdInicial,
  actividadOrigenId,
  onCreado,
  onDescartado,
  onTituloCargado,
  numeroInicial,
}: PropsEditorPresupuesto) {
  const router = useRouter()
  const { obtenerRutaModulo } = useNavegacion()
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
  // Timestamp del último PATCH/POST exitoso. La cabecera lo usa para mostrar
  // el check verde "Guardado" unos segundos después del autoguardado, y así
  // el usuario tiene confirmación de que su `onBlur` se persistió.
  const [ultimoGuardadoEn, setUltimoGuardadoEn] = useState<number | null>(null)
  // Reporta el estado de guardado al indicador global del Header. Esto hace
  // visible el feedback de autoguardado aunque el usuario haya scrolleado
  // fuera de la cabecera del editor.
  const reportarGuardado = useReportarGuardado()
  // Modo edición administrativa: permite a admin/propietario corregir un
  // documento ya enviado/confirmado/etc. sin cambiar el estado ni las fechas.
  // Se activa desde el menú ··· y se cierra con "Guardar correcciones".
  const [modoEdicionAdmin, setModoEdicionAdmin] = useState(false)
  const [guardandoEdicionAdmin, setGuardandoEdicionAdmin] = useState(false)
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

  // Asistente IA (armador de líneas con Salix). El panel se puede abrir desde:
  //  - El link sutil del editor (ver botón "✨ Armar con Salix IA")
  //  - El FAB global de Salix IA, que vive en el layout y consume el bus
  //    `armador-presupuesto-bus` para invocar `setPanelIA(true)` desde afuera.
  const [panelIA, setPanelIA] = useState(false)
  const [productosProvisionales, setProductosProvisionales] = useState<string[]>([])

  // Modal enviar documento por correo
  const [modalEnviarAbierto, setModalEnviarAbierto] = useState(false)
  const [correoLibre, setCorreoLibre] = useState(false)

  // Modal registrar pago — disparado desde la barra del chatter o desde
  // un mensaje del timeline (en cuyo caso `chatterOrigen` se pre-vincula).
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [chatterOrigenPago, setChatterOrigenPago] = useState<EntradaChatter | null>(null)
  // Pago a editar (null → modo crear)
  const [pagoEditando, setPagoEditando] = useState<PresupuestoPago | null>(null)
  // Pago a eliminar (null → sin diálogo abierto)
  const [pagoEliminando, setPagoEliminando] = useState<{ id: string; monto: string; moneda: string } | null>(null)
  // Trigger que recarga los pagos en el chatter al guardar/eliminar
  const [recargaPagosNonce, setRecargaPagosNonce] = useState(0)

  const abrirModalPagoDesdeChatter = useCallback((entrada: EntradaChatter | null) => {
    setPagoEditando(null)
    setChatterOrigenPago(entrada)
    setModalPagoAbierto(true)
  }, [])

  const abrirEditarPago = useCallback(async (pagoId: string) => {
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoIdProp || presupuestoIdCreado}/pagos/${pagoId}`)
      if (!res.ok) return
      const p = await res.json() as PresupuestoPago
      setPagoEditando(p)
      setChatterOrigenPago(null)
      setModalPagoAbierto(true)
    } catch { /* silencioso */ }
  }, [presupuestoIdProp, presupuestoIdCreado])

  const confirmarEliminarPago = useCallback((pagoId: string, monto: string, moneda: string) => {
    setPagoEliminando({ id: pagoId, monto, moneda })
  }, [])

  const ejecutarEliminarPago = useCallback(async () => {
    if (!pagoEliminando) return
    try {
      const pid = presupuestoIdProp || presupuestoIdCreado
      const res = await fetch(`/api/presupuestos/${pid}/pagos/${pagoEliminando.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecargaPagosNonce(n => n + 1)
      }
    } catch { /* silencioso */ }
    setPagoEliminando(null)
  }, [pagoEliminando, presupuestoIdProp, presupuestoIdCreado])

  // Cuando se registra un pago, refrescar las cuotas, el estado y el total
  // cobrado del presupuesto. Necesario porque el primer pago materializa las
  // cuotas sintéticas en BD (deja de ser id "sintetico-N" y pasa a uuid real),
  // el trigger SQL puede actualizar estado de cuotas a parcial/cobrada, y el
  // desglose del cabezal usa total_cobrado para condiciones plazo_fijo.
  const idPresupuestoEfectivo = modo === 'editar' ? presupuestoIdProp : presupuestoIdCreado
  useEffect(() => {
    if (recargaPagosNonce === 0 || !idPresupuestoEfectivo) return
    fetch(`/api/presupuestos/${idPresupuestoEfectivo}`)
      .then((r) => r.json())
      .then((p) => {
        setPresupuesto((prev) => prev ? {
          ...prev,
          cuotas: p.cuotas || prev.cuotas,
          estado: p.estado || prev.estado,
          total_cobrado: typeof p.total_cobrado === 'number' ? p.total_cobrado : prev.total_cobrado,
        } : null)
      })
      .catch(() => { /* silencioso */ })
  }, [recargaPagosNonce, idPresupuestoEfectivo])
  const [canalesCorreo, setCanalesCorreo] = useState<CanalCorreoEmpresa[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').PlantillaCorreo[]>([])
  const [plantillaCorreoPredeterminadaId, setPlantillaCorreoPredeterminadaId] = useState<string | null>(null)
  const [enviandoCorreo] = useState(false)
  const [urlPortalReal, setUrlPortalReal] = useState<string | null>(null)
  const [snapshotCorreo, setSnapshotCorreo] = useState<import('@/componentes/entidad/ModalEnviarDocumento').SnapshotCorreo | null>(null)
  const [pdfCongeladoUrl, setPdfCongeladoUrl] = useState<string | null>(null)
  // Mientras se generan PDF + congelado + portal antes de abrir el modal de
  // envío. La cabecera lo usa para mostrar "Preparando…" en el botón Enviar.
  const [preparandoEnvio, setPreparandoEnvio] = useState(false)
  // Estado de sincronización del PDF/portal con el contenido actual del
  // documento. El modal lo usa para renderizar un banner reactivo (verde 'ok',
  // azul 'sincronizando', ámbar 'desactualizado', rojo 'error') con botón
  // Reintentar cuando algo salió mal. Se limpia al cerrar el modal.
  const [estadoSincronizacion, setEstadoSincronizacion] = useState<'sincronizando' | 'ok' | 'desactualizado' | 'error' | null>(null)
  const [mensajeSincronizacion, setMensajeSincronizacion] = useState<string | null>(null)
  // True si el documento cambió desde la última preparación exitosa de envío
  // (PDF + congelado + portal). Si está en false y los tres recursos están
  // cacheados en estado, el handleEnviar abre el modal directo sin regenerar.
  // Arranca en true (no preparado) y se baja a false:
  //   - en el load de modo editar si pdf_generado_en >= actualizado_en (BD)
  //   - al final de cada handleEnviar exitoso
  const documentoDesactualizadoRef = useRef(true)
  // Sentinel para evitar marcar dirty durante la inicialización del state
  // (los setX(...) que disparan los useEffect de carga del editor).
  const cambiosTrackingActivoRef = useRef(false)

  // ID efectivo del presupuesto (creado o prop)
  const idPresupuesto = modo === 'editar' ? presupuestoIdProp! : presupuestoIdCreado

  // Contacto (modo crear)
  const [contactoId, setContactoId] = useState<string | null>(null)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<ContactoResumido | null>(null)

  // Ref al PanelChatter para forzar refetch cuando insertamos entradas vía
  // backend (cambio de estado, envío de correo). El Realtime de Supabase
  // puede llegar con latencia o no llegar; este handle garantiza UI fresca.
  const refPanelChatter = useRef<RefPanelChatter | null>(null)

  // Dirigido a (vinculación)
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([])
  const [atencionId, setAtencionId] = useState<string | null>(null)
  const [atencionSeleccionada, setAtencionSeleccionada] = useState<Vinculacion['vinculado'] | null>(null)

  // Dirección elegida por el usuario (override del principal por defecto).
  // Persiste como snapshot textual en presupuestos.contacto_direccion.
  const [direccionIdSeleccionada, setDireccionIdSeleccionada] = useState<string | null>(null)

  // Visita de origen (relevamiento del visitador). Se elige opcionalmente al
  // crear/editar el presupuesto y se hereda a la OT al generarla. Ver migración
  // 062 y SelectorVisitaPresupuesto. Al cambiar de contacto se limpia: la
  // visita pertenece a un contacto puntual.
  const [visitaId, setVisitaId] = useState<string | null>(null)

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

  // ─── Tracking de cambios para reusar PDF/portal al re-enviar ────────────
  // Cualquier mutación en contenido editable marca documentoDesactualizadoRef
  // como true. El primer disparo (cuando termina la carga inicial) se ignora
  // para no marcar dirty al hidratar el state.
  useEffect(() => {
    if (cargando) return
    if (!cambiosTrackingActivoRef.current) {
      cambiosTrackingActivoRef.current = true
      return
    }
    documentoDesactualizadoRef.current = true
  }, [
    cargando,
    notasHtml, condicionesHtml, referencia, moneda, condicionPagoId,
    diasVencimiento, fechaEmision, columnasVisibles, lineas,
    presupuesto?.estado, presupuesto?.fecha_vencimiento,
    presupuesto?.contacto_id, presupuesto?.atencion_contacto_id,
    presupuesto?.contacto_direccion, presupuesto?.descuento_global,
    presupuesto?.total_final,
  ])

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
      setVisitaId(pres.visita_id || null)
      // Si el PDF persistido en BD es posterior a la última edición, no hace
      // falta regenerar al primer "Enviar" del documento. Igual el modal todavía
      // necesita pdfCongeladoUrl en memoria, así que la primera vez se hace una
      // preparación rápida (sólo congelado + portal si faltan).
      if (pres.pdf_url && pres.pdf_generado_en && pres.actualizado_en) {
        const pdfTime = new Date(pres.pdf_generado_en).getTime()
        const updTime = new Date(pres.actualizado_en).getTime()
        if (pdfTime >= updTime) documentoDesactualizadoRef.current = false
      }
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
              setVinculaciones(unirVinculaciones(data.vinculaciones, data.vinculaciones_inversas))
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
                // La dirección elegida vive en presupuestos.direccion_id (FK
                // explícita). Para presupuestos legacy sin direccion_id,
                // intentamos matchear por texto contra las direcciones del
                // contacto — el backfill ya cubrió la mayoría, pero el match
                // de texto sirve de fallback para datos pre-migración.
                if (pres.direccion_id) {
                  setDireccionIdSeleccionada(pres.direccion_id as string)
                } else if (pres.contacto_direccion) {
                  const dirs = (data.direcciones || []) as { id: string; texto: string | null }[]
                  const match = dirs.find(d => d.texto === pres.contacto_direccion)
                  if (match) setDireccionIdSeleccionada(match.id)
                }
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
        setVinculaciones(unirVinculaciones(data.vinculaciones, data.vinculaciones_inversas))
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
  const atencionSeleccionadaRef = useRef(atencionSeleccionada)
  atencionSeleccionadaRef.current = atencionSeleccionada
  const visitaIdRef = useRef(visitaId)
  visitaIdRef.current = visitaId

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

      // Snapshot de la atención (Dirigido a) elegida en modo crear, para que
      // quede persistida en el presupuesto y no solo en el correo enviado.
      const at = atencionSeleccionadaRef.current
      const atencionPayload = at
        ? {
            atencion_contacto_id: at.id,
            atencion_nombre: `${at.nombre} ${at.apellido || ''}`.trim(),
            atencion_correo: at.correo || null,
          }
        : {}

      const payload = {
        contacto_id: cId,
        ...atencionPayload,
        // Visita vinculada (relevamiento). Si está seteada, el backend valida
        // que pertenezca a la empresa antes de aceptar la creación.
        visita_id: visitaIdRef.current || undefined,
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
        // Hidratar `presupuesto` con la respuesta del POST. Sin esto, el state
        // queda en null durante toda la sesión post-creación y los updates
        // funcionales (`setPresupuesto(prev => prev ? ... : null)`) son no-op.
        // Eso causaba que el modal de envío no recibiera el pdf_url generado.
        setPresupuesto({
          ...presupuestoCreado,
          lineas: presupuestoCreado.lineas || [],
          cuotas: presupuestoCreado.cuotas || [],
          historial: presupuestoCreado.historial || [],
          orden_trabajo: presupuestoCreado.orden_trabajo || null,
        })
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
        if (res.ok) setUltimoGuardadoEn(Date.now())
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
        // El PATCH registra el cambio de estado en chatter desde el backend.
        // No esperamos al Realtime: forzamos refetch para evitar UI desactualizada.
        refPanelChatter.current?.recargar()
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

  // Avanzar el estado sin tocar la fecha de vencimiento (admin decide registrar
  // una confirmación retroactiva aunque el presupuesto esté vencido en portal).
  const continuarSinActualizarVencimiento = async () => {
    if (!modalVencimiento) return
    const { estadoPendiente } = modalVencimiento
    setModalVencimiento(null)
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
    // Si vino desde el dashboard, volver ahí. Si no, al listado preservando filtros.
    const desde = new URLSearchParams(window.location.search).get('desde')
    router.push(desde === 'dashboard' ? '/dashboard' : obtenerRutaModulo('/presupuestos'))
  }, [modo, router, onDescartado, productosProvisionales, obtenerRutaModulo])

  // ─── Contacto: seleccionar y limpiar (modo crear) ──────────────────────

  const seleccionarContacto = useCallback(async (contacto: ContactoResumido) => {
    setContactoId(contacto.id)
    setContactoSeleccionado(contacto)
    setAtencionId(null)
    setAtencionSeleccionada(null)
    setDireccionIdSeleccionada(null)
    // La visita pertenece a un contacto puntual; al cambiarlo se desvincula.
    setVisitaId(null)
    contactoIdRef.current = contacto.id

    try {
      const res = await fetch(`/api/contactos/${contacto.id}`)
      const data = await res.json()
      setVinculaciones(unirVinculaciones(data.vinculaciones, data.vinculaciones_inversas))
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
    setDireccionIdSeleccionada(null)
    setVisitaId(null)
  }, [])

  const seleccionarAtencion = useCallback((vinc: Vinculacion) => {
    setAtencionId(vinc.vinculado.id)
    setAtencionSeleccionada(vinc.vinculado)
  }, [])

  // Cambiar la dirección visible del cliente. Persiste tanto la FK
  // (presupuestos.direccion_id) como el snapshot textual — la FK habilita la
  // propagación viva cuando se edita esa dirección puntual del contacto.
  const cambiarDireccionCliente = useCallback((direccionId: string, texto: string) => {
    setDireccionIdSeleccionada(direccionId)
    if (presupuestoIdRef.current) {
      autoguardar({ direccion_id: direccionId, contacto_direccion: texto })
    }
  }, [autoguardar])

  // ─── CRUD de líneas ────────────────────────────────────────────────────

  // Registrar producto del catálogo para que el detector de cambios pueda
  // comparar nombre/descripción contra el original. Declarado arriba de
  // `agregarLinea` porque éste lo invoca al crear una línea desde la fila
  // persistente con un producto del catálogo prellenado.
  const registrarOriginalCatalogo = useCallback((lineaId: string, producto: { id: string; nombre: string; descripcion_venta: string | null }) => {
    setOriginalesCatalogo(prev => {
      const nuevo = new Map(prev)
      nuevo.set(lineaId, { producto_id: producto.id, nombre: producto.nombre, descripcion_venta: producto.descripcion_venta })
      return nuevo
    })
  }, [])

  const agregarLinea = useCallback(async (tipo: TipoLinea, datosIniciales?: import('./TablaLineas').DatosInicialesLinea) => {
    const impuestos = (config?.impuestos || []) as Impuesto[]
    const impDefault = impuestos.find(i => i.activo && i.predeterminado) || impuestos.find(i => i.activo && i.porcentaje > 0)
    const pid = presupuestoIdRef.current

    // Resolver campos de la línea: lo que venga en `datosIniciales` (de un
    // producto seleccionado en la fila persistente) pisa los defaults; si no
    // viene, se usa el impuesto por defecto del config como antes.
    const impuestoPorcentajeFinal = datosIniciales?.impuesto_porcentaje ?? (tipo === 'producto' && impDefault ? String(impDefault.porcentaje) : '0')
    const impuestoLabelFinal = datosIniciales?.impuesto_label ?? (tipo === 'producto' && impDefault ? impDefault.label : null)

    if (pid) {
      try {
        const res = await fetch(`/api/presupuestos/${pid}/lineas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo_linea: tipo,
            codigo_producto: datosIniciales?.codigo_producto ?? null,
            descripcion: datosIniciales?.descripcion ?? null,
            descripcion_detalle: datosIniciales?.descripcion_detalle ?? null,
            precio_unitario: datosIniciales?.precio_unitario ?? null,
            unidad: datosIniciales?.unidad ?? null,
            impuesto_label: impuestoLabelFinal,
            impuesto_porcentaje: impuestoPorcentajeFinal,
          }),
        })
        if (res.ok) {
          const nuevas = await res.json()
          const lista = Array.isArray(nuevas) ? nuevas : [nuevas]
          setLineas(prev => [...prev, ...lista])
          if (lista[0]?.id) {
            setLineaRecienAgregada(lista[0].id)
            // Registrar producto del catálogo para que el detector de cambios
            // sepa comparar nombre/descripción contra el original.
            if (datosIniciales?.productoCatalogo) {
              registrarOriginalCatalogo(lista[0].id, datosIniciales.productoCatalogo)
            }
          }
          if (modo === 'editar') recargarTotalesRef.current()
        }
      } catch { /* silenciar */ }
    } else {
      const idTemp = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const nuevaLinea: LineaTemporal = {
        _temp: true,
        id: idTemp,
        tipo_linea: tipo, orden: lineas.length,
        codigo_producto: datosIniciales?.codigo_producto ?? null,
        descripcion: datosIniciales?.descripcion ?? (tipo === 'seccion' ? '' : null),
        descripcion_detalle: datosIniciales?.descripcion_detalle ?? null,
        cantidad: '1',
        unidad: datosIniciales?.unidad ?? null,
        precio_unitario: datosIniciales?.precio_unitario ?? '0',
        descuento: '0',
        impuesto_label: impuestoLabelFinal,
        impuesto_porcentaje: impuestoPorcentajeFinal,
        subtotal: '0', impuesto_monto: '0', total: '0',
        monto: tipo === 'descuento' ? '0' : null,
      }
      setLineas(prev => [...prev, nuevaLinea])
      setLineaRecienAgregada(idTemp)
      if (datosIniciales?.productoCatalogo) {
        registrarOriginalCatalogo(idTemp, datosIniciales.productoCatalogo)
      }
    }
  }, [lineas.length, config, modo, registrarOriginalCatalogo])

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

  // ─── Catálogo: actualizar, revertir ─────────────────────────────────────
  // (registrarOriginalCatalogo está declarado arriba, junto a agregarLinea,
  // porque éste lo invoca al crear líneas con producto del catálogo.)

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

  // Detecta cambios sin guardar en los 4 campos cuyo autoguardado es onBlur
  // (referencia, días de vencimiento, notas y condiciones HTML). Los demás
  // campos del editor disparan autoguardar inmediato en onChange — no pueden
  // quedar "pendientes". Las líneas se autoguardan campo a campo vía /lineas/[id].
  const tieneCambiosPendientes = useMemo(() => {
    if (!presupuesto) return false
    const norm = (s: string | null | undefined) => (s || '').trim()
    return (
      norm(referencia) !== norm(presupuesto.referencia) ||
      diasVencimiento !== (presupuesto.dias_vencimiento ?? 30) ||
      norm(notasHtml) !== norm(presupuesto.notas_html) ||
      norm(condicionesHtml) !== norm(presupuesto.condiciones_html)
    )
  }, [referencia, diasVencimiento, notasHtml, condicionesHtml, presupuesto])

  // Autoguardado debounceado para campos HTML (notas y condiciones).
  // Antes dependíamos del onBlur del editor de notas, pero el blur no se
  // dispara confiablemente cuando el usuario borra items (el elemento con
  // foco se desmonta del DOM y el evento se pierde). Con un useEffect que
  // observa el state, cualquier cambio se persiste 800 ms después de la
  // última tecla — sobrevive a borrados, pegados y reordenamientos.
  useEffect(() => {
    if (!presupuestoIdRef.current) return
    if ((notasHtml || '').trim() === ((presupuesto?.notas_html || '').trim())) return
    const id = setTimeout(() => autoguardar({ notas_html: notasHtml }), 800)
    return () => clearTimeout(id)
  }, [notasHtml, presupuesto?.notas_html, autoguardar])

  useEffect(() => {
    if (!presupuestoIdRef.current) return
    if ((condicionesHtml || '').trim() === ((presupuesto?.condiciones_html || '').trim())) return
    const id = setTimeout(() => autoguardar({ condiciones_html: condicionesHtml }), 800)
    return () => clearTimeout(id)
  }, [condicionesHtml, presupuesto?.condiciones_html, autoguardar])

  // Sincroniza el indicador global del Header con el estado de guardado del
  // editor. Mientras `guardando` está activo se muestra "Guardando…" en las
  // migajas; al volver a false con un guardado reciente, se muestra "Guardado"
  // ~1.5 s y luego desaparece.
  useEffect(() => {
    if (guardando) {
      reportarGuardado('guardando')
      return
    }
    if (!ultimoGuardadoEn) return
    reportarGuardado('guardado')
    const id = setTimeout(() => reportarGuardado(null), 1500)
    return () => clearTimeout(id)
  }, [guardando, ultimoGuardadoEn, reportarGuardado])

  // Al desmontar el editor, dejar el indicador limpio para que no quede
  // colgado si el usuario navega a otra pantalla.
  useEffect(() => {
    return () => reportarGuardado(null)
  }, [reportarGuardado])

  // ─── Acciones de estado (modo editar) ───────────────────────────────────

  // Aplica el resultado de una sincronización a los states del editor: URLs
  // cacheadas + flag `documentoDesactualizadoRef` + estado/mensaje del banner
  // que ve el modal. Se reutiliza desde handleEnviar y desde el botón
  // "Reintentar" del banner.
  const aplicarResultadoSincronizacion = useCallback((res: ResultadoSincronizacionEnvio) => {
    if (res.pdfUrl) setPresupuesto(prev => prev ? { ...prev, pdf_url: res.pdfUrl! } : null)
    if (res.pdfCongeladoUrl) setPdfCongeladoUrl(res.pdfCongeladoUrl)
    if (res.portalUrl) setUrlPortalReal(res.portalUrl)
    if (res.estado === 'ok') {
      documentoDesactualizadoRef.current = false
    }
    setEstadoSincronizacion(res.estado)
    setMensajeSincronizacion(res.mensaje || null)
  }, [])

  const sincronizarParaEnvio = useCallback(async () => {
    if (!idPresupuesto) return
    setEstadoSincronizacion('sincronizando')
    setMensajeSincronizacion(null)
    setPreparandoEnvio(true)
    try {
      await guardarTodo()
      const resultado = await sincronizarRecursosEnvio({
        presupuestoId: idPresupuesto,
        documentoDesactualizado: documentoDesactualizadoRef.current,
        pdfActualUrl: presupuesto?.pdf_url || null,
        pdfCongeladoActualUrl: pdfCongeladoUrl,
        portalActualUrl: urlPortalReal,
      })
      aplicarResultadoSincronizacion(resultado)
    } finally {
      setPreparandoEnvio(false)
    }
  }, [idPresupuesto, guardarTodo, presupuesto?.pdf_url, pdfCongeladoUrl, urlPortalReal, aplicarResultadoSincronizacion])

  const handleEnviar = async () => {
    if (preparandoEnvio) return
    setSnapshotCorreo(null)
    if (!idPresupuesto) {
      setModalEnviarAbierto(true)
      return
    }

    // Atajo: si nada cambió desde la última preparación y los tres recursos
    // están en memoria, abrir el modal directo. Igual seteamos 'ok' para que
    // el banner verde aparezca como confirmación de "está todo sincronizado".
    const yaPreparado = !documentoDesactualizadoRef.current
      && !!presupuesto?.pdf_url
      && !!urlPortalReal
      && !!pdfCongeladoUrl
    if (yaPreparado) {
      setEstadoSincronizacion('ok')
      setMensajeSincronizacion(null)
      setModalEnviarAbierto(true)
      return
    }

    // Sincronizar antes de abrir. El modal se abre incluso si la sincronización
    // falla — el banner rojo + botón Reintentar le da al usuario contexto y
    // acción, en vez de que un toast desaparezca y no sepa qué pasó.
    await sincronizarParaEnvio()
    setModalEnviarAbierto(true)
  }

  const handleEnviarCorreo = useCallback(async (datos: DatosEnvioDocumento) => {
    const estadoActual = presupuesto?.estado || 'borrador'
    if (estadoActual === 'borrador') {
      await cambiarEstado('enviado') // El envío no bloquea por vencimiento — el correo siempre debe salir
    }

    // Snapshot del "Dirigido a" desde el destinatario elegido en el modal.
    // Si el correo_para matchea una vinculación del cliente, persistimos el
    // contacto como atencion_* para que quede registrado en el documento.
    // Sin esto, el destinatario solo viaja en el correo y no se ve al volver
    // al detalle del presupuesto (sección "Dirigido a" queda vacía).
    const destinatarioPrincipal = datos.correo_para[0]?.trim().toLowerCase() || ''
    if (destinatarioPrincipal && !presupuestoRef.current?.atencion_contacto_id) {
      const matchVinc = vinculaciones.find(
        v => (v.vinculado.correo || '').trim().toLowerCase() === destinatarioPrincipal
      )
      const fuente = matchVinc?.vinculado || atencionSeleccionadaRef.current
      if (fuente?.correo && fuente.correo.trim().toLowerCase() === destinatarioPrincipal) {
        autoguardar({
          atencion_contacto_id: fuente.id,
          atencion_nombre: `${fuente.nombre} ${fuente.apellido || ''}`.trim(),
          atencion_correo: fuente.correo,
        })
        setAtencionId(fuente.id)
        setAtencionSeleccionada(fuente)
      }
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
      const res = await fetch('/api/inbox/correo/programar', {
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
          incluir_enlace_portal: datos.incluir_enlace_portal,
          tipo: 'nuevo', enviar_en: datos.programado_para,
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
      // Backend inserta la entrada 'correo_enviado' en chatter. Forzamos
      // refetch porque Realtime puede llegar con latencia y dejar al usuario
      // viendo el timeline sin el correo recién enviado.
      refPanelChatter.current?.recargar()
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
  }, [presupuesto?.estado, presupuesto?.numero, presupuesto?.contacto_nombre, presupuesto?.contacto_apellido, cambiarEstado, atencionSeleccionada, contactoSeleccionado, numeroPresupuesto, idPresupuesto, empresa?.color_marca, empresa?.nombre, datosEmpresa, t, programarEnvio, pdfCongeladoUrl, vinculaciones, autoguardar])

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

  // Generar/regenerar PDF puede tardar varios segundos: marca actividad en
  // la BarraProgresoGlobal del header desde el primer momento.
  useReportarCarga(generandoPdf, `presupuesto-pdf-${idPresupuesto ?? ''}`)
  const [deshacerReEmision, setDeshacerReEmision] = useState<(() => Promise<void>) | null>(null)
  const [confirmarReEmision, setConfirmarReEmision] = useState(false)
  const [cantidadReEmisiones, setCantidadReEmisiones] = useState(0)
  const [modalVencimiento, setModalVencimiento] = useState<{ estadoPendiente: EstadoPresupuesto; nuevaFecha: string } | null>(null)
  const handleImprimir = async () => {
    if (!idPresupuesto || generandoPdf) return
    // Atajo: si nada cambió desde la última generación y ya hay PDF, abrir
    // el proxy directo sin tocar el backend ni mostrar "Generando…".
    if (!documentoDesactualizadoRef.current && presupuesto?.pdf_url) {
      const nombre = presupuesto.pdf_nombre_archivo || `${presupuesto.numero || 'Presupuesto'}.pdf`
      window.open(`/api/presupuestos/${idPresupuesto}/pdf/archivo/${encodeURIComponent(nombre)}`, '_blank')
      return
    }
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
      // Como acabamos de generar/confirmar el PDF, ya está al día.
      documentoDesactualizadoRef.current = false
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
      const data = await res.json()
      if (!res.ok) {
        // 409: ya existe una OT viva para el presupuesto; sincronizar estado
        // local para que la cabecera muestre "Ver OT" y navegar ahí.
        if (res.status === 409 && data.orden?.id) {
          setPresupuesto(prev => prev ? { ...prev, orden_trabajo: { id: data.orden.id, numero: data.orden.numero } } : null)
          router.push(`/ordenes/${data.orden.id}`)
          return
        }
        mostrarToast('error', data.error || 'Error al generar orden de trabajo')
        return
      }
      setPresupuesto(prev => prev ? { ...prev, orden_trabajo: { id: data.orden.id, numero: data.orden.numero } } : null)
      mostrarToast('exito', `Orden de trabajo ${data.orden?.numero} generada`)
      router.push(`/ordenes/${data.orden?.id}`)
    } catch {
      mostrarToast('error', 'Error al generar orden de trabajo')
    } finally {
      setGenerandoOT(false)
    }
  }, [idPresupuesto, generandoOT, mostrarToast, router])

  // Navegar a la OT ya generada
  const handleVerOT = useCallback(() => {
    const otId = presupuesto?.orden_trabajo?.id
    if (otId) router.push(`/ordenes/${otId}`)
  }, [presupuesto?.orden_trabajo?.id, router])

  const handleVistaPrevia = async () => {
    const pid = idPresupuesto
    if (!pid) return
    try {
      await guardarTodo()
      // Nota: NO esperamos la regeneración del PDF acá. El SSR del portal
      // (`/portal/[token]/page.tsx`) detecta si está desactualizado y lo
      // regenera por su cuenta. Esperar acá hacía que la pestaña tardara
      // varios segundos en abrirse (Puppeteer es lento).
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

  // ─── Edición administrativa ────────────────────────────────────────────
  // Permite corregir un documento fuera de borrador sin alterar estado,
  // fecha de envío ni contadores. Deja traza en historial + chatter y
  // regenera el PDF al cerrar el modo.
  const activarEdicionAdmin = () => {
    if (!puedeEdicionAdmin) return
    setModoEdicionAdmin(true)
  }

  const cancelarEdicionAdmin = () => {
    setModoEdicionAdmin(false)
  }

  const guardarEdicionAdmin = async () => {
    if (!idPresupuesto || guardandoEdicionAdmin) return
    setGuardandoEdicionAdmin(true)
    try {
      // 1) Persistir cambios pendientes (debe ir antes de regenerar el PDF)
      await guardarTodo()

      // 2) Disparar traza y regeneración de PDF en paralelo: ambas son
      //    independientes y la regeneración del PDF es lo más lento.
      setGenerandoPdf(true)
      const trazaPromise = fetch(`/api/presupuestos/${idPresupuesto}/edicion-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const pdfPromise = fetch(`/api/presupuestos/${idPresupuesto}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forzar: true }),
      }).finally(() => setGenerandoPdf(false))

      // 3) Cerrar el banner apenas se confirme la traza. La regeneración
      //    del PDF sigue en background con su propio spinner en la cabecera.
      const resTraza = await trazaPromise
      if (!resTraza.ok) {
        const err = await resTraza.json().catch(() => ({}))
        mostrarToast('error', err.error || 'No se pudo registrar la corrección')
      }

      setModoEdicionAdmin(false)
      mostrarToast('exito', 'Correcciones guardadas')

      // 4) Esperar el PDF en silencio para reportar fallos sin bloquear la UI
      const resPdf = await pdfPromise
      if (!resPdf.ok) mostrarToast('error', 'No se pudo regenerar el PDF')
    } catch {
      mostrarToast('error', 'Error al guardar las correcciones')
      setGenerandoPdf(false)
    } finally {
      setGuardandoEdicionAdmin(false)
    }
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
  // Solo propietarios y administradores pueden activar la edición administrativa.
  // Superadmins de Salix también, vía esPropietario virtual del JWT.
  const puedeEdicionAdmin = (esAdmin || esPropietario) && modo === 'editar'
  const esEditable = modo === 'crear'
    || estadoActual === 'borrador'
    || (modoEdicionAdmin && puedeEdicionAdmin)

  // Registrar este editor en el bus de Salix IA mientras esté en modo
  // editable: así el FAB global puede ofrecer "Armar líneas con IA" como
  // acción rápida y, al clickearla, abre acá el armador. Al desmontarse
  // o salir de editable, se desregistra para que el FAB oculte la acción.
  useEffect(() => {
    if (!esEditable) return
    const desregistrar = registrarArmador(() => setPanelIA(true))
    return desregistrar
  }, [esEditable])

  // El armador participa de la cascada de paneles flotantes — reacciona a
  // minimizar/restaurar global (doble click afuera + FAB).
  useMinimizable({ id: 'armador-presupuesto', setAbierto: setPanelIA })
  // Una vez que el presupuesto existe en BD (modo editar O modo crear ya creado),
  // habilitamos los botones de transición de estado. Antes esto dependía solo de
  // `modo === 'editar'` y obligaba a refrescar tras crear para ver Cancelar/Enviar.
  const estadosPosibles = idPresupuesto ? (TRANSICIONES_ESTADO[estadoActual] || []) : []
  const estaCancelado = !!idPresupuesto && estadoActual === 'cancelado'

  const fechaVenc = (() => {
    const f = new Date(fechaEmision)
    f.setDate(f.getDate() + diasVencimiento)
    return f
  })()

  const bloqueada = !!(config as Record<string, unknown> | null)?.validez_bloqueada

  // ─── Loading state (solo modo editar) ───────────────────────────────────

  if (cargando || (modo === 'editar' && (!presupuesto || !config))) {
    // Si ya tenemos el número (precargado server-side o llegado del fetch),
    // se muestra debajo del ícono dibujándose. En modo "crear" no hay
    // documento aún, pasamos un nombre genérico.
    const nombreLoader = modo === 'crear'
      ? 'Nuevo presupuesto'
      : (presupuesto?.numero || numeroInicial || undefined)
    return <CargaIcono icono={<FileText size={52} strokeWidth={1} />} nombre={nombreLoader} />
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
          tieneCambiosPendientes={tieneCambiosPendientes}
          ultimoGuardadoEn={ultimoGuardadoEn}
          generandoPdf={generandoPdf}
          preparandoEnvio={preparandoEnvio}
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
          onVerOT={handleVerOT}
          generandoOT={generandoOT}
          ordenTrabajoVinculada={presupuesto?.orden_trabajo ?? null}
          puedeEdicionAdmin={puedeEdicionAdmin}
          modoEdicionAdmin={modoEdicionAdmin}
          onActivarEdicionAdmin={activarEdicionAdmin}
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

        {/* ─── Banner de edición administrativa ─── */}
        {modo === 'editar' && modoEdicionAdmin && (
          <BannerEdicionAdmin
            estadoActual={estadoActual}
            guardando={guardandoEdicionAdmin}
            onGuardar={guardarEdicionAdmin}
            onCancelar={cancelarEdicionAdmin}
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
            direccionIdSeleccionada={direccionIdSeleccionada}
            onSeleccionarContacto={seleccionarContacto}
            onLimpiarContacto={limpiarContacto}
            onSeleccionarAtencion={seleccionarAtencion}
            onCambiarDireccion={cambiarDireccionCliente}
            onCambiarContactoEditar={async (c) => {
              if (c) {
                // Cambiar de contacto invalida la visita previa: la visita
                // pertenece al contacto anterior. El backend además limpia
                // visita_id cuando contacto_id pasa a null; acá lo hacemos
                // explícito para mantener consistencia incluso al reasignar.
                const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contacto_id: c.id, atencion_contacto_id: null, atencion_nombre: null, atencion_correo: null, visita_id: null }),
                })
                if (res.ok) {
                  const act = await res.json()
                  setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                  setContactoId(c.id)
                  setContactoSeleccionado(c as ContactoResumido)
                  setAtencionId(null)
                  setAtencionSeleccionada(null)
                  setDireccionIdSeleccionada(null)
                  setVisitaId(null)
                  fetch(`/api/contactos/${c.id}`)
                    .then(r => r.json())
                    .then(data => setVinculaciones(unirVinculaciones(data.vinculaciones, data.vinculaciones_inversas)))
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
                  setDireccionIdSeleccionada(null)
                  setVisitaId(null)
                }
              }
            }}
            visitaId={visitaId}
            onCambiarVisita={async (nuevaVisitaId) => {
              setVisitaId(nuevaVisitaId)
              // En modo editar autoguardamos contra el backend; en modo crear
              // el state queda en local y se envía con el POST de creación.
              if (modo === 'editar' && idPresupuesto) {
                const res = await fetch(`/api/presupuestos/${idPresupuesto}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ visita_id: nuevaVisitaId }),
                })
                if (res.ok) {
                  const act = await res.json()
                  setPresupuesto(prev => prev ? { ...prev, ...act } : null)
                } else {
                  // Rollback si el backend rechaza (ej. visita inválida).
                  setVisitaId(prev => prev === nuevaVisitaId ? (presupuesto?.visita_id || null) : prev)
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
              if (Array.isArray(tpl.columnas_lineas) && tpl.columnas_lineas.length) {
                const cols = tpl.columnas_lineas as string[]
                setColumnasVisibles(cols)
                autoguardar({ columnas_lineas: cols })
              }
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
                columnas_lineas: columnasVisibles,
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
                  columnas_lineas: columnasVisibles,
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
          {/* El link "Redactar con Salix IA" se renderea ahora dentro de
              TablaLineas como una opción más en la fila de acciones
              (Agregar producto | Sección | Nota | Descuento | Salix IA),
              para mantener todas las formas de "agregar contenido" juntas.
              También se puede invocar desde el FAB global (mismo bus). */}

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
            onAbrirAsistenteIA={esEditable ? () => setPanelIA(true) : undefined}
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
            placeholder="Escribe una condicion..."
            soloLectura={!esEditable}
            etiqueta={t('documentos.terminos')}
          />
        </div>

        {/* Los pagos se registran desde la barra del chatter y se muestran
            ahí como entradas distintivas (EntradaPago). No hay sección
            dedicada arriba del historial para evitar duplicar información. */}

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
          ref={refPanelChatter}
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
          onRegistrarPago={
            (presupuesto?.permisos?.editar ?? true) &&
            !['cancelado', 'rechazado'].includes(estadoActual)
              ? abrirModalPagoDesdeChatter
              : undefined
          }
          onEditarPago={
            (presupuesto?.permisos?.editar ?? true) &&
            !['cancelado', 'rechazado'].includes(estadoActual)
              ? abrirEditarPago
              : undefined
          }
          onEliminarPago={
            (presupuesto?.permisos?.editar ?? true) &&
            !['cancelado', 'rechazado'].includes(estadoActual)
              ? confirmarEliminarPago
              : undefined
          }
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

      {/* ─── Modal registrar/editar pago ─── */}
      {modo === 'editar' && idPresupuesto && presupuesto && (
        <ModalRegistrarPago
          abierto={modalPagoAbierto}
          onCerrar={() => {
            setModalPagoAbierto(false)
            setChatterOrigenPago(null)
            setPagoEditando(null)
          }}
          presupuestoId={idPresupuesto}
          presupuestoNumero={presupuesto.numero}
          monedaPresupuesto={moneda}
          totalPresupuesto={Number(presupuesto.total_final) || 0}
          cuotas={presupuesto.cuotas || []}
          pago={pagoEditando}
          monedasDisponibles={monedas}
          chatterOrigenId={chatterOrigenPago?.id || null}
          adjuntosOrigen={chatterOrigenPago?.adjuntos}
          origenDescripcion={
            chatterOrigenPago
              ? chatterOrigenPago.tipo === 'correo'
                ? `correo de ${chatterOrigenPago.metadata?.correo_de || chatterOrigenPago.autor_nombre || 'origen'}`
                : chatterOrigenPago.tipo === 'whatsapp'
                  ? `WhatsApp de ${chatterOrigenPago.autor_nombre || 'origen'}`
                  : `mensaje de ${chatterOrigenPago.autor_nombre || 'origen'}`
              : null
          }
          onPagoGuardado={() => setRecargaPagosNonce(n => n + 1)}
        />
      )}

      {/* Confirmación de eliminación de pago */}
      <ModalConfirmacion
        abierto={!!pagoEliminando}
        onCerrar={() => setPagoEliminando(null)}
        onConfirmar={ejecutarEliminarPago}
        titulo="Eliminar pago"
        descripcion={
          pagoEliminando
            ? `¿Eliminar el pago de ${Number(pagoEliminando.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${pagoEliminando.moneda}? Si tenía comprobante adjunto también será eliminado.`
            : ''
        }
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
      />

      {/* ─── Modal enviar documento por correo ─── */}
      <ModalEnviarDocumento
        abierto={modalEnviarAbierto}
        onCerrar={() => {
          setModalEnviarAbierto(false)
          setCorreoLibre(false)
          setEstadoSincronizacion(null)
          setMensajeSincronizacion(null)
        }}
        estadoSincronizacion={estadoSincronizacion}
        mensajeSincronizacion={mensajeSincronizacion}
        onReintentarSincronizacion={sincronizarParaEnvio}
        onEnviar={handleEnviarCorreo}
        canales={canalesCorreo}
        plantillas={correoLibre ? [] : plantillasCorreo}
        contactoPrincipalId={contactoSeleccionado?.id || null}
        contactoPrincipalNombre={
          contactoSeleccionado
            ? `${contactoSeleccionado.nombre} ${contactoSeleccionado.apellido || ''}`.trim()
            : presupuesto?.contacto_nombre
              ? `${presupuesto.contacto_nombre} ${presupuesto.contacto_apellido || ''}`.trim()
              : null
        }
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
        tamano="md"
        acciones={
          <div className="flex items-center justify-between gap-2 w-full">
            <Boton variante="fantasma" tamano="sm" onClick={() => setModalVencimiento(null)}>
              Cancelar
            </Boton>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tamano="sm" onClick={continuarSinActualizarVencimiento}>
                Confirmar igual
              </Boton>
              <Boton variante="primario" tamano="sm" onClick={confirmarVencimientoYCambiarEstado}>
                Actualizar fecha
              </Boton>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-full bg-insignia-advertencia/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-insignia-advertencia" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-texto-primario">
                Este presupuesto ya venció. El portal del cliente no le permite aceptarlo.
              </p>
              <p className="text-sm text-texto-terciario">
                Podés confirmarlo igual —por ejemplo si el cliente ya pagó un adelanto— o extender la fecha de vencimiento.
              </p>
            </div>
          </div>

          <div className="rounded-card border border-borde-sutil bg-white/[0.02] p-3 space-y-2">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
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
            <p className="text-xs text-texto-terciario">
              Solo se aplica si elegís “Actualizar fecha”.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

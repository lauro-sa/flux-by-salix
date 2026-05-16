'use client'

/**
 * ModalEnviarReciboNomina — Enviar recibos de nómina por correo o WhatsApp.
 *
 * Modo individual (1 empleado): abre ModalEnviarDocumento (correo) o envío directo (WA).
 * Modo lote (varios empleados): preview + lista de destinatarios + envío masivo.
 *
 * Se usa en: ModalNomina.tsx
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalEnviarDocumento } from '@/componentes/entidad/ModalEnviarDocumento'
import { resolverVariables } from '@/lib/variables/resolver'
import {
  construirDatosPlantilla,
  resolverTextoPlantilla,
} from '@/lib/whatsapp/variables'
import { construirLineasAjustes } from '@/lib/nominas/lineas-ajustes'
import {
  ASUNTO_RECIBO_NOMINA,
  HTML_RECIBO_NOMINA,
  construirContextoNomina,
  type DatosNominaCorreo,
} from '@/lib/plantilla-correo-nomina'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import type { CanalCorreoEmpresa, PlantillaCorreo } from '@/componentes/entidad/_enviar_documento/tipos'
import '@/lib/variables/entidades'
import {
  Send, Loader2, CheckCircle2, AlertCircle,
  Mail, UserX, Users, Phone, MessageSquare,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'

// ─── Tipos ───────────────────────────────────────────────────

interface ResultadoNominaConCorreo {
  miembro_id: string
  nombre: string
  correo: string
  telefono: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_ausentes: number
  dias_tardanza: number
  horas_brutas: number
  horas_netas: number
  horas_almuerzo: number
  horas_particular: number
  horas_totales: number
  promedio_horas_diario: number
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  descuenta_almuerzo: boolean
  duracion_almuerzo_config: number
  dias_feriados: number
  dias_trabajados_feriado: number
  monto_pagar: number
  monto_detalle: string
  // Campos opcionales que ahora resuelve la plantilla nueva (neto + descuentos).
  // El backend de /api/nominas ya los devuelve; el padre los propaga.
  monto_neto?: number
  descuento_adelanto?: number
  saldo_anterior?: number
  /** Bonos one-off del período (sql/092). Suman al neto. */
  bonos_periodo?: number
  /** Conceptos del contrato aplicados al período (Presentismo, Antigüedad, etc.). */
  conceptos_aplicados?: { tipo: 'haber' | 'descuento'; nombre: string; monto: number; detalle?: string | null }[]
}

interface PlantillaWA {
  id: string
  nombre_api: string
  idioma: string
  estado_meta: string
  componentes: {
    encabezado?: { tipo: string; texto?: string }
    cuerpo: { texto: string }
    pie_pagina?: { texto?: string }
  }
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  resultados: ResultadoNominaConCorreo[]
  etiquetaPeriodo: string
  /** Fecha desde del período (YYYY-MM-DD). Necesaria para filtrar adelantos
   *  que caen en el período y armar `detalle_descuentos` en el preview WA. */
  periodoDesde?: string
  /** Fecha hasta del período (YYYY-MM-DD). */
  periodoHasta?: string
  nombreEmpresa: string
}

// ─── Helpers ─────────────────────────────────────────────────

type CanalEnvio = 'correo' | 'whatsapp'

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`
}

function construirDatosEmpleado(r: ResultadoNominaConCorreo, etiquetaPeriodo: string): DatosNominaCorreo {
  const diasLab = r.dias_laborales || 1
  return ({
    miembro_id: r.miembro_id,
    nombre_empleado: r.nombre,
    correo_empleado: r.correo,
    periodo: etiquetaPeriodo,
    dias_trabajados: r.dias_trabajados,
    dias_laborales: r.dias_laborales,
    dias_ausentes: r.dias_ausentes,
    dias_tardanza: r.dias_tardanza,
    horas_brutas: fmtHoras(r.horas_brutas),
    horas_netas: fmtHoras(r.horas_netas),
    horas_almuerzo: fmtHoras(r.horas_almuerzo),
    horas_particular: fmtHoras(r.horas_particular),
    promedio_diario: fmtHoras(r.promedio_horas_diario),
    dias_con_almuerzo: r.dias_con_almuerzo,
    dias_con_salida_particular: r.dias_con_salida_particular,
    descuenta_almuerzo: r.descuenta_almuerzo,
    dias_feriados: r.dias_feriados || 0,
    dias_trabajados_feriado: r.dias_trabajados_feriado || 0,
    porcentaje_asistencia: `${Math.round((r.dias_trabajados / diasLab) * 100)}%`,
    compensacion_tipo: r.compensacion_tipo,
    compensacion_detalle: r.monto_detalle,
    monto_bruto: r.monto_pagar,
    // Desglose del recibo para la sección de conceptos del correo:
    // los conceptos del motor (Presentismo, Antigüedad, etc.) + los
    // ajustes one-off del período (bonos, adelantos, descuentos) +
    // el saldo anterior + el neto. Si no hay conceptos ni ajustes,
    // la sección se omite del correo.
    conceptos_recibo: (r.conceptos_aplicados ?? []).map(c => ({
      tipo: c.tipo,
      nombre: c.nombre,
      monto: c.monto,
      detalle: c.detalle ?? null,
    })),
    bono_total: r.bonos_periodo ?? 0,
    adelanto_total: r.descuento_adelanto ?? 0,
    saldo_anterior: r.saldo_anterior ?? 0,
    monto_neto: r.monto_neto,
  }) as DatosNominaCorreo
}

/** Formatea texto WA: *negrita*, _cursiva_ */
function formatearTextoWA(texto: string): string {
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')
  return html
}

/**
 * Resuelve las variables de la plantilla WA con datos del empleado.
 * Usa el flujo unificado (`construirDatosPlantilla` + `resolverTextoPlantilla`)
 * basado en el `mapeo_variables` de la plantilla — soporta cualquier número y
 * orden de variables sin hardcodeo.
 *
 * `lineasDescuentos` se construye fuera (con `construirLineasAjustes`)
 * porque requiere fetch de adelantos del empleado.
 */
function resolverPreviewWA(
  plantilla: PlantillaWA,
  r: ResultadoNominaConCorreo,
  etiquetaPeriodo: string,
  lineasDescuentos: string[],
): { encabezado: string; cuerpo: string; pie: string } {
  const detalleLegacy = lineasDescuentos.join('\n')
  // Conceptos del recibo formateados como una lista de líneas legibles
  // — la plantilla de WhatsApp suele meterlos como variable
  // {{nomina.detalle_haberes}} / {{nomina.detalle_descuentos}}.
  const haberes = (r.conceptos_aplicados ?? []).filter(c => c.tipo === 'haber')
  const descuentos = (r.conceptos_aplicados ?? []).filter(c => c.tipo === 'descuento')
  const fmtMoneda = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  const lineasHaberes = haberes.map(h => `+ ${h.nombre}: ${fmtMoneda(h.monto)}`)
  const lineasConceptosDesc = descuentos.map(d => `- ${d.nombre}: ${fmtMoneda(d.monto)}`)

  const datos = construirDatosPlantilla({
    nomina: {
      nombre: r.nombre,
      periodo: etiquetaPeriodo,
      dias_trabajados: r.dias_trabajados,
      dias_laborales: r.dias_laborales,
      dias_tardanza: r.dias_tardanza,
      monto_pagar: r.monto_pagar,
      monto_neto: r.monto_neto ?? r.monto_pagar,
      descuento_adelanto: r.descuento_adelanto ?? 0,
      saldo_anterior: r.saldo_anterior ?? 0,
      monto_detalle: r.monto_detalle,
      detalle_descuentos: detalleLegacy,
      descuentos_lista: lineasDescuentos,
      // Conceptos del contrato (Presentismo, Antigüedad, etc.) +
      // bonos/adelantos del período. Las plantillas WA pueden
      // pintarlos con {{nomina.detalle_haberes}} y
      // {{nomina.detalle_descuentos_conceptos}}.
      bono_total: r.bonos_periodo ?? 0,
      detalle_haberes: lineasHaberes.join('\n'),
      haberes_lista: lineasHaberes,
      detalle_descuentos_conceptos: lineasConceptosDesc.join('\n'),
      descuentos_conceptos_lista: lineasConceptosDesc,
    },
  })

  const cuerpoPlantilla = plantilla.componentes.cuerpo as
    | { texto: string; mapeo_variables?: string[]; ejemplos?: string[] }
    | undefined

  const cuerpo = resolverTextoPlantilla(
    cuerpoPlantilla?.texto || '',
    cuerpoPlantilla,
    datos,
  )

  // Header: admite una sola variable {{1}}. Si la plantilla tiene `mapeo_variable`
  // (ej. "periodo"), usamos el dato real de ese campo. Caso contrario, fallback
  // al período del modal (compat con plantillas viejas sin mapeo).
  const enc = plantilla.componentes.encabezado as
    | { texto?: string; mapeo_variable?: string }
    | undefined
  const claveHeader = enc?.mapeo_variable
  const valorHeader = (claveHeader && datos[claveHeader]) || etiquetaPeriodo
  const encabezado = (enc?.texto || '').replace(/\{\{1\}\}/g, valorHeader)

  const pie = plantilla.componentes.pie_pagina?.texto || ''
  return { encabezado, cuerpo, pie }
}

// Las líneas de descuentos y bonos del período se arman con el helper
// compartido `construirLineasAjustes` (src/lib/nominas/lineas-ajustes.ts).
// Antes vivía duplicado acá y en el backend de WhatsApp — drift garantizado.

// ─── Estado del envío en lote ────────────────────────────────

type EstadoEnvio = 'idle' | 'enviando' | 'completado'

interface ResultadoEnvioLote {
  enviados: number
  fallidos: number
  total: number
  resultados: { correo?: string; telefono?: string; nombre?: string; ok: boolean; error?: string }[]
}

// ─── Componente ──────────────────────────────────────────────

export function ModalEnviarReciboNomina({
  abierto,
  onCerrar,
  resultados,
  etiquetaPeriodo,
  periodoDesde,
  periodoHasta,
  nombreEmpresa,
}: PropiedadesModal) {
  const { t } = useTraduccion()
  const fmt = useFormato()

  // Canal de envío: correo o whatsapp
  const [canalTipo, setCanalTipo] = useState<CanalEnvio>('correo')

  // Canales y plantillas de correo
  const [canalesCorreo, setCanalesCorreo] = useState<CanalCorreoEmpresa[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<PlantillaCorreo[]>([])
  const [canalCorreoSeleccionado, setCanalCorreoSeleccionado] = useState('')

  // Canal y plantilla de WhatsApp
  const [canalesWA, setCanalesWA] = useState<{ id: string; nombre: string; credenciales_validas?: boolean; credenciales_faltantes?: string[] }[]>([])
  const [canalWASeleccionado, setCanalWASeleccionado] = useState('')
  const [plantillaWA, setPlantillaWA] = useState<PlantillaWA | null>(null)

  // Estado del envío
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>('idle')
  const [resultadoLote, setResultadoLote] = useState<ResultadoEnvioLote | null>(null)

  // Para modo individual correo: abrir ModalEnviarDocumento
  const [modalIndividualAbierto, setModalIndividualAbierto] = useState(false)

  // Empleados filtrados según canal
  const empleadosConCorreo = useMemo(() => resultados.filter(r => r.correo), [resultados])
  const empleadosSinCorreo = useMemo(() => resultados.filter(r => !r.correo), [resultados])
  const empleadosConTelefono = useMemo(() => resultados.filter(r => r.telefono), [resultados])
  const empleadosSinTelefono = useMemo(() => resultados.filter(r => !r.telefono), [resultados])

  const empleadosDisponibles = canalTipo === 'correo' ? empleadosConCorreo : empleadosConTelefono
  const empleadosNoDisponibles = canalTipo === 'correo' ? empleadosSinCorreo : empleadosSinTelefono

  const esIndividualCorreo = resultados.length === 1 && empleadosConCorreo.length === 1

  // Plantilla de nómina de BD (si existe, sobreescribe las constantes)
  const [asuntoNomina, setAsuntoNomina] = useState(ASUNTO_RECIBO_NOMINA)
  const [htmlNomina, setHtmlNomina] = useState(HTML_RECIBO_NOMINA)

  // Líneas de adelantos/descuentos del primer empleado para el preview WA.
  // Se carga al abrir el modal si tenemos rango de fechas del período.
  const [lineasDescuentosPreview, setLineasDescuentosPreview] = useState<string[]>([])

  // Cargar canales al abrir
  useEffect(() => {
    if (!abierto) return
    setEstadoEnvio('idle')
    setResultadoLote(null)

    // ─── Defaults del módulo Nóminas ───
    // Si el operador configuró canal/plantilla default en
    // Nóminas → Configuración → Plantillas de envío, usamos esos.
    // Si no, caemos al fallback histórico (predeterminado del canal,
    // plantilla detectada por convención de nombre).
    let configNomina: {
      canal_correo_default_id: string | null
      plantilla_correo_default_id: string | null
      canal_whatsapp_default_id: string | null
      plantilla_whatsapp_default_id: string | null
    } | null = null
    const promesaConfig = fetch('/api/nominas/configuracion')
      .then(r => r.ok ? r.json() : null)
      .then(data => { configNomina = data?.configuracion ?? null })
      .catch(() => { configNomina = null })

    // Canales de correo
    promesaConfig.then(() => fetch('/api/correo/canales?modulo=asistencias')
      .then(r => r.json())
      .then(data => {
        const mapped: CanalCorreoEmpresa[] = ((data.canales || []) as Record<string, unknown>[])
          .filter((c) => c.tipo === 'correo' && c.estado_conexion === 'conectado')
          .map((c) => {
            const config = c.config_conexion as Record<string, string> | null
            return {
              id: c.id as string,
              nombre: c.nombre as string,
              email: config?.email || config?.usuario || '',
              predeterminado: (c.es_principal as boolean) || false,
            }
          })
        setCanalesCorreo(mapped)
        const defaultModulo = configNomina?.canal_correo_default_id
        const elegido = (defaultModulo && mapped.some(c => c.id === defaultModulo))
          ? defaultModulo
          : (mapped.find(c => c.predeterminado)?.id || mapped[0]?.id || '')
        setCanalCorreoSeleccionado(elegido)
      })
      .catch(() => {}))

    // Canales de WhatsApp — incluimos los marcados "conectado" pero exponemos
    // si tienen credenciales válidas para que la UI bloquee el envío con un
    // mensaje claro en vez de fallar contra Meta con error 190.
    promesaConfig.then(() => fetch('/api/whatsapp/canales')
      .then(r => r.json())
      .then(data => {
        const mapped = ((data.canales || []) as Record<string, unknown>[])
          .filter((c) => c.tipo === 'whatsapp' && c.estado_conexion === 'conectado')
          .map((c) => ({
            id: c.id as string,
            nombre: c.nombre as string,
            credenciales_validas: (c.credenciales_validas as boolean | undefined) ?? true,
            credenciales_faltantes: (c.credenciales_faltantes as string[] | undefined) ?? [],
          }))
        setCanalesWA(mapped)
        const defaultModulo = configNomina?.canal_whatsapp_default_id
        const elegido = (defaultModulo && mapped.some(c => c.id === defaultModulo))
          ? defaultModulo
          : mapped[0]?.id || ''
        setCanalWASeleccionado(elegido)
      })
      .catch(() => {}))

    // Plantilla de WhatsApp para nómina
    promesaConfig.then(() => fetch('/api/whatsapp/plantillas?modulo=asistencias')
      .then(r => r.json())
      .then(data => {
        const plantillas = (data.plantillas || []) as PlantillaWA[]
        const defaultModulo = configNomina?.plantilla_whatsapp_default_id
        const elegida = (defaultModulo && plantillas.find(p => p.id === defaultModulo))
          || plantillas.find(p => p.nombre_api === 'recibo_haberes_nomina')
        if (elegida) setPlantillaWA(elegida)
      })
      .catch(() => {}))

    // Plantillas de correo — preferir la default de nóminas si está
    // configurada, sino caer a la convención de clave_sistema.
    promesaConfig.then(() => fetch('/api/correo/plantillas')
      .then(r => r.json())
      .then(data => {
        const todas = (data.plantillas || []) as (PlantillaCorreo & { clave_sistema?: string })[]
        setPlantillasCorreo(todas)
        const defaultModulo = configNomina?.plantilla_correo_default_id
        const elegida = (defaultModulo && todas.find(p => p.id === defaultModulo))
          || todas.find(p => p.clave_sistema?.endsWith('_recibo_nomina'))
        if (elegida?.asunto) setAsuntoNomina(elegida.asunto)
        if (elegida?.contenido_html) setHtmlNomina(elegida.contenido_html)
      })
      .catch(() => {}))

    // Detalle de adelantos/descuentos para el preview WA. Tomamos el primer
    // empleado con teléfono (envío real) o el primero a secas (preview puro).
    const empleadoPreview = resultados.find(r => r.telefono) || resultados[0]
    if (empleadoPreview && periodoDesde && periodoHasta) {
      fetch(`/api/adelantos?miembro_id=${empleadoPreview.miembro_id}`)
        .then(r => r.json())
        .then(data => {
          const adelantos = data?.adelantos || []
          const saldo = empleadoPreview.saldo_anterior ?? 0
          // Mismo helper que usa el backend WA → lo que se ve en el preview
          // es exactamente lo que va a recibir el empleado. Tomamos solo
          // `descuentos` para mantener compat con la plantilla actual.
          const { descuentos } = construirLineasAjustes(adelantos, periodoDesde, periodoHasta, {
            saldoAnterior: saldo,
          })
          setLineasDescuentosPreview(descuentos)
        })
        .catch(() => setLineasDescuentosPreview([]))
    } else {
      setLineasDescuentosPreview([])
    }
  }, [abierto, resultados, periodoDesde, periodoHasta])

  // Ya no abrimos automáticamente el modal individual — el usuario elige canal primero

  // ─── Contexto correo ───
  const contextoPrimerEmpleado = useMemo(() => {
    if (!empleadosConCorreo.length) return {}
    const datos = construirDatosEmpleado(empleadosConCorreo[0], etiquetaPeriodo)
    return construirContextoNomina(datos, nombreEmpresa)
  }, [empleadosConCorreo, etiquetaPeriodo, nombreEmpresa])

  const htmlPreview = useMemo(() => resolverVariables(htmlNomina, contextoPrimerEmpleado), [htmlNomina, contextoPrimerEmpleado])
  const asuntoPreview = useMemo(() => resolverVariables(asuntoNomina, contextoPrimerEmpleado), [asuntoNomina, contextoPrimerEmpleado])

  // ─── Preview WhatsApp ───
  // Mostrar preview con el primer empleado disponible (con o sin teléfono).
  // La previsualización es independiente del envío real: el usuario debe
  // poder evaluar el mensaje aunque el empleado no tenga teléfono o la
  // plantilla esté en BORRADOR/PENDING.
  const empleadoParaPreview = empleadosConTelefono[0] || resultados[0] || null
  const previewWA = useMemo(() => {
    if (!plantillaWA || !empleadoParaPreview) return null
    return resolverPreviewWA(plantillaWA, empleadoParaPreview, etiquetaPeriodo, lineasDescuentosPreview)
  }, [plantillaWA, empleadoParaPreview, etiquetaPeriodo, lineasDescuentosPreview])

  // ─── Enviar correo en lote ───
  const enviarCorreoEnLote = useCallback(async () => {
    if (!canalCorreoSeleccionado || !empleadosConCorreo.length) return
    setEstadoEnvio('enviando')

    const empleadosData = empleadosConCorreo.map(r => construirDatosEmpleado(r, etiquetaPeriodo))

    try {
      const res = await fetch('/api/nominas/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: canalCorreoSeleccionado,
          asunto_plantilla: asuntoNomina,
          html_plantilla: htmlNomina,
          empleados: empleadosData,
          nombre_empresa: nombreEmpresa,
          // Período del recibo: el backend lo usa para buscar el pago
          // grabado del empleado y adjuntar el PDF del recibo si existe.
          periodo_desde: periodoDesde,
          periodo_hasta: periodoHasta,
        }),
      })
      const data = await res.json()
      setResultadoLote(data)
      setEstadoEnvio('completado')
    } catch {
      setEstadoEnvio('completado')
      setResultadoLote({ enviados: 0, fallidos: empleadosConCorreo.length, total: empleadosConCorreo.length, resultados: [] })
    }
  }, [canalCorreoSeleccionado, empleadosConCorreo, etiquetaPeriodo, nombreEmpresa, asuntoNomina, htmlNomina, periodoDesde, periodoHasta])

  // ─── Enviar WhatsApp en lote ───
  const enviarWAEnLote = useCallback(async () => {
    if (!canalWASeleccionado || !plantillaWA || !empleadosConTelefono.length) return
    setEstadoEnvio('enviando')

    // Mandamos todos los campos brutos al backend; las variables a Meta se
    // resuelven server-side usando el `mapeo_variables` de la plantilla
    // aprobada — así sumar/quitar variables sólo requiere editar la plantilla.
    const empleadosData = empleadosConTelefono.map(r => ({
      miembro_id: r.miembro_id,
      nombre: r.nombre,
      telefono: r.telefono,
      dias_trabajados: r.dias_trabajados,
      dias_laborales: r.dias_laborales,
      dias_a_horario: Math.max(0, r.dias_trabajados - r.dias_tardanza),
      dias_tardanza: r.dias_tardanza,
      monto_pagar: r.monto_pagar,
      monto_bruto: fmtMonto(r.monto_pagar),
      monto_neto: r.monto_neto ?? r.monto_pagar,
      descuento_adelanto: r.descuento_adelanto ?? 0,
      bonos_periodo: r.bonos_periodo ?? 0,
      saldo_anterior: r.saldo_anterior ?? 0,
      compensacion_detalle: r.monto_detalle,
      periodo: etiquetaPeriodo,
    }))

    try {
      const res = await fetch('/api/nominas/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: canalWASeleccionado,
          plantilla_id: plantillaWA.id,
          // Necesario para que el backend filtre adelantos del período al
          // armar `detalle_descuentos`.
          periodo_desde: periodoDesde,
          periodo_hasta: periodoHasta,
          empleados: empleadosData,
        }),
      })
      const data = await res.json()
      setResultadoLote(data)
      setEstadoEnvio('completado')
    } catch {
      setEstadoEnvio('completado')
      setResultadoLote({ enviados: 0, fallidos: empleadosConTelefono.length, total: empleadosConTelefono.length, resultados: [] })
    }
  }, [canalWASeleccionado, plantillaWA, empleadosConTelefono, etiquetaPeriodo, periodoDesde, periodoHasta])

  const enviarEnLote = useCallback(() => {
    // Modo individual correo: abrir editor completo
    if (canalTipo === 'correo' && esIndividualCorreo) {
      setModalIndividualAbierto(true)
      return
    }
    if (canalTipo === 'correo') return enviarCorreoEnLote()
    return enviarWAEnLote()
  }, [canalTipo, esIndividualCorreo, enviarCorreoEnLote, enviarWAEnLote])

  // ─── Envío individual correo ───
  const handleEnviarIndividual = useCallback(async (datos: {
    canal_id: string
    correo_para: string[]
    correo_cc: string[]
    correo_cco: string[]
    asunto: string
    html: string
    texto: string
    adjuntos_ids: string[]
  }) => {
    const htmlFinal = construirHtmlCorreoDocumento({
      htmlCuerpo: datos.html,
      incluirPortal: false,
      empresa: { nombre: nombreEmpresa },
    })

    await fetch('/api/inbox/correo/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal_id: datos.canal_id,
        correo_para: datos.correo_para,
        correo_cc: datos.correo_cc,
        correo_cco: datos.correo_cco,
        correo_asunto: datos.asunto,
        texto: datos.asunto,
        html: htmlFinal,
        tipo: 'nuevo',
        adjuntos_ids: datos.adjuntos_ids,
      }),
    })

    setModalIndividualAbierto(false)
    onCerrar()
  }, [nombreEmpresa, onCerrar])

  const htmlResueltoIndividual = useMemo(() => {
    if (!esIndividualCorreo || !empleadosConCorreo.length) return ''
    return resolverVariables(htmlNomina, contextoPrimerEmpleado)
  }, [esIndividualCorreo, empleadosConCorreo.length, contextoPrimerEmpleado, htmlNomina])

  const asuntoResueltoIndividual = useMemo(() => {
    if (!esIndividualCorreo || !empleadosConCorreo.length) return ''
    return resolverVariables(asuntoNomina, contextoPrimerEmpleado)
  }, [esIndividualCorreo, empleadosConCorreo.length, contextoPrimerEmpleado, asuntoNomina])

  // ─── Validaciones WhatsApp ───
  const plantillaWAAprobada = plantillaWA?.estado_meta === 'APPROVED'
  // Un canal puede estar marcado "conectado" pero sin credenciales (token vacío,
  // expirado, etc.). Si no tiene credenciales no se puede enviar — Meta devuelve
  // error 190. Bloqueamos el botón con mensaje claro antes de llegar a la API.
  const canalActual = canalesWA.find(c => c.id === canalWASeleccionado)
  const canalTieneCredenciales = canalActual?.credenciales_validas !== false
  const puedeEnviarWA = canalWASeleccionado && plantillaWAAprobada && canalTieneCredenciales && empleadosConTelefono.length > 0
  const puedeEnviarCorreo = canalCorreoSeleccionado && empleadosConCorreo.length > 0

  // ─── Sub-modal individual correo (se abre desde el botón Enviar) ───
  if (modalIndividualAbierto && esIndividualCorreo && canalTipo === 'correo') {
    const emp = empleadosConCorreo[0]
    if (emp) {
      return (
        <ModalEnviarDocumento
          abierto
          onCerrar={() => { setModalIndividualAbierto(false); onCerrar() }}
          onEnviar={handleEnviarIndividual}
          canales={canalesCorreo}
          plantillas={plantillasCorreo}
          correosDestinatario={[emp.correo]}
          nombreDestinatario={emp.nombre}
          asuntoPredeterminado={asuntoResueltoIndividual}
          htmlInicial={htmlResueltoIndividual}
          tipoDocumento="nomina"
          contextoVariables={contextoPrimerEmpleado}
          pdfDesactivadoInicial
          portalDesactivadoInicial
        />
      )
    }
  }

  // ─── Modal principal (lote o individual WA) ───
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Enviar recibos — ${etiquetaPeriodo}`}
      tamano="lg"
      acciones={
        estadoEnvio === 'completado' ? (
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cerrar</Boton>
        ) : (
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-texto-terciario">
              {empleadosDisponibles.length} destinatario{empleadosDisponibles.length !== 1 ? 's' : ''}
              {empleadosNoDisponibles.length > 0 && (
                <span className="text-insignia-advertencia ml-2">
                  · {empleadosNoDisponibles.length} sin {canalTipo === 'correo' ? 'correo' : 'teléfono'}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
              <Boton
                tamano="sm"
                onClick={enviarEnLote}
                disabled={
                  estadoEnvio === 'enviando' ||
                  (canalTipo === 'correo' ? !puedeEnviarCorreo : !puedeEnviarWA)
                }
              >
                {estadoEnvio === 'enviando' ? (
                  <><Loader2 size={13} className="mr-1 animate-spin" /> Enviando...</>
                ) : (
                  <><Send size={13} className="mr-1" /> Enviar {empleadosDisponibles.length > 1 ? 'todos' : ''}</>
                )}
              </Boton>
            </div>
          </div>
        )
      }
    >
      {/* Estado completado */}
      {estadoEnvio === 'completado' && resultadoLote && (
        <div className="space-y-4">
          <div className="text-center py-6">
            {resultadoLote.fallidos === 0 ? (
              <>
                <CheckCircle2 size={40} className="mx-auto text-insignia-exito mb-3" />
                <p className="text-lg font-semibold text-texto-primario">
                  {resultadoLote.enviados} recibo{resultadoLote.enviados !== 1 ? 's' : ''} enviado{resultadoLote.enviados !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-texto-terciario mt-1">
                  {canalTipo === 'correo' ? 'Correos enviados correctamente.' : 'Mensajes de WhatsApp enviados correctamente.'}
                </p>
              </>
            ) : (
              <>
                <AlertCircle size={40} className="mx-auto text-insignia-advertencia mb-3" />
                <p className="text-lg font-semibold text-texto-primario">
                  {resultadoLote.enviados} enviado{resultadoLote.enviados !== 1 ? 's' : ''}, {resultadoLote.fallidos} fallido{resultadoLote.fallidos !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </div>

          {resultadoLote.resultados.filter(r => !r.ok).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-texto-terciario mb-2">Errores:</p>
              {resultadoLote.resultados.filter(r => !r.ok).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-insignia-peligro bg-insignia-peligro/10 rounded-boton px-3 py-2">
                  <AlertCircle size={12} />
                  <span>{r.nombre || r.correo || r.telefono || 'Desconocido'}: {r.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado normal / enviando */}
      {estadoEnvio !== 'completado' && (
        <div className="space-y-4">
          {/* Selector de canal: Correo / WhatsApp */}
          <div className="flex gap-2">
            <button
              onClick={() => setCanalTipo('correo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium transition-all cursor-pointer border ${
                canalTipo === 'correo'
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
              }`}
            >
              <Mail size={14} />
              Correo
              {empleadosConCorreo.length > 0 && (
                <span className="text-xs opacity-70">({empleadosConCorreo.length})</span>
              )}
            </button>
            <button
              onClick={() => setCanalTipo('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium transition-all cursor-pointer border ${
                canalTipo === 'whatsapp'
                  ? 'bg-[#25D366]/15 border-[#25D366]/40 text-[#25D366]'
                  : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:border-white/[0.12] hover:text-texto-secundario'
              }`}
            >
              <IconoWhatsApp size={14} />
              WhatsApp
              {empleadosConTelefono.length > 0 && (
                <span className="text-xs opacity-70">({empleadosConTelefono.length})</span>
              )}
            </button>
          </div>

          {/* ─── Contenido CORREO ─── */}
          {canalTipo === 'correo' && (
            <div className="space-y-4">
              {canalesCorreo.length > 1 && (
                <Select
                  etiqueta="Enviar desde"
                  opciones={canalesCorreo.map(c => ({ valor: c.id, etiqueta: `${c.nombre} (${c.email})` }))}
                  valor={canalCorreoSeleccionado}
                  onChange={setCanalCorreoSeleccionado}
                />
              )}

              <div>
                <label className="text-xs font-medium text-texto-terciario mb-1 block">Asunto (preview)</label>
                <div className="text-sm bg-superficie-elevada/30 border border-borde-sutil rounded-card px-3 py-2 text-texto-primario">
                  {asuntoPreview}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-texto-terciario mb-1 block">
                  Contenido (preview para {empleadosConCorreo[0]?.nombre || 'empleado'})
                </label>
                <HtmlSeguro
                  html={htmlPreview}
                  className="text-sm bg-superficie-elevada/20 border border-borde-sutil rounded-card px-4 py-3 max-h-[300px] overflow-y-auto prose prose-sm prose-invert"
                />
              </div>
            </div>
          )}

          {/* ─── Contenido WHATSAPP ─── */}
          {canalTipo === 'whatsapp' && (
            <div className="space-y-4">
              {/* Alerta: canal sin credenciales (token vacío/expirado) — bloquea envío */}
              {canalActual && !canalTieneCredenciales && (
                <div className="flex items-start gap-2 text-xs text-insignia-peligro bg-insignia-peligro/10 rounded-card px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Canal sin credenciales</p>
                    <p className="text-texto-terciario mt-0.5">
                      El canal <strong>{canalActual.nombre}</strong> está marcado como conectado pero le faltan credenciales
                      {canalActual.credenciales_faltantes && canalActual.credenciales_faltantes.length > 0
                        ? <>: <strong>{canalActual.credenciales_faltantes.join(', ')}</strong>.</>
                        : '.'}
                      {' '}Reconectalo desde Inbox → Configuración → Canales antes de enviar.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerta si la plantilla no está aprobada */}
              {plantillaWA && !plantillaWAAprobada && (
                <div className="flex items-start gap-2 text-xs text-insignia-advertencia bg-insignia-advertencia/10 rounded-card px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Plantilla pendiente de aprobación</p>
                    <p className="text-texto-terciario mt-0.5">
                      La plantilla &quot;Recibo de haberes&quot; está en estado <strong>{plantillaWA.estado_meta}</strong>. Debe estar aprobada por Meta para poder enviar.
                    </p>
                  </div>
                </div>
              )}

              {!plantillaWA && (
                <div className="flex items-start gap-2 text-xs text-insignia-peligro bg-insignia-peligro/10 rounded-card px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>No se encontró la plantilla de WhatsApp para nómina. Creala desde Inbox → Configuración → Plantillas.</p>
                </div>
              )}

              {canalesWA.length > 1 && (
                <Select
                  etiqueta="Canal de WhatsApp"
                  opciones={canalesWA.map(c => ({ valor: c.id, etiqueta: c.nombre }))}
                  valor={canalWASeleccionado}
                  onChange={setCanalWASeleccionado}
                />
              )}

              {/* Preview WhatsApp */}
              {previewWA && (
                <div>
                  <label className="text-xs font-medium text-texto-terciario mb-2 flex items-center gap-2 flex-wrap">
                    <span>Preview para {empleadoParaPreview?.nombre || 'empleado'}</span>
                    {!plantillaWAAprobada && plantillaWA && (
                      <Insignia color="advertencia" tamano="sm">
                        {plantillaWA.estado_meta === 'BORRADOR' ? 'Borrador — no enviable' : `${plantillaWA.estado_meta} — no enviable hasta aprobar`}
                      </Insignia>
                    )}
                  </label>
                  <div className="max-w-[380px] mx-auto">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl bg-[#075E54]">
                      <IconoWhatsApp size={14} style={{ color: '#fff' }} />
                      <span className="text-xs font-medium text-white">Vista previa</span>
                    </div>
                    <div className="p-3 bg-[#ECE5DD] dark:bg-[#0b141a]">
                      <div className="rounded-card p-3 max-w-[350px] shadow-sm bg-white dark:bg-[#1f2c33]">
                        {previewWA.encabezado && (
                          <p className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">
                            {previewWA.encabezado}
                          </p>
                        )}
                        <HtmlSeguro
                          html={formatearTextoWA(previewWA.cuerpo)}
                          como="p"
                          className="text-sm whitespace-pre-wrap leading-snug text-gray-800 dark:text-gray-200"
                        />
                        {previewWA.pie && (
                          <p className="text-xs mt-1.5 text-gray-500 dark:text-gray-400">
                            {previewWA.pie}
                          </p>
                        )}
                        <div className="flex justify-end mt-1">
                          <span className="text-[10px] text-gray-400">
                            {fmt.hora(new Date())}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="h-3 rounded-b-xl bg-[#f0f0f0] dark:bg-[#1a2228]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de destinatarios */}
          <div>
            <label className="text-xs font-medium text-texto-terciario mb-2 flex items-center gap-1.5">
              <Users size={12} />
              Destinatarios ({empleadosDisponibles.length})
            </label>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {empleadosDisponibles.map(r => (
                <div
                  key={r.miembro_id}
                  className="flex items-center justify-between bg-superficie-elevada/20 border border-borde-sutil rounded-card px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {canalTipo === 'correo' ? (
                      <Mail size={12} className="text-texto-terciario shrink-0" />
                    ) : (
                      <MessageSquare size={12} className="text-[#25D366] shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                      <p className="text-xs text-texto-terciario">
                        {canalTipo === 'correo' ? r.correo : r.telefono}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-insignia-exito">{fmtMonto(r.monto_pagar)}</span>
                </div>
              ))}

              {empleadosNoDisponibles.map(r => (
                <div
                  key={r.miembro_id}
                  className="flex items-center justify-between bg-insignia-advertencia/5 border border-insignia-advertencia/20 rounded-card px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {canalTipo === 'correo' ? (
                      <UserX size={12} className="text-insignia-advertencia shrink-0" />
                    ) : (
                      <Phone size={12} className="text-insignia-advertencia shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                      <p className="text-xs text-insignia-advertencia">
                        Sin {canalTipo === 'correo' ? 'correo' : 'teléfono'} configurado
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-texto-terciario">{fmtMonto(r.monto_pagar)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

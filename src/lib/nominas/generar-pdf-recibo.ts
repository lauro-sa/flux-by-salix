/**
 * Generador del PDF del recibo de nómina (servidor).
 *
 *   1. Lee `pagos_nomina` + `conceptos_aplicados_pago` + empresa + empleado.
 *   2. Renderiza HTML profesional con `template-recibo.ts`.
 *   3. Convierte a PDF con `htmlAPdf` (Puppeteer).
 *   4. Sube a Supabase Storage en
 *      `comprobantes-pago/<empresa_id>/nominas/<año>/<pago_id>.pdf`.
 *      Bucket privado: las URLs son firmadas con expiración corta.
 *   5. Actualiza `pagos_nomina.comprobante_url` con la URL firmada.
 *
 * Devuelve `{url, storagePath, tamano}`. Usado por:
 *   - `POST /api/nominas/pagos/[id]/pdf` (regenerar bajo demanda).
 *   - `ModalEnviarReciboNomina` cuando el operador adjunta al correo.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 8).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { htmlAPdf } from '@/lib/pdf/html-a-pdf'
import { obtenerIdentidadMiembro } from '@/lib/miembros/identidad'
import {
  renderizarHtmlRecibo,
  type DatosReciboPdf,
  type DatosEmpresaRecibo,
  type DatosEmpleadoRecibo,
  type LineaConceptoRecibo,
  type DatosCobroRecibo,
} from './template-recibo'
import type { ContratoSnapshot } from '@/tipos/nominas'

interface ResultadoPdfRecibo {
  url: string
  storagePath: string
  tamano: number
}

interface OpcionesGenerar {
  /**
   * Segundos de validez de la URL firmada devuelta. Default 7 días.
   * Se usa 30 días al enviar por WhatsApp (el destinatario puede tardar
   * en abrir el link). Para acceso interno (descarga desde la app), 7
   * días es suficiente porque la app regenera el link con cada GET.
   */
  expiracionSegundos?: number
}

const BUCKET = 'comprobantes-pago'
const EXPIRACION_DEFAULT_SEGUNDOS = 60 * 60 * 24 * 7 // 7 días

// ─── Modo "sin pago grabado" ───────────────────────────────────────
//
// Cuando el operador manda el recibo ANTES de registrar el pago, no
// tenemos fila en `pagos_nomina` para leer. La función
// `generarPdfReciboCalculado` arma el PDF desde los datos calculados
// (resultado de /api/nominas) y lo sube a Storage con una clave
// `borradores/<empresa>/<miembro>-<desde>-<hasta>.pdf` que se
// sobreescribe en cada llamada. Cuando después se registra el pago,
// `generarPdfRecibo` regenera el archivo en su path definitivo
// (`<empresa>/nominas/<año>/<pago_id>.pdf`).
//
// El PDF "borrador" no queda vinculado a una fila de pagos_nomina, por
// lo que no se puede listar desde la UI de historial — es de uso
// efímero (adjunto al correo del momento). Si querés conservarlo,
// registrá el pago.

export interface DatosCalculadosPdf {
  /** Identificador del miembro empleado (usado como clave en Storage). */
  miembro_id: string
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  /** Etiqueta legible del período: "Quincena 1-15 de abril 2026". */
  concepto: string
  contrato_snapshot: import('@/tipos/nominas').ContratoSnapshot | null
  dias_habiles: number
  dias_trabajados: number
  dias_ausentes: number
  tardanzas: number
  monto_sugerido: number
  /** Cuánto se transferirá realmente — para borradores coincide con sugerido. */
  monto_abonado: number
  /** Mismo shape que `conceptos_aplicados_pago` en BD, pero sin `automatico` boolean al final. */
  conceptos: LineaConceptoRecibo[]
  notas?: string | null
}

/**
 * Genera el PDF del recibo en modo "borrador" (sin pago grabado).
 * Lo sube a Storage en una clave sobreescribible para que el operador
 * pueda mandarlo por correo. Devuelve la URL firmada para adjuntar.
 */
export async function generarPdfReciboCalculado(
  admin: SupabaseClient,
  empresaId: string,
  datos: DatosCalculadosPdf,
  opciones: OpcionesGenerar = {},
): Promise<ResultadoPdfRecibo> {
  const expiracion = opciones.expiracionSegundos ?? EXPIRACION_DEFAULT_SEGUNDOS

  // Datos de empresa + identidad del empleado, igual que en el flujo normal.
  const [{ data: empresa }, { data: miembro }] = await Promise.all([
    admin.from('empresas')
      .select('nombre, logo_url, datos_fiscales, telefono, correo, ubicacion')
      .eq('id', empresaId)
      .maybeSingle(),
    admin.from('miembros')
      .select('id, usuario_id, numero_empleado')
      .eq('id', datos.miembro_id)
      .maybeSingle(),
  ])
  if (!empresa) throw new Error('Empresa no encontrada')
  if (!miembro) throw new Error('Miembro no encontrado')

  const identidad = await obtenerIdentidadMiembro(
    admin,
    { id: miembro.id, usuario_id: miembro.usuario_id },
    empresaId,
  )

  const empresaRecibo: DatosEmpresaRecibo = {
    nombre: empresa.nombre,
    logo_url: empresa.logo_url ?? null,
    datos_fiscales: (empresa.datos_fiscales as Record<string, unknown> | null) ?? null,
    telefono: empresa.telefono ?? null,
    correo: empresa.correo ?? null,
    ubicacion: empresa.ubicacion ?? null,
  }
  const empleadoRecibo: DatosEmpleadoRecibo = {
    nombre: identidad?.nombre ?? '—',
    apellido: identidad?.apellido ?? null,
    numero_empleado: miembro.numero_empleado ?? null,
    documento_tipo: identidad?.documento_tipo ?? null,
    documento_numero: identidad?.documento_numero ?? null,
    banco: null,
  }

  const montoBase = calcularMontoBaseDesdeSnapshot(datos.contrato_snapshot, {
    dias_periodo: datos.dias_habiles,
    dias_trabajados: datos.dias_trabajados,
  })

  const datosPdf: DatosReciboPdf = {
    // ID sintético — el operador todavía no registró el pago. Se usa
    // solo para mostrar el "número de recibo" en el pie del documento.
    pago_id: `borrador-${datos.miembro_id.slice(0, 8)}-${datos.fecha_inicio_periodo}`,
    concepto: datos.concepto,
    periodo_inicio: datos.fecha_inicio_periodo,
    periodo_fin: datos.fecha_fin_periodo,
    empresa: empresaRecibo,
    empleado: empleadoRecibo,
    contrato: datos.contrato_snapshot,
    asistencia: {
      dias_periodo: datos.dias_habiles,
      dias_trabajados: datos.dias_trabajados,
      dias_ausentes: datos.dias_ausentes,
      tardanzas: datos.tardanzas,
    },
    monto_base: montoBase,
    conceptos: datos.conceptos,
    monto_abonado: datos.monto_abonado,
    monto_sugerido: datos.monto_sugerido,
    fecha_emision: new Date().toISOString().slice(0, 10),
    notas: datos.notas ?? null,
  }

  const html = renderizarHtmlRecibo(datosPdf)
  const { pdf } = await htmlAPdf(html, { generarMiniatura: false })

  // Storage path "borradores/" — sobreescribible por (empresa, miembro, período).
  // Cuando después se registra el pago real, queda este archivo huérfano:
  // un cleanup programado puede borrar borradores con +30 días en futuro PR.
  const storagePath = `${empresaId}/borradores/${datos.miembro_id}-${datos.fecha_inicio_periodo}-${datos.fecha_fin_periodo}.pdf`

  await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
  const { error: errUpload } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: 'private, no-cache',
    })
  if (errUpload) throw new Error(`Error al subir PDF borrador: ${errUpload.message}`)

  const { data: signed, error: errSigned } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiracion)
  if (errSigned || !signed) throw new Error(`Error al firmar URL: ${errSigned?.message}`)

  return { url: signed.signedUrl, storagePath, tamano: pdf.length }
}

/**
 * Genera (o regenera) el PDF de un recibo y lo deja persistido en Storage.
 * Si el archivo ya existe en la ruta destino, se sobreescribe (upsert).
 */
export async function generarPdfRecibo(
  admin: SupabaseClient,
  pagoId: string,
  empresaId: string,
  opciones: OpcionesGenerar = {},
): Promise<ResultadoPdfRecibo> {
  const expiracion = opciones.expiracionSegundos ?? EXPIRACION_DEFAULT_SEGUNDOS
  // ─── 1) Cargar pago + datos relacionados ───
  const { data: pago, error: errPago } = await admin
    .from('pagos_nomina')
    .select('*')
    .eq('id', pagoId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (errPago || !pago) {
    throw new Error('Pago no encontrado')
  }

  const [{ data: empresa }, { data: conceptos }, { data: miembro }] = await Promise.all([
    admin.from('empresas')
      .select('nombre, logo_url, datos_fiscales, telefono, correo, ubicacion')
      .eq('id', empresaId)
      .maybeSingle(),
    admin.from('conceptos_aplicados_pago')
      .select('nombre_snapshot, tipo, monto, detalle, automatico')
      .eq('pago_nomina_id', pagoId)
      .order('automatico', { ascending: false }),
    admin.from('miembros')
      .select('id, usuario_id, numero_empleado')
      .eq('id', pago.miembro_id)
      .maybeSingle(),
  ])

  if (!empresa) throw new Error('Empresa no encontrada')
  if (!miembro) throw new Error('Miembro no encontrado')

  // Identidad consolidada (perfil de Flux o contacto-equipo).
  const identidad = await obtenerIdentidadMiembro(
    admin,
    { id: miembro.id, usuario_id: miembro.usuario_id },
    empresaId,
  )

  // ─── 2) Armar datos para el template ───
  const empresaRecibo: DatosEmpresaRecibo = {
    nombre: empresa.nombre,
    logo_url: empresa.logo_url ?? null,
    datos_fiscales: (empresa.datos_fiscales as Record<string, unknown> | null) ?? null,
    telefono: empresa.telefono ?? null,
    correo: empresa.correo ?? null,
    ubicacion: empresa.ubicacion ?? null,
  }

  // Si el pago tiene cuenta destino (sql/092), traemos los datos
  // completos de info_bancaria para "Datos del cobro" + popular el
  // campo `banco` legacy del empleado.
  let cobro: DatosCobroRecibo | null = null
  let bancoLegacy: string | null = null
  if (pago.metodo_pago) {
    let cuentaDestino: DatosCobroRecibo['cuenta_destino'] = null
    if (pago.info_bancaria_id) {
      const { data: cuenta } = await admin
        .from('info_bancaria')
        .select('tipo_pago, etiqueta, banco, tipo_cuenta, numero_cuenta, alias, titular_nombre')
        .eq('id', pago.info_bancaria_id)
        .maybeSingle()
      if (cuenta) {
        cuentaDestino = {
          tipo_pago: cuenta.tipo_pago as 'banco' | 'digital',
          etiqueta: cuenta.etiqueta ?? null,
          banco: cuenta.banco ?? null,
          tipo_cuenta: cuenta.tipo_cuenta ?? null,
          numero_cuenta: cuenta.numero_cuenta ?? null,
          alias: cuenta.alias ?? null,
          titular_nombre: cuenta.titular_nombre ?? null,
        }
        bancoLegacy = [cuenta.banco, cuenta.alias].filter(Boolean).join(' · ') || null
      }
    }
    cobro = {
      metodo_pago: pago.metodo_pago as DatosCobroRecibo['metodo_pago'],
      fecha_pago: pago.fecha_pago ?? (pago.creado_en as string).slice(0, 10),
      referencia: pago.referencia ?? null,
      cuenta_destino: cuentaDestino,
    }
  }

  const empleadoRecibo: DatosEmpleadoRecibo = {
    nombre: identidad?.nombre ?? '—',
    apellido: identidad?.apellido ?? null,
    numero_empleado: miembro.numero_empleado ?? null,
    documento_tipo: identidad?.documento_tipo ?? null,
    documento_numero: identidad?.documento_numero ?? null,
    banco: bancoLegacy,
  }

  const lineas: LineaConceptoRecibo[] = (conceptos ?? []).map(c => ({
    nombre: c.nombre_snapshot,
    tipo: c.tipo as 'haber' | 'descuento',
    monto: Number(c.monto),
    detalle: c.detalle ?? null,
    automatico: !!c.automatico,
  }))

  // monto_base_calculado: si lo guardamos por separado en el pago sería más
  // robusto; mientras tanto lo derivamos restando los haberes de la suma
  // total que tiene `monto_sugerido`. Si todo el desglose vino en
  // conceptos_aplicados_pago el haber base puede ser 0.
  // Para evitar drift, usamos el snapshot del contrato + asistencia para
  // recalcular el monto base: es la fuente de verdad inmutable.
  const snapshot = (pago.contrato_snapshot as ContratoSnapshot | null) ?? null
  const montoBase = calcularMontoBaseDesdeSnapshot(snapshot, {
    dias_periodo: pago.dias_habiles ?? 0,
    dias_trabajados: pago.dias_trabajados ?? 0,
  })

  const datos: DatosReciboPdf = {
    pago_id: pago.id,
    concepto: pago.concepto,
    periodo_inicio: pago.fecha_inicio_periodo,
    periodo_fin: pago.fecha_fin_periodo,
    empresa: empresaRecibo,
    empleado: empleadoRecibo,
    contrato: snapshot,
    asistencia: {
      dias_periodo: pago.dias_habiles ?? 0,
      dias_trabajados: pago.dias_trabajados ?? 0,
      dias_ausentes: pago.dias_ausentes ?? 0,
      tardanzas: pago.tardanzas ?? 0,
    },
    monto_base: montoBase,
    conceptos: lineas,
    monto_abonado: Number(pago.monto_abonado),
    monto_sugerido: Number(pago.monto_sugerido),
    fecha_emision: new Date().toISOString().slice(0, 10),
    notas: pago.notas ?? null,
    cobro,
  }

  const html = renderizarHtmlRecibo(datos)

  // ─── 3) Convertir a PDF ───
  const { pdf } = await htmlAPdf(html, { generarMiniatura: false })

  // ─── 4) Subir a Storage ───
  const anio = pago.fecha_inicio_periodo.slice(0, 4)
  const storagePath = `${empresaId}/nominas/${anio}/${pagoId}.pdf`

  // Borramos cualquier versión previa para evitar drift de caché del CDN.
  await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})

  const { error: errUpload } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: 'private, no-cache',
    })

  if (errUpload) {
    throw new Error(`Error al subir PDF: ${errUpload.message}`)
  }

  // Bucket privado → URL firmada con expiración.
  const { data: signed, error: errSigned } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiracion)
  if (errSigned || !signed) {
    throw new Error(`Error al firmar URL: ${errSigned?.message}`)
  }

  // ─── 5) Actualizar comprobante_url + storage_path ───
  await admin
    .from('pagos_nomina')
    .update({
      comprobante_url: signed.signedUrl,
    })
    .eq('id', pagoId)
    .eq('empresa_id', empresaId)

  return { url: signed.signedUrl, storagePath, tamano: pdf.length }
}

/**
 * Recalcula el monto base de haberes desde el snapshot del contrato y
 * las asistencias guardadas. Es lo mismo que hace el motor en
 * `calcularMontoBase`, pero adaptado al snapshot inmutable del pago.
 *
 * Se duplica acá (en lugar de importar el motor) porque el snapshot
 * tiene formato distinto al `ContratoLaboral` que toma el motor — y
 * porque queremos que el PDF NUNCA cambie aunque el motor evolucione.
 */
function calcularMontoBaseDesdeSnapshot(
  snapshot: ContratoSnapshot | null,
  asistencia: { dias_periodo: number; dias_trabajados: number },
): number {
  if (!snapshot) return 0
  const monto = Number(snapshot.monto_base)
  const modalidad = snapshot.modalidad_calculo

  if (modalidad === 'por_dia') return monto * asistencia.dias_trabajados
  // por_hora no se conserva en pagos_nomina (no guardamos horas_netas).
  // Para esos casos el PDF muestra el monto_sugerido total como base.
  if (modalidad === 'por_hora') return Number(snapshot.monto_base) * asistencia.dias_trabajados

  const diasNaturales: Record<string, number> = {
    fijo_semanal: 7,
    fijo_quincenal: 15,
    fijo_mensual: 30,
  }
  const dias = diasNaturales[modalidad] ?? 30
  const factor = asistencia.dias_periodo / dias
  return Math.round(monto * factor * 100) / 100
}

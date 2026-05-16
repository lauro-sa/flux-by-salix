/**
 * Helper compartido para armar las líneas (bullets) de ajustes del período
 * que se incluyen en el recibo de haberes — usados tanto en el preview del
 * modal de envío (frontend) como en el envío real por correo / WhatsApp
 * (backend).
 *
 * Antes vivía duplicado en:
 *   - `src/app/(flux)/nominas/_componentes/ModalEnviarReciboNomina.tsx`
 *     (preview, solo descuentos).
 *   - `src/app/api/nominas/enviar-whatsapp/route.ts`
 *     (envío real, separa descuentos y bonos).
 *
 * Mantener una sola fuente de verdad evita drift entre preview y envío:
 * lo que el operador ve en el modal es exactamente lo que va a recibir
 * el empleado.
 */

import { formatoFechaCortaPeriodo } from '@/lib/asistencias/periodo-actual'

// ─── Tipos ───

/**
 * Shape mínimo de un adelanto/bono/descuento tal como se carga desde la BD
 * o desde la API de adelantos. Las cuotas pueden venir bajo el alias
 * `cuotas` (frontend) o `adelantos_cuotas` (joins del backend).
 */
export interface ItemAdelantoBruto {
  id?: string
  tipo?: 'adelanto' | 'descuento' | 'bono' | string | null
  notas?: string | null
  fecha_solicitud?: string | null
  estado?: string | null
  cuotas_totales?: number | null
  /** Alias usado por el endpoint `/api/adelantos` (frontend). */
  cuotas?: Array<{
    numero_cuota: number
    fecha_programada: string
    monto_cuota: string | number
  }>
  /** Alias usado en el join de Supabase del backend WA. */
  adelantos_cuotas?: Array<{
    numero_cuota: number
    fecha_programada: string
    monto_cuota: string | number
  }>
}

export interface OpcionesLineasAjustes {
  /**
   * Saldo del período anterior. Positivo = el empleado quedó a favor en
   * el período anterior → este período se le descuenta. Negativo = quedó
   * en contra → se suma. La línea solo se agrega para saldos positivos
   * (los negativos los maneja el motor en otro lado).
   */
  saldoAnterior?: number
  locale?: string
}

export interface LineasAjustesPeriodo {
  /** Bullets de cosas que RESTAN al neto (saldo a favor anterior + adelantos + descuentos). */
  descuentos: string[]
  /** Bullets de cosas que SUMAN al neto (bonos one-off del período). */
  bonos: string[]
}

// ─── Implementación ───

const fmtMonto = (n: number, locale: string) =>
  `$${n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/**
 * Devuelve las líneas (bullets) de ajustes del período a partir de los
 * adelantos cargados desde BD. Orden cronológico ascendente por
 * `fecha_solicitud`. Cada bullet incluye etiqueta + (cuota X/Y si aplica)
 * + fecha corta + monto con signo.
 *
 * - Items `tipo === 'bono'` van a `bonos` con signo `+`.
 * - El resto (`adelanto`, `descuento`, sin tipo) van a `descuentos` con `−`.
 * - Saldo anterior positivo se agrega como primera línea de `descuentos`.
 * - Adelantos en estado `cancelado` se omiten.
 * - Adelantos sin cuota en el rango `[periodoDesde, periodoHasta]` se omiten.
 */
export function construirLineasAjustes(
  adelantos: ItemAdelantoBruto[],
  periodoDesde: string,
  periodoHasta: string,
  opciones: OpcionesLineasAjustes = {},
): LineasAjustesPeriodo {
  const locale = opciones.locale ?? 'es-AR'
  const saldoAnterior = opciones.saldoAnterior ?? 0

  type Item = {
    tipo: 'adelanto' | 'descuento' | 'bono'
    notas: string
    numCuota: number
    cuotasTot: number
    monto: number
    fecha: string
  }

  const items: Item[] = []
  for (const a of adelantos) {
    if (a.estado === 'cancelado') continue
    const cuotas = (a.adelantos_cuotas || a.cuotas || []) as ItemAdelantoBruto['cuotas']
    if (!cuotas) continue
    const cuota = cuotas.find(c => {
      const f = c.fecha_programada
      return f >= periodoDesde && f <= periodoHasta
    })
    if (!cuota) continue
    const tipoNorm = (a.tipo === 'bono' ? 'bono' : a.tipo === 'descuento' ? 'descuento' : 'adelanto') as Item['tipo']
    const fallback = tipoNorm === 'bono' ? 'Bono' : tipoNorm === 'descuento' ? 'Descuento' : 'Adelanto'
    items.push({
      tipo: tipoNorm,
      notas: (a.notas || fallback).toString(),
      numCuota: cuota.numero_cuota,
      cuotasTot: a.cuotas_totales || 1,
      monto: typeof cuota.monto_cuota === 'string' ? parseFloat(cuota.monto_cuota) : cuota.monto_cuota,
      fecha: (a.fecha_solicitud || '').toString(),
    })
  }
  items.sort((x, y) => x.fecha.localeCompare(y.fecha))

  const descuentos: string[] = []
  const bonos: string[] = []

  if (saldoAnterior > 0) {
    descuentos.push(`• A favor del período anterior · −${fmtMonto(saldoAnterior, locale)}`)
  }

  for (const it of items) {
    const cuotaInfo = it.cuotasTot > 1 ? ` · cuota ${it.numCuota}/${it.cuotasTot}` : ''
    const fechaCorta = it.fecha ? ` · ${formatoFechaCortaPeriodo(it.fecha, locale)}` : ''
    if (it.tipo === 'bono') {
      bonos.push(`• ${it.notas}${fechaCorta} · +${fmtMonto(it.monto, locale)}`)
    } else {
      descuentos.push(`• ${it.notas}${cuotaInfo}${fechaCorta} · −${fmtMonto(it.monto, locale)}`)
    }
  }

  return { descuentos, bonos }
}

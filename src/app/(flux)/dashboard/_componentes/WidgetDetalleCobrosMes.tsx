'use client'

/**
 * WidgetDetalleCobrosMes — desglose de cobros del mes con hero monto + IVA.
 *
 * Diseño:
 *  - Hero: "Total cobrado" grande + tarjeta lateral con IVA a depositar.
 *  - Lista compacta de cobros del mes agrupados por presupuesto, con
 *    indicador de cuotas pagadas y badge de IVA.
 *  - Click en una fila → expande detalle (cuotas, fechas, método, link).
 *  - Navegación de mes con flechas.
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, AlertCircle, Check } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { MESES_LARGOS, fmtFechaCorta, MontoConCentavos } from './compartidos'

type TipoEstimacion = 'real' | 'completado_total' | 'orden_venta_adelanto' | 'sin_cobros'

interface DetalleCobro {
  pago_id: string | null
  presupuesto_id: string
  presupuesto_numero: string
  presupuesto_total: number
  presupuesto_saldo: number
  presupuesto_subtotal_neto: number
  presupuesto_total_impuestos: number
  presupuesto_fecha_aceptacion: string | null
  presupuesto_estado: string
  presupuesto_cuotas_count: number
  presupuesto_cuotas_cobradas: number
  contacto_nombre: string | null
  contacto_apellido: string | null
  fecha_pago: string
  monto: number
  monto_neto: number
  monto_iva: number
  cuota_numero: number | null
  cuota_descripcion: string | null
  metodo: string | null
  tipo_estimacion: TipoEstimacion
}

interface Props {
  detalle: DetalleCobro[]
  formatoMoneda: (n: number) => string
}

function nombreContacto(d: DetalleCobro): string {
  const partes = [d.contacto_nombre, d.contacto_apellido].filter(Boolean)
  return partes.length > 0 ? partes.join(' ') : '—'
}

function claveDeMes(fecha: string | null): string | null {
  if (!fecha) return null
  return fecha.slice(0, 7)
}

const ETIQUETAS_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  deposito: 'Depósito',
  otro: 'Otro',
}

export function WidgetDetalleCobrosMes({ detalle, formatoMoneda }: Props) {
  const hoy = new Date()
  const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const [mesSel, setMesSel] = useState<string>(claveHoy)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [verTodos, setVerTodos] = useState(false)

  const cambiarMes = (delta: number) => {
    const [a, m] = mesSel.split('-').map(Number)
    const f = new Date(a, m - 1 + delta, 1)
    setMesSel(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`)
    setExpandidos(new Set())
    setVerTodos(false)
  }

  // Total cobrado del mes anterior + nombre corto del mes anterior
  const { totalMesAnterior, nombreMesAnterior } = useMemo(() => {
    const [a, m] = mesSel.split('-').map(Number)
    const f = new Date(a, m - 2, 1)
    const claveAnt = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    const total = detalle
      .filter((d) => claveDeMes(d.fecha_pago) === claveAnt && d.monto > 0.01)
      .reduce((s, d) => s + d.monto, 0)
    const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return { totalMesAnterior: total, nombreMesAnterior: nombres[f.getMonth()] }
  }, [detalle, mesSel])

  // Agrupar por presupuesto y calcular totales del mes
  const { grupos, totalMes, totalIva, totalNeto, cantPagos, cantNuevos, cantCerrados } = useMemo(() => {
    const enMes = detalle.filter((d) => claveDeMes(d.fecha_pago) === mesSel && d.monto > 0.01)
    const map = new Map<string, {
      presupuesto_id: string
      presupuesto_numero: string
      presupuesto_total: number
      presupuesto_saldo: number
      presupuesto_total_impuestos: number
      presupuesto_cuotas_count: number
      presupuesto_cuotas_cobradas: number
      contacto: string
      pagos: DetalleCobro[]
      totalCobrado: number
      totalIva: number
      totalNeto: number
      tieneIva: boolean
      // Es venta del mes (aceptado este mes) o es cobro de venta anterior
      esVentaDelMes: boolean
      ultimaFecha: string
    }>()

    for (const d of enMes) {
      const aceptacion = claveDeMes(d.presupuesto_fecha_aceptacion)
      const esEstimado = d.tipo_estimacion !== 'real'
      const esVentaDelMes = aceptacion === mesSel || (esEstimado && !d.presupuesto_fecha_aceptacion)
      const g = map.get(d.presupuesto_id) || {
        presupuesto_id: d.presupuesto_id,
        presupuesto_numero: d.presupuesto_numero,
        presupuesto_total: d.presupuesto_total,
        presupuesto_saldo: d.presupuesto_saldo,
        presupuesto_total_impuestos: d.presupuesto_total_impuestos,
        presupuesto_cuotas_count: d.presupuesto_cuotas_count,
        presupuesto_cuotas_cobradas: d.presupuesto_cuotas_cobradas,
        contacto: nombreContacto(d),
        pagos: [],
        totalCobrado: 0,
        totalIva: 0,
        totalNeto: 0,
        tieneIva: d.presupuesto_total_impuestos > 0.01,
        esVentaDelMes,
        ultimaFecha: d.fecha_pago,
      }
      g.pagos.push(d)
      g.totalCobrado += d.monto
      g.totalIva += d.monto_iva
      g.totalNeto += d.monto_neto
      g.presupuesto_saldo = d.presupuesto_saldo
      if (d.fecha_pago > g.ultimaFecha) g.ultimaFecha = d.fecha_pago
      map.set(d.presupuesto_id, g)
    }

    // Ordenar pagos dentro de cada grupo por fecha asc
    const grupos = Array.from(map.values())
    for (const g of grupos) {
      g.pagos.sort((a, b) => (a.fecha_pago || '').localeCompare(b.fecha_pago || ''))
    }
    // Ordenar grupos: ventas del mes primero, después por monto desc
    grupos.sort((a, b) => {
      if (a.esVentaDelMes !== b.esVentaDelMes) return a.esVentaDelMes ? -1 : 1
      return b.totalCobrado - a.totalCobrado
    })

    const totalMes = grupos.reduce((s, g) => s + g.totalCobrado, 0)
    const totalIva = grupos.reduce((s, g) => s + g.totalIva, 0)
    const totalNeto = grupos.reduce((s, g) => s + g.totalNeto, 0)
    const cantPagos = grupos.reduce((s, g) => s + g.pagos.length, 0)
    // Presupuestos cuya venta cayó en este mes (= presupuestos "nuevos" del mes)
    const cantNuevos = grupos.filter((g) => g.esVentaDelMes).length
    // Presupuestos que quedaron 100% cobrados gracias a los cobros del mes
    const cantCerrados = grupos.filter((g) => g.presupuesto_saldo < 0.01).length

    return {
      grupos,
      totalMes,
      totalIva,
      totalNeto,
      cantPresupuestos: grupos.length,
      cantPagos,
      cantNuevos,
      cantCerrados,
    }
  }, [detalle, mesSel])

  const [anioSel, mesNumSel] = mesSel.split('-').map(Number)
  const nombreMes = MESES_LARGOS[mesNumSel - 1]

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const VISIBLES_INICIAL = 4
  const gruposVisibles = verTodos ? grupos : grupos.slice(0, VISIBLES_INICIAL)
  const ocultos = grupos.length - gruposVisibles.length

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* ─── Header con navegación de mes ─── */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            className="size-7 rounded-full border border-borde-sutil flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:border-borde-fuerte transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMesSel(claveHoy)
              setExpandidos(new Set())
              setVerTodos(false)
            }}
            className={`text-xs font-semibold uppercase tracking-widest px-2 py-1 transition-colors ${
              mesSel === claveHoy
                ? 'text-texto-marca'
                : 'text-texto-secundario hover:text-texto-primario'
            }`}
          >
            {nombreMes} {anioSel}
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            className="size-7 rounded-full border border-borde-sutil flex items-center justify-center text-texto-terciario hover:text-texto-primario hover:border-borde-fuerte transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xxs uppercase tracking-widest text-texto-terciario">
            Detalle de cobros
          </span>
          <InfoBoton
            titulo="Detalle de cobros del mes"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Es la <strong className="text-texto-primario">foto de toda la plata que entró este
                    mes</strong>: cuánto cobraste, de qué clientes, cuánto IVA debés depositar y qué cobros
                    todavía te falta cargar. Usá las flechas del título para navegar otros meses.
                  </p>
                ),
              },
              {
                titulo: 'Total cobrado del mes',
                contenido: (
                  <p>
                    La suma de <strong className="text-texto-primario">todos los pagos que recibiste este
                    mes</strong>. La pildora &quot;↑ X% vs marzo&quot; te dice si cobraste más o menos
                    que el mes anterior.
                  </p>
                ),
              },
              {
                titulo: 'IVA a depositar — importante',
                contenido: (
                  <p>
                    Es la <strong className="text-texto-marca">parte del cobro que NO es tuya</strong>: le
                    pertenece al fisco. Si cobraste $100K con IVA 21%, $17.355 son IVA que vas a depositar
                    cuando hagas la declaración. Tenelo separado mentalmente —la plata que podés usar es la
                    parte <strong className="text-texto-primario">Neta</strong>.
                  </p>
                ),
              },
              {
                titulo: 'Nuevos vs Cerrados',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-primario">Nuevos:</strong> presupuestos que el cliente
                      te aceptó este mes (recién entraron al pipeline ganado).
                    </li>
                    <li>
                      <strong className="text-insignia-exito-texto">Cerrados:</strong> presupuestos que se
                      terminaron de cobrar este mes (último pago, saldo en cero).
                    </li>
                    <li className="text-texto-terciario pt-1">
                      Un presupuesto puede ser &quot;Nuevo&quot; en marzo, generar cobros varios meses, y
                      finalmente &quot;Cerrarse&quot; en agosto cuando llega el último pago.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Las alertas en cada cobro',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-insignia-advertencia-texto">&quot;cargar primer pago&quot;:</strong>{' '}
                      <span className="text-texto-terciario">el cliente firmó la orden de venta pero no
                      cargaste el adelanto. El sistema lo estima, pero tenés que registrar el pago real.</span>
                    </li>
                    <li>
                      <strong className="text-insignia-advertencia-texto">&quot;cargar comprobantes&quot;:</strong>{' '}
                      <span className="text-texto-terciario">el presupuesto está marcado completado pero
                      faltan pagos por cargar. Necesitás los comprobantes para que cuadre.</span>
                    </li>
                    <li>
                      <strong className="text-texto-marca">IVA 21%:</strong>{' '}
                      <span className="text-texto-terciario">el cobro paga IVA. <strong>S/IVA</strong>:
                      cliente exento o monotributista.</span>
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Click en una fila',
                contenido: (
                  <p>
                    Para ver el <strong className="text-texto-primario">detalle completo del
                    presupuesto</strong>: cuotas pagadas, fechas, método de pago, saldo pendiente y cobros
                    de meses anteriores del mismo presupuesto. Útil cuando un cliente paga en varias cuotas.
                  </p>
                ),
              },
              {
                titulo: 'Cruzá esta info con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Cobros del año&quot;:</strong>{' '}
                      <span className="text-texto-terciario">éste es el detalle, ese es el agregado.
                      Sumando todos los meses te da el cobrado del año.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si ves muchos &quot;cargar primer pago&quot;,
                      revisá los presupuestos en estado Orden de venta —son ventas firmadas que aún no
                      tienen el adelanto registrado.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">IVA mes a mes:</strong>{' '}
                      <span className="text-texto-terciario">navegando los meses con las flechas armás
                      vos mismo el calendario fiscal de IVA a depositar.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* ─── Hero: Total cobrado + IVA a depositar ─── */}
      <div className="px-4 sm:px-5 py-4 sm:py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 sm:gap-4 sm:gap-5 items-start">
        <div>
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
            Total cobrado del mes
          </p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-light tabular-nums text-texto-primario leading-none">
            <MontoConCentavos valor={totalMes} formatoMoneda={formatoMoneda} />
          </p>

          {/* Comparativa con mes anterior — pildora con ícono y nombre del mes */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {totalMesAnterior > 0.01 && totalMes > 0.01 && (() => {
              const delta = totalMes - totalMesAnterior
              const pct = (delta / totalMesAnterior) * 100
              const subio = delta > 0
              const igual = Math.abs(delta) < 0.01
              const colores = igual
                ? 'border-borde-sutil text-texto-terciario'
                : subio
                  ? 'border-insignia-exito/30 text-insignia-exito-texto bg-insignia-exito/[0.04]'
                  : 'border-insignia-peligro/30 text-insignia-peligro-texto bg-insignia-peligro/[0.04]'
              const flecha = igual ? '→' : subio ? '↑' : '↓'
              return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xxs ${colores}`}>
                  <span className="font-medium tabular-nums">
                    {flecha} {Math.abs(pct).toFixed(0)}%
                  </span>
                  <span className="opacity-80">vs {nombreMesAnterior}</span>
                </span>
              )
            })()}
          </div>

          {/* KPIs como pildoras: cobros · nuevos · cerrados */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs"
              title="Cantidad total de pagos recibidos en el mes"
            >
              <span className="font-medium tabular-nums text-texto-primario">{cantPagos}</span>
              <span className="text-texto-terciario">{cantPagos === 1 ? 'cobro' : 'cobros'}</span>
            </span>
            {cantNuevos > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs"
                title="Presupuestos vendidos / aceptados este mes"
              >
                <span className="font-medium tabular-nums text-texto-primario">{cantNuevos}</span>
                <span className="text-texto-terciario">{cantNuevos === 1 ? 'nuevo' : 'nuevos'}</span>
              </span>
            )}
            {cantCerrados > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-exito/30 bg-insignia-exito/[0.04] text-xxs"
                title="Presupuestos que terminaron de cobrarse este mes (pago final)"
              >
                <span className="font-medium tabular-nums text-insignia-exito-texto">{cantCerrados}</span>
                <span className="text-insignia-exito-texto/80">{cantCerrados === 1 ? 'cerrado' : 'cerrados'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Card IVA — solo si hay IVA */}
        {totalIva > 0.01 && (
          <div className="rounded-lg border border-texto-marca/25 bg-texto-marca/[0.03] px-4 py-3 min-w-[240px]">
            <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-1.5">
              IVA a depositar
            </p>
            <p className="text-2xl font-light tabular-nums text-texto-marca leading-none">
              <MontoConCentavos valor={totalIva} formatoMoneda={formatoMoneda} />
            </p>
            {/* Pildora: monto neto (sin IVA) — el con IVA ya es el total cobrado */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-borde-sutil text-xxs">
                <span className="text-texto-terciario">Neto</span>
                <span className="font-medium tabular-nums text-texto-secundario">
                  <MontoConCentavos valor={totalNeto} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Lista de cobros del mes ─── */}
      {grupos.length > 0 && (
        <div className="px-4 sm:px-5 pb-5">
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-2.5">
            Cobros del mes
          </p>
          <div className="space-y-1.5">
            {gruposVisibles.map((g) => {
              const expandido = expandidos.has(g.presupuesto_id)
              const tieneSaldo = g.presupuesto_saldo > 0.01
              const total = g.presupuesto_cuotas_count
              const cobrado = g.presupuesto_cuotas_cobradas
              const completo = total > 0 && cobrado >= total
              const tipos = new Set(g.pagos.map((p) => p.tipo_estimacion))
              const alerta = tipos.has('completado_total')
                ? 'cargar comprobantes'
                : tipos.has('orden_venta_adelanto')
                  ? 'cargar primer pago'
                  : null

              // Concepto del cobro del mes:
              //   - Si cobró todas las cuotas en este mes → "Pagado total"
              //   - Si cobró una sola cuota → su descripción ("Adelanto", "Al finalizar"...)
              //   - Si cobró varias cuotas → "N pagos"
              //   - Si es a cuenta (sin cuota) → "A cuenta"
              const pagosConCuota = g.pagos.filter((p) => typeof p.cuota_numero === 'number')
              const conceptoTexto = (() => {
                if (pagosConCuota.length === 0) {
                  return g.pagos.length > 1 ? `${g.pagos.length} pagos` : 'A cuenta'
                }
                if (pagosConCuota.length === 1) {
                  const p = pagosConCuota[0]
                  return p.cuota_descripcion || `Cuota ${p.cuota_numero}`
                }
                if (completo && pagosConCuota.length === total) {
                  return 'Pagado total'
                }
                return `${pagosConCuota.length} cuotas`
              })()

              const metodo = g.pagos[0]?.metodo
                ? ETIQUETAS_METODO[g.pagos[0].metodo] || g.pagos[0].metodo
                : '—'

              return (
                <div
                  key={g.presupuesto_id}
                  className="rounded-lg border border-borde-sutil bg-superficie-app/40 hover:bg-superficie-app/70 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggle(g.presupuesto_id)}
                    className="w-full px-3 py-2.5 text-left flex flex-col sm:grid sm:grid-cols-[64px_1fr_auto_auto] sm:items-center gap-2 sm:gap-3"
                  >
                    {/* En mobile: cliente arriba con número + monto al costado */}
                    {/* Fila 1 mobile / Col 1 desktop: PRES + número */}
                    <div className="flex sm:block items-center justify-between sm:justify-start leading-tight">
                      <p className="text-xxs uppercase tracking-widest text-texto-terciario">
                        Pres <span className="sm:hidden text-texto-secundario font-mono ml-1">
                          {g.presupuesto_numero?.replace(/^Pres\s*/i, '') || '—'}
                        </span>
                      </p>
                      <p className="hidden sm:block text-sm font-mono text-texto-secundario tabular-nums">
                        {g.presupuesto_numero?.replace(/^Pres\s*/i, '') || '—'}
                      </p>
                      {/* En mobile: monto a la derecha en la misma fila */}
                      <p className="sm:hidden text-sm font-semibold tabular-nums text-texto-primario whitespace-nowrap">
                        <MontoConCentavos valor={g.totalCobrado} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
                      </p>
                    </div>

                    {/* Col 2: Cliente + concepto/método */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-texto-primario truncate">
                        {g.contacto}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xxs flex-wrap">
                        <span className="flex items-center gap-1 truncate">
                          {completo && <Check className="size-2.5 shrink-0 text-insignia-exito-texto" strokeWidth={3} />}
                          <span className={`truncate ${completo ? 'text-insignia-exito-texto' : 'text-texto-secundario'}`}>
                            {conceptoTexto}
                          </span>
                        </span>
                        <span className="text-texto-terciario/60">·</span>
                        <span className="text-texto-terciario truncate">{metodo}</span>
                      </div>
                    </div>

                    {/* Col 3: Badge IVA o alerta */}
                    <div className="flex sm:justify-center shrink-0">
                      {alerta ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-insignia-advertencia/15 text-insignia-advertencia-texto text-xxs whitespace-nowrap"
                          title={alerta}
                        >
                          <AlertCircle className="size-2.5" />
                          {alerta}
                        </span>
                      ) : g.tieneIva ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-texto-marca/[0.08] text-texto-marca text-xxs font-medium">
                          IVA 21%
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.05] text-texto-terciario text-xxs">
                          S/IVA
                        </span>
                      )}
                    </div>

                    {/* Col 4: Monto desktop (en mobile ya está en la primera fila) */}
                    <div className="hidden sm:block text-right shrink-0 min-w-[120px]">
                      <p className="text-sm font-semibold tabular-nums text-texto-primario whitespace-nowrap">
                        <MontoConCentavos valor={g.totalCobrado} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
                      </p>
                      {tieneSaldo && (
                        <p className="text-xxs text-texto-terciario tabular-nums whitespace-nowrap">
                          queda <MontoConCentavos valor={g.presupuesto_saldo} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
                        </p>
                      )}
                    </div>

                    {/* Saldo restante en mobile (solo si hay) */}
                    {tieneSaldo && (
                      <p className="sm:hidden text-xxs text-texto-terciario tabular-nums text-right">
                        queda <MontoConCentavos valor={g.presupuesto_saldo} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
                      </p>
                    )}
                  </button>

                  {/* Detalle expandido */}
                  {expandido && (
                    <DetalleExpandido
                      g={g}
                      mesSel={mesSel}
                      detalle={detalle}
                      formatoMoneda={formatoMoneda}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Ver más */}
          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="w-full text-center mt-3 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
            >
              + {ocultos} {ocultos === 1 ? 'presupuesto más' : 'presupuestos más'}
            </button>
          )}
          {verTodos && grupos.length > VISIBLES_INICIAL && (
            <button
              type="button"
              onClick={() => setVerTodos(false)}
              className="w-full text-center mt-3 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
            >
              Ver menos
            </button>
          )}
        </div>
      )}

      {grupos.length === 0 && (
        <div className="px-4 sm:px-5 py-12 text-center text-xs text-texto-terciario">
          No hay cobros registrados en {nombreMes} {anioSel}.
        </div>
      )}
    </div>
  )
}

// ─── Detalle expandido del presupuesto ────────────────────────────────────
// Muestra: resumen del presupuesto con desglose de IVA, cobros del mes
// seleccionado, cobros de meses anteriores (historia completa) y link.

interface DetalleExpandidoProps {
  g: {
    presupuesto_id: string
    presupuesto_numero: string
    presupuesto_total: number
    presupuesto_saldo: number
    presupuesto_total_impuestos: number
    pagos: DetalleCobro[]
    totalCobrado: number
    totalIva: number
    totalNeto: number
    tieneIva: boolean
    esVentaDelMes: boolean
  }
  mesSel: string
  detalle: DetalleCobro[]
  formatoMoneda: (n: number) => string
}

function fmtFechaLarga(iso: string | null): string {
  if (!iso) return ''
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d} ${meses[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

function DetalleExpandido({ g, mesSel, detalle, formatoMoneda }: DetalleExpandidoProps) {
  // Todos los pagos de este presupuesto (histórico completo)
  const todosLosPagos = useMemo(() => {
    return detalle
      .filter((d) => d.presupuesto_id === g.presupuesto_id && d.monto > 0.01)
      .sort((a, b) => (a.fecha_pago || '').localeCompare(b.fecha_pago || ''))
  }, [detalle, g.presupuesto_id])

  // Pagos del presupuesto en otros meses (anteriores o posteriores)
  const pagosOtrosMeses = todosLosPagos.filter((p) => claveDeMes(p.fecha_pago) !== mesSel)
  const pagosDelMes = g.pagos
  const tieneOtrosMeses = pagosOtrosMeses.length > 0

  // Totales calculados
  const subtotalNeto = g.presupuesto_total - g.presupuesto_total_impuestos
  const cobradoTotal = g.presupuesto_total - g.presupuesto_saldo
  const tieneSaldo = g.presupuesto_saldo > 0.01
  const tasaCobro = g.presupuesto_total > 0 ? (cobradoTotal / g.presupuesto_total) * 100 : 0

  return (
    <div className="px-3 pb-3 pt-2 border-t border-borde-sutil/60 space-y-3">
      {/* ── Resumen visual del presupuesto ── */}
      <div className="rounded-lg border border-borde-sutil/60 bg-superficie-tarjeta/60 px-3 py-2.5">
        {/* Línea 1: total / cobrado / saldo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-2 pb-2 border-b border-borde-sutil/40">
          <div>
            <p className="text-xxs text-texto-terciario uppercase tracking-wider mb-0.5">Total</p>
            <p className="text-sm font-semibold text-texto-primario tabular-nums leading-tight">
              <MontoConCentavos valor={g.presupuesto_total} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
            </p>
          </div>
          <div>
            <p className="text-xxs text-texto-terciario uppercase tracking-wider mb-0.5">Cobrado</p>
            <p className="text-sm font-semibold text-insignia-exito-texto tabular-nums leading-tight">
              <MontoConCentavos valor={cobradoTotal} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
            </p>
            <p className="text-xxs text-texto-terciario tabular-nums">
              {tasaCobro.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xxs text-texto-terciario uppercase tracking-wider mb-0.5">Saldo</p>
            <p
              className={`text-sm font-semibold tabular-nums leading-tight ${
                tieneSaldo ? 'text-texto-primario' : 'text-insignia-exito-texto'
              }`}
            >
              {tieneSaldo
                ? <MontoConCentavos valor={g.presupuesto_saldo} formatoMoneda={formatoMoneda} tamanoCentavos="75%" />
                : '✓ pagado'}
            </p>
          </div>
        </div>

        {/* Línea 2: desglose de IVA */}
        {g.tieneIva && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <p className="text-xxs text-texto-terciario">Sin IVA</p>
              <p className="text-xs text-texto-secundario tabular-nums">
                <MontoConCentavos valor={subtotalNeto} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
              </p>
            </div>
            <div>
              <p className="text-xxs text-texto-terciario">IVA</p>
              <p className="text-xs text-texto-marca tabular-nums">
                <MontoConCentavos valor={g.presupuesto_total_impuestos} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
              </p>
            </div>
            <div>
              <p className="text-xxs text-texto-terciario">Con IVA</p>
              <p className="text-xs text-texto-primario tabular-nums">
                <MontoConCentavos valor={g.presupuesto_total} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Cobros del mes seleccionado (acento verde, card destacada) ── */}
      <div className="rounded-lg border border-insignia-exito/25 bg-insignia-exito/[0.04] px-3 py-2.5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xxs uppercase tracking-wider font-medium text-insignia-exito-texto inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-insignia-exito" />
            Este mes
          </p>
          <span className="text-xs font-semibold tabular-nums text-insignia-exito-texto">
            <MontoConCentavos valor={g.totalCobrado} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
          </span>
        </div>
        <div className="space-y-1.5">
          {pagosDelMes.map((p, i) => (
            <PagoRow
              key={p.pago_id || `mes-${i}`}
              pago={p}
              formatoMoneda={formatoMoneda}
              tieneIva={g.tieneIva}
            />
          ))}
        </div>
      </div>

      {/* ── Cobros del presupuesto en otros meses (anteriores o posteriores) ── */}
      {tieneOtrosMeses && (() => {
        // Decidir el label según si todos son anteriores, todos posteriores, o mixto
        const todosAnteriores = pagosOtrosMeses.every(p => (claveDeMes(p.fecha_pago) || '') < mesSel)
        const todosPosteriores = pagosOtrosMeses.every(p => (claveDeMes(p.fecha_pago) || '') > mesSel)
        const label = todosAnteriores
          ? 'Cobros anteriores'
          : todosPosteriores
            ? 'Cobros posteriores'
            : 'Otros cobros del presupuesto'
        return (
          <div className="px-3 opacity-80">
            <div className="flex items-baseline justify-between mb-2 pb-1 border-b border-borde-sutil/40">
              <p className="text-xxs uppercase tracking-wider text-texto-terciario inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-texto-terciario/50" />
                {label}
              </p>
              <span className="text-xxs text-texto-terciario tabular-nums">
                <MontoConCentavos valor={pagosOtrosMeses.reduce((s, p) => s + p.monto, 0)} formatoMoneda={formatoMoneda} tamanoCentavos="85%" />
              </span>
            </div>
            <div className="space-y-1.5">
              {pagosOtrosMeses.map((p, i) => (
                <PagoRow
                  key={p.pago_id || `otro-${i}`}
                  pago={p}
                  formatoMoneda={formatoMoneda}
                  tieneIva={g.tieneIva}
                  conMesCompleto
                  atenuado
                />
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Footer: link al presupuesto ── */}
      <div className="flex items-center justify-between pt-1">
        {!g.esVentaDelMes && g.pagos[0]?.presupuesto_fecha_aceptacion && (
          <p className="text-xxs text-texto-terciario">
            Aceptado el {fmtFechaLarga(g.pagos[0].presupuesto_fecha_aceptacion)}
          </p>
        )}
        <Link
          href={`/presupuestos/${g.presupuesto_id}`}
          className="inline-flex items-center gap-1 text-xxs text-texto-marca hover:underline ml-auto"
        >
          <ExternalLink className="size-3" />
          Ver presupuesto
        </Link>
      </div>
    </div>
  )
}

// ─── Fila de un pago individual ───────────────────────────────────────────
function PagoRow({
  pago,
  formatoMoneda,
  tieneIva,
  conMesCompleto = false,
  atenuado = false,
}: {
  pago: DetalleCobro
  formatoMoneda: (n: number) => string
  tieneIva: boolean
  conMesCompleto?: boolean
  atenuado?: boolean
}) {
  const fecha = conMesCompleto ? fmtFechaLarga(pago.fecha_pago) : fmtFechaCorta(pago.fecha_pago)
  const concepto = pago.cuota_numero
    ? `Cuota ${pago.cuota_numero}${pago.cuota_descripcion ? ` — ${pago.cuota_descripcion}` : ''}`
    : pago.tipo_estimacion === 'completado_total'
      ? 'Total faltante'
      : pago.tipo_estimacion === 'orden_venta_adelanto'
        ? 'Adelanto estimado'
        : 'A cuenta'

  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-2.5 text-xs ${atenuado ? 'text-texto-terciario' : ''}`}>
      <span className={`tabular-nums shrink-0 ${conMesCompleto ? 'min-w-[68px]' : 'min-w-[42px]'} ${atenuado ? 'text-texto-terciario/80' : 'text-texto-terciario'}`}>
        {fecha}
      </span>
      <div className="min-w-0">
        <p className={`truncate ${atenuado ? 'text-texto-terciario' : 'text-texto-secundario'}`}>
          {concepto}
          {pago.metodo && (
            <span className={`ml-1 ${atenuado ? 'text-texto-terciario/70' : 'text-texto-terciario'}`}>
              · {ETIQUETAS_METODO[pago.metodo] || pago.metodo}
            </span>
          )}
        </p>
        {tieneIva && pago.monto_iva > 0.01 && (
          <p className={`text-xxs tabular-nums ${atenuado ? 'text-texto-terciario/70' : 'text-texto-terciario'}`}>
            Neto {formatoMoneda(pago.monto_neto)} · IVA {formatoMoneda(pago.monto_iva)}
          </p>
        )}
      </div>
      <span className={`font-medium tabular-nums shrink-0 ${atenuado ? 'text-texto-secundario' : 'text-texto-primario'}`}>
        <MontoConCentavos valor={pago.monto} formatoMoneda={formatoMoneda} tamanoCentavos="80%" />
      </span>
    </div>
  )
}

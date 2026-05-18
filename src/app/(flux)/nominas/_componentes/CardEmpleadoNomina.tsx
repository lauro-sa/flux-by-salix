'use client'

/**
 * CardEmpleadoNomina — Card individual de empleado del dashboard.
 *
 * Reemplaza las filas de la tabla anterior por cards independientes con
 * identidad rica. Cada card es un objeto interactivo que se puede clickear
 * para entrar al detalle del empleado.
 *
 * Estructura visual (referencia Arc Browser tabs flotantes + Raycast results):
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ [Avatar+ring]  Nombre [chip estado]                         $cifra  │
 *   │                Por día · L-V · taller                       Neto    │
 *   │                ─ línea ─                                            │
 *   │                Días · Horas · Tardanzas       Adelanto      [Acción]│
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * En vista compacta, solo se muestra la primera línea (sin sub-textos).
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, FileCheck, Send, Banknote, Mail, Lock, CircleDot, AlertTriangle, Building2, Wallet, Paperclip, FileCheck2 } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'

export interface ResultadoNominaCard {
  miembro_id: string
  pago_nomina_id?: string | null
  nombre: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_tardanza: number
  dias_ausentes: number
  horas_netas: number
  monto_pagar: number
  monto_detalle: string
  descuento_adelanto: number
  cuotas_adelanto: number
  monto_neto: number
  contrato_terminado_antes?: boolean
  recibo_correo_enviado_en?: string | null
  recibo_correo_enviado_a?: string | null
  recibo_whatsapp_enviado_en?: string | null
  recibo_whatsapp_enviado_a?: string | null
  estado_liquidacion?: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  pagado_en?: string | null
  /** URL del comprobante adjunto al pago (si ya se subió uno). Solo aplica
   *  cuando estado_liquidacion=='pagado'. */
  comprobante_url?: string | null
  // ── Datos de identidad rica (sql/044 + 052 + 100). NULL si el miembro
  // no tiene foto / sector primario / cuenta predeterminada cargada. ──
  avatar_url?: string | null
  sector?: { id: string; nombre: string; color: string | null } | null
  cuenta_destino?: {
    tipo_pago: string
    banco: string | null
    etiqueta: string | null
    alias: string | null
  } | null
  saldo_adelantos_vigentes?: number
}

interface Props {
  resultado: ResultadoNominaCard
  /** Vista compacta: oculta sub-texto secundario para escaneo rápido con 15+ empleados. */
  compacta: boolean
  onClick?: () => void
  /**
   * Callback opcional para abrir el modal de "Ver recibo" desde el dashboard
   * sin navegar al detalle. Si está definido y la card está en estado
   * 'pagado', la CTA "Ver recibo" lo llama en vez de redirigir.
   */
  onVerRecibo?: (pagoId: string) => void
  /**
   * Callback opcional para abrir el modal de "Adjuntar comprobante" cuando
   * el empleado está pagado. Se muestra como acción secundaria al lado de
   * "Ver recibo". Si no se provee, no aparece el botón.
   */
  onAdjuntarComprobante?: (pagoId: string) => void
}

function fmtMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtHoras(horasDecimal: number): string {
  const horas = Math.floor(horasDecimal)
  const mins = Math.round((horasDecimal - horas) * 60)
  if (horas === 0 && mins === 0) return '0h'
  if (mins === 0) return `${horas}h`
  return `${horas}h ${mins}m`
}

// ─── Avatar con ring de color hash ───
// Hash determinístico del miembro_id → paleta de 8 tonos apagados.
// El fondo del avatar siempre es neutro (no Slack-style "color sobre
// gradiente"); el color va SOLO en el ring de 1.5px.
const PALETA_RING = [
  'ring-rose-300/50',
  'ring-amber-300/50',
  'ring-emerald-300/50',
  'ring-sky-300/50',
  'ring-violet-300/50',
  'ring-fuchsia-300/50',
  'ring-teal-300/50',
  'ring-orange-300/50',
]

function colorRingPorId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return PALETA_RING[Math.abs(h) % PALETA_RING.length]
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ─── Pills de modalidad/turno ───

function etiquetaModalidad(tipo: string, frecuencia?: string): string {
  if (tipo === 'por_dia' || tipo === 'por dia') return 'Por día'
  if (tipo === 'por_hora') return 'Por hora'
  if (tipo === 'fijo' || tipo === 'mensual') return 'Sueldo fijo'
  if (frecuencia === 'quincenal') return 'Quincenal'
  if (frecuencia === 'semanal') return 'Semanal'
  return 'Mensual'
}

// ─── Estado de liquidación: chip + acción rápida ───

interface InfoEstadoFila {
  etiqueta: string
  colorChip: string
  iconoChip: typeof CircleDot
  ctaEtiqueta: string
  ctaIcono: React.ReactNode
}

function infoEstadoFila(estado: string, contratoTerminado: boolean): InfoEstadoFila {
  if (contratoTerminado) {
    return {
      etiqueta: 'Terminado',
      colorChip: 'text-insignia-peligro',
      iconoChip: AlertTriangle,
      ctaEtiqueta: 'Ver',
      ctaIcono: <Eye size={12} />,
    }
  }
  if (estado === 'pagado') {
    return {
      etiqueta: 'Pagado',
      colorChip: 'text-insignia-exito',
      iconoChip: Lock,
      ctaEtiqueta: 'Ver recibo',
      ctaIcono: <Eye size={12} />,
    }
  }
  if (estado === 'enviado') {
    return {
      etiqueta: 'Enviado',
      colorChip: 'text-insignia-info',
      iconoChip: Send,
      ctaEtiqueta: 'Pagar',
      ctaIcono: <Banknote size={12} />,
    }
  }
  if (estado === 'liquidado') {
    return {
      etiqueta: 'Liquidado',
      colorChip: 'text-insignia-info',
      iconoChip: FileCheck,
      ctaEtiqueta: 'Pagar',
      ctaIcono: <Banknote size={12} />,
    }
  }
  // borrador (default)
  return {
    etiqueta: 'Sin liquidar',
    colorChip: 'text-texto-terciario',
    iconoChip: CircleDot,
    ctaEtiqueta: 'Liquidar',
    ctaIcono: <FileCheck size={12} />,
  }
}

export function CardEmpleadoNomina({ resultado: r, compacta, onClick, onVerRecibo, onAdjuntarComprobante }: Props) {
  const router = useRouter()
  const terminado = !!r.contrato_terminado_antes
  const estado = r.estado_liquidacion ?? 'borrador'
  const info = useMemo(() => infoEstadoFila(estado, terminado), [estado, terminado])
  const ringClase = useMemo(() => colorRingPorId(r.miembro_id), [r.miembro_id])

  // Click general de la card → siempre redirige al detalle del empleado.
  const handleClick = onClick ?? (() => {
    router.push(`/nominas/empleado/${r.miembro_id}`)
  })

  // CTA de la fila → si está en pagado y hay handler de "Ver recibo",
  // abre el PDF en modal sin navegar. Sino, comportamiento default
  // (click general → detalle).
  const handleCta = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (estado === 'pagado' && r.pago_nomina_id && onVerRecibo) {
      onVerRecibo(r.pago_nomina_id)
      return
    }
    handleClick()
  }

  // Barra de cumplimiento de jornada (10 cuadritos `▢▢▢░░`).
  const totalDias = Math.max(r.dias_laborales, 1)
  const llenos = Math.min(r.dias_trabajados, totalDias)
  const vacios = totalDias - llenos
  const ratio = llenos / totalDias

  return (
    <article
      onClick={handleClick}
      className={`group cursor-pointer rounded-2xl border border-white/[0.05] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all px-4 py-3.5 ${
        terminado ? 'opacity-60' : ''
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
        {/* ── Identidad + datos ── */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar con ring de color hash. Si hay foto, la muestra; sino iniciales. */}
          <div className={`relative shrink-0 size-10 rounded-full bg-white/[0.04] flex items-center justify-center ring-2 ${ringClase} overflow-hidden`}>
            {r.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.avatar_url}
                alt={r.nombre}
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-semibold text-texto-secundario tracking-wider">
                {iniciales(r.nombre)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Nombre + chip estado + badges de envío */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-texto-primario truncate group-hover:text-texto-marca transition-colors">
                {r.nombre}
              </h3>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${info.colorChip}`}>
                <info.iconoChip size={10} />
                {info.etiqueta}
              </span>
              {r.recibo_correo_enviado_en && (
                <span
                  title={`Correo a ${r.recibo_correo_enviado_a || '—'}`}
                  className="inline-flex items-center gap-0.5 text-[9px] text-insignia-exito"
                >
                  <Mail size={9} />
                </span>
              )}
              {r.recibo_whatsapp_enviado_en && (
                <span
                  title={`WhatsApp a ${r.recibo_whatsapp_enviado_a || '—'}`}
                  className="inline-flex items-center gap-0.5 text-[9px] text-[#25D366]"
                >
                  <IconoWhatsApp size={9} />
                </span>
              )}
            </div>

            {/* Pills modalidad + sector + monto_detalle — solo si NO es compacta */}
            {!compacta && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium text-texto-secundario bg-white/[0.04]">
                  {etiquetaModalidad(r.compensacion_tipo, r.compensacion_frecuencia)}
                </span>
                {r.sector && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.04]"
                    style={r.sector.color ? { color: r.sector.color } : undefined}
                  >
                    {r.sector.color && (
                      <span
                        className="block size-1.5 rounded-full"
                        style={{ background: r.sector.color }}
                        aria-hidden
                      />
                    )}
                    {r.sector.nombre}
                  </span>
                )}
                <span className="text-[11px] text-texto-terciario truncate">{r.monto_detalle}</span>
              </div>
            )}

            {/* Detalle de asistencia + barra cumplimiento (vista no compacta).
                Organizado en clusters separados por puntos sutiles "·" para
                jerarquizar grupos de información sin saturar la línea. */}
            {!compacta && (
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] text-texto-terciario">
                {/* Cluster 1: asistencia básica (días + horas trabajadas) */}
                <span className="inline-flex items-center gap-1.5">
                  <span className="tabular-nums">
                    <strong className="text-texto-primario font-medium">{r.dias_trabajados}/{r.dias_laborales}</strong>
                    <span className="ml-0.5 text-texto-terciario/70">días</span>
                  </span>
                  <span className="text-white/[0.12]">·</span>
                  <span className="tabular-nums">{fmtHoras(r.horas_netas)}</span>
                </span>

                {/* Cluster 2: incidencias (tardanzas, ausencias) — solo si las hay */}
                {(r.dias_tardanza > 0 || r.dias_ausentes > 0) && (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      {r.dias_tardanza > 0 && (
                        <span className="text-insignia-advertencia tabular-nums">{r.dias_tardanza} tard.</span>
                      )}
                      {r.dias_ausentes > 0 && (
                        <span className="text-insignia-peligro/80 tabular-nums">{r.dias_ausentes} aus.</span>
                      )}
                    </span>
                  </>
                )}

                {/* Cluster 3: adelantos (descuento aplicado o saldo vigente) */}
                {r.descuento_adelanto > 0 ? (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="inline-flex items-center gap-1 text-insignia-advertencia">
                      <span className="tabular-nums">Adelanto −{fmtMonto(r.descuento_adelanto)}</span>
                      {r.cuotas_adelanto > 1 && (
                        <span className="text-insignia-advertencia/70">({r.cuotas_adelanto} cuotas)</span>
                      )}
                      {r.saldo_adelantos_vigentes && r.saldo_adelantos_vigentes > 0 ? (
                        <span className="text-insignia-advertencia/70 tabular-nums">
                          · saldo {fmtMonto(r.saldo_adelantos_vigentes)}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : r.saldo_adelantos_vigentes && r.saldo_adelantos_vigentes > 0 ? (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="tabular-nums">
                      Saldo adelantos {fmtMonto(r.saldo_adelantos_vigentes)}
                    </span>
                  </>
                ) : null}

                {/* Cluster 4: cuenta destino */}
                {r.cuenta_destino && (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="inline-flex items-center gap-1 text-texto-terciario/80">
                      {r.cuenta_destino.tipo_pago === 'digital' ? <Wallet size={10} /> : <Building2 size={10} />}
                      <span className="truncate max-w-[140px]">
                        {r.cuenta_destino.etiqueta || r.cuenta_destino.banco || (r.cuenta_destino.tipo_pago === 'digital' ? 'Billetera' : 'Banco')}
                      </span>
                    </span>
                  </>
                )}

                {/* Barra cumplimiento jornada — siempre a la derecha (ml-auto). */}
                <span className="ml-auto inline-flex items-center gap-[2px]" aria-hidden>
                  {Array.from({ length: llenos }).map((_, i) => (
                    <span
                      key={`l-${i}`}
                      className={`block size-1.5 rounded-sm ${ratio >= 0.9 ? 'bg-insignia-exito/70' : ratio >= 0.6 ? 'bg-texto-secundario/40' : 'bg-insignia-advertencia/70'}`}
                    />
                  ))}
                  {Array.from({ length: vacios }).map((_, i) => (
                    <span key={`v-${i}`} className="block size-1.5 rounded-sm bg-white/[0.05]" />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Cifra + acciones (columna derecha) ──
            Precio arriba, botones abajo, separados por `justify-between` para
            que tomen toda la altura de la card. Si hay comprobante adjunto
            (estado pagado), el ícono Paperclip/FileCheck2 va al lado del CTA. */}
        <div className="flex flex-col items-end justify-between gap-3 shrink-0">
          <p className={`text-lg md:text-xl font-bold tabular-nums leading-none ${
            estado === 'pagado' ? 'text-insignia-exito' : 'text-texto-primario'
          }`}>
            {fmtMonto(r.monto_neto)}
          </p>

          {!compacta && (
            <div className="flex items-center gap-1.5">
              {estado === 'pagado' && r.pago_nomina_id && onAdjuntarComprobante && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdjuntarComprobante(r.pago_nomina_id!)
                  }}
                  title={r.comprobante_url ? 'Comprobante adjunto · ver o reemplazar' : 'Adjuntar comprobante'}
                  className={`inline-flex items-center justify-center size-7 rounded-md border transition-colors ${
                    r.comprobante_url
                      ? 'border-insignia-exito/30 text-insignia-exito hover:bg-insignia-exito/10'
                      : 'border-white/[0.08] text-texto-terciario hover:text-texto-marca hover:border-texto-marca/30 hover:bg-texto-marca/5'
                  }`}
                >
                  {r.comprobante_url ? <FileCheck2 size={12} /> : <Paperclip size={12} />}
                </button>
              )}
              <button
                type="button"
                onClick={handleCta}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-texto-marca border border-texto-marca/30 hover:bg-texto-marca/10 transition-colors"
              >
                {info.ctaIcono}
                {info.ctaEtiqueta}
              </button>
            </div>
          )}
          {compacta && (
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-texto-marca border border-texto-marca/30 hover:bg-texto-marca/10 transition-colors"
            >
              {info.ctaIcono}
              {info.ctaEtiqueta}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

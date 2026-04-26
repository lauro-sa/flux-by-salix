'use client'

/**
 * SeccionDatosPresupuesto — Columna derecha del grid: tipo, plantilla, referencia,
 * fechas, condiciones de pago, moneda.
 * Se usa en: EditorPresupuesto.tsx
 */

import { useState } from 'react'
import { Copy, Check, CircleDashed, CircleDot } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import SelectorPlantilla from './SelectorPlantilla'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import type { CondicionPago, ConfigPresupuestos, PresupuestoConLineas } from '@/tipos/presupuesto'
import type { LineaTemporal } from './tipos-editor'

/** Botoncito de copiar al portapapeles */
function BotonCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  return (
    <button type="button" onClick={copiar} className="text-texto-terciario hover:text-texto-primario transition-colors p-0.5 -m-0.5 rounded" title="Copiar">
      {copiado ? <Check size={11} className="text-insignia-exito" /> : <Copy size={11} />}
    </button>
  )
}

interface PropsSeccionDatosPresupuesto {
  modo: 'crear' | 'editar'
  esEditable: boolean
  // Datos de presupuesto
  referencia: string
  fechaEmision: string
  diasVencimiento: number
  condicionPagoId: string
  moneda: string
  plantillaId: string | null
  // Config
  config: ConfigPresupuestos | null
  presupuesto: PresupuestoConLineas | null
  // Listas
  condiciones: CondicionPago[]
  monedas: { id: string; label: string; simbolo: string; activo: boolean }[]
  // Totales para hitos
  totalDocumento: number
  subtotalNeto: number
  simbolo: string
  // Bloqueada
  bloqueada: boolean
  // Fecha vencimiento calculada
  fechaVenc: Date
  // Usuario y permisos
  usuarioId: string
  esPropietario: boolean
  esAdmin: boolean
  // Líneas para plantilla
  lineas: unknown[]
  notasHtml: string
  condicionesHtml: string
  // Callbacks
  onReferenciaChange: (v: string) => void
  onReferenciaBlur: () => void
  onFechaEmisionChange: (v: string) => void
  onDiasVencimientoChange: (v: number) => void
  onDiasVencimientoBlur: () => void
  onCondicionPagoChange: (v: string) => void
  onMonedaChange: (v: string) => void
  onPlantillaIdChange: (id: string | null) => void
  onCargarPlantilla: (tpl: { id: string; moneda?: string; condicion_pago_id?: string; dias_vencimiento?: number; lineas?: unknown[]; notas_html?: string; condiciones_html?: string }) => void
  onGuardarComoPlantilla: (nombre: string) => Promise<void>
  onGuardarCambiosPlantilla: () => Promise<void>
  onEliminarPlantilla: (id: string) => Promise<void>
  onTogglePredeterminada: (id: string) => Promise<void>
  onAutoguardar: (campos: Record<string, unknown>) => void
  onSetConfig: (config: ConfigPresupuestos | null) => void
  /** true si el presupuesto difiere de la plantilla cargada */
  plantillaModificada?: boolean
}

export default function SeccionDatosPresupuesto({
  modo,
  esEditable,
  referencia,
  fechaEmision,
  diasVencimiento,
  condicionPagoId,
  moneda,
  plantillaId,
  config,
  presupuesto,
  condiciones,
  monedas,
  totalDocumento,
  subtotalNeto,
  simbolo,
  bloqueada,
  fechaVenc,
  usuarioId,
  esPropietario,
  esAdmin,
  lineas: _lineas,
  notasHtml: _notasHtml,
  condicionesHtml: _condicionesHtml,
  onReferenciaChange,
  onReferenciaBlur,
  onFechaEmisionChange,
  onDiasVencimientoChange,
  onDiasVencimientoBlur,
  onCondicionPagoChange,
  onMonedaChange,
  onPlantillaIdChange,
  onCargarPlantilla,
  onGuardarComoPlantilla,
  onGuardarCambiosPlantilla,
  onEliminarPlantilla,
  onTogglePredeterminada,
  onAutoguardar,
  plantillaModificada = false,
}: PropsSeccionDatosPresupuesto) {
  const { t } = useTraduccion()
  const formato = useFormato()

  const condSeleccionada = condiciones.find(c => c.id === condicionPagoId)

  const formatearFecha = (d: Date | string) => formato.fecha(d)

  const fila = "flex items-center justify-between py-2.5"
  const etiqueta = "text-xs font-medium text-texto-secundario uppercase tracking-wide"
  const valorAncho = "w-52"

  return (
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
              predeterminadaId={((config?.plantillas_predeterminadas || {}) as Record<string, string>)[usuarioId] || null}
              usuarioId={usuarioId}
              puedeEliminarTodas={esPropietario || esAdmin}
              tieneModificaciones={plantillaModificada}
              onCargar={onCargarPlantilla}
              onGuardarComo={onGuardarComoPlantilla}
              onGuardarCambios={onGuardarCambiosPlantilla}
              onEliminar={onEliminarPlantilla}
              onTogglePredeterminada={onTogglePredeterminada}
              onLimpiar={() => onPlantillaIdChange(null)}
            />
          </div>
        )}
      </div>

      {/* Datos del presupuesto — agrupados con divide-y */}
      <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card -mx-3 divide-y divide-borde-sutil/50">
        {/* Referencia */}
        <div className="px-3 py-1">
          <div className={fila}>
            <span className={etiqueta}>Referencia</span>
            {esEditable ? (
              <Input
                value={referencia}
                onChange={(e) => onReferenciaChange(e.target.value)}
                onBlur={onReferenciaBlur}
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

        {/* Fechas (grid único de 3 columnas compartido) */}
        <div className={`px-3 py-1 grid grid-cols-[1fr_2.5rem_auto] items-center gap-x-3 ${presupuesto?.fecha_emision_original ? 'border-l-2 border-l-insignia-advertencia/60' : ''}`}>
          {/* Fila Emisión original (arriba, solo si fue re-emitido) */}
          {presupuesto?.fecha_emision_original && (
            <>
              <span className={`${etiqueta} py-1 text-texto-terciario`}>Emisión original</span>
              <div className="py-1" />
              <div className="py-1 w-40">
                <span className="text-xs text-texto-terciario">
                  {formatearFecha(presupuesto.fecha_emision_original)}
                </span>
              </div>
            </>
          )}
          {/* Fila Emisión / Re-emisión */}
          <span className={`${etiqueta} py-2.5 ${presupuesto?.fecha_emision_original ? 'text-insignia-advertencia' : ''}`}>{presupuesto?.fecha_emision_original ? 'Re-emisión' : 'Emisión'}</span>
          <div className="py-2.5" />
          <div className="py-2.5 w-40">
            {esEditable ? (
              <SelectorFecha
                valor={modo === 'editar' ? (presupuesto?.fecha_emision?.split('T')[0] || '') : fechaEmision}
                onChange={(v) => {
                  if (!v) return
                  onFechaEmisionChange(v)
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
                onChange={(e) => onDiasVencimientoChange(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={onDiasVencimientoBlur}
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
                  onDiasVencimientoChange(Math.max(1, diff))
                  onAutoguardar({ dias_vencimiento: Math.max(1, diff) })
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

        {/* Condiciones de pago + Moneda */}
        <div className="px-3 py-1">
          <div className={fila}>
            <span className={etiqueta}>{t('documentos.condiciones_pago')}</span>
            <div className={valorAncho}>
              {esEditable ? (
                <Select
                  valor={condicionPagoId}
                  onChange={(v) => onCondicionPagoChange(v)}
                  opciones={[
                    { valor: '', etiqueta: 'Sin condicion' },
                    ...condiciones.map(c => ({ valor: c.id, etiqueta: c.label })),
                  ]}
                  variante="plano"
                />
              ) : (
                <span className="text-sm text-texto-primario">
                  {condSeleccionada?.label || presupuesto?.condicion_pago_label || 'Sin condicion'}
                </span>
              )}
            </div>
          </div>
          {/* Desglose de pago.
              - hitos: una tarjeta por cada hito configurado, estado desde la
                cuota real materializada en BD.
              - plazo_fijo: una sola tarjeta del 100%, estado derivado del
                total cobrado vs total_final (no hay cuotas en BD). */}
          {(() => {
            if (!condSeleccionada) return null
            // Lista unificada de "tramos" a renderear.
            const tramos: Array<{
              key: string
              descripcion: string
              porcentaje: number
              estado: 'pendiente' | 'parcial' | 'cobrada'
            }> = []

            if (condSeleccionada.tipo === 'hitos' && condSeleccionada.hitos.length > 0) {
              condSeleccionada.hitos.forEach((h, i) => {
                const cuotaReal = presupuesto?.cuotas?.find(c => c.numero === i + 1)
                tramos.push({
                  key: h.id,
                  descripcion: h.descripcion,
                  porcentaje: h.porcentaje,
                  estado: (cuotaReal?.estado as 'pendiente' | 'parcial' | 'cobrada') || 'pendiente',
                })
              })
            } else if (condSeleccionada.tipo === 'plazo_fijo') {
              // Tramo único del 100%. La descripción es la del label de la
              // condición (ej: "100% Pago anticipado", "30 días neto"), o un
              // fallback derivado de los días de vencimiento.
              const descripcion =
                condSeleccionada.label ||
                (condSeleccionada.diasVencimiento === 0
                  ? 'Pago al contado'
                  : `${condSeleccionada.diasVencimiento} días`)
              const cobrado = Number(presupuesto?.total_cobrado || 0)
              const totalFinal = Number(presupuesto?.total_final || totalDocumento) || 0
              let estado: 'pendiente' | 'parcial' | 'cobrada' = 'pendiente'
              if (totalFinal > 0) {
                if (cobrado + 0.01 >= totalFinal) estado = 'cobrada'
                else if (cobrado > 0) estado = 'parcial'
              }
              tramos.push({ key: 'plazo-fijo-100', descripcion, porcentaje: 100, estado })
            }

            if (tramos.length === 0) return null

            const tieneImpuestos = totalDocumento !== subtotalNeto

            return (
              <div className="pb-2 pt-1 space-y-1.5">
                {tramos.map((tramo) => {
                  const montoTotal = totalDocumento * tramo.porcentaje / 100
                  const montoNeto = subtotalNeto * tramo.porcentaje / 100
                  const indicadorEstado = tramo.estado === 'cobrada'
                    ? { icon: <Check size={11} strokeWidth={3} />, color: 'text-insignia-exito', bg: 'bg-insignia-exito/15', label: 'Cobrada' }
                    : tramo.estado === 'parcial'
                      ? { icon: <CircleDot size={11} />, color: 'text-insignia-advertencia', bg: 'bg-insignia-advertencia/15', label: 'Parcial' }
                      : { icon: <CircleDashed size={11} />, color: 'text-texto-terciario', bg: 'bg-white/[0.04]', label: 'Pendiente' }
                  return (
                    <div key={tramo.key} className="rounded-boton border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                      {/* Encabezado: descripción + porcentaje + indicador de cobro */}
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`size-4 rounded-full flex items-center justify-center shrink-0 ${indicadorEstado.bg} ${indicadorEstado.color}`}
                            title={indicadorEstado.label}
                          >
                            {indicadorEstado.icon}
                          </span>
                          <span className="text-xs font-medium text-texto-secundario truncate">{tramo.descripcion}</span>
                        </div>
                        <span className="text-xxs font-medium text-texto-terciario bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0">{tramo.porcentaje}%</span>
                      </div>
                      {/* Montos */}
                      <div className="space-y-1">
                        {tieneImpuestos && (
                          <div className="flex items-center justify-between text-xxs">
                            <span className="text-texto-terciario">Neto</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-texto-terciario font-mono tabular-nums">{simbolo} {formato.numero(montoNeto, 2)}</span>
                              <BotonCopiar valor={montoNeto.toFixed(2)} />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-texto-secundario font-medium">{tieneImpuestos ? 'Con impuestos' : 'Total'}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-texto-primario font-mono font-semibold tabular-nums">{simbolo} {formato.numero(montoTotal, 2)}</span>
                            <BotonCopiar valor={montoTotal.toFixed(2)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <div className={fila}>
            <span className={etiqueta}>{t('documentos.moneda')}</span>
            <div className={valorAncho}>
              {esEditable ? (
                <Select
                  valor={moneda}
                  onChange={(v) => onMonedaChange(v)}
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
    </div>
  )
}

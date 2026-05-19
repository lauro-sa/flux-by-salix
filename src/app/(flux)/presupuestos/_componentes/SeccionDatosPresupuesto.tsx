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
import { EstadosCuota, type EstadoCuota } from '@/tipos/cuota'

/**
 * Botoncito de copiar al portapapeles. Pensado para vivir al final de una
 * fila con hover bg (group/fila): muestra "Copiar" inline cuando se pasa el
 * mouse por la fila y "Copiado" en verde durante 1.5s tras copiar. El
 * ícono queda anclado a la derecha y no se mueve cuando aparece el label.
 */
function BotonCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  // Ancho mínimo reservado para que el botón mida lo mismo con o sin el
  // label "Copiar" visible. Sin esto, al aparecer el texto en hover, el
  // botón crece y arrastra al monto que vive entre el label flex-1 y el
  // botón, "moviendo" los números cuando se pasa el mouse. El min-w
  // garantiza que el layout sea estable.
  const claseBase = 'ml-auto shrink-0 inline-flex items-center justify-end gap-1 min-w-[5rem] px-1.5 py-0 rounded transition-colors'
  const claseEstado = copiado
    ? 'text-insignia-exito bg-insignia-exito/15'
    : 'text-texto-terciario hover:text-texto-primario hover:bg-superficie-tarjeta'
  return (
    <button
      type="button"
      onClick={copiar}
      className={`${claseBase} ${claseEstado}`}
      title={copiado ? 'Copiado' : 'Copiar'}
    >
      <span className={`text-xxs ${copiado ? 'inline' : 'hidden group-hover/fila:inline'}`}>
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
      {copiado ? <Check size={11} /> : <Copy size={11} />}
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
  onCargarPlantilla: (tpl: { id: string; moneda?: string; condicion_pago_id?: string; dias_vencimiento?: number; lineas?: unknown[]; notas_html?: string; condiciones_html?: string; columnas_lineas?: string[] }) => void
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

  // Estilos compartidos para las filas del card: garantiza altura uniforme,
  // hover bg sutil y respiro generoso entre cada propiedad. Las filas no
  // tienen botón copiar; las que sí lo necesitan agregan group/fila + el
  // botón al final, manteniendo el mismo padding vertical.
  const filaBase = 'flex items-center justify-between gap-3 -mx-3 px-3 py-2 rounded transition-colors'
  const filaHover = 'group/fila hover:bg-superficie-hover/40'
  const etiqueta = 'text-xs font-medium text-texto-secundario uppercase tracking-wide shrink-0'
  const valorTexto = 'text-sm text-texto-primario'
  const valorAncho = 'min-w-0 max-w-[60%]'

  return (
    <div className="py-3">
      {/* Card principal con todas las propiedades del presupuesto. Espaciado
          interno generoso, filas con hover bg para invitar al copiado donde
          aplica, y separadores horizontales sutiles entre bloques temáticos
          (identidad del doc → fechas → cobros → moneda). TIPO y PLANTILLA
          encabezan el card en modo crear; en modo editar Plantilla se omite
          (es un atributo que solo se aplica al crear). */}
      <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-2">
        {/* Bloque 0 — Identidad del documento: tipo + plantilla (crear) */}
        <div className={filaBase}>
          <span className={etiqueta}>Tipo</span>
          <span className={`${valorTexto} text-right`}>{t('documentos.tipos.presupuesto')}</span>
        </div>
        {modo === 'crear' && (
          <div className={filaBase}>
            <span className={etiqueta}>Plantilla</span>
            <div className="flex items-center justify-end min-w-0 -my-1">
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
          </div>
        )}

        {/* Bloque 1 — Referencia (con separador horizontal arriba) */}
        <div className="mt-2 pt-2 border-t border-borde-sutil/50">
        <div className={`${filaBase} ${esEditable ? '' : filaHover}`}>
          <span className={etiqueta}>Referencia</span>
          {esEditable ? (
            <div className={valorAncho}>
              <Input
                value={referencia}
                onChange={(e) => onReferenciaChange(e.target.value)}
                onBlur={onReferenciaBlur}
                placeholder="PO, orden de compra..."
                formato={null}
                variante="plano"
                compacto
                className="w-full text-right pl-3"
              />
            </div>
          ) : referencia ? (
            <div className={`group/fila flex items-center gap-1.5 ${valorAncho}`}>
              <span className={`${valorTexto} truncate flex-1 text-right select-text`}>{referencia}</span>
              <BotonCopiar valor={referencia} />
            </div>
          ) : (
            <span className="text-sm text-texto-terciario">—</span>
          )}
        </div>
        </div>

        {/* Bloque 2 — Fechas: emisión y validez (con re-emisión opcional
            destacada con barra naranja a la izquierda). */}
        <div className={`mt-2 pt-2 border-t border-borde-sutil/50 ${presupuesto?.fecha_emision_original ? 'border-l-2 border-l-insignia-advertencia/60 -ml-3 pl-3 -mr-3 pr-3' : ''}`}>
          {/* Fila Emisión original (solo si fue re-emitido) */}
          {presupuesto?.fecha_emision_original && (
            <div className={filaBase}>
              <span className={`${etiqueta} text-texto-terciario`}>Emisión original</span>
              <span className="text-xs text-texto-terciario">
                {formatearFecha(presupuesto.fecha_emision_original)}
              </span>
            </div>
          )}
          {/* Fila Emisión / Re-emisión */}
          <div className={filaBase}>
            <span className={`${etiqueta} ${presupuesto?.fecha_emision_original ? 'text-insignia-advertencia' : ''}`}>
              {presupuesto?.fecha_emision_original ? 'Re-emisión' : 'Emisión'}
            </span>
            <div className="w-40">
              {esEditable ? (
                <SelectorFecha
                  valor={modo === 'editar' ? (presupuesto?.fecha_emision?.split('T')[0] || '') : fechaEmision}
                  onChange={(v) => {
                    if (!v) return
                    onFechaEmisionChange(v)
                  }}
                  limpiable={false}
                  variante="plano"
                />
              ) : (
                <span className={`${valorTexto} block text-right`}>
                  {presupuesto?.fecha_emision ? formatearFecha(presupuesto.fecha_emision) : '—'}
                </span>
              )}
            </div>
          </div>
          {/* Fila Validez: días + fecha de vencimiento */}
          <div className={filaBase}>
            <span className={etiqueta}>Validez</span>
            <div className="flex items-center gap-2 shrink-0">
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
                  className="!w-12 !bg-superficie-tarjeta !border-transparent hover:!border-borde-sutil [&_input]:!text-center [&_input]:font-mono [&_input]:!text-xs"
                  title="Días de validez"
                />
              ) : (
                <span className="text-xs text-texto-terciario font-mono">{diasVencimiento}d</span>
              )}
              <div className="w-40">
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
                    variante="plano"
                  />
                ) : (
                  <span className={`text-sm block text-right ${presupuesto?.fecha_vencimiento && new Date(presupuesto.fecha_vencimiento) < new Date() ? 'text-estado-error font-medium' : 'text-texto-primario'}`}>
                    {presupuesto?.fecha_vencimiento ? formatearFecha(presupuesto.fecha_vencimiento) : '—'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bloque 3 — Cobros: condición de pago + cuotas materializadas con
            su estado (pendiente / parcial / cobrada). */}
        <div className="mt-2 pt-2 border-t border-borde-sutil/50">
          <div className={filaBase}>
            <span className={etiqueta}>{t('documentos.condiciones_pago')}</span>
            <div className={valorAncho}>
              {esEditable ? (
                <Select
                  valor={condicionPagoId}
                  onChange={(v) => onCondicionPagoChange(v)}
                  opciones={[
                    { valor: '', etiqueta: 'Sin condición' },
                    ...condiciones.map(c => ({ valor: c.id, etiqueta: c.label })),
                  ]}
                  variante="plano"
                />
              ) : (
                <span className={`${valorTexto} block text-right`}>
                  {condSeleccionada?.label || presupuesto?.condicion_pago_label || 'Sin condición'}
                </span>
              )}
            </div>
          </div>

          {/* Desglose de cuotas / tramos:
              - hitos: una tarjeta por hito, estado desde la cuota real en BD.
              - plazo_fijo: tarjeta única del 100%, estado derivado del total
                cobrado vs total_final (no hay cuotas en BD).
              Mismo patrón visual que las tarjetas Cliente/Dirigido a:
              identidad arriba, separador sutil, montos abajo con hover bg
              + botón Copiar al final de cada fila. */}
          {(() => {
            if (!condSeleccionada) return null
            const tramos: Array<{
              key: string
              descripcion: string
              porcentaje: number
              estado: EstadoCuota
            }> = []

            if (condSeleccionada.tipo === 'hitos' && condSeleccionada.hitos.length > 0) {
              condSeleccionada.hitos.forEach((h, i) => {
                const cuotaReal = presupuesto?.cuotas?.find(c => c.numero === i + 1)
                tramos.push({
                  key: h.id,
                  descripcion: h.descripcion,
                  porcentaje: h.porcentaje,
                  estado: (cuotaReal?.estado as EstadoCuota) || EstadosCuota.PENDIENTE,
                })
              })
            } else if (condSeleccionada.tipo === 'plazo_fijo') {
              const descripcion =
                condSeleccionada.label ||
                (condSeleccionada.diasVencimiento === 0
                  ? 'Pago al contado'
                  : `${condSeleccionada.diasVencimiento} días`)
              const cobrado = Number(presupuesto?.total_cobrado || 0)
              const totalFinal = Number(presupuesto?.total_final || totalDocumento) || 0
              let estado: EstadoCuota = EstadosCuota.PENDIENTE
              if (totalFinal > 0) {
                if (cobrado + 0.01 >= totalFinal) estado = EstadosCuota.COBRADA
                else if (cobrado > 0) estado = EstadosCuota.PARCIAL
              }
              tramos.push({ key: 'plazo-fijo-100', descripcion, porcentaje: 100, estado })
            }

            if (tramos.length === 0) return null

            const tieneImpuestos = totalDocumento !== subtotalNeto

            return (
              <div className="mt-2 space-y-2">
                {tramos.map((tramo) => {
                  const montoTotal = totalDocumento * tramo.porcentaje / 100
                  const montoNeto = subtotalNeto * tramo.porcentaje / 100
                  const indicadorEstado = tramo.estado === EstadosCuota.COBRADA
                    ? { icon: <Check size={11} strokeWidth={3} />, color: 'text-insignia-exito', bg: 'bg-insignia-exito/15', label: 'Cobrada' }
                    : tramo.estado === EstadosCuota.PARCIAL
                      ? { icon: <CircleDot size={11} />, color: 'text-insignia-advertencia', bg: 'bg-insignia-advertencia/15', label: 'Parcial' }
                      : { icon: <CircleDashed size={11} />, color: 'text-texto-terciario', bg: 'bg-white/[0.04]', label: 'Pendiente' }
                  return (
                    <div key={tramo.key} className="rounded-card bg-superficie-app/50 px-3 py-3">
                      {/* Identidad de la cuota: descripción + estado + % */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className={`size-4 rounded-full flex items-center justify-center shrink-0 ${indicadorEstado.bg} ${indicadorEstado.color}`}
                            title={indicadorEstado.label}
                          >
                            {indicadorEstado.icon}
                          </span>
                          <span className="text-sm font-semibold text-texto-primario truncate">{tramo.descripcion}</span>
                        </div>
                        <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                          {tramo.porcentaje}%
                        </span>
                      </div>

                      {/* Separador sutil entre identidad y montos */}
                      <div className="mt-3 border-t border-borde-sutil/50" />

                      {/* Montos: neto (si hay impuestos) y total. Filas con
                          hover bg + botón Copiar al final. */}
                      <div className="mt-3 space-y-0.5">
                        {tieneImpuestos && (
                          <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
                            <span className="flex-1">Neto</span>
                            <span className="font-mono tabular-nums select-text">{simbolo} {formato.numero(montoNeto, 2)}</span>
                            <BotonCopiar valor={montoNeto.toFixed(2)} />
                          </div>
                        )}
                        <div className="group/fila flex items-center gap-1.5 text-xs -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
                          <span className="flex-1 text-texto-secundario font-medium">
                            {tieneImpuestos ? 'Con impuestos' : 'Total'}
                          </span>
                          <span className="text-texto-primario font-mono font-semibold tabular-nums select-text">
                            {simbolo} {formato.numero(montoTotal, 2)}
                          </span>
                          <BotonCopiar valor={montoTotal.toFixed(2)} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Bloque 4 — Moneda */}
        <div className="mt-2 pt-2 border-t border-borde-sutil/50">
          <div className={filaBase}>
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
                <span className={`${valorTexto} block text-right`}>
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

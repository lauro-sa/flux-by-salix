'use client'

/**
 * SeccionDatosPresupuesto — Columna derecha del grid: tipo, plantilla, referencia,
 * fechas, condiciones de pago, moneda.
 * Se usa en: EditorPresupuesto.tsx
 */

import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import SelectorPlantilla from './SelectorPlantilla'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import type { CondicionPago, ConfigPresupuestos, PresupuestoConLineas } from '@/tipos/presupuesto'
import type { LineaTemporal } from './tipos-editor'

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
      <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-lg -mx-3 divide-y divide-borde-sutil/50">
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
        <div className="px-3 py-1 grid grid-cols-[1fr_2.5rem_auto] items-center gap-x-3">
          {/* Fila Emisión original (arriba, solo si fue re-emitido) */}
          {presupuesto?.fecha_emision_original && (
            <>
              <span className={`${etiqueta} py-1 text-texto-terciario !text-xxs !font-normal`}>Emisión original</span>
              <div className="py-1" />
              <div className="py-1 w-40">
                <span className="text-xs text-texto-terciario">
                  {formatearFecha(presupuesto.fecha_emision_original)}
                </span>
              </div>
            </>
          )}
          {/* Fila Emisión / Re-emisión */}
          <span className={`${etiqueta} py-2.5`}>{presupuesto?.fecha_emision_original ? 'Re-emisión' : 'Emisión'}</span>
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
          {/* Desglose cuotas (hitos) inline */}
          {condSeleccionada?.tipo === 'hitos' && condSeleccionada.hitos.length > 0 && (
            <div className="pb-2 space-y-1">
              {condSeleccionada.hitos.map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs pl-1">
                  <span className="text-texto-terciario">{h.descripcion}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-texto-terciario tabular-nums w-8 text-right">{h.porcentaje}%</span>
                    <span className="text-texto-terciario">{simbolo}</span>
                    <span className="text-texto-primario font-mono tabular-nums text-right w-[9rem]">{formato.numero(totalDocumento * h.porcentaje / 100, 2)}</span>
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

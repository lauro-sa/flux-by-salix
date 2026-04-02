'use client'

/**
 * SeccionCuotas — Cards seleccionables para cuotas de pago (adelanto/cuotas/pago final).
 * Cuando hay hitos, muestra cada cuota como card radio-button.
 * Incluye datos bancarios y subida de comprobante.
 * Basado en InstruccionesPago del portal anterior.
 * Se usa en: VistaPortal (post-aceptación)
 */

import { useState } from 'react'
import { Check, Copy, Upload, FileText, Loader2, CircleDollarSign } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { formatearNumero } from '@/lib/pdf/renderizar-html'
import { useTraduccion } from '@/lib/i18n'
import type { CuotaPago } from '@/tipos/presupuesto'
import type { ComprobantePortal } from '@/tipos/portal'

interface Props {
  cuotas: CuotaPago[]
  comprobantes: ComprobantePortal[]
  datosBancarios: {
    banco: string
    titular: string
    numero_cuenta: string
    cbu: string
    alias: string
  } | null
  monedaSimbolo: string
  totalFinal: string
  colorMarca: string
  onSubirComprobante: (datos: {
    archivo_base64: string
    nombre_archivo: string
    tipo_archivo: string
    cuota_id: string | null
    monto: string | null
  }) => Promise<void>
  cargandoComprobante: boolean
}

export default function SeccionCuotas({
  cuotas,
  comprobantes,
  datosBancarios,
  monedaSimbolo,
  totalFinal,
  colorMarca,
  onSubirComprobante,
  cargandoComprobante,
}: Props) {
  const { t } = useTraduccion()
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const tieneCuotas = cuotas.length > 1
  const cuotasPendientes = cuotas.filter(c => c.estado !== 'cobrada')

  // Etiqueta automática: primera = Adelanto, última = Pago final, medio = Cuota N
  const etiquetaCuota = (cuota: CuotaPago, indice: number) => {
    if (cuota.descripcion) return cuota.descripcion
    if (cuotas.length === 1) return t('portal.pago_total')
    if (indice === 0) return t('portal.adelanto')
    if (indice === cuotas.length - 1) return t('portal.pago_final')
    return `${t('portal.cuota')} ${indice}`
  }

  const copiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = () => {
      const cuotaSel = tieneCuotas ? cuotaSeleccionada : null
      const montoSel = cuotaSel
        ? cuotas.find(c => c.id === cuotaSel)?.monto || null
        : totalFinal

      onSubirComprobante({
        archivo_base64: reader.result as string,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        cuota_id: cuotaSel,
        monto: montoSel,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Monto seleccionado para mostrar
  const montoSeleccionado = cuotaSeleccionada
    ? cuotas.find(c => c.id === cuotaSeleccionada)?.monto || totalFinal
    : totalFinal

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      <div className="px-5 py-4 border-b border-borde-sutil">
        <h3 className="text-base font-semibold text-texto-primario flex items-center gap-2">
          <CircleDollarSign size={18} style={{ color: colorMarca }} />
          {t('portal.datos_transferencia')}
        </h3>
        <p className="text-base text-texto-terciario mt-0.5">{t('portal.instrucciones_pago')}</p>
      </div>

      {/* ── Cuotas seleccionables (solo si hay hitos) ── */}
      {tieneCuotas && (
        <div className="px-5 py-4 border-b border-borde-sutil space-y-3">
          <p className="text-xs text-texto-terciario uppercase tracking-wider font-medium">
            {t('portal.seleccione_pago')}
          </p>
          <div className="space-y-2">
            {cuotas.map((cuota, i) => {
              const esCobrada = cuota.estado === 'cobrada'
              const esSeleccionada = cuotaSeleccionada === cuota.id
              const etiqueta = etiquetaCuota(cuota, i)

              return (
                <Boton
                  key={cuota.id}
                  variante="fantasma"
                  onClick={() => !esCobrada && setCuotaSeleccionada(cuota.id)}
                  disabled={esCobrada}
                  className={`w-full text-left px-4 py-3 border-2 ${
                    esCobrada
                      ? 'border-insignia-exito/30 bg-insignia-exito/5 cursor-default'
                      : esSeleccionada
                        ? 'border-current bg-opacity-5'
                        : 'border-borde-sutil hover:border-borde-fuerte'
                  }`}
                  style={esSeleccionada && !esCobrada ? { borderColor: colorMarca, backgroundColor: `${colorMarca}08` } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        esCobrada
                          ? 'border-insignia-exito bg-insignia-exito'
                          : esSeleccionada
                            ? 'border-current'
                            : 'border-borde-fuerte'
                      }`}
                        style={esSeleccionada && !esCobrada ? { borderColor: colorMarca } : undefined}
                      >
                        {esCobrada && <Check size={10} className="text-white" />}
                        {esSeleccionada && !esCobrada && (
                          <div className="size-2 rounded-full" style={{ backgroundColor: colorMarca }} />
                        )}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${esCobrada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
                          {etiqueta}
                        </span>
                        <span className="text-xs text-texto-terciario ml-2">
                          ({cuota.porcentaje}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono font-medium ${esCobrada ? 'text-insignia-exito' : 'text-texto-primario'}`}>
                        {monedaSimbolo} {formatearNumero(cuota.monto)}
                      </span>
                      {esCobrada && (
                        <span className="text-xs text-insignia-exito font-medium px-1.5 py-0.5 rounded-full bg-insignia-exito/10">
                          {t('portal.cobrada')}
                        </span>
                      )}
                    </div>
                  </div>
                </Boton>
              )
            })}

            {/* Opción pago total (solo si hay más de una cuota y no es una sola al 100%) */}
            {cuotas.length > 1 && (
              <Boton
                variante="fantasma"
                onClick={() => setCuotaSeleccionada(null)}
                className={`w-full text-left px-4 py-3 border-2 ${
                  cuotaSeleccionada === null
                    ? 'border-current bg-opacity-5'
                    : 'border-borde-sutil hover:border-borde-fuerte'
                }`}
                style={cuotaSeleccionada === null ? { borderColor: colorMarca, backgroundColor: `${colorMarca}08` } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      cuotaSeleccionada === null ? 'border-current' : 'border-borde-fuerte'
                    }`}
                      style={cuotaSeleccionada === null ? { borderColor: colorMarca } : undefined}
                    >
                      {cuotaSeleccionada === null && (
                        <div className="size-2 rounded-full" style={{ backgroundColor: colorMarca }} />
                      )}
                    </div>
                    <span className="text-sm font-medium text-texto-primario">{t('portal.pago_total')}</span>
                  </div>
                  <span className="text-sm font-mono font-medium text-texto-primario">
                    {monedaSimbolo} {formatearNumero(totalFinal)}
                  </span>
                </div>
              </Boton>
            )}
          </div>
        </div>
      )}

      {/* ── Monto a transferir (prominente) ── */}
      {(tieneCuotas ? (cuotaSeleccionada !== undefined) : true) && (cuotasPendientes.length > 0 || !tieneCuotas) && (
        <div className="px-5 py-4 border-b border-borde-sutil text-center">
          <p className="text-xs text-texto-terciario uppercase tracking-wider mb-1">{t('portal.monto_transferir')}</p>
          <p className="text-2xl font-bold" style={{ color: colorMarca }}>
            {monedaSimbolo} {formatearNumero(montoSeleccionado)}
          </p>
        </div>
      )}

      {/* ── Datos bancarios ── */}
      {datosBancarios && (
        <div className="p-5 space-y-3">
          {datosBancarios.banco && (
            <FilaBancaria label="Banco" valor={datosBancarios.banco} />
          )}
          {datosBancarios.titular && (
            <FilaBancaria label="Titular" valor={datosBancarios.titular} />
          )}
          {datosBancarios.numero_cuenta && (
            <FilaBancaria label="Nº Cuenta" valor={datosBancarios.numero_cuenta} />
          )}
          {datosBancarios.cbu && (
            <FilaBancaria
              label="CBU"
              valor={datosBancarios.cbu}
              copiable
              copiado={copiado === 'cbu'}
              onCopiar={() => copiar(datosBancarios!.cbu, 'cbu')}
              colorMarca={colorMarca}
            />
          )}
          {datosBancarios.alias && (
            <FilaBancaria
              label="Alias"
              valor={datosBancarios.alias}
              copiable
              copiado={copiado === 'alias'}
              onCopiar={() => copiar(datosBancarios!.alias, 'alias')}
              colorMarca={colorMarca}
            />
          )}
        </div>
      )}

      {/* ── Comprobantes subidos ── */}
      <div className="px-5 py-4 border-t border-borde-sutil space-y-3">
        <p className="text-sm font-medium text-texto-secundario">{t('portal.comprobante')}</p>

        {comprobantes.length > 0 && (
          <div className="space-y-2">
            {comprobantes.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-sm bg-superficie-app rounded-lg px-3 py-2">
                <FileText size={14} className={
                  c.estado === 'confirmado' ? 'text-insignia-exito shrink-0'
                    : c.estado === 'rechazado' ? 'text-estado-error shrink-0'
                      : 'text-estado-pendiente shrink-0'
                } />
                <span className="truncate flex-1 text-texto-secundario">{c.nombre_archivo}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  c.estado === 'confirmado' ? 'bg-insignia-exito/10 text-insignia-exito'
                    : c.estado === 'rechazado' ? 'bg-estado-error/10 text-estado-error'
                      : 'bg-estado-pendiente/10 text-estado-pendiente'
                }`}>
                  {t(`portal.comprobante_${c.estado}`)}
                </span>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-borde-fuerte cursor-pointer hover:border-marca-500 hover:bg-marca-500/5 transition-colors text-sm text-texto-terciario">
          {cargandoComprobante ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {comprobantes.length > 0 ? t('portal.adjuntar_otro') : t('portal.adjuntar_comprobante')}
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleArchivo}
            disabled={cargandoComprobante}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}

// ── Fila de dato bancario ──
function FilaBancaria({
  label, valor, copiable, copiado, onCopiar, colorMarca,
}: {
  label: string
  valor: string
  copiable?: boolean
  copiado?: boolean
  onCopiar?: () => void
  colorMarca?: string
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-texto-terciario">{label}</span>
      {copiable && onCopiar ? (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={onCopiar}
          className="font-mono font-medium"
          style={{ color: colorMarca }}
        >
          {valor}
          {copiado ? <Check size={14} className="text-insignia-exito" /> : <Copy size={14} />}
        </Boton>
      ) : (
        <span className="text-texto-primario font-medium">{valor}</span>
      )}
    </div>
  )
}

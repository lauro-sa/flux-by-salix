'use client'

/**
 * ContratoVigente — Card que muestra los datos del contrato vigente
 * del empleado. Si no hay contrato vigente (caso edge), muestra un
 * EstadoVacio invitando a crearlo.
 *
 * Se usa en: src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx
 * (tab "Contrato vigente").
 */

import type { ContratoLaboral } from '@/tipos/nominas'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Plus, FileText, ExternalLink, FileQuestion } from 'lucide-react'

interface Props {
  contrato: ContratoLaboral | null
  /** Nombre legible del sector (resuelto en el padre desde el catálogo). */
  sectorNombre?: string | null
  /** Nombre legible del turno. */
  turnoNombre?: string | null
  /** Locale para formato monetario (ej: 'es-AR'). */
  locale?: string
  monedaSimbolo?: string
  /** El usuario tiene permiso `nomina:editar`. */
  puedeEditar: boolean
  onNuevoContrato: () => void
}

const ETIQUETAS_CONDICION: Record<string, string> = {
  tiempo_indeterminado: 'Tiempo indeterminado',
  plazo_fijo: 'Plazo fijo',
  temporal: 'Temporal',
  pasantia: 'Pasantía',
  otro: 'Otro',
}
const ETIQUETAS_MODALIDAD: Record<string, string> = {
  por_hora: 'Por hora',
  por_dia: 'Por día',
  fijo_semanal: 'Fijo semanal',
  fijo_quincenal: 'Fijo quincenal',
  fijo_mensual: 'Fijo mensual',
}
const ETIQUETAS_FRECUENCIA: Record<string, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}
const ETIQUETAS_REGIMEN: Record<string, string> = {
  informal: 'Informal',
  monotributo: 'Monotributo',
  relacion_dependencia: 'Relación de dependencia',
}

function formatearMonto(v: number, locale = 'es-AR', simbolo = '$') {
  return `${simbolo} ${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatearFecha(iso: string, locale = 'es-AR') {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ContratoVigente({
  contrato, sectorNombre, turnoNombre, locale = 'es-AR', monedaSimbolo = '$', puedeEditar, onNuevoContrato,
}: Props) {
  if (!contrato) {
    return (
      <div className="p-8">
        <EstadoVacio
          icono={<FileQuestion size={48} strokeWidth={1.5} />}
          titulo="Sin contrato vigente"
          descripcion="Este empleado no tiene un contrato cargado. Crear uno permite liquidar nómina, congelar el snapshot en recibos y dejar trazabilidad histórica."
          accion={puedeEditar ? (
            <Boton onClick={onNuevoContrato} icono={<Plus size={14} />}>
              Crear contrato
            </Boton>
          ) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header con CTA "Nuevo contrato" */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-texto-primario">Contrato vigente</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-insignia-exito/15 text-insignia-exito">
              Activo
            </span>
          </div>
          <p className="text-xs text-texto-terciario mt-1">
            Desde el {formatearFecha(contrato.fecha_inicio, locale)}
          </p>
        </div>

        {puedeEditar && (
          <Boton onClick={onNuevoContrato} variante="secundario" tamano="sm" icono={<Plus size={14} />}>
            Nuevo contrato
          </Boton>
        )}
      </div>

      {/* Grid de campos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-card border border-borde-sutil bg-superficie-tarjeta p-5">
        <Campo etiqueta="Modalidad de cálculo" valor={ETIQUETAS_MODALIDAD[contrato.modalidad_calculo] ?? contrato.modalidad_calculo} />
        <Campo etiqueta="Monto base" valor={formatearMonto(contrato.monto_base, locale, monedaSimbolo)} />

        <Campo etiqueta="Frecuencia de pago" valor={ETIQUETAS_FRECUENCIA[contrato.frecuencia_pago] ?? contrato.frecuencia_pago} />
        <Campo etiqueta="Condición" valor={ETIQUETAS_CONDICION[contrato.condicion] ?? contrato.condicion} />

        <Campo etiqueta="Sector" valor={sectorNombre ?? '—'} />
        <Campo etiqueta="Turno" valor={turnoNombre ?? '—'} />

        <Campo etiqueta="Régimen" valor={ETIQUETAS_REGIMEN[contrato.regimen] ?? contrato.regimen} />
        <Campo etiqueta="Fecha de inicio" valor={formatearFecha(contrato.fecha_inicio, locale)} />

        {contrato.motivo_cambio && (
          <div className="md:col-span-2">
            <Campo etiqueta="Motivo del cambio" valor={contrato.motivo_cambio} />
          </div>
        )}
        {contrato.notas && (
          <div className="md:col-span-2">
            <Campo etiqueta="Notas" valor={contrato.notas} multilinea />
          </div>
        )}
        {contrato.pdf_url && (
          <div className="md:col-span-2 flex items-center gap-2 text-sm">
            <FileText size={14} className="text-texto-terciario" />
            <a href={contrato.pdf_url} target="_blank" rel="noopener noreferrer"
               className="text-texto-marca hover:underline inline-flex items-center gap-1">
              Ver contrato firmado <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ etiqueta, valor, multilinea = false }: { etiqueta: string; valor: string; multilinea?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">{etiqueta}</div>
      <div className={`text-sm text-texto-primario ${multilinea ? 'whitespace-pre-wrap' : ''}`}>{valor}</div>
    </div>
  )
}

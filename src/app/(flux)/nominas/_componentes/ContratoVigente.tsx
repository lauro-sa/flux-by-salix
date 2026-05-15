'use client'

/**
 * ContratoVigente — Card que muestra los datos del contrato del
 * empleado: vigente (estado "Activo") o el último terminado
 * (estado "Terminado" con fecha y motivo de baja).
 *
 * Acciones disponibles según el caso:
 *   - Vigente: "Terminar contrato" (abre ModalTerminarContrato) +
 *     "Nuevo contrato" (abre EditorContrato).
 *   - Terminado: "Crear contrato nuevo" (un nuevo contrato vigente).
 *
 * Se usa en: src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx
 * (tab "Contrato vigente").
 */

import { useState } from 'react'
import type { ContratoLaboral, MotivoFinContrato } from '@/tipos/nominas'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Plus, FileText, ExternalLink, FileQuestion, Ban, Power } from 'lucide-react'
import { ModalTerminarContrato } from './ModalTerminarContrato'

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
  /** Avisa al padre que el contrato fue terminado para recargar la ficha. */
  onContratoTerminado?: () => void
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
const ETIQUETAS_MOTIVO_FIN: Record<MotivoFinContrato, string> = {
  renuncia: 'Renuncia',
  despido_con_causa: 'Despido con causa',
  despido_sin_causa: 'Despido sin causa',
  fin_plazo: 'Fin de plazo',
  mutuo_acuerdo: 'Mutuo acuerdo',
  abandono: 'Abandono',
  jubilacion: 'Jubilación',
  fallecimiento: 'Fallecimiento',
  otro: 'Otro',
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
  contrato, sectorNombre, turnoNombre, locale = 'es-AR', monedaSimbolo = '$',
  puedeEditar, onNuevoContrato, onContratoTerminado,
}: Props) {
  const [modalTerminar, setModalTerminar] = useState(false)

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

  const estaTerminado = !contrato.vigente

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header con estado + acciones */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-texto-primario">
              {estaTerminado ? 'Último contrato' : 'Contrato vigente'}
            </h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              estaTerminado
                ? 'bg-insignia-peligro/15 text-insignia-peligro'
                : 'bg-insignia-exito/15 text-insignia-exito'
            }`}>
              {estaTerminado ? 'Terminado' : 'Activo'}
            </span>
          </div>
          <p className="text-xs text-texto-terciario mt-1">
            {estaTerminado && contrato.fecha_fin
              ? <>Del {formatearFecha(contrato.fecha_inicio, locale)} al {formatearFecha(contrato.fecha_fin, locale)}</>
              : <>Desde el {formatearFecha(contrato.fecha_inicio, locale)}</>}
          </p>
        </div>

        {puedeEditar && (
          <div className="flex items-center gap-2 shrink-0">
            {!estaTerminado && (
              <Boton
                onClick={() => setModalTerminar(true)}
                variante="secundario"
                tamano="sm"
                icono={<Ban size={14} />}
                titulo="Cerrar el contrato (renuncia, despido, etc.)"
              >
                Terminar
              </Boton>
            )}
            <Boton
              onClick={onNuevoContrato}
              variante={estaTerminado ? 'primario' : 'secundario'}
              tamano="sm"
              icono={estaTerminado ? <Power size={14} /> : <Plus size={14} />}
            >
              {estaTerminado ? 'Crear contrato nuevo' : 'Nuevo contrato'}
            </Boton>
          </div>
        )}
      </div>

      {/* Banner del motivo de baja si está terminado */}
      {estaTerminado && (
        <div className="rounded-card border border-insignia-peligro/30 bg-insignia-peligro/10 p-3">
          <p className="text-[11px] font-medium text-insignia-peligro uppercase tracking-wider">
            Motivo de baja
          </p>
          <p className="text-sm text-texto-primario mt-1">
            {contrato.motivo_fin
              ? ETIQUETAS_MOTIVO_FIN[contrato.motivo_fin]
              : 'No especificado'}
            {contrato.fecha_fin && (
              <span className="text-texto-terciario"> · {formatearFecha(contrato.fecha_fin, locale)}</span>
            )}
          </p>
          {contrato.nota_fin && (
            <p className="text-xs text-texto-secundario mt-2 whitespace-pre-wrap">{contrato.nota_fin}</p>
          )}
        </div>
      )}

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

      {/* Modal terminar contrato */}
      {modalTerminar && (
        <ModalTerminarContrato
          contrato={contrato}
          locale={locale}
          onCerrar={() => setModalTerminar(false)}
          onTerminado={() => {
            setModalTerminar(false)
            onContratoTerminado?.()
          }}
        />
      )}
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

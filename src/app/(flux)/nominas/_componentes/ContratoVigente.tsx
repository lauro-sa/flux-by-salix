'use client'

/**
 * ContratoVigente — Pestaña principal "Contrato vigente" de la ficha
 * laboral. Layout hero editorial:
 *
 *   ┌─ Hero ─────────────────────────────────────────────┐
 *   │ CONTRATO VIGENTE  [Activo]                          │
 *   │ Del 1 ene 2026 → presente · 4 m 14 d                │
 *   │ Por día · $40.000 · Quincenal · Informal            │
 *   │                                                      │
 *   │   [Cambiar condiciones] [Renovar] [Terminar]        │
 *   └────────────────────────────────────────────────────┘
 *   ┌─ Detalles ─────────────────────────────────────────┐
 *   │ Modalidad: …    Frecuencia: …                       │
 *   │ Sector: …       Turno: …                            │
 *   │ Régimen: …      Condición: …                        │
 *   └────────────────────────────────────────────────────┘
 *   Contratos anteriores (N)
 *   ┌──────────────────────────────────────┐
 *   │ 1 jul 2025 → 31 dic 2025 · Por día … │
 *   │ Renovación · …                        │
 *   └──────────────────────────────────────┘
 *
 * Si el contrato vigente está terminado, el hero muestra el motivo de
 * baja y la nota. Si no hay ningún contrato, EstadoVacio con CTA.
 *
 * Se usa en: src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx
 * (tab "Contrato vigente").
 */

import { useState } from 'react'
import type { ContratoLaboral, MotivoFinContrato, ConceptoContratoConDetalle } from '@/tipos/nominas'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import {
  Plus, FileText, ExternalLink, FileQuestion, Ban, Power, RotateCw, SlidersHorizontal, History, Pencil,
  Tag, ArrowRight, TrendingUp, TrendingDown,
} from 'lucide-react'
import { ModalTerminarContrato } from './ModalTerminarContrato'
import { ModalRenovarContrato } from './ModalRenovarContrato'

interface Props {
  /**
   * Contrato vigente (o último terminado si no hay vigente). El
   * componente decide la UI según `contrato.vigente`.
   */
  contrato: ContratoLaboral | null
  /** Contratos anteriores (cerrados), ya ordenados por fecha_inicio desc. */
  contratosAnteriores?: ContratoLaboral[]
  sectorNombre?: string | null
  turnoNombre?: string | null
  /** True si el turno mostrado fue heredado del sector (no asignado en el contrato). */
  turnoHeredadoDelSector?: boolean
  /** Mapa id→nombre de sector para resolver nombres en los contratos previos. */
  sectoresMap?: Map<string, string>
  /** Mapa id→nombre de turno para los contratos previos. */
  turnosMap?: Map<string, string>
  /** Mapa sector_id → turno_id predeterminado del sector (para resolver herencia). */
  sectorTurnoMap?: Map<string, string | null>
  locale?: string
  monedaSimbolo?: string
  puedeEditar: boolean
  onNuevoContrato: () => void
  /** Apertura del editor en modo "cambiar condiciones". */
  onCambiarCondiciones?: () => void
  /**
   * Apertura del modal de edición directa (corrección). Solo se mostrará
   * el botón si se provee este callback y el contrato vigente NO tiene
   * pagos asociados.
   */
  onEditarContrato?: () => void
  /**
   * Lista de conceptos vigentes hoy en el contrato (filas con
   * `fecha_baja === null`). Si está vacía, la sección "Conceptos
   * asignados" muestra un EstadoVacio con CTA para configurarlos.
   */
  conceptosVigentes?: ConceptoContratoConDetalle[]
  /**
   * Cambia a la pestaña Conceptos. Se usa en el CTA "Editar conceptos"
   * de la sección de conceptos read-only.
   */
  onIrAConceptos?: () => void
  /** Avisa al padre que la operación tuvo éxito para recargar la ficha. */
  onContratoActualizado?: () => void
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
  cambio_condiciones: 'Cambio de condiciones',
  renovacion: 'Renovación',
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

function formatearFechaCorta(iso: string, locale = 'es-AR') {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Calcula la duración entre dos fechas YYYY-MM-DD como texto legible.
 * Si no hay fecha_fin, se calcula hasta hoy ("presente").
 */
function calcularDuracion(inicio: string, fin?: string | null): string {
  const [yi, mi, di] = inicio.split('-').map(Number)
  const dtIni = new Date(yi, mi - 1, di)
  const dtFin = fin
    ? (() => {
        const [yf, mf, df] = fin.split('-').map(Number)
        return new Date(yf, mf - 1, df)
      })()
    : new Date()

  let anios = dtFin.getFullYear() - dtIni.getFullYear()
  let meses = dtFin.getMonth() - dtIni.getMonth()
  let dias = dtFin.getDate() - dtIni.getDate()
  if (dias < 0) {
    meses -= 1
    const diasMesAnterior = new Date(dtFin.getFullYear(), dtFin.getMonth(), 0).getDate()
    dias += diasMesAnterior
  }
  if (meses < 0) {
    anios -= 1
    meses += 12
  }

  const partes: string[] = []
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`)
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`)
  if (anios === 0 && dias > 0) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`)
  return partes.length > 0 ? partes.join(', ') : 'menos de un día'
}

export function ContratoVigente({
  contrato, contratosAnteriores = [], sectorNombre, turnoNombre, turnoHeredadoDelSector, sectoresMap, turnosMap, sectorTurnoMap,
  conceptosVigentes = [],
  locale = 'es-AR', monedaSimbolo = '$',
  puedeEditar, onNuevoContrato, onCambiarCondiciones, onEditarContrato, onIrAConceptos, onContratoActualizado,
}: Props) {
  const [modalTerminar, setModalTerminar] = useState(false)
  const [modalRenovar, setModalRenovar] = useState(false)

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
  // Solo ofrecemos "Renovar" si el contrato es a plazo (donde la
  // renovación tiene sentido conceptual). Para tiempo indeterminado,
  // renovar no aporta nada — si querés cambiar algo, usás "Cambiar
  // condiciones".
  const esRenovable = !estaTerminado && (
    contrato.condicion === 'plazo_fijo' ||
    contrato.condicion === 'temporal' ||
    contrato.condicion === 'pasantia'
  )
  // Si el contrato no generó pagos todavía, el botón principal es
  // "Editar" (corrección de carga). Si ya hay recibos, el operador
  // debe usar "Cambiar condiciones" — la diferencia importa porque
  // editar retroactivamente con pagos rompería liquidaciones pasadas.
  const puedeEditarDirecto = !estaTerminado && !contrato.tiene_pagos && !!onEditarContrato

  return (
    <div className="px-4 md:px-6 py-4 space-y-5">
      {/* ─── Hero editorial ─── */}
      <section className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {/* Título + estado */}
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  {estaTerminado ? 'Último contrato' : 'Contrato vigente'}
                </h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  estaTerminado
                    ? 'bg-insignia-peligro/15 text-insignia-peligro'
                    : 'bg-insignia-exito/15 text-insignia-exito'
                }`}>
                  {estaTerminado ? 'Terminado' : 'Activo'}
                </span>
              </div>

              {/* Período + duración (lo prominente) */}
              <p className="text-xl md:text-2xl font-semibold text-texto-primario leading-tight">
                {formatearFecha(contrato.fecha_inicio, locale)}
                <span className="text-texto-terciario font-normal mx-2">→</span>
                {estaTerminado && contrato.fecha_fin
                  ? formatearFecha(contrato.fecha_fin, locale)
                  : <span className="text-texto-marca">presente</span>}
              </p>
              <p className="text-sm text-texto-secundario mt-1">
                {calcularDuracion(contrato.fecha_inicio, estaTerminado ? contrato.fecha_fin : null)}
                {' · '}
                {ETIQUETAS_MODALIDAD[contrato.modalidad_calculo] ?? contrato.modalidad_calculo}
                {' · '}
                <span className="text-texto-primario font-medium">
                  {formatearMonto(contrato.monto_base, locale, monedaSimbolo)}
                </span>
                {' '}
                <span className="text-texto-terciario">
                  ({ETIQUETAS_FRECUENCIA[contrato.frecuencia_pago] ?? contrato.frecuencia_pago})
                </span>
              </p>
            </div>

            {/* Acciones (solo si puedeEditar) */}
            {puedeEditar && (
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {puedeEditarDirecto && (
                  <Boton
                    onClick={onEditarContrato}
                    variante="secundario"
                    tamano="sm"
                    icono={<Pencil size={14} />}
                    titulo="Corregir errores de carga (sin pagos generados todavía)"
                  >
                    Editar contrato
                  </Boton>
                )}
                {!estaTerminado && !puedeEditarDirecto && onCambiarCondiciones && (
                  <Boton
                    onClick={onCambiarCondiciones}
                    variante="secundario"
                    tamano="sm"
                    icono={<SlidersHorizontal size={14} />}
                    titulo="Aumento, cambio de modalidad, sector u otra condición"
                  >
                    Cambiar condiciones
                  </Boton>
                )}
                {esRenovable && (
                  <Boton
                    onClick={() => setModalRenovar(true)}
                    variante="secundario"
                    tamano="sm"
                    icono={<RotateCw size={14} />}
                    titulo="Renovar con las mismas condiciones"
                  >
                    Renovar
                  </Boton>
                )}
                {!estaTerminado && (
                  <Boton
                    onClick={() => setModalTerminar(true)}
                    variante="secundario"
                    tamano="sm"
                    icono={<Ban size={14} />}
                    titulo="Cierra el contrato (renuncia, despido, etc.)"
                  >
                    Terminar
                  </Boton>
                )}
                {estaTerminado && (
                  <Boton
                    onClick={onNuevoContrato}
                    variante="primario"
                    tamano="sm"
                    icono={<Power size={14} />}
                  >
                    Crear contrato nuevo
                  </Boton>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Banner del motivo de baja si está terminado */}
        {estaTerminado && (
          <div className="px-5 md:px-6 py-3 border-t border-borde-sutil bg-insignia-peligro/5">
            <p className="text-[11px] font-medium text-insignia-peligro uppercase tracking-wider mb-1">
              Motivo de baja
            </p>
            <p className="text-sm text-texto-primario">
              {contrato.motivo_fin
                ? ETIQUETAS_MOTIVO_FIN[contrato.motivo_fin]
                : 'No especificado'}
              {contrato.fecha_fin && (
                <span className="text-texto-terciario"> · {formatearFecha(contrato.fecha_fin, locale)}</span>
              )}
            </p>
            {contrato.nota_fin && (
              <p className="text-xs text-texto-secundario mt-1 whitespace-pre-wrap">{contrato.nota_fin}</p>
            )}
          </div>
        )}
      </section>

      {/* ─── Detalles ─── */}
      <section className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-5">
        <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-4">
          Detalles del contrato
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Campo etiqueta="Modalidad de cálculo" valor={ETIQUETAS_MODALIDAD[contrato.modalidad_calculo] ?? contrato.modalidad_calculo} />
          <Campo etiqueta="Monto base" valor={formatearMonto(contrato.monto_base, locale, monedaSimbolo)} />
          <Campo etiqueta="Frecuencia de pago" valor={ETIQUETAS_FRECUENCIA[contrato.frecuencia_pago] ?? contrato.frecuencia_pago} />
          <Campo etiqueta="Condición" valor={ETIQUETAS_CONDICION[contrato.condicion] ?? contrato.condicion} />
          <Campo etiqueta="Sector" valor={sectorNombre ?? '—'} />
          <Campo
            etiqueta="Turno"
            valor={
              turnoNombre
                ? turnoHeredadoDelSector
                  ? `${turnoNombre} (heredado del sector)`
                  : turnoNombre
                : '—'
            }
          />
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
            <div className="md:col-span-2 flex items-center gap-2 text-sm pt-1">
              <FileText size={14} className="text-texto-terciario" />
              <a href={contrato.pdf_url} target="_blank" rel="noopener noreferrer"
                 className="text-texto-marca hover:underline inline-flex items-center gap-1">
                Ver contrato firmado <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ─── Conceptos asignados (vigentes) ─── */}
      {/* Solo se muestra para el contrato vigente (no terminados): los
          conceptos cobrados en contratos cerrados se ven en cada recibo
          generado durante su vigencia (snapshot inmutable). */}
      {!estaTerminado && (
        <ConceptosVigentesPanel
          conceptos={conceptosVigentes}
          locale={locale}
          monedaSimbolo={monedaSimbolo}
          puedeEditar={puedeEditar}
          onIrAConceptos={onIrAConceptos}
        />
      )}

      {/* ─── Contratos anteriores ─── */}
      {contratosAnteriores.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <History size={14} className="text-texto-terciario" />
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
              Contratos anteriores ({contratosAnteriores.length})
            </h3>
          </div>
          <div className="space-y-2">
            {contratosAnteriores.map(c => {
              // Turno efectivo: propio del contrato o heredado del sector.
              let turnoNombreItem: string | null = c.turno_id ? turnosMap?.get(c.turno_id) ?? null : null
              let heredadoItem = false
              if (!turnoNombreItem && c.sector_id && sectorTurnoMap) {
                const turnoSectorId = sectorTurnoMap.get(c.sector_id)
                if (turnoSectorId) {
                  turnoNombreItem = turnosMap?.get(turnoSectorId) ?? null
                  heredadoItem = !!turnoNombreItem
                }
              }
              return (
                <ContratoAnterior
                  key={c.id}
                  contrato={c}
                  sectorNombre={c.sector_id ? sectoresMap?.get(c.sector_id) ?? null : null}
                  turnoNombre={turnoNombreItem}
                  turnoHeredado={heredadoItem}
                  locale={locale}
                  monedaSimbolo={monedaSimbolo}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Modales ─── */}
      {modalTerminar && (
        <ModalTerminarContrato
          contrato={contrato}
          locale={locale}
          onCerrar={() => setModalTerminar(false)}
          onTerminado={() => {
            setModalTerminar(false)
            onContratoActualizado?.()
          }}
        />
      )}

      {modalRenovar && (
        <ModalRenovarContrato
          contrato={contrato}
          onCerrar={() => setModalRenovar(false)}
          onRenovado={() => {
            setModalRenovar(false)
            onContratoActualizado?.()
          }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Sub-componentes
// ────────────────────────────────────────────────────────────────

/**
 * Panel read-only que lista los conceptos vigentes hoy en el contrato.
 * Muestra haberes y descuentos en grupos separados, con el monto base
 * del catálogo (o el override si lo hay) y la fecha desde la que están
 * activos. La edición real se hace en la pestaña "Conceptos" — acá solo
 * informamos y damos un CTA para ir.
 *
 * Si no hay conceptos asignados, mostramos un EstadoVacio compacto
 * con CTA para asignar los primeros.
 */
function ConceptosVigentesPanel({
  conceptos, locale, monedaSimbolo, puedeEditar, onIrAConceptos,
}: {
  conceptos: ConceptoContratoConDetalle[]
  locale: string
  monedaSimbolo: string
  puedeEditar: boolean
  onIrAConceptos?: () => void
}) {
  const haberes = conceptos.filter(c => c.concepto.tipo === 'haber')
  const descuentos = conceptos.filter(c => c.concepto.tipo === 'descuento')

  return (
    <section className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-texto-terciario" />
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            Conceptos asignados ({conceptos.length})
          </h3>
        </div>
        {puedeEditar && onIrAConceptos && (
          <button
            type="button"
            onClick={onIrAConceptos}
            className="inline-flex items-center gap-1 text-xs text-texto-marca hover:underline"
          >
            Editar conceptos <ArrowRight size={12} />
          </button>
        )}
      </div>

      {conceptos.length === 0 ? (
        <p className="text-sm text-texto-terciario">
          Sin conceptos asignados. Los conceptos como Presentismo, Antigüedad o
          Descuento por uniforme se asignan desde la pestaña{' '}
          {puedeEditar && onIrAConceptos ? (
            <button
              type="button"
              onClick={onIrAConceptos}
              className="text-texto-marca hover:underline"
            >
              Conceptos
            </button>
          ) : 'Conceptos'}.
        </p>
      ) : (
        <div className="space-y-4">
          {haberes.length > 0 && (
            <ConceptosVigentesGrupo
              titulo="Haberes"
              icono={<TrendingUp size={12} />}
              colorAcento="text-insignia-exito"
              items={haberes}
              locale={locale}
              monedaSimbolo={monedaSimbolo}
            />
          )}
          {descuentos.length > 0 && (
            <ConceptosVigentesGrupo
              titulo="Descuentos"
              icono={<TrendingDown size={12} />}
              colorAcento="text-insignia-peligro"
              items={descuentos}
              locale={locale}
              monedaSimbolo={monedaSimbolo}
            />
          )}
        </div>
      )}
    </section>
  )
}

function ConceptosVigentesGrupo({
  titulo, icono, colorAcento, items, locale, monedaSimbolo,
}: {
  titulo: string
  icono: React.ReactNode
  colorAcento: string
  items: ConceptoContratoConDetalle[]
  locale: string
  monedaSimbolo: string
}) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 mb-2 ${colorAcento}`}>
        {icono}
        <span className="text-[10px] font-medium uppercase tracking-wider">{titulo}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map(c => (
          <ConceptoVigenteFila
            key={c.id}
            asignacion={c}
            locale={locale}
            monedaSimbolo={monedaSimbolo}
          />
        ))}
      </ul>
    </div>
  )
}

function ConceptoVigenteFila({
  asignacion, locale, monedaSimbolo,
}: {
  asignacion: ConceptoContratoConDetalle
  locale: string
  monedaSimbolo: string
}) {
  const c = asignacion.concepto
  // El valor que el motor va a usar: override si está, sino el del catálogo.
  const valor = asignacion.valor_override !== null && asignacion.valor_override !== undefined
    ? Number(asignacion.valor_override)
    : (c.valor !== null && c.valor !== undefined ? Number(c.valor) : null)
  const tieneOverride = asignacion.valor_override !== null && asignacion.valor_override !== undefined

  // Etiqueta del modo de cálculo, condensada.
  const etiquetaModo = c.modo_calculo === 'monto_fijo' ? 'monto fijo'
    : c.modo_calculo === 'porcentaje_basico' ? '% del básico'
    : c.modo_calculo === 'por_dia' ? 'por día'
    : c.modo_calculo === 'por_evento' ? 'por evento'
    : 'manual'

  const valorTexto = valor === null
    ? '—'
    : c.modo_calculo === 'monto_fijo' || c.modo_calculo === 'por_evento'
      ? `${monedaSimbolo} ${valor.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
      : `${valor}%`

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-superficie-elevada/40 border border-borde-sutil">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-texto-primario font-medium truncate">{c.nombre}</span>
          <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{etiquetaModo}</span>
          {tieneOverride && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-texto-marca/15 text-texto-marca uppercase tracking-wider">
              Override
            </span>
          )}
        </div>
        <p className="text-xs text-texto-terciario mt-0.5">
          Activo desde {formatearFecha(asignacion.fecha_alta, locale)}
        </p>
      </div>
      <span className="text-sm tabular-nums text-texto-primario shrink-0">
        {valorTexto}
      </span>
    </li>
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

function ContratoAnterior({
  contrato, sectorNombre, turnoNombre, turnoHeredado = false, locale = 'es-AR', monedaSimbolo = '$',
}: {
  contrato: ContratoLaboral
  sectorNombre?: string | null
  turnoNombre?: string | null
  /** Mostrar el turno con sufijo "(heredado)" cuando viene del sector. */
  turnoHeredado?: boolean
  locale?: string
  monedaSimbolo?: string
}) {
  const motivoLabel = contrato.motivo_fin ? ETIQUETAS_MOTIVO_FIN[contrato.motivo_fin] : 'Sin motivo'
  // Distinguimos visualmente "no salida" (cambio_condiciones, renovacion)
  // de las salidas reales — el operador entiende a un vistazo si el
  // contrato cerró por algo neutro o por una baja.
  const esNoSalida = contrato.motivo_fin === 'cambio_condiciones' || contrato.motivo_fin === 'renovacion'

  return (
    <article className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-texto-primario">
            <span className="font-medium">{formatearFechaCorta(contrato.fecha_inicio, locale)}</span>
            <span className="text-texto-terciario mx-1.5">→</span>
            <span className="font-medium">
              {contrato.fecha_fin ? formatearFechaCorta(contrato.fecha_fin, locale) : '—'}
            </span>
            <span className="text-texto-terciario ml-2">
              · {calcularDuracion(contrato.fecha_inicio, contrato.fecha_fin)}
            </span>
          </p>
          <p className="text-xs text-texto-secundario mt-1">
            {ETIQUETAS_MODALIDAD[contrato.modalidad_calculo] ?? contrato.modalidad_calculo}
            {' · '}
            {formatearMonto(contrato.monto_base, locale, monedaSimbolo)}
            {' · '}
            {ETIQUETAS_FRECUENCIA[contrato.frecuencia_pago] ?? contrato.frecuencia_pago}
            {sectorNombre && <> · {sectorNombre}</>}
            {turnoNombre && <> · {turnoNombre}{turnoHeredado && <span className="text-texto-terciario/70"> (heredado)</span>}</>}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
          esNoSalida
            ? 'bg-texto-marca/15 text-texto-marca'
            : 'bg-insignia-peligro/15 text-insignia-peligro'
        }`}>
          {motivoLabel}
        </span>
      </div>
      {contrato.nota_fin && (
        <p className="text-xs text-texto-terciario mt-2 whitespace-pre-wrap">{contrato.nota_fin}</p>
      )}
    </article>
  )
}

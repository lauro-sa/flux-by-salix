'use client'

/**
 * EditorConcepto — Modal de creación/edición de un concepto del catálogo
 * de nómina (presentismo, premios, descuentos, etc.).
 *
 * Layout (CLAUDE.md "patrón ModalTipoActividad"):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Identidad (ancho completo): nombre + categoría           │
 *   ├──────────────────────────────────────────────────────────│
 *   │ Tipo (pills): Haber / Descuento                          │
 *   ├──────────────────────────────────────────────────────────│
 *   │ COL IZQ — Cálculo            │ COL DER — Comportamiento  │
 *   │ Modo de cálculo              │ Switch automático         │
 *   │ Valor (oculto si manual)     │ Constructor de condición  │
 *   │ Descripción                  │ Switch recurrente / activo│
 *   └──────────────────────────────────────────────────────────┘
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6).
 */

import { useEffect, useState } from 'react'
import { Shield as ShieldIcon } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { useToast } from '@/componentes/feedback/Toast'
import type {
  ConceptoNomina,
  TipoConcepto,
  CategoriaConcepto,
  ModoCalculoConcepto,
} from '@/tipos/nominas'

interface Props {
  abierto: boolean
  /** Si está, estamos editando ese concepto; sino creamos uno nuevo. */
  concepto?: ConceptoNomina | null
  onCerrar: () => void
  onGuardado: (concepto: ConceptoNomina) => void
}

// ─── Catálogos de opciones ───

const OPCIONES_CATEGORIA: { valor: CategoriaConcepto; etiqueta: string; tipoSugerido?: TipoConcepto }[] = [
  { valor: 'presentismo',       etiqueta: 'Presentismo',         tipoSugerido: 'haber' },
  { valor: 'premio',            etiqueta: 'Premio',              tipoSugerido: 'haber' },
  { valor: 'bono',              etiqueta: 'Bono',                tipoSugerido: 'haber' },
  { valor: 'antiguedad',        etiqueta: 'Antigüedad',          tipoSugerido: 'haber' },
  { valor: 'adicional',         etiqueta: 'Adicional',           tipoSugerido: 'haber' },
  { valor: 'descuento_uniforme',etiqueta: 'Descuento uniforme',  tipoSugerido: 'descuento' },
  { valor: 'descuento_otro',    etiqueta: 'Otro descuento',      tipoSugerido: 'descuento' },
  { valor: 'otro',              etiqueta: 'Otro' },
]

const OPCIONES_MODO: { valor: ModoCalculoConcepto; etiqueta: string; descripcion: string }[] = [
  { valor: 'monto_fijo',         etiqueta: 'Monto fijo',         descripcion: 'Suma o resta un importe fijo' },
  { valor: 'porcentaje_basico',  etiqueta: '% del monto base',   descripcion: '% del haber base del contrato' },
  { valor: 'por_dia',            etiqueta: 'Por día',            descripcion: 'Multiplica por días trabajados' },
  { valor: 'por_evento',         etiqueta: 'Por evento',         descripcion: 'Cada vez que ocurre algo (ej: feriado trabajado)' },
  { valor: 'manual',             etiqueta: 'Manual',             descripcion: 'El usuario carga el monto en cada recibo' },
]

/**
 * Etiquetas de cada condición, parametrizadas por periodicidad.
 * Cuando el concepto es mensual, la condición evalúa el MES entero;
 * cuando es por_periodo, evalúa la quincena/semana del recibo.
 */
function etiquetasCondicion(periodicidad: 'mensual' | 'por_periodo'): Array<{ valor: TipoCondicion; etiqueta: string }> {
  const alcance = periodicidad === 'mensual' ? 'el mes' : 'el período'
  return [
    { valor: 'sin_ausencias',       etiqueta: `Sin ausencias en ${alcance}` },
    { valor: 'sin_tardanzas',       etiqueta: `Sin tardanzas en ${alcance}` },
    { valor: 'asistencia_perfecta', etiqueta: `Asistencia perfecta (${alcance})` },
    { valor: 'minimo_dias',         etiqueta: `Trabajó al menos N días en ${alcance}` },
    { valor: 'trabajo_feriado',     etiqueta: `Trabajó al menos N feriados en ${alcance}` },
    { valor: 'horas_minimas',       etiqueta: `Acumuló al menos N horas en ${alcance}` },
    { valor: 'antiguedad_minima',   etiqueta: 'Antigüedad mínima (meses)' },
    { valor: 'siempre',             etiqueta: 'Siempre' },
  ]
}

type TipoCondicion =
  | 'sin_ausencias'
  | 'sin_tardanzas'
  | 'asistencia_perfecta'
  | 'minimo_dias'
  | 'trabajo_feriado'
  | 'horas_minimas'
  | 'antiguedad_minima'
  | 'siempre'

export function EditorConcepto({ abierto, concepto, onCerrar, onGuardado }: Props) {
  const toast = useToast()

  // ─── State del form ───
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<CategoriaConcepto | ''>('')
  const [tipo, setTipo] = useState<TipoConcepto>('haber')
  const [modo, setModo] = useState<ModoCalculoConcepto>('monto_fijo')
  const [valor, setValor] = useState('0')
  const [automatico, setAutomatico] = useState(true)
  const [tipoCondicion, setTipoCondicion] = useState<TipoCondicion>('siempre')
  const [mesesAntiguedad, setMesesAntiguedad] = useState('12')
  // Valor numérico genérico para condiciones tipo "al menos N…". Lo
  // reutilizan minimo_dias (días), trabajo_feriado (cantidad de feriados)
  // y horas_minimas (horas). El campo se renombra visualmente según el tipo.
  const [valorCondicion, setValorCondicion] = useState('1')
  const [activo, setActivo] = useState(true)
  /**
   * Periodicidad de aplicación. Reemplazó al toggle "Recurrente" legacy
   * (que sólo se persistía pero no afectaba el cálculo):
   *   'mensual'     → solo en la última liquidación del mes (default
   *                   para premios), calculado sobre el básico mensual.
   *   'por_periodo' → cada vez que se liquida (descuentos, plus por turno).
   *   'unico'       → reservado.
   */
  const [periodicidad, setPeriodicidad] = useState<'mensual' | 'por_periodo'>('mensual')
  const [guardando, setGuardando] = useState(false)

  // ─── Init form cuando se abre ───
  useEffect(() => {
    if (!abierto) return
    if (concepto) {
      setNombre(concepto.nombre)
      setDescripcion(concepto.descripcion ?? '')
      setCategoria(concepto.categoria ?? '')
      setTipo(concepto.tipo)
      setModo(concepto.modo_calculo)
      setValor(concepto.valor !== null ? String(concepto.valor) : '0')
      setAutomatico(concepto.automatico)
      setTipoCondicion(
        (concepto.condicion_jsonb as { tipo?: TipoCondicion } | null)?.tipo ?? 'siempre',
      )
      setMesesAntiguedad(
        String((concepto.condicion_jsonb as { meses?: number } | null)?.meses ?? 12),
      )
      // Cargar el valor de la condición según el tipo (días, feriados, horas).
      const cond = concepto.condicion_jsonb as Record<string, unknown> | null
      const valorN = (cond?.dias as number) ?? (cond?.feriados as number) ?? (cond?.horas as number) ?? 1
      setValorCondicion(String(valorN))
      setActivo(concepto.activo)
      setPeriodicidad(
        concepto.periodicidad === 'por_periodo' ? 'por_periodo' : 'mensual',
      )
    } else {
      setNombre('')
      setDescripcion('')
      setCategoria('')
      setTipo('haber')
      setModo('monto_fijo')
      setValor('0')
      setAutomatico(true)
      setTipoCondicion('siempre')
      setMesesAntiguedad('12')
      setValorCondicion('1')
      setActivo(true)
      setPeriodicidad('mensual')
    }
  }, [abierto, concepto])

  // Sugerir tipo cuando se elige una categoría con tipoSugerido.
  const cambiarCategoria = (v: string) => {
    setCategoria(v as CategoriaConcepto)
    const sugerido = OPCIONES_CATEGORIA.find(o => o.valor === v)?.tipoSugerido
    if (sugerido && !concepto) setTipo(sugerido)
  }

  // ─── Submit ───
  const guardar = async () => {
    if (!nombre.trim()) return toast.mostrar('error', 'Nombre requerido')

    const valorNum = modo === 'manual' ? null : Number(valor)
    if (modo !== 'manual' && (!Number.isFinite(valorNum as number) || (valorNum as number) < 0)) {
      return toast.mostrar('error', 'Valor inválido')
    }

    const condicion = construirCondicion(tipoCondicion, mesesAntiguedad, valorCondicion, automatico)

    setGuardando(true)
    try {
      const url = concepto ? `/api/nominas/conceptos/${concepto.id}` : '/api/nominas/conceptos'
      const method = concepto ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria: categoria || null,
          tipo,
          modo_calculo: modo,
          valor: valorNum,
          automatico,
          condicion_jsonb: condicion,
          // `recurrente` quedó como metadato legacy: el comportamiento
          // real lo define `periodicidad`. Lo mandamos en true por
          // default para no romper consumidores antiguos que aún lo leen.
          recurrente: true,
          activo,
          periodicidad,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', concepto ? 'Concepto actualizado' : 'Concepto creado')
      onGuardado(data.concepto as ConceptoNomina)
      onCerrar()
    } catch (err) {
      console.error('[EditorConcepto] error', err)
      toast.mostrar('error', 'Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={concepto ? `Editar concepto · ${concepto.nombre}` : 'Nuevo concepto'}
      tamano="5xl"
      accionPrimaria={{ etiqueta: concepto ? 'Guardar' : 'Crear concepto', onClick: guardar, cargando: guardando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-5">

        {/* ─── Banner informativo para predefinidos del sistema ─── */}
        {concepto?.es_predefinido && (
          <div className="rounded-card border border-texto-marca/30 bg-texto-marca/10 p-3">
            <div className="flex items-start gap-2 mb-1.5">
              <ShieldIcon size={14} className="text-texto-marca shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-texto-marca">
                Concepto predefinido del sistema
              </p>
            </div>
            <p className="text-xs text-texto-secundario">
              {explicacionConcepto(concepto.categoria)}
            </p>
            <p className="text-[11px] text-texto-terciario mt-1.5">
              Podés editar el monto, la condición o desactivarlo, pero no eliminarlo.
              Si necesitás variantes (por sector, por puesto), duplicá este concepto desde el listado.
            </p>
          </div>
        )}

        {/* ─── Identidad ─── */}
        <section>
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Identidad</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              etiqueta="Nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Presentismo"
            />
            <Select
              etiqueta="Categoría"
              valor={categoria}
              opciones={[{ valor: '', etiqueta: 'Sin categoría' }, ...OPCIONES_CATEGORIA.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))]}
              onChange={cambiarCategoria}
            />
          </div>
        </section>

        {/* ─── Tipo (pills) ─── */}
        <section className="pt-4 border-t border-white/[0.07]">
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Tipo</h3>
          <div className="flex gap-2">
            <PillTipo activo={tipo === 'haber'} onClick={() => setTipo('haber')} etiqueta="Haber" descripcion="Suma al monto neto" />
            <PillTipo activo={tipo === 'descuento'} onClick={() => setTipo('descuento')} etiqueta="Descuento" descripcion="Resta al monto neto" />
          </div>
        </section>

        {/* ─── 2 columnas: Cálculo / Comportamiento ─── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-5 pt-4 border-t border-white/[0.07]">

          {/* COL IZQ — Cálculo */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Cálculo</h3>
            <Select
              etiqueta="Modo de cálculo"
              valor={modo}
              opciones={OPCIONES_MODO.map(o => ({ valor: o.valor, etiqueta: o.etiqueta, descripcion: o.descripcion }))}
              onChange={(v) => setModo(v as ModoCalculoConcepto)}
            />
            {modo !== 'manual' && (
              modo === 'porcentaje_basico' ? (
                <Input
                  etiqueta="Porcentaje (%)"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="10"
                />
              ) : (
                <InputMoneda etiqueta="Valor" value={valor} onChange={setValor} />
              )
            )}
            <div>
              <label className="block text-sm text-texto-secundario mb-1.5">Descripción</label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Para qué sirve este concepto, cómo se aplica, etc."
                className="w-full rounded-md bg-superficie-tarjeta border border-borde-sutil px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca/50 resize-none"
              />
            </div>
          </section>

          <div className="hidden md:block bg-white/[0.07]" />

          {/* COL DER — Comportamiento */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Comportamiento</h3>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 px-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-texto-primario">Aplicar automáticamente</div>
                <div className="text-xs text-texto-terciario">
                  Si está apagado, el motor no lo aplica solo: queda como sugerencia para agregar manual.
                </div>
              </div>
              <Interruptor activo={automatico} onChange={setAutomatico} />
            </div>

            {automatico && (
              <div className="space-y-2">
                <Select
                  etiqueta="Condición"
                  valor={tipoCondicion}
                  opciones={etiquetasCondicion(periodicidad).map(c => ({ valor: c.valor, etiqueta: c.etiqueta }))}
                  onChange={(v) => setTipoCondicion(v as TipoCondicion)}
                />
                {tipoCondicion === 'antiguedad_minima' && (
                  <Input
                    etiqueta="Meses de antigüedad"
                    value={mesesAntiguedad}
                    onChange={e => setMesesAntiguedad(e.target.value)}
                    placeholder="12"
                  />
                )}
                {tipoCondicion === 'minimo_dias' && (
                  <Input
                    etiqueta="Días trabajados mínimos"
                    value={valorCondicion}
                    onChange={e => setValorCondicion(e.target.value)}
                    placeholder="20"
                  />
                )}
                {tipoCondicion === 'trabajo_feriado' && (
                  <Input
                    etiqueta="Feriados trabajados mínimos"
                    value={valorCondicion}
                    onChange={e => setValorCondicion(e.target.value)}
                    placeholder="1"
                  />
                )}
                {tipoCondicion === 'horas_minimas' && (
                  <Input
                    etiqueta="Horas trabajadas mínimas"
                    value={valorCondicion}
                    onChange={e => setValorCondicion(e.target.value)}
                    placeholder="160"
                  />
                )}
              </div>
            )}

            {/* Periodicidad: cuándo aparece el concepto. */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 px-2.5">
              <div className="text-sm text-texto-primario">Cuándo se aplica</div>
              <div className="text-xs text-texto-terciario mb-2">
                Define en qué liquidación aparece el concepto.
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPeriodicidad('mensual')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    periodicidad === 'mensual'
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'border-borde-sutil text-texto-terciario hover:text-texto-primario'
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodicidad('por_periodo')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    periodicidad === 'por_periodo'
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'border-borde-sutil text-texto-terciario hover:text-texto-primario'
                  }`}
                >
                  Cada liquidación
                </button>
              </div>
              <p className="text-[11px] text-texto-terciario mt-2">
                {periodicidad === 'mensual'
                  ? 'Solo aparece en la última liquidación del mes (segunda quincena o última semana). El monto se calcula sobre el básico mensual del empleado. Ideal para Presentismo, Antigüedad, premios.'
                  : 'Aparece en todas las liquidaciones (cada quincena, semana o mes). Ideal para descuentos por cuotas o adicionales por período (turno noche, etc).'}
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 px-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-texto-primario">Activo</div>
                <div className="text-xs text-texto-terciario">
                  Apagar oculta el concepto en los selectores sin borrarlo.
                </div>
              </div>
              <Interruptor activo={activo} onChange={setActivo} />
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function construirCondicion(
  tipo: TipoCondicion,
  mesesAntiguedadStr: string,
  valorCondicionStr: string,
  automatico: boolean,
): Record<string, unknown> | null {
  if (!automatico) return null
  if (tipo === 'antiguedad_minima') {
    const meses = Number(mesesAntiguedadStr) || 0
    return { tipo, meses }
  }
  if (tipo === 'minimo_dias') {
    const dias = Number(valorCondicionStr) || 0
    return { tipo, dias }
  }
  if (tipo === 'trabajo_feriado') {
    const feriados = Number(valorCondicionStr) || 1
    return { tipo, feriados }
  }
  if (tipo === 'horas_minimas') {
    const horas = Number(valorCondicionStr) || 0
    return { tipo, horas }
  }
  // siempre, sin_ausencias, sin_tardanzas, asistencia_perfecta → no parámetros.
  return { tipo }
}

function PillTipo({
  activo, etiqueta, descripcion, onClick,
}: { activo: boolean; etiqueta: string; descripcion: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-start text-left rounded-lg py-2 px-3 transition-colors border ${
        activo
          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
          : 'border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
      }`}
    >
      <span className="text-sm font-medium">{etiqueta}</span>
      <span className="text-xs opacity-80">{descripcion}</span>
    </button>
  )
}

/**
 * Devuelve una explicación clara y corta de qué significa cada
 * concepto predefinido del sistema. Se muestra en el editor para que
 * el operador entienda para qué sirve antes de tocar valores.
 */
function explicacionConcepto(categoria: CategoriaConcepto | null): string {
  switch (categoria) {
    case 'presentismo':
      return 'Premio que se le otorga al empleado por NO haber faltado en el período (mes o quincena según configuración). Se suele calcular como un porcentaje del básico o un monto fijo, y se paga junto al sueldo.'
    case 'premio':
      return 'Premio extra por algún logro o conducta (puntualidad, productividad, asistencia perfecta, etc.). Configurá la condición que tiene que cumplir el empleado para que el motor lo aplique automáticamente.'
    case 'antiguedad':
      return 'Adicional por la cantidad de años o meses que el empleado lleva en la empresa. Se calcula como un porcentaje del básico o un monto fijo creciente. Normalmente se paga todos los meses.'
    case 'descuento_uniforme':
      return 'Descuento por uniforme entregado al empleado, generalmente en cuotas mensuales. Se descuenta del neto a cobrar hasta cubrir el costo total.'
    case 'bono':
      return 'Bono adicional por logros puntuales o por temporadas específicas. Normalmente se paga una vez o en eventos especiales (fin de año, cumplimiento de objetivos).'
    case 'adicional':
      return 'Adicional por una característica del puesto: turno noche, zona desfavorable, manejo de valores, etc. Suele aplicarse en cada período.'
    case 'descuento_otro':
      return 'Descuento no atado a un concepto típico (multa, faltante de caja, anticipo no devuelto, etc.). Se resta del neto a cobrar.'
    default:
      return 'Concepto del sistema que se aplica automáticamente al recibo según la condición y la periodicidad configuradas.'
  }
}

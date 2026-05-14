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

const TIPOS_CONDICION = [
  { valor: 'sin_ausencias',      etiqueta: 'Sin ausencias en el período' },
  { valor: 'sin_tardanzas',      etiqueta: 'Sin tardanzas en el período' },
  { valor: 'antiguedad_minima',  etiqueta: 'Antigüedad mínima (meses)' },
  { valor: 'siempre',            etiqueta: 'Siempre' },
] as const

type TipoCondicion = typeof TIPOS_CONDICION[number]['valor']

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
  const [recurrente, setRecurrente] = useState(true)
  const [activo, setActivo] = useState(true)
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
      setRecurrente(concepto.recurrente)
      setActivo(concepto.activo)
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
      setRecurrente(true)
      setActivo(true)
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

    const condicion = construirCondicion(tipoCondicion, mesesAntiguedad, automatico)

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
          recurrente,
          activo,
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
                  opciones={TIPOS_CONDICION.map(c => ({ valor: c.valor, etiqueta: c.etiqueta }))}
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
              </div>
            )}

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 px-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-texto-primario">Recurrente</div>
                <div className="text-xs text-texto-terciario">
                  Se aplica en cada recibo donde se cumpla la condición.
                </div>
              </div>
              <Interruptor activo={recurrente} onChange={setRecurrente} />
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
  automatico: boolean,
): Record<string, unknown> | null {
  if (!automatico) return null
  if (tipo === 'antiguedad_minima') {
    const meses = Number(mesesAntiguedadStr) || 0
    return { tipo, meses }
  }
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

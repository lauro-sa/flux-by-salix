'use client'

/**
 * AsignadorConceptosContrato — UI para asignar conceptos del catálogo
 * al contrato de un empleado.
 *
 * Tiene dos variantes:
 *
 * 1. modo="seleccion" (controlled, sin persistencia):
 *    Tags toggleables. El parent decide cuándo persistir (típicamente
 *    al crear un contrato nuevo, junto al resto del payload).
 *
 * 2. modo="contrato" (uncontrolled, persiste vía PUT):
 *    Pensado para la ficha laboral. Carga `/api/nominas/contratos/[id]/conceptos`,
 *    permite editar valor_override inline, y hace PUT al guardar.
 *
 * El componente se separa para evitar duplicar la UI en dos lugares.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6b).
 */

import { useEffect, useMemo, useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Tag, Save, Loader2, Settings } from 'lucide-react'
import Link from 'next/link'
import type { ConceptoNomina, ConceptoContratoConDetalle } from '@/tipos/nominas'

const ETIQUETAS_MODO: Record<string, string> = {
  monto_fijo: 'Monto fijo',
  porcentaje_basico: '% del básico',
  por_dia: 'Por día',
  por_evento: 'Por evento',
  manual: 'Manual',
}

interface SeleccionItem {
  concepto_id: string
  valor_override: number | null
}

// ────────────────────────────────────────────────────────────────
// Modo SELECCIÓN (controlled, para EditorContrato)
// ────────────────────────────────────────────────────────────────

interface PropsSeleccion {
  modo: 'seleccion'
  /** Catálogo de conceptos disponibles (solo activos). */
  catalogo: ConceptoNomina[]
  /** IDs seleccionados. El parent es la fuente de verdad. */
  seleccionados: string[]
  onCambio: (idsNuevos: string[]) => void
}

// ────────────────────────────────────────────────────────────────
// Modo CONTRATO (uncontrolled, para tab Conceptos)
// ────────────────────────────────────────────────────────────────

interface PropsContrato {
  modo: 'contrato'
  contratoId: string
  /** Para feedback contextual: si es vigente o histórico (los históricos son read-only). */
  vigente: boolean
}

type Props = PropsSeleccion | PropsContrato

export function AsignadorConceptosContrato(props: Props) {
  if (props.modo === 'seleccion') return <ModoSeleccion {...props} />
  return <ModoContrato {...props} />
}

// ════════════════════════════════════════════════════════════════
// Modo seleccion — solo tags toggleables
// ════════════════════════════════════════════════════════════════

function ModoSeleccion({ catalogo, seleccionados, onCambio }: PropsSeleccion) {
  const set = useMemo(() => new Set(seleccionados), [seleccionados])

  const toggle = (id: string) => {
    const nuevo = new Set(set)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    onCambio(Array.from(nuevo))
  }

  if (catalogo.length === 0) {
    return (
      <p className="text-xs text-texto-terciario italic">
        No hay conceptos en el catálogo. Configurá los conceptos desde{' '}
        <Link href="/nominas?tab=configuracion" className="text-texto-marca underline-offset-2 hover:underline">
          Nóminas → Configuración
        </Link>
        {' '}y van a aparecer acá para asignar al contrato.
      </p>
    )
  }

  const haberes = catalogo.filter(c => c.tipo === 'haber')
  const descuentos = catalogo.filter(c => c.tipo === 'descuento')

  return (
    <div className="space-y-4">
      {haberes.length > 0 && (
        <GrupoTags
          titulo="Haberes"
          conceptos={haberes}
          seleccionados={set}
          onToggle={toggle}
        />
      )}
      {descuentos.length > 0 && (
        <GrupoTags
          titulo="Descuentos"
          conceptos={descuentos}
          seleccionados={set}
          onToggle={toggle}
        />
      )}
    </div>
  )
}

function GrupoTags({
  titulo, conceptos, seleccionados, onToggle,
}: {
  titulo: string
  conceptos: ConceptoNomina[]
  seleccionados: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {conceptos.map(c => {
          const activo = seleccionados.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors ${
                activo
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'border-borde-sutil text-texto-terciario hover:border-borde-fuerte'
              }`}
              title={c.descripcion ?? undefined}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
              <span>{c.nombre}</span>
              <span className="text-[10px] opacity-75">· {ETIQUETAS_MODO[c.modo_calculo]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Modo contrato — toggles + override + persistencia
// ════════════════════════════════════════════════════════════════

function ModoContrato({ contratoId, vigente }: PropsContrato) {
  const toast = useToast()
  const { tienePermiso } = useRol()
  const puedeEditar = tienePermiso('nomina', 'editar') && vigente

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [catalogo, setCatalogo] = useState<ConceptoNomina[]>([])
  const [seleccion, setSeleccion] = useState<Map<string, SeleccionItem>>(new Map())
  const [original, setOriginal] = useState<Map<string, SeleccionItem>>(new Map())

  // ─── Carga inicial ───
  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await fetch(`/api/nominas/contratos/${contratoId}/conceptos`)
        const data = await res.json()
        if (cancelado) return
        if (!res.ok) {
          toast.mostrar('error', data.error || 'No se pudieron cargar los conceptos')
          return
        }
        const cat = (data.catalogo ?? []) as ConceptoNomina[]
        const asig = (data.asignaciones ?? []) as ConceptoContratoConDetalle[]
        setCatalogo(cat)
        const inicial = new Map<string, SeleccionItem>()
        for (const a of asig) {
          if (!a.activo) continue
          // Supabase devuelve numeric(14,4) como string; lo normalizamos
          // a number para que la comparación de cambios funcione.
          const overrideNum = a.valor_override === null || a.valor_override === undefined
            ? null
            : Number(a.valor_override)
          inicial.set(a.concepto_id, { concepto_id: a.concepto_id, valor_override: overrideNum })
        }
        setSeleccion(new Map(inicial))
        setOriginal(new Map(inicial))
      } catch (err) {
        console.error('[AsignadorConceptos] error', err)
        toast.mostrar('error', 'Error de red al cargar conceptos')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [contratoId, toast])

  // ─── Helpers de mutación ───
  const toggle = (concepto: ConceptoNomina) => {
    if (!puedeEditar) return
    const nuevo = new Map(seleccion)
    if (nuevo.has(concepto.id)) nuevo.delete(concepto.id)
    else nuevo.set(concepto.id, { concepto_id: concepto.id, valor_override: null })
    setSeleccion(nuevo)
  }

  const cambiarOverride = (conceptoId: string, valor: string) => {
    if (!puedeEditar) return
    const num = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
    if (num !== null && !Number.isFinite(num)) return
    const nuevo = new Map(seleccion)
    const item = nuevo.get(conceptoId)
    if (!item) return
    nuevo.set(conceptoId, { ...item, valor_override: num })
    setSeleccion(nuevo)
  }

  const hayCambios = useMemo(() => {
    if (seleccion.size !== original.size) return true
    for (const [k, v] of seleccion) {
      const orig = original.get(k)
      if (!orig) return true
      if ((orig.valor_override ?? null) !== (v.valor_override ?? null)) return true
    }
    return false
  }, [seleccion, original])

  const descartar = () => setSeleccion(new Map(original))

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/nominas/contratos/${contratoId}/conceptos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptos: Array.from(seleccion.values()).map(s => ({
            concepto_id: s.concepto_id,
            valor_override: s.valor_override,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', 'Conceptos actualizados')
      setOriginal(new Map(seleccion))
    } catch (err) {
      console.error('[AsignadorConceptos] guardar error', err)
      toast.mostrar('error', 'Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (catalogo.length === 0 && seleccion.size === 0) {
    return (
      <EstadoVacio
        icono={<Tag size={48} strokeWidth={1.5} />}
        titulo="Sin conceptos en el catálogo"
        descripcion="Para asignar premios o descuentos al contrato, primero creá los conceptos en el catálogo de la empresa."
        accion={
          <Link href="/nominas?tab=configuracion">
            <Boton variante="secundario" icono={<Settings size={14} />}>Ir a Configuración</Boton>
          </Link>
        }
      />
    )
  }

  const haberes = catalogo.filter(c => c.tipo === 'haber')
  const descuentos = catalogo.filter(c => c.tipo === 'descuento')

  return (
    <div className="space-y-5">
      {/* Header con CTA si hay cambios */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-texto-primario">Conceptos aplicables</h3>
          <p className="text-xs text-texto-terciario mt-0.5">
            {vigente
              ? 'Tocá un concepto para asignárselo. El override solo se usa si el concepto no es de modo manual.'
              : 'Solo lectura — los contratos históricos no se editan.'}
          </p>
        </div>
        {puedeEditar && hayCambios && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={descartar}
              className="text-xs text-texto-terciario hover:text-texto-primario px-2 py-1.5"
              disabled={guardando}
            >
              Descartar
            </button>
            <Boton icono={<Save size={14} />} onClick={guardar} cargando={guardando}>
              Guardar cambios
            </Boton>
          </div>
        )}
      </div>

      {haberes.length > 0 && (
        <ListaConceptos
          titulo="Haberes"
          conceptos={haberes}
          seleccion={seleccion}
          puedeEditar={puedeEditar}
          onToggle={toggle}
          onOverride={cambiarOverride}
        />
      )}
      {descuentos.length > 0 && (
        <ListaConceptos
          titulo="Descuentos"
          conceptos={descuentos}
          seleccion={seleccion}
          puedeEditar={puedeEditar}
          onToggle={toggle}
          onOverride={cambiarOverride}
        />
      )}
    </div>
  )
}

function ListaConceptos({
  titulo, conceptos, seleccion, puedeEditar, onToggle, onOverride,
}: {
  titulo: string
  conceptos: ConceptoNomina[]
  seleccion: Map<string, SeleccionItem>
  puedeEditar: boolean
  onToggle: (c: ConceptoNomina) => void
  onOverride: (id: string, valor: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">{titulo}</p>
      <div className="rounded-lg border border-borde-sutil divide-y divide-borde-sutil overflow-hidden">
        {conceptos.map(c => {
          const item = seleccion.get(c.id)
          const activo = item !== undefined
          const permiteOverride = activo && c.modo_calculo !== 'manual'
          const valorOverride = item?.valor_override ?? null
          return (
            <div key={c.id} className={`flex items-center gap-3 px-3 py-2.5 ${activo ? 'bg-superficie-elevada/30' : ''}`}>
              <button
                type="button"
                onClick={() => onToggle(c)}
                disabled={!puedeEditar}
                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  activo
                    ? 'bg-texto-marca border-texto-marca'
                    : 'border-borde-fuerte bg-superficie-tarjeta hover:border-texto-marca'
                } ${puedeEditar ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
                aria-label={activo ? 'Quitar' : 'Asignar'}
              >
                {activo && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-texto-primario truncate">{c.nombre}</span>
                  <span className="text-[10px] text-texto-terciario uppercase tracking-wider shrink-0">
                    {ETIQUETAS_MODO[c.modo_calculo]}
                  </span>
                </div>
                {c.descripcion && (
                  <p className="text-xs text-texto-terciario truncate mt-0.5">{c.descripcion}</p>
                )}
              </div>

              {/* Valor del catálogo */}
              <div className="text-xs text-texto-terciario shrink-0 w-24 text-right tabular-nums">
                {c.valor === null
                  ? '—'
                  : c.modo_calculo === 'porcentaje_basico'
                  ? `${c.valor}%`
                  : `$ ${Number(c.valor).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
              </div>

              {/* Input de override */}
              <div className="shrink-0 w-28">
                {permiteOverride ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorOverride === null ? '' : String(valorOverride)}
                    onChange={e => onOverride(c.id, e.target.value)}
                    disabled={!puedeEditar}
                    placeholder="Override"
                    className="w-full rounded bg-superficie-tarjeta border border-borde-sutil px-2 py-1 text-xs text-texto-primario placeholder:text-texto-terciario/60 focus:outline-none focus:border-texto-marca/50 text-right tabular-nums disabled:opacity-50"
                  />
                ) : (
                  <div className="text-[10px] text-texto-terciario/50 text-right italic">
                    {activo ? (c.modo_calculo === 'manual' ? 'manual' : '—') : ''}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

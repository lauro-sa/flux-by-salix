'use client'

/**
 * Mini-form para agregar un concepto del catálogo SOLO a este período
 * (sin asignarlo al contrato). Crea un ajuste tipo 'agregar'.
 *
 * Se usa en el panel "Ajustes del período" como 4ª opción al lado de
 * Adelanto / Descuento / Bono. El operador elige uno de los conceptos
 * del catálogo que NO están asignados al contrato vigente, ingresa un
 * monto y un motivo, y se crea el ajuste.
 */

import { useEffect, useMemo, useState } from 'react'
import { Tag, Loader2 } from 'lucide-react'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import type { ConceptoNomina } from '@/tipos/nominas'

interface Props {
  miembroId: string
  periodoInicio: string
  periodoFin: string
  /**
   * IDs de conceptos que YA están asignados al contrato vigente.
   * Los excluimos del picker para forzar que el operador use el
   * menú "•••" del desglose si quiere overridearlos (es el flujo
   * correcto y la API valida esto también).
   */
  conceptosEnContratoIds: Set<string>
  onCancelar: () => void
  onGuardado: () => void | Promise<void>
}

export function SelectorConceptoCatalogo({
  miembroId, periodoInicio, periodoFin, conceptosEnContratoIds, onCancelar, onGuardado,
}: Props) {
  const toast = useToast()
  const [catalogo, setCatalogo] = useState<ConceptoNomina[]>([])
  const [cargando, setCargando] = useState(true)
  const [conceptoIdSel, setConceptoIdSel] = useState<string>('')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Cargar catálogo de conceptos activos.
  useEffect(() => {
    let cancelado = false
    fetch('/api/nominas/conceptos')
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const lista = (data.conceptos ?? []) as ConceptoNomina[]
        setCatalogo(lista.filter(c => c.activo))
      })
      .catch(err => console.error('[SelectorConceptoCatalogo] error:', err))
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  // Conceptos elegibles: activos + NO asignados al contrato.
  const elegibles = useMemo(
    () => catalogo.filter(c => !conceptosEnContratoIds.has(c.id)),
    [catalogo, conceptosEnContratoIds],
  )

  // Prefill del monto al cambiar el concepto seleccionado: si el
  // concepto del catálogo tiene un `valor` por default, lo usamos.
  useEffect(() => {
    if (!conceptoIdSel) return
    const c = catalogo.find(x => x.id === conceptoIdSel)
    if (c && c.valor !== null && c.valor !== undefined && !monto) {
      setMonto(String(Number(c.valor)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptoIdSel])

  const guardar = async () => {
    if (!conceptoIdSel) {
      toast.mostrar('advertencia', 'Elegí un concepto')
      return
    }
    const montoNum = parseFloat(monto)
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/nominas/ajustes-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          concepto_id: conceptoIdSel,
          tipo_ajuste: 'agregar',
          monto_override: montoNum,
          motivo: motivo.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo agregar el concepto')
        return
      }
      toast.mostrar('exito', 'Concepto agregado al período')
      await onGuardado()
    } finally {
      setGuardando(false)
    }
  }

  const conceptoSeleccionado = catalogo.find(c => c.id === conceptoIdSel)

  return (
    <div className="space-y-2 p-3 rounded-card border border-white/[0.07] bg-white/[0.02]">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-texto-terciario">
        <Tag size={11} />
        Concepto del catálogo (solo este período)
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={14} className="animate-spin text-texto-terciario" />
        </div>
      ) : elegibles.length === 0 ? (
        <p className="text-xs text-texto-terciario py-2">
          No hay conceptos del catálogo disponibles. Todos los activos ya están en el contrato.
        </p>
      ) : (
        <>
          <select
            value={conceptoIdSel}
            onChange={e => setConceptoIdSel(e.target.value)}
            className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-card px-2 py-1.5 text-texto-primario"
          >
            <option value="">Elegí un concepto...</option>
            {elegibles.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.tipo === 'haber' ? 'suma' : 'resta'})
              </option>
            ))}
          </select>

          {conceptoSeleccionado?.descripcion && (
            <p className="text-[11px] text-texto-terciario italic">
              {conceptoSeleccionado.descripcion}
            </p>
          )}

          <InputMoneda value={monto} onChange={setMonto} moneda="ARS" placeholder="Monto" />
          <Input
            tipo="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo (opcional, ej: Bono navideño)"
          />
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Boton tamano="xs" onClick={guardar} cargando={guardando}
          disabled={!conceptoIdSel || !monto || parseFloat(monto) <= 0}>
          Agregar
        </Boton>
        <Boton variante="fantasma" tamano="xs" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  )
}

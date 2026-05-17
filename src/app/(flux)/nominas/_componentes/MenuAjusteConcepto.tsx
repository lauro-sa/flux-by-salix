'use client'

/**
 * Menú "•••" que aparece junto a cada concepto del desglose de la
 * liquidación. Permite al operador hacer ajustes puntuales SOLO para
 * este período sin tocar el contrato:
 *
 *   • Cambiar el monto (override) — abre un mini-form con monto +
 *     motivo y crea/actualiza un ajuste tipo 'override'.
 *   • Excluir el concepto solo este período — confirma y crea un
 *     ajuste tipo 'excluir'.
 *   • Restaurar — si ya existe un ajuste, lo borra para que el motor
 *     vuelva a aplicar el cálculo normal.
 *
 * Persiste vía POST /api/nominas/ajustes-periodo. Llama `onCambio()`
 * después de cada operación para que el padre recalcule el recibo.
 */

import { useEffect, useRef, useState } from 'react'
import {
  MoreHorizontal, Pencil, Ban, RotateCcw, X as IconX, Check, Loader2,
} from 'lucide-react'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'

interface Props {
  miembroId: string
  conceptoId: string
  conceptoNombre: string
  periodoInicio: string
  periodoFin: string
  /**
   * Monto que el motor calculó para este concepto (sin ajustes). Sirve
   * como prefill al abrir el editor de override.
   */
  montoCalculado: number
  /**
   * Si ya existe un ajuste para este concepto en este período. Si lo
   * hay, mostramos "Restaurar" en lugar de las opciones normales.
   */
  ajusteActual: {
    id: string
    tipo_ajuste: 'override' | 'excluir' | 'agregar'
    monto_override: number | null
    motivo: string | null
  } | null
  onCambio: () => void | Promise<void>
}

export function MenuAjusteConcepto({
  miembroId, conceptoId, conceptoNombre, periodoInicio, periodoFin,
  montoCalculado, ajusteActual, onCambio,
}: Props) {
  const toast = useToast()
  const refContenedor = useRef<HTMLDivElement>(null)

  type Modo = 'cerrado' | 'menu' | 'override'
  const [modo, setModo] = useState<Modo>('cerrado')
  const [montoEdit, setMontoEdit] = useState<string>('')
  const [motivoEdit, setMotivoEdit] = useState<string>('')
  const [guardando, setGuardando] = useState(false)

  // Cerrar al clickear afuera.
  useEffect(() => {
    if (modo === 'cerrado') return
    const onDocClick = (e: MouseEvent) => {
      if (!refContenedor.current) return
      if (!refContenedor.current.contains(e.target as Node)) setModo('cerrado')
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [modo])

  const abrirOverride = () => {
    setMontoEdit(String(ajusteActual?.monto_override ?? montoCalculado))
    setMotivoEdit(ajusteActual?.motivo ?? '')
    setModo('override')
  }

  const guardarOverride = async () => {
    const monto = parseFloat(montoEdit)
    if (!Number.isFinite(monto) || monto < 0) {
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
          concepto_id: conceptoId,
          tipo_ajuste: 'override',
          monto_override: monto,
          motivo: motivoEdit.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', `Monto ajustado solo este período`)
      setModo('cerrado')
      await onCambio()
    } finally {
      setGuardando(false)
    }
  }

  const excluir = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/nominas/ajustes-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          concepto_id: conceptoId,
          tipo_ajuste: 'excluir',
          monto_override: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo excluir')
        return
      }
      toast.mostrar('exito', `"${conceptoNombre}" excluido este período`)
      setModo('cerrado')
      await onCambio()
    } finally {
      setGuardando(false)
    }
  }

  const restaurar = async () => {
    if (!ajusteActual) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/nominas/ajustes-periodo/${ajusteActual.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo restaurar')
        return
      }
      toast.mostrar('exito', 'Ajuste eliminado, vuelve al cálculo normal')
      setModo('cerrado')
      await onCambio()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div ref={refContenedor} className="relative inline-block">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setModo(modo === 'cerrado' ? 'menu' : 'cerrado')}
        className="p-1 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada"
        aria-label="Acciones del concepto"
        title={ajusteActual ? 'Ajustado en este período' : 'Ajustar para este período'}
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Popover menú */}
      {modo === 'menu' && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-borde-sutil bg-superficie-elevada shadow-lg py-1">
          {ajusteActual ? (
            <>
              <ItemMenu
                icono={<RotateCcw size={13} />}
                texto="Restaurar cálculo normal"
                onClick={restaurar}
                cargando={guardando}
                detalle={ajusteActual.tipo_ajuste === 'excluir'
                  ? 'Vuelve a aplicarse el concepto'
                  : `Quita el monto manual ($${ajusteActual.monto_override})`}
              />
              {ajusteActual.tipo_ajuste !== 'excluir' && (
                <ItemMenu
                  icono={<Pencil size={13} />}
                  texto="Cambiar monto"
                  onClick={abrirOverride}
                  detalle="Editar el override actual"
                />
              )}
            </>
          ) : (
            <>
              <ItemMenu
                icono={<Pencil size={13} />}
                texto="Cambiar monto este período"
                onClick={abrirOverride}
                detalle="No afecta el contrato"
              />
              <ItemMenu
                icono={<Ban size={13} />}
                texto="Excluir este período"
                onClick={excluir}
                cargando={guardando}
                detalle="Sigue asignado al contrato"
                peligro
              />
            </>
          )}
        </div>
      )}

      {/* Popover override */}
      {modo === 'override' && (
        <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-borde-sutil bg-superficie-elevada shadow-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-texto-terciario">
              Monto solo este período
            </p>
            <button
              type="button"
              onClick={() => setModo('cerrado')}
              className="text-texto-terciario hover:text-texto-primario p-0.5"
            >
              <IconX size={12} />
            </button>
          </div>
          <InputMoneda value={montoEdit} onChange={setMontoEdit} moneda="ARS" />
          <Input
            tipo="text"
            value={motivoEdit}
            onChange={e => setMotivoEdit(e.target.value)}
            placeholder="Motivo (opcional)"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Boton variante="fantasma" tamano="xs" onClick={() => setModo('cerrado')} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton tamano="xs" icono={<Check size={12} />} onClick={guardarOverride} cargando={guardando}>
              Aplicar
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemMenu({
  icono, texto, detalle, onClick, cargando = false, peligro = false,
}: {
  icono: React.ReactNode
  texto: string
  detalle?: string
  onClick: () => void
  cargando?: boolean
  peligro?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-superficie-hover disabled:opacity-50 ${
        peligro ? 'text-insignia-peligro' : 'text-texto-secundario'
      }`}
    >
      <span className="mt-0.5 shrink-0">{cargando ? <Loader2 size={13} className="animate-spin" /> : icono}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{texto}</span>
        {detalle && <span className="block text-[10px] text-texto-terciario mt-0.5">{detalle}</span>}
      </span>
    </button>
  )
}

'use client'

/**
 * RegistroParada — BottomSheet mínimo para escribir una nota libre de una
 * parada genérica del recorrido.
 *
 * Casos de uso: el visitador agregó una parada personal, una diligencia, una
 * visita informal que no justifica crear un contacto/visita formal, etc.
 * La nota queda sólo en la parada (no se registra en chatter ni otras tablas).
 *
 * Se usa en: PaginaRecorrido (tarjeta colapsada de parada genérica) y
 * en el resumen del día al tocar una tarjeta de parada.
 */

import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { useToast } from '@/componentes/feedback/Toast'

interface PropiedadesRegistroParada {
  abierto: boolean
  onCerrar: () => void
  paradaId: string
  tituloParada: string
  notasIniciales: string | null
  onGuardado: (notas: string | null) => void
}

function RegistroParada({
  abierto,
  onCerrar,
  paradaId,
  tituloParada,
  notasIniciales,
  onGuardado,
}: PropiedadesRegistroParada) {
  const { mostrar } = useToast()
  const [notas, setNotas] = useState(notasIniciales || '')
  const [guardando, setGuardando] = useState(false)

  // Sincronizar el textarea cuando cambia la parada que se está editando
  useEffect(() => {
    if (abierto) setNotas(notasIniciales || '')
  }, [abierto, notasIniciales, paradaId])

  const guardar = async () => {
    setGuardando(true)
    try {
      const resp = await fetch('/api/recorrido/parada-notas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parada_id: paradaId, notas: notas.trim() || null }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al guardar la nota')
      }
      onGuardado(notas.trim() || null)
      mostrar('exito', 'Nota guardada')
      onCerrar()
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'Error al guardar la nota')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={tituloParada || 'Nota de parada'}
      altura="medio"
      acciones={
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-card text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: 'var(--insignia-exito)' }}
        >
          {guardando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>Guardar nota</span>
            </>
          )}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-[12px] text-texto-terciario leading-relaxed">
          Estas observaciones quedan solo en esta parada, no se publican en el chatter
          ni en otras fichas. Sirven para recordar qué pasó ahí cuando revises el recorrido
          más adelante.
        </p>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: Reunión informal con el responsable del depósito, combustible, almuerzo..."
          rows={6}
          className="w-full rounded-card border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-sm text-texto-primario placeholder:text-texto-terciario/40 resize-none focus:outline-none focus:border-texto-marca/40 transition-colors"
          autoFocus
        />
      </div>
    </BottomSheet>
  )
}

export { RegistroParada }

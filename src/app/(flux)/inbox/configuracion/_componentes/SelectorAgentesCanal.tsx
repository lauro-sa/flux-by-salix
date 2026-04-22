'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Users, X } from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Input } from '@/componentes/ui/Input'

/**
 * SelectorAgentesCanal — Asigna qué miembros ven una bandeja de correo.
 * Se usa dentro del detalle expandido de CanalCard. El admin marca los miembros
 * que tienen acceso a ese canal; los marcados verán esa cuenta en su /inbox.
 */

interface MiembroLista {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string
  avatar_url: string | null
  correo: string
  puesto_nombre: string | null
  sector: string | null
  rol: string
}

interface PropsSelector {
  canalId: string
  agentesActuales: string[]
  onGuardado: (nuevosAgentes: string[]) => void
}

export function SelectorAgentesCanal({ canalId, agentesActuales, onGuardado }: PropsSelector) {
  const [miembros, setMiembros] = useState<MiembroLista[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(agentesActuales))
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Sincronizar si cambia el canal o el array inicial
  useEffect(() => {
    setSeleccionados(new Set(agentesActuales))
  }, [canalId, agentesActuales])

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const res = await fetch('/api/miembros')
        const data = await res.json()
        if (!activo) return
        // Solo miembros con cuenta de usuario (los "solo kiosco" sin usuario_id no tienen sentido acá)
        const lista = (data.miembros || []).filter((m: MiembroLista) => m.usuario_id)
        setMiembros(lista)
      } catch {
        // silenciar
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return miembros
    const q = busqueda.toLowerCase().trim()
    return miembros.filter(m => {
      const nombre = `${m.nombre} ${m.apellido}`.toLowerCase()
      return nombre.includes(q) || (m.correo || '').toLowerCase().includes(q)
    })
  }, [miembros, busqueda])

  const toggle = async (usuarioId: string) => {
    const nuevo = new Set(seleccionados)
    if (nuevo.has(usuarioId)) nuevo.delete(usuarioId)
    else nuevo.add(usuarioId)
    setSeleccionados(nuevo)

    // Autoguardar (patrón del resto de la config)
    setGuardando(true)
    try {
      const res = await fetch(`/api/correo/canales/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentes: [...nuevo] }),
      })
      if (res.ok) onGuardado([...nuevo])
      else setSeleccionados(new Set(agentesActuales)) // rollback si falla
    } catch {
      setSeleccionados(new Set(agentesActuales))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 mb-2">
        <Users size={14} style={{ color: 'var(--texto-terciario)' }} />
        <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
          Agentes con acceso a esta bandeja
        </label>
        {guardando && (
          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Guardando…</span>
        )}
      </div>
      <p className="text-xxs mb-2" style={{ color: 'var(--texto-terciario)' }}>
        Solo los usuarios marcados verán esta cuenta en su inbox. Si no marcás a nadie, la bandeja queda sin acceso (solo admins la ven desde configuración).
      </p>

      <div className="mb-2">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          compacto
        />
      </div>

      {cargando ? (
        <div className="text-xs py-3 text-center" style={{ color: 'var(--texto-terciario)' }}>
          Cargando miembros…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-xs py-3 text-center" style={{ color: 'var(--texto-terciario)' }}>
          {busqueda ? 'Ningún miembro coincide con la búsqueda' : 'No hay miembros disponibles'}
        </div>
      ) : (
        <div
          className="max-h-64 overflow-y-auto rounded-card"
          style={{ border: '1px solid var(--borde-sutil)' }}
        >
          {filtrados.map((m) => {
            const seleccionado = m.usuario_id ? seleccionados.has(m.usuario_id) : false
            const nombreCompleto = `${m.nombre} ${m.apellido}`.trim() || m.correo
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => m.usuario_id && toggle(m.usuario_id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{
                  background: seleccionado ? 'var(--superficie-seleccionada)' : 'transparent',
                  borderBottom: '1px solid var(--borde-sutil)',
                }}
              >
                <Avatar nombre={nombreCompleto} foto={m.avatar_url} tamano="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                    {nombreCompleto}
                  </div>
                  <div className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                    {m.puesto_nombre || m.rol} · {m.correo}
                  </div>
                </div>
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: seleccionado ? 'var(--texto-marca)' : 'transparent',
                    border: seleccionado ? 'none' : '1.5px solid var(--borde-sutil)',
                  }}
                >
                  {seleccionado && <Check size={12} color="white" strokeWidth={3} />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Resumen de seleccionados abajo (chips) */}
      {seleccionados.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {[...seleccionados].map(uid => {
            const m = miembros.find(x => x.usuario_id === uid)
            if (!m) return null
            const nombreCompleto = `${m.nombre} ${m.apellido}`.trim() || m.correo
            return (
              <div
                key={uid}
                className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xxs"
                style={{ background: 'var(--superficie-hover)', border: '1px solid var(--borde-sutil)' }}
              >
                <Avatar nombre={nombreCompleto} foto={m.avatar_url} tamano="xs" />
                <span style={{ color: 'var(--texto-primario)' }}>{nombreCompleto}</span>
                <button
                  type="button"
                  onClick={() => toggle(uid)}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Quitar"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

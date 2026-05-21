'use client'

import { useState, useMemo } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Plus, X, AlertCircle } from 'lucide-react'

/**
 * Editor de aliases de un canal de correo. Los aliases son direcciones
 * adicionales que pertenecen a la misma cuenta — típico cuando una cuenta
 * Gmail tiene un dominio propio (info@empresa.com) que reenvía a la cuenta
 * real (info.empresa@gmail.com), o cuando una cuenta IMAP soporta múltiples
 * direcciones de envío.
 *
 * Sin aliases, el sincronizador interpreta los correos enviados entre las
 * propias identidades del canal como si fueran de un contacto externo
 * (porque el "From" no coincide con el email principal). Listándolos acá,
 * el motor los reconoce como propios y los clasifica como salientes.
 *
 * Persistencia: `config_conexion.aliases: string[]` en `canales_correo`.
 */

interface Props {
  canalId: string
  configActual: Record<string, unknown>
  onActualizado?: () => void
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EditorAliasesCanal({ canalId, configActual, onActualizado }: Props) {
  const aliasesIniciales = useMemo<string[]>(() => {
    const v = configActual.aliases
    return Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string') : []
  }, [configActual.aliases])

  const [aliases, setAliases] = useState<string[]>(aliasesIniciales)
  const [nuevoAlias, setNuevoAlias] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const emailPrincipal = (configActual.email || '') as string
  const usuarioImap = (configActual.usuario || '') as string

  // Sugerencia: si el usuario IMAP es distinto del email principal y no está
  // en la lista, ofrecer agregarlo (caso típico de Gmail con alias de dominio).
  const sugerencia = useMemo(() => {
    if (!usuarioImap || !emailPrincipal) return null
    if (usuarioImap.toLowerCase() === emailPrincipal.toLowerCase()) return null
    if (aliases.some(a => a.toLowerCase() === usuarioImap.toLowerCase())) return null
    return usuarioImap
  }, [usuarioImap, emailPrincipal, aliases])

  const guardar = async (nuevosAliases: string[]) => {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/correo/canales/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_conexion: { ...configActual, aliases: nuevosAliases },
        }),
      })
      if (!res.ok) throw new Error()
      setAliases(nuevosAliases)
      onActualizado?.()
    } catch {
      setError('No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const agregar = async (alias: string) => {
    const limpio = alias.trim().toLowerCase()
    if (!limpio) return
    if (!RE_EMAIL.test(limpio)) {
      setError('Formato de email inválido')
      return
    }
    if (limpio === emailPrincipal.toLowerCase()) {
      setError('Esa dirección ya es la principal del canal')
      return
    }
    if (aliases.some(a => a.toLowerCase() === limpio)) {
      setError('Ya está agregada')
      return
    }
    setNuevoAlias('')
    await guardar([...aliases, limpio])
  }

  const quitar = async (alias: string) => {
    await guardar(aliases.filter(a => a !== alias))
  }

  return (
    <div className="pt-2" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
          Aliases del canal
        </label>
        {aliases.length > 0 && (
          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            {aliases.length} {aliases.length === 1 ? 'alias' : 'aliases'}
          </span>
        )}
      </div>
      <p className="text-xxs mb-2" style={{ color: 'var(--texto-terciario)' }}>
        Direcciones adicionales que pertenecen a esta misma cuenta. Sirve para que un correo
        enviado entre tus propias identidades no aparezca como entrante.
      </p>

      {/* Sugerencia de auto-detección */}
      {sugerencia && (
        <div
          className="flex items-start gap-2 p-2 rounded-card mb-2"
          style={{
            background: 'var(--insignia-advertencia-fondo, rgba(234, 179, 8, 0.08))',
            border: '1px solid var(--borde-sutil)',
          }}
        >
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--insignia-advertencia)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xxs" style={{ color: 'var(--texto-secundario)' }}>
              Detectamos que <span className="font-mono">{sugerencia}</span> también pertenece a este canal.
              ¿Querés agregarla como alias?
            </p>
          </div>
          <Boton
            variante="primario"
            tamano="xs"
            onClick={() => agregar(sugerencia)}
            cargando={guardando}
          >
            Agregar
          </Boton>
        </div>
      )}

      {/* Lista de aliases */}
      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {aliases.map(alias => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-card text-xxs"
              style={{
                background: 'var(--superficie-hover)',
                border: '1px solid var(--borde-sutil)',
                color: 'var(--texto-primario)',
              }}
            >
              <span className="font-mono">{alias}</span>
              <button
                type="button"
                onClick={() => quitar(alias)}
                disabled={guardando}
                title="Quitar alias"
                className="flex items-center justify-center hover:opacity-100 opacity-50 transition-opacity cursor-pointer disabled:cursor-default"
                style={{ background: 'transparent', border: 'none', color: 'var(--texto-terciario)' }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Agregar nuevo */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={nuevoAlias}
          onChange={e => { setNuevoAlias(e.target.value); setError(null) }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregar(nuevoAlias)
            }
          }}
          placeholder="otra-direccion@dominio.com"
          disabled={guardando}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-card outline-none"
          style={{
            background: 'var(--superficie-hover)',
            border: '1px solid var(--borde-sutil)',
            color: 'var(--texto-primario)',
          }}
        />
        <Boton
          variante="secundario"
          tamano="xs"
          icono={<Plus size={12} />}
          onClick={() => agregar(nuevoAlias)}
          cargando={guardando}
          disabled={!nuevoAlias.trim()}
        >
          Agregar
        </Boton>
      </div>

      {error && (
        <p className="text-xxs mt-1.5" style={{ color: 'var(--insignia-peligro)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

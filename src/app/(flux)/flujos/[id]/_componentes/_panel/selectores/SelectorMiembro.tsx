'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import SelectorPopoverBase, { type OpcionSelector } from './SelectorPopoverBase'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Selector autocomplete de miembros (sub-PR 19.3c).
 *
 * Usa GET /api/miembros — respuesta: `{ miembros: [{ id, usuario_id,
 * nombre, apellido, correo, ... }] }`.
 *
 * La acción del motor (`AccionNotificarUsuario.usuario_id`) espera el
 * `usuario_id` del perfil — no el `id` del miembro. Mapeamos a usuario_id
 * en `OpcionSelector.id`. Miembros sin cuenta de usuario (kiosco-only)
 * se filtran porque no pueden recibir notificaciones.
 *
 * Soporta modo single (default) y multi (`multi: true`). En multi, el
 * `valor` es `string[]` y mostramos chips en el trigger.
 */

interface MiembroRaw {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string | null
  correo: string | null
}

interface PropsBase {
  disabled?: boolean
}

type Props =
  | (PropsBase & { multi?: false; valor: string | null; onChange: (usuarioId: string) => void })
  | (PropsBase & { multi: true; valor: string[]; onChange: (usuarioIds: string[]) => void })

export default function SelectorMiembro(props: Props) {
  const { t } = useTraduccion()
  const { opciones, cargando, error } = useAutocompleteRemoto<MiembroRaw>({
    url: '/api/miembros',
    extraer: (raw) => {
      if (!raw || typeof raw !== 'object') return []
      const lista = (raw as { miembros?: unknown }).miembros
      if (!Array.isArray(lista)) return []
      // Solo miembros con cuenta de usuario asociada (los kiosco-only
      // no pueden recibir notificaciones del motor).
      return (lista as MiembroRaw[]).filter((m) => m.usuario_id !== null)
    },
  })

  const lista: OpcionSelector[] = useMemo(
    () =>
      opciones.map((m) => ({
        id: m.usuario_id as string, // garantizado no-null por el filtro
        etiqueta: `${m.nombre} ${m.apellido ?? ''}`.trim() || (m.correo ?? '—'),
        busqueda: `${m.correo ?? ''}`,
      })),
    [opciones],
  )

  if (props.multi === true) {
    const ids = props.valor
    const seleccionados = lista.filter((o) => ids.includes(o.id))

    return (
      <SelectorPopoverBase
        placeholder={t('flujos.selector.miembro.placeholder_multi')}
        seleccionada={null}
        opciones={lista}
        cargando={cargando}
        error={error}
        mantenerAbierto
        contenidoTrigger={
          seleccionados.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {seleccionados.map((o) => (
                <span
                  key={o.id}
                  className="inline-flex items-center gap-1 rounded bg-texto-marca/15 text-texto-marca px-1.5 py-0.5 text-xs"
                >
                  {o.etiqueta}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onChange(ids.filter((id) => id !== o.id))
                    }}
                    className="size-3 inline-flex items-center justify-center rounded-full hover:bg-texto-marca/30"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-texto-placeholder text-sm">
              {t('flujos.selector.miembro.placeholder_multi')}
            </span>
          )
        }
        onSeleccionar={(o) => {
          const yaEsta = ids.includes(o.id)
          props.onChange(yaEsta ? ids.filter((x) => x !== o.id) : [...ids, o.id])
        }}
        disabled={props.disabled}
        renderOpcion={(o) => (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              readOnly
              checked={ids.includes(o.id)}
              className="cursor-pointer pointer-events-none"
            />
            <span>{o.etiqueta}</span>
          </div>
        )}
      />
    )
  }

  // Single
  const seleccionada = lista.find((o) => o.id === props.valor) ?? null

  return (
    <SelectorPopoverBase
      placeholder={t('flujos.selector.miembro.placeholder')}
      seleccionada={seleccionada}
      opciones={lista}
      cargando={cargando}
      error={error}
      onSeleccionar={(o) => props.onChange(o.id)}
      disabled={props.disabled}
    />
  )
}

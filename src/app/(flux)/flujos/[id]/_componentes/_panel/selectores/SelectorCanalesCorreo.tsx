'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useAutocompleteRemoto } from './useAutocompleteRemoto'

/**
 * Multi-select de canales de correo (`canales_correo`) para el panel
 * del disparador `inbox.mensaje_recibido`.
 *
 * Usa GET /api/inbox/correo/canales — respuesta esperada con shape
 * `{ canales: [{ id, nombre, proveedor, estado_conexion }, ...] }`.
 *
 * Diferencia con SelectorPopoverBase (single): este componente permite
 * elegir múltiples cuentas. El popover se queda abierto mientras se
 * toggleam opciones. Las cuentas elegidas se muestran como pills
 * removibles arriba del trigger.
 *
 * Vacío = "todas las cuentas de correo de la empresa". El motor
 * interpreta `canal_ids` ausente o vacío como "sin filtro".
 */

export interface CanalCorreoItem {
  id: string
  nombre: string
  proveedor: 'imap' | 'gmail_oauth' | string
  estado_conexion: 'conectado' | 'error' | 'desconectado' | string
}

interface Props {
  valor: string[]
  onChange: (canalIds: string[]) => void
  disabled?: boolean
}

export default function SelectorCanalesCorreo({ valor, onChange, disabled }: Props) {
  const { t } = useTraduccion()
  const [abierto, setAbierto] = useState(false)
  const { opciones, cargando, error } = useAutocompleteRemoto<CanalCorreoItem>({
    url: '/api/correo/canales',
    extraer: (raw) =>
      raw && typeof raw === 'object' && Array.isArray((raw as { canales?: unknown }).canales)
        ? ((raw as { canales: CanalCorreoItem[] }).canales)
        : [],
  })

  const seleccionados = useMemo(
    () => opciones.filter((c) => valor.includes(c.id)),
    [opciones, valor],
  )

  const toggle = (id: string) => {
    if (disabled) return
    const set = new Set(valor)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange(Array.from(set))
  }

  const quitar = (id: string) => {
    if (disabled) return
    onChange(valor.filter((x) => x !== id))
  }

  const placeholder =
    valor.length === 0
      ? t('flujos.selector.canales_correo.todas')
      : t('flujos.selector.canales_correo.placeholder')

  return (
    <div className="flex flex-col gap-2">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 text-xs font-medium rounded-md border border-texto-marca/40 bg-texto-marca/15 text-texto-marca"
            >
              {c.nombre}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => quitar(c.id)}
                  className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-texto-marca/20 cursor-pointer"
                  aria-label={t('flujos.selector.canales_correo.quitar')}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setAbierto((a) => !a)}
          disabled={disabled}
          className={[
            'inline-flex items-center justify-between w-full h-9 px-3 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta',
            disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-borde-fuerte',
          ].join(' ')}
        >
          <span className={valor.length === 0 ? 'text-texto-terciario' : 'text-texto-secundario'}>
            {placeholder}
          </span>
          <ChevronDown size={14} strokeWidth={1.8} className="text-texto-terciario" />
        </button>

        {abierto && (
          <>
            {/* Click-outside catcher */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="cerrar"
              className="fixed inset-0 z-10 bg-transparent cursor-default"
              onClick={() => setAbierto(false)}
            />
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border border-borde-sutil bg-superficie-elevada shadow-lg">
              {cargando ? (
                <div className="p-3 text-xs text-texto-terciario text-center">
                  {t('flujos.selector.canales_correo.cargando')}
                </div>
              ) : error ? (
                <div className="p-3 text-xs text-insignia-peligro-texto text-center">
                  {t('flujos.selector.canales_correo.error')}
                </div>
              ) : opciones.length === 0 ? (
                <div className="p-3 text-xs text-texto-terciario text-center">
                  {t('flujos.selector.canales_correo.sin_canales')}
                </div>
              ) : (
                <ul className="py-1">
                  {opciones.map((c) => {
                    const elegido = valor.includes(c.id)
                    const desconectado = c.estado_conexion !== 'conectado'
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={[
                            'flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors',
                            elegido
                              ? 'bg-texto-marca/10 text-texto-marca'
                              : 'text-texto-secundario hover:bg-superficie-hover',
                          ].join(' ')}
                        >
                          <span className="flex flex-col gap-0.5">
                            <span>{c.nombre}</span>
                            {desconectado && (
                              <span className="text-xxs text-insignia-peligro-texto">
                                {t('flujos.selector.canales_correo.desconectado')}
                              </span>
                            )}
                          </span>
                          <span
                            className={[
                              'shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                              elegido
                                ? 'bg-texto-marca border-texto-marca text-superficie-app'
                                : 'border-borde-fuerte',
                            ].join(' ')}
                          >
                            {elegido && '✓'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

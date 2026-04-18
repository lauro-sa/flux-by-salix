'use client'

import { useState, useEffect } from 'react'
import { type ReactNode } from 'react'
import { Check, Pipette } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PickerInline } from './SelectorColor'
import { ModalAdaptable as Modal } from './ModalAdaptable'
import { Boton } from './Boton'
import { useTraduccion } from '@/lib/i18n'
import { Input } from './Input'

/**
 * ModalItemConfiguracion — Modal reutilizable para crear/editar items de configuración.
 * Se usa en: todas las secciones de ListaConfiguracion que necesitan crear/editar items simples.
 * Soporta campos configurables: nombre, porcentaje, abreviatura, color, días, etc.
 */

// ─── Tipos de campos disponibles ────────────────────────────────────

interface CampoTexto {
  tipo: 'texto'
  clave: string
  etiqueta: string
  placeholder?: string
  requerido?: boolean
  formato?: 'mayusculas' | null
  maxLength?: number
  ancho?: string
}

interface CampoNumero {
  tipo: 'numero'
  clave: string
  etiqueta: string
  placeholder?: string
  min?: number
  max?: number
  paso?: number
  sufijo?: string
  ancho?: string
}

interface CampoColor {
  tipo: 'color'
  clave: string
  etiqueta: string
  colores: { valor: string; etiqueta?: string }[]
}

interface CampoEmoji {
  tipo: 'emoji'
  clave: string
  etiqueta: string
  emojis: string[]
}

type CampoConfiguracion = CampoTexto | CampoNumero | CampoColor | CampoEmoji

// ─── Props ──────────────────────────────────────────────────────────

interface PropiedadesModalItemConfiguracion {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  campos: CampoConfiguracion[]
  valores?: Record<string, unknown>
  onGuardar: (valores: Record<string, unknown>) => void
  cargando?: boolean
  /** Texto del botón de guardar (default: "Crear" o "Guardar") */
  textoGuardar?: string
  /** Preview custom que se muestra arriba del formulario */
  renderPreview?: (valores: Record<string, unknown>) => ReactNode
}

// ─── Componente ─────────────────────────────────────────────────────

function ModalItemConfiguracion({
  abierto,
  onCerrar,
  titulo,
  campos,
  valores: valoresIniciales,
  onGuardar,
  cargando,
  textoGuardar,
  renderPreview,
}: PropiedadesModalItemConfiguracion) {
  const { t } = useTraduccion()
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const esEdicion = !!valoresIniciales
  const [pickerAbierto, setPickerAbierto] = useState(false)

  // Inicializar valores al abrir
  useEffect(() => {
    if (!abierto) return
    if (valoresIniciales) {
      setValores({ ...valoresIniciales })
    } else {
      // Valores por defecto
      const defaults: Record<string, unknown> = {}
      for (const campo of campos) {
        if (campo.tipo === 'texto') defaults[campo.clave] = ''
        else if (campo.tipo === 'numero') defaults[campo.clave] = campo.min ?? 0
        else if (campo.tipo === 'color') defaults[campo.clave] = campo.colores[0]?.valor || 'neutro'
        else if (campo.tipo === 'emoji') defaults[campo.clave] = campo.emojis[0] || '📌'
      }
      setValores(defaults)
    }
  }, [abierto, valoresIniciales, campos])

  const actualizar = (clave: string, valor: unknown) => {
    setValores(prev => ({ ...prev, [clave]: valor }))
  }

  const manejarGuardar = () => {
    // Validar requeridos
    for (const campo of campos) {
      if (campo.tipo === 'texto' && campo.requerido !== false) {
        if (!String(valores[campo.clave] || '').trim()) return
      }
    }
    onGuardar(valores)
  }

  // Primer campo requerido para validar el botón
  const primerRequerido = campos.find(c => c.tipo === 'texto' && c.requerido !== false)
  const puedeGuardar = primerRequerido
    ? !!String(valores[primerRequerido.clave] || '').trim()
    : true

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      tamano="sm"
      acciones={
        <>
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
          <Boton tamano="sm" onClick={manejarGuardar} cargando={cargando} disabled={!puedeGuardar}>
            {textoGuardar || (esEdicion ? t('comun.guardar') : t('comun.crear'))}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Preview custom */}
        {renderPreview && (
          <div className="p-3 rounded-card bg-superficie-hover/50">
            {renderPreview(valores)}
          </div>
        )}

        {/* Campos con separadores entre secciones diferentes */}
        {campos.map((campo, idx) => {
          // Separador entre campos de tipo diferente (ej: texto → color)
          const anterior = idx > 0 ? campos[idx - 1] : null
          const mostrarSeparador = anterior && anterior.tipo !== campo.tipo

          const separador = mostrarSeparador ? (
            <div key={`sep-${idx}`} className="border-t border-white/[0.06] mx-[-24px] px-[24px]" />
          ) : null
          if (campo.tipo === 'texto') {
            return (
              <div key={campo.clave}>
                <Input
                  etiqueta={campo.etiqueta}
                  value={String(valores[campo.clave] || '')}
                  onChange={(e) => {
                    let v = e.target.value
                    if (campo.formato === 'mayusculas') v = v.toUpperCase()
                    actualizar(campo.clave, v)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && puedeGuardar) manejarGuardar() }}
                  placeholder={campo.placeholder}
                  maxLength={campo.maxLength}
                  formato={null}
                  autoFocus={campos.indexOf(campo) === 0}
                />
              </div>
            )
          }

          if (campo.tipo === 'numero') {
            return (
              <div key={campo.clave}>
                <Input
                  etiqueta={campo.etiqueta}
                  tipo="number"
                  value={String(valores[campo.clave] ?? '')}
                  onChange={(e) => actualizar(campo.clave, parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && puedeGuardar) manejarGuardar() }}
                  placeholder={campo.placeholder}
                  min={campo.min}
                  max={campo.max}
                  step={campo.paso}
                  formato={null}
                />
                {campo.sufijo && (
                  <span className="text-xs text-texto-terciario mt-1 block">{campo.sufijo}</span>
                )}
              </div>
            )
          }

          if (campo.tipo === 'color') {
            const valorActual = String(valores[campo.clave] || '')
            const esCustom = !campo.colores.some(c => c.valor.toLowerCase() === valorActual.toLowerCase())
            const esHex = valorActual.startsWith('#')

            return (
              <div key={campo.clave} className="pt-1 border-t border-white/[0.06]">
                <label className="text-sm font-medium text-texto-secundario block mb-2">{campo.etiqueta}</label>
                <div className="flex flex-wrap gap-2.5 items-center">
                  {campo.colores.map(c => {
                    const sel = valorActual.toLowerCase() === c.valor.toLowerCase()
                    const bgColor = c.valor.startsWith('#') ? c.valor : `var(--insignia-${c.valor})`
                    return (
                      <button
                        key={c.valor}
                        type="button"
                        onClick={() => actualizar(campo.clave, c.valor)}
                        className={`relative size-6 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                          sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                        }`}
                        style={{ backgroundColor: bgColor }}
                      >
                        {sel && <Check size={11} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                      </button>
                    )
                  })}
                  {/* Gotero — abre PickerInline propio */}
                  <button
                    type="button"
                    onClick={() => setPickerAbierto(!pickerAbierto)}
                    className={`relative size-6 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                      esCustom
                        ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
                        : 'border-borde-fuerte'
                    }`}
                    style={esCustom && esHex ? { backgroundColor: valorActual } : undefined}
                    title={t('comun.color_personalizado')}
                  >
                    {esCustom ? (
                      <Check size={11} className="text-white drop-shadow-sm" />
                    ) : (
                      <Pipette size={11} className="text-texto-terciario" />
                    )}
                  </button>
                </div>

                {/* Picker HSL inline */}
                <AnimatePresence>
                  {pickerAbierto && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="bg-superficie-elevada border border-borde-sutil rounded-popover p-3">
                        <PickerInline
                          valor={esHex ? valorActual : '#6b7280'}
                          onChange={(c) => actualizar(campo.clave, c)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }

          if (campo.tipo === 'emoji') {
            const valorActual = String(valores[campo.clave] || '')
            return (
              <div key={campo.clave} className="pt-1 border-t border-white/[0.06]">
                <label className="text-sm font-medium text-texto-secundario block mb-2">{campo.etiqueta}</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {campo.emojis.map(emoji => {
                    const sel = valorActual === emoji
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => actualizar(campo.clave, emoji)}
                        className={`size-8 rounded-card text-base flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:bg-superficie-hover ${
                          sel ? 'bg-texto-marca/10 ring-2 ring-texto-marca scale-110' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                  {/* Input para escribir/pegar cualquier emoji */}
                  <CampoEmoji onSeleccionar={(emoji) => actualizar(campo.clave, emoji)} />
                </div>
              </div>
            )
          }

          return null
        })}
      </div>
    </Modal>
  )
}

// ─── Input de emoji aislado (evita conflictos de foco con el modal) ──

function CampoEmoji({ onSeleccionar }: { onSeleccionar: (emoji: string) => void }) {
  const { t } = useTraduccion()
  const [texto, setTexto] = useState('')

  return (
    <input
      type="text"
      value={texto}
      onChange={(e) => {
        const v = e.target.value
        const chars = [...v]
        if (chars.length > 0) {
          const ultimo = chars[chars.length - 1]
          setTexto(ultimo)
          onSeleccionar(ultimo)
        } else {
          setTexto('')
        }
      }}
      className="size-8 rounded-card text-base text-center bg-white/[0.04] border-2 border-dashed border-borde-fuerte outline-none cursor-text transition-all focus:border-texto-marca/50 hover:scale-110 hover:bg-superficie-hover"
      placeholder="✏️"
      title={t('comun.emoji_personalizado')}
    />
  )
}

export { ModalItemConfiguracion, type CampoConfiguracion, type PropiedadesModalItemConfiguracion }

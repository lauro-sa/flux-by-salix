'use client'

/**
 * InputEmailChips — Input de emails con chips, autocomplete de contactos y validación.
 * Se usa en: ModalEnviarDocumento (campos Para, CC, CCO).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChipEmail } from './ChipEmail'
import type { ContactoSugerido } from './tipos'
import { DELAY_CARGA } from '@/lib/constantes/timeouts'

interface PropiedadesInputEmailChips {
  etiqueta: string
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
  /** Si se pasa, el buscador prioriza los contactos vinculados (hijos) de este contacto */
  contactoPadreId?: string | null
  /** Nombre del contacto padre — para el título "Vinculados a …" del grupo */
  contactoPadreNombre?: string | null
}

export function InputEmailChips({
  etiqueta,
  emails,
  onChange,
  placeholder,
  contactoPadreId,
  contactoPadreNombre,
}: PropiedadesInputEmailChips) {
  const [inputValor, setInputValor] = useState('')
  const [sugerencias, setSugerencias] = useState<ContactoSugerido[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [enfocado, setEnfocado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [emailInvalido, setEmailInvalido] = useState(false)

  const agregarEmail = useCallback((valor: string) => {
    const email = valor.trim().toLowerCase()
    if (!email) return
    // Validar formato de email
    const esValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
    if (!esValido) {
      setEmailInvalido(true)
      setTimeout(() => setEmailInvalido(false), DELAY_CARGA)
      return
    }
    if (!emails.includes(email)) onChange([...emails, email])
    setInputValor('')
    setEmailInvalido(false)
    setSugerencias([])
    setMostrarSugerencias(false)
  }, [emails, onChange])

  // Buscar contactos sugeridos mientras se escribe.
  // Si hay contactoPadreId, también precarga los hijos cuando el input está vacío (al enfocar).
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Sin padre y sin query mínimo: limpiar y salir
    if (inputValor.length < 2 && !contactoPadreId) {
      setSugerencias([]); setMostrarSugerencias(false); return
    }

    const delay = inputValor.length === 0 ? 0 : 250
    timeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (inputValor) params.set('q', inputValor)
        if (contactoPadreId) params.set('padre_id', contactoPadreId)
        const res = await fetch(`/api/contactos/buscar?${params.toString()}`)
        const data = await res.json()
        const filtrados = (data.contactos || []).filter(
          (c: ContactoSugerido) => c.correo && !emails.includes(c.correo.toLowerCase())
        )
        setSugerencias(filtrados)
        // Escribir siempre abre el popover; precarga por padre solo si el input está enfocado
        if (inputValor.length >= 2 || enfocado) {
          setMostrarSugerencias(filtrados.length > 0)
        }
      } catch { setSugerencias([]) }
    }, delay)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [inputValor, emails, contactoPadreId, enfocado])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValor.trim()) {
      e.preventDefault()
      agregarEmail(inputValor)
    }
    if (e.key === 'Backspace' && !inputValor && emails.length > 0) onChange(emails.slice(0, -1))
    if (e.key === 'Escape') setMostrarSugerencias(false)
  }

  const handleBlur = () => {
    setEnfocado(false)
    setTimeout(() => {
      if (inputValor.trim()) agregarEmail(inputValor)
      setMostrarSugerencias(false)
    }, 200)
  }

  return (
    <div className="flex items-start gap-2 min-h-[44px] sm:min-h-[36px] relative">
      <span className="text-sm w-14 flex-shrink-0 pt-2 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>
        {etiqueta}
      </span>
      <div className="flex-1 relative">
        <div
          role="textbox"
          tabIndex={0}
          className="flex flex-wrap items-center gap-1 min-h-[44px] sm:min-h-[32px] cursor-text"
          onClick={() => inputRef.current?.focus()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.focus() } }}
        >
          {emails.map((email, i) => (
            <ChipEmail key={`${email}-${i}`} email={email} onRemover={() => onChange(emails.filter((_, j) => j !== i))} />
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValor}
            onChange={(e) => setInputValor(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => { setEnfocado(true); if (sugerencias.length > 0) setMostrarSugerencias(true) }}
            className={`flex-1 min-w-[120px] text-sm bg-transparent outline-none py-1.5 ${emailInvalido ? 'text-estado-error' : ''}`}
            style={{ color: emailInvalido ? 'var(--estado-error)' : 'var(--texto-primario)' }}
            placeholder={emails.length === 0 ? (placeholder || 'correo@ejemplo.com') : ''}
          />
        </div>
        {emailInvalido && (
          <p className="text-xxs mt-0.5 ml-16" style={{ color: 'var(--estado-error)' }}>
            Ingresá un correo válido
          </p>
        )}
        <AnimatePresence>
          {mostrarSugerencias && sugerencias.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 z-50 mt-1 py-1 rounded-popover shadow-lg max-h-[220px] overflow-y-auto"
              style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
            >
              {(() => {
                const hijos = sugerencias.filter(s => s.es_hijo)
                const resto = sugerencias.filter(s => !s.es_hijo)
                const itemBtn = (s: ContactoSugerido) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 flex items-baseline gap-2"
                    onMouseDown={(e) => { e.preventDefault(); agregarEmail(s.correo) }}
                  >
                    <span className="font-medium truncate" style={{ color: 'var(--texto-primario)' }}>{s.nombre}</span>
                    {s.puesto && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}>
                        {s.puesto}
                      </span>
                    )}
                    <span className="ml-auto truncate" style={{ color: 'var(--texto-terciario)' }}>{s.correo}</span>
                  </button>
                )
                return (
                  <>
                    {hijos.length > 0 && (
                      <>
                        <div className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                          {contactoPadreNombre ? `Vinculados a ${contactoPadreNombre}` : 'Vinculados al destinatario'}
                        </div>
                        {hijos.map(itemBtn)}
                      </>
                    )}
                    {hijos.length > 0 && resto.length > 0 && (
                      <div className="my-1" style={{ borderTop: '1px solid var(--borde-sutil)' }} />
                    )}
                    {resto.length > 0 && hijos.length > 0 && (
                      <div className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                        Otros contactos
                      </div>
                    )}
                    {resto.map(itemBtn)}
                  </>
                )
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

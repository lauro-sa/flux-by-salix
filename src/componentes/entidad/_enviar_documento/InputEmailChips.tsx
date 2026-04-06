'use client'

/**
 * InputEmailChips — Input de emails con chips, autocomplete de contactos y validación.
 * Se usa en: ModalEnviarDocumento (campos Para, CC, CCO).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChipEmail } from './ChipEmail'
import type { ContactoSugerido } from './tipos'

interface PropiedadesInputEmailChips {
  etiqueta: string
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
}

export function InputEmailChips({
  etiqueta,
  emails,
  onChange,
  placeholder,
}: PropiedadesInputEmailChips) {
  const [inputValor, setInputValor] = useState('')
  const [sugerencias, setSugerencias] = useState<ContactoSugerido[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
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
      setTimeout(() => setEmailInvalido(false), 2000)
      return
    }
    if (!emails.includes(email)) onChange([...emails, email])
    setInputValor('')
    setEmailInvalido(false)
    setSugerencias([])
    setMostrarSugerencias(false)
  }, [emails, onChange])

  // Buscar contactos sugeridos mientras se escribe
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (inputValor.length < 2) { setSugerencias([]); setMostrarSugerencias(false); return }
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(inputValor)}`)
        const data = await res.json()
        const filtrados = (data.contactos || []).filter(
          (c: ContactoSugerido) => c.correo && !emails.includes(c.correo.toLowerCase())
        )
        setSugerencias(filtrados)
        setMostrarSugerencias(filtrados.length > 0)
      } catch { setSugerencias([]) }
    }, 250)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [inputValor, emails])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValor.trim()) {
      e.preventDefault()
      agregarEmail(inputValor)
    }
    if (e.key === 'Backspace' && !inputValor && emails.length > 0) onChange(emails.slice(0, -1))
    if (e.key === 'Escape') setMostrarSugerencias(false)
  }

  const handleBlur = () => {
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
            onFocus={() => { if (sugerencias.length > 0) setMostrarSugerencias(true) }}
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
              className="absolute left-0 right-0 z-50 mt-1 py-1 rounded-lg shadow-lg max-h-[160px] overflow-y-auto"
              style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
            >
              {sugerencias.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--superficie-hover)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                  onMouseDown={(e) => { e.preventDefault(); agregarEmail(s.correo) }}
                >
                  <span className="font-medium" style={{ color: 'var(--texto-primario)' }}>{s.nombre}</span>
                  <span className="ml-2" style={{ color: 'var(--texto-terciario)' }}>{s.correo}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

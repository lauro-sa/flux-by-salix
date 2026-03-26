'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Idioma, Traducciones } from './tipos'
import { es } from './es'
import { en } from './en'
import { pt } from './pt'

/**
 * Sistema de internacionalización (i18n) de Flux by Salix.
 *
 * Arquitectura:
 * - Proveedor <ProveedorIdioma> envuelve la app
 * - Hook useTraduccion() da acceso a t() y al idioma actual
 * - t('contactos.titulo') devuelve el texto en el idioma activo
 * - El idioma se persiste en localStorage
 * - Soporta es (español), en (inglés), pt (portugués)
 *
 * Agregar un nuevo idioma:
 * 1. Crear archivo src/lib/i18n/{codigo}.ts con type Traducciones
 * 2. Importarlo aquí y agregarlo al mapa `traducciones`
 * 3. Agregar el código al tipo Idioma en tipos.ts
 */

// Mapa de idiomas disponibles
const traducciones: Record<Idioma, Traducciones> = { es, en, pt }

// Idioma por defecto
const IDIOMA_DEFAULT: Idioma = 'es'
const CLAVE_STORAGE = 'salix_idioma'

// Detecta idioma del cliente (solo llamar en useEffect)
function detectarIdiomaCliente(): Idioma {
  const guardado = localStorage.getItem(CLAVE_STORAGE) as Idioma | null
  if (guardado && traducciones[guardado]) return guardado

  const navegador = navigator.language.slice(0, 2) as Idioma
  if (traducciones[navegador]) return navegador

  return IDIOMA_DEFAULT
}

// Tipo para acceder a traducciones con dot notation
type ClavePlana = string

/**
 * Accede a un valor anidado en un objeto usando dot notation.
 * Ejemplo: obtenerValor(traducciones.es, 'contactos.titulo') → 'Contactos'
 */
function obtenerValor(obj: Record<string, unknown>, clave: ClavePlana): string {
  const partes = clave.split('.')
  let actual: unknown = obj

  for (const parte of partes) {
    if (actual === null || actual === undefined || typeof actual !== 'object') {
      return clave // Fallback: devuelve la clave si no se encuentra
    }
    actual = (actual as Record<string, unknown>)[parte]
  }

  return typeof actual === 'string' ? actual : clave
}

// Contexto
interface ContextoIdioma {
  idioma: Idioma
  cambiarIdioma: (nuevo: Idioma) => void
  t: (clave: string) => string
  idiomasDisponibles: { codigo: Idioma; nombre: string }[]
}

const ContextoIdiomaInterno = createContext<ContextoIdioma | null>(null)

// Lista de idiomas con sus nombres nativos
const IDIOMAS_DISPONIBLES: { codigo: Idioma; nombre: string }[] = [
  { codigo: 'es', nombre: 'Español' },
  { codigo: 'en', nombre: 'English' },
  { codigo: 'pt', nombre: 'Português' },
]

/**
 * ProveedorIdioma — Envuelve la app para dar acceso al sistema de traducciones.
 * Se monta en el layout principal.
 *
 * Uso:
 *   <ProveedorIdioma>
 *     <App />
 *   </ProveedorIdioma>
 */
function ProveedorIdioma({ children }: { children: ReactNode }) {
  // SSR siempre arranca con español para evitar hydration mismatch
  const [idioma, setIdioma] = useState<Idioma>(IDIOMA_DEFAULT)

  // Leer localStorage solo después del mount
  useEffect(() => {
    const detectado = detectarIdiomaCliente()
    setIdioma(detectado)
    document.documentElement.lang = detectado
  }, [])

  const cambiarIdioma = useCallback((nuevo: Idioma) => {
    setIdioma(nuevo)
    localStorage.setItem(CLAVE_STORAGE, nuevo)
    document.documentElement.lang = nuevo
  }, [])

  const t = useCallback(
    (clave: string): string => {
      return obtenerValor(traducciones[idioma] as unknown as Record<string, unknown>, clave)
    },
    [idioma]
  )

  return (
    <ContextoIdiomaInterno.Provider
      value={{ idioma, cambiarIdioma, t, idiomasDisponibles: IDIOMAS_DISPONIBLES }}
    >
      {children}
    </ContextoIdiomaInterno.Provider>
  )
}

/**
 * Hook para usar traducciones desde cualquier componente.
 *
 * Ejemplo:
 *   const { t, idioma, cambiarIdioma } = useTraduccion()
 *   <h1>{t('contactos.titulo')}</h1>
 *   <button onClick={() => cambiarIdioma('en')}>English</button>
 */
function useTraduccion() {
  const contexto = useContext(ContextoIdiomaInterno)
  if (!contexto) {
    throw new Error('useTraduccion debe usarse dentro de <ProveedorIdioma>')
  }
  return contexto
}

export { ProveedorIdioma, useTraduccion, IDIOMAS_DISPONIBLES }
export type { Idioma, Traducciones }

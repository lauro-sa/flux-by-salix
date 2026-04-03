'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRendimiento } from './useRendimiento'
import { usePreferencias } from './usePreferencias'

/**
 * Hook y proveedor para tema + efecto visual + escala de texto.
 * Sincroniza con usePreferencias (BD por dispositivo).
 * Tres dimensiones independientes:
 *   - Tema (colores base): claro | oscuro | sistema
 *   - Efecto (capa visual): solido | cristal
 *   - Fondo (gradiente para cristal): aurora | medianoche | ambar | ninguno
 *   - Escala (tamaño de texto): compacto | normal | comodo
 * Se usa en: layout principal, header, vitrina, configuración.
 */

type Tema = 'claro' | 'oscuro' | 'sistema'
type TemaActivo = 'claro' | 'oscuro'
type Efecto = 'solido' | 'cristal'
type FondoCristal = 'aurora' | 'medianoche' | 'ambar' | 'ninguno'
type EscalaTexto = 'compacto' | 'normal' | 'comodo'

interface ContextoTema {
  tema: Tema
  temaActivo: TemaActivo
  efecto: Efecto
  fondoCristal: FondoCristal
  escala: EscalaTexto
  soportaCristal: boolean
  razonNoCristal?: string
  cambiarTema: (nuevo: Tema) => void
  alternarTema: () => void
  cambiarEfecto: (nuevo: Efecto) => void
  cambiarFondo: (nuevo: FondoCristal) => void
  cambiarEscala: (nueva: EscalaTexto) => void
}

const ContextoTemaInterno = createContext<ContextoTema | null>(null)

function resolverTemaCliente(tema: Tema): TemaActivo {
  if (tema !== 'sistema') return tema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

function aplicarAtributos(temaActivo: TemaActivo, efecto: Efecto, fondo: FondoCristal, escala: EscalaTexto) {
  const html = document.documentElement
  html.setAttribute('data-tema', temaActivo)
  html.setAttribute('data-efecto', efecto)
  html.setAttribute('data-fondo', efecto === 'cristal' ? fondo : 'ninguno')
  if (escala === 'normal') {
    html.removeAttribute('data-escala')
  } else {
    html.setAttribute('data-escala', escala)
  }

  // Actualizar TODOS los meta theme-color para la barra del navegador/iOS PWA.
  // Necesitamos esperar un frame para que las CSS custom properties se actualicen.
  requestAnimationFrame(() => {
    const color = getComputedStyle(html).getPropertyValue('--superficie-app').trim()
    if (color) {
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      if (metas.length > 0) {
        metas.forEach(m => { m.content = color })
      } else {
        const meta = document.createElement('meta')
        meta.name = 'theme-color'
        meta.content = color
        document.head.appendChild(meta)
      }
    }
  })
}

function ProveedorTema({ children }: { children: ReactNode }) {
  const { soportaCristal, razon: razonNoCristal } = useRendimiento()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()

  const [tema, setTema] = useState<Tema>('sistema')
  const [temaActivo, setTemaActivo] = useState<TemaActivo>('claro')
  const [efecto, setEfecto] = useState<Efecto>('solido')
  const [fondoCristal, setFondoCristal] = useState<FondoCristal>('aurora')
  const [escala, setEscala] = useState<EscalaTexto>('normal')

  // Sincronizar desde preferencias (BD) cuando cambian
  useEffect(() => {
    const t = (preferencias.tema as Tema) || 'sistema'
    let e = (preferencias.efecto as Efecto) || 'solido'
    const f = (preferencias.fondo_cristal as FondoCristal) || 'aurora'
    const s = (preferencias.escala as EscalaTexto) || 'normal'

    if (e === 'cristal' && !soportaCristal) {
      e = 'solido'
    }

    setTema(t)
    setEfecto(e)
    setFondoCristal(f)
    setEscala(s)

    const activo = resolverTemaCliente(t)
    setTemaActivo(activo)
    aplicarAtributos(activo, e, f, s)
  }, [preferencias, soportaCristal])

  // Aplicar cuando cambia cualquier preferencia local
  useEffect(() => {
    const activo = resolverTemaCliente(tema)
    setTemaActivo(activo)
    aplicarAtributos(activo, efecto, fondoCristal, escala)
  }, [tema, efecto, fondoCristal, escala])

  // Escuchar cambios del sistema
  useEffect(() => {
    if (tema !== 'sistema') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      const activo = resolverTemaCliente('sistema')
      setTemaActivo(activo)
      aplicarAtributos(activo, efecto, fondoCristal, escala)
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [tema, efecto, fondoCristal, escala])

  const cambiarTema = useCallback((nuevo: Tema) => {
    setTema(nuevo)
    guardarPreferencia({ tema: nuevo })
  }, [guardarPreferencia])

  const alternarTema = useCallback(() => {
    const siguiente = temaActivo === 'claro' ? 'oscuro' : 'claro'
    cambiarTema(siguiente)
  }, [temaActivo, cambiarTema])

  const cambiarEfecto = useCallback((nuevo: Efecto) => {
    if (nuevo === 'cristal' && !soportaCristal) return
    setEfecto(nuevo)
    guardarPreferencia({ efecto: nuevo })
  }, [soportaCristal, guardarPreferencia])

  const cambiarFondo = useCallback((nuevo: FondoCristal) => {
    setFondoCristal(nuevo)
    guardarPreferencia({ fondo_cristal: nuevo })
  }, [guardarPreferencia])

  const cambiarEscala = useCallback((nueva: EscalaTexto) => {
    setEscala(nueva)
    guardarPreferencia({ escala: nueva })
  }, [guardarPreferencia])

  return (
    <ContextoTemaInterno.Provider value={{
      tema, temaActivo, efecto, fondoCristal, escala,
      soportaCristal, razonNoCristal,
      cambiarTema, alternarTema, cambiarEfecto, cambiarFondo, cambiarEscala,
    }}>
      {children}
    </ContextoTemaInterno.Provider>
  )
}

function useTema() {
  const ctx = useContext(ContextoTemaInterno)
  if (!ctx) throw new Error('useTema debe usarse dentro de <ProveedorTema>')
  return ctx
}

export { ProveedorTema, useTema, type Tema, type TemaActivo, type Efecto, type FondoCristal, type EscalaTexto }

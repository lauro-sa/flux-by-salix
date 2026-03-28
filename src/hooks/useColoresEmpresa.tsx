'use client'

import { useState, useEffect } from 'react'
import { useEmpresa } from './useEmpresa'
import { extraerColoresDeImagen } from '@/componentes/ui/SelectorColor'

/**
 * useColoresEmpresa — Devuelve los colores de marca de la empresa activa.
 *
 * Combina el color_marca configurado + colores extraídos del logo.
 * Se usa para pasar automáticamente al EditorTexto, selectores de color,
 * y cualquier componente que necesite los colores de la marca.
 *
 * Uso:
 *   const { colores, cargando } = useColoresEmpresa()
 *   <EditorTexto coloresMarca={colores} />
 */
function useColoresEmpresa() {
  const { empresa } = useEmpresa()
  const [coloresLogo, setColoresLogo] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)

  // Extraer colores del logo cuando cambia la empresa
  useEffect(() => {
    if (!empresa?.logo_url) {
      setColoresLogo([])
      return
    }

    let cancelado = false
    setCargando(true)

    extraerColoresDeImagen(empresa.logo_url, 4).then((colores) => {
      if (!cancelado) {
        setColoresLogo(colores)
        setCargando(false)
      }
    }).catch(() => {
      if (!cancelado) {
        setColoresLogo([])
        setCargando(false)
      }
    })

    return () => { cancelado = true }
  }, [empresa?.logo_url])

  // Combinar: color de marca + colores del logo (sin duplicados)
  const coloresMarca = empresa?.color_marca ? [empresa.color_marca] : []
  const todos = [...new Set([...coloresMarca, ...coloresLogo])]

  return {
    /** Todos los colores de marca (color_marca + extraídos del logo) */
    colores: todos,
    /** Colores extraídos del logo únicamente */
    coloresLogo,
    /** Color de marca principal configurado */
    colorPrincipal: empresa?.color_marca || null,
    /** Si está extrayendo colores del logo */
    cargando,
  }
}

export { useColoresEmpresa }

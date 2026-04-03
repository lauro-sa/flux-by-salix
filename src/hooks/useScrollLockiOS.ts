'use client'

import { useEffect, useRef } from 'react'

/**
 * useScrollLockiOS — Bloquea el scroll del body cuando un modal/sheet está abierto.
 *
 * En iOS Safari, `overflow: hidden` en el body NO impide el scroll detrás de modales.
 * La solución estándar es fijar el body con position:fixed, guardar la posición de scroll
 * y restaurarla al cerrar. Esto evita que el usuario scrollee el contenido debajo.
 *
 * Se usa en: Modal, BottomSheet, MenuMovil, y cualquier overlay fullscreen.
 */
export function useScrollLockiOS(activo: boolean) {
  const scrollYRef = useRef(0)

  useEffect(() => {
    if (!activo) return

    // Guardar posición actual de scroll
    scrollYRef.current = window.scrollY

    // Fijar el body en su lugar
    const body = document.body
    const estilosPrevios = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
      width: body.style.width,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollYRef.current}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'
    body.style.width = '100%'

    return () => {
      // Restaurar estilos originales
      body.style.position = estilosPrevios.position
      body.style.top = estilosPrevios.top
      body.style.left = estilosPrevios.left
      body.style.right = estilosPrevios.right
      body.style.overflow = estilosPrevios.overflow
      body.style.width = estilosPrevios.width

      // Restaurar posición de scroll
      window.scrollTo(0, scrollYRef.current)
    }
  }, [activo])
}

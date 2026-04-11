'use client'

import { APIProvider } from '@vis.gl/react-google-maps'
import { type ReactNode } from 'react'

interface PropiedadesProveedorMapa {
  children: ReactNode
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

/**
 * Wrapper que carga la API de Google Maps.
 * Si no hay API key, renderiza children directamente (cada componente maneja su propio fallback).
 */
export function ProveedorMapa({ children }: PropiedadesProveedorMapa) {
  if (!API_KEY) {
    return <>{children}</>
  }

  return (
    <APIProvider apiKey={API_KEY}>
      {children}
    </APIProvider>
  )
}

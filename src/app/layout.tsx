import type { Metadata, Viewport } from 'next'
import './globals.css'

// Toda la app depende de auth y contextos client-side,
// forzar renderizado dinámico para evitar errores de pre-render
export const dynamic = 'force-dynamic'
import { RegistroSW } from '@/componentes/pwa/RegistroSW'

export const metadata: Metadata = {
  title: 'Flux by Salix',
  description: 'Sistema de gestión multi-empresa para PyMEs',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Flux',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function LayoutRaiz({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/iconos/favicon.svg" />
        <link rel="icon" href="/iconos/favicon.ico" sizes="48x48" />
        <link rel="apple-touch-icon" sizes="180x180" href="/iconos/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <RegistroSW />
      </body>
    </html>
  )
}

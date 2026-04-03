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
  maximumScale: 1,
  userScalable: false,
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
        {/* Apple splash screens — PNG por resolución de iPhone */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1320x2868.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1206x2622.png" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1179x2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        {/* Theme-color dinámico: evita barra oscura en iOS PWA */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        {/* Anti-FOUC: detectar tema ANTES de que React monte para evitar flash.
            Lee flux_preferencias de localStorage → extrae .tema → aplica data-tema al html.
            También sincroniza el meta theme-color para que iOS no muestre barra de color incorrecto. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t='sistema';try{var p=JSON.parse(localStorage.getItem('flux_preferencias')||'{}');if(p.tema)t=p.tema}catch(e){}if(t==='oscuro'){d.setAttribute('data-tema','oscuro')}else if(t==='claro'){d.setAttribute('data-tema','claro')}else{if(window.matchMedia('(prefers-color-scheme:dark)').matches){d.setAttribute('data-tema','oscuro')}else{d.setAttribute('data-tema','claro')}}var es=d.getAttribute('data-tema')==='oscuro';var all=document.querySelectorAll('meta[name="theme-color"]');all.forEach(function(m){m.setAttribute('content',es?'#000000':'#ffffff')})}catch(e){}})()`
          }}
        />
      </head>
      <body>
        {children}
        <RegistroSW />
      </body>
    </html>
  )
}

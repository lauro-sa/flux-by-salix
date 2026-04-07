import type { Metadata, Viewport } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Kiosco — Flux by Salix',
  description: 'Terminal de fichaje para empleados',
  manifest: '/kiosco-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kiosco',
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
  themeColor: '#09090b',
}

export default function LayoutKiosco({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="kiosco-layout">
      {children}
    </div>
  )
}

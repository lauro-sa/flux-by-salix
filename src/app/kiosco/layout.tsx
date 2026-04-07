import type { Metadata, Viewport } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Kiosco — Flux by Salix',
  description: 'Terminal de fichaje para empleados',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kiosco Flux',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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

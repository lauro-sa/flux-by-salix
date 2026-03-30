/**
 * Layout del portal público — sin auth, sin sidebar.
 * Tema automático por prefers-color-scheme.
 * Se usa en: /portal/[token]
 */

import { ProveedorIdioma } from '@/lib/i18n'

export default function LayoutPortal({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProveedorIdioma>
      <div className="min-h-dvh bg-superficie-app text-texto-primario">
        {children}
      </div>
    </ProveedorIdioma>
  )
}

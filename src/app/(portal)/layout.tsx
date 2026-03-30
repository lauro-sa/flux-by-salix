/**
 * Layout del portal público — sin auth, sin sidebar.
 * Tema automático por prefers-color-scheme.
 * Se usa en: /portal/[token]
 */

export default function LayoutPortal({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-superficie-app text-texto-primario">
      {children}
    </div>
  )
}

'use client'

/**
 * PortalExpirado — Estado cuando el token es inválido o expiró.
 * Se usa en: /portal/[token] cuando no se encuentran datos.
 */

export default function PortalExpirado() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-superficie-app px-4">
      <div className="text-center max-w-sm">
        <div className="size-16 mx-auto mb-4 rounded-full bg-estado-error/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-estado-error">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-texto-primario mb-2">
          Enlace no disponible
        </h1>
        <p className="text-sm text-texto-secundario leading-relaxed">
          Este enlace ha expirado o no es válido. Si necesitás acceder al documento, contactá a la empresa que te lo envió para solicitar un nuevo enlace.
        </p>
      </div>
    </div>
  )
}

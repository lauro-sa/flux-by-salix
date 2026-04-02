import { WifiOff } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

/**
 * Página offline — Se muestra cuando no hay conexión y el SW no tiene cache.
 */
export default function PaginaOffline() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-superficie-app p-6">
      <div className="text-center max-w-sm">
        <div className="size-16 rounded-2xl bg-superficie-hover flex items-center justify-center mx-auto mb-4">
          <WifiOff size={32} className="text-texto-terciario" />
        </div>
        <h1 className="text-xl font-semibold text-texto-primario mb-2">Sin conexión</h1>
        <p className="text-base text-texto-secundario mb-6">
          No hay conexión a internet. Verificá tu red e intentá de nuevo.
        </p>
        <Boton variante="primario" onClick={() => window.location.reload()}>
          Reintentar
        </Boton>
      </div>
    </div>
  )
}

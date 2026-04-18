'use client'

import { useRouter } from 'next/navigation'
import { useModulos } from '@/hooks/useModulos'
import { Blocks, ArrowRight } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import type { ReactNode } from 'react'

/**
 * Guarda que verifica si un módulo está instalado antes de renderizar la página.
 * Si el módulo no está activo, muestra un mensaje y redirige a /aplicaciones.
 * Se usa en: páginas de módulos instalables (visitas, presupuestos, etc.)
 */

interface PropiedadesGuardaModulo {
  slug: string
  nombre: string
  children: ReactNode
}

function GuardaModulo({ slug, nombre, children }: PropiedadesGuardaModulo) {
  const { tieneModulo, cargando } = useModulos()
  const router = useRouter()

  if (cargando) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-texto-marca border-t-transparent" />
      </div>
    )
  }

  if (!tieneModulo(slug)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
          <div className="w-14 h-14 rounded-modal bg-superficie-elevada flex items-center justify-center text-texto-terciario">
            <Blocks size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-texto-primario">
              {nombre} no está instalado
            </h2>
            <p className="text-base text-texto-secundario mt-1">
              Este módulo no está activo en tu empresa. Instalalo desde la tienda de aplicaciones.
            </p>
          </div>
          <Boton
            variante="primario"
            iconoDerecho={<ArrowRight size={16} />}
            onClick={() => router.push('/aplicaciones')}
          >
            Ir a Aplicaciones
          </Boton>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export { GuardaModulo }

'use client'

import { ProveedorTema } from '@/hooks/useTema'
import { ProveedorNavegacion } from '@/hooks/useNavegacion'
import { ProveedorIdioma } from '@/lib/i18n'
import { ProveedorToast } from '@/componentes/feedback/Toast'
import { ProveedorAuth } from '@/hooks/useAuth'
import { ProveedorPreferencias } from '@/hooks/usePreferencias'
import { ProveedorEmpresa } from '@/hooks/useEmpresa'
import { PlantillaApp } from '@/componentes/entidad/PlantillaApp'

/**
 * Layout del grupo (flux) — envuelve todas las páginas autenticadas.
 * Provee: tema, idioma, auth, empresa, navegación, toasts, y el layout visual.
 */
export default function LayoutFlux({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorIdioma>
      <ProveedorAuth>
        <ProveedorPreferencias>
          <ProveedorTema>
            <ProveedorEmpresa>
            <ProveedorNavegacion>
              <ProveedorToast>
                <PlantillaApp>
                  {children}
                </PlantillaApp>
              </ProveedorToast>
            </ProveedorNavegacion>
            </ProveedorEmpresa>
          </ProveedorTema>
        </ProveedorPreferencias>
      </ProveedorAuth>
    </ProveedorIdioma>
  )
}

'use client'

import { ProveedorTema } from '@/hooks/useTema'
import { ProveedorNavegacion } from '@/hooks/useNavegacion'
import { ProveedorIdioma } from '@/lib/i18n'
import { ProveedorToast } from '@/componentes/feedback/Toast'
import { ProveedorEnvioPendiente } from '@/hooks/useEnvioPendiente'
import { ProveedorCambiosPendientes } from '@/hooks/useCambiosPendientes'
import { ProveedorQuery } from '@/hooks/useQueryClient'
import { ProveedorAuth } from '@/hooks/useAuth'
import { ProveedorPermisos } from '@/hooks/usePermisosActuales'
import { ProveedorPreferencias } from '@/hooks/usePreferencias'
import { ProveedorEmpresa } from '@/hooks/useEmpresa'
import { ProveedorModulos } from '@/hooks/useModulos'
import { PlantillaApp } from '@/componentes/entidad/PlantillaApp'

/**
 * Layout del grupo (flux) — envuelve todas las páginas autenticadas.
 * Provee: tema, idioma, auth, empresa, navegación, toasts, y el layout visual.
 */
export default function LayoutFlux({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorQuery>
    <ProveedorIdioma>
      <ProveedorAuth>
        <ProveedorPermisos>
        <ProveedorPreferencias>
          <ProveedorTema>
            <ProveedorEmpresa>
            <ProveedorModulos>
            <ProveedorNavegacion>
              <ProveedorToast>
              <ProveedorEnvioPendiente>
              <ProveedorCambiosPendientes>
                <PlantillaApp>
                  {children}
                </PlantillaApp>
              </ProveedorCambiosPendientes>
              </ProveedorEnvioPendiente>
              </ProveedorToast>
            </ProveedorNavegacion>
            </ProveedorModulos>
            </ProveedorEmpresa>
          </ProveedorTema>
        </ProveedorPreferencias>
        </ProveedorPermisos>
      </ProveedorAuth>
    </ProveedorIdioma>
    </ProveedorQuery>
  )
}

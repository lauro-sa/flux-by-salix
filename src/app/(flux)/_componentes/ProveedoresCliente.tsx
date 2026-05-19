'use client'

/**
 * ProveedoresCliente — Cliente único que agrupa todos los providers del
 * layout autenticado. Recibe los datos iniciales que el layout (Server
 * Component) precargó en paralelo desde Supabase y los inyecta a cada
 * provider correspondiente.
 *
 * Antes este árbol vivía en `layout.tsx` con `'use client'` y cada provider
 * disparaba su propio fetch al montar. Eso sumaba ~700 ms a la primera
 * carga porque los hooks se encadenaban (Auth → Empresa/Permisos/Modulos
 * en cascada). Con la precarga del server, los providers arrancan con
 * `cargando: false` y solo refrescan en eventos (cambio de sesión,
 * Realtime, recargas manuales).
 *
 * El layout sigue siendo Server Component y este wrapper es el único
 * `'use client'` que envuelve toda la app autenticada.
 */

import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { ProveedorTema } from '@/hooks/useTema'
import { ProveedorNavegacion } from '@/hooks/useNavegacion'
import { ProveedorIdioma } from '@/lib/i18n'
import { ProveedorToast } from '@/componentes/feedback/Toast'
import { ProveedorEnvioPendiente } from '@/hooks/useEnvioPendiente'
import { ProveedorCambiosPendientes } from '@/hooks/useCambiosPendientes'
import { ProveedorIndicadorGuardado } from '@/hooks/useIndicadorGuardado'
import { ProveedorQuery } from '@/hooks/useQueryClient'
import { ProveedorAuth } from '@/hooks/useAuth'
import { ProveedorPermisos, type PermisosInicialesServer } from '@/hooks/usePermisosActuales'
import { ProveedorPreferencias } from '@/hooks/usePreferencias'
import type { Preferencias } from '@/hooks/usePreferencias'
import { ProveedorEmpresa } from '@/hooks/useEmpresa'
import { ProveedorModulos } from '@/hooks/useModulos'
import { ProveedorNotificaciones } from '@/hooks/useNotificaciones'
import { PlantillaApp } from '@/componentes/entidad/PlantillaApp'
import type { Empresa, ModuloConEstado } from '@/tipos'

interface EmpresaConRol extends Empresa {
  rol: string
  activo: boolean
}

interface Props {
  children: ReactNode
  /** Usuario activo y su sesión, ya resueltos en server. Null si la
   *  precarga falló (raro) o si esta es la primera visita sin cookies. */
  usuarioInicial: User | null
  sesionInicial: Session | null
  /** Empresa activa según `empresa_activa_id` del JWT. */
  empresaInicial: Empresa | null
  /** Membresías del usuario con sus roles. */
  empresasIniciales: EmpresaConRol[]
  /** Permisos resueltos del miembro (mismo shape que /api/permisos/yo). */
  permisosIniciales: PermisosInicialesServer | null
  /** Módulos instalados de la empresa. */
  modulosIniciales: ModuloConEstado[]
  /** Preferencias del usuario (sin dispositivo). */
  preferenciasIniciales: Partial<Preferencias> | null
}

export function ProveedoresCliente({
  children,
  usuarioInicial,
  sesionInicial,
  empresaInicial,
  empresasIniciales,
  permisosIniciales,
  modulosIniciales,
  preferenciasIniciales,
}: Props) {
  return (
    <ProveedorQuery>
    <ProveedorIdioma>
      <ProveedorAuth usuarioInicial={usuarioInicial} sesionInicial={sesionInicial}>
        <ProveedorPermisos permisosIniciales={permisosIniciales}>
        <ProveedorPreferencias preferenciasIniciales={preferenciasIniciales ?? undefined}>
          <ProveedorTema>
            <ProveedorEmpresa empresaInicial={empresaInicial} empresasIniciales={empresasIniciales}>
            <ProveedorModulos modulosIniciales={modulosIniciales}>
            <ProveedorNavegacion>
              <ProveedorToast>
              <ProveedorEnvioPendiente>
              <ProveedorCambiosPendientes>
              <ProveedorIndicadorGuardado>
                <ProveedorNotificaciones>
                  <PlantillaApp>
                    {children}
                  </PlantillaApp>
                </ProveedorNotificaciones>
              </ProveedorIndicadorGuardado>
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

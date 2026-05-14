import { ProveedoresCliente } from './_componentes/ProveedoresCliente'
import { precargarDatosLayout } from '@/lib/precarga-layout'

/**
 * Layout del grupo (flux) — Server Component.
 *
 * Precarga en paralelo todo lo que necesitan los providers cliente:
 * usuario + sesión, empresa activa, lista de empresas, permisos del
 * miembro y catálogo de módulos. Le pasa el resultado a
 * <ProveedoresCliente>, que es el único `'use client'` del árbol y
 * agrupa todos los providers (tema, idioma, auth, empresa, permisos,
 * módulos, navegación, toast, etc.).
 *
 * Antes este archivo era 'use client' y cada provider hacía su propio
 * fetch al montar, en cascada (Auth bloqueaba al resto). Ahora la app
 * pinta con datos correctos en el primer render.
 */
export default async function LayoutFlux({ children }: { children: React.ReactNode }) {
  const datos = await precargarDatosLayout()
  return (
    <ProveedoresCliente
      usuarioInicial={datos.usuario}
      sesionInicial={datos.sesion}
      empresaInicial={datos.empresa}
      empresasIniciales={datos.empresas}
      permisosIniciales={datos.permisos}
      modulosIniciales={datos.modulos}
      preferenciasIniciales={null}
    >
      {children}
    </ProveedoresCliente>
  )
}

import { QueryClient } from '@tanstack/react-query'

/**
 * Crea un QueryClient efímero para prefetch en Server Components.
 * El staleTime debe coincidir con el del ProveedorQuery del cliente
 * para que HydrationBoundary respete la frescura de los datos.
 *
 * Se usa en: page.tsx de contactos, presupuestos, actividades, papelera.
 */
export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // Mismo staleTime que ProveedorQuery (30s)
      },
    },
  })
}

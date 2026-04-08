'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Proveedor de React Query para toda la app autenticada.
 * Configura defaults optimizados: staleTime de 30s para evitar re-fetches innecesarios,
 * retry conservador, y refetchOnWindowFocus para mantener datos frescos.
 */
export function ProveedorQuery({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Los datos se consideran frescos por 30 segundos — evita re-fetches al navegar
        staleTime: 30_000,
        // Cache en memoria por 5 minutos después de que el componente se desmonte
        gcTime: 5 * 60_000,
        // Refrescar al volver a la pestaña (mantiene datos actualizados)
        refetchOnWindowFocus: true,
        // No refrescar al reconectar — el staleTime ya lo maneja
        refetchOnReconnect: false,
        // Un solo retry con backoff
        retry: 1,
        retryDelay: 1000,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

import { useState, useEffect, useRef } from 'react'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

/**
 * useBusquedaDebounce — Hook reutilizable para búsqueda con debounce + reset de página.
 * Reemplaza el patrón repetido en todos los Contenido* (Productos, Contactos, Actividades, etc.).
 *
 * Devuelve: busqueda (inmediata), busquedaDebounced (con delay), pagina, y sus setters.
 * La página se resetea automáticamente cuando cambia la búsqueda debounced o cualquier dependencia extra.
 *
 * @param valorInicial - Valor inicial de búsqueda (default: '')
 * @param paginaInicial - Página inicial (default: 1)
 * @param dependenciasResetPagina - Dependencias extra que resetean la página (filtros)
 * @param saltarPrimerReset - Si true, no resetea la página en el primer render (útil cuando se restaura desde URL)
 */
export function useBusquedaDebounce(
  valorInicial = '',
  paginaInicial = 1,
  dependenciasResetPagina: unknown[] = [],
  saltarPrimerReset = false,
) {
  const [busqueda, setBusqueda] = useState(valorInicial)
  const [busquedaDebounced, setBusquedaDebounced] = useState(valorInicial)
  const [pagina, setPagina] = useState(paginaInicial)
  const primerRenderRef = useRef(saltarPrimerReset)

  // Debounce de búsqueda
  useEffect(() => {
    const timeout = setTimeout(() => setBusquedaDebounced(busqueda), DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Reset página cuando cambia la búsqueda debounced o filtros
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (primerRenderRef.current) { primerRenderRef.current = false; return }
    setPagina(1)
  }, [busquedaDebounced, ...dependenciasResetPagina])

  return {
    busqueda,
    setBusqueda,
    busquedaDebounced,
    pagina,
    setPagina,
  }
}

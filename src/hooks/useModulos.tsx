'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { ModuloConEstado } from '@/tipos'

/**
 * Hook y proveedor para los módulos instalados de la empresa.
 * Lee del catálogo + modulos_empresa y expone helpers para chequear acceso.
 * Se usa en: Sidebar (filtrar ítems), middleware (validar rutas), /aplicaciones (tienda).
 */

interface ContextoModulos {
  modulos: ModuloConEstado[]
  cargando: boolean
  tieneModulo: (slug: string) => boolean
  instalar: (slug: string) => Promise<{ error?: string }>
  desinstalar: (slug: string) => Promise<{ error?: string }>
  recargar: () => Promise<void>
}

const ContextoModulosInterno = createContext<ContextoModulos | null>(null)

function ProveedorModulos({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [modulos, setModulos] = useState<ModuloConEstado[]>([])
  const [cargando, setCargando] = useState(true)
  // Si la tabla no existe aún (migración pendiente), permitir todo
  const [sinCatalogo, setSinCatalogo] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario) {
      setModulos([])
      setCargando(false)
      return
    }

    try {
      const res = await fetch('/api/modulos')
      if (!res.ok) throw new Error('Error al cargar módulos')
      const data = await res.json()
      const lista = data.modulos || []
      setModulos(lista)
      // Si el catálogo está vacío, asumir que la migración no se ejecutó
      setSinCatalogo(lista.length === 0)
    } catch (err) {
      console.error('Error cargando módulos:', err)
      setSinCatalogo(true)
    } finally {
      setCargando(false)
    }
  }, [usuario])

  useEffect(() => {
    cargar()
  }, [cargar])

  const tieneModulo = useCallback((slug: string): boolean => {
    // Si el catálogo no existe (migración pendiente), permitir todo
    if (sinCatalogo) return true
    // Si todavía está cargando, permitir todo para no flashear contenido
    if (cargando) return true
    const modulo = modulos.find(m => m.slug === slug)
    if (!modulo) return true // Módulo no reconocido → no bloquear
    return modulo.es_base || (modulo.instalado && modulo.activo)
  }, [modulos, sinCatalogo, cargando])

  const instalar = useCallback(async (slug: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch('/api/modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, accion: 'instalar' }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { error: data.error || 'Error al instalar módulo' }
      }
      await cargar()
      return {}
    } catch {
      return { error: 'Error de red al instalar módulo' }
    }
  }, [cargar])

  const desinstalar = useCallback(async (slug: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch('/api/modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, accion: 'desinstalar' }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { error: data.error || 'Error al desinstalar módulo' }
      }
      await cargar()
      return {}
    } catch {
      return { error: 'Error de red al desinstalar módulo' }
    }
  }, [cargar])

  return (
    <ContextoModulosInterno.Provider value={{ modulos, cargando, tieneModulo, instalar, desinstalar, recargar: cargar }}>
      {children}
    </ContextoModulosInterno.Provider>
  )
}

function useModulos() {
  const ctx = useContext(ContextoModulosInterno)
  if (!ctx) throw new Error('useModulos debe usarse dentro de ProveedorModulos')
  return ctx
}

export { useModulos, ProveedorModulos }

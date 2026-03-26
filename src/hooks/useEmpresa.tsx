'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { Empresa } from '@/tipos'

/**
 * Hook y proveedor para la empresa activa y lista de empresas.
 * Lee empresa_id del JWT y carga los datos de la empresa.
 * Se usa en: sidebar, header, selector de empresa, contexto global.
 */

interface EmpresaConRol extends Empresa {
  rol: string
  activo: boolean
}

interface ContextoEmpresa {
  empresa: Empresa | null
  empresas: EmpresaConRol[]
  cargando: boolean
  cambiarEmpresa: (empresaId: string) => Promise<{ error?: string }>
}

const ContextoEmpresaInterno = createContext<ContextoEmpresa | null>(null)

function ProveedorEmpresa({ children }: { children: ReactNode }) {
  const { usuario, sesion } = useAuth()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaConRol[]>([])
  const [cargando, setCargando] = useState(true)

  const supabase = crearClienteNavegador()

  // Cargar empresa activa y lista de empresas
  useEffect(() => {
    if (!usuario) {
      setEmpresa(null)
      setEmpresas([])
      setCargando(false)
      return
    }

    const cargar = async () => {
      setCargando(true)

      // Cargar membresías
      const { data: membresias } = await supabase
        .from('miembros')
        .select('empresa_id, rol, activo')
        .eq('usuario_id', usuario.id)

      if (membresias && membresias.length > 0) {
        // Cargar datos de las empresas
        const empresaIds = membresias.map(m => m.empresa_id)
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('id, nombre, slug, logo_url, pais, color_marca, creado_en')
          .in('id', empresaIds)

        const empresasMapa = new Map(
          (empresasData || []).map(e => [e.id, e])
        )

        const listaEmpresas: EmpresaConRol[] = membresias
          .filter(m => empresasMapa.has(m.empresa_id))
          .map(m => ({
            ...(empresasMapa.get(m.empresa_id) as Empresa),
            rol: m.rol,
            activo: m.activo,
          }))

        setEmpresas(listaEmpresas)

        // Setear empresa activa desde JWT
        const empresaActivaId = sesion?.user?.app_metadata?.empresa_activa_id
        if (empresaActivaId) {
          const activa = listaEmpresas.find(e => e.id === empresaActivaId)
          setEmpresa(activa || null)
        }
      }

      setCargando(false)
    }

    cargar()
  }, [usuario, sesion, supabase])

  const cambiarEmpresa = useCallback(async (empresaId: string) => {
    const respuesta = await fetch('/api/empresas/cambiar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: empresaId }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      return { error: datos.error }
    }

    // Refrescar sesión para obtener nuevo JWT con la empresa actualizada
    await supabase.auth.refreshSession()

    // Actualizar estado local
    const nueva = empresas.find(e => e.id === empresaId)
    if (nueva) setEmpresa(nueva)

    return {}
  }, [empresas, supabase])

  return (
    <ContextoEmpresaInterno.Provider value={{
      empresa, empresas, cargando, cambiarEmpresa,
    }}>
      {children}
    </ContextoEmpresaInterno.Provider>
  )
}

function useEmpresa() {
  const ctx = useContext(ContextoEmpresaInterno)
  if (!ctx) throw new Error('useEmpresa debe usarse dentro de <ProveedorEmpresa>')
  return ctx
}

export { ProveedorEmpresa, useEmpresa }

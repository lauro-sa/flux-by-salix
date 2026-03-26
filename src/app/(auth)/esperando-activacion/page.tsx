'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, LogOut } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * Página de espera de activación.
 * Usa el layout limpio de (auth).
 */
export default function PaginaEsperandoActivacion() {
  const { cerrarSesion, usuario } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!usuario) return

    const intervalo = setInterval(async () => {
      const supabase = crearClienteNavegador()
      const { data: miembros } = await supabase
        .from('miembros')
        .select('activo, empresa_id')
        .eq('usuario_id', usuario.id)
        .eq('activo', true)
        .limit(1)

      if (miembros && miembros.length > 0) {
        await fetch('/api/empresas/cambiar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa_id: miembros[0].empresa_id }),
        })
        await supabase.auth.refreshSession()
        router.push('/dashboard')
      }
    }, 10000)

    return () => clearInterval(intervalo)
  }, [usuario, router])

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-auto w-16 h-16 rounded-full bg-insignia-advertencia/10 flex items-center justify-center mb-6"
      >
        <Clock size={28} className="text-insignia-advertencia" />
      </motion.div>

      <h2 className="text-lg font-semibold text-texto-primario mb-2">
        Cuenta pendiente de activación
      </h2>

      <p className="text-sm text-texto-terciario mb-6 leading-relaxed">
        Un administrador debe activar tu cuenta antes de que puedas acceder.
      </p>

      <div className="flex items-center justify-center gap-2 text-xs text-texto-terciario mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="w-3 h-3 border-2 border-insignia-advertencia/30 border-t-insignia-advertencia rounded-full"
        />
        <span>Verificando estado...</span>
      </div>

      <Boton variante="fantasma" anchoCompleto onClick={cerrarSesion} icono={<LogOut size={16} />}>
        Cerrar sesión
      </Boton>
    </div>
  )
}

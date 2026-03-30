'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, RefreshCw, CheckCircle } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * Página de verificación de correo.
 * Muestra mensaje de espera y escucha cuando el usuario verifica.
 * Auto-redirige cuando detecta que el email fue confirmado.
 */
export default function PaginaVerificarCorreo() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const router = useRouter()
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  // Escuchar cambios de auth para detectar verificación
  useEffect(() => {
    const supabase = crearClienteNavegador()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'USER_UPDATED' || evento === 'SIGNED_IN') {
        // El usuario verificó su email → redirigir
        router.push('/onboarding')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const reenviarVerificacion = async () => {
    if (!usuario?.email) return

    setReenviando(true)
    const supabase = crearClienteNavegador()

    await supabase.auth.resend({
      type: 'signup',
      email: usuario.email,
    })

    setReenviando(false)
    setReenviado(true)
    setTimeout(() => setReenviado(false), 5000)
  }

  return (
    <div className="text-center">
      {/* Ícono animado */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto w-16 h-16 rounded-full bg-texto-marca/10 flex items-center justify-center mb-6"
      >
        <Mail size={28} className="text-texto-marca" />
      </motion.div>

      <h2 className="text-lg font-semibold text-texto-primario mb-2">
        {t('auth.verificar_correo')}
      </h2>

      <p className="text-sm text-texto-terciario mb-2">
        {t('auth.verificar_correo_desc')}
      </p>

      {usuario?.email && (
        <p className="text-sm font-medium text-texto-secundario mb-6">
          {usuario.email}
        </p>
      )}

      {/* Indicador de éxito al reenviar */}
      {reenviado && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-insignia-exito/10 border border-insignia-exito/20 flex items-center justify-center gap-2 text-sm text-insignia-exito"
        >
          <CheckCircle size={16} />
          <span>{t('auth.email_reenviado')}</span>
        </motion.div>
      )}

      <Boton
        variante="secundario"
        anchoCompleto
        cargando={reenviando}
        onClick={reenviarVerificacion}
        icono={<RefreshCw size={16} />}
      >
        {t('auth.reenviar_verificacion')}
      </Boton>

      {/* Indicador de espera */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-texto-terciario">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-3 h-3 border border-texto-terciario border-t-transparent rounded-full"
        />
        <span>{t('auth.esperando_verificacion')}</span>
      </div>
    </div>
  )
}

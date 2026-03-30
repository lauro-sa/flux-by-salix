'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de recuperación de contraseña.
 * Formulario con email, envía link de recuperación.
 */
export default function PaginaRecuperar() {
  const { t } = useTraduccion()
  const { recuperarContrasena } = useAuth()

  const [correo, setCorreo] = useState('')
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    const resultado = await recuperarContrasena(correo)

    if (resultado.error) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    setEnviado(true)
    setCargando(false)
  }

  if (enviado) {
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mx-auto w-16 h-16 rounded-full bg-insignia-exito/10 flex items-center justify-center mb-6"
        >
          <CheckCircle size={28} className="text-insignia-exito" />
        </motion.div>

        <h2 className="text-lg font-semibold text-texto-primario mb-2">
          {t('auth.revisa_tu_correo')}
        </h2>
        <p className="text-sm text-texto-terciario mb-6">
          {t('auth.recuperar_desc')}
        </p>

        <Link href="/login">
          <Boton variante="secundario" anchoCompleto icono={<ArrowLeft size={16} />}>
            {t('auth.volver_login')}
          </Boton>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-texto-primario mb-1">
        {t('auth.recuperar_contrasena')}
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        {t('auth.enviar_enlace_desc')}
      </p>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        <Input
          tipo="email"
          etiqueta={t('auth.correo')}
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          icono={<Mail size={18} />}
          required
          autoComplete="email"
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Boton
          type="submit"
          variante="primario"
          anchoCompleto
          cargando={cargando}
          iconoDerecho={<ArrowRight size={16} />}
        >
          {t('auth.enviar_enlace')}
        </Boton>
      </form>

      <p className="text-center text-sm text-texto-terciario mt-6">
        <Link
          href="/login"
          className="text-texto-marca font-medium hover:underline transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          {t('auth.iniciar_sesion')}
        </Link>
      </p>
    </div>
  )
}

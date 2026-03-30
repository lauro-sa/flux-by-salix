'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'

/**
 * Página para restablecer contraseña.
 * El usuario llega acá después de hacer clic en el link de recuperación.
 * La sesión ya fue establecida por el callback de Supabase.
 */
export default function PaginaRestablecer() {
  const { t } = useTraduccion()
  const { restablecerContrasena } = useAuth()
  const router = useRouter()

  const [contrasena, setContrasena] = useState('')
  const [contrasenaConfirmar, setContrasenaConfirmar] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (contrasena.length < 8) {
      setError(t('auth.error_contrasena_minimo'))
      return
    }

    if (contrasena !== contrasenaConfirmar) {
      setError(t('auth.error_contrasena_no_coinciden'))
      return
    }

    setCargando(true)

    const resultado = await restablecerContrasena(contrasena)

    if (resultado.error) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    setExito(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (exito) {
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
          {t('auth.contrasena_actualizada')}
        </h2>
        <p className="text-sm text-texto-terciario">
          {t('auth.redirigiendo_login')}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-texto-primario mb-1">
        {t('auth.nueva_contrasena_titulo')}
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        {t('auth.nueva_contrasena_desc')}
      </p>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        <Input
          tipo="password"
          etiqueta={t('auth.contrasena_nueva')}
          placeholder={t('auth.placeholder_contrasena_minimo')}
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          icono={<Lock size={18} />}
          required
          autoComplete="new-password"
        />

        <Input
          tipo="password"
          etiqueta={t('auth.contrasena_confirmar')}
          placeholder={t('auth.placeholder_repetir_contrasena')}
          value={contrasenaConfirmar}
          onChange={(e) => setContrasenaConfirmar(e.target.value)}
          icono={<Lock size={18} />}
          required
          autoComplete="new-password"
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
          {t('auth.actualizar_contrasena')}
        </Boton>
      </form>
    </div>
  )
}

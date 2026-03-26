'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de inicio de sesión.
 * Formulario limpio con email + contraseña.
 * Animaciones sutiles en transiciones y estados.
 */
function ContenidoLogin() {
  const { t } = useTraduccion()
  const { iniciarSesion } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Error del callback (ej: verificación fallida)
  const errorCallback = searchParams.get('error')

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    const resultado = await iniciarSesion(correo, contrasena)

    if (resultado.error) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    if (resultado.redirigir) {
      router.push(resultado.redirigir)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-texto-primario mb-1">
        {t('auth.iniciar_sesion')}
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        {t('auth.bienvenido')}
      </p>

      {/* Error de callback */}
      <AnimatePresence>
        {errorCallback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>Hubo un error con la verificación. Intentá de nuevo.</span>
          </motion.div>
        )}
      </AnimatePresence>

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

        <Input
          tipo="password"
          etiqueta={t('auth.contrasena')}
          placeholder="••••••••"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          icono={<Lock size={18} />}
          required
          autoComplete="current-password"
        />

        {/* Link a recuperar contraseña */}
        <div className="flex justify-end -mt-2">
          <Link
            href="/recuperar"
            className="text-xs text-texto-marca hover:underline transition-colors"
          >
            {t('auth.olvidaste_contrasena')}
          </Link>
        </div>

        {/* Error del formulario */}
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
          {t('auth.iniciar_sesion')}
        </Boton>
      </form>

      {/* Link a registro */}
      <p className="text-center text-sm text-texto-terciario mt-6">
        {t('auth.no_tienes_cuenta')}{' '}
        <Link
          href="/registro"
          className="text-texto-marca font-medium hover:underline transition-colors"
        >
          {t('auth.registrarse')}
        </Link>
      </p>
    </div>
  )
}

export default function PaginaLogin() {
  return (
    <Suspense>
      <ContenidoLogin />
    </Suspense>
  )
}

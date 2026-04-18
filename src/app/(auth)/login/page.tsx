'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoAuth } from '@/componentes/ui/EncabezadoAuth'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de inicio de sesión.
 * Email + contraseña juntos para compatibilidad con autofill / Face ID.
 * Si el usuario no tiene cuenta, se le sugiere ir a /crear-cuenta.
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

  const errorCallback = searchParams.get('error')
  const siguiente = searchParams.get('next')

  const refInputCorreo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => refInputCorreo.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    try {
      const resultado = await iniciarSesion(correo, contrasena)

      if (resultado.error) {
        setError(resultado.error)
        setCargando(false)
        return
      }

      if (siguiente) {
        router.push(siguiente)
      } else if (resultado.redirigir) {
        router.push(resultado.redirigir)
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div>
      {/* Error de callback */}
      <AnimatePresence>
        {errorCallback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-card bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{t('auth.error_verificacion')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <EncabezadoAuth
        titulo={t('auth.iniciar_sesion')}
        descripcion={t('auth.ingresa_tu_correo_desc')}
      />

      <form onSubmit={manejarSubmit} className="flex flex-col gap-4">
        <Input
          ref={refInputCorreo}
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

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-card bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro"
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

      {/* Link a crear cuenta */}
      <p className="text-center text-sm text-texto-terciario mt-6">
        {t('auth.no_tenes_cuenta')}{' '}
        <Link href="/crear-cuenta" className="text-texto-marca hover:underline transition-colors">
          {t('auth.crear_cuenta')}
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

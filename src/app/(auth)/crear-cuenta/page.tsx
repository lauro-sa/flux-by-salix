'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoAuth } from '@/componentes/ui/EncabezadoAuth'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de registro / crear cuenta.
 * Email + nombre + apellido + contraseña.
 * Si el usuario ya tiene cuenta, se le sugiere ir a /login.
 */

function ContenidoCrearCuenta() {
  const { t } = useTraduccion()
  const { registrarse } = useAuth()
  const router = useRouter()

  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const refInputCorreo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => refInputCorreo.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (contrasena.length < 8) {
      setError(t('auth.error_contrasena_minimo'))
      return
    }

    setCargando(true)

    try {
      const resultado = await registrarse({ correo, contrasena, nombre, apellido })

      if (resultado.error) {
        setError(resultado.error)
        setCargando(false)
        return
      }

      if (resultado.redirigir) {
        router.push(resultado.redirigir)
      } else {
        router.push('/verificar-correo')
      }
    } catch {
      setError('Error al crear la cuenta. Intenta de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div>
      <EncabezadoAuth
        titulo={t('auth.crear_cuenta')}
        descripcion={t('auth.crear_cuenta_desc')}
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

        {/* Nombre y apellido en fila */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            tipo="text"
            etiqueta={t('auth.nombre')}
            placeholder={t('auth.placeholder_nombre')}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            icono={<User size={18} />}
            required
            autoComplete="given-name"
          />
          <Input
            tipo="text"
            etiqueta={t('auth.apellido')}
            placeholder={t('auth.placeholder_apellido')}
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>

        <Input
          tipo="password"
          etiqueta={t('auth.contrasena')}
          placeholder={t('auth.placeholder_contrasena_minimo')}
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          icono={<Lock size={18} />}
          required
          autoComplete="new-password"
        />

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
          {t('auth.crear_cuenta')}
        </Boton>
      </form>

      {/* Link a login */}
      <p className="text-center text-sm text-texto-terciario mt-6">
        {t('auth.ya_tenes_cuenta')}{' '}
        <Link href="/login" className="text-texto-marca hover:underline transition-colors">
          {t('auth.iniciar_sesion')}
        </Link>
      </p>
    </div>
  )
}

export default function PaginaCrearCuenta() {
  return (
    <Suspense>
      <ContenidoCrearCuenta />
    </Suspense>
  )
}

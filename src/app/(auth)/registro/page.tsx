'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de registro — crear cuenta nueva.
 * Nombre, apellido, email, contraseña con validaciones.
 * Después de registrarse redirige a verificar correo.
 */
export default function PaginaRegistro() {
  const { t } = useTraduccion()
  const { registrarse } = useAuth()
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [contrasenaConfirmar, setContrasenaConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (contrasena !== contrasenaConfirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)

    const resultado = await registrarse({ correo, contrasena, nombre, apellido })

    if (resultado.error) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    router.push('/verificar-correo')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-texto-primario mb-1">
        Crear cuenta
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        Empezá a usar Flux en minutos
      </p>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        {/* Nombre y apellido en fila */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            tipo="text"
            etiqueta="Nombre"
            placeholder="Juan"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            icono={<User size={18} />}
            required
            autoComplete="given-name"
          />
          <Input
            tipo="text"
            etiqueta="Apellido"
            placeholder="Pérez"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>

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
          placeholder="Mínimo 8 caracteres"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          icono={<Lock size={18} />}
          required
          autoComplete="new-password"
        />

        <Input
          tipo="password"
          etiqueta={t('auth.contrasena_confirmar')}
          placeholder="Repetí la contraseña"
          value={contrasenaConfirmar}
          onChange={(e) => setContrasenaConfirmar(e.target.value)}
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
          {t('auth.registrarse')}
        </Boton>
      </form>

      {/* Link a login */}
      <p className="text-center text-sm text-texto-terciario mt-6">
        {t('auth.ya_tienes_cuenta')}{' '}
        <Link
          href="/login"
          className="text-texto-marca font-medium hover:underline transition-colors"
        >
          {t('auth.iniciar_sesion')}
        </Link>
      </p>
    </div>
  )
}

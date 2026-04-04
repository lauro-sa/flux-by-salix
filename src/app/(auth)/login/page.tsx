'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoAuth } from '@/componentes/ui/EncabezadoAuth'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import Link from 'next/link'

/**
 * Página de inicio de sesión — flujo unificado.
 * Paso 1: email → detecta si existe o no.
 * Paso 2a (existe): contraseña.
 * Paso 2b (nuevo): nombre + apellido + contraseña → registro inline.
 * Transiciones animadas entre pasos con AnimatePresence.
 */

type PasoAuth = 'email' | 'contrasena' | 'registro'

// Dirección de la animación slide
const variantesSlide = {
  entrar: (direccion: number) => ({
    x: direccion > 0 ? 80 : -80,
    opacity: 0,
  }),
  centro: {
    x: 0,
    opacity: 1,
  },
  salir: (direccion: number) => ({
    x: direccion > 0 ? -80 : 80,
    opacity: 0,
  }),
}

function ContenidoLogin() {
  const { t } = useTraduccion()
  const { verificarCorreo, iniciarSesion, registrarse } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [paso, setPaso] = useState<PasoAuth>('email')
  const [direccion, setDireccion] = useState(1) // 1 = adelante, -1 = atrás
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Error del callback (ej: verificación fallida)
  const errorCallback = searchParams.get('error')
  const siguiente = searchParams.get('next')

  // Auto-focus en el input principal de cada paso
  const refInputCorreo = useRef<HTMLInputElement>(null)
  const refInputContrasena = useRef<HTMLInputElement>(null)
  const refInputNombre = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (paso === 'email') refInputCorreo.current?.focus()
      else if (paso === 'contrasena') refInputContrasena.current?.focus()
      else if (paso === 'registro') refInputNombre.current?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [paso])

  // Paso 1: verificar si el email existe
  const manejarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { existe } = await verificarCorreo(correo)

    setCargando(false)
    setDireccion(1)
    setPaso(existe ? 'contrasena' : 'registro')
  }

  // Paso 2a: login con contraseña
  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

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
  }

  // Paso 2b: registro inline
  const manejarRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (contrasena.length < 8) {
      setError(t('auth.error_contrasena_minimo'))
      return
    }

    setCargando(true)

    const resultado = await registrarse({ correo, contrasena, nombre, apellido })

    if (resultado.error) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    // Si se auto-vinculó por invitación, ir al dashboard
    if (resultado.redirigir) {
      router.push(resultado.redirigir)
    } else {
      router.push('/verificar-correo')
    }
  }

  // Volver al paso de email
  const volverAEmail = () => {
    setError('')
    setContrasena('')
    setDireccion(-1)
    setPaso('email')
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
            className="mb-4 p-3 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{t('auth.error_verificacion')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={direccion}>
        {/* ── Paso 1: Email ── */}
        {paso === 'email' && (
          <motion.div
            key="email"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo={t('auth.ingresa_tu_correo')}
              descripcion={t('auth.ingresa_tu_correo_desc')}
            />

            <form onSubmit={manejarEmail} className="flex flex-col gap-4">
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

              <Boton
                type="submit"
                variante="primario"
                anchoCompleto
                cargando={cargando}
                iconoDerecho={<ArrowRight size={16} />}
              >
                {t('auth.continuar')}
              </Boton>
            </form>
          </motion.div>
        )}

        {/* ── Paso 2a: Contraseña (usuario existente) ── */}
        {paso === 'contrasena' && (
          <motion.div
            key="contrasena"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo={t('auth.bienvenido_de_vuelta')}
            />

            {/* Chip de email — clickeable para volver */}
            <button
              type="button"
              onClick={volverAEmail}
              className="flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full bg-superficie-hover text-sm text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{correo}</span>
            </button>

            <form onSubmit={manejarLogin} className="flex flex-col gap-4">
              <Input
                ref={refInputContrasena}
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
          </motion.div>
        )}

        {/* ── Paso 2b: Registro inline (usuario nuevo) ── */}
        {paso === 'registro' && (
          <motion.div
            key="registro"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo={t('auth.completa_tus_datos')}
              descripcion={t('auth.solo_nombre_y_contrasena')}
            />

            {/* Chip de email — clickeable para volver */}
            <button
              type="button"
              onClick={volverAEmail}
              className="flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full bg-superficie-hover text-sm text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{correo}</span>
            </button>

            <form onSubmit={manejarRegistro} className="flex flex-col gap-4">
              {/* Nombre y apellido en fila */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  ref={refInputNombre}
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
                {t('auth.crear_cuenta')}
              </Boton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Globe, ArrowRight, ArrowLeft, AlertCircle, Users, LinkIcon } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoAuth } from '@/componentes/ui/EncabezadoAuth'
import { useAuth } from '@/hooks/useAuth'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { refrescarSesionSegura } from '@/lib/supabase/refrescar-sesion'

/**
 * Página de onboarding — después de verificar email.
 * Paso 1: Elegir camino (crear empresa o unirse a una existente).
 * Paso 2a: Crear empresa (nombre, slug, país).
 * Paso 2b: Unirse con código/link de invitación.
 */

type PasoOnboarding = 'elegir' | 'crear' | 'unirse'

const variantesSlide = {
  entrar: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  centro: { x: 0, opacity: 1 },
  salir: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

export default function PaginaOnboarding() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const router = useRouter()

  const [paso, setPaso] = useState<PasoOnboarding>('elegir')
  const [direccion, setDireccion] = useState(1)

  // Estado de "Crear empresa"
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditado, setSlugEditado] = useState(false)
  const [pais, setPais] = useState('')

  // Estado de "Unirse"
  const [codigoInvitacion, setCodigoInvitacion] = useState('')

  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Auto-generar slug desde el nombre
  useEffect(() => {
    if (slugEditado) return
    const slugGenerado = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(slugGenerado)
  }, [nombre, slugEditado])

  const manejarCambioSlug = (valor: string) => {
    setSlugEditado(true)
    setSlug(valor.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const irAPaso = (nuevoPaso: PasoOnboarding, dir: number = 1) => {
    setError('')
    setDireccion(dir)
    setPaso(nuevoPaso)
  }

  // Crear empresa
  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    if (!slug.trim() || slug.length < 3) {
      setError('El subdominio debe tener al menos 3 caracteres')
      return
    }

    setCargando(true)

    const respuesta = await fetch('/api/empresas/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), slug, pais: pais || null }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      setError(datos.error)
      setCargando(false)
      return
    }

    await refrescarSesionSegura()
    window.location.href = '/dashboard'
  }

  // Unirse con código/link
  const manejarUnirse = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!codigoInvitacion.trim()) {
      setError('Pegá el link o código de invitación')
      return
    }

    // Extraer token del link o usar directamente como token
    let token = codigoInvitacion.trim()
    try {
      const url = new URL(token)
      const tokenParam = url.searchParams.get('token')
      if (tokenParam) token = tokenParam
    } catch {
      // No es una URL, usar como token directo
    }

    setCargando(true)

    const respuesta = await fetch('/api/invitaciones/aceptar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      setError(datos.error)
      setCargando(false)
      return
    }

    await refrescarSesionSegura()
    window.location.href = '/dashboard'
  }

  return (
    <div>
      {/* Indicador de email del usuario */}
      {usuario?.email && (
        <div className="flex items-center justify-center gap-1.5 mb-5 px-3 py-1.5 rounded-full bg-superficie-hover text-xs text-texto-terciario mx-auto w-fit">
          <span>{usuario.email}</span>
        </div>
      )}

      <AnimatePresence mode="wait" custom={direccion}>
        {/* ── Paso 1: Elegir camino ── */}
        {paso === 'elegir' && (
          <motion.div
            key="elegir"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo="¿Qué querés hacer?"
              descripcion="Elegí cómo empezar a usar Flux"
            />

            <div className="flex flex-col gap-3">
              {/* Opción: Crear empresa */}
              <motion.button
                type="button"
                onClick={() => irAPaso('crear')}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 rounded-xl border border-borde-sutil bg-superficie-app hover:border-texto-marca/40 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0 group-hover:bg-texto-marca/15 transition-colors">
                    <Building2 size={20} className="text-texto-marca" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-texto-primario text-sm">{t('empresa.crear_empresa')}</p>
                    <p className="text-xs text-texto-terciario mt-0.5">Soy el primero de mi equipo</p>
                  </div>
                  <ArrowRight size={16} className="text-texto-terciario group-hover:text-texto-marca transition-colors" />
                </div>
              </motion.button>

              {/* Opción: Unirse a empresa */}
              <motion.button
                type="button"
                onClick={() => irAPaso('unirse')}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 rounded-xl border border-borde-sutil bg-superficie-app hover:border-texto-marca/40 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-insignia-info/10 flex items-center justify-center shrink-0 group-hover:bg-insignia-info/15 transition-colors">
                    <Users size={20} className="text-insignia-info" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-texto-primario text-sm">Unirme a una empresa</p>
                    <p className="text-xs text-texto-terciario mt-0.5">Tengo un link o código de invitación</p>
                  </div>
                  <ArrowRight size={16} className="text-texto-terciario group-hover:text-insignia-info transition-colors" />
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Paso 2a: Crear empresa ── */}
        {paso === 'crear' && (
          <motion.div
            key="crear"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo={t('empresa.crear_empresa')}
              descripcion={t('auth.crear_cuenta_desc')}
            />

            {/* Volver */}
            <button
              type="button"
              onClick={() => irAPaso('elegir', -1)}
              className="flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full bg-superficie-hover text-sm text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Volver</span>
            </button>

            <form onSubmit={manejarCrear} className="flex flex-col gap-4">
              <Input
                tipo="text"
                etiqueta={t('empresa.nombre')}
                placeholder="Mi Empresa S.A."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                icono={<Building2 size={18} />}
                required
              />

              <Input
                tipo="text"
                etiqueta={t('empresa.slug')}
                placeholder="mi-empresa"
                value={slug}
                onChange={(e) => manejarCambioSlug(e.target.value)}
                icono={<Globe size={18} />}
                ayuda={slug ? `${slug}.fluxsalix.com` : undefined}
                required
              />

              <Input
                tipo="text"
                etiqueta={t('empresa.pais')}
                placeholder="Argentina"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
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
                {t('empresa.crear_empresa')}
              </Boton>
            </form>
          </motion.div>
        )}

        {/* ── Paso 2b: Unirse a empresa ── */}
        {paso === 'unirse' && (
          <motion.div
            key="unirse"
            custom={direccion}
            variants={variantesSlide}
            initial="entrar"
            animate="centro"
            exit="salir"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <EncabezadoAuth
              titulo="Unirme a una empresa"
              descripcion="Pegá el link o código que te compartieron"
            />

            {/* Volver */}
            <button
              type="button"
              onClick={() => irAPaso('elegir', -1)}
              className="flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full bg-superficie-hover text-sm text-texto-secundario hover:text-texto-primario transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Volver</span>
            </button>

            <form onSubmit={manejarUnirse} className="flex flex-col gap-4">
              <Input
                tipo="text"
                etiqueta="Link o código de invitación"
                placeholder="https://tuempresa.fluxsalix.com/invitacion?token=..."
                value={codigoInvitacion}
                onChange={(e) => setCodigoInvitacion(e.target.value)}
                icono={<LinkIcon size={18} />}
                required
              />

              <p className="text-xs text-texto-terciario -mt-2">
                Pedile a un administrador de la empresa que te envíe una invitación.
              </p>

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
                Unirme
              </Boton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

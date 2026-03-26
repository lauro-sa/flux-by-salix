'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, ArrowRight, AlertCircle, Building2, Loader2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useAuth } from '@/hooks/useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import Link from 'next/link'

/**
 * Página de invitación — aceptar invitación para unirse a una empresa.
 * Valida el token, muestra la empresa y rol, permite aceptar.
 * Si el usuario no está logueado, muestra opciones de login/registro.
 */

interface DatosInvitacion {
  id: string
  empresa_id: string
  rol: string
  correo: string
  empresa_nombre?: string
}

function ContenidoInvitacion() {
  const { usuario, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [invitacion, setInvitacion] = useState<DatosInvitacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [aceptando, setAceptando] = useState(false)
  const [error, setError] = useState('')
  const [aceptada, setAceptada] = useState(false)

  // Validar token al cargar
  useEffect(() => {
    if (!token) {
      setError('No se proporcionó un token de invitación')
      setCargando(false)
      return
    }

    const validarToken = async () => {
      const supabase = crearClienteNavegador()

      const { data, error: err } = await supabase
        .from('invitaciones')
        .select('id, empresa_id, rol, correo, empresas(nombre)')
        .eq('token', token)
        .eq('usado', false)
        .single()

      if (err || !data) {
        setError('Invitación no válida o expirada')
        setCargando(false)
        return
      }

      setInvitacion({
        id: data.id,
        empresa_id: data.empresa_id,
        rol: data.rol,
        correo: data.correo,
        empresa_nombre: (data.empresas as unknown as { nombre: string } | null)?.nombre,
      })
      setCargando(false)
    }

    validarToken()
  }, [token])

  const aceptarInvitacion = async () => {
    if (!token) return

    setAceptando(true)
    setError('')

    const respuesta = await fetch('/api/invitaciones/aceptar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      setError(datos.error)
      setAceptando(false)
      return
    }

    setAceptada(true)
    setTimeout(() => router.push('/esperando-activacion'), 2000)
  }

  // Estado de carga
  if (cargando || cargandoAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-texto-marca mb-4" />
        <p className="text-sm text-texto-terciario">Validando invitación...</p>
      </div>
    )
  }

  // Error
  if (error && !invitacion) {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-insignia-peligro/10 flex items-center justify-center mb-6">
          <AlertCircle size={28} className="text-insignia-peligro" />
        </div>
        <h2 className="text-lg font-semibold text-texto-primario mb-2">
          Invitación no válida
        </h2>
        <p className="text-sm text-texto-terciario mb-6">{error}</p>
        <Link href="/login">
          <Boton variante="secundario" anchoCompleto>
            Ir al inicio de sesión
          </Boton>
        </Link>
      </div>
    )
  }

  // Invitación aceptada
  if (aceptada) {
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-16 h-16 rounded-full bg-insignia-exito/10 flex items-center justify-center mb-6"
        >
          <Users size={28} className="text-insignia-exito" />
        </motion.div>
        <h2 className="text-lg font-semibold text-texto-primario mb-2">
          Te uniste a {invitacion?.empresa_nombre}
        </h2>
        <p className="text-sm text-texto-terciario">
          Un administrador debe activar tu cuenta. Redirigiendo...
        </p>
      </div>
    )
  }

  // Mostrar invitación
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-auto w-16 h-16 rounded-full bg-texto-marca/10 flex items-center justify-center mb-6"
      >
        <Building2 size={28} className="text-texto-marca" />
      </motion.div>

      <h2 className="text-lg font-semibold text-texto-primario mb-2">
        Invitación a {invitacion?.empresa_nombre}
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        Te invitaron como <span className="font-medium text-texto-secundario capitalize">{invitacion?.rol}</span>
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/20 flex items-center gap-2 text-sm text-insignia-peligro">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {usuario ? (
        <Boton
          variante="primario"
          anchoCompleto
          cargando={aceptando}
          onClick={aceptarInvitacion}
          iconoDerecho={<ArrowRight size={16} />}
        >
          Unirse a {invitacion?.empresa_nombre}
        </Boton>
      ) : (
        <div className="flex flex-col gap-3">
          <Link href={`/login?next=/invitacion?token=${token}`}>
            <Boton variante="primario" anchoCompleto iconoDerecho={<ArrowRight size={16} />}>
              Iniciar sesión y unirse
            </Boton>
          </Link>
          <Link href={`/registro?next=/invitacion?token=${token}`}>
            <Boton variante="secundario" anchoCompleto>
              Crear cuenta y unirse
            </Boton>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function PaginaInvitacion() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-texto-marca mb-4" />
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    }>
      <ContenidoInvitacion />
    </Suspense>
  )
}

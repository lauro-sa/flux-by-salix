'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Globe, ArrowRight, AlertCircle } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * Página de onboarding — crear la primera empresa.
 * El usuario llega acá después de verificar su email.
 * El layout de (auth) se encarga del centrado y la card.
 */
export default function PaginaOnboarding() {
  const { t } = useTraduccion()
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditado, setSlugEditado] = useState(false)
  const [pais, setPais] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Auto-generar slug desde el nombre (si no fue editado manualmente)
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

  const manejarEnvio = async (e: React.FormEvent) => {
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

    // Refrescar sesión para que el JWT tenga empresa_id y rol
    const supabase = crearClienteNavegador()
    await supabase.auth.refreshSession()

    // Usar window.location para forzar recarga completa con nuevo JWT
    window.location.href = '/dashboard'
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-texto-primario mb-1">
        {t('empresa.crear_empresa')}
      </h2>
      <p className="text-sm text-texto-terciario mb-6">
        {t('auth.crear_cuenta_desc')}
      </p>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
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
    </div>
  )
}

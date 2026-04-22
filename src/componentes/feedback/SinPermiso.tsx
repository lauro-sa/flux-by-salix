'use client'

import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'

interface PropiedadesSinPermiso {
  titulo?: string
  descripcion?: string
  onVolver?: () => void
  volverTexto?: string
}

/**
 * SinPermiso — Pantalla estándar cuando el usuario no tiene permiso
 * para acceder a una sección. Reemplaza el contenido de la página.
 * Se usa en guards de páginas (ej: /configuracion) y secciones sensibles.
 */
function SinPermiso({
  titulo = 'No tenés permiso',
  descripcion = 'No tenés permiso para acceder a esta sección. Si creés que es un error, pedile al administrador de tu empresa que te habilite el acceso.',
  onVolver,
  volverTexto = 'Volver al inicio',
}: PropiedadesSinPermiso) {
  const router = useRouter()
  const manejarVolver = onVolver ?? (() => router.push('/'))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-full bg-superficie-hover/50 p-5 border border-borde-sutil"
      >
        <Lock size={36} className="text-texto-terciario" strokeWidth={1.5} />
      </motion.div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-semibold text-texto-primario">{titulo}</h2>
        <p className="text-sm text-texto-terciario leading-relaxed">{descripcion}</p>
      </div>
      <Boton variante="secundario" onClick={manejarVolver} className="mt-2">
        <ArrowLeft size={16} className="mr-1.5" />
        {volverTexto}
      </Boton>
    </motion.div>
  )
}

export { SinPermiso, type PropiedadesSinPermiso }

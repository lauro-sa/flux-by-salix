'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Building2, ArrowRight, Clock, LogOut } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { EncabezadoAuth } from '@/componentes/ui/EncabezadoAuth'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useTraduccion } from '@/lib/i18n'

/**
 * Selector de empresa — usa el layout limpio de (auth).
 */
export default function PaginaSelectorEmpresa() {
  const { t } = useTraduccion()
  const { cerrarSesion } = useAuth()
  const { empresas, cambiarEmpresa, cargando } = useEmpresa()
  const router = useRouter()
  const [seleccionando, setSeleccionando] = useState<string | null>(null)

  const manejarSeleccion = async (empresaId: string) => {
    setSeleccionando(empresaId)
    const resultado = await cambiarEmpresa(empresaId)
    if (!resultado.error) router.push('/dashboard')
    setSeleccionando(null)
  }

  return (
    <div>
      <EncabezadoAuth titulo={t('empresa.cambiar_empresa')} descripcion="Seleccioná la empresa con la que querés trabajar" />

      <div className="flex flex-col gap-2">
        {empresas.map((empresa, i) => (
          <motion.button
            key={empresa.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => empresa.activo && manejarSeleccion(empresa.id)}
            disabled={!empresa.activo || cargando}
            className={[
              'w-full p-3 rounded-xl border text-left transition-all duration-150',
              empresa.activo
                ? 'bg-superficie-app border-borde-sutil hover:border-texto-marca/40 cursor-pointer'
                : 'bg-superficie-app border-borde-sutil opacity-60 cursor-not-allowed',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-texto-marca" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-texto-primario text-sm truncate">{empresa.nombre}</p>
                <p className="text-xs text-texto-terciario capitalize">{empresa.rol}</p>
              </div>
              {empresa.activo ? (
                seleccionando === empresa.id ? (
                  <div className="w-4 h-4 border-2 border-texto-marca border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight size={16} className="text-texto-terciario" />
                )
              ) : (
                <div className="flex items-center gap-1 text-xs text-insignia-advertencia">
                  <Clock size={12} /><span>Pendiente</span>
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-5">
        <Boton variante="fantasma" anchoCompleto onClick={cerrarSesion} icono={<LogOut size={16} />}>
          Cerrar sesión
        </Boton>
      </div>
    </div>
  )
}

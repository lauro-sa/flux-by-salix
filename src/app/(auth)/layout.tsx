'use client'

import { ProveedorTema } from '@/hooks/useTema'
import { ProveedorIdioma } from '@/lib/i18n'
import { ProveedorToast } from '@/componentes/feedback/Toast'
import { ProveedorAuth } from '@/hooks/useAuth'
import { ProveedorEmpresa } from '@/hooks/useEmpresa'
import { ProveedorPreferencias } from '@/hooks/usePreferencias'
import { FondoParticulas } from '@/componentes/ui/FondoParticulas'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

/**
 * Layout de autenticación — login, registro, recuperar, etc.
 * Desktop: split layout (panel con partículas izq + formulario der)
 * Mobile: branding arriba + formulario abajo
 * Fondo de partículas interactivo estilo constelación (igual que la web de Salix).
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorIdioma>
      <ProveedorAuth>
        <ProveedorEmpresa>
        <ProveedorPreferencias>
          <ProveedorTema>
            <ProveedorToast>
            <div className="min-h-dvh flex flex-col lg:flex-row">

              {/* Panel izquierdo — partículas + branding (desktop) */}
              <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden">
                {/* Fondo de partículas interactivo */}
                <FondoParticulas />

                {/* Contenido del panel sobre las partículas */}
                <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full pointer-events-none">
                  {/* Logo */}
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-texto-marca flex items-center justify-center">
                      <Zap size={20} className="text-white" fill="white" />
                    </div>
                    <div>
                      <span className="text-lg font-bold text-texto-primario tracking-tight">Flux</span>
                      <span className="text-sm text-texto-terciario ml-1.5">by Salix</span>
                    </div>
                  </motion.div>

                  {/* Texto central */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                  >
                    <h1 className="text-3xl xl:text-4xl font-bold text-texto-primario leading-tight tracking-tight mb-4">
                      Gestión inteligente
                      <br />
                      <span className="text-texto-marca">para tu empresa</span>
                    </h1>
                    <p className="text-texto-secundario text-base leading-relaxed max-w-md">
                      Contactos, ventas, equipos y operaciones en una sola plataforma.
                      Simple, rápida y hecha para crecer.
                    </p>
                  </motion.div>

                  {/* Footer */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xs text-texto-terciario"
                  >
                    &copy; {new Date().getFullYear()} Salix
                  </motion.p>
                </div>
              </div>

              {/* Panel derecho — formulario */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 relative bg-superficie-app">
                {/* Partículas en mobile (detrás del formulario, sin interacción) */}
                <div className="absolute inset-0 lg:hidden">
                  <FondoParticulas />
                </div>

                {/* Logo mobile */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="lg:hidden flex items-center gap-2.5 mb-10 relative z-10"
                >
                  <div className="w-9 h-9 rounded-xl bg-texto-marca flex items-center justify-center">
                    <Zap size={18} className="text-white" fill="white" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-texto-primario tracking-tight">Flux</span>
                    <span className="text-sm text-texto-terciario ml-1.5">by Salix</span>
                  </div>
                </motion.div>

                {/* Card del formulario */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="relative z-10 w-full max-w-[400px]"
                >
                  <div className="bg-superficie-tarjeta/95 backdrop-blur-sm border border-borde-sutil rounded-2xl p-7 sm:p-8 shadow-lg shadow-black/[0.06]">
                    {children}
                  </div>
                </motion.div>

                {/* Footer mobile */}
                <p className="lg:hidden relative z-10 text-xs text-texto-terciario mt-8">
                  &copy; {new Date().getFullYear()} Salix
                </p>
              </div>
            </div>
            </ProveedorToast>
          </ProveedorTema>
        </ProveedorPreferencias>
        </ProveedorEmpresa>
      </ProveedorAuth>
    </ProveedorIdioma>
  )
}

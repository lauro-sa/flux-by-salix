'use client'

/**
 * ResumenDia — Vista de resumen al completar todas las paradas.
 * Muestra: estadísticas del día y botón para volver al dashboard.
 * Se usa en: PaginaRecorrido cuando el recorrido está completado.
 */

import { motion } from 'framer-motion'
import { CheckCircle2, Clock, MapPin, Route } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTraduccion } from '@/lib/i18n'

interface PropiedadesResumenDia {
  totalVisitas: number
  completadas: number
  duracionTotalMin: number | null
  distanciaTotalKm: number | null
}

function ResumenDia({ totalVisitas, completadas, duracionTotalMin, distanciaTotalKm }: PropiedadesResumenDia) {
  const router = useRouter()
  const { t } = useTraduccion()

  const canceladas = totalVisitas - completadas

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* Icono de éxito con animación */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
      >
        <CheckCircle2 size={72} strokeWidth={1.5} className="text-[var(--insignia-exito)]" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-bold text-texto-primario mt-5 mb-2"
      >
        {t('recorrido.estados.completado')}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-sm text-texto-terciario mb-8"
      >
        {t('recorrido.recorrido_del_dia')}
      </motion.p>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm grid grid-cols-2 gap-3 mb-8"
      >
        <div className="flex items-center gap-3 p-4 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
          <Route size={20} className="text-[var(--insignia-exito)] shrink-0" />
          <div>
            <p className="text-lg font-bold text-texto-primario">{completadas}</p>
            <p className="text-xs text-texto-terciario">{t('recorrido.completadas')}</p>
          </div>
        </div>

        {canceladas > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
            <Route size={20} className="text-[var(--insignia-peligro)] shrink-0" />
            <div>
              <p className="text-lg font-bold text-texto-primario">{canceladas}</p>
              <p className="text-xs text-texto-terciario">Canceladas</p>
            </div>
          </div>
        )}

        {duracionTotalMin != null && duracionTotalMin > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
            <Clock size={20} className="text-[var(--insignia-info)] shrink-0" />
            <div>
              <p className="text-lg font-bold text-texto-primario">
                {duracionTotalMin >= 60
                  ? `${Math.floor(duracionTotalMin / 60)}h ${duracionTotalMin % 60}m`
                  : `${duracionTotalMin}m`
                }
              </p>
              <p className="text-xs text-texto-terciario">{t('recorrido.tiempo_estimado')}</p>
            </div>
          </div>
        )}

        {distanciaTotalKm != null && distanciaTotalKm > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
            <MapPin size={20} className="text-texto-marca shrink-0" />
            <div>
              <p className="text-lg font-bold text-texto-primario">{distanciaTotalKm} km</p>
              <p className="text-xs text-texto-terciario">{t('recorrido.distancia_total')}</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Botón volver */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={() => router.push('/dashboard')}
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
        style={{ backgroundColor: 'var(--texto-marca)' }}
      >
        Volver al inicio
      </motion.button>
    </div>
  )
}

export { ResumenDia }

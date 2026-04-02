'use client'

/**
 * AnilloProgreso — Anillo SVG animado que muestra el porcentaje de permisos activos.
 * Se usa en: ResumenPermisos dentro de SeccionPermisos.
 */

import { motion } from 'framer-motion'

interface PropiedadesAnilloProgreso {
  porcentaje: number
}

export function AnilloProgreso({ porcentaje }: PropiedadesAnilloProgreso) {
  const radio = 36
  const circunferencia = 2 * Math.PI * radio
  const offset = circunferencia - (porcentaje / 100) * circunferencia
  const color = porcentaje > 80 ? 'var(--insignia-exito)' : porcentaje > 40 ? 'var(--insignia-advertencia)' : 'var(--insignia-peligro)'

  return (
    <svg width={88} height={88} viewBox="0 0 88 88" className="shrink-0">
      <circle cx={44} cy={44} r={radio} fill="none" stroke="var(--borde-sutil)" strokeWidth={6} />
      <motion.circle
        cx={44} cy={44} r={radio} fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round" strokeDasharray={circunferencia}
        initial={{ strokeDashoffset: circunferencia }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        transform="rotate(-90 44 44)"
      />
      <text x={44} y={44} textAnchor="middle" dominantBaseline="central"
        className="text-sm font-semibold" fill="var(--texto-primario)">
        {porcentaje}%
      </text>
    </svg>
  )
}

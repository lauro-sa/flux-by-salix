'use client'

/**
 * ResumenPermisos — Zona de resumen con anillo de progreso, insignias y presets globales.
 * Se usa en: SeccionPermisos (zona 2).
 */

import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { AnilloProgreso } from './AnilloProgreso'
import type { Rol } from '@/tipos'
import type { EstadisticasPermisos } from './tipos'

interface PropiedadesResumenPermisos {
  estadisticas: EstadisticasPermisos
  rol: Rol
  onPreset: (tipo: 'todo' | 'lectura' | 'nada') => void
}

export function ResumenPermisos({ estadisticas, rol, onPreset }: PropiedadesResumenPermisos) {
  return (
    <div className="flex items-center gap-5 p-4 rounded-lg bg-superficie-tarjeta border border-borde-sutil">
      <AnilloProgreso porcentaje={estadisticas.porcentaje} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Insignia color="exito">{estadisticas.completos} completos</Insignia>
          <Insignia color="advertencia">{estadisticas.parciales} parciales</Insignia>
          <Insignia color="neutro">{estadisticas.sinAcceso} sin acceso</Insignia>
        </div>
        <p className="text-xs text-texto-terciario">
          Rol base: <span className="font-medium text-texto-secundario capitalize">{rol}</span>
        </p>
        {/* Presets globales */}
        <div className="flex gap-1.5 mt-1">
          <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('todo')}>Acceso total</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('lectura')}>Solo lectura</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('nada')}>Sin acceso</Boton>
        </div>
      </div>
    </div>
  )
}

'use client'

/**
 * EncabezadoPermisos — Barra superior con titulo, insignia de estado y botones de accion.
 * Se usa en: SeccionPermisos (zona 1).
 */

import { Shield, ShieldOff, RotateCcw } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import type { Rol } from '@/tipos'

interface PropiedadesEncabezadoPermisos {
  rol: Rol
  usaCustom: boolean
  guardando: boolean
  onRestablecer: () => void
  onRevocar: () => void
  onGuardar: () => void
}

export function EncabezadoPermisos({
  rol,
  usaCustom,
  guardando,
  onRestablecer,
  onRevocar,
  onGuardar,
}: PropiedadesEncabezadoPermisos) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-texto-marca shrink-0" />
        <h3 className="text-base font-semibold text-texto-primario">Permisos</h3>
        <Insignia color={usaCustom ? 'info' : 'neutro'}>
          {usaCustom ? 'Personalizado' : `Defaults de ${rol}`}
        </Insignia>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {usaCustom && (
          <Boton variante="fantasma" tamano="sm" icono={<RotateCcw size={14} />} onClick={onRestablecer} cargando={guardando}>
            Restablecer
          </Boton>
        )}
        <Boton variante="peligro" tamano="sm" icono={<ShieldOff size={14} />} onClick={onRevocar}>
          Revocar todo
        </Boton>
        <Boton variante="primario" tamano="sm" onClick={onGuardar} cargando={guardando}>
          Guardar
        </Boton>
      </div>
    </div>
  )
}

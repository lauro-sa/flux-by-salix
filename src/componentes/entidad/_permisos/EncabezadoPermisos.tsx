'use client'

/**
 * EncabezadoPermisos — Barra superior con título y acciones globales.
 * El estado custom/default se comunica en ResumenPermisos (que es más visible).
 * Se usa en: SeccionPermisos (zona 1).
 */

import { Shield, ShieldOff } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

interface PropiedadesEncabezadoPermisos {
  guardando: boolean
  onRevocar: () => void
  onGuardar: () => void
}

export function EncabezadoPermisos({
  guardando,
  onRevocar,
  onGuardar,
}: PropiedadesEncabezadoPermisos) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-texto-marca shrink-0" />
        <h3 className="text-base font-semibold text-texto-primario">Permisos</h3>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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

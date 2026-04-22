'use client'

/**
 * ResumenPermisos — Panel principal de estado de permisos.
 * Le explica al admin qué rol tiene el usuario, si sus permisos son los
 * estándar del rol o están personalizados, y qué cambió respecto al default.
 * Se usa en: SeccionPermisos (zona 2).
 */

import { useState } from 'react'
import { ShieldCheck, Sparkles, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { AnilloProgreso } from './AnilloProgreso'
import type { Rol } from '@/tipos'
import type { CambioDescrito } from '@/hooks/useCambiosPendientes'
import type { EstadisticasPermisos } from './tipos'

interface PropiedadesResumenPermisos {
  estadisticas: EstadisticasPermisos
  rol: Rol
  usaCustom: boolean
  diffVsRol: CambioDescrito[]
  guardando: boolean
  onPreset: (tipo: 'todo' | 'lectura' | 'nada') => void
  onRestablecer: () => void
}

const ETIQUETAS_ROL: Record<Rol, string> = {
  propietario: 'Propietario',
  administrador: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  empleado: 'Empleado',
  invitado: 'Invitado',
}

export function ResumenPermisos({
  estadisticas,
  rol,
  usaCustom,
  diffVsRol,
  guardando,
  onPreset,
  onRestablecer,
}: PropiedadesResumenPermisos) {
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const etiquetaRol = ETIQUETAS_ROL[rol]
  const hayCambios = diffVsRol.length > 0

  return (
    <div className="rounded-card bg-superficie-tarjeta border border-borde-sutil overflow-hidden">
      {/* Banner principal: rol + estado */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4">
        <AnilloProgreso porcentaje={estadisticas.porcentaje} />

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Rol + estado */}
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck size={16} className="text-texto-marca" />
            <span className="text-sm text-texto-terciario">Rol:</span>
            <span className="text-sm font-semibold text-texto-primario">{etiquetaRol}</span>
            {usaCustom ? (
              <Insignia color="info">
                <Sparkles size={11} className="mr-1 inline" />
                Personalizado
              </Insignia>
            ) : (
              <Insignia color="neutro">Sin personalizar</Insignia>
            )}
          </div>

          {/* Mensaje explicativo */}
          <p className="text-xs text-texto-terciario leading-relaxed max-w-xl">
            {usaCustom ? (
              hayCambios ? (
                <>
                  Este usuario tiene <span className="font-semibold text-texto-secundario">{diffVsRol.length} {diffVsRol.length === 1 ? 'permiso modificado' : 'permisos modificados'}</span>
                  {' '}respecto a los defaults del rol <span className="font-semibold text-texto-secundario">{etiquetaRol}</span>.
                </>
              ) : (
                <>
                  Tiene permisos personalizados que hoy coinciden con los defaults de <span className="font-semibold text-texto-secundario">{etiquetaRol}</span>.
                  Al restablecer dejan de ser custom.
                </>
              )
            ) : (
              <>
                Usa los permisos estándar del rol <span className="font-semibold text-texto-secundario">{etiquetaRol}</span>.
                Si modificás algo, se guardará solo para este usuario (no afecta a otros {etiquetaRol.toLowerCase()}s).
              </>
            )}
          </p>

          {/* Insignias de estadísticas */}
          <div className="flex flex-wrap gap-1.5">
            <Insignia color="exito" tamano="sm">{estadisticas.completos} completos</Insignia>
            <Insignia color="advertencia" tamano="sm">{estadisticas.parciales} parciales</Insignia>
            <Insignia color="neutro" tamano="sm">{estadisticas.sinAcceso} sin acceso</Insignia>
          </div>
        </div>

        {/* Restablecer solo si está personalizado */}
        {usaCustom && (
          <div className="shrink-0">
            <Boton
              variante="secundario"
              tamano="sm"
              icono={<RotateCcw size={14} />}
              onClick={onRestablecer}
              cargando={guardando}
            >
              Restablecer a {etiquetaRol}
            </Boton>
          </div>
        )}
      </div>

      {/* Detalle de cambios vs defaults del rol (solo si hay diferencias) */}
      {usaCustom && hayCambios && (
        <div className="border-t border-borde-sutil">
          <button
            type="button"
            onClick={() => setDetalleAbierto(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-texto-secundario hover:bg-superficie-hover/40 transition-colors"
          >
            <span>
              Ver {diffVsRol.length === 1 ? 'el cambio' : `los ${diffVsRol.length} cambios`} respecto a {etiquetaRol}
            </span>
            {detalleAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {detalleAbierto && (
            <div className="px-4 pb-3 space-y-1 max-h-60 overflow-y-auto">
              {diffVsRol.map((cambio, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <span className={`inline-block w-14 shrink-0 text-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                    cambio.valor === 'agregado'
                      ? 'bg-insignia-exito/15 text-insignia-exito'
                      : 'bg-insignia-peligro/15 text-insignia-peligro'
                  }`}>
                    {cambio.valor === 'agregado' ? '+ extra' : '− quitado'}
                  </span>
                  <span className="text-texto-secundario">{cambio.campo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Presets globales */}
      <div className="border-t border-borde-sutil px-4 py-2 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-texto-terciario uppercase tracking-wider mr-1">Aplicar a todo:</span>
        <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('todo')}>Acceso total</Boton>
        <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('lectura')}>Solo lectura</Boton>
        <Boton variante="fantasma" tamano="xs" onClick={() => onPreset('nada')}>Sin acceso</Boton>
      </div>
    </div>
  )
}

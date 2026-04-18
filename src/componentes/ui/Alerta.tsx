'use client'

import type { ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type TipoAlerta = 'exito' | 'peligro' | 'advertencia' | 'info'

interface PropiedadesAlerta {
  tipo?: TipoAlerta
  titulo?: string
  children: ReactNode
  cerrable?: boolean
  onCerrar?: () => void
  className?: string
}

const clasesAlerta: Record<TipoAlerta, string> = {
  exito: 'bg-insignia-exito-fondo text-insignia-exito-texto border-l-insignia-exito',
  peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto border-l-insignia-peligro',
  advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto border-l-insignia-advertencia',
  info: 'bg-insignia-info-fondo text-insignia-info-texto border-l-insignia-info',
}

const iconosAlerta: Record<TipoAlerta, ReactNode> = {
  exito: <CheckCircle size={18} />,
  peligro: <XCircle size={18} />,
  advertencia: <AlertTriangle size={18} />,
  info: <Info size={18} />,
}

/**
 * Alerta — Mensaje contextual inline con borde lateral.
 * Se usa en: formularios, confirmaciones, avisos de sistema.
 */
function Alerta({ tipo = 'info', titulo, children, cerrable, onCerrar, className = '' }: PropiedadesAlerta) {
  return (
    <div className={`flex gap-3 p-4 rounded-card border-l-4 text-sm ${clasesAlerta[tipo]} ${className}`}>
      <span className="shrink-0 mt-0.5">{iconosAlerta[tipo]}</span>
      <div className="flex-1 min-w-0">
        {titulo && <p className="font-semibold mb-1">{titulo}</p>}
        <div>{children}</div>
      </div>
      {cerrable && (
        <button onClick={onCerrar} className="shrink-0 bg-transparent border-none text-current cursor-pointer opacity-60 hover:opacity-100 p-0">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export { Alerta, type PropiedadesAlerta }

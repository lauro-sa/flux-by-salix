import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Boton } from './Boton'

interface PropiedadesEncabezadoLista {
  titulo: string
  descripcion?: string
  onAccion?: () => void
  iconoAccion?: ReactNode
  etiquetaAccion?: string
}

function EncabezadoLista({ titulo, descripcion, onAccion, iconoAccion, etiquetaAccion }: PropiedadesEncabezadoLista) {
  return (
    <div className="flex items-start justify-between p-5 pb-3">
      <div>
        <h3 className="text-base font-semibold text-texto-primario">{titulo}</h3>
        {descripcion && <p className="text-sm text-texto-terciario mt-0.5">{descripcion}</p>}
      </div>
      {onAccion && (
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          titulo={etiquetaAccion || 'Agregar'}
          icono={iconoAccion || <Plus size={16} />}
          onClick={onAccion}
        />
      )}
    </div>
  )
}

export { EncabezadoLista, type PropiedadesEncabezadoLista }

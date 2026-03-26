'use client'

import { Route } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

export default function PaginaRecorrido() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><Route size={20} /></span>
          Recorrido
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-superficie-tarjeta border border-borde-sutil rounded-lg">
        <EstadoVacio
          icono={<Route size={52} strokeWidth={1} />}
          titulo="Ruta sin trazar"
          descripcion="Acá vas a poder planificar y visualizar el recorrido diario de tu equipo comercial."
        />
      </div>
    </div>
  )
}

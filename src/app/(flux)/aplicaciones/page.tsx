'use client'

import { LayoutGrid, Puzzle } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

export default function PaginaAplicaciones() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><LayoutGrid size={20} /></span>
          Aplicaciones
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-superficie-tarjeta border border-borde-sutil rounded-lg">
        <EstadoVacio
          icono={<Puzzle size={52} strokeWidth={1} />}
          titulo="Próximamente"
          descripcion="Acá vas a poder conectar integraciones, activar módulos y personalizar Flux a tu medida."
        />
      </div>
    </div>
  )
}

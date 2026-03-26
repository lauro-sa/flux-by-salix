'use client'

import { Trash2 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

export default function PaginaPapelera() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><Trash2 size={20} /></span>
          Papelera
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-superficie-tarjeta border border-borde-sutil rounded-lg">
        <EstadoVacio
          icono={<Trash2 size={52} strokeWidth={1} />}
          titulo="Limpio como patente nueva"
          descripcion="Los elementos eliminados aparecen acá por 30 días antes de borrarse definitivamente."
        />
      </div>
    </div>
  )
}

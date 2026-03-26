'use client'

import { BookOpen } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

export default function PaginaDocumentacion() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><BookOpen size={20} /></span>
          Documentación
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-superficie-tarjeta border border-borde-sutil rounded-lg">
        <EstadoVacio
          icono={<BookOpen size={52} strokeWidth={1} />}
          titulo="En construcción"
          descripcion="Estamos preparando guías, tutoriales y documentación para que le saques el máximo provecho a Flux."
        />
      </div>
    </div>
  )
}

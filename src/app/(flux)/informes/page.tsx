'use client'

import { FileBarChart, BarChart3 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

export default function PaginaInformes() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario"><FileBarChart size={20} /></span>
          Informes
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-superficie-tarjeta border border-borde-sutil rounded-card">
        <EstadoVacio
          icono={<BarChart3 size={52} strokeWidth={1} />}
          titulo="Los números están por llegar"
          descripcion="Cuando tengas datos en Flux, acá vas a encontrar reportes, métricas y gráficos para tomar mejores decisiones."
        />
      </div>
    </div>
  )
}

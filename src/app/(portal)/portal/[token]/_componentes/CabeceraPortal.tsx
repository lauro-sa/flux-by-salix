'use client'

/**
 * CabeceraPortal — Header del portal público.
 * Logo empresa 64px + info + color de marca como acento.
 * Se usa en: VistaPortal
 */

import Image from 'next/image'
import { LogoSalix } from '@/componentes/marca'

interface Props {
  empresa: {
    nombre: string
    logo_url: string | null
    color_marca: string | null
    descripcion: string | null
    telefono: string | null
    correo: string | null
    ubicacion: string | null
  }
}

export default function CabeceraPortal({ empresa }: Props) {
  const colorMarca = empresa.color_marca || '#6366f1'

  return (
    <header
      className="border-b border-borde-sutil bg-superficie-tarjeta"
      style={{ borderBottomColor: `${colorMarca}20` }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-start justify-between gap-4">
        {/* Izquierda: logo + info empresa */}
        <div className="flex items-start gap-4 min-w-0">
          {empresa.logo_url && (
            <Image
              src={empresa.logo_url}
              alt={empresa.nombre}
              width={64}
              height={64}
              className="size-16 rounded-xl object-contain shrink-0"
              unoptimized
            />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-texto-primario truncate">
              {empresa.nombre}
            </h1>
            {empresa.descripcion && (
              <p className="text-xs text-texto-terciario mt-0.5 line-clamp-2">
                {empresa.descripcion}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
              {empresa.ubicacion && (
                <span className="text-xs text-texto-secundario">
                  {empresa.ubicacion}
                </span>
              )}
              {empresa.telefono && (
                <a href={`tel:${empresa.telefono}`} className="text-xs text-texto-secundario hover:text-texto-primario transition-colors">
                  {empresa.telefono}
                </a>
              )}
              {empresa.correo && (
                <a href={`mailto:${empresa.correo}`} className="text-xs text-texto-secundario hover:text-texto-primario transition-colors">
                  {empresa.correo}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Derecha: logo Flux by Salix */}
        <div className="shrink-0 opacity-50">
          <LogoSalix layout="horizontal" tamano={20} hover={false} tap={false} />
        </div>
      </div>
    </header>
  )
}

'use client'

/**
 * CabeceraPortal — Header del portal público.
 * 3 columnas: logo empresa + info empresa | logo Flux by Salix
 * Se usa en: VistaPortal
 */

import Image from 'next/image'

interface Props {
  empresa: {
    nombre: string
    logo_url: string | null
    descripcion: string | null
    telefono: string | null
    correo: string | null
  }
}

export default function CabeceraPortal({ empresa }: Props) {
  return (
    <header className="border-b border-borde-sutil bg-superficie-tarjeta">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
        {/* Izquierda: logo + info empresa */}
        <div className="flex items-start gap-3 min-w-0">
          {empresa.logo_url && (
            <Image
              src={empresa.logo_url}
              alt={empresa.nombre}
              width={48}
              height={48}
              className="size-12 rounded-lg object-contain shrink-0"
              unoptimized
            />
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-texto-primario truncate">
              {empresa.nombre}
            </h1>
            {empresa.descripcion && (
              <p className="text-xs text-texto-terciario mt-0.5 line-clamp-2">
                {empresa.descripcion}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
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
        <div className="shrink-0 flex flex-col items-end gap-1 opacity-40">
          <Image
            src="/iconos/favicon.svg"
            alt="Flux by Salix"
            width={24}
            height={24}
            className="size-6"
            unoptimized
          />
          <span className="text-[9px] text-texto-terciario whitespace-nowrap">
            Flux by Salix
          </span>
        </div>
      </div>
    </header>
  )
}

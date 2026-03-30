'use client'

/**
 * PiePortal — Footer del portal: logo empresa, datos, branding Flux.
 * Se usa en: VistaPortal
 */

import Image from 'next/image'

interface Props {
  empresa: {
    nombre: string
    logo_url: string | null
    telefono: string | null
    correo: string | null
    pagina_web: string | null
    ubicacion: string | null
  }
}

export default function PiePortal({ empresa }: Props) {
  return (
    <footer className="border-t border-borde-sutil mt-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Logo + nombre empresa */}
        <div className="flex flex-col items-center gap-2">
          {empresa.logo_url && (
            <Image
              src={empresa.logo_url}
              alt={empresa.nombre}
              width={40}
              height={40}
              className="size-10 rounded-lg object-contain"
              unoptimized
            />
          )}
          <span className="text-sm font-medium text-texto-primario">{empresa.nombre}</span>
        </div>

        {/* Datos de contacto */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-texto-terciario">
          {empresa.ubicacion && <span>{empresa.ubicacion}</span>}
          {empresa.telefono && (
            <a href={`tel:${empresa.telefono}`} className="hover:text-texto-secundario transition-colors">
              {empresa.telefono}
            </a>
          )}
          {empresa.correo && (
            <a href={`mailto:${empresa.correo}`} className="hover:text-texto-secundario transition-colors">
              {empresa.correo}
            </a>
          )}
          {empresa.pagina_web && (
            <a
              href={empresa.pagina_web.startsWith('http') ? empresa.pagina_web : `https://${empresa.pagina_web}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-texto-secundario transition-colors"
            >
              {empresa.pagina_web.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Branding Flux */}
        <div className="flex items-center justify-center gap-1.5 pt-2 opacity-30">
          <Image
            src="/iconos/favicon.svg"
            alt=""
            width={12}
            height={12}
            className="size-3"
            unoptimized
          />
          <span className="text-[10px] text-texto-terciario">
            Generado con Flux by Salix
          </span>
        </div>
      </div>
    </footer>
  )
}

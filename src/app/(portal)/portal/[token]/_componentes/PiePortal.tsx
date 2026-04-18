'use client'

/**
 * PiePortal — Footer del portal: tarjeta con logo empresa centrado + datos,
 * y LogoSalix debajo. Datos dinámicos de la config de cada empresa.
 * Se usa en: VistaPortal
 */

import Image from 'next/image'
import { LogoSalix } from '@/componentes/marca'

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
  const datosContacto = [
    empresa.ubicacion,
    empresa.telefono,
    empresa.correo,
  ].filter(Boolean)

  const webLimpia = empresa.pagina_web?.replace(/^https?:\/\//, '') || null

  return (
    <footer className="max-w-3xl mx-auto px-4 sm:px-6 pb-6 mt-8 space-y-4">
      {/* Tarjeta empresa */}
      <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil py-8 px-5">
        <div className="flex flex-col items-center gap-3">
          {empresa.logo_url && (
            <Image
              src={empresa.logo_url}
              alt={empresa.nombre}
              width={64}
              height={64}
              className="size-16 rounded-card object-contain"
              unoptimized
            />
          )}
          <span className="text-base font-semibold text-texto-primario">{empresa.nombre}</span>
        </div>

        {(datosContacto.length > 0 || webLimpia) && (
          <div className="mt-5">
            <div className="bg-superficie-elevada rounded-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-texto-secundario">
                {datosContacto.map((dato, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-texto-terciario">·</span>}
                    {dato}
                  </span>
                ))}
                {webLimpia && (
                  <span className="flex items-center gap-2">
                    {datosContacto.length > 0 && <span className="text-texto-terciario">·</span>}
                    <a
                      href={empresa.pagina_web!.startsWith('http') ? empresa.pagina_web! : `https://${empresa.pagina_web}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-marca-500 hover:text-marca-400 transition-colors"
                    >
                      {webLimpia}
                    </a>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "Con tecnología de Salix" — enlaza a salixweb.com */}
      <div className="flex justify-center">
        <a
          href="https://www.salixweb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 opacity-50 hover:opacity-80 transition-opacity"
        >
          <span className="text-xs text-texto-terciario">Con tecnología de</span>
          <LogoSalix layout="horizontal" animacion="pulso" tamano={16} hover={false} tap={false} />
        </a>
      </div>
    </footer>
  )
}

'use client'

/**
 * CabeceraPortal — Header del portal público.
 * Tarjeta con logo empresa grande + datos dinámicos + LogoSalix animado.
 * Los datos (nombre, descripción, teléfono, correo) vienen de la config de la empresa.
 * Se usa en: VistaPortal
 */

import Image from 'next/image'
import { LogoSalix } from '@/componentes/marca'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'

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
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
      <div className="bg-superficie-tarjeta rounded-card border border-borde-sutil p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Izquierda: logo + info empresa */}
          <div className="flex items-start gap-4 min-w-0">
            {empresa.logo_url && (
              <Image
                src={empresa.logo_url}
                alt={empresa.nombre}
                width={80}
                height={80}
                className="size-16 sm:size-20 rounded-card object-contain shrink-0"
                unoptimized
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-texto-primario truncate">
                {empresa.nombre}
              </h1>
              {empresa.descripcion && (
                <p className="text-sm text-texto-terciario mt-0.5 line-clamp-2">
                  {empresa.descripcion}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1.5 text-sm text-texto-secundario">
                {empresa.telefono && (
                  <TextoTelefono valor={empresa.telefono} />
                )}
                {empresa.correo && (
                  <span>{empresa.correo}</span>
                )}
              </div>
            </div>
          </div>

          {/* Derecha: LogoSalix animado — enlaza a salixweb.com */}
          <a
            href="https://www.salixweb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 opacity-60 hover:opacity-90 transition-opacity"
          >
            <LogoSalix layout="horizontal" animacion="pulso" tamano={22} hover tap={false} />
          </a>
        </div>
      </div>
    </div>
  )
}

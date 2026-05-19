'use client'

import { PenLine, PlusCircle, ListTree } from 'lucide-react'
import { SelectorSegmentado } from '@/componentes/ui/SelectorSegmentado'
import type { ModoAsistente } from './tipos'

/**
 * SelectorModoSalix — Tabs Redactar / Crear / Desglosar con microcopy.
 *
 * Cada modo tiene su propio acento de color (purple/teal/amber)
 * que tiñe el pill del SelectorSegmentado activo. Debajo, una línea
 * corta explicando qué hace el modo seleccionado.
 */

interface PropsSelectorModoSalix {
  valor: ModoAsistente
  onChange: (modo: ModoAsistente) => void
  disabled?: boolean
}

const MICROCOPY: Record<ModoAsistente, string> = {
  redactar:  'Redacta un párrafo profesional y lo aplica al servicio genérico. No agrega nada nuevo al catálogo.',
  crear:     'Crea un servicio o producto con nombre y código propio. Queda guardado en el catálogo para reutilizar.',
  desglosar: 'Identifica varios servicios, los matchea con el catálogo y propone crear los que falten.',
}

export function SelectorModoSalix({ valor, onChange, disabled = false }: PropsSelectorModoSalix) {
  return (
    <div className="space-y-2">
      <SelectorSegmentado<ModoAsistente>
        idLayout="modo-salix"
        valor={valor}
        onChange={modo => {
          onChange(modo)
          if (typeof window !== 'undefined') {
            localStorage.setItem('flux_asistente_modo', modo)
          }
        }}
        disabled={disabled}
        anchoCompleto
        opciones={[
          { id: 'redactar',  etiqueta: 'Redactar',  icono: <PenLine size={13} />,     acento: 'primario' },
          { id: 'crear',     etiqueta: 'Crear',     icono: <PlusCircle size={13} />,  acento: 'exito' },
          { id: 'desglosar', etiqueta: 'Desglosar', icono: <ListTree size={13} />,    acento: 'advertencia' },
        ]}
      />
      <p className="text-xxs text-texto-terciario leading-relaxed text-center px-2">
        {MICROCOPY[valor]}
      </p>
    </div>
  )
}

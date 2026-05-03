'use client'

import { Users, Briefcase } from 'lucide-react'

/**
 * Tabs Clientes/Empleados — separa la bandeja de WhatsApp en dos vistas.
 * Clientes: conversaciones con contactos externos (sin miembro vinculado).
 * Empleados: conversaciones con miembros del equipo (Salix IA, recibos de
 * nómina, recordatorios, etc.).
 */

interface Props {
  audiencia: 'clientes' | 'empleados'
  onCambiar: (a: 'clientes' | 'empleados') => void
}

export function TabsAudienciaWA({ audiencia, onCambiar }: Props) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2 border-b"
      style={{ borderColor: 'var(--borde-sutil)' }}
    >
      <Tab
        activo={audiencia === 'clientes'}
        onClick={() => onCambiar('clientes')}
        icono={<Users size={13} />}
        etiqueta="Clientes"
      />
      <Tab
        activo={audiencia === 'empleados'}
        onClick={() => onCambiar('empleados')}
        icono={<Briefcase size={13} />}
        etiqueta="Empleados"
      />
    </div>
  )
}

function Tab({
  activo, onClick, icono, etiqueta,
}: {
  activo: boolean
  onClick: () => void
  icono: React.ReactNode
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        activo
          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
          : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      {icono}
      {etiqueta}
    </button>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { TarjetaAccion } from './TarjetaAccion'

/**
 * WidgetLeadsNuevos — Contactos provisorios creados en los últimos 7 días,
 * típicamente por el agente IA de WhatsApp. Son leads que hay que confirmar/
 * atender. Tap sobre un lead abre su perfil para completarlo.
 */

interface Lead {
  id: string
  nombre: string | null
  apellido: string | null
  telefono: string | null
  whatsapp: string | null
  origen: string | null
  creado_en: string
}

function fmtRelativo(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const diffHoras = Math.floor((hoy.getTime() - d.getTime()) / 3600000)
  if (diffHoras < 1) return 'Ahora'
  if (diffHoras < 24) return `Hace ${diffHoras}h`
  const diffDias = Math.floor(diffHoras / 24)
  if (diffDias === 1) return 'Ayer'
  return `Hace ${diffDias}d`
}

export function WidgetLeadsNuevos() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/leads-nuevos')
      .then(r => r.ok ? r.json() : { leads: [], total: 0 })
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0) })
      .catch(() => { setLeads([]); setTotal(0) })
      .finally(() => setCargando(false))
  }, [])

  if (!cargando && total === 0) return null

  return (
    <TarjetaAccion
      titulo="Leads nuevos"
      subtitulo={total === 1 ? '1 lead para confirmar' : `${total} leads para confirmar`}
      icono={<Sparkles size={16} strokeWidth={1.5} />}
      colorFondo="bg-insignia-violeta-fondo"
      colorIcono="text-insignia-violeta-texto"
      contador={total}
      verTodoHref="/contactos?es_provisorio=true"
    >
      {cargando ? (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-superficie-hover/40 rounded-boton animate-pulse" />
          ))}
        </div>
      ) : (
        leads.map(lead => {
          const nombre = [lead.nombre, lead.apellido].filter(Boolean).join(' ') || lead.telefono || lead.whatsapp || 'Sin nombre'
          const contacto = lead.whatsapp || lead.telefono
          const esWhatsApp = lead.origen?.includes('whatsapp') || !!lead.whatsapp
          return (
            <div
              key={lead.id}
              onClick={() => router.push(`/contactos/${lead.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/contactos/${lead.id}`) } }}
              role="button"
              tabIndex={0}
              className="flex items-center gap-2.5 py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors"
            >
              {esWhatsApp && (
                <span className="size-6 rounded-full flex items-center justify-center bg-canal-whatsapp/15 text-canal-whatsapp shrink-0">
                  <IconoWhatsApp size={11} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-texto-primario truncate">{nombre}</p>
                {contacto && <p className="text-xxs text-texto-terciario truncate mt-0.5">{contacto}</p>}
              </div>
              <span className="text-xxs text-texto-terciario shrink-0 tabular-nums">
                {fmtRelativo(lead.creado_en)}
              </span>
            </div>
          )
        })
      )}
    </TarjetaAccion>
  )
}

import type { Metadata } from 'next'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import VistaPortal from './_componentes/VistaPortal'
import PortalExpirado from './_componentes/PortalExpirado'
import type { DatosPortal } from '@/tipos/portal'

/**
 * Página pública del portal de presupuestos.
 * Server component que fetch data y pasa a VistaPortal.
 * Se usa en: /portal/[token] (público, sin auth)
 */

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const admin = crearClienteAdmin()

  const { data: portalToken } = await admin
    .from('portal_tokens')
    .select('presupuesto_id, empresa_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!portalToken) {
    return { title: 'Enlace no válido — Flux by Salix' }
  }

  const [{ data: presupuesto }, { data: empresa }] = await Promise.all([
    admin.from('presupuestos').select('numero, total_final').eq('id', portalToken.presupuesto_id).single(),
    admin.from('empresas').select('nombre, logo_url, descripcion').eq('id', portalToken.empresa_id).single(),
  ])

  const titulo = presupuesto && empresa
    ? `Presupuesto ${presupuesto.numero} — ${empresa.nombre}`
    : 'Presupuesto — Flux by Salix'

  const descripcion = presupuesto && empresa
    ? `${empresa.nombre} te envió un presupuesto para tu revisión.`
    : 'Revisá y aceptá tu presupuesto online.'

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      type: 'website',
      siteName: 'Flux by Salix',
      ...(empresa?.logo_url ? {
        images: [{ url: empresa.logo_url, width: 200, height: 200, alt: empresa.nombre }],
      } : {}),
    },
    twitter: {
      card: 'summary',
      title: titulo,
      description: descripcion,
      ...(empresa?.logo_url ? { images: [empresa.logo_url] } : {}),
    },
  }
}

async function obtenerDatosPortal(token: string): Promise<DatosPortal | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/portal/${token}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function PaginaPortal({ params }: Props) {
  const { token } = await params
  const datos = await obtenerDatosPortal(token)

  if (!datos) {
    return <PortalExpirado />
  }

  return <VistaPortal datos={datos} />
}

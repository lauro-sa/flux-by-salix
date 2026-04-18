import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolver info de canal (nombre, proveedor, tipo) para un conjunto de canal_ids.
 * Consulta canales_correo y canales_whatsapp según el tipo_canal de cada registro.
 * Reemplaza los joins Supabase que antes apuntaban a la tabla unificada canales_inbox.
 */
export interface RegistroConCanal {
  canal_id?: string | null
  tipo_canal?: string | null
}

export interface CanalResuelto {
  id: string
  nombre: string | null
  proveedor: string | null
  tipo: 'correo' | 'whatsapp' | 'interno'
  estado_conexion?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolverCanales(admin: SupabaseClient<any>, registros: RegistroConCanal[]): Promise<Map<string, CanalResuelto>> {
  const idsCorreo = new Set<string>()
  const idsWhatsApp = new Set<string>()
  const idsInterno = new Set<string>()
  for (const r of registros) {
    if (!r.canal_id) continue
    if (r.tipo_canal === 'correo') idsCorreo.add(r.canal_id)
    else if (r.tipo_canal === 'whatsapp') idsWhatsApp.add(r.canal_id)
    else if (r.tipo_canal === 'interno') idsInterno.add(r.canal_id)
  }

  const [correoRes, whatsappRes, internoRes] = await Promise.all([
    idsCorreo.size
      ? admin.from('canales_correo').select('id, nombre, proveedor, estado_conexion').in('id', Array.from(idsCorreo))
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string; proveedor: string | null; estado_conexion: string | null }> }),
    idsWhatsApp.size
      ? admin.from('canales_whatsapp').select('id, nombre, proveedor, estado_conexion').in('id', Array.from(idsWhatsApp))
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string; proveedor: string | null; estado_conexion: string | null }> }),
    idsInterno.size
      ? admin.from('canales_internos').select('id, nombre').in('id', Array.from(idsInterno))
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string }> }),
  ])

  const mapa = new Map<string, CanalResuelto>()
  for (const c of (correoRes.data || [])) {
    mapa.set(c.id, { id: c.id, nombre: c.nombre, proveedor: c.proveedor, tipo: 'correo', estado_conexion: c.estado_conexion })
  }
  for (const c of (whatsappRes.data || [])) {
    mapa.set(c.id, { id: c.id, nombre: c.nombre, proveedor: c.proveedor, tipo: 'whatsapp', estado_conexion: c.estado_conexion })
  }
  for (const c of (internoRes.data || [])) {
    mapa.set(c.id, { id: c.id, nombre: c.nombre, proveedor: null, tipo: 'interno' })
  }
  return mapa
}

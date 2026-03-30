import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { COLOR_ETIQUETA_DEFECTO } from '@/lib/colores_entidad'

/**
 * Etiquetas del inbox — para clasificar conversaciones de cualquier canal.
 * Tabla: etiquetas_inbox (antes etiquetas_correo).
 *
 * GET    — listar etiquetas de la empresa
 * POST   — crear etiqueta nueva
 * PATCH  ?id=xxx — actualizar etiqueta
 * DELETE ?id=xxx — eliminar etiqueta
 * PUT    — restablecer etiquetas por defecto
 */

// Etiquetas por defecto que se crean para cada empresa
const ETIQUETAS_DEFAULT = [
  { nombre: 'Consulta',        color: '#3b82f6', icono: '❓', orden: 1,  clave: 'consulta' },
  { nombre: 'Venta',           color: '#22c55e', icono: '💰', orden: 2,  clave: 'venta' },
  { nombre: 'Soporte',         color: '#f59e0b', icono: '🔧', orden: 3,  clave: 'soporte' },
  { nombre: 'Reclamo',         color: '#ef4444', icono: '⚠️', orden: 4,  clave: 'reclamo' },
  { nombre: 'Presupuesto',     color: '#8b5cf6', icono: '📋', orden: 5,  clave: 'presupuesto' },
  { nombre: 'Postventa',       color: '#06b6d4', icono: '🤝', orden: 6,  clave: 'postventa' },
  { nombre: 'Urgente',         color: '#dc2626', icono: '🔴', orden: 7,  clave: 'urgente' },
  { nombre: 'Seguimiento',     color: '#64748b', icono: '📌', orden: 8,  clave: 'seguimiento' },
  { nombre: 'Info / Catálogo', color: '#0ea5e9', icono: '📄', orden: 9,  clave: 'info' },
  { nombre: 'Agendamiento',    color: '#a855f7', icono: '📅', orden: 10, clave: 'agendamiento' },
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('etiquetas_inbox')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })

    return NextResponse.json({ etiquetas: data || [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { nombre, color, icono } = await request.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('etiquetas_inbox')
      .insert({
        empresa_id: empresaId,
        nombre: nombre.trim(),
        color: color || COLOR_ETIQUETA_DEFECTO,
        icono: icono || null,
        es_default: false,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etiqueta: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const body = await request.json()
    const cambios: Record<string, unknown> = {}
    if (body.nombre !== undefined) cambios.nombre = body.nombre
    if (body.color !== undefined) cambios.color = body.color
    if (body.icono !== undefined) cambios.icono = body.icono
    if (body.orden !== undefined) cambios.orden = body.orden

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('etiquetas_inbox')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etiqueta: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    await admin
      .from('etiquetas_inbox')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * PUT /api/inbox/etiquetas — Restablecer etiquetas por defecto.
 * Re-inserta las que falten (por clave_default), sin borrar las custom.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Ver cuáles defaults ya existen
    const { data: existentes } = await admin
      .from('etiquetas_inbox')
      .select('clave_default')
      .eq('empresa_id', empresaId)
      .eq('es_default', true)

    const clavesExistentes = new Set((existentes || []).map(e => e.clave_default))

    // Insertar las que faltan
    const faltantes = ETIQUETAS_DEFAULT.filter(d => !clavesExistentes.has(d.clave))

    if (faltantes.length > 0) {
      await admin
        .from('etiquetas_inbox')
        .insert(faltantes.map(d => ({
          empresa_id: empresaId,
          nombre: d.nombre,
          color: d.color,
          icono: d.icono,
          orden: d.orden,
          es_default: true,
          clave_default: d.clave,
        })))
    }

    // Devolver lista completa actualizada
    const { data } = await admin
      .from('etiquetas_inbox')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })

    return NextResponse.json({
      etiquetas: data || [],
      restauradas: faltantes.length,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

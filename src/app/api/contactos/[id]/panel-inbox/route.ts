import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/contactos/[id]/panel-inbox — Datos enriquecidos para el panel lateral del inbox.
 * Retorna: vinculaciones con nombre/tipo, presupuestos recientes, direcciones, responsables.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [
      resVinculacionesDirectas,
      resVinculacionesInversas,
      resPresupuestos,
      resDirecciones,
    ] = await Promise.all([
      // Vinculaciones directas (este contacto → otro)
      admin.from('contacto_vinculaciones')
        .select(`
          id, tipo_relacion_id, puesto,
          vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(
            id, nombre, apellido, telefono, correo, codigo,
            tipo_contacto:tipos_contacto(clave, etiqueta, icono, color)
          ),
          tipo_relacion:tipos_relacion(clave, etiqueta, etiqueta_inversa)
        `)
        .eq('empresa_id', empresaId)
        .eq('contacto_id', id)
        .limit(10),

      // Vinculaciones inversas (otro → este contacto)
      admin.from('contacto_vinculaciones')
        .select(`
          id, tipo_relacion_id, puesto,
          contacto:contactos!contacto_vinculaciones_contacto_id_fkey(
            id, nombre, apellido, telefono, correo, codigo,
            tipo_contacto:tipos_contacto(clave, etiqueta, icono, color)
          ),
          tipo_relacion:tipos_relacion(clave, etiqueta, etiqueta_inversa)
        `)
        .eq('empresa_id', empresaId)
        .eq('vinculado_id', id)
        .limit(10),

      // Presupuestos recientes (últimos 5)
      admin.from('presupuestos')
        .select('id, numero, estado, total_final, moneda, fecha_emision, contacto_nombre')
        .eq('empresa_id', empresaId)
        .or(`contacto_id.eq.${id},atencion_contacto_id.eq.${id}`)
        .eq('en_papelera', false)
        .order('creado_en', { ascending: false })
        .limit(5),

      // Direcciones
      admin.from('contacto_direcciones')
        .select('id, tipo, calle, numero, barrio, ciudad, provincia, codigo_postal, texto, es_principal')
        .eq('contacto_id', id)
        .order('es_principal', { ascending: false }),
    ])

    // Unificar vinculaciones (directas + inversas) y deduplicar por contacto vinculado
    const vinculacionesRaw = [
      ...(resVinculacionesDirectas.data || []).map((v: Record<string, unknown>) => ({
        id: v.id,
        contacto: v.vinculado as Record<string, unknown>,
        relacion: (v.tipo_relacion as Record<string, string> | null)?.etiqueta || v.puesto || 'Vinculado',
        puesto: v.puesto,
      })),
      ...(resVinculacionesInversas.data || []).map((v: Record<string, unknown>) => ({
        id: v.id,
        contacto: v.contacto as Record<string, unknown>,
        relacion: (v.tipo_relacion as Record<string, string> | null)?.etiqueta_inversa || v.puesto || 'Vinculado',
        puesto: v.puesto,
      })),
    ]

    // Deduplicar: si el mismo contacto aparece por vínculo directo e inverso, quedarse con uno
    const vistos = new Set<string>()
    const vinculaciones = vinculacionesRaw.filter(v => {
      const contactoId = (v.contacto as Record<string, unknown>)?.id as string
      if (!contactoId || vistos.has(contactoId)) return false
      vistos.add(contactoId)
      return true
    })

    return NextResponse.json({
      vinculaciones,
      presupuestos: resPresupuestos.data || [],
      direcciones: resDirecciones.data || [],
    })
  } catch (error) {
    console.error('Error en panel-inbox contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

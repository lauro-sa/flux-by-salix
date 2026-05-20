import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/contactos/config/orden-alfabetico
 *
 * Resetea la columna `orden` a 0 para todos los items de un catálogo de
 * configuración de contactos. Combinado con el sort `(orden ASC, nombre/
 * etiqueta ASC)` que usa el resto de la app, esto efectivamente "vuelve
 * al orden alfabético" — el desempate del segundo `order` se aplica
 * cuando todos los items están empatados en `orden = 0`.
 *
 * Body: { tipo: 'etiqueta' | 'rubro' | 'puesto' | 'relacion' }
 *
 * No borra ni modifica items, solo el orden.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { tipo } = await request.json()
    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto'
      : tipo === 'rubro' ? 'rubros_contacto'
      : tipo === 'puesto' ? 'puestos_contacto'
      : tipo === 'relacion' ? 'tipos_relacion'
      : null

    if (!tabla) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { error } = await admin.from(tabla).update({ orden: 0 }).eq('empresa_id', empresaId)
    if (error) return NextResponse.json({ error: 'Error al resetear orden' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirAutenticacionAPI } from '@/lib/permisos-servidor'
import { cargarIdentidadMiembros } from '@/lib/miembros/identidad'

/**
 * GET /api/whatsapp/destinatarios?audiencia=clientes|empleados
 *
 * Devuelve la lista completa (cap 2000) de destinatarios elegibles para iniciar
 * una conversación de WhatsApp desde el selector "Nuevo chat":
 *   - audiencia=clientes:  contactos con `whatsapp IS NOT NULL`
 *   - audiencia=empleados: miembros activos con teléfono cargado (empresa o personal)
 *
 * Sin paginación arbitraria — el filtrado y la búsqueda corren cliente-side en
 * la columna izquierda para respuesta instantánea. Difiere de /api/contactos
 * (limit 100) porque ese endpoint está pensado para listados con paginación;
 * acá necesitamos el universo completo para el selector alfabético.
 *
 * Cap 2000: si una empresa supera ese volumen, conviene migrar a backend-search
 * con debounce. Por ahora 2000 es más que suficiente para el caso típico.
 */

const CAP_DESTINATARIOS = 2000

export async function GET(request: NextRequest) {
  try {
    const guard = await requerirAutenticacionAPI()
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const audiencia = request.nextUrl.searchParams.get('audiencia') || 'clientes'
    if (audiencia !== 'clientes' && audiencia !== 'empleados') {
      return NextResponse.json({ error: 'audiencia inválida' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    if (audiencia === 'clientes') {
      // Traemos TODOS los contactos (no solo los que tienen WA). Los que no tienen
      // WhatsApp se devuelven con `disponible: false` para que el selector los
      // muestre atenuados y al clickearlos lleve al detalle del contacto.
      const { data, error } = await admin
        .from('contactos')
        .select('id, nombre, apellido, whatsapp, avatar_url, cargo, rubro')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true })
        .limit(CAP_DESTINATARIOS)
      if (error) {
        return NextResponse.json({ error: 'Error al listar contactos', detalle: error.message }, { status: 500 })
      }
      const destinatarios = (data || []).map(c => ({
        id: c.id,
        nombre: `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim() || 'Sin nombre',
        telefono: c.whatsapp || '',
        tipo: 'cliente' as const,
        avatar_url: c.avatar_url,
        detalle: c.cargo || c.rubro || null,
        disponible: !!c.whatsapp,
      }))
      return NextResponse.json({ destinatarios, total: destinatarios.length, cap: CAP_DESTINATARIOS })
    }

    // Empleados: traer miembros activos + identidad consolidada y filtrar los que tengan teléfono.
    const { data: miembrosRaw, error: errMiembros } = await admin
      .from('miembros')
      .select('id, usuario_id, puesto_id')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .limit(CAP_DESTINATARIOS)
    if (errMiembros) {
      return NextResponse.json({ error: 'Error al listar empleados', detalle: errMiembros.message }, { status: 500 })
    }
    const miembros = miembrosRaw || []
    const identidades = await cargarIdentidadMiembros(
      admin,
      miembros.map(m => ({ id: m.id, usuario_id: m.usuario_id })),
      empresaId,
    )

    // Cargar puestos para tener el detalle "puesto" en el item de la lista
    const puestoIds = Array.from(new Set(miembros.map(m => m.puesto_id).filter(Boolean) as string[]))
    const puestosMap = new Map<string, string>()
    if (puestoIds.length > 0) {
      const { data: puestos } = await admin
        .from('puestos')
        .select('id, nombre')
        .in('id', puestoIds)
      for (const p of puestos || []) puestosMap.set(p.id, p.nombre)
    }

    // Devolvemos TODOS los empleados activos. Los que no tienen teléfono cargado
    // van con disponible=false; el cliente los muestra atenuados con atajo al perfil.
    const destinatarios = miembros
      .map(m => {
        const id = identidades.get(m.id)
        const telefono = id?.telefono_empresa || id?.telefono || ''
        const nombre = `${id?.nombre || ''}${id?.apellido ? ' ' + id.apellido : ''}`.trim() || 'Sin nombre'
        return {
          id: m.id,
          nombre,
          telefono,
          tipo: 'empleado' as const,
          avatar_url: id?.avatar_url ?? null,
          detalle: (m.puesto_id && puestosMap.get(m.puesto_id)) || null,
          disponible: !!telefono,
        }
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

    return NextResponse.json({ destinatarios, total: destinatarios.length, cap: CAP_DESTINATARIOS })
  } catch (e) {
    const detalle = e instanceof Error ? e.message : null
    return NextResponse.json({ error: 'Error interno', detalle }, { status: 500 })
  }
}

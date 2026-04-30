import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'

/**
 * POST /api/presupuestos/[id]/edicion-admin
 * Registra que un administrador/propietario aplicó una corrección al
 * documento estando éste fuera del estado "borrador". No cambia el estado,
 * fechas de envío ni contadores: solo deja traza en `presupuesto_historial`
 * y en el chatter para auditoría.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requerirPermisoAPI('presupuestos', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId, miembro } = guard

  // Solo propietarios, administradores y superadmins de Salix
  const esSuperadmin = miembro.esSuperadmin === true
  if (!esSuperadmin && miembro.rol !== 'propietario' && miembro.rol !== 'administrador') {
    return NextResponse.json(
      { error: 'Solo propietarios o administradores pueden corregir documentos enviados' },
      { status: 403 }
    )
  }

  const admin = crearClienteAdmin()

  // Verificar que el presupuesto existe en la empresa y traer estado + nombre
  const { data: presupuesto } = await admin
    .from('presupuestos')
    .select('id, estado, numero')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .single()

  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  }

  // Resolver nombre legible del editor (mismo patrón que [id]/route.ts)
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .single()
  const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Administrador'

  // Entrada en historial con estado actual (no hay cambio de estado).
  // Las notas dejan claro que fue una corrección post-envío.
  await admin.from('presupuesto_historial').insert({
    presupuesto_id: id,
    empresa_id: empresaId,
    estado: presupuesto.estado,
    usuario_id: user.id,
    usuario_nombre: nombreUsuario,
    notas: 'Corrección administrativa (edición fuera de borrador)',
  })

  // Chatter: deja traza visible para el equipo
  await registrarChatter({
    empresaId,
    entidadTipo: 'presupuesto',
    entidadId: id,
    tipo: 'sistema',
    contenido: `Aplicó una corrección administrativa al documento ${presupuesto.numero || ''}`.trim(),
    autorId: user.id,
    autorNombre: nombreUsuario,
  })

  return NextResponse.json({ ok: true })
}

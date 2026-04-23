import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/auditoria — Obtener historial de ediciones de cualquier entidad.
 *
 * Query params:
 *   - tabla: nombre de la tabla de auditoría (ej: 'auditoria_asistencias')
 *   - campo: nombre del campo FK (ej: 'asistencia_id')
 *   - id: ID del registro a consultar
 *
 * Devuelve los cambios ordenados por fecha descendente, con el nombre del editor.
 * Reutilizable para cualquier módulo con tabla de auditoría.
 */

// Tablas de auditoría permitidas (whitelist para evitar inyección)
const TABLAS_PERMITIDAS = new Set([
  'auditoria_asistencias',
  'auditoria_contactos',
  'auditoria_contacto_telefonos',
  'auditoria_productos',
  'auditoria_actividades',
  'auditoria_presupuestos',
  'auditoria_ordenes',
  'auditoria_plantillas_correo',
  'auditoria_respuestas_rapidas_correo',
  'auditoria_respuestas_rapidas_whatsapp',
  'auditoria_plantillas_whatsapp',
])

// Campos FK permitidos por tabla
const CAMPOS_PERMITIDOS: Record<string, string[]> = {
  auditoria_asistencias: ['asistencia_id'],
  auditoria_contactos: ['contacto_id'],
  auditoria_contacto_telefonos: ['telefono_id'],
  auditoria_productos: ['producto_id'],
  auditoria_actividades: ['actividad_id'],
  auditoria_presupuestos: ['presupuesto_id'],
  auditoria_ordenes: ['orden_id'],
  auditoria_plantillas_correo: ['plantilla_id'],
  auditoria_respuestas_rapidas_correo: ['plantilla_id'],
  auditoria_respuestas_rapidas_whatsapp: ['plantilla_id'],
  auditoria_plantillas_whatsapp: ['plantilla_id'],
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('auditoria', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { searchParams } = request.nextUrl
    const tabla = searchParams.get('tabla')
    const campo = searchParams.get('campo')
    const id = searchParams.get('id')

    if (!tabla || !campo || !id) {
      return NextResponse.json({ error: 'Faltan parámetros: tabla, campo, id' }, { status: 400 })
    }

    // Validar tabla y campo contra whitelist
    if (!TABLAS_PERMITIDAS.has(tabla)) {
      return NextResponse.json({ error: 'Tabla no permitida' }, { status: 400 })
    }
    if (!CAMPOS_PERMITIDOS[tabla]?.includes(campo)) {
      return NextResponse.json({ error: 'Campo no permitido para esta tabla' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Consultar cambios de auditoría
    const { data: cambios, error } = await admin
      .from(tabla)
      .select('id, campo_modificado, valor_anterior, valor_nuevo, motivo, creado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq(campo, id)
      .order('creado_en', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Resolver nombres de editores — primero busca por miembros.id (patrón asistencias),
    // luego como fallback por perfiles.id (patrón productos/plantillas_correo con user.id).
    const editoresIds = [...new Set((cambios || []).map(c => c.editado_por).filter(Boolean))]
    const nombresMap = new Map<string, string>()

    if (editoresIds.length > 0) {
      // 1) Intentar resolver como miembro.id
      const { data: miembros } = await admin
        .from('miembros')
        .select('id, usuario_id')
        .in('id', editoresIds)

      if (miembros && miembros.length > 0) {
        const usuarioIds = miembros.map(m => m.usuario_id)
        const { data: perfiles } = await admin
          .from('perfiles')
          .select('id, nombre, apellido')
          .in('id', usuarioIds)

        const perfilesMap = new Map((perfiles || []).map(p => [p.id, `${p.nombre} ${p.apellido || ''}`.trim()]))
        for (const m of miembros) {
          nombresMap.set(m.id, perfilesMap.get(m.usuario_id) || 'Desconocido')
        }
      }

      // 2) Fallback: resolver ids restantes como perfiles.id directamente (user.id)
      const idsPendientes = editoresIds.filter(id => !nombresMap.has(id))
      if (idsPendientes.length > 0) {
        const { data: perfilesDirectos } = await admin
          .from('perfiles')
          .select('id, nombre, apellido')
          .in('id', idsPendientes)

        for (const p of perfilesDirectos || []) {
          nombresMap.set(p.id, `${p.nombre} ${p.apellido || ''}`.trim())
        }
      }
    }

    const cambiosConNombre = (cambios || []).map(c => ({
      ...c,
      editor_nombre: nombresMap.get(c.editado_por) || null,
    }))

    return NextResponse.json({ cambios: cambiosConNombre })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

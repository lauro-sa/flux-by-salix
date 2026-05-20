import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/contactos/config — Obtener etiquetas, rubros y puestos configurados.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de contactos' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [etiquetasRes, rubrosRes, puestosRes, relacionesRes, contactosRes] = await Promise.all([
      // Orden primario: columna `orden` (default 0 = sin ordenar manualmente).
      // Desempate: alfabético por `nombre`/`etiqueta`. Cuando todos los
      // items están en `orden = 0` (estado inicial, antes de cualquier
      // drag-and-drop), salen alfabéticos por el tiebreak — comportamiento
      // que esperás como default.
      admin.from('etiquetas_contacto').select('*').eq('empresa_id', empresaId).order('orden').order('nombre'),
      admin.from('rubros_contacto').select('*').eq('empresa_id', empresaId).order('orden').order('nombre'),
      admin.from('puestos_contacto').select('*').eq('empresa_id', empresaId).order('orden').order('nombre'),
      admin.from('tipos_relacion').select('*').eq('empresa_id', empresaId).order('orden').order('etiqueta'),
      // Para contar usos: traemos los datos crudos de los contactos de la
      // empresa y agregamos en TS (más simple y rápido que múltiples
      // queries con COUNT, sobre todo en empresas con catálogos chicos y
      // contactos en volumen moderado).
      admin.from('contactos').select('id, rubro, cargo, etiquetas').eq('empresa_id', empresaId).eq('en_papelera', false),
    ])

    // Vinculaciones de la empresa, para contar usos de tipo_relacion_id
    // y puesto. Filtramos por `empresa_id` directo en la tabla (existe
    // como FK) — antes hacíamos `.in('contacto_id', idsContactos)` con la
    // lista completa de IDs de la empresa, pero con 900+ contactos el
    // URL excedía el límite de PostgREST y la query devolvía vacío.
    const { data: vinculacionesData } = await admin
      .from('contacto_vinculaciones')
      .select('tipo_relacion_id, puesto')
      .eq('empresa_id', empresaId)
    const vinculaciones = (vinculacionesData || []) as Array<{ tipo_relacion_id: string | null; puesto: string | null }>

    // Conteo de usos por valor — pasamos `cantidad_usos` por item.
    const contactos = (contactosRes.data || []) as Array<{ rubro: string | null; cargo: string | null; etiquetas: string[] | null }>
    const contarUsos = (predicate: (c: typeof contactos[number]) => boolean): number =>
      contactos.reduce((acc, c) => acc + (predicate(c) ? 1 : 0), 0)

    const etiquetas = (etiquetasRes.data || []).map((e: Record<string, unknown>) => ({
      ...e,
      cantidad_usos: contarUsos(c => (c.etiquetas || []).includes(e.nombre as string)),
    }))
    const rubros = (rubrosRes.data || []).map((r: Record<string, unknown>) => ({
      ...r,
      cantidad_usos: contarUsos(c => c.rubro === r.nombre),
    }))
    const puestos = (puestosRes.data || []).map((p: Record<string, unknown>) => {
      const usosCargo = contarUsos(c => c.cargo === p.nombre)
      const usosVinc = vinculaciones.reduce((acc, v) => acc + (v.puesto === p.nombre ? 1 : 0), 0)
      return { ...p, cantidad_usos: usosCargo + usosVinc }
    })
    const relaciones = (relacionesRes.data || []).map((r: Record<string, unknown>) => ({
      id: r.id, nombre: r.etiqueta, activo: r.activo, orden: 0,
      etiqueta_inversa: r.etiqueta_inversa, es_predefinido: r.es_predefinido,
      cantidad_usos: vinculaciones.reduce((acc, v) => acc + (v.tipo_relacion_id === r.id ? 1 : 0), 0),
    }))

    return NextResponse.json({ etiquetas, rubros, puestos, relaciones })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/contactos/config — Crear etiqueta, rubro o puesto.
 * Body: { tipo: 'etiqueta' | 'rubro' | 'puesto', nombre: string, color?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, nombre, color, activo } = body

    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Tipos de relación tienen estructura diferente
    if (tipo === 'relacion') {
      const clave = nombre.trim().toLowerCase().replace(/\s+/g, '_')
      const { data, error } = await admin.from('tipos_relacion').insert({
        empresa_id: empresaId,
        clave,
        etiqueta: nombre.trim(),
        etiqueta_inversa: body.etiqueta_inversa?.trim() || nombre.trim(),
        es_predefinido: false,
      }).select().single()

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Ya existe' }, { status: 409 })
        return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
      }
      return NextResponse.json(data, { status: 201 })
    }

    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : null

    if (!tabla) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })

    const registro: Record<string, unknown> = {
      empresa_id: empresaId,
      nombre: nombre.trim(),
    }
    if (tipo === 'etiqueta' && color) registro.color = color
    if (activo !== undefined) registro.activo = activo

    const { data, error } = await admin.from(tabla).insert(registro).select().single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ya existe' }, { status: 409 })
      return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/contactos/config — Actualizar etiqueta, rubro o puesto.
 * Body: { tipo, id, nombre?, color?, activo?, orden? }
 *
 * Si se cambia el `nombre` del item, propagamos el cambio a los registros
 * referenciados — porque etiquetas, rubros y puestos se guardan por VALOR
 * (string) en `contactos.etiquetas[]`, `contactos.rubro`, `contactos.cargo`,
 * `contacto_vinculaciones.puesto`. Si no propagáramos, los contactos
 * quedarían con el nombre viejo "congelado" desconectados del catálogo.
 * Para `relacion` no aplica — vinculaciones referencian por `tipo_relacion_id` (FK).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, id } = body

    const admin = crearClienteAdmin()
    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : tipo === 'relacion' ? 'tipos_relacion' : null

    if (!tabla || !id) return NextResponse.json({ error: 'Tipo e ID obligatorios' }, { status: 400 })

    // Si vamos a cambiar el nombre, leemos el valor anterior primero para
    // poder propagar el cambio a los registros que lo usan por valor.
    let nombreAnterior: string | null = null
    const cambioDeNombre = 'nombre' in body && body.nombre?.trim()
    if (cambioDeNombre && tipo !== 'relacion') {
      const { data: filaAnterior } = await admin
        .from(tabla)
        .select('nombre')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      nombreAnterior = (filaAnterior as { nombre?: string } | null)?.nombre || null
    }

    const actualizar: Record<string, unknown> = {}
    if (tipo === 'relacion') {
      if ('nombre' in body) actualizar.etiqueta = body.nombre?.trim()
      if ('etiqueta_inversa' in body) actualizar.etiqueta_inversa = body.etiqueta_inversa?.trim()
    } else {
      if ('nombre' in body) actualizar.nombre = body.nombre?.trim()
    }
    if ('color' in body) actualizar.color = body.color
    if ('activo' in body) actualizar.activo = body.activo
    if ('orden' in body) actualizar.orden = body.orden

    const { data, error } = await admin.from(tabla).update(actualizar).eq('id', id).eq('empresa_id', empresaId).select().single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    // Propagar el rename a los registros que referencian por valor.
    if (cambioDeNombre && nombreAnterior && nombreAnterior !== body.nombre.trim()) {
      const nombreNuevo = body.nombre.trim()
      const empresa = empresaId

      if (tipo === 'rubro') {
        // contactos.rubro
        await admin.from('contactos').update({ rubro: nombreNuevo })
          .eq('empresa_id', empresa)
          .eq('rubro', nombreAnterior)
      } else if (tipo === 'puesto') {
        // contactos.cargo (profesión general)
        await admin.from('contactos').update({ cargo: nombreNuevo })
          .eq('empresa_id', empresa)
          .eq('cargo', nombreAnterior)
        // contacto_vinculaciones.puesto (rol en la vinculación, legacy).
        // Filtramos directo por `empresa_id` (la tabla la tiene como FK).
        await admin.from('contacto_vinculaciones').update({ puesto: nombreNuevo })
          .eq('empresa_id', empresa)
          .eq('puesto', nombreAnterior)
      } else if (tipo === 'etiqueta') {
        // contactos.etiquetas es text[]. Hacemos un SQL directo para
        // reemplazar el valor viejo por el nuevo en el array. Necesita
        // exec via rpc o raw query — uso `rpc` si existe, sino update por
        // contacto. Simplificamos: fetch contactos con la etiqueta, mapeo
        // del array, update individual.
        const { data: contactosConEtiqueta } = await admin
          .from('contactos')
          .select('id, etiquetas')
          .eq('empresa_id', empresa)
          .contains('etiquetas', [nombreAnterior])
        const filas = (contactosConEtiqueta as Array<{ id: string; etiquetas: string[] }> | null) || []
        for (const c of filas) {
          const nuevas = (c.etiquetas || []).map(e => e === nombreAnterior ? nombreNuevo : e)
          await admin.from('contactos').update({ etiquetas: nuevas }).eq('id', c.id)
        }
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/contactos/config — Eliminar etiqueta, rubro o puesto.
 * Body: { tipo, id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, id } = body

    const admin = crearClienteAdmin()
    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : tipo === 'relacion' ? 'tipos_relacion' : null

    if (!tabla || !id) return NextResponse.json({ error: 'Tipo e ID obligatorios' }, { status: 400 })

    await admin.from(tabla).delete().eq('id', id).eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

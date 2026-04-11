import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/contactos/tipos — Listar tipos de contacto de la empresa.
 * También devuelve tipos de relación y campos fiscales del país.
 */
export async function GET(_request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de contactos' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener datos en paralelo
    const [tiposRes, relacionesRes, puestosRes, empresaRes] = await Promise.all([
      admin
        .from('tipos_contacto')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('orden'),
      admin
        .from('tipos_relacion')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('etiqueta'),
      admin
        .from('puestos_contacto')
        .select('id, nombre, orden')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('orden'),
      admin
        .from('empresas')
        .select('pais, paises')
        .eq('id', empresaId)
        .single(),
    ])

    // Campos fiscales de todos los países donde opera la empresa
    const paisesArray: string[] = empresaRes.data?.paises?.length
      ? empresaRes.data.paises
      : empresaRes.data?.pais ? [empresaRes.data.pais] : []

    let camposFiscales: unknown[] = []
    if (paisesArray.length > 0) {
      const { data } = await admin
        .from('campos_fiscales_pais')
        .select('*')
        .in('pais', paisesArray)
        .order('orden')
      camposFiscales = data || []
    }

    return NextResponse.json({
      tipos_contacto: tiposRes.data || [],
      tipos_relacion: relacionesRes.data || [],
      puestos_vinculacion: (puestosRes.data || []).map((p: { id: string; nombre: string }) => ({ id: p.id, etiqueta: p.nombre })),
      campos_fiscales: camposFiscales,
      paises: paisesArray,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/contactos/tipos — Crear un tipo de contacto custom.
 * Solo admin+.
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

    const admin = crearClienteAdmin()

    const body = await request.json()

    if (!body.clave?.trim() || !body.etiqueta?.trim()) {
      return NextResponse.json({ error: 'clave y etiqueta son obligatorios' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('tipos_contacto')
      .insert({
        empresa_id: empresaId,
        clave: body.clave.toLowerCase().trim().replace(/\s+/g, '_'),
        etiqueta: body.etiqueta.trim(),
        icono: body.icono || 'user',
        color: body.color || 'primario',
        puede_tener_hijos: body.puede_tener_hijos || false,
        es_predefinido: false,
        orden: body.orden || 99,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un tipo con esa clave' }, { status: 409 })
      }
      console.error('Error al crear tipo:', error)
      return NextResponse.json({ error: 'Error al crear tipo' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { cifrar } from '@/lib/cifrado'

// GET /api/correo/canales — listar canales de correo visibles al usuario.
//
// Tipos de bandeja:
//   - compartida: propietario_usuario_id IS NULL, varios agentes via canal_agentes
//   - personal: propietario_usuario_id = un usuario, solo ese usuario la ve
//
// Filtros por query param:
//   ?solo_compartidas=1   → solo bandejas de equipo (uso en /inbox/configuracion)
//   ?propietario=USER_ID  → solo personales de ese usuario (uso en /usuarios/[id]/correo)
//   (sin filtro)          → admin ve todo; otro user ve solo lo que le corresponde
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido: puedeVerConfig } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_correo', 'ver')

    const modulo = request.nextUrl.searchParams.get('modulo')
    const tipoContactoId = request.nextUrl.searchParams.get('tipo_contacto_id')
    const soloCompartidas = request.nextUrl.searchParams.get('solo_compartidas') === '1'
    const propietarioFiltro = request.nextUrl.searchParams.get('propietario')
    const admin = crearClienteAdmin()

    let query = admin
      .from('canales_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true })

    // Filtros explícitos de la UI (usados por páginas de configuración):
    //   ?solo_compartidas=1 → bandejas de equipo, requiere permiso de config
    //   ?propietario=X      → personales de ese usuario; si X != me, requiere config
    if (soloCompartidas) {
      if (!puedeVerConfig) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
      query = query.is('propietario_usuario_id', null)
    } else if (propietarioFiltro) {
      if (propietarioFiltro !== user.id && !puedeVerConfig) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
      query = query.eq('propietario_usuario_id', propietarioFiltro)
    } else {
      // Inbox operacional (sin params): TODOS — incluidos admin y propietario — solo
      // ven lo que les corresponde operar (personales propias + compartidas donde son
      // agentes). Las personales ajenas NO se muestran acá, aunque el admin pueda
      // verlas desde el perfil del usuario como gestión. Esto separa "lo que opero"
      // de "lo que administro".
      const { data: misAsignaciones } = await admin
        .from('canal_agentes')
        .select('canal_id')
        .eq('usuario_id', user.id)
      const idsAgente = (misAsignaciones || []).map(c => c.canal_id)
      if (idsAgente.length > 0) {
        query = query.or(`propietario_usuario_id.eq.${user.id},id.in.(${idsAgente.join(',')})`)
      } else {
        query = query.eq('propietario_usuario_id', user.id)
      }
    }

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ canales: [] })
      }
      throw error
    }

    // Resolver agentes manualmente (canal_id es polimórfico, sin FK)
    let canales = data || []
    if (canales.length > 0) {
      const ids = canales.map(c => c.id)
      const { data: agentes } = await admin
        .from('canal_agentes')
        .select('canal_id, usuario_id, rol_canal')
        .in('canal_id', ids)
      const agentesPorCanal = new Map<string, Array<{ usuario_id: string; rol_canal: string }>>()
      for (const a of agentes || []) {
        const lista = agentesPorCanal.get(a.canal_id) || []
        lista.push({ usuario_id: a.usuario_id, rol_canal: a.rol_canal })
        agentesPorCanal.set(a.canal_id, lista)
      }
      canales = canales.map(c => ({ ...c, agentes: agentesPorCanal.get(c.id) || [] }))
    }
    if (modulo) {
      canales = canales.filter((c: { modulos_disponibles?: string[] }) => {
        const mods = c.modulos_disponibles || []
        return mods.length === 0 || mods.includes(modulo)
      })
    }

    let canalPredeterminadoTipo: string | null = null
    if (tipoContactoId) {
      const { data: regla } = await admin
        .from('correo_por_tipo_contacto')
        .select('canal_id')
        .eq('empresa_id', empresaId)
        .eq('tipo_contacto_id', tipoContactoId)
        .single()
      if (regla) canalPredeterminadoTipo = regla.canal_id
    }

    const canalesConPredeterminado = canales.map((c: Record<string, unknown>) => ({
      ...c,
      tipo: 'correo',
      _predeterminado_tipo: c.id === canalPredeterminadoTipo,
    }))

    return NextResponse.json({ canales: canalesConPredeterminado })
  } catch (err) {
    console.error('Error al obtener canales de correo:', err)
    return NextResponse.json({ canales: [] })
  }
}

// POST /api/correo/canales — crear canal de correo
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_correo', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await request.json()
    const { nombre, proveedor, config_conexion, agentes, modulos_disponibles, propietario_usuario_id } = body

    if (config_conexion?.password_cifrada && typeof config_conexion.password_cifrada === 'string') {
      config_conexion.password_cifrada = cifrar(config_conexion.password_cifrada)
    }

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el módulo de correo esté activo
    const { data: modulo } = await admin
      .from('modulos_empresa')
      .select('activo')
      .eq('empresa_id', empresaId)
      .eq('modulo', 'inbox_correo')
      .single()

    if (!modulo?.activo) {
      return NextResponse.json({ error: 'El módulo de correo no está activo' }, { status: 403 })
    }

    // Si viene propietario_usuario_id, validar que pertenece a la misma empresa
    if (propietario_usuario_id) {
      const { data: miembroObjetivo } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', propietario_usuario_id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!miembroObjetivo) {
        return NextResponse.json({ error: 'El usuario propietario no es miembro de esta empresa' }, { status: 400 })
      }
    }

    const { data: canal, error } = await admin
      .from('canales_correo')
      .insert({
        empresa_id: empresaId,
        nombre,
        proveedor: proveedor || null,
        config_conexion: config_conexion || {},
        modulos_disponibles: Array.isArray(modulos_disponibles) ? modulos_disponibles : [],
        propietario_usuario_id: propietario_usuario_id || null,
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Bandeja personal: el propietario queda registrado como agente automáticamente
    // para que cualquier filtro por canal_agentes lo encuentre.
    if (propietario_usuario_id) {
      await admin.from('canal_agentes').insert({
        canal_id: canal.id,
        usuario_id: propietario_usuario_id,
        rol_canal: 'propietario',
      })
    } else if (agentes && agentes.length > 0) {
      // Bandeja compartida con agentes iniciales
      const agentesData = agentes.map((a: { usuario_id: string; rol_canal?: string }) => ({
        canal_id: canal.id,
        usuario_id: a.usuario_id,
        rol_canal: a.rol_canal || 'agente',
      }))
      await admin.from('canal_agentes').insert(agentesData)
    }

    return NextResponse.json({ canal }, { status: 201 })
  } catch (err) {
    console.error('Error al crear canal de correo:', err)
    return NextResponse.json({ error: 'Error al crear canal' }, { status: 500 })
  }
}

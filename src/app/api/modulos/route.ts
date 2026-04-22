import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI, requerirAutenticacionAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { ModuloConEstado } from '@/tipos'

/**
 * GET /api/modulos — Catálogo completo con estado de instalación por empresa.
 * Devuelve todos los módulos visibles del catálogo, marcando cuáles están instalados.
 *
 * Acceso: cualquier miembro autenticado con empresa activa. Este endpoint
 * alimenta al sidebar para TODOS los usuarios (un colaborador también necesita
 * saber qué módulos tiene la empresa para filtrar la navegación).
 * Instalar/desinstalar sí exige permiso (ver POST más abajo).
 */
export async function GET() {
  try {
    const guard = await requerirAutenticacionAPI()
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Catálogo completo (visible)
    const { data: catalogo, error: errCatalogo } = await admin
      .from('catalogo_modulos')
      .select('*')
      .eq('visible', true)
      .order('orden')

    if (errCatalogo) throw errCatalogo

    // Módulos instalados de esta empresa
    const { data: instalados, error: errInstalados } = await admin
      .from('modulos_empresa')
      .select('*')
      .eq('empresa_id', empresaId)

    if (errInstalados) throw errInstalados

    // Mapear instalados por slug
    const mapaInstalados = new Map(
      (instalados || []).map(m => [m.modulo, m])
    )

    // Combinar catálogo + estado de instalación
    const modulos: ModuloConEstado[] = (catalogo || []).map(cat => {
      const inst = mapaInstalados.get(cat.slug)
      const purgaProgramada = inst?.purga_programada_en ?? null
      let diasRestantes: number | null = null
      if (purgaProgramada && !inst?.activo) {
        const diff = new Date(purgaProgramada).getTime() - Date.now()
        diasRestantes = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }
      return {
        ...cat,
        precio_mensual_usd: Number(cat.precio_mensual_usd) || 0,
        precio_anual_usd: Number(cat.precio_anual_usd) || 0,
        requiere: cat.requiere || [],
        features: cat.features || [],
        instalado: !!inst,
        activo: inst?.activo ?? false,
        modulo_empresa_id: inst?.id ?? null,
        purga_programada_en: purgaProgramada,
        dias_restantes_purga: diasRestantes,
      }
    })

    return NextResponse.json({ modulos })
  } catch (err) {
    console.error('Error al listar módulos:', err)
    return NextResponse.json({ error: 'Error al cargar módulos' }, { status: 500 })
  }
}

/**
 * POST /api/modulos — Instalar o desinstalar un módulo.
 * Body: { slug: string, accion: 'instalar' | 'desinstalar' }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { slug, accion } = body as { slug: string; accion: 'instalar' | 'desinstalar' }

    if (!slug || !accion) {
      return NextResponse.json({ error: 'Faltan parámetros: slug y accion' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el módulo existe en el catálogo
    const { data: moduloCatalogo, error: errCat } = await admin
      .from('catalogo_modulos')
      .select('*')
      .eq('slug', slug)
      .single()

    if (errCat || !moduloCatalogo) {
      return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 })
    }

    if (accion === 'instalar') {
      // No se puede instalar si ya está instalado y activo
      const { data: existente } = await admin
        .from('modulos_empresa')
        .select('id, activo')
        .eq('empresa_id', empresaId)
        .eq('modulo', slug)
        .single()

      if (existente?.activo) {
        return NextResponse.json({ error: 'El módulo ya está instalado' }, { status: 409 })
      }

      // Verificar dependencias
      const dependencias = moduloCatalogo.requiere || []
      if (dependencias.length > 0) {
        const { data: modulosActivos } = await admin
          .from('modulos_empresa')
          .select('modulo')
          .eq('empresa_id', empresaId)
          .eq('activo', true)

        const slugsActivos = new Set((modulosActivos || []).map(m => m.modulo))
        const faltantes = dependencias.filter((dep: string) => !slugsActivos.has(dep))
        if (faltantes.length > 0) {
          return NextResponse.json({
            error: `Requiere módulos: ${faltantes.join(', ')}`,
            faltantes,
          }, { status: 400 })
        }
      }

      if (existente) {
        // Reactivar módulo desactivado
        await admin
          .from('modulos_empresa')
          .update({
            activo: true,
            activado_en: new Date().toISOString(),
            desactivado_en: null,
          })
          .eq('id', existente.id)
      } else {
        // Insertar nuevo
        await admin
          .from('modulos_empresa')
          .insert({
            empresa_id: empresaId,
            modulo: slug,
            activo: true,
            catalogo_modulo_id: moduloCatalogo.id,
            instalado_por: user.id,
            activado_en: new Date().toISOString(),
          })
      }

      return NextResponse.json({ ok: true, accion: 'instalado' })
    }

    if (accion === 'desinstalar') {
      // No se puede desinstalar módulos base
      if (moduloCatalogo.es_base) {
        return NextResponse.json({ error: 'No se puede desinstalar un módulo base' }, { status: 400 })
      }

      // Desactivar (soft delete — no borramos para mantener config)
      const { error: errUpdate } = await admin
        .from('modulos_empresa')
        .update({
          activo: false,
          desactivado_en: new Date().toISOString(),
        })
        .eq('empresa_id', empresaId)
        .eq('modulo', slug)

      if (errUpdate) throw errUpdate

      return NextResponse.json({ ok: true, accion: 'desinstalado' })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err) {
    console.error('Error en módulos:', err)
    return NextResponse.json({ error: 'Error al procesar módulo' }, { status: 500 })
  }
}

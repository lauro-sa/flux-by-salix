import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import Holidays from 'date-holidays'

/**
 * GET /api/calendario/feriados — Listar feriados de la empresa.
 * Query params opcionales: anio (filtrar por año), activos (solo activos)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const params = request.nextUrl.searchParams
    const anio = params.get('anio')

    let query = admin
      .from('feriados')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('fecha', { ascending: true })

    if (anio) {
      query = query
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Error al obtener feriados' }, { status: 500 })

    return NextResponse.json({ feriados: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/calendario/feriados — Acciones de feriados.
 * Body: { accion, datos }
 * Acciones: crear, editar, eliminar, cargar_pais, importar_csv
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_calendario', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()
    const { accion, datos } = body

    switch (accion) {
      // ── Crear feriado manual ──
      case 'crear': {
        if (!datos.nombre?.trim() || !datos.fecha) {
          return NextResponse.json({ error: 'nombre y fecha son obligatorios' }, { status: 400 })
        }

        const registro = {
          empresa_id: empresaId,
          nombre: datos.nombre.trim(),
          fecha: datos.fecha,
          tipo: datos.tipo || 'empresa',
          pais_codigo: datos.pais_codigo || null,
          recurrente: datos.recurrente ?? false,
          dia_mes: datos.recurrente ? parseInt(datos.fecha.split('-')[2]) : null,
          mes: datos.recurrente ? parseInt(datos.fecha.split('-')[1]) : null,
          origen: 'manual',
          creado_por: user.id,
        }

        const { data, error } = await admin
          .from('feriados')
          .insert(registro)
          .select()
          .single()

        if (error) {
          if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un feriado con ese nombre en esa fecha' }, { status: 409 })
          return NextResponse.json({ error: 'Error al crear feriado' }, { status: 500 })
        }
        return NextResponse.json(data, { status: 201 })
      }

      // ── Editar feriado ──
      case 'editar': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const campos: Record<string, unknown> = {}
        if (datos.nombre !== undefined) campos.nombre = datos.nombre.trim()
        if (datos.fecha !== undefined) campos.fecha = datos.fecha
        if (datos.tipo !== undefined) campos.tipo = datos.tipo
        if (datos.activo !== undefined) campos.activo = datos.activo
        if (datos.recurrente !== undefined) {
          campos.recurrente = datos.recurrente
          if (datos.recurrente && datos.fecha) {
            campos.dia_mes = parseInt(datos.fecha.split('-')[2])
            campos.mes = parseInt(datos.fecha.split('-')[1])
          }
        }

        const { data, error } = await admin
          .from('feriados')
          .update(campos)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) return NextResponse.json({ error: 'Error al editar feriado' }, { status: 500 })
        return NextResponse.json(data)
      }

      // ── Eliminar feriado ──
      case 'eliminar': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const { error } = await admin
          .from('feriados')
          .delete()
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)

        if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
        return NextResponse.json({ ok: true })
      }

      // ── Cargar feriados de un país (usando date-holidays como semilla) ──
      case 'cargar_pais': {
        const paisCodigo = datos.pais_codigo
        const anio = datos.anio || new Date().getFullYear()

        if (!paisCodigo) return NextResponse.json({ error: 'pais_codigo requerido' }, { status: 400 })

        const hd = new Holidays(paisCodigo)
        const feriadosPais = hd.getHolidays(anio).filter(h => h.type === 'public')

        if (feriadosPais.length === 0) {
          return NextResponse.json({ error: `No se encontraron feriados para ${paisCodigo} en ${anio}` }, { status: 404 })
        }

        // Obtener feriados existentes del año para evitar duplicados
        const { data: existentes } = await admin
          .from('feriados')
          .select('fecha, nombre')
          .eq('empresa_id', empresaId)
          .gte('fecha', `${anio}-01-01`)
          .lte('fecha', `${anio}-12-31`)

        const existentesSet = new Set(
          (existentes || []).map((e: Record<string, unknown>) => `${e.fecha}`)
        )

        const nuevos = feriadosPais
          .map(h => {
            const fecha = h.date.split(' ')[0]
            return {
              empresa_id: empresaId,
              nombre: h.name,
              fecha,
              tipo: 'nacional' as const,
              pais_codigo: paisCodigo,
              recurrente: false,
              origen: 'libreria' as const,
              creado_por: user.id,
              activo: true,
            }
          })
          .filter(f => !existentesSet.has(f.fecha))

        if (nuevos.length === 0) {
          return NextResponse.json({ mensaje: 'Todos los feriados ya estaban cargados', insertados: 0 })
        }

        const { error } = await admin.from('feriados').insert(nuevos)
        if (error) return NextResponse.json({ error: 'Error al insertar feriados' }, { status: 500 })

        // Devolver lista actualizada
        const { data: todos } = await admin
          .from('feriados')
          .select('*')
          .eq('empresa_id', empresaId)
          .gte('fecha', `${anio}-01-01`)
          .lte('fecha', `${anio}-12-31`)
          .eq('activo', true)
          .order('fecha')

        return NextResponse.json({
          mensaje: `${nuevos.length} feriados cargados para ${paisCodigo} ${anio}`,
          insertados: nuevos.length,
          feriados: todos || [],
        })
      }

      // ── Importar CSV ──
      case 'importar_csv': {
        const filas = datos.filas as { fecha: string; nombre: string; tipo?: string }[]
        if (!Array.isArray(filas) || filas.length === 0) {
          return NextResponse.json({ error: 'Se requiere un array de filas con fecha y nombre' }, { status: 400 })
        }

        // Validar formato de fechas
        const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
        const errores: string[] = []
        const registros = filas.map((fila, i) => {
          if (!fila.fecha || !fechaRegex.test(fila.fecha)) {
            errores.push(`Fila ${i + 1}: fecha inválida "${fila.fecha}" (formato: YYYY-MM-DD)`)
          }
          if (!fila.nombre?.trim()) {
            errores.push(`Fila ${i + 1}: nombre vacío`)
          }
          return {
            empresa_id: empresaId,
            nombre: fila.nombre?.trim() || '',
            fecha: fila.fecha,
            tipo: fila.tipo || 'nacional',
            origen: 'importado' as const,
            creado_por: user.id,
            activo: true,
          }
        })

        if (errores.length > 0) {
          return NextResponse.json({ error: 'Errores en el CSV', detalles: errores }, { status: 400 })
        }

        // Insertar ignorando duplicados (on conflict do nothing via upsert no funciona bien, así que filtramos)
        const { data: existentes } = await admin
          .from('feriados')
          .select('fecha, nombre')
          .eq('empresa_id', empresaId)

        const existentesSet = new Set(
          (existentes || []).map((e: Record<string, unknown>) => `${e.fecha}|${e.nombre}`)
        )

        const nuevos = registros.filter(r => !existentesSet.has(`${r.fecha}|${r.nombre}`))

        if (nuevos.length > 0) {
          const { error } = await admin.from('feriados').insert(nuevos)
          if (error) return NextResponse.json({ error: 'Error al importar' }, { status: 500 })
        }

        // Devolver lista actualizada
        const anios = new Set(filas.map(f => f.fecha.split('-')[0]))
        const anioMin = Math.min(...[...anios].map(Number))
        const anioMax = Math.max(...[...anios].map(Number))

        const { data: todos } = await admin
          .from('feriados')
          .select('*')
          .eq('empresa_id', empresaId)
          .gte('fecha', `${anioMin}-01-01`)
          .lte('fecha', `${anioMax}-12-31`)
          .eq('activo', true)
          .order('fecha')

        return NextResponse.json({
          mensaje: `${nuevos.length} feriados importados (${filas.length - nuevos.length} duplicados omitidos)`,
          insertados: nuevos.length,
          duplicados: filas.length - nuevos.length,
          feriados: todos || [],
        })
      }

      // ── Eliminar todos los de un año ──
      case 'limpiar_anio': {
        const anio = datos.anio
        if (!anio) return NextResponse.json({ error: 'anio requerido' }, { status: 400 })

        const { error } = await admin
          .from('feriados')
          .delete()
          .eq('empresa_id', empresaId)
          .gte('fecha', `${anio}-01-01`)
          .lte('fecha', `${anio}-12-31`)

        if (error) return NextResponse.json({ error: 'Error al limpiar' }, { status: 500 })
        return NextResponse.json({ ok: true, mensaje: `Feriados de ${anio} eliminados` })
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 })
    }
  } catch (err) {
    console.error('Error en feriados:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

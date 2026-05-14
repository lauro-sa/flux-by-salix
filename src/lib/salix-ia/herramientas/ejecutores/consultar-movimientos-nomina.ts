/**
 * Ejecutor: consultar_movimientos_nomina
 * Lista adelantos y/o descuentos de uno o todos los empleados, con cuotas
 * opcionales y el flag `es_editable` calculado a partir del estado del
 * movimiento y el estado de sus cuotas.
 *
 * Reglas de editabilidad (espejo de /api/adelantos/[id] PATCH):
 *  - estado === 'pagado'    → NO editable (la nómina ya cerró)
 *  - estado === 'cancelado' → NO editable (ya fuera del sistema)
 *  - estado === 'activo' + todas las cuotas pendientes → editable completo
 *  - estado === 'activo' + algunas cuotas descontadas  → editable parcial
 *    (no se puede reducir a menos cuotas, solo se regeneran las pendientes)
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { verificarPermiso } from '@/lib/permisos-servidor'
import type { Rol } from '@/tipos/miembro'
import { normalizarBusqueda } from '@/lib/validaciones'

interface CuotaVista {
  numero: number
  monto: number
  fecha_programada: string
  fecha_descontada: string | null
  estado: 'pendiente' | 'descontada' | 'cancelada'
}

interface MovimientoVista {
  id: string
  miembro_id: string
  miembro_nombre: string | null
  tipo: 'adelanto' | 'descuento'
  monto_total: number
  cuotas_totales: number
  cuotas_descontadas: number
  cuotas_pendientes: number
  saldo_pendiente: number
  frecuencia_descuento: string
  fecha_solicitud: string
  fecha_inicio_descuento: string
  estado: string
  descripcion: string | null
  creado_por_nombre: string | null
  creado_en: string
  es_editable: boolean
  motivo_no_editable: string | null
  cuotas?: CuotaVista[]
}

export async function ejecutarConsultarMovimientosNomina(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  // Permiso: necesita al menos ver_propio. Si solo tiene ver_propio, fuerza
  // a su propio miembro_id sin importar lo que pase en params.
  const datosMiembro = { rol: ctx.miembro.rol as Rol, permisos_custom: ctx.miembro.permisos_custom }
  const verTodos = verificarPermiso(datosMiembro, 'nomina', 'ver_todos')
  const verPropio = verificarPermiso(datosMiembro, 'nomina', 'ver_propio')

  if (!verTodos && !verPropio) {
    return { exito: false, error: 'No tenés permiso para ver movimientos de nómina.' }
  }

  // ─── Resolver miembro objetivo ───
  let miembroIdFiltro: string | null = null
  let miembroNombreFiltro: string | null = null

  if (!verTodos) {
    // Solo ver_propio: forzar a su propio miembro
    miembroIdFiltro = ctx.miembro.id
  } else {
    const miembroIdParam = (params.miembro_id as string)?.trim()
    const busquedaMiembro = (params.busqueda_miembro as string)?.trim()

    if (miembroIdParam) {
      miembroIdFiltro = miembroIdParam
    } else if (busquedaMiembro) {
      // Buscar miembro por nombre/apellido (en perfiles vinculados)
      const palabras = busquedaMiembro.split(/\s+/).filter(p => p.length >= 2)
      if (palabras.length === 0) {
        return { exito: false, error: 'La búsqueda del empleado es muy corta.' }
      }
      // miembros + perfiles en dos queries (la FK miembros→perfiles no está
      // declarada en Drizzle; el patrón "perfiles:perfil_id(...)" no funciona).
      const { data: miembros } = await ctx.admin
        .from('miembros')
        .select('id, usuario_id')
        .eq('empresa_id', ctx.empresa_id)
        .eq('activo', true)
        .limit(200)

      const lista = (miembros || []) as Array<{ id: string; usuario_id: string | null }>
      const usuarioIds = lista.map(m => m.usuario_id).filter(Boolean) as string[]

      const perfilesMap = new Map<string, { nombre: string; apellido: string | null }>()
      if (usuarioIds.length > 0) {
        const { data: perfilesData } = await ctx.admin
          .from('perfiles')
          .select('id, nombre, apellido')
          .in('id', usuarioIds)
        for (const p of (perfilesData || []) as Array<{ id: string; nombre: string; apellido: string | null }>) {
          perfilesMap.set(p.id, { nombre: p.nombre, apellido: p.apellido })
        }
      }

      const palabrasNorm = palabras.map(normalizarBusqueda)
      const candidatos = lista
        .map(m => ({ miembro: m, perfil: m.usuario_id ? perfilesMap.get(m.usuario_id) : null }))
        .filter(c => {
          const nombreCompleto = normalizarBusqueda(`${c.perfil?.nombre || ''} ${c.perfil?.apellido || ''}`)
          return palabrasNorm.every(p => nombreCompleto.includes(p))
        })

      if (candidatos.length === 0) {
        return { exito: false, error: `No encontré un empleado con "${busquedaMiembro}".` }
      }
      if (candidatos.length > 1) {
        const nombres = candidatos.map(c => `${c.perfil?.nombre} ${c.perfil?.apellido || ''}`).join(', ')
        return {
          exito: false,
          error: `Encontré ${candidatos.length} empleados que coinciden con "${busquedaMiembro}": ${nombres}. Especificá nombre y apellido.`,
        }
      }
      miembroIdFiltro = candidatos[0].miembro.id
      miembroNombreFiltro = [candidatos[0].perfil?.nombre, candidatos[0].perfil?.apellido].filter(Boolean).join(' ')
    }
    // Sin filtro → trae movimientos de todos los empleados (visión gerencial)
  }

  // ─── Filtros adicionales ───
  const tipo = (params.tipo as string) || 'ambos' // adelanto | descuento | ambos
  const estado = (params.estado as string) || 'activo' // activo | pagado | cancelado | todos
  const incluirCuotas = !!params.incluir_cuotas
  const fechaDesde = (params.fecha_desde as string)?.trim()
  const fechaHasta = (params.fecha_hasta as string)?.trim()
  const limite = Math.min((params.limite as number) || 30, 100)

  // ─── Query principal ───
  let query = ctx.admin
    .from('adelantos_nomina')
    .select('*')
    .eq('empresa_id', ctx.empresa_id)
    .eq('eliminado', false)
    .order('fecha_solicitud', { ascending: false })
    .limit(limite)

  if (miembroIdFiltro) query = query.eq('miembro_id', miembroIdFiltro)
  if (tipo === 'adelanto' || tipo === 'descuento') query = query.eq('tipo', tipo)
  if (estado !== 'todos') query = query.eq('estado', estado)
  if (fechaDesde) query = query.gte('fecha_solicitud', fechaDesde)
  if (fechaHasta) query = query.lte('fecha_solicitud', fechaHasta)

  const { data: movimientos, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando movimientos: ${error.message}` }
  }

  if (!movimientos || movimientos.length === 0) {
    const nombreObj = miembroNombreFiltro || (miembroIdFiltro ? 'ese empleado' : 'el equipo')
    return {
      exito: true,
      datos: { movimientos: [], total: 0 },
      mensaje_usuario: `No hay movimientos de nómina ${estado === 'todos' ? '' : `(${estado})`} para *${nombreObj}*.`,
    }
  }

  // ─── Cargar cuotas y nombres de miembros en una sola pasada ───
  const ids = movimientos.map((m: { id: string }) => m.id)
  const miembrosIds = Array.from(new Set(movimientos.map((m: { miembro_id: string }) => m.miembro_id)))

  const [{ data: cuotas }, { data: miembrosData }] = await Promise.all([
    ctx.admin
      .from('adelantos_cuotas')
      .select('adelanto_id, numero_cuota, monto_cuota, fecha_programada, fecha_descontada, estado')
      .in('adelanto_id', ids)
      .order('numero_cuota', { ascending: true }),
    ctx.admin
      .from('miembros')
      .select('id, usuario_id')
      .in('id', miembrosIds),
  ])

  const cuotasPorAdelanto = new Map<string, CuotaVista[]>()
  for (const c of (cuotas || []) as Array<Record<string, unknown>>) {
    const aid = c.adelanto_id as string
    if (!cuotasPorAdelanto.has(aid)) cuotasPorAdelanto.set(aid, [])
    cuotasPorAdelanto.get(aid)!.push({
      numero: c.numero_cuota as number,
      monto: parseFloat(c.monto_cuota as string),
      fecha_programada: c.fecha_programada as string,
      fecha_descontada: (c.fecha_descontada as string) || null,
      estado: c.estado as 'pendiente' | 'descontada' | 'cancelada',
    })
  }

  // Nombres por miembro: cargar perfiles en query separada vía usuario_id.
  const miembrosList = (miembrosData || []) as Array<{ id: string; usuario_id: string | null }>
  const usuarioIdsList = miembrosList.map(m => m.usuario_id).filter(Boolean) as string[]
  const perfilesMap = new Map<string, { nombre: string; apellido: string | null }>()
  if (usuarioIdsList.length > 0) {
    const { data: perfilesData } = await ctx.admin
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIdsList)
    for (const p of (perfilesData || []) as Array<{ id: string; nombre: string; apellido: string | null }>) {
      perfilesMap.set(p.id, { nombre: p.nombre, apellido: p.apellido })
    }
  }

  const nombresPorMiembro = new Map<string, string>()
  for (const m of miembrosList) {
    const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
    nombresPorMiembro.set(m.id, [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' '))
  }

  // ─── Calcular es_editable + motivo por cada movimiento ───
  const resultado: MovimientoVista[] = movimientos.map((m: Record<string, unknown>) => {
    const cuotasMov = cuotasPorAdelanto.get(m.id as string) || []
    const cuotasDescontadas = m.cuotas_descontadas as number
    const cuotasTotales = m.cuotas_totales as number
    const cuotasPendientes = cuotasTotales - cuotasDescontadas
    const est = m.estado as string

    let es_editable = true
    let motivo_no_editable: string | null = null

    if (est === 'pagado') {
      es_editable = false
      motivo_no_editable = 'Ya está pagado, la nómina del periodo se cerró.'
    } else if (est === 'cancelado') {
      es_editable = false
      motivo_no_editable = 'Ya está cancelado.'
    } else if (cuotasPendientes === 0) {
      es_editable = false
      motivo_no_editable = 'Todas las cuotas ya fueron descontadas en nóminas anteriores.'
    } else if (cuotasDescontadas > 0) {
      // Parcialmente editable: avisamos para que la IA lo refleje al usuario
      motivo_no_editable = `${cuotasDescontadas} cuota(s) ya descontadas no se pueden modificar; ${cuotasPendientes} cuota(s) pendientes sí.`
    }

    return {
      id: m.id as string,
      miembro_id: m.miembro_id as string,
      miembro_nombre: nombresPorMiembro.get(m.miembro_id as string) || null,
      tipo: m.tipo as 'adelanto' | 'descuento',
      monto_total: parseFloat(m.monto_total as string),
      cuotas_totales: cuotasTotales,
      cuotas_descontadas: cuotasDescontadas,
      cuotas_pendientes: cuotasPendientes,
      saldo_pendiente: parseFloat(m.saldo_pendiente as string),
      frecuencia_descuento: m.frecuencia_descuento as string,
      fecha_solicitud: m.fecha_solicitud as string,
      fecha_inicio_descuento: m.fecha_inicio_descuento as string,
      estado: est,
      descripcion: (m.notas as string) || null,
      creado_por_nombre: (m.creado_por_nombre as string) || null,
      creado_en: m.creado_en as string,
      es_editable,
      motivo_no_editable,
      cuotas: incluirCuotas ? cuotasMov : undefined,
    }
  })

  // ─── Mensaje resumen ───
  const totalAdelantos = resultado.filter(r => r.tipo === 'adelanto').length
  const totalDescuentos = resultado.filter(r => r.tipo === 'descuento').length
  const totalEditable = resultado.filter(r => r.es_editable).length

  let mensaje = `${resultado.length} movimiento(s) encontrado(s)`
  if (totalAdelantos > 0 && totalDescuentos > 0) {
    mensaje += `: ${totalAdelantos} adelanto(s) y ${totalDescuentos} descuento(s)`
  }
  mensaje += `. ${totalEditable} editable(s).`

  return {
    exito: true,
    datos: { movimientos: resultado, total: resultado.length },
    mensaje_usuario: mensaje,
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'

/**
 * GET /api/dashboard/asistencia-mes?mes=YYYY-MM
 *
 * Devuelve resumen mensual de asistencia del equipo, navegable mes a mes
 * desde el widget de métricas. No carga datos de todos los meses al inicio
 * (el dashboard principal ya está pesado).
 *
 * Por miembro:
 *  - dias_presente: días con asistencia activa
 *  - dias_tardanza: días que llegó tarde
 *  - dias_ausente: días con ausencia registrada
 *  - minutos_trabajados: tiempo total entre entrada y salida
 *
 * Totales del mes:
 *  - dias_laborales: días del mes que NO son fin de semana
 *  - presentes_total / tardanzas_total / ausentes_total
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    if (!verificarPermiso(datosMiembro, 'asistencias', 'ver_todos')) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const mes = params.get('mes') // formato YYYY-MM
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'Parámetro mes (YYYY-MM) requerido' }, { status: 400 })
    }

    const [anioStr, mesStr] = mes.split('-')
    const anio = parseInt(anioStr)
    const mesNum = parseInt(mesStr)

    // Primer y último día del mes
    const inicioMes = `${anioStr}-${mesStr}-01`
    const finMes = new Date(anio, mesNum, 0) // día 0 del mes siguiente = último día del actual
    const finMesStr = `${anioStr}-${mesStr}-${String(finMes.getDate()).padStart(2, '0')}`

    const admin = crearClienteAdmin()

    // ─── Asistencias del mes ───
    // Partimos desde acá: cualquier miembro que tenga registros en el mes
    // aparece, incluso si después se dio de baja.
    const { data: asistenciasData } = await admin
      .from('asistencias')
      .select('miembro_id, fecha, estado, tipo, hora_entrada, hora_salida')
      .eq('empresa_id', empresaId)
      .gte('fecha', inicioMes)
      .lte('fecha', finMesStr)

    type AsistenciaRow = {
      miembro_id: string
      fecha: string
      estado: string
      tipo: string | null
      hora_entrada: string | null
      hora_salida: string | null
    }
    const asistencias = (asistenciasData || []) as AsistenciaRow[]

    // IDs de miembros que aparecen en las asistencias del mes
    const miembroIds = Array.from(new Set(asistencias.map((a) => a.miembro_id).filter(Boolean)))

    // ─── Datos de esos miembros (nombre, rol, sector) ───
    let miembrosData: Array<Record<string, unknown>> = []
    if (miembroIds.length > 0) {
      const { data } = await admin
        .from('miembros')
        .select('id, usuario_id, rol, puesto_id')
        .in('id', miembroIds)
      miembrosData = (data || []) as Array<Record<string, unknown>>
    }
    const etiquetasMiembros = await cargarEtiquetasMiembros(
      admin,
      miembrosData.map((m) => ({ id: m.id as string, puesto_id: (m.puesto_id as string | null) ?? null })),
    )

    const usuarioIds = miembrosData.map((m) => m.usuario_id as string).filter(Boolean)
    let perfilesData: Array<Record<string, unknown>> = []
    if (usuarioIds.length > 0) {
      const { data } = await admin
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', usuarioIds)
      perfilesData = (data || []) as Array<Record<string, unknown>>
    }

    const mapaPerfil = new Map<string, { nombre: string; apellido: string | null }>()
    for (const p of perfilesData) {
      mapaPerfil.set(p.id as string, {
        nombre: (p.nombre as string) || '',
        apellido: (p.apellido as string) || null,
      })
    }

    // ─── Fallback: contactos del equipo (miembros sin cuenta Flux) ───
    // Mismo patrón que /api/asistencias/nomina: si el miembro no tiene
    // usuario_id o el perfil viene vacío, usamos el contacto vinculado.
    let contactosEquipo: Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }> = []
    if (miembroIds.length > 0) {
      const { data } = await admin
        .from('contactos')
        .select('miembro_id, nombre, apellido')
        .in('miembro_id', miembroIds)
        .eq('en_papelera', false)
      contactosEquipo = (data || []) as typeof contactosEquipo
    }
    const mapaContacto = new Map<string, { nombre: string | null; apellido: string | null }>()
    for (const c of contactosEquipo) {
      if (c.miembro_id) {
        mapaContacto.set(c.miembro_id, { nombre: c.nombre, apellido: c.apellido })
      }
    }

    // ─── Procesar por miembro ───
    type ResumenMiembro = {
      miembro_id: string
      nombre: string
      rol: string | null
      sector: string | null
      puesto: string | null
      dias_presente: number
      dias_tardanza: number
      dias_ausente: number
      minutos_trabajados: number
    }

    const porMiembro = new Map<string, ResumenMiembro>()

    // Inicializar con los miembros que aparecen en las asistencias del mes.
    // Fallback de nombre: perfil → contacto vinculado → "Sin nombre"
    for (const m of miembrosData) {
      const usuarioId = m.usuario_id as string
      const perfil = usuarioId ? mapaPerfil.get(usuarioId) : null
      const contacto = mapaContacto.get(m.id as string)

      let nombreCompleto = 'Sin nombre'
      if (perfil && (perfil.nombre || perfil.apellido)) {
        nombreCompleto = `${perfil.nombre} ${perfil.apellido || ''}`.trim()
      } else if (contacto && (contacto.nombre || contacto.apellido)) {
        nombreCompleto = `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim()
      }

      const et = etiquetasMiembros.get(m.id as string)
      porMiembro.set(m.id as string, {
        miembro_id: m.id as string,
        nombre: nombreCompleto || 'Sin nombre',
        rol: (m.rol as string) || null,
        sector: et?.sector ?? null,
        puesto: et?.puesto ?? null,
        dias_presente: 0,
        dias_tardanza: 0,
        dias_ausente: 0,
        minutos_trabajados: 0,
      })
    }

    // Para miembros que aparecen en asistencias pero no se encontraron en
    // la tabla miembros (raro, pero defensivo), creamos entrada genérica
    for (const id of miembroIds) {
      if (!porMiembro.has(id)) {
        porMiembro.set(id, {
          miembro_id: id,
          nombre: 'Sin nombre',
          rol: null,
          sector: null,
          puesto: null,
          dias_presente: 0,
          dias_tardanza: 0,
          dias_ausente: 0,
          minutos_trabajados: 0,
        })
      }
    }

    // Acumular registros
    for (const a of asistencias) {
      const r = porMiembro.get(a.miembro_id)
      if (!r) continue

      if (a.estado === 'ausente') {
        r.dias_ausente++
      } else {
        if (a.tipo === 'tardanza') r.dias_tardanza++
        else r.dias_presente++

        if (a.hora_entrada && a.hora_salida) {
          const entrada = new Date(a.hora_entrada).getTime()
          const salida = new Date(a.hora_salida).getTime()
          const min = Math.max(0, Math.round((salida - entrada) / 60000))
          if (min > 0 && min < 24 * 60) r.minutos_trabajados += min
        }
      }
    }

    const filas = Array.from(porMiembro.values())
      .sort((a, b) => (b.dias_presente + b.dias_tardanza) - (a.dias_presente + a.dias_tardanza))

    // ─── Totales del mes ───
    let presentesTotal = 0, tardanzasTotal = 0, ausentesTotal = 0, minutosTotal = 0
    for (const r of filas) {
      presentesTotal += r.dias_presente
      tardanzasTotal += r.dias_tardanza
      ausentesTotal += r.dias_ausente
      minutosTotal += r.minutos_trabajados
    }

    // Días laborales del mes (lunes a viernes)
    let diasLaborales = 0
    for (let d = 1; d <= finMes.getDate(); d++) {
      const fecha = new Date(anio, mesNum - 1, d)
      const dow = fecha.getDay()
      if (dow !== 0 && dow !== 6) diasLaborales++ // 0=domingo, 6=sábado
    }

    // % de puntualidad: presentes a tiempo / (presentes + tardanzas)
    const presentesConRegistro = presentesTotal + tardanzasTotal
    const pctPuntualidad = presentesConRegistro > 0
      ? Math.round((presentesTotal / presentesConRegistro) * 100)
      : 0

    return NextResponse.json({
      mes,
      dias_laborales: diasLaborales,
      cant_miembros: filas.length,
      presentes_total: presentesTotal,
      tardanzas_total: tardanzasTotal,
      ausentes_total: ausentesTotal,
      minutos_total: minutosTotal,
      pct_puntualidad: pctPuntualidad,
      filas,
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard/asistencia-mes', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

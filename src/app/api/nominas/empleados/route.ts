/**
 * GET /api/nominas/empleados — Listado de empleados con su contrato
 * vigente expandido (sector, turno, modalidad, monto, frecuencia,
 * régimen).
 *
 * Soporta filtros opcionales por query:
 *   - sector_id   (csv de uuids)
 *   - turno_id    (csv de uuids)
 *   - modalidad   (csv de ModalidadCalculo)
 *   - regimen     (csv de RegimenContrato)
 *
 * Pensado para alimentar la pestaña "Empleados" de /nominas (PR 5).
 * Sin paginación por ahora — el volumen típico (decenas de empleados
 * por empresa) no la justifica. Se agrega cuando se sienta.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface ContratoVista {
  id: string
  miembro_id: string
  modalidad_calculo: string
  monto_base: number
  frecuencia_pago: string
  regimen: string
  condicion: string
  fecha_inicio: string
  sector_id: string | null
  turno_id: string | null
}

interface FilaEmpleado {
  miembro_id: string
  nombre: string
  apellido: string
  numero_empleado: number | null
  contrato: ContratoVista | null
  sector: { id: string; nombre: string; color: string } | null
  turno: { id: string; nombre: string } | null
}

export async function GET(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const filtroSector = params.get('sector_id')?.split(',').filter(Boolean) ?? []
  const filtroTurno = params.get('turno_id')?.split(',').filter(Boolean) ?? []
  const filtroModalidad = params.get('modalidad')?.split(',').filter(Boolean) ?? []
  const filtroRegimen = params.get('regimen')?.split(',').filter(Boolean) ?? []

  const admin = crearClienteAdmin()

  // Si soloPropio, limitar al miembro vinculado a este usuario.
  let miembrosFiltro: string[] | null = null
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio) return NextResponse.json({ empleados: [] })
    miembrosFiltro = [miembroPropio.id]
  }

  // ─── Miembros activos de la empresa ───
  let queryMiembros = admin
    .from('miembros')
    .select('id, usuario_id, numero_empleado')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
  if (miembrosFiltro) queryMiembros = queryMiembros.in('id', miembrosFiltro)

  const { data: miembros, error: errMiembros } = await queryMiembros
  if (errMiembros) {
    console.error('[empleados] error miembros:', errMiembros)
    return NextResponse.json({ error: 'Error al listar empleados' }, { status: 500 })
  }
  if (!miembros || miembros.length === 0) return NextResponse.json({ empleados: [] })

  const miembroIds = miembros.map(m => m.id)
  const usuarioIds = miembros.map(m => m.usuario_id).filter((u): u is string => !!u)

  // ─── Perfiles ───
  const { data: perfiles } = await admin
    .from('perfiles')
    .select('id, nombre, apellido')
    .in('id', usuarioIds)
  const mapaPerfiles = new Map((perfiles ?? []).map(p => [p.id, p as { id: string; nombre: string; apellido: string }]))

  // ─── Contratos vigentes ───
  let queryContratos = admin
    .from('contratos_laborales')
    .select('id, miembro_id, modalidad_calculo, monto_base, frecuencia_pago, regimen, condicion, fecha_inicio, sector_id, turno_id')
    .eq('empresa_id', empresaId)
    .in('miembro_id', miembroIds)
    .eq('vigente', true)
  if (filtroSector.length > 0) queryContratos = queryContratos.in('sector_id', filtroSector)
  if (filtroTurno.length > 0) queryContratos = queryContratos.in('turno_id', filtroTurno)
  if (filtroModalidad.length > 0) queryContratos = queryContratos.in('modalidad_calculo', filtroModalidad)
  if (filtroRegimen.length > 0) queryContratos = queryContratos.in('regimen', filtroRegimen)

  const { data: contratos } = await queryContratos
  const mapaContratos = new Map((contratos ?? []).map(c => [c.miembro_id, c as ContratoVista]))

  // ─── Sector y turno (catálogos) ───
  const sectorIds = (contratos ?? []).map(c => c.sector_id).filter((s): s is string => !!s)
  const turnoIds = (contratos ?? []).map(c => c.turno_id).filter((t): t is string => !!t)

  const { data: sectoresData } = sectorIds.length > 0
    ? await admin.from('sectores').select('id, nombre, color').in('id', sectorIds)
    : { data: [] as Array<{ id: string; nombre: string; color: string }> }
  const mapaSectores = new Map((sectoresData ?? []).map(s => [s.id, s as { id: string; nombre: string; color: string }]))

  const { data: turnosData } = turnoIds.length > 0
    ? await admin.from('turnos_laborales').select('id, nombre').in('id', turnoIds)
    : { data: [] as Array<{ id: string; nombre: string }> }
  const mapaTurnos = new Map((turnosData ?? []).map(t => [t.id, t as { id: string; nombre: string }]))

  // ─── Armar respuesta ───
  const hayFiltrosDeContrato =
    filtroSector.length > 0 || filtroTurno.length > 0 || filtroModalidad.length > 0 || filtroRegimen.length > 0

  const empleados: FilaEmpleado[] = miembros
    .map(m => {
      const perfil = m.usuario_id ? mapaPerfiles.get(m.usuario_id) : null
      const contrato = mapaContratos.get(m.id) ?? null
      const sector = contrato?.sector_id ? mapaSectores.get(contrato.sector_id) ?? null : null
      const turno = contrato?.turno_id ? mapaTurnos.get(contrato.turno_id) ?? null : null
      return {
        miembro_id: m.id,
        nombre: perfil?.nombre ?? '—',
        apellido: perfil?.apellido ?? '',
        numero_empleado: m.numero_empleado,
        contrato,
        sector,
        turno,
      }
    })
    // Si hay filtros de contrato, esconder empleados sin contrato vigente
    // (la consulta de contratos ya devolvió solo los que matchean).
    .filter(e => (hayFiltrosDeContrato ? !!e.contrato : true))

  return NextResponse.json({ empleados })
}

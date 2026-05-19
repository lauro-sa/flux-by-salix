import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { obtenerIdentidadMiembro } from '@/lib/miembros/identidad'
import { formatearFechaISO } from '@/lib/formato-fecha'

/**
 * GET /api/miembros/[id]/panel-resumen
 *
 * Devuelve datos consolidados del miembro para el panel lateral de WhatsApp
 * cuando audiencia=empleados (componente PanelInfoEmpleado): identidad, puesto,
 * sector primario, turno asignado, fichaje del día y flags de configuración.
 *
 * Las columnas `puesto_id` y `turno_id` de la tabla `miembros` no tienen FK
 * formal en Postgres (solo en Drizzle), por eso traemos puesto y turno con
 * queries separadas — el embed PostgREST (`puesto:puestos!puesto_id(...)`)
 * fallaría con "Could not find a relationship".
 *
 * Permiso requerido: `usuarios:ver`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('usuarios', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // 1) Miembro (sin embeds — las FK a puestos/turnos no están registradas en Postgres)
    const { data: miembro, error: errMiembro } = await admin
      .from('miembros')
      .select(`
        id, empresa_id, usuario_id, rol, activo,
        puesto_id, turno_id,
        metodo_fichaje, fichaje_auto_movil,
        kiosco_rfid, kiosco_pin,
        salix_ia_web, salix_ia_whatsapp, nivel_salix
      `)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (errMiembro || !miembro) {
      return NextResponse.json(
        { error: 'Miembro no encontrado', detalle: errMiembro?.message ?? null },
        { status: 404 },
      )
    }

    // 2) Queries en paralelo: puesto, turno, sector primario, identidad, empresa.tz
    const [puestoRes, turnoRes, sectorRes, identidad, empresaRes] = await Promise.all([
      miembro.puesto_id
        ? admin.from('puestos')
            .select('id, nombre, color, icono')
            .eq('id', miembro.puesto_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      miembro.turno_id
        ? admin.from('turnos_laborales')
            .select('id, nombre, flexible')
            .eq('id', miembro.turno_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // sectores SÍ tiene FK declarada en miembros_sectores → embed funciona
      admin.from('miembros_sectores')
        .select('sector:sectores!sector_id(id, nombre, color, icono)')
        .eq('miembro_id', id)
        .eq('es_primario', true)
        .maybeSingle(),
      obtenerIdentidadMiembro(admin, miembro, empresaId),
      admin.from('empresas')
        .select('zona_horaria')
        .eq('id', empresaId)
        .maybeSingle(),
    ])

    // 3) Fichaje del día — calculado en la zona horaria de la empresa
    //    (el server corre en UTC; sin esto en Argentina pasa al día siguiente 21:00).
    const tz = empresaRes.data?.zona_horaria || 'America/Argentina/Buenos_Aires'
    const hoy = formatearFechaISO(new Date(), tz)

    const { data: asistenciaHoy } = await admin
      .from('asistencias')
      .select('id, fecha, hora_entrada, hora_salida, estado, estado_clave, tipo, metodo_registro')
      .eq('miembro_id', id)
      .eq('empresa_id', empresaId)
      .eq('fecha', hoy)
      .maybeSingle()

    return NextResponse.json({
      id: miembro.id,
      rol: miembro.rol,
      activo: miembro.activo,
      nombre: identidad?.nombre ?? '',
      apellido: identidad?.apellido ?? '',
      correo: identidad?.correo ?? null,
      correo_empresa: identidad?.correo_empresa ?? null,
      telefono: identidad?.telefono ?? null,
      telefono_empresa: identidad?.telefono_empresa ?? null,
      // Laboral
      puesto: puestoRes.data ?? null,
      sector: sectorRes.data?.sector ?? null,
      turno: turnoRes.data ?? null,
      // Configuración / accesos
      metodo_fichaje: miembro.metodo_fichaje,
      fichaje_auto_movil: miembro.fichaje_auto_movil,
      tiene_kiosco_rfid: !!miembro.kiosco_rfid,
      tiene_kiosco_pin: !!miembro.kiosco_pin,
      salix_ia_web: miembro.salix_ia_web,
      salix_ia_whatsapp: miembro.salix_ia_whatsapp,
      nivel_salix: miembro.nivel_salix,
      asistencia_hoy: asistenciaHoy ?? null,
      zona_horaria: tz,
    })
  } catch (e) {
    const detalle = e instanceof Error ? e.message : null
    return NextResponse.json({ error: 'Error interno', detalle }, { status: 500 })
  }
}

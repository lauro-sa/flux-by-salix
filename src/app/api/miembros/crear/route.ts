import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'

/**
 * POST /api/miembros/crear — Admin carga un empleado completo sin cuenta Flux.
 * El empleado queda con usuario_id=null, activo=true → puede fichar en kiosco.
 * Si después se registra con el mismo correo, /api/auth/registro vincula
 * automáticamente el usuario_id en este miembro (no se duplica).
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Solo propietario o administrador pueden cargar empleados
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso para crear empleados' }, { status: 403 })
    }

    const body = await request.json()
    const {
      nombre,
      apellido,
      correo,
      telefono,
      fecha_nacimiento,
      documento_numero,
      rol = 'empleado',
      numero_empleado,
      puesto_id,
      puesto_nombre,
      sector,
      compensacion_tipo,
      compensacion_monto,
      compensacion_frecuencia,
      dias_trabajo,
      horario_tipo,
      turno_id,
      metodo_fichaje,
      kiosco_rfid,
      kiosco_pin,
      fecha_ingreso, // opcional — permite dar de alta retroactiva
    } = body

    if (!nombre || !apellido) {
      return NextResponse.json({ error: 'Nombre y apellido son obligatorios' }, { status: 400 })
    }

    const correoNormalizado = correo ? String(correo).toLowerCase().trim() : null

    // Si llega correo, verificar que no haya otro miembro en esta empresa con ese
    // correo (ya sea vinculado o como contacto tipo equipo con miembro).
    if (correoNormalizado) {
      const { data: contactoExistente } = await admin
        .from('contactos')
        .select('id, miembro_id')
        .eq('empresa_id', empresaId)
        .eq('correo', correoNormalizado)
        .not('miembro_id', 'is', null)
        .maybeSingle()

      if (contactoExistente) {
        return NextResponse.json(
          { error: 'Ya existe un empleado con ese correo en esta empresa' },
          { status: 409 }
        )
      }
    }

    // Crear miembro con usuario_id=null (solo fichaje hasta que reclame cuenta).
    // Si llega `fecha_ingreso` la usamos como `unido_en` para permitir altas
    // retroactivas (el admin carga un empleado que ya trabaja hace días/meses
    // y después carga sus fichadas manuales).
    const unidoEn = fecha_ingreso
      ? new Date(`${fecha_ingreso}T00:00:00`).toISOString()
      : undefined

    const insertMiembro: Record<string, unknown> = {
      usuario_id: null,
      empresa_id: empresaId,
      rol,
      activo: true,
      numero_empleado: numero_empleado ?? null,
      puesto_id: puesto_id ?? null,
      puesto_nombre: puesto_nombre ?? null,
      sector: sector ?? null,
      compensacion_tipo: compensacion_tipo ?? 'fijo',
      compensacion_monto: compensacion_monto ?? 0,
      compensacion_frecuencia: compensacion_frecuencia ?? 'mensual',
      dias_trabajo: dias_trabajo ?? 5,
      horario_tipo: horario_tipo ?? null,
      turno_id: turno_id ?? null,
      metodo_fichaje: metodo_fichaje ?? 'kiosco',
      kiosco_rfid: kiosco_rfid ?? null,
      kiosco_pin: kiosco_pin ?? null,
      fecha_nacimiento: fecha_nacimiento ?? null,
    }
    if (unidoEn) insertMiembro.unido_en = unidoEn

    const { data: nuevoMiembro, error: errorMiembro } = await admin
      .from('miembros')
      .insert(insertMiembro)
      .select('id')
      .single()

    if (errorMiembro || !nuevoMiembro) {
      return NextResponse.json({ error: 'Error al crear el empleado' }, { status: 500 })
    }

    // Crear contacto tipo equipo con los datos — así se muestra en /contactos,
    // y cuando el empleado se registre el endpoint de registro lo encuentra
    // por correo y vincula el usuario_id en este mismo miembro.
    await vincularOCrearContactoEquipo(admin, {
      miembroId: nuevoMiembro.id,
      empresaId,
      correo: correoNormalizado ?? '',
      nombre: `${nombre} ${apellido}`.trim(),
      usuarioId: user.id,
    })

    // Completar datos del contacto recién creado (teléfono, fecha_nacimiento,
    // documento) para que el registro del empleado los herede al perfil.
    if (telefono || fecha_nacimiento || documento_numero) {
      await admin
        .from('contactos')
        .update({
          telefono: telefono ?? null,
          fecha_nacimiento: fecha_nacimiento ?? null,
          documento_numero: documento_numero ?? null,
        })
        .eq('miembro_id', nuevoMiembro.id)
        .eq('empresa_id', empresaId)
    }

    return NextResponse.json({
      miembro_id: nuevoMiembro.id,
      mensaje: 'Empleado creado. Puede fichar en kiosco; envialé una invitación para que acceda a Flux.',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'
import { normalizarTelefono } from '@/lib/validaciones'

/**
 * POST /api/miembros/crear — Admin carga un empleado completo sin cuenta Flux.
 * El empleado queda con usuario_id=null, activo=true → puede fichar en kiosco.
 * Si después se registra con el mismo correo, /api/auth/registro vincula
 * automáticamente el usuario_id en este miembro (no se duplica).
 */
export async function POST(request: NextRequest) {
  try {
    // Requiere usuarios:invitar. Por default lo tienen propietario y admin,
    // pero con esto un rol con custom "usuarios:invitar" también puede crear.
    const guard = await requerirPermisoAPI('usuarios', 'invitar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const body = await request.json()
    const {
      nombre,
      apellido,
      correo,
      telefono,
      fecha_nacimiento,
      documento_numero,
      rol = 'colaborador',
      numero_empleado,
      puesto_id,
      sector_id,
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

    // Si no llega número de empleado, auto-asignar el siguiente disponible
    // para la empresa (max + 1). Los legajos arrancan en 1 (propietario).
    let numeroEmpleadoFinal: number = numero_empleado ?? 0
    if (!numeroEmpleadoFinal) {
      const { data: ultimoMiembro } = await admin
        .from('miembros')
        .select('numero_empleado')
        .eq('empresa_id', empresaId)
        .order('numero_empleado', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      numeroEmpleadoFinal = (ultimoMiembro?.numero_empleado ?? 0) + 1
    }

    const insertMiembro: Record<string, unknown> = {
      usuario_id: null,
      empresa_id: empresaId,
      rol,
      activo: true,
      numero_empleado: numeroEmpleadoFinal,
      puesto_id: puesto_id ?? null,
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
      console.error('[/api/miembros/crear] Error al insertar miembro:', errorMiembro)
      return NextResponse.json({ error: errorMiembro?.message || 'Error al crear el empleado' }, { status: 500 })
    }

    // Vincular el sector en la tabla relación (miembros_sectores).
    // Es la fuente única de verdad para el sector del miembro.
    if (sector_id) {
      await admin.from('miembros_sectores').insert({
        miembro_id: nuevoMiembro.id,
        sector_id,
        es_primario: true,
      })
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

    // Completar datos del contacto recién creado.
    // - fecha_nacimiento / documento_numero: directo en `contactos` (no son sincronizados por trigger).
    // - telefono: se inserta en `contacto_telefonos` con origen='manual'. Cuando el empleado se
    //   registre y cree su perfil, el trigger sync_perfil_a_contactos verá la fila manual ya
    //   existente con ese valor y NO duplicará la sync.
    if (fecha_nacimiento || documento_numero) {
      await admin
        .from('contactos')
        .update({
          fecha_nacimiento: fecha_nacimiento ?? null,
          documento_numero: documento_numero ?? null,
        })
        .eq('miembro_id', nuevoMiembro.id)
        .eq('empresa_id', empresaId)
    }
    if (telefono) {
      const telNorm = normalizarTelefono(telefono)
      if (telNorm) {
        const { data: contactoEq } = await admin
          .from('contactos')
          .select('id')
          .eq('miembro_id', nuevoMiembro.id)
          .eq('empresa_id', empresaId)
          .maybeSingle()
        if (contactoEq) {
          await admin.from('contacto_telefonos').insert({
            empresa_id: empresaId,
            contacto_id: contactoEq.id,
            tipo: 'movil',
            valor: telNorm,
            es_whatsapp: true,
            es_principal: true,
            orden: 0,
            origen: 'manual',
            creado_por: user.id,
          })
        }
      }
    }

    return NextResponse.json({
      miembro_id: nuevoMiembro.id,
      mensaje: 'Empleado creado. Puede fichar en kiosco; envialé una invitación para que acceda a Flux.',
    })
  } catch (error) {
    console.error('[/api/miembros/crear] Error inesperado:', error)
    const mensaje = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

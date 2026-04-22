import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/registro — Crear cuenta nueva.
 * Crea el usuario en Supabase Auth y el perfil en la tabla perfiles.
 * Auto-vincula con miembros pre-cargados si encuentra un contacto de equipo
 * con el mismo correo (importados de otra BD).
 * También acepta invitaciones pendientes automáticamente.
 */
export async function POST(request: NextRequest) {
  try {
    const { correo, contrasena, nombre, apellido } = await request.json()

    if (!correo || !contrasena || !nombre || !apellido) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 }
      )
    }

    if (contrasena.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await crearClienteServidor()

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password: contrasena,
      options: {
        data: { nombre, apellido },
        emailRedirectTo: `${request.nextUrl.origin}/api/auth/callback`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
    }

    const admin = crearClienteAdmin()
    const userId = data.user.id
    const correoNormalizado = correo.toLowerCase().trim()

    // Crear perfil con el service role (bypass RLS)
    const { error: errorPerfil } = await admin
      .from('perfiles')
      .insert({ id: userId, nombre, apellido, correo: correoNormalizado })

    if (errorPerfil) {
      console.error('Error creando perfil:', errorPerfil)
    }

    // ── Auto-vinculación: buscar contactos de equipo con este correo ──
    let autoVinculados = 0

    // Fase A: miembros pre-cargados por el admin (usuario_id=null) que ya
    // tienen un contacto tipo "equipo" con este correo. Vinculamos el
    // usuario_id en el miembro existente — NO creamos uno nuevo, así se
    // preservan legajo, RFID, puesto, compensación, historial de fichadas.
    const { data: contactosConMiembroPendiente } = await admin
      .from('contactos')
      .select('id, empresa_id, miembro_id, miembros!inner(id, usuario_id, activo)')
      .eq('correo', correoNormalizado)
      .eq('en_papelera', false)
      .not('miembro_id', 'is', null)
      .is('miembros.usuario_id', null)

    if (contactosConMiembroPendiente && contactosConMiembroPendiente.length > 0) {
      for (const contacto of contactosConMiembroPendiente) {
        // Vincular usuario_id al miembro pendiente
        const { error: errorVincular } = await admin
          .from('miembros')
          .update({ usuario_id: userId })
          .eq('id', contacto.miembro_id)

        if (!errorVincular) autoVinculados++
      }
    }

    // Fase B (legacy): contactos de equipo importados sin miembro_id.
    // Si el admin pre-cargó usuarios (ej: migración), existirán como contactos
    // tipo "equipo" sin miembro_id. Los vinculamos creando un miembro nuevo.
    const { data: contactosEquipo } = await admin
      .from('contactos')
      .select('id, empresa_id, nombre, apellido')
      .eq('correo', correoNormalizado)
      .is('miembro_id', null)
      .eq('en_papelera', false)

    if (contactosEquipo && contactosEquipo.length > 0) {
      for (const contacto of contactosEquipo) {
        // Verificar que el contacto sea tipo "equipo"
        const { data: tipoEquipo } = await admin
          .from('tipos_contacto')
          .select('id')
          .eq('empresa_id', contacto.empresa_id)
          .eq('clave', 'equipo')
          .single()

        if (!tipoEquipo) continue

        const { data: esEquipo } = await admin
          .from('contactos')
          .select('id')
          .eq('id', contacto.id)
          .eq('tipo_contacto_id', tipoEquipo.id)
          .single()

        if (!esEquipo) continue

        // Verificar que no sea ya miembro de esta empresa
        const { data: yaEsMiembro } = await admin
          .from('miembros')
          .select('id')
          .eq('usuario_id', userId)
          .eq('empresa_id', contacto.empresa_id)
          .maybeSingle()

        if (yaEsMiembro) continue

        // Crear miembro (activo=false, espera activación del admin)
        const { data: nuevoMiembro } = await admin
          .from('miembros')
          .insert({
            usuario_id: userId,
            empresa_id: contacto.empresa_id,
            rol: 'colaborador',
            activo: false,
          })
          .select('id')
          .single()

        if (nuevoMiembro) {
          // Vincular el contacto existente con el nuevo miembro
          await admin
            .from('contactos')
            .update({ miembro_id: nuevoMiembro.id })
            .eq('id', contacto.id)

          // Completar perfil con datos del contacto si el perfil está vacío
          if (contacto.nombre && !nombre) {
            await admin
              .from('perfiles')
              .update({ nombre: contacto.nombre, apellido: contacto.apellido || '' })
              .eq('id', userId)
          }

          autoVinculados++
        }
      }
    }

    // ── Auto-aceptar invitaciones pendientes con este correo ──
    const { data: invitaciones } = await admin
      .from('invitaciones')
      .select('id, empresa_id, rol')
      .eq('correo', correoNormalizado)
      .eq('usado', false)
      .gt('expira_en', new Date().toISOString())

    if (invitaciones && invitaciones.length > 0) {
      for (const inv of invitaciones) {
        // Verificar que no sea ya miembro
        const { data: yaEsMiembro } = await admin
          .from('miembros')
          .select('id')
          .eq('usuario_id', userId)
          .eq('empresa_id', inv.empresa_id)
          .maybeSingle()

        if (yaEsMiembro) {
          // Ya vinculado por contacto de equipo, solo marcar invitación usada
          await admin.from('invitaciones').update({ usado: true }).eq('id', inv.id)
          continue
        }

        // Crear miembro — activo=true porque la invitación ya fue aprobada por el admin
        const { data: nuevoMiembro } = await admin
          .from('miembros')
          .insert({
            usuario_id: userId,
            empresa_id: inv.empresa_id,
            rol: inv.rol,
            activo: true,
          })
          .select('id')
          .single()

        if (nuevoMiembro) {
          // Vincular o crear contacto de equipo
          const { vincularOCrearContactoEquipo } = await import('@/lib/contactos/contacto-equipo')
          await vincularOCrearContactoEquipo(admin, {
            miembroId: nuevoMiembro.id,
            empresaId: inv.empresa_id,
            correo: correoNormalizado,
            nombre: `${nombre} ${apellido}`,
            usuarioId: userId,
          })

          autoVinculados++
        }

        // Marcar invitación como usada
        await admin.from('invitaciones').update({ usado: true }).eq('id', inv.id)
      }
    }

    // Si se auto-vinculó por invitación, setear empresa activa en JWT
    if (autoVinculados > 0) {
      const { data: primerActivo } = await admin
        .from('miembros')
        .select('empresa_id')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .limit(1)
        .maybeSingle()

      if (primerActivo) {
        await admin.auth.admin.updateUserById(userId, {
          app_metadata: { empresa_activa_id: primerActivo.empresa_id },
        })
      } else {
        // Tiene membresías pero ninguna activa (contactos pre-cargados sin invitación)
        await admin.auth.admin.updateUserById(userId, {
          app_metadata: { tiene_membresias: true },
        })
      }
    }

    return NextResponse.json({
      usuario: { id: userId, correo: data.user.email },
      mensaje: autoVinculados > 0
        ? `Cuenta creada y vinculada a ${autoVinculados} empresa${autoVinculados > 1 ? 's' : ''}.`
        : 'Cuenta creada. Revisá tu correo para verificar.',
      auto_vinculado: autoVinculados > 0,
      redirigir: autoVinculados > 0 ? '/dashboard' : undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

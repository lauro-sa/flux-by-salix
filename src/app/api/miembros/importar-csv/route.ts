import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'
import { normalizarTelefono } from '@/lib/validaciones'

/**
 * POST /api/miembros/importar-csv — Carga masiva de empleados.
 *
 * Acepta un array `filas` con los datos ya parseados (el CSV se parsea en el
 * cliente). Cada fila puede incluir: nombre, apellido, correo, telefono, rol,
 * numero_empleado, sector_nombre, puesto_nombre, kiosco_rfid, kiosco_pin,
 * metodo_fichaje.
 *
 * El endpoint intenta crear cada empleado. Devuelve un reporte con:
 *   { creados: N, errores: [{ fila, motivo }] }
 * para que el cliente pueda mostrar el detalle sin fallar todo el lote.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'invitar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const body = await request.json()
    const filas: Record<string, string>[] = Array.isArray(body?.filas) ? body.filas : []

    if (filas.length === 0) {
      return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return NextResponse.json({ error: 'El lote máximo es de 500 filas por importación' }, { status: 400 })
    }

    // Pre-cargar sectores y puestos para resolver por nombre a id
    const [{ data: sectoresData }, { data: puestosData }] = await Promise.all([
      admin.from('sectores').select('id, nombre').eq('empresa_id', empresaId).eq('activo', true),
      admin.from('puestos').select('id, nombre').eq('empresa_id', empresaId).eq('activo', true),
    ])
    const sectorPorNombre = new Map((sectoresData || []).map(s => [s.nombre.toLowerCase().trim(), s]))
    const puestoPorNombre = new Map((puestosData || []).map(p => [p.nombre.toLowerCase().trim(), p]))

    let creados = 0
    const errores: { fila: number; motivo: string }[] = []

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]
      const numFila = i + 1

      const nombre = (fila.nombre || '').trim()
      const apellido = (fila.apellido || '').trim()
      if (!nombre || !apellido) {
        errores.push({ fila: numFila, motivo: 'Nombre y apellido son obligatorios' })
        continue
      }

      const correo = (fila.correo || '').toLowerCase().trim()

      // Si trae correo, evitar duplicar empleado en la misma empresa
      if (correo) {
        const { data: contactoExistente } = await admin
          .from('contactos')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('correo', correo)
          .not('miembro_id', 'is', null)
          .maybeSingle()
        if (contactoExistente) {
          errores.push({ fila: numFila, motivo: `Ya existe un empleado con el correo ${correo}` })
          continue
        }
      }

      const rol = ['propietario', 'administrador', 'gestor', 'vendedor', 'supervisor', 'colaborador', 'invitado']
        .includes((fila.rol || '').toLowerCase().trim())
        ? (fila.rol || '').toLowerCase().trim()
        : 'colaborador'

      const sectorNombre = (fila.sector_nombre || fila.sector || '').toLowerCase().trim()
      const puestoNombre = (fila.puesto_nombre || fila.puesto || '').toLowerCase().trim()
      const sector = sectorNombre ? sectorPorNombre.get(sectorNombre) : null
      const puesto = puestoNombre ? puestoPorNombre.get(puestoNombre) : null

      const metodoFichaje = ['kiosco', 'automatico', 'manual'].includes((fila.metodo_fichaje || '').toLowerCase().trim())
        ? (fila.metodo_fichaje || '').toLowerCase().trim()
        : 'kiosco'

      const { data: nuevoMiembro, error: errMiembro } = await admin
        .from('miembros')
        .insert({
          usuario_id: null,
          empresa_id: empresaId,
          rol,
          activo: true,
          numero_empleado: fila.numero_empleado ? parseInt(fila.numero_empleado, 10) || null : null,
          puesto_id: puesto?.id || null,
          puesto_nombre: puesto?.nombre || null,
          sector: sector?.nombre || null,
          metodo_fichaje: metodoFichaje,
          kiosco_rfid: (fila.kiosco_rfid || fila.rfid || '').trim() || null,
          kiosco_pin: (fila.kiosco_pin || fila.pin || '').trim() || null,
        })
        .select('id')
        .single()

      if (errMiembro || !nuevoMiembro) {
        errores.push({ fila: numFila, motivo: 'Error creando miembro en la base' })
        continue
      }

      await vincularOCrearContactoEquipo(admin, {
        miembroId: nuevoMiembro.id,
        empresaId,
        correo,
        nombre: `${nombre} ${apellido}`,
        usuarioId: user.id,
      })

      // Completar datos adicionales del contacto
      const telefono = normalizarTelefono((fila.telefono || '').trim())
      if (telefono) {
        await admin
          .from('contactos')
          .update({ telefono })
          .eq('miembro_id', nuevoMiembro.id)
          .eq('empresa_id', empresaId)
      }

      creados++
    }

    return NextResponse.json({ creados, total: filas.length, errores })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

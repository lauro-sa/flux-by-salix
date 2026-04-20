/**
 * Ejecutor: consultar_equipo
 * Consulta los miembros del equipo: nombres, roles, puestos, contacto.
 * Solo disponible para usuarios con ver_todos en el módulo correspondiente.
 * Para visibilidad 'propio', devuelve solo info del usuario actual.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarConsultarEquipo(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'asistencias')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver información del equipo' }
  }

  const busqueda = (params.busqueda as string)?.trim()

  // Obtener miembros activos de la empresa
  let queryMiembros = ctx.admin
    .from('miembros')
    .select('id, usuario_id, rol, puesto_nombre, sector, activo, numero_empleado, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo, horario_tipo, horario_flexible, metodo_fichaje, fecha_nacimiento, unido_en')
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)
    .order('unido_en', { ascending: true })

  // Si solo puede ver los propios, filtrar
  if (visibilidad === 'propio') {
    queryMiembros = queryMiembros.eq('usuario_id', ctx.usuario_id)
  }

  const { data: miembros, error } = await queryMiembros

  if (error) {
    return { exito: false, error: `Error consultando equipo: ${error.message}` }
  }

  if (!miembros || miembros.length === 0) {
    return { exito: true, datos: [], mensaje_usuario: 'No se encontraron miembros activos.' }
  }

  // Obtener perfiles (nombre, apellido, correo) — queries separadas
  const usuarioIds = miembros.map((m: { usuario_id: string | null }) => m.usuario_id).filter((x: string | null): x is string => !!x)
  const { data: perfiles } = usuarioIds.length > 0
    ? await ctx.admin
        .from('perfiles')
        .select('id, nombre, apellido, correo, telefono, avatar_url')
        .in('id', usuarioIds)
    : { data: [] as Array<{ id: string; nombre: string | null; apellido: string | null; correo: string | null; telefono: string | null }> }

  const perfilesMap = new Map<string, { nombre: string; apellido: string; correo: string | null; telefono: string | null }>()
  for (const p of (perfiles || [])) {
    perfilesMap.set(p.id, {
      nombre: p.nombre || '',
      apellido: p.apellido || '',
      correo: p.correo || null,
      telefono: p.telefono || null,
    })
  }

  // Fallback a contacto equipo para miembros sin cuenta Flux (kiosco)
  const miembroIds = miembros.map((m: { id: string }) => m.id)
  const { data: contactosEquipo } = miembroIds.length > 0
    ? await ctx.admin
        .from('contactos')
        .select('miembro_id, nombre, apellido, correo, telefono')
        .in('miembro_id', miembroIds)
        .eq('en_papelera', false)
    : { data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null; correo: string | null; telefono: string | null }> }

  const contactoEquipoMap = new Map<string, { nombre: string; apellido: string; correo: string | null; telefono: string | null }>()
  for (const c of (contactosEquipo || [])) {
    if (!c.miembro_id) continue
    contactoEquipoMap.set(c.miembro_id, {
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      correo: c.correo || null,
      telefono: c.telefono || null,
    })
  }

  const rolTraducido: Record<string, string> = {
    propietario: 'Propietario',
    administrador: 'Administrador',
    gestor: 'Gestor',
    vendedor: 'Vendedor',
    supervisor: 'Supervisor',
    empleado: 'Empleado',
    invitado: 'Invitado',
  }

  let equipo = miembros.map((m: {
    id: string
    usuario_id: string
    rol: string
    puesto_nombre: string | null
    sector: string | null
    numero_empleado: number | null
    compensacion_tipo: string | null
    compensacion_monto: number | null
    compensacion_frecuencia: string | null
    dias_trabajo: number | null
    horario_tipo: string | null
    horario_flexible: boolean
    metodo_fichaje: string | null
    fecha_nacimiento: string | null
    unido_en: string
  }) => {
    const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : undefined
    const contactoEquipo = contactoEquipoMap.get(m.id)
    const fuenteNombre = perfil && (perfil.nombre || perfil.apellido) ? perfil : contactoEquipo
    const nombreCompleto = fuenteNombre
      ? [fuenteNombre.nombre, fuenteNombre.apellido].filter(Boolean).join(' ') || 'Sin nombre'
      : 'Sin nombre'

    return {
      miembro_id: m.id,
      usuario_id: m.usuario_id,
      nombre: nombreCompleto,
      rol: rolTraducido[m.rol] || m.rol,
      rol_clave: m.rol,
      puesto: m.puesto_nombre || null,
      sector: m.sector || null,
      correo: perfil?.correo || contactoEquipo?.correo || null,
      telefono: perfil?.telefono || contactoEquipo?.telefono || null,
      numero_empleado: m.numero_empleado,
      compensacion: m.compensacion_monto ? {
        tipo: m.compensacion_tipo,
        monto: m.compensacion_monto,
        frecuencia: m.compensacion_frecuencia,
      } : null,
      horario: m.horario_tipo || null,
      horario_flexible: m.horario_flexible,
      metodo_fichaje: m.metodo_fichaje || null,
      fecha_nacimiento: m.fecha_nacimiento || null,
      desde: m.unido_en,
    }
  })

  // Filtrar por búsqueda si hay
  if (busqueda) {
    const busqLower = busqueda.toLowerCase()
    equipo = equipo.filter((m: { nombre: string; rol: string; puesto: string | null; sector: string | null; correo: string | null }) => {
      const texto = [m.nombre, m.rol, m.puesto, m.sector, m.correo].filter(Boolean).join(' ').toLowerCase()
      return texto.includes(busqLower)
    })
  }

  // Formatear mensaje
  const lineas: string[] = [`*Equipo de ${ctx.nombre_empresa} (${equipo.length}):*`, '']
  for (const m of equipo) {
    let linea = `*${m.nombre}*`
    linea += ` — ${m.rol}`
    if (m.puesto) linea += ` _(${m.puesto})_`
    if (m.sector) linea += ` · ${m.sector}`
    lineas.push(linea)
    const detalles: string[] = []
    if (m.correo) detalles.push(m.correo)
    if (m.telefono) detalles.push(m.telefono)
    if (detalles.length > 0) lineas.push(`  ${detalles.join(' · ')}`)
  }

  return {
    exito: true,
    datos: equipo,
    mensaje_usuario: equipo.length === 0
      ? `No encontré miembros${busqueda ? ` con "${busqueda}"` : ''}.`
      : lineas.join('\n'),
  }
}

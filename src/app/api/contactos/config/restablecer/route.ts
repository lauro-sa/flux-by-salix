import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/** Datos predefinidos para restablecer */
const ETIQUETAS_DEFAULT = [
  { nombre: 'VIP', color: 'advertencia', orden: 1 },
  { nombre: 'Prioritario', color: 'peligro', orden: 2 },
  { nombre: 'Frecuente', color: 'exito', orden: 3 },
  { nombre: 'Nuevo', color: 'info', orden: 4 },
  { nombre: 'Inactivo', color: 'neutro', orden: 5 },
]

const RUBROS_DEFAULT = [
  'Construcción', 'Tecnología', 'Comercio', 'Servicios', 'Industria',
  'Salud', 'Educación', 'Inmobiliaria', 'Gastronomía', 'Transporte',
]

const PUESTOS_DEFAULT = [
  'Encargado', 'Propietario', 'Administrador', 'Técnico', 'Inquilino',
  'Empleado', 'Gerente', 'Director', 'Mantenimiento', 'Socio', 'Consejo',
]

const RELACIONES_DEFAULT = [
  { clave: 'empleado_de', etiqueta: 'Empleado de', etiqueta_inversa: 'Empleador de' },
  { clave: 'administra', etiqueta: 'Administra', etiqueta_inversa: 'Administrado por' },
  { clave: 'provee_a', etiqueta: 'Provee a', etiqueta_inversa: 'Proveído por' },
  { clave: 'propietario_de', etiqueta: 'Propietario de', etiqueta_inversa: 'Propiedad de' },
  { clave: 'inquilino_de', etiqueta: 'Inquilino de', etiqueta_inversa: 'Alquila a' },
  { clave: 'socio_de', etiqueta: 'Socio de', etiqueta_inversa: 'Socio de' },
  { clave: 'contacto_de', etiqueta: 'Contacto de', etiqueta_inversa: 'Contacto de' },
]

/**
 * POST /api/contactos/config/restablecer — Restablecer con migración inteligente.
 * Body: {
 *   tipo: 'etiqueta' | 'rubro' | 'puesto' | 'relacion' | 'todos',
 *   mapeos?: Record<string, string>  // { "nombreViejo": "nombreNuevo" | "__eliminar__" | "__mantener__" }
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const tipo = body.tipo || 'todos'
    const mapeos: Record<string, string> = body.mapeos || {}
    const admin = crearClienteAdmin()

    // ── Etiquetas ──
    if (tipo === 'etiqueta' || tipo === 'todos') {
      // Aplicar mapeos en contactos (etiquetas es un array de texto)
      if (Object.keys(mapeos).length > 0) {
        const { data: contactos } = await admin
          .from('contactos')
          .select('id, etiquetas')
          .eq('empresa_id', empresaId)
          .not('etiquetas', 'is', null)

        for (const contacto of contactos || []) {
          const etiquetasOriginales: string[] = contacto.etiquetas || []
          let modificado = false
          const etiquetasNuevas = etiquetasOriginales
            .map((e: string) => {
              if (mapeos[e]) {
                modificado = true
                if (mapeos[e] === '__eliminar__') return null
                if (mapeos[e] === '__mantener__') return e
                return mapeos[e]
              }
              return e
            })
            .filter((e: string | null): e is string => e !== null)

          // Eliminar duplicados
          const etiquetasUnicas = [...new Set(etiquetasNuevas)]

          if (modificado) {
            await admin
              .from('contactos')
              .update({ etiquetas: etiquetasUnicas })
              .eq('id', contacto.id)
          }
        }
      }

      // Borrar etiquetas actuales y cargar predefinidos
      await admin.from('etiquetas_contacto').delete().eq('empresa_id', empresaId)
      for (const e of ETIQUETAS_DEFAULT) {
        await admin.from('etiquetas_contacto')
          .insert({ empresa_id: empresaId, nombre: e.nombre, color: e.color, orden: e.orden, activa: true })
      }

      // Re-agregar las que el usuario pidió mantener
      const mantenidas = Object.entries(mapeos)
        .filter(([, destino]) => destino === '__mantener__')
        .map(([nombre]) => nombre)

      for (let i = 0; i < mantenidas.length; i++) {
        const yaExiste = ETIQUETAS_DEFAULT.find(e => e.nombre === mantenidas[i])
        if (!yaExiste) {
          await admin.from('etiquetas_contacto')
            .insert({ empresa_id: empresaId, nombre: mantenidas[i], color: 'neutro', orden: ETIQUETAS_DEFAULT.length + i + 1, activa: true })
        }
      }
    }

    // ── Rubros ──
    if (tipo === 'rubro' || tipo === 'todos') {
      // Aplicar mapeos en contactos (rubro es texto plano)
      if (Object.keys(mapeos).length > 0) {
        for (const [viejo, nuevo] of Object.entries(mapeos)) {
          if (nuevo === '__eliminar__') {
            await admin
              .from('contactos')
              .update({ rubro: null })
              .eq('empresa_id', empresaId)
              .eq('rubro', viejo)
          } else if (nuevo !== '__mantener__') {
            await admin
              .from('contactos')
              .update({ rubro: nuevo })
              .eq('empresa_id', empresaId)
              .eq('rubro', viejo)
          }
        }
      }

      // Borrar rubros actuales y cargar predefinidos
      await admin.from('rubros_contacto').delete().eq('empresa_id', empresaId)
      for (let i = 0; i < RUBROS_DEFAULT.length; i++) {
        await admin.from('rubros_contacto')
          .insert({ empresa_id: empresaId, nombre: RUBROS_DEFAULT[i], orden: i + 1, activo: true })
      }

      // Re-agregar los mantenidos
      const mantenidos = Object.entries(mapeos)
        .filter(([, destino]) => destino === '__mantener__')
        .map(([nombre]) => nombre)

      for (let i = 0; i < mantenidos.length; i++) {
        if (!RUBROS_DEFAULT.includes(mantenidos[i])) {
          await admin.from('rubros_contacto')
            .insert({ empresa_id: empresaId, nombre: mantenidos[i], orden: RUBROS_DEFAULT.length + i + 1, activo: true })
        }
      }
    }

    // ── Puestos ──
    if (tipo === 'puesto' || tipo === 'todos') {
      // Aplicar mapeos en vinculaciones (puesto es texto libre)
      if (Object.keys(mapeos).length > 0) {
        for (const [viejo, nuevo] of Object.entries(mapeos)) {
          if (nuevo === '__eliminar__') {
            await admin
              .from('contacto_vinculaciones')
              .update({ puesto: null })
              .eq('empresa_id', empresaId)
              .eq('puesto', viejo)
          } else if (nuevo !== '__mantener__') {
            await admin
              .from('contacto_vinculaciones')
              .update({ puesto: nuevo })
              .eq('empresa_id', empresaId)
              .eq('puesto', viejo)
          }
        }
      }

      // Borrar puestos actuales y cargar predefinidos
      await admin.from('puestos_contacto').delete().eq('empresa_id', empresaId)
      for (let i = 0; i < PUESTOS_DEFAULT.length; i++) {
        await admin.from('puestos_contacto')
          .insert({ empresa_id: empresaId, nombre: PUESTOS_DEFAULT[i], orden: i + 1, activo: true })
      }

      const mantenidos = Object.entries(mapeos)
        .filter(([, destino]) => destino === '__mantener__')
        .map(([nombre]) => nombre)

      for (let i = 0; i < mantenidos.length; i++) {
        if (!PUESTOS_DEFAULT.includes(mantenidos[i])) {
          await admin.from('puestos_contacto')
            .insert({ empresa_id: empresaId, nombre: mantenidos[i], orden: PUESTOS_DEFAULT.length + i + 1, activo: true })
        }
      }
    }

    // ── Relaciones ──
    if (tipo === 'relacion' || tipo === 'todos') {
      // Para relaciones, los mapeos usan el id como clave
      if (Object.keys(mapeos).length > 0) {
        for (const [idViejo, destino] of Object.entries(mapeos)) {
          if (destino === '__eliminar__') {
            // Poner null en las vinculaciones que usaban esta relación
            await admin
              .from('contacto_vinculaciones')
              .update({ tipo_relacion_id: null })
              .eq('tipo_relacion_id', idViejo)
          } else if (destino !== '__mantener__' && destino !== '__eliminar__') {
            // Reasignar al nuevo tipo de relación
            await admin
              .from('contacto_vinculaciones')
              .update({ tipo_relacion_id: destino })
              .eq('tipo_relacion_id', idViejo)
          }
        }
      }

      // Borrar relaciones no mantenidas y cargar predefinidos
      const mantenidos = Object.entries(mapeos)
        .filter(([, destino]) => destino === '__mantener__')
        .map(([id]) => id)

      // Borrar las que no se mantienen
      if (mantenidos.length > 0) {
        await admin.from('tipos_relacion')
          .delete()
          .eq('empresa_id', empresaId)
          .not('id', 'in', `(${mantenidos.join(',')})`)
      } else {
        await admin.from('tipos_relacion').delete().eq('empresa_id', empresaId)
      }

      // Insertar predefinidos
      for (const r of RELACIONES_DEFAULT) {
        await admin.from('tipos_relacion')
          .upsert({
            empresa_id: empresaId,
            clave: r.clave,
            etiqueta: r.etiqueta,
            etiqueta_inversa: r.etiqueta_inversa,
            es_predefinido: true,
            activo: true,
          }, { onConflict: 'empresa_id,clave' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en restablecer:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

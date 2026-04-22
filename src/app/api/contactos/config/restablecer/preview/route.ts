import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const ETIQUETAS_DEFAULT = ['VIP', 'Prioritario', 'Frecuente', 'Nuevo', 'Inactivo']
const RUBROS_DEFAULT = ['Construcción', 'Tecnología', 'Comercio', 'Servicios', 'Industria', 'Salud', 'Educación', 'Inmobiliaria', 'Gastronomía', 'Transporte']
const PUESTOS_DEFAULT = ['Encargado', 'Propietario', 'Administrador', 'Técnico', 'Inquilino', 'Empleado', 'Gerente', 'Director', 'Mantenimiento', 'Socio', 'Consejo']
const RELACIONES_DEFAULT_CLAVES = ['empleado_de', 'administra', 'provee_a', 'propietario_de', 'inquilino_de', 'socio_de', 'contacto_de']

interface ContactoAfectado {
  id: string
  nombre: string
  apellido: string
}

interface ItemAfectado {
  nombre: string
  id?: string
  contactos: ContactoAfectado[]
}

/**
 * GET /api/contactos/config/restablecer/preview?tipo=etiqueta|rubro|puesto|relacion
 * Devuelve los items actuales que tienen contactos asignados y no están en los predefinidos.
 */
export async function GET(request: Request) {
  try {
    const guard = await requerirPermisoAPI('config_contactos', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    if (!tipo) return NextResponse.json({ error: 'Falta parámetro tipo' }, { status: 400 })

    const admin = crearClienteAdmin()
    let itemsAfectados: ItemAfectado[] = []
    let itemsActuales: { id: string; nombre: string }[] = []
    let defaultNames: string[] = []

    if (tipo === 'etiqueta') {
      defaultNames = ETIQUETAS_DEFAULT

      // Obtener etiquetas actuales
      const { data: etiquetas } = await admin
        .from('etiquetas_contacto')
        .select('id, nombre')
        .eq('empresa_id', empresaId)

      itemsActuales = etiquetas || []

      // Buscar contactos que usan cada etiqueta actual
      const { data: contactos } = await admin
        .from('contactos')
        .select('id, nombre, apellido, etiquetas')
        .eq('empresa_id', empresaId)
        .not('etiquetas', 'is', null)

      for (const etiqueta of itemsActuales) {
        const contactosConEtiqueta = (contactos || []).filter(
          (c: { etiquetas?: string[] }) => c.etiquetas?.includes(etiqueta.nombre)
        )
        if (contactosConEtiqueta.length > 0) {
          itemsAfectados.push({
            nombre: etiqueta.nombre,
            id: etiqueta.id,
            contactos: contactosConEtiqueta.map((c: { id: string; nombre: string; apellido: string }) => ({
              id: c.id,
              nombre: c.nombre,
              apellido: c.apellido,
            })),
          })
        }
      }
    }

    if (tipo === 'rubro') {
      defaultNames = RUBROS_DEFAULT

      // Obtener rubros actuales
      const { data: rubros } = await admin
        .from('rubros_contacto')
        .select('id, nombre')
        .eq('empresa_id', empresaId)

      itemsActuales = rubros || []

      // Buscar contactos agrupados por rubro
      const { data: contactos } = await admin
        .from('contactos')
        .select('id, nombre, apellido, rubro')
        .eq('empresa_id', empresaId)
        .not('rubro', 'is', null)
        .neq('rubro', '')

      for (const rubro of itemsActuales) {
        const contactosConRubro = (contactos || []).filter(
          (c: { rubro?: string }) => c.rubro === rubro.nombre
        )
        if (contactosConRubro.length > 0) {
          itemsAfectados.push({
            nombre: rubro.nombre,
            id: rubro.id,
            contactos: contactosConRubro.map((c: { id: string; nombre: string; apellido: string }) => ({
              id: c.id,
              nombre: c.nombre,
              apellido: c.apellido,
            })),
          })
        }
      }

      // También buscar contactos con rubros que no están en la tabla de config
      const nombresConfig = (rubros || []).map((r: { nombre: string }) => r.nombre)
      const contactosHuerfanos = (contactos || []).filter(
        (c: { rubro?: string }) => c.rubro && !nombresConfig.includes(c.rubro)
      )
      // Agrupar por rubro
      const rubrosHuerfanos: Record<string, ContactoAfectado[]> = {}
      for (const c of contactosHuerfanos) {
        const r = (c as { rubro: string }).rubro
        if (!rubrosHuerfanos[r]) rubrosHuerfanos[r] = []
        rubrosHuerfanos[r].push({ id: c.id, nombre: c.nombre, apellido: c.apellido })
      }
      for (const [nombre, contactos] of Object.entries(rubrosHuerfanos)) {
        if (!itemsAfectados.find(i => i.nombre === nombre)) {
          itemsAfectados.push({ nombre, contactos })
        }
      }
    }

    if (tipo === 'puesto') {
      defaultNames = PUESTOS_DEFAULT

      // Obtener puestos actuales
      const { data: puestos } = await admin
        .from('puestos_contacto')
        .select('id, nombre')
        .eq('empresa_id', empresaId)

      itemsActuales = puestos || []

      // Buscar vinculaciones que usan cada puesto (texto libre)
      const { data: vinculaciones } = await admin
        .from('contacto_vinculaciones')
        .select('id, puesto, contacto_id, contactos!contacto_vinculaciones_contacto_id_fkey(id, nombre, apellido)')
        .eq('empresa_id', empresaId)
        .not('puesto', 'is', null)
        .neq('puesto', '')

      // Agrupar por puesto
      const porPuesto: Record<string, ContactoAfectado[]> = {}
      for (const v of vinculaciones || []) {
        const registro = v as unknown as { puesto: string; contactos: { id: string; nombre: string; apellido: string } | null }
        const puesto = registro.puesto
        if (!porPuesto[puesto]) porPuesto[puesto] = []
        const contacto = registro.contactos
        if (contacto && !porPuesto[puesto].find(c => c.id === contacto.id)) {
          porPuesto[puesto].push({
            id: contacto.id,
            nombre: contacto.nombre,
            apellido: contacto.apellido,
          })
        }
      }

      for (const [nombre, contactos] of Object.entries(porPuesto)) {
        if (contactos.length > 0) {
          itemsAfectados.push({ nombre, contactos })
        }
      }
    }

    if (tipo === 'relacion') {
      defaultNames = RELACIONES_DEFAULT_CLAVES

      // Obtener relaciones actuales
      const { data: relaciones } = await admin
        .from('tipos_relacion')
        .select('id, clave, etiqueta')
        .eq('empresa_id', empresaId)

      itemsActuales = (relaciones || []).map(r => ({ id: r.id, nombre: r.etiqueta }))

      // Buscar vinculaciones por tipo_relacion_id
      for (const rel of relaciones || []) {
        const { data: vinculaciones } = await admin
          .from('contacto_vinculaciones')
          .select('id, contacto_id, contactos!contacto_vinculaciones_contacto_id_fkey(id, nombre, apellido)')
          .eq('tipo_relacion_id', rel.id)

        const contactosUnicos: ContactoAfectado[] = []
        for (const v of vinculaciones || []) {
          const registro = v as unknown as { contactos: { id: string; nombre: string; apellido: string } | null }
          const contacto = registro.contactos
          if (contacto && !contactosUnicos.find(c => c.id === contacto.id)) {
            contactosUnicos.push({
              id: contacto.id,
              nombre: contacto.nombre,
              apellido: contacto.apellido,
            })
          }
        }

        if (contactosUnicos.length > 0) {
          itemsAfectados.push({
            nombre: rel.etiqueta,
            id: rel.id,
            contactos: contactosUnicos,
          })
        }
      }
    }

    return NextResponse.json({
      tipo,
      itemsActuales,
      itemsAfectados,
      predefinidos: defaultNames,
    })
  } catch (err) {
    console.error('Error en preview restablecer:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

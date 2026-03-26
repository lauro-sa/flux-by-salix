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

/**
 * POST /api/contactos/config/restablecer — Restablecer etiquetas, rubros y puestos predefinidos.
 * Body: { tipo: 'etiqueta' | 'rubro' | 'puesto' | 'todos' }
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
    const admin = crearClienteAdmin()

    if (tipo === 'etiqueta' || tipo === 'todos') {
      for (const e of ETIQUETAS_DEFAULT) {
        await admin.from('etiquetas_contacto')
          .upsert({ empresa_id: empresaId, nombre: e.nombre, color: e.color, orden: e.orden, activa: true }, { onConflict: 'empresa_id,nombre' })
      }
    }

    if (tipo === 'rubro' || tipo === 'todos') {
      for (let i = 0; i < RUBROS_DEFAULT.length; i++) {
        await admin.from('rubros_contacto')
          .upsert({ empresa_id: empresaId, nombre: RUBROS_DEFAULT[i], orden: i + 1, activo: true }, { onConflict: 'empresa_id,nombre' })
      }
    }

    if (tipo === 'puesto' || tipo === 'todos') {
      for (let i = 0; i < PUESTOS_DEFAULT.length; i++) {
        await admin.from('puestos_contacto')
          .upsert({ empresa_id: empresaId, nombre: PUESTOS_DEFAULT[i], orden: i + 1, activo: true }, { onConflict: 'empresa_id,nombre' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

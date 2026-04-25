import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'
import { crearPlantillasSistema } from '@/lib/plantillas-sistema/seed'
import { crearPlantillasWhatsAppSistema } from '@/lib/plantillas-sistema/whatsapp'

/**
 * Defaults regionales por país — se aplican al crear empresa nueva.
 * Si el usuario no selecciona país, se usan defaults genéricos (Argentina).
 */
const DEFAULTS_REGIONALES: Record<string, { moneda: string; zona_horaria: string; formato_fecha: string; formato_hora: string; dia_inicio_semana: string }> = {
  AR: { moneda: 'ARS', zona_horaria: 'America/Argentina/Buenos_Aires', formato_fecha: 'DD/MM/YYYY', formato_hora: '24h', dia_inicio_semana: 'lunes' },
  MX: { moneda: 'MXN', zona_horaria: 'America/Mexico_City', formato_fecha: 'DD/MM/YYYY', formato_hora: '12h', dia_inicio_semana: 'lunes' },
  CO: { moneda: 'COP', zona_horaria: 'America/Bogota', formato_fecha: 'DD/MM/YYYY', formato_hora: '12h', dia_inicio_semana: 'lunes' },
  CL: { moneda: 'CLP', zona_horaria: 'America/Santiago', formato_fecha: 'DD/MM/YYYY', formato_hora: '24h', dia_inicio_semana: 'lunes' },
  PE: { moneda: 'PEN', zona_horaria: 'America/Lima', formato_fecha: 'DD/MM/YYYY', formato_hora: '12h', dia_inicio_semana: 'lunes' },
  UY: { moneda: 'UYU', zona_horaria: 'America/Montevideo', formato_fecha: 'DD/MM/YYYY', formato_hora: '24h', dia_inicio_semana: 'lunes' },
  BR: { moneda: 'BRL', zona_horaria: 'America/Sao_Paulo', formato_fecha: 'DD/MM/YYYY', formato_hora: '24h', dia_inicio_semana: 'lunes' },
  ES: { moneda: 'EUR', zona_horaria: 'Europe/Madrid', formato_fecha: 'DD/MM/YYYY', formato_hora: '24h', dia_inicio_semana: 'lunes' },
  US: { moneda: 'USD', zona_horaria: 'America/New_York', formato_fecha: 'MM/DD/YYYY', formato_hora: '12h', dia_inicio_semana: 'domingo' },
}

const DEFAULTS_GENERICOS = DEFAULTS_REGIONALES.AR

/**
 * POST /api/empresas/crear — Crear empresa nueva (onboarding).
 * Crea la empresa, el miembro propietario (activo=true),
 * crea contacto tipo "equipo", y setea empresa_activa_id en el JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { nombre, slug, pais } = await request.json()

    if (!nombre || !slug) {
      return NextResponse.json(
        { error: 'Nombre y slug son obligatorios' },
        { status: 400 }
      )
    }

    // Validar formato del slug: solo minúsculas, números y guiones
    const slugLimpio = slug.toLowerCase().trim()
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slugLimpio)) {
      return NextResponse.json(
        { error: 'El subdominio solo puede contener letras minúsculas, números y guiones' },
        { status: 400 }
      )
    }

    const admin = crearClienteAdmin()

    // Verificar que el slug no esté ocupado
    const { data: existente } = await admin
      .from('empresas')
      .select('id')
      .eq('slug', slugLimpio)
      .single()

    if (existente) {
      return NextResponse.json(
        { error: 'Este subdominio ya está en uso' },
        { status: 409 }
      )
    }

    // Defaults regionales según país seleccionado
    const regional = DEFAULTS_REGIONALES[pais] || DEFAULTS_GENERICOS

    // Crear empresa con config regional desde el inicio
    const { data: empresa, error: errorEmpresa } = await admin
      .from('empresas')
      .insert({
        nombre,
        slug: slugLimpio,
        pais: pais || null,
        paises: pais ? [pais] : [],
        moneda: regional.moneda,
        formato_fecha: regional.formato_fecha,
        formato_hora: regional.formato_hora,
        dia_inicio_semana: regional.dia_inicio_semana,
        zona_horaria: regional.zona_horaria,
      })
      .select()
      .single()

    if (errorEmpresa || !empresa) {
      return NextResponse.json({ error: 'Error al crear la empresa' }, { status: 500 })
    }

    // Seed de tipos de contacto y secuencia (idempotente: hace nada si ya existen).
    // Garantiza que el tipo "empresa" y "equipo" estén disponibles para los inserts
    // siguientes, y que la secuencia de contactos arranque en 1.
    await admin.rpc('seed_tipos_contacto', { p_empresa_id: empresa.id })

    // C-0001 → contacto tipo empresa con el nombre de la empresa recién creada.
    // Convención: el primer contacto siempre es la empresa misma. Se crea antes
    // que el miembro propietario para que tome el código 0001 de la secuencia.
    const { data: tipoEmpresa } = await admin
      .from('tipos_contacto')
      .select('id')
      .eq('empresa_id', empresa.id)
      .eq('clave', 'empresa')
      .single()

    if (tipoEmpresa) {
      const { data: codigoEmpresa } = await admin
        .rpc('siguiente_codigo', { p_empresa_id: empresa.id, p_entidad: 'contacto' })

      if (codigoEmpresa) {
        await admin.from('contactos').insert({
          empresa_id: empresa.id,
          tipo_contacto_id: tipoEmpresa.id,
          codigo: codigoEmpresa,
          nombre: empresa.nombre,
          origen: 'sistema',
          creado_por: user.id,
          activo: true,
          en_papelera: false,
          es_provisorio: false,
          etiquetas: [],
          datos_fiscales: {},
        })
      }
    }

    // Crear miembro propietario (activo=true, numero_empleado=1).
    const { data: miembro, error: errorMiembro } = await admin
      .from('miembros')
      .insert({
        usuario_id: user.id,
        empresa_id: empresa.id,
        rol: 'propietario',
        activo: true,
        numero_empleado: 1,
      })
      .select('id')
      .single()

    if (errorMiembro || !miembro) {
      return NextResponse.json({ error: 'Error al crear membresía' }, { status: 500 })
    }

    // Contacto tipo "equipo" para el propietario → tomará C-0002 de la secuencia.
    await vincularOCrearContactoEquipo(admin, {
      miembroId: miembro.id,
      empresaId: empresa.id,
      correo: user.email || '',
      nombre: user.user_metadata?.nombre_completo || user.email?.split('@')[0] || '',
      usuarioId: user.id,
    })

    // Crear plantillas de correo de sistema para la nueva empresa
    await crearPlantillasSistema(admin, empresa.id, user.id)

    // Crear plantillas WhatsApp de sistema (recorrido: aviso en camino + llegada).
    // Se insertan en BORRADOR — el admin tiene que enviarlas a Meta a aprobación.
    await crearPlantillasWhatsAppSistema(admin, empresa.id, user.id)

    // Setear empresa activa en app_metadata para que el JWT hook la use
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { empresa_activa_id: empresa.id },
    })

    return NextResponse.json({ empresa })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import EditorContacto, { type DatosInicialesContacto } from './_componentes/EditorContacto'
import { SkeletonDetalle } from '@/componentes/feedback/SkeletonDetalle'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { TipoContacto, TipoRelacion, CampoFiscalPais } from '@/tipos'

/**
 * Página de detalle de contacto — /contactos/[id]
 *
 * Server Component que precarga en paralelo:
 *  - Tipos de contacto / relación / puestos / campos fiscales / países
 *    (compartido con la creación, vive en /api/contactos/tipos).
 *  - Etiquetas y rubros configurables (/api/contactos/config).
 *  - El contacto en sí con sus relaciones (cuando no es "nuevo").
 *
 * Esos datos se pasan al cliente `EditorContacto`, que arranca sin el
 * spinner inicial y sin disparar los tres fetches que hacía en useEffect.
 * Para mantener la sensación rápida durante la navegación, el cuerpo
 * async vive dentro de un Suspense con SkeletonDetalle.
 */
export default function PaginaDetalleContacto({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<SkeletonDetalle />}>
      <ContenidoServidor params={params} />
    </Suspense>
  )
}

async function ContenidoServidor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Para "nuevo" sólo necesitamos los catálogos compartidos; el contacto
  // todavía no existe.
  const esNuevo = id === 'nuevo'

  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()

  // Las tres queries son independientes — corren en paralelo. Si falla la
  // del contacto, el cliente sigue funcionando con catálogos y disparará el
  // fetch normal vía useEffect.
  const [tiposRes, configRes, contactoRes] = await Promise.all([
    fetchTipos(empresaId, admin),
    fetchConfig(empresaId, admin),
    esNuevo ? Promise.resolve(null) : fetchContacto(id, empresaId, user.id, admin),
  ])

  const datosIniciales: DatosInicialesContacto = {
    tipos: tiposRes,
    config: configRes,
    contacto: contactoRes,
  }

  return <EditorContacto datosIniciales={datosIniciales} />
}

// ── Loaders -----------------------------------------------------------------

type Admin = ReturnType<typeof crearClienteAdmin>

async function fetchTipos(empresaId: string, admin: Admin): Promise<DatosInicialesContacto['tipos']> {
  // Tablas posiblemente vacías en empresas nuevas: aceptamos resultado vacío
  // y devolvemos shape vacío en lugar de explotar.
  const queries = await Promise.all([
    admin.from('tipos_contacto').select('*').eq('empresa_id', empresaId).eq('activo', true).order('orden'),
    admin.from('tipos_relacion').select('*').eq('empresa_id', empresaId).eq('activo', true).order('orden'),
    admin.from('puestos_vinculacion').select('id, etiqueta').eq('empresa_id', empresaId).order('orden'),
    admin.from('campos_fiscales_pais').select('*').eq('activo', true),
    admin.from('empresas').select('pais, paises').eq('id', empresaId).maybeSingle(),
  ])
  const [tiposContactoRes, tiposRelacionRes, puestosRes, camposFiscalesRes, empresaRes] = queries

  const empresa = empresaRes.data as { pais?: string; paises?: string[] } | null
  const paises: string[] = []
  if (empresa?.paises && Array.isArray(empresa.paises)) paises.push(...empresa.paises)
  else if (empresa?.pais) paises.push(empresa.pais)

  return {
    tipos_contacto: (tiposContactoRes.data || []) as TipoContacto[],
    tipos_relacion: (tiposRelacionRes.data || []) as TipoRelacion[],
    puestos_vinculacion: (puestosRes.data || []) as { id: string; etiqueta: string }[],
    campos_fiscales: (camposFiscalesRes.data || []) as CampoFiscalPais[],
    paises,
  }
}

async function fetchConfig(empresaId: string, admin: Admin): Promise<DatosInicialesContacto['config']> {
  const { data } = await admin
    .from('configuracion_contactos')
    .select('etiquetas, rubros')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  return {
    etiquetas: (data?.etiquetas as Array<{ nombre?: string; color?: string; activo?: boolean }>) || [],
    rubros: (data?.rubros as Array<{ nombre?: string; activo?: boolean }>) || [],
  }
}

async function fetchContacto(id: string, empresaId: string, _userId: string, admin: Admin) {
  // Misma forma que devuelve /api/contactos/[id]. Si no se encuentra, el
  // cliente cae al fetch tradicional vía useEffect (modo retrocompat).
  const { data, error } = await admin
    .from('contactos')
    .select(`
      *,
      direcciones:contacto_direcciones(*),
      telefonos:contacto_telefonos(*),
      vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(*, vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(id, nombre, apellido, correo, telefono, whatsapp, codigo, tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta, color))),
      vinculaciones_inversas:contacto_vinculaciones!contacto_vinculaciones_vinculado_id_fkey(*, contacto_origen:contactos!contacto_vinculaciones_contacto_id_fkey(id, nombre, apellido, correo, telefono, whatsapp, codigo, tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta, color)))
    `)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .maybeSingle()

  if (error || !data) return null
  return data as Record<string, unknown>
}

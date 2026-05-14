/**
 * Helpers de precarga server-side para el layout autenticado de Flux.
 *
 * Antes cada ProveedorX hacía su propio fetch al montar en cliente, lo que
 * encadenaba ~5 round trips en cascada al entrar a la app (Auth → Empresa/
 * Permisos/Modulos en paralelo, pero los hijos esperan a Auth). Con estos
 * helpers el `layout.tsx` (Server Component) los corre en una sola tanda
 * paralela usando el cliente admin de Supabase y le pasa los resultados a
 * `<ProveedoresCliente>`.
 *
 * Beneficio: el primer paint del layout no espera ningún fetch del cliente.
 * GuardPagina, PlantillaApp y el sidebar tienen datos correctos desde el
 * primer render.
 */

import 'server-only'
import type { User, Session } from '@supabase/supabase-js'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { Rol, MetodoFichaje } from '@/tipos/miembro'
import type { PermisosMapa } from '@/tipos/permisos'
import type { Empresa, ModuloConEstado } from '@/tipos'
import type { PermisosInicialesServer } from '@/hooks/usePermisosActuales'

interface EmpresaConRol extends Empresa {
  rol: string
  activo: boolean
}

export interface DatosPrecargaLayout {
  usuario: User | null
  sesion: Session | null
  empresa: Empresa | null
  empresas: EmpresaConRol[]
  permisos: PermisosInicialesServer | null
  modulos: ModuloConEstado[]
}

/**
 * Precarga en paralelo todo lo que necesitan los providers del layout.
 * Si no hay sesión, devuelve un objeto vacío sin tocar la base.
 */
export async function precargarDatosLayout(): Promise<DatosPrecargaLayout> {
  const supabase = await crearClienteServidor()
  const [{ data: { session } }] = await Promise.all([
    supabase.auth.getSession(),
  ])
  const user = session?.user ?? null
  if (!user) {
    return { usuario: null, sesion: null, empresa: null, empresas: [], permisos: null, modulos: [] }
  }

  const empresaActivaId = user.app_metadata?.empresa_activa_id as string | undefined
  const admin = crearClienteAdmin()

  // Las cuatro queries son independientes entre sí — se lanzan en paralelo
  // y el layout espera la más lenta (típicamente 80-150 ms en total).
  const [membresiasRes, miembroRes, catalogoRes, instaladosRes] = await Promise.all([
    admin
      .from('miembros')
      .select('empresa_id, rol, activo')
      .eq('usuario_id', user.id),
    empresaActivaId
      ? admin
        .from('miembros')
        .select('id, rol, permisos_custom, activo, metodo_fichaje')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaActivaId)
        .maybeSingle()
      : Promise.resolve({ data: null } as const),
    admin
      .from('catalogo_modulos')
      .select('*')
      .eq('visible', true)
      .order('orden'),
    empresaActivaId
      ? admin
        .from('modulos_empresa')
        .select('*')
        .eq('empresa_id', empresaActivaId)
      : Promise.resolve({ data: [] } as const),
  ])

  // ── Resolver empresas + empresa activa ─────────────────────────────────
  const membresias = membresiasRes.data || []
  let empresasLista: EmpresaConRol[] = []
  let empresaActiva: Empresa | null = null
  if (membresias.length > 0) {
    const empresaIds = membresias.map(m => m.empresa_id)
    const { data: empresasData } = await admin
      .from('empresas')
      .select('id, nombre, slug, logo_url, pais, color_marca, creado_en, direccion')
      .in('id', empresaIds)
    const mapa = new Map((empresasData || []).map(e => [e.id, e as Empresa]))
    empresasLista = membresias
      .filter(m => mapa.has(m.empresa_id))
      .map(m => ({ ...(mapa.get(m.empresa_id) as Empresa), rol: m.rol, activo: m.activo }))
    if (empresaActivaId) {
      empresaActiva = empresasLista.find(e => e.id === empresaActivaId) ?? null
    }
  }

  // ── Resolver permisos del miembro en la empresa activa ─────────────────
  const miembro = miembroRes.data
  const permisos: PermisosInicialesServer = miembro
    ? {
      miembro_id: miembro.id as string,
      rol: miembro.rol as Rol,
      permisos_custom: (miembro.permisos_custom as PermisosMapa | null) || null,
      activo: !!miembro.activo,
      es_propietario: miembro.rol === 'propietario',
      es_superadmin: !!user.app_metadata?.es_superadmin,
      metodo_fichaje: (miembro.metodo_fichaje as MetodoFichaje | null) || null,
    }
    : {
      miembro_id: null,
      rol: null,
      permisos_custom: null,
      activo: false,
      es_propietario: false,
      es_superadmin: !!user.app_metadata?.es_superadmin,
      metodo_fichaje: null,
    }

  // ── Catálogo de módulos cruzado con instalados ─────────────────────────
  const catalogo = catalogoRes.data || []
  const instalados = instaladosRes.data || []
  const mapaInstalados = new Map(instalados.map(m => [m.modulo, m]))
  const modulos: ModuloConEstado[] = catalogo.map(cat => {
    const inst = mapaInstalados.get(cat.slug)
    const purgaProgramada = inst?.purga_programada_en ?? null
    let diasRestantes: number | null = null
    if (purgaProgramada && !inst?.activo) {
      const diff = new Date(purgaProgramada).getTime() - Date.now()
      diasRestantes = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }
    return {
      ...cat,
      precio_mensual_usd: Number(cat.precio_mensual_usd) || 0,
      precio_anual_usd: Number(cat.precio_anual_usd) || 0,
      requiere: cat.requiere || [],
      features: cat.features || [],
      instalado: !!inst,
      activo: inst?.activo ?? false,
      modulo_empresa_id: inst?.id ?? null,
      purga_programada_en: purgaProgramada,
      dias_restantes_purga: diasRestantes,
    } as ModuloConEstado
  })

  return {
    usuario: user,
    sesion: session,
    empresa: empresaActiva,
    empresas: empresasLista,
    permisos,
    modulos,
  }
}

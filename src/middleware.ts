import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteMiddleware } from '@/lib/supabase/middleware'
import { extraerSlug } from '@/lib/subdominio'

/**
 * Middleware principal de Flux by Salix.
 * Responsabilidades:
 *   1. Refrescar tokens de Supabase (mantener sesión)
 *   2. Resolver subdominio → empresa
 *   3. Redirigir según estado de autenticación
 */

// Rutas de auth (sin sesión)
const RUTAS_AUTH = ['/login', '/registro', '/recuperar', '/restablecer']

// Rutas de transición (con sesión pero sin empresa completa)
const RUTAS_TRANSICION = ['/onboarding', '/esperando-activacion', '/selector-empresa', '/verificar-correo', '/invitacion']

// Rutas que se saltan completamente
const RUTAS_IGNORADAS = ['/_next', '/favicon.ico', '/api/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorar assets y APIs
  if (RUTAS_IGNORADAS.some(ruta => pathname.startsWith(ruta))) {
    return NextResponse.next()
  }

  // Crear cliente Supabase y refrescar sesión
  const { supabase, response } = await crearClienteMiddleware(request)
  const { data: { user } } = await supabase.auth.getUser()

  // Extraer subdominio
  const host = request.headers.get('host') || ''
  const slug = extraerSlug(host)
  if (slug) {
    response.headers.set('x-flux-slug', slug)
  }

  const esRutaAuth = RUTAS_AUTH.some(ruta => pathname.startsWith(ruta))
  const esRutaTransicion = RUTAS_TRANSICION.some(ruta => pathname.startsWith(ruta))

  // --- Sin sesión ---
  if (!user) {
    // Puede estar en rutas de auth o invitación, el resto redirige a login
    if (esRutaAuth || pathname.startsWith('/invitacion')) {
      return response
    }
    const urlLogin = request.nextUrl.clone()
    urlLogin.pathname = '/login'
    return NextResponse.redirect(urlLogin)
  }

  // --- Con sesión ---

  // Email no confirmado → solo /verificar-correo
  if (!user.email_confirmed_at) {
    if (pathname === '/verificar-correo') return response
    const url = request.nextUrl.clone()
    url.pathname = '/verificar-correo'
    return NextResponse.redirect(url)
  }

  const empresaId = user.app_metadata?.empresa_activa_id
  const tieneEmpresaActiva = !!empresaId

  // Autenticado + verificado + en ruta de auth (login/registro) → redirigir fuera
  if (esRutaAuth) {
    const url = request.nextUrl.clone()
    url.pathname = tieneEmpresaActiva ? '/dashboard' : '/onboarding'
    return NextResponse.redirect(url)
  }

  // En ruta de transición → dejar pasar (el usuario puede estar en onboarding, etc.)
  if (esRutaTransicion) {
    return response
  }

  // Ruta protegida sin empresa activa → onboarding
  if (!tieneEmpresaActiva) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Todo OK → pasar
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

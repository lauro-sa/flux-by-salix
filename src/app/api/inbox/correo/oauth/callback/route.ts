import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  intercambiarCodigoGmail,
  obtenerEmailGmail,
  obtenerPerfilGmail,
} from '@/lib/gmail'
import {
  intercambiarCodigoOutlook,
  obtenerEmailOutlook,
} from '@/lib/outlook'
import type { ConfigOutlookOAuth } from '@/tipos/inbox'

/**
 * GET /api/inbox/correo/oauth/callback — Callback de OAuth de Gmail/Outlook.
 * Google redirige acá después de que el usuario autoriza.
 * Intercambia código → tokens, crea/actualiza canal de correo, guarda config.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codigo = searchParams.get('code')
    const estado = searchParams.get('state')
    const errorGoogle = searchParams.get('error')

    // Si el usuario canceló
    if (errorGoogle) {
      return NextResponse.redirect(new URL('/inbox/configuracion?correo=cancelado', request.url))
    }

    if (!codigo || !estado) {
      return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
    }

    // Decodificar estado
    let empresaId: string
    let userId: string
    let canalId: string | null
    let nombre: string
    let proveedor: 'gmail_oauth' | 'outlook_oauth'
    try {
      const decoded = JSON.parse(Buffer.from(estado, 'base64').toString())
      empresaId = decoded.empresaId
      userId = decoded.userId
      canalId = decoded.canalId || null
      nombre = decoded.nombre || 'Gmail'
      proveedor = decoded.proveedor || 'gmail_oauth'
    } catch {
      return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
    }

    let email: string
    let configConexion: Record<string, unknown>
    let syncCursor: Record<string, unknown>

    if (proveedor === 'outlook_oauth') {
      // Microsoft OAuth
      const tokens = await intercambiarCodigoOutlook(codigo)
      const outlookConfig: ConfigOutlookOAuth = {
        email: '',
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expira_en: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }
      email = await obtenerEmailOutlook(outlookConfig)
      outlookConfig.email = email
      configConexion = outlookConfig as unknown as Record<string, unknown>
      syncCursor = { ultimaSincronizacion: new Date().toISOString() }
    } else {
      // Gmail OAuth
      const tokens = await intercambiarCodigoGmail(codigo)
      const accessToken = tokens.access_token!
      const refreshToken = tokens.refresh_token!
      email = await obtenerEmailGmail(accessToken)
      const perfil = await obtenerPerfilGmail(refreshToken)
      configConexion = {
        email,
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expira_en: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      }
      syncCursor = {
        historyId: perfil.historyId,
        ultimaSincronizacion: new Date().toISOString(),
      }
    }

    const admin = crearClienteAdmin()

    const configConexion = {
      email,
      refresh_token: refreshToken,
      access_token: accessToken,
      token_expira_en: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    }

    const syncCursor = {
      historyId: perfil.historyId,
      ultimaSincronizacion: new Date().toISOString(),
    }

    if (canalId) {
      // Actualizar canal existente
      const { error } = await admin
        .from('canales_inbox')
        .update({
          nombre: nombre || email,
          config_conexion: configConexion,
          estado_conexion: 'conectado',
          ultimo_error: null,
          ultima_sincronizacion: new Date().toISOString(),
          sync_cursor: syncCursor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', canalId)
        .eq('empresa_id', empresaId)

      if (error) {
        console.error('Error actualizando canal correo:', error)
        return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
      }
    } else {
      // Crear nuevo canal de correo
      const { error } = await admin
        .from('canales_inbox')
        .insert({
          empresa_id: empresaId,
          tipo: 'correo',
          nombre: nombre || email,
          proveedor: 'gmail_oauth',
          activo: true,
          config_conexion: configConexion,
          estado_conexion: 'conectado',
          sync_cursor: syncCursor,
          creado_por: userId,
        })

      if (error) {
        console.error('Error creando canal correo:', error)
        return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
      }
    }

    // Activar módulo inbox_correo si no está activo
    const { data: moduloExistente } = await admin
      .from('modulos_empresa')
      .select('id, activo')
      .eq('empresa_id', empresaId)
      .eq('modulo', 'inbox_correo')
      .maybeSingle()

    if (!moduloExistente) {
      await admin.from('modulos_empresa').insert({
        empresa_id: empresaId,
        modulo: 'inbox_correo',
        activo: true,
        activado_en: new Date().toISOString(),
      })
    } else if (!moduloExistente.activo) {
      await admin
        .from('modulos_empresa')
        .update({ activo: true, activado_en: new Date().toISOString() })
        .eq('id', moduloExistente.id)
    }

    // Disparar primera sincronización en background
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
      fetch(`${baseUrl}/api/inbox/correo/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId }),
      }).catch(() => {
        // No bloquear el callback si falla la sync inicial
      })
    } catch {
      // Silenciar
    }

    return NextResponse.redirect(new URL('/inbox/configuracion?correo=conectado', request.url))
  } catch (err) {
    console.error('Error callback Gmail:', err)
    return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
  }
}

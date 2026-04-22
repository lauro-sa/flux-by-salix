import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  intercambiarCodigoGmail,
  obtenerEmailGmail,
  obtenerPerfilGmail,
  registrarWatchGmail,
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
    let propietarioUsuarioId: string | null
    try {
      const decoded = JSON.parse(Buffer.from(estado, 'base64').toString())
      empresaId = decoded.empresaId
      userId = decoded.userId
      canalId = decoded.canalId || null
      nombre = decoded.nombre || 'Gmail'
      proveedor = decoded.proveedor || 'gmail_oauth'
      propietarioUsuarioId = decoded.propietarioUsuarioId || null
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

    if (canalId) {
      // Actualizar canal existente
      const { error } = await admin
        .from('canales_correo')
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
      const { data: canalCreado, error } = await admin
        .from('canales_correo')
        .insert({
          empresa_id: empresaId,
          tipo: 'correo',
          nombre: nombre || email,
          proveedor,
          activo: true,
          config_conexion: configConexion,
          estado_conexion: 'conectado',
          sync_cursor: syncCursor,
          propietario_usuario_id: propietarioUsuarioId,
          creado_por: userId,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creando canal correo:', error)
        return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
      }

      // Bandeja personal: el propietario queda como agente con rol 'propietario'.
      if (canalCreado && propietarioUsuarioId) {
        await admin.from('canal_agentes').insert({
          canal_id: canalCreado.id,
          usuario_id: propietarioUsuarioId,
          rol_canal: 'propietario',
        })
      }
    }

    // Registrar watch de Gmail para push notifications (Pub/Sub)
    if (proveedor === 'gmail_oauth') {
      const topicName = process.env.GMAIL_PUBSUB_TOPIC
      if (topicName) {
        try {
          const refreshToken = (configConexion as { refresh_token: string }).refresh_token
          const watch = await registrarWatchGmail(refreshToken, topicName)
          // Guardar expiración del watch en sync_cursor
          const canalIdActual = canalId || (await admin
            .from('canales_correo')
            .select('id')
            .eq('empresa_id', empresaId)
            .eq('proveedor', 'gmail_oauth')
            .ilike('config_conexion->>email', email)
            .single()
          ).data?.id

          if (canalIdActual) {
            await admin
              .from('canales_correo')
              .update({
                sync_cursor: {
                  ...syncCursor,
                  historyId: watch.historyId || (syncCursor as Record<string, unknown>).historyId,
                  watchExpiracion: watch.expiracion,
                },
              })
              .eq('id', canalIdActual)
          }
          console.info(`[Gmail Watch] Registrado para ${email}, expira: ${watch.expiracion}`)
        } catch (err) {
          console.error(`[Gmail Watch] Error registrando watch para ${email}:`, err)
          // No bloquear el callback si falla el watch
        }
      } else {
        console.warn('[Gmail Watch] GMAIL_PUBSUB_TOPIC no configurado, push notifications deshabilitadas')
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

    // Redirect al lugar apropiado: si es bandeja personal, al perfil del dueño;
    // si es compartida, a la configuración del inbox.
    if (propietarioUsuarioId) {
      const { data: miembro } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', propietarioUsuarioId)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      const destino = miembro ? `/usuarios/${miembro.id}?tab=correo&correo=conectado` : '/usuarios'
      return NextResponse.redirect(new URL(destino, request.url))
    }
    return NextResponse.redirect(new URL('/inbox/configuracion?correo=conectado', request.url))
  } catch (err) {
    console.error('Error callback Gmail:', err)
    return NextResponse.redirect(new URL('/inbox/configuracion?correo=error', request.url))
  }
}

/**
 * Firebase Admin SDK — solo se usa en el servidor para enviar push via FCM.
 * Las credenciales vienen de la env var FIREBASE_SERVICE_ACCOUNT (JSON stringified).
 * Se usa en: notificaciones.ts (enviarPush)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function inicializarAdmin() {
  if (getApps().length > 0) return getApps()[0]

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada en env vars')
  }

  const serviceAccount = JSON.parse(serviceAccountJson)

  return initializeApp({
    credential: cert(serviceAccount),
  })
}

/**
 * Obtener instancia de Firebase Admin Messaging para enviar push.
 * Inicializa el admin SDK lazily en la primera llamada.
 */
export function obtenerMensajeriaAdmin() {
  inicializarAdmin()
  return getMessaging()
}

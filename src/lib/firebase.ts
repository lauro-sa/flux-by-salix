/**
 * Firebase Client SDK — solo se usa para FCM (push notifications).
 * NO se usa para auth, DB ni storage (eso va por Supabase).
 * Se usa en: usePushNotificaciones.ts
 */

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyD8VfiguEpE64ITtdtWCtbklUzetg1Zlko',
  authDomain: 'flux-by-salix-436a4.firebaseapp.com',
  projectId: 'flux-by-salix-436a4',
  storageBucket: 'flux-by-salix-436a4.firebasestorage.app',
  messagingSenderId: '78902887591',
  appId: '1:78902887591:web:1223eb6a672103d71c4782',
}

// Singleton: no inicializar dos veces
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

/**
 * Obtener instancia de Firebase Messaging (null si no es soportado).
 * Safari requiere que se llame desde contexto seguro (HTTPS + standalone PWA).
 */
export async function obtenerMensajeria() {
  const soportado = await isSupported()
  if (!soportado) return null
  return getMessaging(app)
}

export { app as firebaseApp }

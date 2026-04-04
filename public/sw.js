/// Service Worker de Flux by Salix
/// Cache de assets estáticos + estrategia network-first para API
/// Firebase Cloud Messaging para push notifications (iOS + Android + Desktop)

// ─── Firebase Messaging (push via FCM → APNs para iOS) ───
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyD8VfiguEpE64ITtdtWCtbklUzetg1Zlko',
  authDomain: 'flux-by-salix-436a4.firebaseapp.com',
  projectId: 'flux-by-salix-436a4',
  storageBucket: 'flux-by-salix-436a4.firebasestorage.app',
  messagingSenderId: '78902887591',
  appId: '1:78902887591:web:1223eb6a672103d71c4782',
})

const messaging = firebase.messaging()

// ─── FCM Background Messages ───
// Cuando llega un push con webpush.notification, Firebase lo muestra automáticamente
// y NO llama a onBackgroundMessage (evita doble push).
// Solo entra acá si el payload es data-only (sin notification top-level).
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return // Firebase ya lo mostró

  const datos = payload.data || {}
  const titulo = datos.title || datos.titulo || 'Flux'
  const cuerpo = datos.body || datos.cuerpo || ''
  const url = datos.url || '/'

  return self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: '/iconos/icon-192.png',
    badge: '/iconos/icon-192.png',
    tag: url || 'flux-notificacion',
    data: { url },
    requireInteraction: false,
    silent: false,
  })
})

// ─── Cache ───

const CACHE_NAME = 'flux-v2'

// Assets estáticos que se cachean en la instalación
const ASSETS_ESTATICOS = [
  '/dashboard',
  '/offline',
  '/login',
  '/manifest.json',
  '/iconos/icon-192.png',
  '/iconos/apple-touch-icon.png',
  '/iconos/favicon.svg',
]

// Instalación — cachear assets estáticos (sin fallar si alguno no carga)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS_ESTATICOS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res)
          }).catch(() => {})
        )
      )
    )
  )
  self.skipWaiting()
})

// Activación — limpiar TODOS los caches para forzar assets frescos en cada deploy
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — network-first para API y navegación, cache-first para assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // No cachear requests de Supabase ni API
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return
  }

  // Assets estáticos (_next/static) — network-first (los hashes en URL garantizan unicidad)
  // Network-first asegura que cada deploy sirva los bundles nuevos inmediatamente.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Google Fonts — cache-first (raramente cambian)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
    return
  }

  // Iconos y splash screens — cache-first
  if (url.pathname.startsWith('/iconos/') || url.pathname.startsWith('/splash/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
    return
  }

  // Navegación y resto — network-first con fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline')))
    )
    return
  }
})

// ─── Push Notifications (fallback para web-push directo, no FCM) ───
// Si por alguna razón llega un push que no es de FCM, lo manejamos igual.
self.addEventListener('push', (event) => {
  // Si Firebase ya manejó el push, no hacer nada
  // Firebase intercepta los push events de FCM antes de que lleguen acá
  let datos = {}
  try {
    if (event.data) {
      datos = event.data.json()
    }
  } catch {
    try {
      const texto = event.data ? event.data.text() : ''
      datos = { titulo: 'Flux', cuerpo: texto }
    } catch {
      datos = {}
    }
  }

  const declarativo = datos.notification || {}
  const titulo = datos.titulo || declarativo.title || datos.title || 'Flux'
  const cuerpo = datos.cuerpo || declarativo.body || datos.body || ''
  const url = datos.url || declarativo.navigate || '/'
  const icono = datos.icono || declarativo.icon || '/iconos/icon-192.png'

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: icono,
      badge: '/iconos/icon-192.png',
      tag: url || 'flux-notificacion',
      data: { url },
      requireInteraction: false,
      silent: false,
    })
  )
})

// Click en la notificación — abrir la URL correspondiente
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Soportar tanto data de FCM como data manual
  const fcmData = event.notification.data?.FCM_MSG?.data || {}
  const url = fcmData.url || event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      // Si ya hay una ventana abierta, navegar ahí
      for (const cliente of clientes) {
        if (cliente.url.includes(self.location.origin)) {
          if ('focus' in cliente) cliente.focus()
          // Enviar mensaje para navegar (más confiable en iOS que navigate)
          cliente.postMessage({ type: 'NAVEGAR', url })
          return
        }
      }
      // Si no hay ventana, abrir una nueva
      return self.clients.openWindow(url)
    })
  )
})

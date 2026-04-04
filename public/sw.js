/// Service Worker de Flux by Salix
/// Cache de assets estáticos + estrategia network-first para API

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

// ─── Push Notifications ───
// Recibe notificaciones push y SIEMPRE muestra una notificación visible.
// iOS Safari revoca la suscripción si el SW no muestra notificación 3 veces.
// Soporta Declarative Web Push (Safari 18.4+) como fallback automático.

self.addEventListener('push', (event) => {
  // Extraer datos del payload de forma segura
  let datos = {}
  try {
    if (event.data) {
      datos = event.data.json()
    }
  } catch {
    // Si no es JSON, intentar texto plano
    try {
      const texto = event.data ? event.data.text() : ''
      datos = { titulo: 'Flux', cuerpo: texto }
    } catch {
      datos = {}
    }
  }

  // Soportar tanto formato custom (titulo/cuerpo) como Declarative Web Push (notification.title/body)
  const declarativo = datos.notification || {}
  const titulo = datos.titulo || declarativo.title || 'Flux'
  const cuerpo = datos.cuerpo || declarativo.body || ''
  const url = datos.url || declarativo.navigate || '/'
  const icono = datos.icono || declarativo.icon || '/iconos/icon-192.png'

  const opciones = {
    body: cuerpo,
    icon: icono,
    badge: '/iconos/icon-192.png',
    tag: url || 'flux-notificacion',
    data: { url },
    requireInteraction: false,
    silent: false,
  }

  // CRÍTICO: showNotification SIEMPRE debe ejecutarse para evitar la regla de 3 strikes de Safari
  event.waitUntil(
    self.registration.showNotification(titulo, opciones)
  )
})

// Click en la notificación — abrir la URL correspondiente
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

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

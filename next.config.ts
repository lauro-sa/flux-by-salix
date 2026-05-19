import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Excluir puppeteer/chromium del bundling serverless (solo se usa en PDF generation)
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
  // Tree-shaking agresivo para paquetes con barrel files grandes. Sin esto,
  // `import { X } from 'lucide-react'` arrastra el archivo barrel completo
  // (~1500 íconos) al bundle por archivo que importe. Con la flag, Next.js
  // reescribe cada import al subpath específico del ícono (X resuelve a
  // lucide-react/dist/esm/icons/x.js) y el bundler descarta el resto.
  // Mismo beneficio para date-fns y framer-motion.
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
    // Router Cache del cliente: al volver a una ruta visitada hace poco,
    // Next reusa el RSC payload en memoria sin re-correr el Server Component
    // (evita que se vea el SkeletonListado del <Suspense fallback> en cada
    // navegación). Next 15 bajó el default a 0s, lo subimos para que volver
    // a /contactos o /presupuestos en menos de 30s sea instantáneo. El cache
    // se invalida automáticamente con router.refresh() o al modificar datos.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    // Formatos de imagen optimizados (WebP y AVIF)
    formats: ['image/avif', 'image/webp'],
    // Cache de imágenes optimizadas: 30 días (las URLs tienen cache buster ?t=)
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Headers de cache para assets estáticos
  async headers() {
    return [
      {
        // Imágenes, fuentes y assets estáticos: cache 1 año (inmutable)
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ]
  },
}

export default nextConfig

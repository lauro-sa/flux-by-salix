import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Excluir puppeteer/chromium del bundling serverless (solo se usa en PDF generation)
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
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

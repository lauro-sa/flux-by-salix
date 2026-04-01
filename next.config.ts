import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Excluir puppeteer/chromium del bundling serverless (solo se usa en PDF generation)
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig

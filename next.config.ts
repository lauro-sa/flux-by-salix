import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Excluir puppeteer/chromium del bundling serverless (solo se usa en PDF generation)
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
}

export default nextConfig

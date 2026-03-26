/**
 * Script para generar iconos PWA a partir del SVG del logo.
 * Logo blanco sobre fondo marca (#6366f1).
 * Genera: 192, 512, maskable (con padding extra), favicon 32, apple-touch 180.
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR_SALIDA = resolve(__dirname, '../public/iconos')
const COLOR_MARCA = '#6366f1'

// SVG original tiene fill negro con media query para dark mode.
// Para los iconos PWA forzamos blanco sobre fondo marca.
const svgOriginal = readFileSync(resolve(DIR_SALIDA, 'favicon.svg'), 'utf-8')
const svgBlanco = svgOriginal
  .replace(/<style>.*?<\/style>/, '') // Quitar media query
  .replace(/fill: #000;?/g, '')
  .replace('<path', '<path fill="#ffffff"') // Forzar blanco

mkdirSync(DIR_SALIDA, { recursive: true })

const ICONOS = [
  // Iconos estándar (logo centrado con ~20% padding)
  { nombre: 'icono-192.png', tamano: 192, padding: 0.2 },
  { nombre: 'icono-512.png', tamano: 512, padding: 0.2 },
  // Maskable (necesitan ~40% safe zone según spec)
  { nombre: 'icono-maskable-192.png', tamano: 192, padding: 0.35 },
  { nombre: 'icono-maskable-512.png', tamano: 512, padding: 0.35 },
  // Apple touch icon
  { nombre: 'apple-touch-icon.png', tamano: 180, padding: 0.2 },
  // Favicon
  { nombre: 'favicon-32.png', tamano: 32, padding: 0.15 },
  { nombre: 'favicon-16.png', tamano: 16, padding: 0.15 },
]

for (const { nombre, tamano, padding } of ICONOS) {
  const tamanoLogo = Math.round(tamano * (1 - padding * 2))
  const offset = Math.round((tamano - tamanoLogo) / 2)

  // Renderizar SVG al tamaño del logo
  const logoBuffer = await sharp(Buffer.from(svgBlanco))
    .resize(tamanoLogo, tamanoLogo)
    .png()
    .toBuffer()

  // Crear fondo marca y componer el logo centrado
  await sharp({
    create: {
      width: tamano,
      height: tamano,
      channels: 4,
      background: COLOR_MARCA,
    },
  })
    .composite([{ input: logoBuffer, top: offset, left: offset }])
    .png()
    .toFile(resolve(DIR_SALIDA, nombre))

  console.log(`✓ ${nombre} (${tamano}x${tamano})`)
}

console.log('\nIconos generados en public/iconos/')

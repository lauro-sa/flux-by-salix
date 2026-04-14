'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Pipette, Palette, Sparkles, RotateCcw } from 'lucide-react'
import { Boton } from './Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Input } from './Input'

/**
 * SelectorColor — selector de color de marca de la empresa.
 * Un solo color. Tres fuentes:
 *   1. Presets profesionales/corporativos
 *   2. Colores extraídos del logo (si hay)
 *   3. Color personalizado (input hex + picker inline)
 * Incluye botón para restablecer al color default de Flux (#5b5bd6).
 * Se usa en: configuración de empresa.
 */

interface PropiedadesSelectorColor {
  valor: string
  onChange: (color: string) => void
  coloresLogo?: string[]
}

const COLOR_DEFAULT = '#5b5bd6' // Índigo Attio — color default de Flux

// Colores corporativos profesionales — sobrios, usables en documentos y branding
const PRESETS = [
  { color: '#1e3a5f', nombre: 'Navy' },
  { color: '#2563eb', nombre: 'Azul corporativo' },
  { color: '#0f766e', nombre: 'Verde oscuro' },
  { color: '#15803d', nombre: 'Esmeralda' },
  { color: '#7c3aed', nombre: 'Violeta' },
  { color: '#5b5bd6', nombre: 'Índigo (Flux)' },
  { color: '#9f1239', nombre: 'Bordó' },
  { color: '#b45309', nombre: 'Dorado' },
  { color: '#334155', nombre: 'Gris pizarra' },
  { color: '#0c4a6e', nombre: 'Petróleo' },
  { color: '#581c87', nombre: 'Púrpura' },
  { color: '#1e293b', nombre: 'Carbón' },
]

/**
 * Extrae colores dominantes de una imagen.
 * Primero carga la imagen como blob para evitar CORS,
 * luego la dibuja en canvas y analiza los píxeles.
 */
async function extraerColoresDeImagen(urlImagen: string, cantidad: number = 3): Promise<string[]> {
  try {
    // Cargar como blob para evitar CORS
    const respuesta = await fetch(urlImagen)
    if (!respuesta.ok) return []
    const blob = await respuesta.blob()
    const urlLocal = URL.createObjectURL(blob)

    return new Promise((resolve) => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        // Tamaño más grande para mejor muestreo
        const tamano = 80
        canvas.width = tamano
        canvas.height = tamano

        // Fondo blanco para que PNGs con transparencia no den negro
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, tamano, tamano)
        ctx.drawImage(img, 0, 0, tamano, tamano)

        URL.revokeObjectURL(urlLocal)

        const datos = ctx.getImageData(0, 0, tamano, tamano).data
        const coloresMap = new Map<string, number>()

        for (let i = 0; i < datos.length; i += 4) {
          // Agrupamiento fino, clampeado a 0-255
          const r = Math.min(255, Math.round(datos[i] / 8) * 8)
          const g = Math.min(255, Math.round(datos[i + 1] / 8) * 8)
          const b = Math.min(255, Math.round(datos[i + 2] / 8) * 8)

          // Descartar solo blancos puros y negros puros
          if (r > 250 && g > 250 && b > 250) continue
          if (r < 5 && g < 5 && b < 5) continue

          // Descartar grises muy neutros (sin saturación)
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturacion = max === 0 ? 0 : (max - min) / max
          if (saturacion < 0.08 && max > 30 && max < 230) continue

          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
          coloresMap.set(hex, (coloresMap.get(hex) || 0) + 1)
        }

        const ordenados = [...coloresMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, cantidad)
          .map(([color]) => color)

        resolve(ordenados)
      }

      img.onerror = () => { URL.revokeObjectURL(urlLocal); resolve([]) }
      img.src = urlLocal
    })
  } catch {
    return []
  }
}

/** Mini color picker inline — un cuadrado con hue slider */
function PickerInline({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hue, setHue] = useState(0)
  const [sat, setSat] = useState(100)
  const [light, setLight] = useState(40)
  const [hexInput, setHexInput] = useState(valor || '#6b7280')
  const arrastrando = useRef(false)

  // Parsear hex a HSL al montar
  useEffect(() => {
    const v = valor.startsWith('#') ? valor : '#6b7280'
    setHexInput(v)
    const r = parseInt(v.slice(1, 3), 16) / 255
    const g = parseInt(v.slice(3, 5), 16) / 255
    const b = parseInt(v.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    let h = 0, s = 0
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    setHue(Math.round(h * 360))
    setSat(Math.round(s * 100))
    setLight(Math.round(l * 100))
  }, []) // Solo al montar

  const hslAHex = useCallback((h: number, s: number, l: number): string => {
    s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }, [])

  const aplicarColor = (hex: string) => {
    setHexInput(hex)
    onChange(hex)
  }

  // Dibujar gradiente de saturación/luminosidad
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width, h = canvas.height

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const s = (x / w) * 100
        const l = 100 - (y / h) * 100
        ctx.fillStyle = `hsl(${hue}, ${s}%, ${l}%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [hue])

  const manejarClickCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const newSat = Math.round(x * 100)
    const newLight = Math.round(100 - y * 100)
    setSat(newSat)
    setLight(newLight)
    aplicarColor(hslAHex(hue, newSat, newLight))
  }

  const manejarMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!arrastrando.current) return
    manejarClickCanvas(e)
  }

  // Gotero — EyeDropper API del navegador
  const abrirGotero = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const EyeDropper = (window as any).EyeDropper
      if (!EyeDropper) return
      const dropper = new EyeDropper()
      const result = await dropper.open()
      if (result?.sRGBHex) aplicarColor(result.sRGBHex)
    } catch { /* usuario canceló */ }
  }

  const manejarHexInput = (hex: string) => {
    let limpio = hex.replace(/[^a-fA-F0-9#]/g, '')
    if (!limpio.startsWith('#')) limpio = '#' + limpio
    if (limpio.length > 7) limpio = limpio.slice(0, 7)
    setHexInput(limpio)
    if (/^#[a-fA-F0-9]{6}$/.test(limpio)) {
      onChange(limpio)
      // Actualizar HSL
      const r = parseInt(limpio.slice(1, 3), 16) / 255
      const g = parseInt(limpio.slice(3, 5), 16) / 255
      const b = parseInt(limpio.slice(5, 7), 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      let h = 0, s = 0
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        else if (max === g) h = ((b - r) / d + 2) / 6
        else h = ((r - g) / d + 4) / 6
      }
      setHue(Math.round(h * 360))
      setSat(Math.round(s * 100))
      setLight(Math.round(l * 100))
    }
  }

  const colorActual = hslAHex(hue, sat, light)

  return (
    <div className="space-y-3">
      {/* Canvas de saturación/luminosidad */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={200}
          height={120}
          className="w-full h-28 rounded-lg cursor-crosshair border border-borde-sutil"
          onMouseDown={(e) => { arrastrando.current = true; manejarClickCanvas(e) }}
          onMouseMove={manejarMouseMove}
          onMouseUp={() => { arrastrando.current = false }}
          onMouseLeave={() => { arrastrando.current = false }}
        />
        {/* Indicador de posición */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${sat}%`,
            top: `${100 - light}%`,
            backgroundColor: colorActual,
          }}
        />
      </div>

      {/* Slider de hue */}
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => {
          const h = parseInt(e.target.value)
          setHue(h)
          aplicarColor(hslAHex(h, sat, light))
        }}
        className="w-full h-3 rounded-full appearance-none cursor-pointer"
        style={{
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
        }}
      />

      {/* Fila: gotero + preview + hex input */}
      <div className="flex items-center gap-2">
        {/* Gotero — solo si el navegador lo soporta */}
        {'EyeDropper' in window && (
          <button
            type="button"
            onClick={abrirGotero}
            className="size-8 rounded-lg border border-borde-sutil flex items-center justify-center cursor-pointer hover:bg-superficie-hover transition-colors shrink-0"
            title="Gotero — elegir color de la pantalla"
          >
            <Pipette size={14} className="text-texto-terciario" />
          </button>
        )}

        {/* Preview del color */}
        <div
          className="size-8 rounded-full border border-borde-sutil shrink-0"
          style={{ backgroundColor: colorActual }}
        />

        {/* Input hex */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => manejarHexInput(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-sm text-texto-primario font-mono outline-none focus:border-texto-marca/50"
          maxLength={7}
        />
      </div>
    </div>
  )
}

function SelectorColor({ valor, onChange, coloresLogo = [] }: PropiedadesSelectorColor) {
  const [pickerAbierto, setPickerAbierto] = useState(false)
  const [inputHex, setInputHex] = useState(valor)
  const pickerBotonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })

  useEffect(() => { setInputHex(valor) }, [valor])

  // Calcular posición del picker relativa al viewport (se abre arriba del botón)
  useLayoutEffect(() => {
    if (!pickerAbierto || !pickerBotonRef.current) return
    const rect = pickerBotonRef.current.getBoundingClientRect()
    // Posicionar arriba del botón, alineado a la derecha
    setPickerPos({ top: rect.top - 8, left: rect.right - 224 }) // 224px = w-56
  }, [pickerAbierto])

  // Cerrar picker al hacer click afuera
  useEffect(() => {
    if (!pickerAbierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerBotonRef.current?.contains(target)) return
      if (pickerRef.current?.contains(target)) return
      setPickerAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerAbierto])

  // Reposicionar al hacer scroll o resize
  useEffect(() => {
    if (!pickerAbierto) return
    const handler = () => {
      if (pickerBotonRef.current) {
        const rect = pickerBotonRef.current.getBoundingClientRect()
        setPickerPos({ top: rect.top - 8, left: rect.right - 224 })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [pickerAbierto])

  const esSeleccionado = (color: string) => valor.toLowerCase() === color.toLowerCase()
  const esDefault = valor.toLowerCase() === COLOR_DEFAULT.toLowerCase()

  const manejarHexChange = (hex: string) => {
    let limpio = hex.replace(/[^a-fA-F0-9#]/g, '')
    if (!limpio.startsWith('#')) limpio = '#' + limpio
    if (limpio.length > 7) limpio = limpio.slice(0, 7)
    setInputHex(limpio)
    if (/^#[a-fA-F0-9]{6}$/.test(limpio)) onChange(limpio)
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: valor + '15' }}>
          <Palette size={18} style={{ color: valor }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-texto-primario">Color de marca</h3>
          <p className="text-xs text-texto-terciario mt-0.5">
            Se usa en encabezados de documentos, PDFs, membretes y comunicaciones de la empresa.
          </p>
        </div>
        {/* Restablecer */}
        <Boton
          variante="fantasma"
          tamano="xs"
          icono={<RotateCcw size={12} />}
          onClick={() => onChange(COLOR_DEFAULT)}
          disabled={esDefault}
          className={esDefault ? 'opacity-0 pointer-events-none' : ''}
        >
          Restablecer
        </Boton>
      </div>

      {/* Preview del color actual */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-superficie-hover/50">
        <div className="w-10 h-10 rounded-lg border border-borde-sutil shadow-sm" style={{ backgroundColor: valor }} />
        <div>
          <p className="text-sm font-mono text-texto-primario">{valor.toUpperCase()}</p>
          <p className="text-xs text-texto-terciario">{esDefault ? 'Color de Flux (default)' : 'Color personalizado'}</p>
        </div>
      </div>

      {/* Colores extraídos del logo — solo si hay */}
      {coloresLogo.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-texto-marca" />
            <p className="text-xs font-medium text-texto-secundario">Colores de tu logo</p>
          </div>
          <div className="flex gap-2">
            {coloresLogo.map((color, i) => (
              <Tooltip key={i} contenido={color}>
                <button
                  onClick={() => onChange(color)}
                  className="relative w-8 h-8 rounded-lg border-2 transition-all duration-150 cursor-pointer hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: esSeleccionado(color) ? 'white' : 'transparent',
                    boxShadow: esSeleccionado(color) ? `0 0 0 2px ${color}` : 'none',
                  }}
                >
                  {esSeleccionado(color) && (
                    <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />
                  )}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Presets corporativos */}
      <div className="mb-4">
        <p className="text-xs font-medium text-texto-secundario mb-2">Colores corporativos</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <Tooltip key={preset.color} contenido={preset.nombre}>
              <button
                onClick={() => onChange(preset.color)}
                className="relative w-8 h-8 rounded-lg border-2 transition-all duration-150 cursor-pointer hover:scale-110"
                style={{
                  backgroundColor: preset.color,
                  borderColor: esSeleccionado(preset.color) ? 'white' : 'transparent',
                  boxShadow: esSeleccionado(preset.color) ? `0 0 0 2px ${preset.color}` : 'none',
                }}
              >
                {esSeleccionado(preset.color) && (
                  <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />
                )}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Color personalizado */}
      <div>
        <p className="text-xs font-medium text-texto-secundario mb-2">Color personalizado</p>
        <div className="flex items-center gap-2">
          <div className="w-32">
            <Input
              tipo="text"
              value={inputHex}
              onChange={(e) => manejarHexChange(e.target.value)}
              placeholder="#5b5bd6"
              compacto
              formato={null}
            />
          </div>

          <div>
            <Boton
              ref={pickerBotonRef}
              variante="secundario"
              tamano="sm"
              soloIcono
              titulo="Elegir color"
              icono={<Pipette size={14} />}
              onClick={() => setPickerAbierto(!pickerAbierto)}
            />

            {/* Picker inline en popover — portal para evitar clipping */}
            {typeof window !== 'undefined' && createPortal(
              <AnimatePresence>
                {pickerAbierto && (
                  <motion.div
                    ref={pickerRef}
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="fixed bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg p-3 w-56"
                    style={{
                      top: pickerPos.top,
                      left: pickerPos.left,
                      transform: 'translateY(-100%)',
                      zIndex: 'var(--z-popover)' as unknown as number,
                    }}
                  >
                    <PickerInline valor={valor} onChange={onChange} />
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { SelectorColor, PickerInline, extraerColoresDeImagen }

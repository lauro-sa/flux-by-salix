'use client'

/**
 * Mini picker HSL — vista secundaria del panel de color.
 * Permite seleccionar un color con canvas (saturacion x luminosidad),
 * slider de tono (hue) y input hex manual.
 */

import { useCallback, useState, useEffect, useRef } from 'react'

interface PropiedadesPickerHSL {
  valorInicial: string
  onAplicar: (color: string) => void
  onVolver?: () => void
}

export function PickerHSL({ valorInicial, onAplicar }: PropiedadesPickerHSL) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hue, setHue] = useState(220)
  const [sat, setSat] = useState(80)
  const [light, setLight] = useState(50)
  const [hexInput, setHexInput] = useState(valorInicial || '#3b82f6')
  const arrastrando = useRef(false)

  // Convertir HSL a hex
  const hslAHex = useCallback((h: number, s: number, l: number): string => {
    const s2 = s / 100, l2 = l / 100
    const a = s2 * Math.min(l2, 1 - l2)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const c = l2 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * Math.max(0, Math.min(1, c))).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }, [])

  // Parsear color inicial a HSL
  useEffect(() => {
    if (!valorInicial || valorInicial === 'inherit') return
    try {
      const r = parseInt(valorInicial.slice(1, 3), 16) / 255
      const g = parseInt(valorInicial.slice(3, 5), 16) / 255
      const b = parseInt(valorInicial.slice(5, 7), 16) / 255
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
      setHue(Math.round(h * 360)); setSat(Math.round(s * 100)); setLight(Math.round(l * 100))
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dibujar canvas del gradiente saturacion x luminosidad
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width, h = canvas.height
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = `hsl(${hue}, ${(x / w) * 100}%, ${100 - (y / h) * 100}%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [hue])

  // Manejar interaccion con el canvas
  const manejar = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const ns = Math.round(x * 100), nl = Math.round(100 - y * 100)
    setSat(ns); setLight(nl)
    const hex = hslAHex(hue, ns, nl)
    setHexInput(hex)
  }

  const colorActual = hslAHex(hue, sat, light)

  return (
    <div>
      <div className="p-3 space-y-2.5 min-w-[220px]">
        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef} width={160} height={96}
            className="w-full h-24 rounded-lg cursor-crosshair"
            onMouseDown={(e) => { arrastrando.current = true; manejar(e) }}
            onMouseMove={(e) => { if (arrastrando.current) manejar(e) }}
            onMouseUp={() => arrastrando.current = false}
            onMouseLeave={() => arrastrando.current = false}
          />
          <div
            className="absolute size-3 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${sat}%`, top: `${100 - light}%`, backgroundColor: colorActual }}
          />
        </div>

        {/* Hue slider */}
        <input
          type="range" min={0} max={360} value={hue}
          onChange={(e) => { const h = +e.target.value; setHue(h); setHexInput(hslAHex(h, sat, light)) }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
        />

        {/* Hex input + preview + aplicar */}
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg border border-borde-sutil shrink-0" style={{ backgroundColor: colorActual }} />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const v = e.target.value
              setHexInput(v)
              if (/^#[a-fA-F0-9]{6}$/.test(v)) {
                // Parsear hex y actualizar sliders
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
                setHue(Math.round(h * 360)); setSat(Math.round(s * 100)); setLight(Math.round(l * 100))
              }
            }}
            className="flex-1 text-xs font-mono bg-superficie-hover/50 text-texto-primario rounded-md px-2 py-1.5 outline-none border border-borde-sutil focus:border-texto-marca min-w-0"
            placeholder="#3b82f6"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAplicar(colorActual)}
            className="text-xs font-medium text-white bg-texto-marca hover:bg-texto-marca/90 rounded-md px-3 py-1.5 transition-colors shrink-0"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

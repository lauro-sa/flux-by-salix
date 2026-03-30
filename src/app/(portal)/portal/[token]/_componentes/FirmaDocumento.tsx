'use client'

/**
 * FirmaDocumento — Firma digital con 3 modos: automática, dibujar, subir.
 * Basado en el diseño del portal anterior (FirmaDocumento.jsx).
 * Se usa en: VistaPortal (se despliega al aceptar)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pen, Pencil, Upload, Trash2, Check } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

type ModoFirma = 'auto' | 'dibujar' | 'subir'

interface Props {
  nombrePredeterminado: string
  onFirmar: (datos: { base64: string | null; nombre: string; modo: ModoFirma }) => void
  onCancelar: () => void
}

export default function FirmaDocumento({ nombrePredeterminado, onFirmar, onCancelar }: Props) {
  const { t } = useTraduccion()

  const MODOS = [
    { id: 'auto' as const, label: t('portal.firma_modo_auto'), icono: Pen },
    { id: 'dibujar' as const, label: t('portal.firma_modo_dibujar'), icono: Pencil },
    { id: 'subir' as const, label: t('portal.firma_modo_subir'), icono: Upload },
  ]

  const [modo, setModo] = useState<ModoFirma>('auto')
  const [nombre, setNombre] = useState(nombrePredeterminado)
  const [firmaAutoBase64, setFirmaAutoBase64] = useState<string | null>(null)
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dibujandoRef = useRef(false)
  const puntosRef = useRef<{ x: number; y: number }[]>([])

  // ── Modo auto: generar firma cursiva en canvas ──
  useEffect(() => {
    if (modo !== 'auto' || !nombre.trim()) {
      setFirmaAutoBase64(null)
      return
    }
    const generar = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 500
      canvas.height = 150
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 500, 150)
      ctx.font = 'italic 48px "Dancing Script", "Brush Script MT", cursive, serif'
      ctx.fillStyle = '#3b82f6'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(nombre.trim(), 250, 75)
      setFirmaAutoBase64(canvas.toDataURL('image/png'))
    }
    if (document.fonts?.load) {
      document.fonts.load('48px "Dancing Script"').then(generar).catch(generar)
    } else {
      generar()
    }
  }, [modo, nombre])

  // ── Modo dibujar ──
  const obtenerCoordenadas = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    if (clientX === undefined || clientY === undefined) return null
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const iniciarTrazo = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    dibujandoRef.current = true
    const coords = obtenerCoordenadas(e)
    if (!coords) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    puntosRef.current.push(coords)
  }, [obtenerCoordenadas])

  const continuarTrazo = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dibujandoRef.current) return
    e.preventDefault()
    const coords = obtenerCoordenadas(e)
    if (!coords) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#3b82f6'
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    puntosRef.current.push(coords)
  }, [obtenerCoordenadas])

  const terminarTrazo = useCallback(() => { dibujandoRef.current = false }, [])

  const limpiarCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    puntosRef.current = []
  }, [])

  // ── Modo subir ──
  const handleArchivo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => setArchivoBase64(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  // ── Confirmar ──
  const handleConfirmar = () => {
    let base64: string | null = null
    if (modo === 'auto') base64 = firmaAutoBase64
    else if (modo === 'dibujar' && canvasRef.current && puntosRef.current.length > 5) {
      base64 = canvasRef.current.toDataURL('image/png')
    } else if (modo === 'subir') base64 = archivoBase64
    onFirmar({ base64, nombre: nombre.trim() || nombrePredeterminado, modo })
  }

  const firmaValida = (modo === 'auto' && firmaAutoBase64 && nombre.trim())
    || (modo === 'dibujar' && puntosRef.current.length > 5)
    || (modo === 'subir' && archivoBase64)

  return (
    <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil overflow-hidden">
      {/* Título */}
      <div className="px-5 py-4 border-b border-borde-sutil">
        <h3 className="text-lg font-semibold text-texto-primario">{t('portal.firma')}</h3>
        <p className="text-sm text-texto-terciario mt-1">{t('portal.firma_instruccion')}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-borde-sutil">
        {MODOS.map(m => {
          const Icono = m.icono
          return (
            <button
              key={m.id}
              onClick={() => setModo(m.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                modo === m.id
                  ? 'text-marca-500 border-b-2 border-marca-500 bg-marca-500/5'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              <Icono size={16} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Contenido según modo */}
      <div className="p-5">
        {modo === 'auto' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto-secundario mb-1.5">{t('portal.nombre_firmante')}</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder={t('portal.firma_placeholder')}
                className="w-full px-4 py-2.5 rounded-lg border border-borde-sutil bg-superficie-app text-texto-primario placeholder:text-texto-terciario focus:ring-2 focus:ring-marca-500/30 focus:border-marca-500 outline-none transition"
              />
            </div>
            <div className="bg-superficie-app rounded-lg border border-dashed border-borde-fuerte p-6 flex items-center justify-center min-h-[120px]">
              {firmaAutoBase64 ? (
                <img src={firmaAutoBase64} alt="Firma" className="max-h-[100px] max-w-full" />
              ) : (
                <span className="text-texto-terciario text-sm">{t('portal.firma_escriba_nombre')}</span>
              )}
            </div>
          </div>
        )}

        {modo === 'dibujar' && (
          <div className="space-y-3">
            <div className="relative bg-superficie-app rounded-lg border border-dashed border-borde-fuerte overflow-hidden">
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full cursor-crosshair touch-none"
                style={{ height: '150px' }}
                onMouseDown={iniciarTrazo}
                onMouseMove={continuarTrazo}
                onMouseUp={terminarTrazo}
                onMouseLeave={terminarTrazo}
                onTouchStart={iniciarTrazo}
                onTouchMove={continuarTrazo}
                onTouchEnd={terminarTrazo}
              />
              <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-texto-terciario pointer-events-none">
                {t('portal.firma_dibuje_aqui')}
              </p>
            </div>
            <button
              onClick={limpiarCanvas}
              className="text-sm text-texto-terciario hover:text-estado-error flex items-center gap-1 transition-colors"
            >
              <Trash2 size={14} />
              {t('portal.limpiar')}
            </button>
          </div>
        )}

        {modo === 'subir' && (
          <div className="space-y-4">
            {archivoBase64 ? (
              <div className="space-y-3">
                <div className="bg-superficie-app rounded-lg border border-borde-sutil p-6 flex items-center justify-center">
                  <img src={archivoBase64} alt="Firma subida" className="max-h-[100px] max-w-full" />
                </div>
                <button
                  onClick={() => setArchivoBase64(null)}
                  className="text-sm text-texto-terciario hover:text-estado-error flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={14} />
                  {t('portal.firma_quitar_imagen')}
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed border-borde-fuerte cursor-pointer hover:border-marca-500 hover:bg-marca-500/5 transition-colors">
                <Upload size={28} className="text-texto-terciario" />
                <span className="text-sm text-texto-terciario">{t('portal.firma_seleccione_imagen')}</span>
                <span className="text-xs text-texto-terciario">{t('portal.firma_formatos')}</span>
                <input type="file" accept="image/*" onChange={handleArchivo} className="hidden" />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="px-5 py-4 border-t border-borde-sutil flex items-center justify-end gap-3">
        <button onClick={onCancelar} className="px-4 py-2 text-sm font-medium text-texto-terciario hover:text-texto-primario transition-colors">
          {t('comun.cancelar')}
        </button>
        <button
          onClick={handleConfirmar}
          disabled={!firmaValida}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-insignia-exito hover:bg-insignia-exito/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
        >
          <Check size={16} />
          {t('portal.firmar')}
        </button>
      </div>
    </div>
  )
}

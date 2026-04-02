'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ModalAdaptable as Modal } from './ModalAdaptable'
import { Boton } from './Boton'
import { Upload, Trash2, Square, RectangleHorizontal, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

/**
 * CargadorLogo — Subir y encuadrar logos de empresa.
 * Dos variantes: cuadrado (1:1) y apaisado (3:1).
 * Editor con:
 *   - Zoom (slider + botones + scroll del mouse)
 *   - Arrastrar para mover la imagen
 *   - Marco de recorte fijo con aspect ratio, la imagen se mueve adentro
 *   - Reset para volver al encuadre original
 * Se usa en: configuración de empresa (SeccionGeneral).
 */

type VarianteLogo = 'cuadrado' | 'apaisado'

interface PropiedadesCargadorLogo {
  variante: VarianteLogo
  urlActual?: string | null
  onSubir: (archivo: Blob, variante: VarianteLogo) => Promise<void>
  onEliminar?: () => Promise<void>
}

const TAMAÑOS_SALIDA: Record<VarianteLogo, { ancho: number; alto: number }> = {
  cuadrado: { ancho: 512, alto: 512 },
  apaisado: { ancho: 1200, alto: 400 },
}

const ETIQUETAS: Record<VarianteLogo, { titulo: string; descripcion: string; icono: React.ReactNode }> = {
  cuadrado: {
    titulo: 'Logo cuadrado',
    descripcion: 'Se usa en el sidebar, avatares y favicon. Formato 1:1.',
    icono: <Square size={20} />,
  },
  apaisado: {
    titulo: 'Logo horizontal',
    descripcion: 'Se usa en documentos, membretes y encabezados. Formato 3:1.',
    icono: <RectangleHorizontal size={20} />,
  },
}

function CargadorLogo({ variante, urlActual, onSubir, onEliminar }: PropiedadesCargadorLogo) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [imagenSrc, setImagenSrc] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  // Estado del editor
  const [zoom, setZoom] = useState(1)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 })
  const [imagenCargada, setImagenCargada] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const arrastrando = useRef(false)
  const ultimaPosicion = useRef({ x: 0, y: 0 })

  const info = ETIQUETAS[variante]
  const aspect = variante === 'cuadrado' ? 1 : 3

  // Dimensiones del área de recorte dentro del modal
  const AREA_ANCHO = 400
  const AREA_ALTO = variante === 'cuadrado' ? 400 : Math.round(400 / 3)

  const manejarSeleccion = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    const reader = new FileReader()
    reader.onload = () => {
      setImagenSrc(reader.result as string)
      setZoom(1)
      setPosicion({ x: 0, y: 0 })
      setImagenCargada(false)
      setModalAbierto(true)
    }
    reader.readAsDataURL(archivo)
    e.target.value = ''
  }

  // Cargar imagen y centrar
  useEffect(() => {
    if (!imagenSrc || !modalAbierto) return

    const img = new Image()
    img.onload = () => {
      imgRef.current = img

      // Calcular zoom mínimo para que la imagen cubra el área
      const escalaX = AREA_ANCHO / img.naturalWidth
      const escalaY = AREA_ALTO / img.naturalHeight
      const zoomMinimo = Math.max(escalaX, escalaY)

      setZoom(zoomMinimo)
      setPosicion({ x: 0, y: 0 })
      setImagenCargada(true)
    }
    img.src = imagenSrc
  }, [imagenSrc, modalAbierto, AREA_ANCHO, AREA_ALTO])

  // Dibujar canvas
  const dibujar = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')!
    canvas.width = AREA_ANCHO * 2 // retina
    canvas.height = AREA_ALTO * 2
    ctx.scale(2, 2)

    // Fondo oscuro
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, AREA_ANCHO, AREA_ALTO)

    // Dibujar imagen con zoom y posición
    const imgAncho = img.naturalWidth * zoom
    const imgAlto = img.naturalHeight * zoom
    const x = (AREA_ANCHO - imgAncho) / 2 + posicion.x
    const y = (AREA_ALTO - imgAlto) / 2 + posicion.y

    ctx.drawImage(img, x, y, imgAncho, imgAlto)
  }, [zoom, posicion, AREA_ANCHO, AREA_ALTO])

  useEffect(() => {
    if (imagenCargada) dibujar()
  }, [imagenCargada, dibujar])

  // Mouse handlers para arrastrar
  const manejarMouseDown = (e: React.MouseEvent) => {
    arrastrando.current = true
    ultimaPosicion.current = { x: e.clientX, y: e.clientY }
  }

  const manejarMouseMove = (e: React.MouseEvent) => {
    if (!arrastrando.current) return
    const dx = e.clientX - ultimaPosicion.current.x
    const dy = e.clientY - ultimaPosicion.current.y
    ultimaPosicion.current = { x: e.clientX, y: e.clientY }
    setPosicion(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const manejarMouseUp = () => { arrastrando.current = false }

  // Zoom con scroll
  const manejarWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom(prev => Math.max(0.1, Math.min(5, prev + delta)))
  }

  // Touch handlers para mobile
  const manejarTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      arrastrando.current = true
      ultimaPosicion.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const manejarTouchMove = (e: React.TouchEvent) => {
    if (!arrastrando.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - ultimaPosicion.current.x
    const dy = e.touches[0].clientY - ultimaPosicion.current.y
    ultimaPosicion.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setPosicion(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const manejarTouchEnd = () => { arrastrando.current = false }

  // Reset
  const resetear = () => {
    if (!imgRef.current) return
    const escalaX = AREA_ANCHO / imgRef.current.naturalWidth
    const escalaY = AREA_ALTO / imgRef.current.naturalHeight
    setZoom(Math.max(escalaX, escalaY))
    setPosicion({ x: 0, y: 0 })
  }

  // Guardar
  const manejarGuardar = async () => {
    const img = imgRef.current
    if (!img) return

    setSubiendo(true)

    const salida = TAMAÑOS_SALIDA[variante]
    const canvas = document.createElement('canvas')
    canvas.width = salida.ancho
    canvas.height = salida.alto
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'

    // Calcular qué parte de la imagen original corresponde al recorte visible
    const imgAncho = img.naturalWidth * zoom
    const imgAlto = img.naturalHeight * zoom
    const vistaX = (AREA_ANCHO - imgAncho) / 2 + posicion.x
    const vistaY = (AREA_ALTO - imgAlto) / 2 + posicion.y

    // Convertir coordenadas del canvas a coordenadas de la imagen original
    const srcX = -vistaX / zoom
    const srcY = -vistaY / zoom
    const srcAncho = AREA_ANCHO / zoom
    const srcAlto = AREA_ALTO / zoom

    ctx.drawImage(img, srcX, srcY, srcAncho, srcAlto, 0, 0, salida.ancho, salida.alto)

    canvas.toBlob(async (blob) => {
      if (blob) {
        await onSubir(blob, variante)
      }
      setModalAbierto(false)
      setImagenSrc(null)
      setSubiendo(false)
    }, 'image/png', 1)
  }

  const manejarEliminar = async () => {
    if (!onEliminar) return
    setSubiendo(true)
    await onEliminar()
    setSubiendo(false)
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0 mt-0.5 text-texto-marca">
          {info.icono}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-texto-primario">{info.titulo}</h3>
          <p className="text-xs text-texto-terciario mt-0.5">{info.descripcion}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={[
            'border-2 border-dashed border-borde-fuerte rounded-xl flex items-center justify-center overflow-hidden bg-superficie-hover',
            variante === 'cuadrado' ? 'w-20 h-20' : 'w-48 h-16',
          ].join(' ')}
        >
          {urlActual ? (
            <img src={urlActual} alt={info.titulo} className="w-full h-full object-contain" />
          ) : (
            <span className="text-texto-terciario text-xs text-center px-2">Sin logo</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Boton variante="secundario" tamano="sm" icono={<Upload size={14} />} onClick={() => inputRef.current?.click()}>
            {urlActual ? 'Cambiar' : 'Subir'}
          </Boton>
          {urlActual && onEliminar && (
            <Boton variante="fantasma" tamano="sm" icono={<Trash2 size={14} />} onClick={manejarEliminar} cargando={subiendo}>
              Quitar
            </Boton>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={manejarSeleccion} className="hidden" />

      {/* Modal editor */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setImagenSrc(null) }}
        titulo={`Encuadrar ${info.titulo.toLowerCase()}`}
        tamano="md"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => { setModalAbierto(false); setImagenSrc(null) }}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={manejarGuardar} cargando={subiendo}>
              Guardar
            </Boton>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-texto-terciario text-center">
            Arrastrá para mover y usá el zoom para ajustar el encuadre.
          </p>

          {/* Área de recorte */}
          <div
            ref={contenedorRef}
            className="relative rounded-lg overflow-hidden border border-borde-fuerte cursor-grab active:cursor-grabbing select-none"
            style={{ width: AREA_ANCHO, height: AREA_ALTO, maxWidth: '100%' }}
            onMouseDown={manejarMouseDown}
            onMouseMove={manejarMouseMove}
            onMouseUp={manejarMouseUp}
            onMouseLeave={manejarMouseUp}
            onWheel={manejarWheel}
            onTouchStart={manejarTouchStart}
            onTouchMove={manejarTouchMove}
            onTouchEnd={manejarTouchEnd}
          >
            <canvas
              ref={canvasRef}
              style={{ width: AREA_ANCHO, height: AREA_ALTO, maxWidth: '100%', display: 'block' }}
            />
            {/* Borde del marco */}
            <div className="absolute inset-0 border-2 border-white/20 rounded-lg pointer-events-none" />
          </div>

          {/* Controles de zoom */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Alejar" icono={<ZoomOut size={14} />} onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} />
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-borde-fuerte cursor-pointer"
            />
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Acercar" icono={<ZoomIn size={14} />} onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} />
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Restablecer zoom" icono={<RotateCcw size={14} />} onClick={resetear} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export { CargadorLogo, type VarianteLogo }

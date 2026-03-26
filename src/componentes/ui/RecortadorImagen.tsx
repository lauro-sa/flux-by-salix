'use client'

import { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { ZoomIn, ZoomOut, RotateCcw, Check, ImagePlus } from 'lucide-react'
import { Boton } from './Boton'
import { Modal } from './Modal'

/**
 * RecortadorImagen — Modal con crop, zoom y rotación.
 * Soporta cualquier aspect ratio (1:1 para avatar, 3:4 para kiosco, etc.)
 * Se usa en: perfil de usuario (avatar, foto kiosco), contactos, empresa.
 */

interface PropiedadesRecortador {
  /** URL de la imagen a recortar (blob o URL) */
  imagen: string
  /** Relación de aspecto (1 para cuadrado, 3/4 para vertical, 16/9 para horizontal) */
  aspecto: number
  /** Si el crop es circular (para avatares) */
  circular?: boolean
  /** Título del modal */
  titulo?: string
  /** Callback con el blob recortado */
  onConfirmar: (blob: Blob) => void
  /** Callback al cancelar */
  onCancelar: () => void
  /** Callback para cambiar la imagen (abre file picker y pasa nueva URL) */
  onCambiarImagen?: (nuevaUrl: string) => void
}

/** Recorta una imagen usando canvas */
async function recortarImagen(imagenSrc: string, areaCrop: Area, rotacion: number = 0): Promise<Blob> {
  const imagen = new Image()
  imagen.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    imagen.onload = () => resolve()
    imagen.onerror = reject
    imagen.src = imagenSrc
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Calcular tamaño del canvas con rotación
  const radians = (rotacion * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const anchoRotado = imagen.width * cos + imagen.height * sin
  const altoRotado = imagen.width * sin + imagen.height * cos

  canvas.width = anchoRotado
  canvas.height = altoRotado

  // Rotar
  ctx.translate(anchoRotado / 2, altoRotado / 2)
  ctx.rotate(radians)
  ctx.translate(-imagen.width / 2, -imagen.height / 2)
  ctx.drawImage(imagen, 0, 0)

  // Extraer el área recortada
  const datos = ctx.getImageData(areaCrop.x, areaCrop.y, areaCrop.width, areaCrop.height)
  canvas.width = areaCrop.width
  canvas.height = areaCrop.height
  ctx.putImageData(datos, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92)
  })
}

function RecortadorImagen({
  imagen,
  aspecto,
  circular = false,
  titulo = 'Recortar imagen',
  onConfirmar,
  onCancelar,
  onCambiarImagen,
}: PropiedadesRecortador) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotacion, setRotacion] = useState(0)
  const [areaCropCompleta, setAreaCropCompleta] = useState<Area | null>(null)
  const [procesando, setProcesando] = useState(false)
  const inputCambiarRef = useRef<HTMLInputElement>(null)

  const onCropComplete = useCallback((_: Area, areaPixeles: Area) => {
    setAreaCropCompleta(areaPixeles)
  }, [])

  const confirmar = useCallback(async () => {
    if (!areaCropCompleta) return
    setProcesando(true)
    try {
      const blob = await recortarImagen(imagen, areaCropCompleta, rotacion)
      onConfirmar(blob)
    } catch {
      // Error al recortar
    }
    setProcesando(false)
  }, [imagen, areaCropCompleta, rotacion, onConfirmar])

  return (
    <Modal
      abierto={true}
      onCerrar={onCancelar}
      titulo={titulo}
      tamano="md"
      acciones={
        <div className="flex items-center gap-3 w-full">
          <Boton
            variante="primario"
            icono={<Check size={16} />}
            cargando={procesando}
            onClick={confirmar}
          >
            Aplicar
          </Boton>
          <Boton variante="fantasma" onClick={onCancelar}>
            Cancelar
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Área de recorte */}
        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
          <Cropper
            image={imagen}
            crop={crop}
            zoom={zoom}
            rotation={rotacion}
            aspect={aspecto}
            cropShape={circular ? 'round' : 'rect'}
            showGrid={!circular}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotacion}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3">
          {/* Zoom */}
          <div className="flex items-center gap-2 flex-1">
            <ZoomOut size={14} className="text-texto-terciario shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-texto-marca h-1"
            />
            <ZoomIn size={14} className="text-texto-terciario shrink-0" />
          </div>

          {/* Rotar */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<RotateCcw size={14} />}
            onClick={() => setRotacion(r => (r - 90) % 360)}
          />

          {/* Cambiar imagen */}
          {onCambiarImagen && (
            <>
              <input
                ref={inputCambiarRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (!archivo) return
                  const url = URL.createObjectURL(archivo)
                  onCambiarImagen(url)
                  setCrop({ x: 0, y: 0 })
                  setZoom(1)
                  setRotacion(0)
                  e.target.value = ''
                }}
              />
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<ImagePlus size={14} />}
                onClick={() => inputCambiarRef.current?.click()}
              >
                Otra
              </Boton>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export { RecortadorImagen, type PropiedadesRecortador }

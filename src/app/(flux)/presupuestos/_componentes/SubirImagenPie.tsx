'use client'

import { useState, useRef } from 'react'
import { Upload, Trash2, Image } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

/**
 * Componente simple para subir una imagen al pie de página del PDF.
 * Acepta cualquier imagen (QR, firma, logo secundario).
 * La redimensiona a max 200x200px en PNG para mantener calidad sin peso.
 * Se usa en: configuración del pie de página de presupuestos.
 */

interface PropiedadesSubirImagenPie {
  urlActual: string | null
  onSubir: (blob: Blob) => Promise<void>
  onEliminar: () => Promise<void>
}

function redimensionarImagen(archivo: File, maxPx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const escala = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const ancho = Math.round(img.width * escala)
      const alto = Math.round(img.height * escala)
      const canvas = document.createElement('canvas')
      canvas.width = ancho
      canvas.height = alto
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, ancho, alto)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Error al procesar imagen')),
        'image/png',
        1
      )
    }
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = URL.createObjectURL(archivo)
  })
}

export default function SubirImagenPie({ urlActual, onSubir, onEliminar }: PropiedadesSubirImagenPie) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const manejarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError('')
    try {
      const blob = await redimensionarImagen(archivo, 200)
      await onSubir(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
    }
    setSubiendo(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const tieneImagen = urlActual && !urlActual.includes('undefined')

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={manejarArchivo} className="hidden" />

      {tieneImagen ? (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg border border-borde-sutil bg-white flex items-center justify-center overflow-hidden">
            <img src={urlActual} alt="Imagen pie" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Boton variante="fantasma" tamano="xs" icono={<Upload size={13} />} onClick={() => inputRef.current?.click()} disabled={subiendo}>Cambiar</Boton>
            <Boton variante="fantasma" tamano="xs" icono={<Trash2 size={13} />} onClick={async () => { setSubiendo(true); await onEliminar(); setSubiendo(false) }} disabled={subiendo} className="text-estado-error/70 hover:text-estado-error">Quitar</Boton>
          </div>
        </div>
      ) : (
        <Boton variante="secundario" tamano="sm" anchoCompleto icono={<Image size={16} />} onClick={() => inputRef.current?.click()} disabled={subiendo} className="border-dashed">
          {subiendo ? 'Subiendo...' : 'Subir imagen (QR, firma, logo)'}
        </Boton>
      )}
      {error && <p className="text-xs text-estado-error mt-1">{error}</p>}
    </div>
  )
}

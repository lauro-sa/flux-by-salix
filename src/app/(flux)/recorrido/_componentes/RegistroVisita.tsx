'use client'

/**
 * RegistroVisita — BottomSheet para registrar/editar visita.
 * Funcionalidades:
 * - Captura ubicación GPS automática
 * - Fotos: cámara O galería (2 botones separados)
 * - Preview de fotos nuevas + fotos ya subidas
 * - Eliminar fotos (nuevas o ya subidas)
 * - Notas de texto
 * - Resultado (al completar)
 * - Checklist interactivo
 * - Carga datos previos al abrir (edición)
 * Se usa en: PaginaRecorrido.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Image as ImageIcon, X, Loader2, MapPin, Trash2 } from 'lucide-react'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'

interface ItemChecklist {
  texto: string
  completado: boolean
}

interface FotoExistente {
  chatter_id: string
  url: string
  nombre: string
  eliminando?: boolean
}

interface PropiedadesRegistroVisita {
  abierto: boolean
  onCerrar: () => void
  visitaId: string
  /** 'llegada' = cambiar a en_sitio, 'completar' = completar visita, 'editar' = solo editar datos */
  modo: 'llegada' | 'completar' | 'editar'
  checklist?: ItemChecklist[]
  onExito: () => void
  /** Datos del contacto para mostrar en el header */
  contactoNombre?: string
  contactoDireccion?: string
}

function RegistroVisita({
  abierto,
  onCerrar,
  visitaId,
  modo,
  checklist: checklistInicial,
  onExito,
  contactoNombre,
  contactoDireccion,
}: PropiedadesRegistroVisita) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()

  const [notas, setNotas] = useState('')
  const [resultado, setResultado] = useState('')
  const [temperatura, setTemperatura] = useState<'frio' | 'tibio' | 'caliente' | null>(null)
  const [checklist, setChecklist] = useState<ItemChecklist[]>(checklistInicial || [])
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([])
  const [previewsNuevas, setPreviewsNuevas] = useState<string[]>([])
  const [fotosExistentes, setFotosExistentes] = useState<FotoExistente[]>([])
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number; precision: number } | null>(null)
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputCamaraRef = useRef<HTMLInputElement>(null)
  const inputGaleriaRef = useRef<HTMLInputElement>(null)

  // Cargar datos previos al abrir
  useEffect(() => {
    if (!abierto || !visitaId) return

    const cargarDatos = async () => {
      setCargandoDatos(true)
      try {
        const resp = await fetch(`/api/recorrido/registro?visita_id=${visitaId}`)
        if (!resp.ok) throw new Error()
        const data = await resp.json()

        // Cargar datos de la visita
        if (data.visita) {
          setNotas(data.visita.notas || '')
          setResultado(data.visita.resultado || '')
          setTemperatura(data.visita.temperatura || null)
          if (data.visita.checklist && Array.isArray(data.visita.checklist)) {
            setChecklist(data.visita.checklist as ItemChecklist[])
          }
        }

        // Cargar fotos existentes
        if (data.fotos?.length) {
          setFotosExistentes(data.fotos.map((f: FotoExistente) => ({
            chatter_id: f.chatter_id,
            url: f.url,
            nombre: f.nombre,
          })))
        }
      } catch { /* sin datos previos */ }
      setCargandoDatos(false)
    }

    cargarDatos()

    // Limpiar fotos nuevas al abrir
    setFotosNuevas([])
    setPreviewsNuevas([])
  }, [abierto, visitaId])

  // Obtener ubicación
  const obtenerUbicacion = useCallback(() => {
    if (!navigator.geolocation) return
    setCargandoUbicacion(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        })
        setCargandoUbicacion(false)
      },
      () => {
        setCargandoUbicacion(false)
        mostrar('error', 'No se pudo obtener la ubicación')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [mostrar])

  // Auto-obtener ubicación al abrir (solo para llegada)
  useEffect(() => {
    if (abierto && !ubicacion && modo === 'llegada') obtenerUbicacion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Comprimir imagen: redimensionar a max 1200px y convertir a JPEG 80%
  const comprimirImagen = useCallback((archivo: File): Promise<File> => {
    return new Promise((resolve) => {
      // Si es menor a 500KB, no comprimir
      if (archivo.size < 500 * 1024) { resolve(archivo); return }

      const img = new Image()
      const url = URL.createObjectURL(archivo)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const nombre = archivo.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg') || `foto_${Date.now()}.jpg`
              resolve(new File([blob], nombre, { type: 'image/jpeg' }))
            } else {
              resolve(archivo)
            }
          },
          'image/jpeg',
          0.8
        )
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(archivo) }
      img.src = url
    })
  }, [])

  // Manejar selección de fotos (cámara o galería) — con compresión
  const manejarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivosOriginales = Array.from(e.target.files || [])
    if (!archivosOriginales.length) return

    // Comprimir cada imagen
    const archivosComprimidos = await Promise.all(
      archivosOriginales.map(a => comprimirImagen(a))
    )

    setFotosNuevas(prev => [...prev, ...archivosComprimidos])
    archivosComprimidos.forEach(archivo => {
      const reader = new FileReader()
      reader.onloadend = () => setPreviewsNuevas(prev => [...prev, reader.result as string])
      reader.readAsDataURL(archivo)
    })
    // Reset input para poder seleccionar el mismo archivo
    e.target.value = ''
  }

  const quitarFotoNueva = (indice: number) => {
    setFotosNuevas(prev => prev.filter((_, i) => i !== indice))
    setPreviewsNuevas(prev => prev.filter((_, i) => i !== indice))
  }

  // Eliminar foto ya subida
  const eliminarFotoExistente = async (foto: FotoExistente) => {
    setFotosExistentes(prev => prev.map(f =>
      f.url === foto.url ? { ...f, eliminando: true } : f
    ))
    try {
      const resp = await fetch('/api/recorrido/registro', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatter_id: foto.chatter_id, adjunto_url: foto.url }),
      })
      if (!resp.ok) throw new Error()
      setFotosExistentes(prev => prev.filter(f => f.url !== foto.url))
    } catch {
      mostrar('error', 'No se pudo eliminar la foto')
      setFotosExistentes(prev => prev.map(f =>
        f.url === foto.url ? { ...f, eliminando: false } : f
      ))
    }
  }

  // Toggle item del checklist
  const toggleChecklist = (indice: number) => {
    setChecklist(prev => prev.map((item, i) =>
      i === indice ? { ...item, completado: !item.completado } : item
    ))
  }

  // Enviar registro
  const enviar = async () => {
    setEnviando(true)
    try {
      // 1. Cambiar estado (solo si no es modo editar)
      if (modo !== 'editar') {
        const estadoNuevo = modo === 'llegada' ? 'en_sitio' : 'completada'
        const respEstado = await fetch('/api/recorrido/estado', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visita_id: visitaId,
            estado: estadoNuevo,
            registro_lat: ubicacion?.lat,
            registro_lng: ubicacion?.lng,
            registro_precision_m: ubicacion?.precision,
          }),
        })
        if (!respEstado.ok) throw new Error('Error al cambiar estado')
      }

      // 2. Registrar datos (notas, resultado, checklist, fotos nuevas)
      const tieneNuevosDatos = notas || resultado || temperatura || fotosNuevas.length > 0 || checklist.length > 0
      if (tieneNuevosDatos) {
        const formData = new FormData()
        formData.append('visita_id', visitaId)
        if (notas) formData.append('notas', notas)
        if (resultado) formData.append('resultado', resultado)
        if (temperatura) formData.append('temperatura', temperatura)
        if (checklist.length > 0) formData.append('checklist', JSON.stringify(checklist))
        fotosNuevas.forEach(foto => formData.append('archivos', foto))

        const respRegistro = await fetch('/api/recorrido/registrar', {
          method: 'POST',
          body: formData,
        })
        if (!respRegistro.ok) throw new Error('Error al registrar datos')
      }

      const mensajes: Record<string, string> = {
        llegada: 'Llegada registrada',
        completar: 'Visita completada',
        editar: 'Registro actualizado',
      }
      mostrar('exito', mensajes[modo])
      onExito()
      onCerrar()
    } catch {
      mostrar('error', 'Error al registrar la visita')
    } finally {
      setEnviando(false)
    }
  }

  const totalFotos = fotosExistentes.length + fotosNuevas.length

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Registrar visita"
      altura="alto"
      acciones={
        <button
          onClick={enviar}
          disabled={enviando}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--insignia-exito)' }}
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <span>Guardar visita →</span>}
        </button>
      }
    >
      {cargandoDatos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : (
        <div className="space-y-0">
          {/* ── Subtítulo con fecha y parada ── */}
          {contactoNombre && (
            <p className="text-sm text-texto-terciario pb-4">
              {contactoNombre} · {contactoDireccion}
            </p>
          )}

          {/* ── Factibilidad ── */}
          <div className="border-t border-borde-sutil pt-4 pb-4">
            <p className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-3">Factibilidad</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { valor: 'frio' as const, label: 'Baja', color: 'var(--insignia-peligro)' },
                { valor: 'tibio' as const, label: 'Media', color: 'var(--insignia-advertencia)' },
                { valor: 'caliente' as const, label: 'Alta', color: 'var(--insignia-exito)' },
              ]).map(({ valor, label, color }) => {
                const activo = temperatura === valor
                return (
                  <button
                    key={valor}
                    onClick={() => setTemperatura(activo ? null : valor)}
                    className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border transition-all"
                    style={{
                      borderColor: activo ? color : 'var(--borde-sutil)',
                      backgroundColor: activo ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
                    }}
                  >
                    <div
                      className="size-3 rounded-full transition-all"
                      style={{
                        backgroundColor: activo ? color : 'var(--borde-fuerte)',
                        boxShadow: activo ? `0 0 8px ${color}` : 'none',
                      }}
                    />
                    <span className="text-sm font-medium" style={{ color: activo ? color : 'var(--texto-secundario)' }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Notas ── */}
          <div className="border-t border-borde-sutil pt-4 pb-4">
            <p className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-3">Notas</p>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ibivv — descripción del trabajo a realizar"
              rows={3}
              className="w-full rounded-xl border border-borde-sutil bg-transparent px-4 py-3 text-sm text-texto-primario placeholder:text-texto-terciario/50 resize-none focus:outline-none focus:border-texto-marca/40"
            />
          </div>

          {/* ── Checklist ── */}
          {checklist.length > 0 && (
            <div className="border-t border-borde-sutil pt-4 pb-4">
              <p className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-3">Checklist</p>
              <div className="space-y-1.5">
                {checklist.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleChecklist(i)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl border border-borde-sutil hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className={`size-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      item.completado
                        ? 'bg-[var(--insignia-exito)] border-[var(--insignia-exito)]'
                        : 'border-borde-fuerte'
                    }`}>
                      {item.completado && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className={`text-sm ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                      {item.texto}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Fotos ── */}
          <div className="border-t border-borde-sutil pt-4 pb-2">
            <p className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-3">
              Fotos {totalFotos > 0 && <span className="normal-case font-normal ml-1">{totalFotos} adjuntas</span>}
            </p>

            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {/* Fotos existentes */}
              {fotosExistentes.map((foto) => (
                <div key={foto.url} className="relative shrink-0 size-24 rounded-xl overflow-hidden border border-borde-sutil">
                  <img src={foto.url} alt={foto.nombre} className="size-full object-cover" />
                  <button
                    onClick={() => eliminarFotoExistente(foto)}
                    disabled={foto.eliminando}
                    className="absolute top-1 right-1 size-6 rounded-full bg-black/70 flex items-center justify-center disabled:opacity-50"
                  >
                    {foto.eliminando
                      ? <Loader2 size={12} className="text-white animate-spin" />
                      : <Trash2 size={12} className="text-white" />
                    }
                  </button>
                </div>
              ))}

              {/* Fotos nuevas */}
              {previewsNuevas.map((src, i) => (
                <div key={i} className="relative shrink-0 size-24 rounded-xl overflow-hidden border border-texto-marca/30">
                  <img src={src} alt={`Nueva ${i + 1}`} className="size-full object-cover" />
                  <button
                    onClick={() => quitarFotoNueva(i)}
                    className="absolute top-1 right-1 size-6 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}

              {/* Botón Agregar */}
              <button
                onClick={() => inputGaleriaRef.current?.click()}
                className="shrink-0 size-24 rounded-xl border border-dashed border-borde-sutil hover:border-texto-terciario flex flex-col items-center justify-center gap-1.5 transition-colors"
              >
                <Camera size={20} className="text-texto-terciario" />
                <span className="text-[11px] text-texto-terciario">Agregar</span>
              </button>
            </div>

            {/* Inputs ocultos */}
            <input
              ref={inputCamaraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={manejarFotos}
              className="hidden"
            />
            <input
              ref={inputGaleriaRef}
              type="file"
              accept="image/*"
              multiple
              onChange={manejarFotos}
              className="hidden"
            />
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

export { RegistroVisita }

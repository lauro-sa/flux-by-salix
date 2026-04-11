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

  // Manejar selección de fotos (cámara o galería)
  const manejarFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || [])
    if (!archivos.length) return
    setFotosNuevas(prev => [...prev, ...archivos])
    archivos.forEach(archivo => {
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

  const titulos: Record<string, string> = {
    llegada: t('recorrido.llegue'),
    completar: t('recorrido.registrar_visita'),
    editar: 'Editar registro',
  }

  const labelBoton: Record<string, string> = {
    llegada: 'Registrar llegada',
    completar: 'Completar visita',
    editar: 'Guardar cambios',
  }

  const totalFotos = fotosExistentes.length + fotosNuevas.length

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulos[modo]}
      altura="alto"
      acciones={
        <button
          onClick={enviar}
          disabled={enviando}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: modo === 'llegada' ? 'var(--insignia-info)' : 'var(--insignia-exito)' }}
        >
          {enviando && <Loader2 size={16} className="animate-spin" />}
          {labelBoton[modo]}
        </button>
      }
    >
      {cargandoDatos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-texto-terciario" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Datos del contacto */}
          {contactoNombre && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-borde-sutil bg-white/[0.03]">
              <div className="flex items-center justify-center size-10 rounded-full bg-[var(--insignia-info)]/15 border border-[var(--insignia-info)]/30">
                <MapPin size={16} className="text-[var(--insignia-info)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-texto-primario truncate">{contactoNombre}</p>
                {contactoDireccion && (
                  <p className="text-xs text-texto-terciario truncate">{contactoDireccion}</p>
                )}
              </div>
            </div>
          )}
          {/* Ubicación (solo en modo llegada) */}
          {modo === 'llegada' && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-borde-sutil bg-superficie-elevada/50">
              <MapPin size={18} className={ubicacion ? 'text-[var(--insignia-exito)]' : 'text-texto-terciario'} />
              <div className="flex-1 min-w-0">
                {cargandoUbicacion ? (
                  <p className="text-sm text-texto-terciario flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Obteniendo ubicación...
                  </p>
                ) : ubicacion ? (
                  <>
                    <p className="text-sm text-texto-secundario">Ubicación registrada</p>
                    <p className="text-xs text-texto-terciario">Precisión: ±{ubicacion.precision}m</p>
                  </>
                ) : (
                  <button onClick={obtenerUbicacion} className="text-sm text-texto-marca hover:underline">
                    Obtener ubicación
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Checklist</p>
              <div className="space-y-1.5">
                {checklist.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleChecklist(i)}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-borde-sutil hover:bg-superficie-elevada/50 transition-colors text-left"
                  >
                    <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                      item.completado
                        ? 'bg-[var(--insignia-exito)] border-[var(--insignia-exito)]'
                        : 'border-borde-fuerte'
                    }`}>
                      {item.completado && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={`text-sm ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                      {item.texto}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Factibilidad — qué tan probable es cerrar */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Factibilidad</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { valor: 'frio' as const, label: 'Baja', color: 'var(--insignia-peligro)', bg: 'var(--insignia-peligro)' },
                { valor: 'tibio' as const, label: 'Media', color: 'var(--insignia-advertencia)', bg: 'var(--insignia-advertencia)' },
                { valor: 'caliente' as const, label: 'Alta', color: 'var(--insignia-exito)', bg: 'var(--insignia-exito)' },
              ]).map(({ valor, label, color, bg }) => {
                const activo = temperatura === valor
                return (
                  <button
                    key={valor}
                    onClick={() => setTemperatura(activo ? null : valor)}
                    className="flex items-center justify-center py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={{
                      borderColor: activo ? color : 'var(--borde-sutil)',
                      backgroundColor: activo ? `color-mix(in srgb, ${bg} 15%, transparent)` : 'transparent',
                      color: activo ? color : 'var(--texto-secundario)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">{t('recorrido.notas')}</p>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Agregar notas de la visita..."
              rows={3}
              className="w-full rounded-lg border border-borde-sutil bg-superficie-elevada/50 px-3 py-2.5 text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
            />
          </div>

          {/* Resultado (completar y editar) */}
          {(modo === 'completar' || modo === 'editar') && (
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Resultado</p>
              <input
                type="text"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder="Resultado de la visita..."
                className="w-full rounded-lg border border-borde-sutil bg-superficie-elevada/50 px-3 py-2.5 text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
              />
            </div>
          )}

          {/* Fotos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                Fotos {totalFotos > 0 && `(${totalFotos})`}
              </p>
            </div>

            {/* Fotos existentes (ya subidas) */}
            {fotosExistentes.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {fotosExistentes.map((foto) => (
                  <div key={foto.url} className="relative shrink-0 size-20 rounded-lg overflow-hidden border border-borde-sutil">
                    <img src={foto.url} alt={foto.nombre} className="size-full object-cover" />
                    <button
                      onClick={() => eliminarFotoExistente(foto)}
                      disabled={foto.eliminando}
                      className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-50"
                    >
                      {foto.eliminando
                        ? <Loader2 size={10} className="text-white animate-spin" />
                        : <Trash2 size={10} className="text-white" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Fotos nuevas (preview) */}
            {previewsNuevas.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {previewsNuevas.map((src, i) => (
                  <div key={i} className="relative shrink-0 size-20 rounded-lg overflow-hidden border border-texto-marca/30">
                    <img src={src} alt={`Nueva ${i + 1}`} className="size-full object-cover" />
                    <button
                      onClick={() => quitarFotoNueva(i)}
                      className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botones: cámara y galería */}
            <div className="flex gap-2">
              <button
                onClick={() => inputCamaraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-borde-sutil hover:bg-superficie-elevada/50 transition-colors text-sm text-texto-secundario"
              >
                <Camera size={16} />
                <span>Cámara</span>
              </button>
              <button
                onClick={() => inputGaleriaRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-borde-sutil hover:bg-superficie-elevada/50 transition-colors text-sm text-texto-secundario"
              >
                <ImageIcon size={16} />
                <span>Galería</span>
              </button>
            </div>

            {/* Input cámara (capture=environment abre cámara trasera) */}
            <input
              ref={inputCamaraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={manejarFotos}
              className="hidden"
            />
            {/* Input galería (sin capture, abre selector de archivos/galería) */}
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

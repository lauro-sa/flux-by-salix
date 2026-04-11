'use client'

/**
 * RegistroVisita — BottomSheet para registrar llegada o completar visita.
 * Permite: capturar ubicación, tomar fotos, escribir notas, marcar checklist.
 * Se usa en: PaginaRecorrido cuando el usuario toca "¡Llegué!" o "Completar".
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, MapPin, X, Loader2 } from 'lucide-react'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'

interface ItemChecklist {
  texto: string
  completado: boolean
}

interface PropiedadesRegistroVisita {
  abierto: boolean
  onCerrar: () => void
  visitaId: string
  modo: 'llegada' | 'completar'
  checklist?: ItemChecklist[]
  onExito: () => void
}

function RegistroVisita({
  abierto,
  onCerrar,
  visitaId,
  modo,
  checklist: checklistInicial,
  onExito,
}: PropiedadesRegistroVisita) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()

  const [notas, setNotas] = useState('')
  const [resultado, setResultado] = useState('')
  const [checklist, setChecklist] = useState<ItemChecklist[]>(checklistInicial || [])
  const [fotos, setFotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number; precision: number } | null>(null)
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // Obtener ubicación actual
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

  // Auto-obtener ubicación al abrir
  useEffect(() => {
    if (abierto && !ubicacion) obtenerUbicacion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Manejar selección de fotos
  const manejarFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || [])
    setFotos(prev => [...prev, ...archivos])

    // Crear previews
    archivos.forEach(archivo => {
      const reader = new FileReader()
      reader.onloadend = () => setPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(archivo)
    })
  }

  const quitarFoto = (indice: number) => {
    setFotos(prev => prev.filter((_, i) => i !== indice))
    setPreviews(prev => prev.filter((_, i) => i !== indice))
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
      // 1. Cambiar estado de la visita
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

      // 2. Si hay notas, resultado, fotos o checklist → registrar
      if (notas || resultado || fotos.length > 0 || checklist.length > 0) {
        const formData = new FormData()
        formData.append('visita_id', visitaId)
        if (notas) formData.append('notas', notas)
        if (resultado) formData.append('resultado', resultado)
        if (checklist.length > 0) formData.append('checklist', JSON.stringify(checklist))
        fotos.forEach(foto => formData.append('archivos', foto))

        const respRegistro = await fetch('/api/recorrido/registrar', {
          method: 'POST',
          body: formData,
        })

        if (!respRegistro.ok) throw new Error('Error al registrar datos')
      }

      mostrar('exito', modo === 'llegada' ? 'Llegada registrada' : 'Visita completada')
      onExito()
      onCerrar()

      // Limpiar estado
      setNotas('')
      setResultado('')
      setFotos([])
      setPreviews([])
      setUbicacion(null)
    } catch {
      mostrar('error', 'Error al registrar la visita')
    } finally {
      setEnviando(false)
    }
  }

  const titulo = modo === 'llegada' ? t('recorrido.llegue') : t('recorrido.registrar_visita')

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      altura="alto"
      acciones={
        <button
          onClick={enviar}
          disabled={enviando}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: modo === 'llegada' ? 'var(--insignia-info)' : 'var(--insignia-exito)' }}
        >
          {enviando && <Loader2 size={16} className="animate-spin" />}
          {modo === 'llegada' ? 'Registrar llegada' : 'Completar visita'}
        </button>
      }
    >
      <div className="space-y-5">
        {/* Ubicación */}
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
              <button
                onClick={obtenerUbicacion}
                className="text-sm text-texto-marca hover:underline"
              >
                Obtener ubicación
              </button>
            )}
          </div>
        </div>

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

        {/* Resultado (solo al completar) */}
        {modo === 'completar' && (
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
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">{t('recorrido.tomar_foto')}</p>

          {/* Preview de fotos */}
          {previews.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {previews.map((src, i) => (
                <div key={i} className="relative shrink-0 size-20 rounded-lg overflow-hidden border border-borde-sutil">
                  <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
                  <button
                    onClick={() => quitarFoto(i)}
                    className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => inputFotoRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-borde-sutil hover:bg-superficie-elevada/50 transition-colors text-sm text-texto-secundario"
          >
            <Camera size={16} />
            <span>{t('recorrido.tomar_foto')}</span>
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={manejarFotos}
            className="hidden"
          />
        </div>
      </div>
    </BottomSheet>
  )
}

export { RegistroVisita }

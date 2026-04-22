'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings2, MapPin, FileText, Clock, ListChecks,
  Plus, Trash2, GripVertical, Check,
} from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useCambiosSinGuardar } from '@/hooks/useCambiosPendientes'

/**
 * Página de configuración de Visitas.
 * Secciones: General, Motivos, Resultados, Checklist por defecto.
 */

interface ConfigVisitas {
  checklist_predeterminado: { id: string; texto: string; completado: boolean }[]
  requiere_geolocalizacion: boolean
  distancia_maxima_m: number
  duracion_estimada_default: number
  motivos_predefinidos: string[]
  resultados_predefinidos: string[]
}

export default function PaginaConfiguracionVisitas() {
  const router = useRouter()
  const { mostrar } = useToast()
  const { esPropietario, tienePermiso, tienePermisoConfig, cargando: cargandoPermisos } = useRol()
  const puedeVer = esPropietario || tienePermiso('config_visitas', 'ver')
  const puedeEditar = tienePermisoConfig('visitas', 'editar')

  const [seccionActiva, setSeccionActiva] = useState('general')
  const [config, setConfig] = useState<ConfigVisitas | null>(null)
  const [configOriginal, setConfigOriginal] = useState<ConfigVisitas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Cargar config
  useEffect(() => {
    if (!puedeVer) { setCargando(false); return }
    fetch('/api/visitas/config')
      .then(r => r.json())
      .then(data => { setConfig(data); setConfigOriginal(data); setCargando(false) })
      .catch(() => setCargando(false))
  }, [puedeVer])

  // Guardar cambios
  const guardar = async (campos: Partial<ConfigVisitas>) => {
    if (!puedeEditar) return
    setGuardando(true)
    try {
      const res = await fetch('/api/visitas/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConfig(data)
      setConfigOriginal(data)
      mostrar('exito', 'Configuración guardada')
    } catch {
      mostrar('error', 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Diff granular entre config actual y el último guardado, para el modal "cambios sin guardar".
  const cambiosConfig = useMemo(() => {
    if (!config || !configOriginal) return []
    const diffs: { campo: string; valor?: string }[] = []
    if (config.duracion_estimada_default !== configOriginal.duracion_estimada_default) {
      diffs.push({ campo: 'Duración estimada default', valor: `${config.duracion_estimada_default} min` })
    }
    if (config.requiere_geolocalizacion !== configOriginal.requiere_geolocalizacion) {
      diffs.push({ campo: 'Requerir geolocalización', valor: config.requiere_geolocalizacion ? 'activado' : 'desactivado' })
    }
    if (config.distancia_maxima_m !== configOriginal.distancia_maxima_m) {
      diffs.push({ campo: 'Distancia máxima', valor: `${config.distancia_maxima_m} m` })
    }
    if (JSON.stringify(config.motivos_predefinidos) !== JSON.stringify(configOriginal.motivos_predefinidos)) {
      diffs.push({ campo: 'Motivos predefinidos', valor: `${config.motivos_predefinidos.length} items` })
    }
    if (JSON.stringify(config.resultados_predefinidos) !== JSON.stringify(configOriginal.resultados_predefinidos)) {
      diffs.push({ campo: 'Resultados predefinidos', valor: `${config.resultados_predefinidos.length} items` })
    }
    if (JSON.stringify(config.checklist_predeterminado) !== JSON.stringify(configOriginal.checklist_predeterminado)) {
      diffs.push({ campo: 'Checklist predeterminado', valor: `${config.checklist_predeterminado.length} items` })
    }
    return diffs
  }, [config, configOriginal])

  // Registrar cambios pendientes para que el modal global intercepte la navegación.
  useCambiosSinGuardar({
    id: 'visitas-configuracion',
    dirty: cambiosConfig.length > 0,
    titulo: 'Configuración de Visitas',
    cambios: cambiosConfig,
    onGuardar: async () => {
      if (!config) return
      await guardar({
        duracion_estimada_default: config.duracion_estimada_default,
        requiere_geolocalizacion: config.requiere_geolocalizacion,
        distancia_maxima_m: config.distancia_maxima_m,
        motivos_predefinidos: config.motivos_predefinidos,
        resultados_predefinidos: config.resultados_predefinidos,
        checklist_predeterminado: config.checklist_predeterminado,
      })
    },
    onDescartar: () => { if (configOriginal) setConfig(configOriginal) },
  })

  const secciones: SeccionConfig[] = [
    { id: 'general', etiqueta: 'General', icono: <Settings2 size={16} /> },
    { id: 'motivos', etiqueta: 'Motivos', icono: <FileText size={16} /> },
    { id: 'resultados', etiqueta: 'Resultados', icono: <ListChecks size={16} /> },
    { id: 'checklist', etiqueta: 'Checklist', icono: <Check size={16} /> },
    { id: 'checkin', etiqueta: 'Check-in / Check-out', icono: <MapPin size={16} /> },
  ]

  // Guard de acceso: después de todos los hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/visitas')} />

  return (
    <PlantillaConfiguracion
      titulo="Configuración de Visitas"
      descripcion="Configurá motivos, resultados, checklist predeterminado y reglas de geolocalización."
      iconoHeader={<MapPin size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Visitas"
      onVolver={() => router.push('/visitas')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 border-2 border-texto-marca/30 border-t-texto-marca rounded-full animate-spin" />
        </div>
      ) : config ? (
        <>
          {/* General */}
          {seccionActiva === 'general' && (
            <div className="space-y-6 max-w-lg">
              <div>
                <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                  Duración estimada por defecto (minutos)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={config.duracion_estimada_default}
                    onChange={(e) => setConfig({ ...config, duracion_estimada_default: parseInt(e.target.value) || 30 })}
                    min={5}
                    max={480}
                    className="w-24 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario text-center focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
                    disabled={!puedeEditar}
                  />
                  <span className="text-sm text-texto-terciario">minutos</span>
                  <Boton
                    tamano="sm"
                    variante="secundario"
                    onClick={() => guardar({ duracion_estimada_default: config.duracion_estimada_default })}
                    cargando={guardando}
                    disabled={!puedeEditar}
                  >
                    Guardar
                  </Boton>
                </div>
              </div>
            </div>
          )}

          {/* Motivos predefinidos */}
          {seccionActiva === 'motivos' && (
            <SeccionLista
              titulo="Motivos predefinidos"
              descripcion="Motivos que aparecen como opciones al crear una visita."
              items={config.motivos_predefinidos}
              onChange={(items) => setConfig({ ...config, motivos_predefinidos: items })}
              onGuardar={() => guardar({ motivos_predefinidos: config.motivos_predefinidos })}
              guardando={guardando}
              puedeEditar={puedeEditar}
              placeholder="Ej: visita comercial, soporte técnico..."
            />
          )}

          {/* Resultados predefinidos */}
          {seccionActiva === 'resultados' && (
            <SeccionLista
              titulo="Resultados predefinidos"
              descripcion="Resultados que aparecen como opciones al completar una visita."
              items={config.resultados_predefinidos}
              onChange={(items) => setConfig({ ...config, resultados_predefinidos: items })}
              onGuardar={() => guardar({ resultados_predefinidos: config.resultados_predefinidos })}
              guardando={guardando}
              puedeEditar={puedeEditar}
              placeholder="Ej: venta cerrada, requiere seguimiento..."
            />
          )}

          {/* Checklist predeterminado */}
          {seccionActiva === 'checklist' && (
            <SeccionChecklist
              items={config.checklist_predeterminado}
              onChange={(items) => setConfig({ ...config, checklist_predeterminado: items })}
              onGuardar={() => guardar({ checklist_predeterminado: config.checklist_predeterminado })}
              guardando={guardando}
              puedeEditar={puedeEditar}
            />
          )}

          {/* Check-in / Check-out */}
          {seccionActiva === 'checkin' && (
            <div className="space-y-6 max-w-lg">
              <div className="flex items-center justify-between p-4 rounded-card border border-white/[0.06] bg-white/[0.03]">
                <div>
                  <p className="text-sm text-texto-primario font-medium">Requerir geolocalización</p>
                  <p className="text-xs text-texto-terciario mt-0.5">El visitador debe compartir su ubicación al marcar llegada</p>
                </div>
                <button
                  onClick={() => {
                    const nuevo = !config.requiere_geolocalizacion
                    setConfig({ ...config, requiere_geolocalizacion: nuevo })
                    guardar({ requiere_geolocalizacion: nuevo })
                  }}
                  disabled={!puedeEditar}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config.requiere_geolocalizacion ? 'bg-texto-marca' : 'bg-white/[0.15]'
                  }`}
                >
                  <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                    config.requiere_geolocalizacion ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {config.requiere_geolocalizacion && (
                <div>
                  <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                    Distancia máxima permitida (metros)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={config.distancia_maxima_m}
                      onChange={(e) => setConfig({ ...config, distancia_maxima_m: parseInt(e.target.value) || 500 })}
                      min={50}
                      max={5000}
                      className="w-24 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario text-center focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
                      disabled={!puedeEditar}
                    />
                    <span className="text-sm text-texto-terciario">metros</span>
                    <Boton
                      tamano="sm"
                      variante="secundario"
                      onClick={() => guardar({ distancia_maxima_m: config.distancia_maxima_m })}
                      cargando={guardando}
                      disabled={!puedeEditar}
                    >
                      Guardar
                    </Boton>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <EstadoVacio
          icono={<Settings2 />}
          titulo="Error"
          descripcion="No se pudo cargar la configuración."
        />
      )}
    </PlantillaConfiguracion>
  )
}

// ── Sub-componente: lista de strings editables ──

function SeccionLista({
  titulo,
  descripcion,
  items,
  onChange,
  onGuardar,
  guardando,
  puedeEditar,
  placeholder,
}: {
  titulo: string
  descripcion: string
  items: string[]
  onChange: (items: string[]) => void
  onGuardar: () => void
  guardando: boolean
  puedeEditar: boolean
  placeholder: string
}) {
  const [nuevo, setNuevo] = useState('')

  const agregar = () => {
    if (!nuevo.trim()) return
    onChange([...items, nuevo.trim()])
    setNuevo('')
  }

  const eliminar = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h3 className="text-sm font-medium text-texto-primario">{titulo}</h3>
        <p className="text-xs text-texto-terciario mt-0.5">{descripcion}</p>
      </div>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03]">
            <span className="flex-1 text-sm text-texto-primario">{item}</span>
            {puedeEditar && (
              <button onClick={() => eliminar(i)} className="text-texto-terciario hover:text-insignia-peligro">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {puedeEditar && (
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
          />
          <Boton tamano="sm" variante="fantasma" onClick={agregar}>
            <Plus size={14} />
          </Boton>
        </div>
      )}

      <Boton
        tamano="sm"
        onClick={onGuardar}
        cargando={guardando}
        disabled={!puedeEditar}
      >
        Guardar cambios
      </Boton>
    </div>
  )
}

// ── Sub-componente: checklist editable ──

function SeccionChecklist({
  items,
  onChange,
  onGuardar,
  guardando,
  puedeEditar,
}: {
  items: { id: string; texto: string; completado: boolean }[]
  onChange: (items: { id: string; texto: string; completado: boolean }[]) => void
  onGuardar: () => void
  guardando: boolean
  puedeEditar: boolean
}) {
  const agregar = () => {
    onChange([...items, { id: crypto.randomUUID(), texto: '', completado: false }])
  }

  const actualizar = (id: string, texto: string) => {
    onChange(items.map(item => item.id === id ? { ...item, texto } : item))
  }

  const eliminar = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h3 className="text-sm font-medium text-texto-primario">Checklist predeterminado</h3>
        <p className="text-xs text-texto-terciario mt-0.5">Items que se agregan automáticamente a nuevas visitas.</p>
      </div>

      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <GripVertical size={14} className="text-texto-terciario opacity-0 group-hover:opacity-100" />
            <input
              type="text"
              value={item.texto}
              onChange={(e) => actualizar(item.id, e.target.value)}
              placeholder="Nuevo item..."
              disabled={!puedeEditar}
              className="flex-1 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
            />
            {puedeEditar && (
              <button onClick={() => eliminar(item.id)} className="opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-insignia-peligro">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {puedeEditar && (
        <button onClick={agregar} className="flex items-center gap-2 text-sm text-texto-marca hover:text-texto-marca/80">
          <Plus size={14} />
          Agregar item
        </button>
      )}

      <Boton
        tamano="sm"
        onClick={onGuardar}
        cargando={guardando}
        disabled={!puedeEditar}
      >
        Guardar cambios
      </Boton>
    </div>
  )
}

'use client'

import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Sparkles, FileSpreadsheet, Pipette, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { MiniSelectorIcono } from '@/componentes/ui/MiniSelectorIcono'
import { PickerHSL } from '@/componentes/ui/_editor_texto/PickerHSL'
import { PALETA_COLORES_TIPO_ACTIVIDAD } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'
import { useModulos } from '@/hooks/useModulos'
import { ETIQUETAS_ENTIDAD, ENTIDADES_CON_ESTADO } from '@/tipos/estados'
import {
  plantillasDisponibles,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import { sugerirIdentidadFlujo } from '@/lib/workflows/sugerencia-identidad-flujo'
import { CardPlantilla } from './EstadoVacioFlujos'
import { useCrearFlujo } from './useCrearFlujo'

// Íconos "rápidos" mostrados sin búsqueda en el MiniSelectorIcono.
// Curados para el dominio de flujos (comunicación, scheduler,
// negocio, RRHH); buscador adentro del popover descubre los demás.
const ICONOS_RAPIDOS_FLUJO = [
  'Workflow', 'Zap', 'Sparkles', 'Bell', 'Mail', 'MessageCircle',
  'MessageSquare', 'Phone', 'Calendar', 'Clock', 'AlarmClock', 'CheckCircle',
  'FileText', 'ClipboardList', 'DollarSign', 'CreditCard', 'Wallet', 'Tag',
  'MapPin', 'Users', 'User', 'Wrench', 'Settings', 'Shield',
]

/**
 * ModalNuevoFlujo — Modal "+ Nuevo flujo" con dos pestañas (§1.11 plan UX).
 *
 * Pestaña 1 "Desde una plantilla": grid de plantillas curadas filtradas
 * por módulos instalados, con buscador + filtro de módulo. Click en una
 * card crea un flujo borrador con el nombre/descripción de la plantilla
 * (decisión D5=C: 19.1 NO pre-llena disparador/acciones — eso lo hace
 * 19.2 cuando aterrice el editor; el catálogo ya queda armado en
 * `lib/workflows/plantillas-sugeridas.ts`).
 *
 * Pestaña 2 "Desde cero": input de nombre + select de módulo (informativo,
 * no se persiste todavía) + botón "Crear y editar". Crea flujo borrador
 * con solo el nombre.
 *
 * Tras crear, navega a /flujos/[id] que en 19.1 muestra el placeholder
 * con redirect + toast.
 */

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Pre-selecciona pestaña al abrir (ej: "Crear desde cero" del estado vacío). */
  pestanaInicial?: 'plantilla' | 'cero'
  /** Pre-selecciona una plantilla específica (ej: click en mini-card del hero). */
  plantillaInicial?: PlantillaSugerida | null
  /** Callback opcional para refrescar el listado tras crear. */
  onCreado?: () => void
}

export default function ModalNuevoFlujo({
  abierto,
  onCerrar,
  pestanaInicial = 'plantilla',
  plantillaInicial = null,
  onCreado,
}: Props) {
  const { t } = useTraduccion()
  const { tieneModulo } = useModulos()
  // 19.7: la lógica POST + toast + navigate se delega a `useCrearFlujo`
  // (compartida con la sección "Flujos" de cada módulo). Mantiene
  // exactamente el mismo contrato que tenía inline en 19.1.
  const { creando, crearFlujo, crearDesdePlantilla } = useCrearFlujo({
    onCreado: () => {
      onCreado?.()
      onCerrar()
    },
  })

  const [pestana, setPestana] = useState<'plantilla' | 'cero'>(pestanaInicial)
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [nombre, setNombre] = useState('')
  // Identidad visual: `icono` es un nombre Lucide, `color` siempre es
  // un hex literal (#RRGGBB). El helper `resolverEstiloColorFlujo`
  // acepta tanto tokens viejos como hex — los flujos nuevos siempre
  // nacen con hex para alinearse con el patrón del editor de tipos
  // de actividad (PaginaEditorTipoActividad).
  const [icono, setIcono] = useState('Workflow')
  const [color, setColor] = useState<string>('#5b5bd6')
  // Dirty flags: una vez que el usuario toca ícono o color a mano, ya
  // no los pisamos con la sugerencia automática del nombre.
  const iconoTocado = useRef(false)
  const colorTocado = useRef(false)
  // Picker HSL (gotero) — popover renderizado por portal a
  // document.body, como en el editor de tipos de actividad.
  const [pickerAbierto, setPickerAbierto] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const pickerBotonRef = useRef<HTMLButtonElement>(null)
  const pickerDropdownRef = useRef<HTMLDivElement>(null)

  // Cuando abre con plantilla pre-seleccionada, ir directo a "Desde cero"
  // con el nombre de la plantilla pre-cargado (más rápido que volver a
  // hacer click en la card después de elegirla del estado vacío).
  useEffect(() => {
    if (!abierto) return
    setPestana(pestanaInicial)
    if (plantillaInicial) {
      // El usuario ya eligió desde el estado vacío — no le hagamos buscar de nuevo.
      void crearDesdePlantilla(plantillaInicial)
    } else {
      setNombre('')
      setIcono('Workflow')
      setColor('#5b5bd6')
      iconoTocado.current = false
      colorTocado.current = false
      setPickerAbierto(false)
      setBusquedaPlantilla('')
      setFiltroModulo('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const plantillasFiltradas = useMemo(() => {
    const todas = plantillasDisponibles(tieneModulo)
    const q = busquedaPlantilla.trim().toLowerCase()
    return todas.filter((p) => {
      if (filtroModulo && p.modulo !== filtroModulo) return false
      if (!q) return true
      return (
        p.fallback_es.titulo.toLowerCase().includes(q) ||
        p.fallback_es.descripcion.toLowerCase().includes(q)
      )
    })
  }, [tieneModulo, busquedaPlantilla, filtroModulo])

  const opcionesModulo = useMemo(
    () => [
      { valor: '', etiqueta: t('flujos.modal_nuevo.todos_modulos') },
      ...ENTIDADES_CON_ESTADO.map((e) => ({
        valor: e,
        etiqueta: ETIQUETAS_ENTIDAD[e],
      })),
    ],
    [t],
  )

  // -----------------------------------------------------------------
  // Crear flujo (común a ambas pestañas)
  // -----------------------------------------------------------------
  // La lógica POST + redirect + toast vive en `useCrearFlujo` (refactor
  // 19.7). Acá solo se invoca con el payload correspondiente a la
  // pestaña activa. El editor de 19.2 lee `?plantilla=<id>` en la URL
  // y combina con el contenido del backend para pre-rellenar.

  // Auto-sugerencia: mientras el usuario tipea el nombre, si todavía
  // no tocó ícono/color manualmente, los actualizamos según las
  // palabras clave detectadas. La heurística vive en
  // `sugerencia-identidad-flujo.ts` (sin AI, solo regex).
  useEffect(() => {
    if (!abierto || pestana !== 'cero') return
    const sugerido = sugerirIdentidadFlujo(nombre)
    if (!iconoTocado.current) setIcono(sugerido.icono)
    if (!colorTocado.current) setColor(sugerido.color)
  }, [nombre, abierto, pestana])

  // Posición + cierre del picker HSL (gotero). Mismo patrón que el
  // editor de tipos de actividad: portal a body, fuera del DOM del
  // modal para que no se le aplique el overflow / max-h.
  useLayoutEffect(() => {
    if (!pickerAbierto || !pickerBotonRef.current) return
    const rect = pickerBotonRef.current.getBoundingClientRect()
    setPickerPos({ top: rect.bottom + 6, left: rect.left })
  }, [pickerAbierto])
  useEffect(() => {
    if (!pickerAbierto) return
    const cerrarFuera = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerBotonRef.current?.contains(target)) return
      if (pickerDropdownRef.current?.contains(target)) return
      setPickerAbierto(false)
    }
    document.addEventListener('mousedown', cerrarFuera)
    return () => document.removeEventListener('mousedown', cerrarFuera)
  }, [pickerAbierto])

  function cambiarIcono(nuevo: string) {
    iconoTocado.current = true
    setIcono(nuevo)
  }
  function cambiarColor(nuevo: string) {
    colorTocado.current = true
    setColor(nuevo)
  }

  function crearDesdeCero() {
    if (!nombre.trim()) return
    void crearFlujo({
      nombre: nombre.trim(),
      icono,
      color,
    })
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={t('flujos.modal_nuevo.titulo')}
      tamano="4xl"
    >
      {/* Pestañas */}
      <div className="flex gap-1 mb-5 border-b border-borde-sutil -mx-6 px-6">
        <BotonPestana
          activa={pestana === 'plantilla'}
          icono={<Sparkles size={14} />}
          onClick={() => setPestana('plantilla')}
        >
          {t('flujos.modal_nuevo.pestana_plantilla')}
        </BotonPestana>
        <BotonPestana
          activa={pestana === 'cero'}
          icono={<FileSpreadsheet size={14} />}
          onClick={() => setPestana('cero')}
        >
          {t('flujos.modal_nuevo.pestana_cero')}
        </BotonPestana>
      </div>

      {pestana === 'plantilla' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                tipo="search"
                icono={<Search size={14} />}
                placeholder={t('flujos.modal_nuevo.buscar_plantilla')}
                value={busquedaPlantilla}
                onChange={(e) => setBusquedaPlantilla(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                opciones={opcionesModulo}
                valor={filtroModulo}
                onChange={setFiltroModulo}
                placeholder={t('flujos.modal_nuevo.filtrar_modulo')}
              />
            </div>
          </div>

          {plantillasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-texto-terciario">
              {busquedaPlantilla
                ? t('flujos.modal_nuevo.sin_plantillas_busqueda')
                : t('flujos.modal_nuevo.sin_plantillas')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plantillasFiltradas.map((p) => (
                <CardPlantilla
                  key={p.id}
                  plantilla={p}
                  onClick={() => void crearDesdePlantilla(p)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Patrón idéntico a PaginaEditorTipoActividad (referencia visual
        // del proyecto): MiniSelectorIcono a la izquierda + input nombre +
        // bolitas de color compactas + gotero con PickerHSL en portal.
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <MiniSelectorIcono
              valor={icono}
              color={color}
              onChange={cambiarIcono}
              iconosRapidos={ICONOS_RAPIDOS_FLUJO}
              titulo={t('flujos.modal_nuevo.elegir_icono')}
            />
            <div className="flex-1 min-w-0 space-y-3">
              <Input
                tipo="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t('flujos.modal_nuevo.nombre_placeholder')}
                autoFocus
                className="!text-base !font-semibold"
              />
              {/* Paleta de bolitas inline (size-5) + gotero. Mismo
                  ancho y estilo que tipos de actividad. */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETA_COLORES_TIPO_ACTIVIDAD.map((preset) => {
                  const sel = color.toLowerCase() === preset.color.toLowerCase()
                  return (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => cambiarColor(preset.color)}
                      title={preset.nombre}
                      aria-label={preset.nombre}
                      className={`relative size-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                        sel ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110' : ''
                      }`}
                      style={{ backgroundColor: preset.color }}
                    >
                      {sel && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                    </button>
                  )
                })}
                {/* Gotero — abre PickerHSL en portal a body */}
                <div className="relative">
                  <button
                    ref={pickerBotonRef}
                    type="button"
                    onClick={() => setPickerAbierto(!pickerAbierto)}
                    className={`relative size-5 rounded-full border border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                      pickerAbierto || !PALETA_COLORES_TIPO_ACTIVIDAD.some((p) => p.color.toLowerCase() === color.toLowerCase())
                        ? 'ring-2 ring-offset-1 ring-white/80 ring-offset-superficie-tarjeta scale-110 border-transparent'
                        : 'border-borde-fuerte'
                    }`}
                    style={
                      !PALETA_COLORES_TIPO_ACTIVIDAD.some((p) => p.color.toLowerCase() === color.toLowerCase())
                        ? { backgroundColor: color }
                        : undefined
                    }
                    title={t('flujos.modal_nuevo.color_custom')}
                    aria-label={t('flujos.modal_nuevo.color_custom')}
                  >
                    {!PALETA_COLORES_TIPO_ACTIVIDAD.some((p) => p.color.toLowerCase() === color.toLowerCase())
                      ? <Check size={9} className="text-white drop-shadow-sm" />
                      : <Pipette size={9} className="text-texto-terciario" />}
                  </button>
                  {typeof window !== 'undefined' && createPortal(
                    <AnimatePresence>
                      {pickerAbierto && (
                        <motion.div
                          ref={pickerDropdownRef}
                          initial={{ opacity: 0, y: 4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="fixed bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden"
                          style={{ top: pickerPos.top, left: pickerPos.left, zIndex: 200 }}
                        >
                          <PickerHSL
                            valorInicial={color}
                            onAplicar={(c) => { cambiarColor(c); setPickerAbierto(false) }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>,
                    document.body,
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-texto-terciario">
            {t('flujos.modal_nuevo.sugerencia_hint')}
          </p>

          <div className="flex justify-end pt-2">
            <Boton
              variante="primario"
              tamano="md"
              onClick={crearDesdeCero}
              disabled={!nombre.trim()}
              cargando={creando}
            >
              {t('flujos.modal_nuevo.crear_y_editar')}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  )
}

// =============================================================
// Pestaña visual (subcomponente local)
// =============================================================

interface PropsPestana {
  activa: boolean
  icono?: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}

function BotonPestana({ activa, icono, onClick, children }: PropsPestana) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 -mb-px text-sm border-b-2 cursor-pointer transition-colors ${
        activa
          ? 'border-texto-marca text-texto-marca'
          : 'border-transparent text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      {icono}
      {children}
    </button>
  )
}

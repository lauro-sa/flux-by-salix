'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Sparkles, FileSpreadsheet, Pipette } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { PickerInline } from '@/componentes/ui/SelectorColor'
import { useTraduccion } from '@/lib/i18n'
import { useModulos } from '@/hooks/useModulos'
import { ETIQUETAS_ENTIDAD, ENTIDADES_CON_ESTADO } from '@/tipos/estados'
import {
  plantillasDisponibles,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import { sugerirIdentidadFlujo } from '@/lib/workflows/sugerencia-identidad-flujo'
import { iconoLucideFlujo, resolverEstiloColorFlujo } from '@/lib/workflows/iconos-flujo'
import { CardPlantilla } from './EstadoVacioFlujos'
import { useCrearFlujo } from './useCrearFlujo'

// Paleta de tokens de color predefinidos (claves de `ColorInsignia`).
// El último slot del selector NO es token sino un picker hex con
// gotero — el modelo `flujos.color` acepta tanto el token como
// `#RRGGBB`, ver `resolverEstiloColorFlujo`.
const COLORES_FLUJO = [
  'violeta', 'primario', 'info', 'cyan', 'exito',
  'advertencia', 'naranja', 'peligro', 'rosa', 'neutro',
] as const

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
  // Identidad visual del flujo recién creado. `icono` es un nombre de
  // Lucide; `color` puede ser un token de Insignia o un hex literal
  // venido del PickerInline (gotero). El helper
  // `resolverEstiloColorFlujo` lo consume sin distinción.
  const [icono, setIcono] = useState('Workflow')
  const [color, setColor] = useState<string>('violeta')
  // Dirty flags: una vez que el usuario toca ícono o color a mano, ya
  // no los pisamos con la sugerencia automática del nombre. Sin estos
  // refs, escribir el nombre revertiría su elección y sería molesto.
  const iconoTocado = useRef(false)
  const colorTocado = useRef(false)
  // Picker hex (gotero) — popover controlado por la última bolita
  // del selector de color.
  const [pickerAbierto, setPickerAbierto] = useState(false)

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
      setColor('violeta')
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
        // Layout 2 columnas: izquierda nombre+color+CTA, derecha
        // selector de íconos grande con categorías (aprovecha el
        // ancho del modal en vez de dejar la mitad derecha vacía).
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-6">
          {/* Columna izquierda */}
          <div className="flex flex-col gap-5">
            {/* Nombre del flujo. La preview del ícono se muestra como
                bolita decorativa antes del input — al elegir un ícono
                a la derecha o al escribir el nombre, esa bolita se
                actualiza en vivo. */}
            <div>
              <label className="block text-xs font-medium text-texto-secundario mb-1.5">
                {t('flujos.modal_nuevo.nombre_label')}
              </label>
              <div className="flex items-stretch gap-2">
                <div
                  className="shrink-0 inline-flex items-center justify-center size-9 rounded-md"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${resolverEstiloColorFlujo(color)} 12%, transparent)`,
                    color: resolverEstiloColorFlujo(color),
                  }}
                  aria-hidden="true"
                >
                  {(() => {
                    // Render perezoso. `obtenerIcono` cubre TODO Lucide
                    // (no solo el mapa restringido de
                    // `iconoLucideFlujo`); fallback a Workflow si no
                    // matchea por algún motivo.
                    const Icono = obtenerIcono(icono) ?? iconoLucideFlujo(null)
                    return <Icono size={16} strokeWidth={1.7} />
                  })()}
                </div>
                <div className="flex-1">
                  <Input
                    placeholder={t('flujos.modal_nuevo.nombre_placeholder')}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <p className="text-[11px] text-texto-terciario mt-1.5">
                {t('flujos.modal_nuevo.sugerencia_hint')}
              </p>
            </div>

            {/* Paleta de color: 10 tokens predefinidos + 1 gotero.
                El gotero abre `PickerInline` (HSL) en un popover
                inline; al confirmar guarda el hex en `color`. El
                helper `resolverEstiloColorFlujo` consume token o
                hex sin distinción. */}
            <div>
              <label className="block text-xs font-medium text-texto-secundario mb-1.5">
                {t('flujos.modal_nuevo.color_label')}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {COLORES_FLUJO.map((c) => {
                  const seleccionado = c === color
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => cambiarColor(c)}
                      title={t(`flujos.modal_nuevo.color.${c}`)}
                      aria-label={t(`flujos.modal_nuevo.color.${c}`)}
                      aria-pressed={seleccionado}
                      className={`size-7 rounded-full cursor-pointer transition-all ${
                        seleccionado
                          ? 'ring-2 ring-texto-primario ring-offset-2 ring-offset-superficie-elevada'
                          : 'hover:scale-110'
                      }`}
                      style={{
                        background: `var(--insignia-${c}-texto, var(--texto-marca))`,
                      }}
                    />
                  )
                })}
                {/* Gotero / color custom. Si el color actual ya es
                    hex (#XXXXXX), el botón muestra ese color como
                    bolita seleccionada; si no, queda gris con el
                    ícono Pipette. */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerAbierto((v) => !v)}
                    aria-label={t('flujos.modal_nuevo.color_custom')}
                    title={t('flujos.modal_nuevo.color_custom')}
                    aria-pressed={color.startsWith('#')}
                    className={`size-7 rounded-full cursor-pointer flex items-center justify-center border border-borde-fuerte transition-all ${
                      color.startsWith('#')
                        ? 'ring-2 ring-texto-primario ring-offset-2 ring-offset-superficie-elevada text-texto-app'
                        : 'bg-superficie-tarjeta text-texto-terciario hover:text-texto-secundario hover:scale-110'
                    }`}
                    style={
                      color.startsWith('#')
                        ? { background: color, color: '#fff' }
                        : undefined
                    }
                  >
                    <Pipette size={12} strokeWidth={2} />
                  </button>
                  {pickerAbierto && (
                    <div
                      className="absolute z-50 mt-2 left-0 w-[260px] rounded-card border border-borde-sutil bg-superficie-elevada shadow-2xl p-3"
                      role="dialog"
                      aria-label={t('flujos.modal_nuevo.color_custom')}
                    >
                      <PickerInline
                        valor={color.startsWith('#') ? color : '#7c3aed'}
                        onChange={(hex) => cambiarColor(hex)}
                      />
                      <div className="flex justify-end pt-2">
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => setPickerAbierto(false)}
                        >
                          {t('comun.cerrar')}
                        </Boton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-start pt-2">
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

          {/* Divisor vertical — se oculta en mobile (grid colapsa a 1 col) */}
          <div className="hidden md:block bg-white/[0.07]" />

          {/* Columna derecha: SelectorIcono grande con categorías.
              Es el componente "fuerte" — el mismo que se usa en
              tipos de actividad, tipos de evento, etapas, etc. */}
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1.5">
              {t('flujos.modal_nuevo.icono_label')}
            </label>
            <SelectorIcono
              valor={icono}
              onChange={cambiarIcono}
            />
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

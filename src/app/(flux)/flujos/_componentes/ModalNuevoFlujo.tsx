'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Sparkles, FileSpreadsheet } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { MiniSelectorIcono } from '@/componentes/ui/MiniSelectorIcono'
import { useTraduccion } from '@/lib/i18n'
import { useModulos } from '@/hooks/useModulos'
import { ETIQUETAS_ENTIDAD, ENTIDADES_CON_ESTADO } from '@/tipos/estados'
import {
  plantillasDisponibles,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import { CardPlantilla } from './EstadoVacioFlujos'
import { useCrearFlujo } from './useCrearFlujo'

// Paleta de colores válidos para un flujo (mismas claves que
// `ColorInsignia` para que el header del editor las consuma sin
// mapeo). El primer item es el fallback que toma el flujo si el
// usuario no toca el selector.
const COLORES_FLUJO = [
  'violeta', 'primario', 'info', 'cyan', 'exito',
  'advertencia', 'naranja', 'peligro', 'rosa', 'neutro',
] as const
type ColorFlujo = typeof COLORES_FLUJO[number]

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
  // Identidad visual del flujo recién creado. Icono Lucide + color de
  // la paleta `COLORES_FLUJO`. Si el usuario no toca el selector, se
  // crea con el default ('Workflow' + 'violeta') y después puede
  // cambiarlo desde el header del editor.
  const [icono, setIcono] = useState('Workflow')
  const [color, setColor] = useState<ColorFlujo>('violeta')

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
        <div className="flex flex-col gap-5 max-w-xl">
          {/* Fila: icono clickeable + nombre. El icono usa el mismo
              MiniSelectorIcono del header del editor para que se vea
              y funcione igual desde el primer momento. El color de
              fondo del botón es el seleccionado abajo. */}
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1.5">
              {t('flujos.modal_nuevo.nombre_label')}
            </label>
            <div className="flex items-stretch gap-2">
              <MiniSelectorIcono
                valor={icono}
                color={`var(--insignia-${color}-texto, var(--texto-marca))`}
                onChange={setIcono}
                titulo={t('flujos.modal_nuevo.elegir_icono')}
              />
              <div className="flex-1">
                <Input
                  placeholder={t('flujos.modal_nuevo.nombre_placeholder')}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Paleta de color en bolitas — mismo patrón visual que
              `ModalTipoActividad` (CLAUDE.md §"Modales de
              configuración"). Click cambia el aro de selección;
              size-7 para que sea cómodo a touch sin invadir el modal. */}
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1.5">
              {t('flujos.modal_nuevo.color_label')}
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORES_FLUJO.map((c) => {
                const seleccionado = c === color
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
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
            </div>
          </div>

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

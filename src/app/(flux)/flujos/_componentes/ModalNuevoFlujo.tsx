'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Sparkles, FileSpreadsheet } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useModulos } from '@/hooks/useModulos'
import { ETIQUETAS_ENTIDAD, ENTIDADES_CON_ESTADO } from '@/tipos/estados'
import {
  plantillasDisponibles,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import { CardPlantilla } from './EstadoVacioFlujos'

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
  const router = useRouter()
  const { mostrar } = useToast()
  const { tieneModulo } = useModulos()

  const [pestana, setPestana] = useState<'plantilla' | 'cero'>(pestanaInicial)
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [nombre, setNombre] = useState('')
  const [moduloSeleccionado, setModuloSeleccionado] = useState('')
  const [creando, setCreando] = useState(false)

  // Cuando abre con plantilla pre-seleccionada, ir directo a "Desde cero"
  // con el nombre de la plantilla pre-cargado (más rápido que volver a
  // hacer click en la card después de elegirla del estado vacío).
  useEffect(() => {
    if (!abierto) return
    setPestana(pestanaInicial)
    if (plantillaInicial) {
      // El usuario ya eligió desde el estado vacío — no le hagamos buscar de nuevo.
      crearDesdePlantilla(plantillaInicial)
    } else {
      setNombre('')
      setModuloSeleccionado('')
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
  // 19.1 manda solo `nombre` y `descripcion`. La plantilla pre-rellena el
  // editor en 19.2 mediante `?plantilla=<id>` en la URL (que el editor lee
  // y combina con el contenido del backend). Por ahora pasamos el id en la
  // navegación para no perderlo.

  async function crearFlujo(payload: {
    nombre: string
    descripcion?: string
    plantillaId?: string | null
  }): Promise<void> {
    setCreando(true)
    try {
      const res = await fetch('/api/flujos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: payload.nombre,
          ...(payload.descripcion ? { descripcion: payload.descripcion } : {}),
        }),
      })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { flujo?: { id: string } }
      const id = data.flujo?.id
      if (!id) throw new Error('Respuesta sin id')

      mostrar('exito', t('flujos.toast.creado'))
      onCreado?.()
      onCerrar()
      const sufijo = payload.plantillaId ? `?plantilla=${encodeURIComponent(payload.plantillaId)}` : ''
      router.push(`/flujos/${id}${sufijo}`)
    } catch (err) {
      console.error('Error al crear flujo:', err)
      mostrar('error', err instanceof Error ? err.message : t('flujos.toast.error_crear'))
    } finally {
      setCreando(false)
    }
  }

  function crearDesdePlantilla(plantilla: PlantillaSugerida) {
    void crearFlujo({
      nombre: plantilla.fallback_es.titulo,
      descripcion: plantilla.fallback_es.descripcion,
      plantillaId: plantilla.id,
    })
  }

  function crearDesdeCero() {
    if (!nombre.trim()) return
    void crearFlujo({ nombre: nombre.trim() })
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
                  onClick={() => crearDesdePlantilla(p)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-md">
          <Input
            etiqueta={t('flujos.modal_nuevo.nombre_label')}
            placeholder={t('flujos.modal_nuevo.nombre_placeholder')}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-texto-secundario mb-1">
              {t('flujos.modal_nuevo.modulo_label')}
            </label>
            <Select
              opciones={opcionesModulo}
              valor={moduloSeleccionado}
              onChange={setModuloSeleccionado}
              placeholder={t('flujos.modal_nuevo.modulo_placeholder')}
            />
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

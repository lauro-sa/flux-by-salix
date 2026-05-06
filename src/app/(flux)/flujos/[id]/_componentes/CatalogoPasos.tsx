'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { useTraduccion } from '@/lib/i18n'
import {
  CATEGORIAS_DISPARADOR,
  CATEGORIAS_ACCION,
  disparadoresPorCategoria,
  accionesPorCategoria,
  claveI18nCategoriaAccion,
  claveI18nCategoriaDisparador,
  claveI18nDescripcionPaso,
  claveI18nTituloPaso,
  type CategoriaAccion,
  type CategoriaDisparador,
} from '@/lib/workflows/categorias-pasos'
import {
  iconoDefaultAccion,
  iconoDefaultDisparador,
} from '@/lib/workflows/iconos-flujo'
import type { TipoAccion, TipoDisparador } from '@/tipos/workflow'

/**
 * Modal `CatalogoPasos` (§1.6.5 del plan UX).
 *
 * Dos modos:
 *   • `disparador` → muestra solo categorías "Eventos" y "Tiempo".
 *                     Llamado desde el card placeholder del disparador.
 *   • `accion`     → muestra el resto: envíos, creaciones, cambios,
 *                     notificaciones, control, terminar.
 *                     Llamado desde "+" intermedio o "+ Agregar paso".
 *
 * Layout: modal `lg`, search arriba, secciones agrupadas con cards
 * compactas. Click en card → cierra modal y dispara `onElegir(tipo)`.
 *
 * El llamador maneja la inserción en el flujo. Este modal es 100%
 * presentacional + selección.
 */

type ItemBase<T extends string> = {
  tipo: T
  titulo: string
  descripcion: string
  Icono: ReturnType<typeof iconoDefaultAccion>
}
type ItemDisparador = ItemBase<TipoDisparador>
type ItemAccion = ItemBase<TipoAccion>

interface PropsModoDisparador {
  abierto: boolean
  onCerrar: () => void
  modo: 'disparador'
  onElegirDisparador: (tipo: TipoDisparador) => void
}
interface PropsModoAccion {
  abierto: boolean
  onCerrar: () => void
  modo: 'accion'
  onElegirAccion: (tipo: TipoAccion) => void
}
type Props = PropsModoDisparador | PropsModoAccion

export default function CatalogoPasos(props: Props) {
  const { abierto, onCerrar, modo } = props
  const { t } = useTraduccion()
  const [busqueda, setBusqueda] = useState('')

  // Categorías y items por modo.
  const seccionesDisparador = useMemo(() => {
    if (modo !== 'disparador') return []
    return disparadoresPorCategoria().map((g) => ({
      categoria: g.categoria,
      items: g.tipos.map<ItemDisparador>((tipo) => ({
        tipo,
        titulo: tCaida(t, claveI18nTituloPaso(tipo), tipo),
        descripcion: tCaida(t, claveI18nDescripcionPaso(tipo), ''),
        Icono: iconoDefaultDisparador(tipo),
      })),
    }))
  }, [modo, t])

  const seccionesAccion = useMemo(() => {
    if (modo !== 'accion') return []
    return accionesPorCategoria().map((g) => ({
      categoria: g.categoria,
      items: g.tipos.map<ItemAccion>((tipo) => ({
        tipo,
        titulo: tCaida(t, claveI18nTituloPaso(tipo), tipo),
        descripcion: tCaida(t, claveI18nDescripcionPaso(tipo), ''),
        Icono: iconoDefaultAccion(tipo),
      })),
    }))
  }, [modo, t])

  // Filtrado por búsqueda — sobre titulo + descripcion + tipo raw.
  const q = busqueda.trim().toLowerCase()
  function pasaFiltro(item: ItemDisparador | ItemAccion): boolean {
    if (!q) return true
    return (
      item.titulo.toLowerCase().includes(q) ||
      item.descripcion.toLowerCase().includes(q) ||
      item.tipo.toLowerCase().includes(q)
    )
  }

  function elegir(tipo: TipoAccion | TipoDisparador) {
    if (props.modo === 'disparador') {
      props.onElegirDisparador(tipo as TipoDisparador)
    } else {
      props.onElegirAccion(tipo as TipoAccion)
    }
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      tamano="lg"
      titulo={t(
        modo === 'disparador'
          ? 'flujos.catalogo.titulo_disparador'
          : 'flujos.catalogo.titulo_accion',
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-terciario">
            <Search size={14} aria-hidden="true" />
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t('flujos.catalogo.buscar_placeholder')}
            autoFocus
            className="w-full pl-9 pr-3 h-9 text-sm rounded-md bg-superficie-tarjeta border border-borde-sutil text-texto-primario placeholder:text-texto-terciario focus:border-texto-marca focus:outline-none transition-colors"
          />
        </div>

        {/* Secciones */}
        <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-1">
          {modo === 'disparador'
            ? seccionesDisparador.map((s) => (
                <SeccionCatalogo
                  key={s.categoria}
                  titulo={t(claveI18nCategoriaDisparador(s.categoria as CategoriaDisparador))}
                  descripcion={t(`flujos.catalogo.categoria.${s.categoria}_desc`)}
                  items={s.items.filter(pasaFiltro)}
                  onElegir={elegir}
                />
              ))
            : seccionesAccion.map((s) => (
                <SeccionCatalogo
                  key={s.categoria}
                  titulo={t(claveI18nCategoriaAccion(s.categoria as CategoriaAccion))}
                  descripcion={t(`flujos.catalogo.categoria.${s.categoria}_desc`)}
                  items={s.items.filter(pasaFiltro)}
                  onElegir={elegir}
                />
              ))}

          {/* Empty state si la búsqueda no matchea */}
          {q && seccionesEmpty(modo === 'disparador' ? seccionesDisparador : seccionesAccion, q) && (
            <p className="text-sm text-texto-terciario text-center py-6">
              {t('flujos.catalogo.sin_resultados')}
            </p>
          )}

          {/* Mensaje de protección por si las constantes vienen vacías
              (no debería pasar — los tests "claves alcanzables" lo cubren). */}
          {!q && (modo === 'disparador' ? CATEGORIAS_DISPARADOR : CATEGORIAS_ACCION).length === 0 && (
            <p className="text-sm text-texto-terciario text-center py-6">
              {t('flujos.catalogo.sin_categorias')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface PropsSeccion<T extends string> {
  titulo: string
  descripcion: string
  items: ItemBase<T>[]
  onElegir: (tipo: T) => void
}

function SeccionCatalogo<T extends string>({ titulo, descripcion, items, onElegir }: PropsSeccion<T>) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-[11px] font-semibold tracking-wider uppercase text-texto-terciario">
          {titulo}
        </h3>
        {descripcion && (
          <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed">{descripcion}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item) => (
          <button
            key={item.tipo}
            type="button"
            onClick={() => onElegir(item.tipo)}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-borde-sutil bg-superficie-tarjeta text-left hover:border-texto-marca hover:bg-texto-marca/5 transition-colors cursor-pointer"
          >
            <span
              className="shrink-0 inline-flex items-center justify-center size-7 rounded bg-texto-marca/10 text-texto-marca mt-0.5"
              aria-hidden="true"
            >
              <item.Icono size={14} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-texto-primario">{item.titulo}</p>
              {item.descripcion && (
                <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed line-clamp-2">
                  {item.descripcion}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Devuelve la traducción si existe; si no, la fallback.
 * `useTraduccion().t` devuelve la clave cuando falta el string —
 * ese patrón ya lo usamos en `etiquetaDisparador`.
 */
function tCaida(t: (k: string) => string, clave: string, fallback: string): string {
  const r = t(clave)
  return r === clave ? fallback : r
}

function seccionesEmpty<T extends string>(
  secciones: Array<{ items: ItemBase<T>[] }>,
  q: string,
): boolean {
  if (!q) return false
  return secciones.every((s) =>
    s.items.every(
      (i) =>
        !i.titulo.toLowerCase().includes(q) &&
        !i.descripcion.toLowerCase().includes(q) &&
        !i.tipo.toLowerCase().includes(q),
    ),
  )
}

'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

/**
 * CargaIcono — Placeholder unificado para páginas/módulos en carga.
 *
 * Es uno de los TRES patrones canónicos de carga de Flux:
 *   • CargaBarra  — barra fina (modales/listas/secciones)
 *   • CargaIcono  — ícono dibujándose + barra (este componente, módulos enteros)
 *   • CargaMarca  — logo Salix + byline + barra (splash app, login)
 *
 * Patrón unificado: muestra una barra de progreso indeterminada angosta en
 * el borde superior + el ícono de la sección dibujándose en el centro.
 * Reemplaza los skeletons grises pulsantes y al cargador centrado viejo
 * (CargadorPaginaCompleta) — un solo lenguaje visual para toda la app.
 *
 * Modos:
 * - Solo `icono`: muestra el ícono grande dibujándose, sin texto. Para módulos
 *   que no son listados con estado vacío claro (dashboard, calendario, etc.).
 * - `icono + titulo (+ descripcion)`: muestra el mismo `EstadoVacio` que el
 *   listado en estado vacío real. Si la lista termina vacía, no hay salto.
 *
 * Inspirado en Linear/Attio: sin ruido, sin contenido falso pulsante.
 *
 * Se usa en: page.tsx (Suspense fallback) y loading.tsx de cada módulo.
 */

interface Props {
  /** Ícono que se dibuja en el centro durante la carga. Si el módulo es un
   *  listado con estado vacío definido, pasar el mismo ícono que el
   *  EstadoVacio real (para evitar salto visual al terminar de cargar). */
  icono?: ReactNode
  /** Título principal. Si se provee, se renderiza un EstadoVacio completo. */
  titulo?: string
  /** Descripción secundaria. Requiere `titulo`. */
  descripcion?: string
  /** Nombre del documento que se está cargando (ej. "P-0042", número de OT,
   *  nombre del contacto). Si se provee, aparece debajo del ícono en estilo
   *  sutil — pensado para el fallback de Suspense de páginas de detalle.
   *  No combinar con `titulo` (gana `titulo`). */
  nombre?: string
}

export function CargaIcono({ icono, titulo, descripcion, nombre }: Props = {}) {
  const tieneEstadoVacio = !!titulo

  return (
    <div className="flex flex-col h-full w-full">
      {/* Barra de progreso indeterminada en el borde superior */}
      <div className="h-0.5 w-full overflow-hidden bg-transparent shrink-0">
        <div
          className="h-full w-1/3 rounded-full bg-texto-marca/70"
          style={{ animation: 'flux-barra-progreso 1.4s ease-in-out infinite' }}
        />
      </div>

      {tieneEstadoVacio ? (
        // Listado con estado vacío específico: mismo EstadoVacio que aparecería
        // si los datos llegan vacíos. Sin `accion` para no inducir al usuario
        // a clickear "crear" antes de saber si hay datos.
        <div className="flex-1 flex items-center justify-center">
          <EstadoVacio icono={icono} titulo={titulo} descripcion={descripcion} />
        </div>
      ) : icono ? (
        // Módulo sin estado vacío definido o detalle con nombre conocido:
        // ícono dibujándose en el centro, con el nombre del documento (si
        // se provee) en estilo sutil debajo. Misma animación que EstadoVacio
        // para coherencia visual.
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="text-texto-terciario [&>svg]:w-16 [&>svg]:h-16 icono-dibujar"
            >
              {icono}
            </motion.div>
            {nombre && (
              <motion.span
                className="text-lg font-medium text-texto-secundario"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {nombre}
              </motion.span>
            )}
          </div>
        </div>
      ) : (
        // Sin ícono ni texto: solo la barra de progreso arriba (uso muy raro).
        <div className="flex-1" />
      )}
    </div>
  )
}

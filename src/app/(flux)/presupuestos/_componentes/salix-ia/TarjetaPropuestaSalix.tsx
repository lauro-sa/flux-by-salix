'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wrench, Plus, Pencil, X, Check, Undo2, FileText } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { TextArea } from '@/componentes/ui/TextArea'
import { AtajoTeclado } from '@/componentes/ui/AtajoTeclado'
import { SimilaresPropuesta } from './SimilaresPropuesta'
import type { LineaPropuestaIA, ModoAsistente, SugerenciaIA } from './tipos'

/**
 * TarjetaPropuestaSalix — Card de una línea propuesta por la IA.
 *
 * Visual:
 *  - Border-left de 3px coloreado según estado: transparente (pendiente),
 *    teal (aceptada), rojo (rechazada).
 *  - Cuando es 'rechazada', la card pierde saturación y el título se
 *    tacha (line-through).
 *  - Header: ícono + título + meta (código + badge "ya en catálogo" o
 *    "crear nuevo", o "texto redactado" si el modo es redactar).
 *  - Descripción debajo, editable inline con botón Pencil.
 *  - Si tiene similares y la línea es nueva → SimilaresPropuesta colapsable.
 *  - Acciones al pie: Editar (E) / Rechazar (R) / Aceptar (A) con shortcuts
 *    visibles. Si está aceptada, se cambia a "Deshacer".
 */

interface PropsTarjetaPropuestaSalix {
  linea: LineaPropuestaIA
  modo: ModoAsistente
  candidatosSimilares: SugerenciaIA[]
  onCambiarEstado: (estado: NonNullable<LineaPropuestaIA['estado']>) => void
  onEditarDescripcion: (nueva: string) => void
  onUsarSimilar: (sugerencia: SugerenciaIA) => void
}

// Color del border-left según estado.
function bordeIzquierdoPorEstado(estado: LineaPropuestaIA['estado']): string {
  switch (estado) {
    case 'aceptada':  return 'var(--insignia-exito)'
    case 'rechazada': return 'var(--insignia-peligro)'
    default:          return 'transparent'
  }
}

// Fondo sutil según estado.
function fondoPorEstado(estado: LineaPropuestaIA['estado']): string {
  switch (estado) {
    case 'aceptada':  return 'var(--insignia-exito-fondo)'
    case 'rechazada': return 'var(--insignia-peligro-fondo)'
    default:          return 'transparent'
  }
}

export function TarjetaPropuestaSalix({
  linea,
  modo,
  candidatosSimilares,
  onCambiarEstado,
  onEditarDescripcion,
  onUsarSimilar,
}: PropsTarjetaPropuestaSalix) {
  const [editando, setEditando] = useState(false)
  const estadoActual = linea.estado ?? 'pendiente'
  const esAceptada = estadoActual === 'aceptada'
  const esRechazada = estadoActual === 'rechazada'

  // Color del ícono header según modo (en redactar, info azul; resto según es_nuevo).
  const iconoBgVar =
    modo === 'redactar' ? 'var(--insignia-info-fondo)' :
    linea.es_nuevo      ? 'var(--insignia-advertencia-fondo)' :
                          'var(--insignia-exito-fondo)'
  const iconoColorVar =
    modo === 'redactar' ? 'var(--insignia-info-texto)' :
    linea.es_nuevo      ? 'var(--insignia-advertencia-texto)' :
                          'var(--insignia-exito-texto)'
  const IconoEntidad =
    modo === 'redactar' ? FileText :
    linea.es_nuevo      ? Plus :
                          Wrench

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: esRechazada ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-card border border-borde-sutil overflow-hidden transition-all"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: bordeIzquierdoPorEstado(estadoActual),
        backgroundColor: fondoPorEstado(estadoActual),
      }}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Fila título + meta */}
        <div className="flex items-start gap-2.5">
          <div
            className="size-7 rounded-boton flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconoBgVar, color: iconoColorVar }}
          >
            <IconoEntidad size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className="text-sm font-semibold text-texto-primario leading-tight"
              style={{ textDecoration: esRechazada ? 'line-through' : undefined }}
            >
              {linea.nombre}
            </h4>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {linea.referencia_interna && modo !== 'redactar' && (
                <span className="text-[10px] font-mono text-texto-terciario">{linea.referencia_interna}</span>
              )}
              {modo === 'redactar' ? (
                <Insignia color="info" tamano="sm">Texto redactado</Insignia>
              ) : linea.es_nuevo ? (
                <Insignia color="advertencia" tamano="sm">+ crear nuevo</Insignia>
              ) : (
                <Insignia color="exito" tamano="sm">ya en catálogo</Insignia>
              )}
            </div>
          </div>
        </div>

        {/* Descripción */}
        {editando ? (
          <TextArea
            value={linea.descripcion_editada ?? linea.descripcion_venta}
            onChange={e => onEditarDescripcion(e.target.value)}
            rows={3}
            compacto
            autoFocus
          />
        ) : (
          <p className="text-xs text-texto-secundario leading-relaxed">
            {linea.descripcion_editada || linea.descripcion_venta}
          </p>
        )}

        {/* Similares (si aplica) */}
        {!esRechazada && linea.es_nuevo && (
          <SimilaresPropuesta candidatos={candidatosSimilares} onUsar={onUsarSimilar} />
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-borde-sutil/50">
          {esAceptada ? (
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<Undo2 size={12} />}
              onClick={() => onCambiarEstado('pendiente')}
            >
              Deshacer
            </Boton>
          ) : (
            <>
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<Pencil size={12} />}
                onClick={() => setEditando(v => !v)}
              >
                <span className="flex items-center gap-1.5">
                  Editar <AtajoTeclado>E</AtajoTeclado>
                </span>
              </Boton>
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<X size={12} />}
                onClick={() => onCambiarEstado(esRechazada ? 'pendiente' : 'rechazada')}
              >
                <span className="flex items-center gap-1.5">
                  {esRechazada ? 'Restaurar' : 'Rechazar'} <AtajoTeclado>R</AtajoTeclado>
                </span>
              </Boton>
              <Boton
                variante="secundario"
                tamano="xs"
                icono={<Check size={12} />}
                onClick={() => onCambiarEstado('aceptada')}
              >
                <span className="flex items-center gap-1.5">
                  Aceptar <AtajoTeclado>A</AtajoTeclado>
                </span>
              </Boton>
            </>
          )}
        </div>
      </div>
    </motion.article>
  )
}

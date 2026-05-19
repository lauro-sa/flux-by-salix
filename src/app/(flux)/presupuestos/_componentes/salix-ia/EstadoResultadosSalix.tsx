'use client'

import { motion } from 'framer-motion'
import { RefreshCcw } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { TarjetaPropuestaSalix } from './TarjetaPropuestaSalix'
import type { LineaPropuestaIA, ModoAsistente, SugerenciaIA } from './tipos'

/**
 * EstadoResultadosSalix — Pantalla con las propuestas listas para
 * aceptar/rechazar/editar antes de aplicarlas al presupuesto.
 *
 * Layout:
 *  - Header: "N líneas propuestas · M/N aceptadas" + botón Re-analizar.
 *  - Progress bar fina con gradient violeta→teal que crece según cuántas
 *    líneas se aceptaron.
 *  - Stack vertical de TarjetaPropuestaSalix con stagger de entrada
 *    (cada card 100ms después de la anterior, curva flux).
 */

interface PropsEstadoResultadosSalix {
  lineas: LineaPropuestaIA[]
  sugerencias: SugerenciaIA[]
  modo: ModoAsistente
  onCambiarEstadoLinea: (idx: number, estado: NonNullable<LineaPropuestaIA['estado']>) => void
  onEditarDescripcion: (idx: number, nueva: string) => void
  onUsarSimilar: (idxLinea: number, sugerencia: SugerenciaIA) => void
  onReanalizar: () => void
}

const variantsContainer = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
}
const variantsCard = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
}

export function EstadoResultadosSalix({
  lineas,
  sugerencias,
  modo,
  onCambiarEstadoLinea,
  onEditarDescripcion,
  onUsarSimilar,
  onReanalizar,
}: PropsEstadoResultadosSalix) {
  const aceptadas = lineas.filter(l => l.estado === 'aceptada').length
  const total = lineas.length
  const porcentaje = total === 0 ? 0 : Math.round((aceptadas / total) * 100)

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Header con contador y reanalizar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-texto-primario">
            {total} {total === 1 ? 'línea propuesta' : 'líneas propuestas'}
          </p>
          <p className="text-[10px] text-texto-terciario font-mono mt-0.5 tabular-nums">
            {aceptadas} / {total} aceptadas
          </p>
        </div>
        <Boton
          variante="secundario"
          tamano="xs"
          icono={<RefreshCcw size={12} />}
          onClick={onReanalizar}
        >
          Re-analizar
        </Boton>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-superficie-app overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: `${porcentaje}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--insignia-primario) 0%, var(--insignia-exito) 100%)',
          }}
        />
      </div>

      {/* Stack de cards */}
      <motion.div
        variants={variantsContainer}
        initial="hidden"
        animate="visible"
        className="space-y-2.5"
      >
        {lineas.map((linea, idx) => {
          const similaresDeEstaLinea = sugerencias.filter(s => s.para_linea === idx)
          return (
            <motion.div key={idx} variants={variantsCard}>
              <TarjetaPropuestaSalix
                linea={linea}
                modo={modo}
                candidatosSimilares={similaresDeEstaLinea}
                onCambiarEstado={est => onCambiarEstadoLinea(idx, est)}
                onEditarDescripcion={nueva => onEditarDescripcion(idx, nueva)}
                onUsarSimilar={s => onUsarSimilar(idx, s)}
              />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

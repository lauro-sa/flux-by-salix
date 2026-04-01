'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ShieldOff, RotateCcw, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Modal } from '@/componentes/ui/Modal'
import { useRol, PERMISOS_POR_ROL } from '@/hooks/useRol'
import type { Rol, Modulo, Accion, PermisosMapa } from '@/tipos'
import type { PermisoAuditoria } from '@/tipos/permisos_auditoria'
import {
  CATEGORIAS_MODULOS,
  ACCIONES_POR_MODULO,
  ETIQUETAS_MODULO,
  ETIQUETAS_ACCION,
} from '@/tipos'

/**
 * SeccionPermisos — Panel de gestion de permisos con vista de matriz.
 * Solo visible para propietarios. Se integra en el perfil de cada usuario.
 *
 * Cada categoria se muestra como una tabla:
 * - Filas = modulos
 * - Columnas = acciones posibles en esa categoria
 * - Celdas = checkbox de permiso
 * - Botones rapidos por fila (Todo/Nada) y por categoria
 */

interface PropiedadesSeccionPermisos {
  miembroId: string
  rol: Rol
  permisosCustomIniciales: PermisosMapa | null
  auditoriaInicial?: PermisoAuditoria[]
  onGuardar: (permisos: PermisosMapa | null) => Promise<void>
  onRevocar: (motivo: string) => Promise<void>
}

// Anillo SVG de progreso
function AnilloProgreso({ porcentaje }: { porcentaje: number }) {
  const radio = 36
  const circunferencia = 2 * Math.PI * radio
  const offset = circunferencia - (porcentaje / 100) * circunferencia
  const color = porcentaje > 80 ? 'var(--insignia-exito)' : porcentaje > 40 ? 'var(--insignia-advertencia)' : 'var(--insignia-peligro)'

  return (
    <svg width={88} height={88} viewBox="0 0 88 88" className="shrink-0">
      <circle cx={44} cy={44} r={radio} fill="none" stroke="var(--borde-sutil)" strokeWidth={6} />
      <motion.circle
        cx={44} cy={44} r={radio} fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round" strokeDasharray={circunferencia}
        initial={{ strokeDashoffset: circunferencia }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        transform="rotate(-90 44 44)"
      />
      <text x={44} y={44} textAnchor="middle" dominantBaseline="central"
        className="text-sm font-semibold" fill="var(--texto-primario)">
        {porcentaje}%
      </text>
    </svg>
  )
}

/** Checkbox individual de la matriz */
function CeldaPermiso({
  activo,
  disponible,
  onChange,
}: {
  activo: boolean
  disponible: boolean
  onChange: () => void
}) {
  if (!disponible) {
    return <td className="px-1 py-1.5 text-center"><span className="text-texto-terciario/30">—</span></td>
  }

  return (
    <td className="px-1 py-1.5 text-center">
      <button
        type="button"
        onClick={onChange}
        className={[
          'inline-flex items-center justify-center size-7 rounded-md border transition-all duration-150 cursor-pointer',
          activo
            ? 'bg-texto-marca border-texto-marca text-white'
            : 'bg-transparent border-borde-fuerte text-transparent hover:border-texto-marca/50 hover:bg-texto-marca/5',
        ].join(' ')}
      >
        {activo && <Check size={14} strokeWidth={2.5} />}
      </button>
    </td>
  )
}

/** Tabla de matriz para una categoria */
function MatrizCategoria({
  categoriaKey,
  nombre,
  modulos,
  permisos,
  onToggleAccion,
  onTodoModulo,
  onNadaModulo,
  onPresetCategoria,
  onToggleColumna,
}: {
  categoriaKey: string
  nombre: string
  modulos: Modulo[]
  permisos: PermisosMapa
  onToggleAccion: (modulo: Modulo, accion: Accion) => void
  onTodoModulo: (modulo: Modulo) => void
  onNadaModulo: (modulo: Modulo) => void
  onPresetCategoria: (categoriaKey: string, tipo: 'todo' | 'lectura' | 'nada') => void
  onToggleColumna: (modulos: Modulo[], accion: Accion) => void
}) {
  const [abierta, setAbierta] = useState(categoriaKey === 'operacional')

  // Columnas: union de todas las acciones de los modulos de esta categoria
  const columnas = useMemo(() => {
    const set = new Set<Accion>()
    for (const modulo of modulos) {
      for (const accion of ACCIONES_POR_MODULO[modulo]) {
        set.add(accion)
      }
    }
    // Ordenar en un orden logico consistente
    const orden: Accion[] = ['ver', 'ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'completar_etapa', 'enviar', 'invitar', 'aprobar', 'marcar', 'autoasignar', 'coordinar']
    return orden.filter(a => set.has(a))
  }, [modulos])

  // Contar activos en esta categoria
  const totalCategoria = modulos.reduce((sum, m) => sum + ACCIONES_POR_MODULO[m].length, 0)
  const activosCategoria = modulos.reduce((sum, m) => sum + (permisos[m] || []).length, 0)

  // Estado de cada columna: cuantos modulos de esta categoria tienen esa accion activa
  const estadoColumnas = useMemo(() => {
    const estado: Record<string, { activos: number; posibles: number }> = {}
    for (const accion of columnas) {
      let activos = 0
      let posibles = 0
      for (const modulo of modulos) {
        if (ACCIONES_POR_MODULO[modulo].includes(accion)) {
          posibles++
          if ((permisos[modulo] || []).includes(accion)) activos++
        }
      }
      estado[accion] = { activos, posibles }
    }
    return estado
  }, [columnas, modulos, permisos])

  return (
    <div className="rounded-lg border border-borde-sutil overflow-hidden">
      {/* Cabecera de categoria */}
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex items-center justify-between w-full px-4 py-3 bg-superficie-tarjeta border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          {abierta ? <ChevronDown size={16} className="text-texto-terciario" /> : <ChevronRight size={16} className="text-texto-terciario" />}
          <span className="text-sm font-semibold text-texto-primario">{nombre}</span>
          <Insignia color={activosCategoria === totalCategoria ? 'exito' : activosCategoria > 0 ? 'advertencia' : 'neutro'} tamano="sm">
            {activosCategoria}/{totalCategoria}
          </Insignia>
        </div>
        {/* Presets de categoria */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'todo')}>Todo</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'lectura')}>Lectura</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'nada')}>Nada</Boton>
        </div>
      </button>

      {/* Matriz */}
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-borde-sutil overflow-x-auto">
              <table className="w-full text-xs">
                {/* Cabecera de columnas (acciones) */}
                <thead>
                  <tr className="bg-superficie-app">
                    <th className="text-left px-3 py-2 font-medium text-texto-terciario whitespace-nowrap sticky left-0 bg-superficie-app z-10 min-w-[140px]">
                      Modulo
                    </th>
                    {columnas.map((accion) => {
                      const col = estadoColumnas[accion]
                      const todosActivos = col && col.activos === col.posibles
                      const algunoActivo = col && col.activos > 0

                      return (
                        <th key={accion} className="px-1 py-1 text-center whitespace-nowrap min-w-[60px]">
                          <button
                            type="button"
                            onClick={() => onToggleColumna(modulos, accion)}
                            className="flex flex-col items-center gap-0.5 w-full bg-transparent border-none cursor-pointer p-1 rounded hover:bg-superficie-hover transition-colors group"
                            title={`${todosActivos ? 'Desmarcar' : 'Marcar'} "${ETIQUETAS_ACCION[accion]}" en todos los modulos`}
                          >
                            <span className="text-xxs leading-tight font-medium text-texto-terciario group-hover:text-texto-primario transition-colors">
                              {ETIQUETAS_ACCION[accion]}
                            </span>
                            {/* Barra de progreso de la columna */}
                            <div className="w-5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--borde-sutil)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-200"
                                style={{
                                  width: col ? `${(col.activos / col.posibles) * 100}%` : '0%',
                                  backgroundColor: todosActivos ? 'var(--insignia-exito)' : algunoActivo ? 'var(--insignia-advertencia)' : 'transparent',
                                }}
                              />
                            </div>
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-2 py-2 font-medium text-texto-terciario text-center whitespace-nowrap min-w-[80px]">
                      <span className="text-xxs">Rapido</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((modulo) => {
                    const accionesPosibles = ACCIONES_POR_MODULO[modulo]
                    const accionesActivas = permisos[modulo] || []
                    const todoActivo = accionesActivas.length === accionesPosibles.length
                    const parcial = accionesActivas.length > 0 && !todoActivo

                    // Indicador de color en la fila
                    const colorIndicador = todoActivo
                      ? 'bg-insignia-exito'
                      : parcial
                        ? 'bg-insignia-advertencia'
                        : 'bg-borde-fuerte/40'

                    return (
                      <tr key={modulo} className="border-t border-borde-sutil hover:bg-superficie-hover/50 transition-colors">
                        <td className="px-3 py-1.5 sticky left-0 bg-superficie-tarjeta z-10">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorIndicador}`} />
                            <span className="font-medium text-texto-primario whitespace-nowrap">{ETIQUETAS_MODULO[modulo]}</span>
                          </div>
                        </td>
                        {columnas.map((accion) => {
                          const disponible = accionesPosibles.includes(accion)
                          const activo = accionesActivas.includes(accion)
                          return (
                            <CeldaPermiso
                              key={accion}
                              activo={activo}
                              disponible={disponible}
                              onChange={() => onToggleAccion(modulo, accion)}
                            />
                          )
                        })}
                        {/* Botones rapidos por fila */}
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onTodoModulo(modulo)}
                              className={[
                                'px-1.5 py-0.5 rounded text-xxs font-medium border-none cursor-pointer transition-colors',
                                todoActivo
                                  ? 'bg-insignia-exito/20 text-insignia-exito'
                                  : 'bg-superficie-hover text-texto-terciario hover:text-texto-primario',
                              ].join(' ')}
                            >
                              Todo
                            </button>
                            <button
                              type="button"
                              onClick={() => onNadaModulo(modulo)}
                              className={[
                                'px-1.5 py-0.5 rounded text-xxs font-medium border-none cursor-pointer transition-colors',
                                accionesActivas.length === 0
                                  ? 'bg-insignia-peligro/20 text-insignia-peligro'
                                  : 'bg-superficie-hover text-texto-terciario hover:text-texto-primario',
                              ].join(' ')}
                            >
                              Nada
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SeccionPermisos({
  miembroId,
  rol,
  permisosCustomIniciales,
  auditoriaInicial = [],
  onGuardar,
  onRevocar,
}: PropiedadesSeccionPermisos) {
  const { esPropietario } = useRol()

  // Estado local de permisos (editables)
  const [permisos, setPermisos] = useState<PermisosMapa>(() => {
    if (permisosCustomIniciales) return structuredClone(permisosCustomIniciales)
    return structuredClone(PERMISOS_POR_ROL[rol] || {})
  })
  const [usaCustom, setUsaCustom] = useState(permisosCustomIniciales !== null)
  const [guardando, setGuardando] = useState(false)
  const [modalRevocar, setModalRevocar] = useState(false)
  const [motivoRevocacion, setMotivoRevocacion] = useState('')
  const [revocando, setRevocando] = useState(false)

  // Sincronizar si cambia el miembro
  useEffect(() => {
    if (permisosCustomIniciales) {
      setPermisos(structuredClone(permisosCustomIniciales))
      setUsaCustom(true)
    } else {
      setPermisos(structuredClone(PERMISOS_POR_ROL[rol] || {}))
      setUsaCustom(false)
    }
  }, [miembroId, rol, permisosCustomIniciales])

  // Calcular estadisticas
  const estadisticas = useMemo(() => {
    let totalActivas = 0
    let totalPosibles = 0
    let completos = 0
    let sinAcceso = 0
    let parciales = 0

    for (const modulo of Object.keys(ACCIONES_POR_MODULO) as Modulo[]) {
      const posibles = ACCIONES_POR_MODULO[modulo].length
      const activas = (permisos[modulo] || []).length
      totalPosibles += posibles
      totalActivas += activas
      if (activas === posibles) completos++
      else if (activas === 0) sinAcceso++
      else parciales++
    }

    const porcentaje = totalPosibles > 0 ? Math.round((totalActivas / totalPosibles) * 100) : 0
    return { porcentaje, completos, sinAcceso, parciales }
  }, [permisos])

  // Toggle individual
  const toggleAccion = useCallback((modulo: Modulo, accion: Accion) => {
    setPermisos((prev) => {
      const nuevo = { ...prev }
      const actuales = [...(nuevo[modulo] || [])]
      const idx = actuales.indexOf(accion)
      if (idx >= 0) actuales.splice(idx, 1)
      else actuales.push(accion)
      nuevo[modulo] = actuales
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Todo/Nada por modulo
  const todoModulo = useCallback((modulo: Modulo) => {
    setPermisos((prev) => ({ ...prev, [modulo]: [...ACCIONES_POR_MODULO[modulo]] }))
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  const nadaModulo = useCallback((modulo: Modulo) => {
    setPermisos((prev) => ({ ...prev, [modulo]: [] }))
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Toggle columna: marcar/desmarcar una accion para todos los modulos dados
  const toggleColumna = useCallback((modulos: Modulo[], accion: Accion) => {
    setPermisos((prev) => {
      const nuevo = { ...prev }
      // Contar cuantos modulos tienen esta accion activa
      let activos = 0
      let posibles = 0
      for (const modulo of modulos) {
        if (ACCIONES_POR_MODULO[modulo].includes(accion)) {
          posibles++
          if ((nuevo[modulo] || []).includes(accion)) activos++
        }
      }
      // Si todos activos -> desmarcar todos. Si no -> marcar todos.
      const marcar = activos < posibles
      for (const modulo of modulos) {
        if (!ACCIONES_POR_MODULO[modulo].includes(accion)) continue
        const actuales = [...(nuevo[modulo] || [])]
        const idx = actuales.indexOf(accion)
        if (marcar && idx < 0) {
          actuales.push(accion)
        } else if (!marcar && idx >= 0) {
          actuales.splice(idx, 1)
        }
        nuevo[modulo] = actuales
      }
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Presets globales
  const aplicarPreset = useCallback((tipo: 'todo' | 'lectura' | 'nada') => {
    const nuevo: PermisosMapa = {}
    for (const modulo of Object.keys(ACCIONES_POR_MODULO) as Modulo[]) {
      if (tipo === 'todo') {
        nuevo[modulo] = [...ACCIONES_POR_MODULO[modulo]]
      } else if (tipo === 'lectura') {
        nuevo[modulo] = ACCIONES_POR_MODULO[modulo].filter(a => a.startsWith('ver'))
      } else {
        nuevo[modulo] = []
      }
    }
    setPermisos(nuevo)
    setUsaCustom(true)
  }, [])

  // Presets por categoria
  const aplicarPresetCategoria = useCallback((categoriaKey: string, tipo: 'todo' | 'lectura' | 'nada') => {
    const categoria = CATEGORIAS_MODULOS[categoriaKey]
    if (!categoria) return
    setPermisos((prev) => {
      const nuevo = { ...prev }
      for (const modulo of categoria.modulos) {
        if (tipo === 'todo') {
          nuevo[modulo] = [...ACCIONES_POR_MODULO[modulo]]
        } else if (tipo === 'lectura') {
          nuevo[modulo] = ACCIONES_POR_MODULO[modulo].filter(a => a.startsWith('ver'))
        } else {
          nuevo[modulo] = []
        }
      }
      return nuevo
    })
    if (!usaCustom) setUsaCustom(true)
  }, [usaCustom])

  // Restablecer a defaults del rol
  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      await onGuardar(null)
      setPermisos(structuredClone(PERMISOS_POR_ROL[rol] || {}))
      setUsaCustom(false)
    } finally {
      setGuardando(false)
    }
  }, [onGuardar, rol])

  // Guardar permisos custom
  const guardar = useCallback(async () => {
    setGuardando(true)
    try {
      await onGuardar(permisos)
    } finally {
      setGuardando(false)
    }
  }, [onGuardar, permisos])

  // Revocar todo
  const confirmarRevocacion = useCallback(async () => {
    if (motivoRevocacion.trim().length < 5) return
    setRevocando(true)
    try {
      await onRevocar(motivoRevocacion.trim())
      setPermisos({})
      setUsaCustom(true)
      setModalRevocar(false)
      setMotivoRevocacion('')
    } finally {
      setRevocando(false)
    }
  }, [onRevocar, motivoRevocacion])

  // No mostrar si no es propietario o si el miembro es propietario
  if (!esPropietario || rol === 'propietario') return null

  return (
    <section className="space-y-5">
      {/* Zona 1 — Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-texto-marca shrink-0" />
          <h3 className="text-base font-semibold text-texto-primario">Permisos</h3>
          <Insignia color={usaCustom ? 'info' : 'neutro'}>
            {usaCustom ? 'Personalizado' : `Defaults de ${rol}`}
          </Insignia>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {usaCustom && (
            <Boton variante="fantasma" tamano="sm" icono={<RotateCcw size={14} />} onClick={restablecer} cargando={guardando}>
              Restablecer
            </Boton>
          )}
          <Boton variante="peligro" tamano="sm" icono={<ShieldOff size={14} />} onClick={() => setModalRevocar(true)}>
            Revocar todo
          </Boton>
          <Boton variante="primario" tamano="sm" onClick={guardar} cargando={guardando}>
            Guardar
          </Boton>
        </div>
      </div>

      {/* Zona 2 — Resumen */}
      <div className="flex items-center gap-5 p-4 rounded-lg bg-superficie-tarjeta border border-borde-sutil">
        <AnilloProgreso porcentaje={estadisticas.porcentaje} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Insignia color="exito">{estadisticas.completos} completos</Insignia>
            <Insignia color="advertencia">{estadisticas.parciales} parciales</Insignia>
            <Insignia color="neutro">{estadisticas.sinAcceso} sin acceso</Insignia>
          </div>
          <p className="text-xs text-texto-terciario">
            Rol base: <span className="font-medium text-texto-secundario capitalize">{rol}</span>
          </p>
          {/* Presets globales */}
          <div className="flex gap-1.5 mt-1">
            <Boton variante="fantasma" tamano="xs" onClick={() => aplicarPreset('todo')}>Acceso total</Boton>
            <Boton variante="fantasma" tamano="xs" onClick={() => aplicarPreset('lectura')}>Solo lectura</Boton>
            <Boton variante="fantasma" tamano="xs" onClick={() => aplicarPreset('nada')}>Sin acceso</Boton>
          </div>
        </div>
      </div>

      {/* Zona 3 — Matrices por categoria */}
      <div className="space-y-3">
        {Object.entries(CATEGORIAS_MODULOS).map(([key, categoria]) => (
          <MatrizCategoria
            key={key}
            categoriaKey={key}
            nombre={categoria.nombre}
            modulos={categoria.modulos}
            permisos={permisos}
            onToggleAccion={toggleAccion}
            onTodoModulo={todoModulo}
            onNadaModulo={nadaModulo}
            onPresetCategoria={aplicarPresetCategoria}
            onToggleColumna={toggleColumna}
          />
        ))}
      </div>

      {/* Historial de auditoria */}
      {auditoriaInicial.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-texto-secundario mb-2">Historial de cambios</h4>
          <div className="space-y-1.5">
            {auditoriaInicial.slice(0, 5).map((entrada) => (
              <div key={entrada.id} className="flex items-center gap-2 text-xs text-texto-terciario px-3 py-1.5 rounded bg-superficie-tarjeta border border-borde-sutil">
                <Insignia
                  color={entrada.accion_tipo === 'revocar_todo' ? 'peligro' : entrada.accion_tipo === 'restablecer_rol' ? 'info' : 'neutro'}
                  tamano="sm"
                >
                  {entrada.accion_tipo === 'revocar_todo' ? 'Revocado' : entrada.accion_tipo === 'restablecer_rol' ? 'Restablecido' : 'Editado'}
                </Insignia>
                <span>{new Date(entrada.editado_en).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {entrada.motivo && <span className="italic">— {entrada.motivo}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de revocacion de emergencia */}
      <Modal
        abierto={modalRevocar}
        onCerrar={() => { setModalRevocar(false); setMotivoRevocacion('') }}
        titulo="Revocar todos los permisos"
        tamano="sm"
        acciones={
          <>
            <Boton variante="secundario" onClick={() => { setModalRevocar(false); setMotivoRevocacion('') }} disabled={revocando}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              onClick={confirmarRevocacion}
              cargando={revocando}
              disabled={motivoRevocacion.trim().length < 5}
            >
              Revocar todo
            </Boton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-texto-terciario leading-relaxed">
            Esta accion eliminara todos los permisos del usuario y cerrara su sesion.
            Queda registrada en auditoria.
          </p>
          <div>
            <label className="block text-sm font-medium text-texto-primario mb-1.5">
              Motivo (obligatorio)
            </label>
            <input
              type="text"
              value={motivoRevocacion}
              onChange={(e) => setMotivoRevocacion(e.target.value)}
              placeholder="Ej: Salida de la empresa, conducta inapropiada..."
              className="w-full px-3 py-2 text-sm rounded-md border border-borde-fuerte bg-superficie-tarjeta text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-texto-marca transition-colors"
            />
            {motivoRevocacion.length > 0 && motivoRevocacion.trim().length < 5 && (
              <p className="text-xs mt-1" style={{ color: 'var(--insignia-peligro)' }}>Minimo 5 caracteres</p>
            )}
          </div>
        </div>
      </Modal>
    </section>
  )
}

export { SeccionPermisos, type PropiedadesSeccionPermisos }

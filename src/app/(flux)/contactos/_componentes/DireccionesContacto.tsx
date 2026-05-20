'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, MapPin, Lock, Pencil, Check, Trash2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputDireccion } from '@/componentes/ui/InputDireccion'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import type { Direccion } from '@/tipos/direccion'

/** Tipos de dirección */
const TIPOS_DIRECCION = [
  { valor: 'principal', etiqueta: 'Principal' },
  { valor: 'fiscal_facturacion', etiqueta: 'Fiscal / Facturación' },
  { valor: 'servicio_entrega', etiqueta: 'Servicio / Entrega' },
  { valor: 'otra', etiqueta: 'Otra' },
]

export interface DatosDireccionPlano {
  calle: string
  barrio: string
  codigoPostal: string
  provincia: string
  ciudad: string
  piso: string
  departamento: string
  pais: string
  lat: number | null
  lng: number | null
  textoCompleto: string
}

const VACIA: DatosDireccionPlano = {
  calle: '', barrio: '', codigoPostal: '', provincia: '',
  ciudad: '', piso: '', departamento: '', pais: '',
  lat: null, lng: null, textoCompleto: '',
}

export interface DireccionConTipo {
  id: string
  tipo: string
  datos: DatosDireccionPlano
  /** Procedencia: 'manual' (default) | 'sync_perfil' (sincronizada del miembro vinculado).
   *  Las direcciones sync_perfil son read-only y se editan desde la sección Usuarios. */
  origen?: string
}

interface Props {
  direcciones: DireccionConTipo[]
  onChange: (direcciones: DireccionConTipo[]) => void
  paises?: string[]
  /** Si el contacto está vinculado a un miembro, mostramos un aviso sobre la dirección sincronizada. */
  miembroVinculado?: { nombre: string } | null
}

/**
 * DireccionesContacto — Tarjeta con header + dos modos:
 * - LECTURA: cuando hay calle cargada, muestra la dirección formateada en
 *   una sola pieza tipográfica con jerarquía (calle protagonista, secundarios
 *   atenuados). Botón lápiz para entrar a edición.
 * - EDICIÓN: buscador de Google ARRIBA (camino rápido) + campos en grid
 *   compacto (4 filas). Botón "Listo" para volver a lectura.
 *
 * Cada dirección guarda su propio estado de edición (Set<id>) — pasar entre
 * pills no resetea el modo de las otras.
 */
export function DireccionesContacto({ direcciones, onChange, paises, miembroVinculado }: Props) {
  const [tabActiva, setTabActiva] = useState(0)
  const [montado, setMontado] = useState(false)
  // IDs en modo edición — independiente por dirección.
  const [editandoIds, setEditandoIds] = useState<Set<string>>(new Set())
  // Índice de dirección pendiente de eliminar (modal de confirmación). null
  // = sin confirmación pedida. Solo se pide cuando la dirección tiene datos
  // cargados — borrar una vacía recién agregada es seguro y no merece fricción.
  const [indiceAEliminar, setIndiceAEliminar] = useState<number | null>(null)

  // Evitar hydration mismatch: la dirección virtual solo se muestra en el cliente
  useEffect(() => setMontado(true), [])

  // ─── Acciones ───

  const agregar = useCallback(() => {
    const usados = direcciones.map(d => d.tipo)
    const tipo = TIPOS_DIRECCION.find(t => !usados.includes(t.valor))?.valor || 'otra'
    const id = crypto.randomUUID()
    const nuevas = [...direcciones, { id, tipo, datos: { ...VACIA } }]
    onChange(nuevas)
    setTabActiva(nuevas.length - 1)
    // Una dirección nueva arranca en modo edición.
    setEditandoIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [direcciones, onChange])

  // Considera "vacía" a una dirección recién agregada que el usuario aún no
  // tocó (calle/ciudad/barrio/CP/provincia/país sin valor). Si tiene cualquier
  // dato, el borrado pasa por confirmación para evitar accidentes — más de
  // una vez Sal se llevó por delante una dirección apretando la X sin querer.
  const direccionTieneDatos = useCallback((i: number) => {
    const d = direcciones[i]
    if (!d) return false
    const x = d.datos
    return !!(x.calle || x.barrio || x.ciudad || x.provincia || x.codigoPostal || x.pais || x.piso || x.departamento || x.textoCompleto)
  }, [direcciones])

  const eliminarConfirmado = useCallback((i: number) => {
    const idEliminada = direcciones[i]?.id
    const nuevas = direcciones.filter((_, idx) => idx !== i)
    onChange(nuevas)
    if (tabActiva >= nuevas.length) setTabActiva(Math.max(0, nuevas.length - 1))
    if (idEliminada) {
      setEditandoIds(prev => {
        const next = new Set(prev)
        next.delete(idEliminada)
        return next
      })
    }
  }, [direcciones, onChange, tabActiva])

  const eliminar = useCallback((i: number) => {
    // Vacía: borrado directo. Con datos: pasa por modal de confirmación.
    if (!direccionTieneDatos(i)) {
      eliminarConfirmado(i)
      return
    }
    setIndiceAEliminar(i)
  }, [direccionTieneDatos, eliminarConfirmado])

  const cambiarTipo = useCallback((tipo: string) => {
    onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, tipo } : d))
  }, [direcciones, onChange, tabActiva])

  const cambiarCampo = useCallback((campo: keyof DatosDireccionPlano, valor: string) => {
    onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos: { ...d.datos, [campo]: valor } } : d))
  }, [direcciones, onChange, tabActiva])

  // Cuando se selecciona del buscador de Google
  const seleccionarDireccion = useCallback((dir: Direccion) => {
    const datos: DatosDireccionPlano = {
      calle: dir.calle, barrio: dir.barrio, codigoPostal: dir.codigoPostal,
      provincia: dir.provincia, ciudad: dir.ciudad, piso: '', departamento: '',
      pais: dir.pais, lat: dir.coordenadas?.lat ?? null, lng: dir.coordenadas?.lng ?? null,
      textoCompleto: dir.textoCompleto,
    }
    if (direcciones.length === 0) {
      // Primera dirección
      const id = crypto.randomUUID()
      onChange([{ id, tipo: 'principal', datos }])
      setTabActiva(0)
    } else {
      onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos } : d))
    }
  }, [direcciones, onChange, tabActiva])

  const etiquetaTipo = (tipo: string) => TIPOS_DIRECCION.find(t => t.valor === tipo)?.etiqueta || tipo

  // Si no hay direcciones y ya montó en cliente, mostrar una Principal virtual
  const esVirtual = direcciones.length === 0
  const dirsActuales = (esVirtual && montado)
    ? [{ id: 'dir-virtual', tipo: 'principal', datos: { ...VACIA } } as DireccionConTipo]
    : direcciones

  const dirActiva = dirsActuales[tabActiva] ?? dirsActuales[0]
  const idActiva = dirActiva?.id || ''
  const esSync = dirActiva?.origen === 'sync_perfil'
  const tieneContenido = !!(dirActiva?.datos.calle?.trim())
  // Edición activa si: el usuario la pidió explícitamente, es virtual, o no hay
  // calle cargada todavía (UX: una dirección vacía no tiene sentido mostrarla
  // en modo lectura). Las sincronizadas (sync_perfil) nunca entran en edición.
  const editando = !esSync && (editandoIds.has(idActiva) || esVirtual || !tieneContenido)

  const entrarEdicion = useCallback(() => {
    setEditandoIds(prev => {
      const next = new Set(prev)
      next.add(idActiva)
      return next
    })
  }, [idActiva])

  const salirEdicion = useCallback(() => {
    setEditandoIds(prev => {
      const next = new Set(prev)
      next.delete(idActiva)
      return next
    })
  }, [idActiva])

  // Sincronizar cambios: si es virtual, crear la dirección real al escribir
  const manejarCampo = useCallback((campo: keyof DatosDireccionPlano, valor: string) => {
    if (esVirtual) {
      // Primera escritura → crear la dirección formalmente
      const id = crypto.randomUUID()
      const nueva: DireccionConTipo = {
        id,
        tipo: 'principal',
        datos: { ...VACIA, [campo]: valor },
      }
      onChange([nueva])
      setTabActiva(0)
      setEditandoIds(prev => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    } else {
      cambiarCampo(campo, valor)
    }
  }, [esVirtual, onChange, cambiarCampo])

  const tituloSync = miembroVinculado
    ? `Dirección sincronizada del perfil de ${miembroVinculado.nombre}. Editala desde la sección Usuarios.`
    : 'Dirección sincronizada del perfil del miembro'

  return (
    <section>
      <div className="rounded-card border border-borde-sutil overflow-hidden">

        {/* Encabezado: ícono + título + pills + acción agregar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil gap-3 flex-wrap"
          style={{ backgroundColor: 'var(--superficie-tarjeta)' }}>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <MapPin size={15} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Dirección</h3>
            {/* Pills solo si hay más de una dirección — con una sola es redundante */}
            {dirsActuales.length > 1 && dirsActuales.map((d, i) => (
              <Boton
                key={d.id}
                variante={i === tabActiva ? 'primario' : 'secundario'}
                tamano="xs"
                redondeado
                onClick={() => setTabActiva(i)}
              >
                {etiquetaTipo(d.tipo)}
              </Boton>
            ))}
          </div>
          {!esSync && (
            <Boton variante="fantasma" tamano="xs" icono={<Plus size={13} />} onClick={agregar}>
              Agregar
            </Boton>
          )}
        </div>

        {/* Cuerpo */}
        <div className="px-4 py-4" style={{ backgroundColor: 'var(--superficie-app)' }}>
          {dirActiva && (
            <AnimatePresence mode="wait">
              {editando ? (
                <motion.div
                  key={`edit-${idActiva}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Selector de tipo + acciones (Listo / Eliminar) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-48">
                      <Select variante="plano"
                        opciones={TIPOS_DIRECCION}
                        valor={dirActiva.tipo}
                        onChange={(v) => esVirtual ? undefined : cambiarTipo(v)}
                        placeholder="Tipo..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {tieneContenido && (
                        <Boton variante="fantasma" tamano="xs" icono={<Check size={13} />} onClick={salirEdicion}>
                          Listo
                        </Boton>
                      )}
                      {!esVirtual && (
                        <>
                          {/* Separador visual entre "Listo" (cerrar editor)
                              y "Eliminar" (borrar dirección). Antes ambos
                              estaban pegados y la X de eliminar parecía un
                              "cerrar" — más de una vez se borró la dirección
                              sin querer. Ahora tachito de basura + gap. */}
                          <div className="w-px h-4 bg-borde-sutil" aria-hidden />
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar dirección"
                            icono={<Trash2 size={14} />} onClick={() => eliminar(tabActiva)}
                            className="text-texto-terciario hover:text-insignia-peligro" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Buscador Google ARRIBA — camino rápido para autocompletar */}
                  <InputDireccion
                    valorInicial=""
                    paises={paises}
                    alSeleccionar={seleccionarDireccion}
                    alLimpiar={() => {
                      if (!esVirtual) {
                        onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos: { ...VACIA } } : d))
                      }
                    }}
                    ocultarDetalle
                  />

                  {/* Grid compacto de campos: 4 filas en vez de 6 */}
                  <div className="space-y-3 pt-1">
                    <Input variante="plano" value={dirActiva.datos.calle}
                      onChange={e => manejarCampo('calle', e.target.value)}
                      placeholder="Calle y número" />

                    <div className="grid grid-cols-2 gap-4">
                      <Input variante="plano" value={dirActiva.datos.barrio}
                        onChange={e => manejarCampo('barrio', e.target.value)}
                        placeholder="Barrio / Comuna" />
                      <Input variante="plano" value={dirActiva.datos.codigoPostal}
                        onChange={e => manejarCampo('codigoPostal', e.target.value)}
                        placeholder="C.P." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input variante="plano" value={dirActiva.datos.ciudad}
                        onChange={e => manejarCampo('ciudad', e.target.value)}
                        placeholder="Ciudad" />
                      <Input variante="plano" value={dirActiva.datos.provincia}
                        onChange={e => manejarCampo('provincia', e.target.value)}
                        placeholder="Provincia" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input variante="plano" value={dirActiva.datos.piso}
                        onChange={e => manejarCampo('piso', e.target.value)}
                        placeholder="Piso" />
                      <Input variante="plano" value={dirActiva.datos.departamento}
                        onChange={e => manejarCampo('departamento', e.target.value)}
                        placeholder="Depto / Timbre" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`view-${idActiva}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <VistaLecturaDireccion
                    direccion={dirActiva}
                    onEditar={entrarEdicion}
                    onEliminar={!esSync ? () => eliminar(tabActiva) : undefined}
                    esSync={esSync}
                    tituloSync={tituloSync}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Confirmación de borrado de dirección con datos. La descripción
          muestra un resumen (calle + ciudad/país cuando estén) para que el
          usuario vea qué está por perder antes de confirmar. */}
      <ModalConfirmacion
        abierto={indiceAEliminar !== null}
        onCerrar={() => setIndiceAEliminar(null)}
        onConfirmar={() => {
          if (indiceAEliminar !== null) eliminarConfirmado(indiceAEliminar)
          setIndiceAEliminar(null)
        }}
        titulo="¿Eliminar esta dirección?"
        descripcion={
          indiceAEliminar !== null ? (
            <div className="flex flex-col gap-1.5">
              <span>Vas a perder todos los datos cargados de esta dirección. Esta acción no se puede deshacer.</span>
              {(() => {
                const d = direcciones[indiceAEliminar]
                if (!d) return null
                const partes = [
                  d.datos.calle,
                  [d.datos.ciudad, d.datos.provincia].filter(Boolean).join(', '),
                  d.datos.pais,
                ].filter(Boolean)
                if (partes.length === 0) return null
                return (
                  <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2 text-sm text-texto-secundario">
                    {partes.map((p, i) => (
                      <div key={i} className={i === 0 ? 'font-medium text-texto-primario' : ''}>{p}</div>
                    ))}
                  </div>
                )
              })()}
            </div>
          ) : undefined
        }
        tipo="peligro"
        etiquetaConfirmar="Eliminar dirección"
      />
    </section>
  )
}

/**
 * VistaLecturaDireccion — Vista compacta con jerarquía clara.
 * - Calle como protagonista (text-base, semibold).
 * - Cada componente (Barrio, Ciudad, Provincia, País, CP, Piso/Depto) con su
 *   etiqueta propia y valor debajo — grid 2 columnas. Campos vacíos no se
 *   renderizan, así no hay huecos ni labels sin valor.
 */
function VistaLecturaDireccion({
  direccion, onEditar, onEliminar, esSync, tituloSync,
}: {
  direccion: DireccionConTipo
  onEditar: () => void
  onEliminar?: () => void
  esSync: boolean
  tituloSync: string
}) {
  const d = direccion.datos
  const calle = d.calle.trim()
  const pisoDepto = [
    d.piso && `Piso ${d.piso}`,
    d.departamento && `Depto ${d.departamento}`,
  ].filter(Boolean).join(' · ')

  // Etiqueta legible del tipo (Principal / Fiscal / Servicio / Otra) para
  // mostrarla en el modo lectura — antes solo se veía en los pills cuando
  // había 2+ direcciones, así que con una sola dirección no se sabía qué
  // tipo era. Ahora siempre se ve.
  const etiquetaTipo = TIPOS_DIRECCION.find(t => t.valor === direccion.tipo)?.etiqueta || direccion.tipo

  // Campos secundarios con etiqueta — solo los que tienen valor.
  const campos = [
    { etiqueta: 'Barrio', valor: d.barrio },
    { etiqueta: 'Ciudad', valor: d.ciudad },
    { etiqueta: 'Provincia', valor: d.provincia },
    { etiqueta: 'País', valor: d.pais },
    { etiqueta: 'Código postal', valor: d.codigoPostal },
    { etiqueta: 'Piso · Depto', valor: pisoDepto },
  ].filter(c => c.valor && c.valor.trim())

  return (
    <div className="flex items-start gap-3">
      <MapPin size={20} className="text-texto-marca shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-3">
        {esSync && (
          <div className="flex items-center gap-1.5 text-[11px] text-texto-terciario">
            <Lock size={11} />
            <span>{tituloSync}</span>
          </div>
        )}
        {/* Tipo de dirección + calle protagonista en el mismo bloque visual.
            El tipo va arriba como label terciario (mismo estilo que el resto
            de los labels del detalle) para que se sepa de un vistazo qué
            tipo de dirección es. */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
            {etiquetaTipo}
          </div>
          <div className="text-base font-semibold text-texto-primario truncate">
            {calle || '—'}
          </div>
        </div>
        {/* Detalle estructurado: etiqueta arriba (terciaria) + valor abajo. */}
        {campos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {campos.map(c => (
              <div key={c.etiqueta} className="min-w-0">
                <div className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider mb-0.5">
                  {c.etiqueta}
                </div>
                <div className="text-sm text-texto-primario truncate">{c.valor}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!esSync && (
        <div className="flex items-center gap-2 shrink-0">
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar dirección"
            icono={<Pencil size={13} />} onClick={onEditar} />
          {onEliminar && (
            <>
              <div className="w-px h-4 bg-borde-sutil" aria-hidden />
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar dirección"
                icono={<Trash2 size={13} />} onClick={onEliminar}
                className="text-texto-terciario hover:text-insignia-peligro" />
            </>
          )}
        </div>
      )}
    </div>
  )
}

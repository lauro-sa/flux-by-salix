'use client'

import { useState, useRef, useCallback } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { CargadorInline } from '@/componentes/ui/Cargador'
import { Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight, ArrowLeft, X, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Modal de importación de contactos con flujo paso a paso:
 * 1. Subir archivo (Excel/CSV) con drag & drop
 * 2. Mapear columnas + previsualizar datos
 * 3. Importar con barra de progreso
 * 4. Resultado final (creados, actualizados, errores)
 * Se usa en: página de contactos → botón "Importar".
 */

interface PropiedadesModalImportar {
  abierto: boolean
  onCerrar: () => void
  onImportacionCompleta: () => void
}

interface AnalisisResultado {
  encabezados: string[]
  totalFilas: number
  preview: string[][]
  mapeo: Record<number, string | null>
  camposDisponibles: { clave: string; etiqueta: string }[]
  tiposContacto: { clave: string; etiqueta: string }[]
}

interface ResultadoImportacion {
  creados: number
  actualizados: number
  errores: number
  total: number
  detalleErrores: string[]
}

type Paso = 'subir' | 'mapear' | 'importando' | 'resultado'

export function ModalImportar({ abierto, onCerrar, onImportacionCompleta }: PropiedadesModalImportar) {
  const [paso, setPaso] = useState<Paso>('subir')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [analisis, setAnalisis] = useState<AnalisisResultado | null>(null)
  const [mapeo, setMapeo] = useState<Record<number, string | null>>({})
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const refInput = useRef<HTMLInputElement>(null)

  // ── Resetear estado al cerrar ──
  const cerrar = useCallback(() => {
    setPaso('subir')
    setArchivo(null)
    setAnalisis(null)
    setMapeo({})
    setResultado(null)
    setCargando(false)
    setError(null)
    onCerrar()
  }, [onCerrar])

  // ── Paso 1: Subir y analizar archivo ──
  const analizarArchivo = useCallback(async (file: File) => {
    setArchivo(file)
    setCargando(true)
    setError(null)

    const nombre = file.name.toLowerCase()

    // Si es JSON → backup directo (sin mapeo)
    if (nombre.endsWith('.json')) {
      try {
        const formData = new FormData()
        formData.append('archivo', file)

        const res = await fetch('/api/contactos/backup', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Error al restaurar backup JSON')
          setCargando(false)
          return
        }

        setResultado(data)
        setPaso('resultado')
        onImportacionCompleta()
      } catch {
        setError('Error al procesar el archivo JSON')
      } finally {
        setCargando(false)
      }
      return
    }

    // Excel o CSV → analizar con mapeo
    try {
      const formData = new FormData()
      formData.append('archivo', file)

      const res = await fetch('/api/contactos/importar/analizar', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al analizar el archivo')
        setCargando(false)
        return
      }

      setAnalisis(data)
      setMapeo(data.mapeo)
      setPaso('mapear')
    } catch {
      setError('Error al procesar el archivo')
    } finally {
      setCargando(false)
    }
  }, [onImportacionCompleta])

  const manejarDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files[0]
    if (file) analizarArchivo(file)
  }, [analizarArchivo])

  const manejarSeleccion = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) analizarArchivo(file)
    e.target.value = ''
  }, [analizarArchivo])

  // ── Paso 2→3: Ejecutar importación ──
  const ejecutarImportacion = useCallback(async () => {
    if (!archivo) return
    setPaso('importando')
    setCargando(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('mapeo', JSON.stringify(mapeo))

      const res = await fetch('/api/contactos/importar', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al importar')
        setPaso('mapear')
        setCargando(false)
        return
      }

      setResultado(data)
      setPaso('resultado')
      onImportacionCompleta()
    } catch {
      setError('Error al importar contactos')
      setPaso('mapear')
    } finally {
      setCargando(false)
    }
  }, [archivo, mapeo, onImportacionCompleta])

  // ── Cambiar mapeo de una columna ──
  const cambiarMapeo = useCallback((indice: number, campo: string | null) => {
    setMapeo(prev => ({ ...prev, [indice]: campo || null }))
  }, [])

  // Campos ya asignados (para evitar duplicados)
  const camposAsignados = new Set(Object.values(mapeo).filter(Boolean))

  // Título del modal según paso
  const titulos: Record<Paso, string> = {
    subir: 'Importar contactos',
    mapear: 'Mapear columnas y previsualizar',
    importando: 'Importando...',
    resultado: 'Resultado de la importación',
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo={titulos[paso]} tamano="4xl">
      <div className="min-h-[400px] flex flex-col">
        {/* ── Indicador de pasos ── */}
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-borde-sutil">
          {(['subir', 'mapear', 'importando', 'resultado'] as Paso[]).map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-borde-sutil" />}
              <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                paso === p ? 'bg-marca text-white' :
                (['subir', 'mapear', 'importando', 'resultado'].indexOf(paso) > i) ? 'bg-insignia-exito-fondo text-insignia-exito-texto' :
                'bg-superficie-elevada text-texto-terciario'
              }`}>
                {(['subir', 'mapear', 'importando', 'resultado'].indexOf(paso) > i) ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${paso === p ? 'text-texto-primario font-medium' : 'text-texto-terciario'}`}>
                {['Subir', 'Mapear', 'Importar', 'Resultado'][i]}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ══════ PASO 1: SUBIR ARCHIVO ══════ */}
          {paso === 'subir' && (
            <motion.div key="subir" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <div
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 p-8 transition-colors cursor-pointer ${
                  arrastrando ? 'border-marca bg-marca/5' : 'border-borde-sutil hover:border-marca/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={manejarDrop}
                onClick={() => refInput.current?.click()}
              >
                {cargando ? (
                  <div className="flex flex-col items-center gap-3">
                    <CargadorInline />
                    <p className="text-sm text-texto-secundario">Analizando archivo...</p>
                  </div>
                ) : (
                  <>
                    <div className="size-16 rounded-2xl bg-marca/10 flex items-center justify-center">
                      <Upload size={28} className="text-marca" />
                    </div>
                    <div className="text-center">
                      <p className="text-texto-primario font-medium">Arrastrá un archivo o hacé clic para seleccionar</p>
                      <p className="text-sm text-texto-terciario mt-1">Formatos soportados: .xlsx, .csv, .json</p>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-3 p-3 rounded-lg bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <input ref={refInput} type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" onChange={manejarSeleccion} />
            </motion.div>
          )}

          {/* ══════ PASO 2: MAPEAR COLUMNAS + PREVIEW ══════ */}
          {paso === 'mapear' && analisis && (
            <motion.div key="mapear" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Info del archivo */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-superficie-elevada">
                <FileSpreadsheet size={20} className="text-marca shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-texto-primario truncate">{archivo?.name}</p>
                  <p className="text-xs text-texto-terciario">{analisis.totalFilas} filas detectadas · {analisis.encabezados.length} columnas</p>
                </div>
              </div>

              {/* Mapeo de columnas */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-borde-sutil">
                      <th className="text-left py-2 px-3 text-texto-terciario font-medium w-[200px]">Columna del archivo</th>
                      <th className="text-left py-2 px-3 text-texto-terciario font-medium w-[40px]">→</th>
                      <th className="text-left py-2 px-3 text-texto-terciario font-medium w-[200px]">Campo en Flux</th>
                      <th className="text-left py-2 px-3 text-texto-terciario font-medium">Vista previa (primeras filas)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisis.encabezados.map((enc, i) => {
                      const campoAsignado = mapeo[i]
                      return (
                        <tr key={i} className="border-b border-borde-sutil/50 hover:bg-superficie-elevada/50">
                          <td className="py-2 px-3">
                            <span className="font-mono text-xs bg-superficie-elevada px-2 py-0.5 rounded">{enc}</span>
                          </td>
                          <td className="py-2 px-3 text-texto-terciario">→</td>
                          <td className="py-2 px-3">
                            <Select
                              opciones={[
                                { valor: '__ignorar__', etiqueta: '— Ignorar —' },
                                ...analisis.camposDisponibles.map(c => ({
                                  valor: c.clave,
                                  etiqueta: c.etiqueta,
                                  deshabilitada: camposAsignados.has(c.clave) && campoAsignado !== c.clave,
                                })),
                              ]}
                              valor={campoAsignado || '__ignorar__'}
                              onChange={(v) => cambiarMapeo(i, v === '__ignorar__' ? null : v)}
                              variante="plano"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2 overflow-hidden">
                              {analisis.preview.slice(0, 3).map((fila, j) => (
                                <span key={j} className="text-xs text-texto-terciario truncate max-w-[120px] bg-superficie-app px-1.5 py-0.5 rounded">
                                  {fila[i] || '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center justify-between pt-3 border-t border-borde-sutil">
                <Boton variante="fantasma" icono={<ArrowLeft size={14} />} onClick={() => { setPaso('subir'); setArchivo(null); setAnalisis(null) }}>
                  Volver
                </Boton>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-texto-terciario">
                    {Object.values(mapeo).filter(Boolean).length} columnas mapeadas
                  </span>
                  <Boton
                    icono={<ArrowRight size={14} />}
                    onClick={ejecutarImportacion}
                    disabled={!Object.values(mapeo).some(v => v === 'nombre')}
                  >
                    Importar {analisis.totalFilas} contactos
                  </Boton>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════ PASO 3: IMPORTANDO ══════ */}
          {paso === 'importando' && (
            <motion.div key="importando" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="size-16 rounded-2xl bg-marca/10 flex items-center justify-center animate-pulse">
                <FileSpreadsheet size={28} className="text-marca" />
              </div>
              <div className="text-center">
                <p className="text-texto-primario font-medium text-lg">Importando contactos...</p>
                <p className="text-sm text-texto-terciario mt-1">Esto puede tomar unos segundos</p>
              </div>
              <div className="w-64 h-2 rounded-full bg-superficie-elevada overflow-hidden">
                <motion.div
                  className="h-full bg-marca rounded-full"
                  initial={{ width: '10%' }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* ══════ PASO 4: RESULTADO ══════ */}
          {paso === 'resultado' && resultado && (
            <motion.div key="resultado" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col gap-4">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-insignia-exito-fondo text-center">
                  <p className="text-2xl font-bold text-insignia-exito-texto">{resultado.creados}</p>
                  <p className="text-xs text-insignia-exito-texto/80 mt-1">Creados</p>
                </div>
                <div className="p-4 rounded-xl bg-insignia-info-fondo text-center">
                  <p className="text-2xl font-bold text-insignia-info-texto">{resultado.actualizados}</p>
                  <p className="text-xs text-insignia-info-texto/80 mt-1">Actualizados</p>
                </div>
                <div className={`p-4 rounded-xl text-center ${resultado.errores > 0 ? 'bg-insignia-peligro-fondo' : 'bg-superficie-elevada'}`}>
                  <p className={`text-2xl font-bold ${resultado.errores > 0 ? 'text-insignia-peligro-texto' : 'text-texto-terciario'}`}>{resultado.errores}</p>
                  <p className={`text-xs mt-1 ${resultado.errores > 0 ? 'text-insignia-peligro-texto/80' : 'text-texto-terciario'}`}>Errores</p>
                </div>
              </div>

              {/* Detalle errores */}
              {resultado.detalleErrores.length > 0 && (
                <div className="flex-1 overflow-auto">
                  <p className="text-sm font-medium text-texto-secundario mb-2">Detalle de errores:</p>
                  <div className="space-y-1 max-h-[200px] overflow-auto">
                    {resultado.detalleErrores.map((err, i) => (
                      <div key={i} className="text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo/50 p-2 rounded flex items-start gap-2">
                        <X size={12} className="shrink-0 mt-0.5" />
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cerrar */}
              <div className="flex justify-end pt-3 border-t border-borde-sutil">
                <Boton onClick={cerrar} icono={<Check size={14} />}>
                  Cerrar
                </Boton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}

/**
 * ModalBackup — Modal simple para importar backup JSON.
 * Se usa en: página de contactos → menú acciones → "Restaurar backup".
 */
interface PropiedadesModalBackup {
  abierto: boolean
  onCerrar: () => void
  onImportacionCompleta: () => void
}

export function ModalBackup({ abierto, onCerrar, onImportacionCompleta }: PropiedadesModalBackup) {
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refInput = useRef<HTMLInputElement>(null)

  const cerrar = useCallback(() => {
    setResultado(null)
    setError(null)
    setCargando(false)
    onCerrar()
  }, [onCerrar])

  const restaurar = useCallback(async (file: File) => {
    setCargando(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('archivo', file)

      const res = await fetch('/api/contactos/backup', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al restaurar')
        setCargando(false)
        return
      }

      setResultado(data)
      onImportacionCompleta()
    } catch {
      setError('Error al restaurar backup')
    } finally {
      setCargando(false)
    }
  }, [onImportacionCompleta])

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Restaurar copia de seguridad" tamano="md">
      <div className="flex flex-col gap-4">
        {!resultado ? (
          <>
            <p className="text-sm text-texto-secundario">
              Seleccioná un archivo <code className="text-xs bg-superficie-elevada px-1.5 py-0.5 rounded">.json</code> generado por la función de copia de seguridad. Los contactos con código existente se actualizan, los nuevos se crean.
            </p>

            <div
              className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-marca/50 transition-colors"
              onClick={() => refInput.current?.click()}
            >
              {cargando ? (
                <div className="flex flex-col items-center gap-2">
                  <CargadorInline />
                  <p className="text-sm text-texto-secundario">Restaurando...</p>
                </div>
              ) : (
                <>
                  <Download size={24} className="text-marca" />
                  <p className="text-sm text-texto-primario">Seleccionar archivo JSON</p>
                </>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <input ref={refInput} type="file" accept=".json" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) restaurar(file)
              e.target.value = ''
            }} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-insignia-exito-fondo text-center">
                <p className="text-xl font-bold text-insignia-exito-texto">{resultado.creados}</p>
                <p className="text-xs text-insignia-exito-texto/80">Creados</p>
              </div>
              <div className="p-3 rounded-xl bg-insignia-info-fondo text-center">
                <p className="text-xl font-bold text-insignia-info-texto">{resultado.actualizados}</p>
                <p className="text-xs text-insignia-info-texto/80">Actualizados</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${resultado.errores > 0 ? 'bg-insignia-peligro-fondo' : 'bg-superficie-elevada'}`}>
                <p className={`text-xl font-bold ${resultado.errores > 0 ? 'text-insignia-peligro-texto' : 'text-texto-terciario'}`}>{resultado.errores}</p>
                <p className="text-xs text-texto-terciario">Errores</p>
              </div>
            </div>

            {resultado.detalleErrores.length > 0 && (
              <div className="max-h-[150px] overflow-auto space-y-1">
                {resultado.detalleErrores.map((err, i) => (
                  <div key={i} className="text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo/50 p-2 rounded">
                    {err}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Boton onClick={cerrar} icono={<Check size={14} />}>Cerrar</Boton>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

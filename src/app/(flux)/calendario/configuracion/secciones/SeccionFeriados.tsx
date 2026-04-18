'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Upload, Globe, Sparkles, Calendar, X, Check,
  AlertCircle, ChevronDown,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { PAISES_DISPONIBLES } from '@/lib/paises'
import { DELAY_ACCION, DELAY_NOTIFICACION } from '@/lib/constantes/timeouts'
import { useTraduccion } from '@/lib/i18n'

// ─── Tipos ───────────────────────────────────────────────────

interface Feriado {
  id: string
  nombre: string
  fecha: string
  tipo: string
  pais_codigo: string | null
  recurrente: boolean
  origen: string
  activo: boolean
}

interface FeriadoSugerido {
  fecha: string
  nombre: string
  tipo: string
  seleccionado: boolean
}

interface PropiedadesSeccionFeriados {
  feriados: Feriado[]
  cargando: boolean
  onActualizar: (feriados: Feriado[]) => void
  paisEmpresa: string
}

// ─── Colores por tipo de feriado ──────────────────────────────

const COLORES_TIPO: Record<string, { fondo: string; texto: string; borde: string; etiqueta: string }> = {
  nacional:     { fondo: 'bg-insignia-info-fondo', texto: 'text-insignia-info', borde: 'border-insignia-info/20', etiqueta: 'Nacional' },
  puente:       { fondo: 'bg-insignia-advertencia-fondo', texto: 'text-insignia-advertencia', borde: 'border-insignia-advertencia/20', etiqueta: 'Puente' },
  no_laborable: { fondo: 'bg-insignia-naranja-fondo', texto: 'text-insignia-naranja', borde: 'border-insignia-naranja/20', etiqueta: 'No laborable' },
  empresa:      { fondo: 'bg-insignia-violeta-fondo', texto: 'text-insignia-violeta', borde: 'border-insignia-violeta/20', etiqueta: 'Empresa' },
  regional:     { fondo: 'bg-teal-500/10', texto: 'text-teal-500', borde: 'border-teal-500/20', etiqueta: 'Regional' },
}

const TIPOS_FERIADO = [
  { valor: 'nacional', etiqueta: 'Nacional' },
  { valor: 'puente', etiqueta: 'Puente' },
  { valor: 'no_laborable', etiqueta: 'No laborable' },
  { valor: 'empresa', etiqueta: 'Empresa' },
  { valor: 'regional', etiqueta: 'Regional' },
]

function obtenerTipo(tipo: string) {
  return COLORES_TIPO[tipo] || COLORES_TIPO.nacional
}

// ─── Helper para formatear fecha ──────────────────────────────

function formatearFecha(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const dia = d.getDate()
  const mes = d.toLocaleDateString('es', { month: 'short' }).replace('.', '')
  return `${dia} ${mes}`
}

function diaSemana(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '')
}

// ─── Componente principal ─────────────────────────────────────

function SeccionFeriados({ feriados, cargando, onActualizar, paisEmpresa }: PropiedadesSeccionFeriados) {
  const { t } = useTraduccion()
  const [anioActivo, setAnioActivo] = useState(new Date().getFullYear())
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Modal crear manual
  const [modalCrear, setModalCrear] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('empresa')
  const [nuevoRecurrente, setNuevoRecurrente] = useState(false)

  // Modal IA
  const [modalIA, setModalIA] = useState(false)
  const [paisIA, setPaisIA] = useState(paisEmpresa || 'AR')
  const [generandoIA, setGenerandoIA] = useState(false)
  const [sugerenciasIA, setSugerenciasIA] = useState<FeriadoSugerido[]>([])

  // Modal cargar país
  const [modalPais, setModalPais] = useState(false)
  const [paisCargar, setPaisCargar] = useState(paisEmpresa || 'AR')

  // Modal confirmar limpieza
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false)

  // Ref para input file
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  // Filtrar feriados del año activo
  const feriadosAnio = feriados.filter(f => f.fecha.startsWith(`${anioActivo}-`))

  // ── Acciones API ──

  const llamarAPI = useCallback(async (accion: string, datos: Record<string, unknown>) => {
    const res = await fetch('/api/calendario/feriados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, datos }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error en operación')
    return data
  }, [])

  // ── Crear feriado manual ──
  const crearFeriado = useCallback(async () => {
    if (!nuevoNombre.trim() || !nuevaFecha) return
    setProcesando(true)
    setError(null)
    try {
      const resultado = await llamarAPI('crear', {
        nombre: nuevoNombre,
        fecha: nuevaFecha,
        tipo: nuevoTipo,
        recurrente: nuevoRecurrente,
      })
      onActualizar([...feriados, resultado])
      setModalCrear(false)
      setNuevoNombre('')
      setNuevaFecha('')
      setNuevoTipo('empresa')
      setNuevoRecurrente(false)
      setExito('Feriado creado')
      setTimeout(() => setExito(null), DELAY_ACCION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setProcesando(false)
    }
  }, [nuevoNombre, nuevaFecha, nuevoTipo, nuevoRecurrente, llamarAPI, feriados, onActualizar])

  // ── Eliminar feriado ──
  const eliminarFeriado = useCallback(async (id: string) => {
    try {
      await llamarAPI('eliminar', { id })
      onActualizar(feriados.filter(f => f.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }, [llamarAPI, feriados, onActualizar])

  // ── Cargar por país (date-holidays) ──
  const cargarPorPais = useCallback(async () => {
    setProcesando(true)
    setError(null)
    try {
      const resultado = await llamarAPI('cargar_pais', {
        pais_codigo: paisCargar,
        anio: anioActivo,
      })
      if (resultado.feriados) onActualizar(resultado.feriados)
      setModalPais(false)
      setExito(resultado.mensaje)
      setTimeout(() => setExito(null), DELAY_NOTIFICACION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setProcesando(false)
    }
  }, [llamarAPI, paisCargar, anioActivo, onActualizar])

  // ── Importar CSV ──
  const importarCSV = useCallback(async (contenido: string) => {
    setProcesando(true)
    setError(null)
    try {
      const lineas = contenido.trim().split('\n')
      // Detectar si tiene header
      const primeraLinea = lineas[0].toLowerCase()
      const tieneHeader = primeraLinea.includes('fecha') || primeraLinea.includes('nombre')
      const filasDatos = tieneHeader ? lineas.slice(1) : lineas

      const filas = filasDatos
        .filter(l => l.trim())
        .map(linea => {
          // Soportar separadores: coma, punto y coma, tab
          const partes = linea.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''))
          return {
            fecha: partes[0],
            nombre: partes[1] || '',
            tipo: partes[2] || 'nacional',
          }
        })

      const resultado = await llamarAPI('importar_csv', { filas })
      if (resultado.feriados) onActualizar(resultado.feriados)
      setExito(resultado.mensaje)
      setTimeout(() => setExito(null), DELAY_NOTIFICACION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setProcesando(false)
    }
  }, [llamarAPI, onActualizar])

  const manejarArchivo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const lector = new FileReader()
    lector.onload = (ev) => {
      const contenido = ev.target?.result as string
      importarCSV(contenido)
    }
    lector.readAsText(archivo)
    e.target.value = ''
  }, [importarCSV])

  // ── Generar con IA ──
  const generarConIA = useCallback(async () => {
    setGenerandoIA(true)
    setError(null)
    setSugerenciasIA([])
    try {
      const paisInfo = PAISES_DISPONIBLES.find(p => p.codigo === paisIA)
      const res = await fetch('/api/calendario/feriados/generar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pais: paisInfo?.nombre || paisIA, anio: anioActivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar')

      // Marcar todos como seleccionados por defecto
      const sugerencias = (data.feriados || []).map((f: { fecha: string; nombre: string; tipo: string }) => ({
        ...f,
        seleccionado: true,
      }))
      setSugerenciasIA(sugerencias)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Salix IA')
    } finally {
      setGenerandoIA(false)
    }
  }, [paisIA, anioActivo])

  // ── Confirmar sugerencias IA ──
  const confirmarSugerenciasIA = useCallback(async () => {
    const seleccionados = sugerenciasIA.filter(s => s.seleccionado)
    if (seleccionados.length === 0) return

    setProcesando(true)
    setError(null)
    try {
      const filas = seleccionados.map(s => ({
        fecha: s.fecha,
        nombre: s.nombre,
        tipo: s.tipo,
      }))
      const resultado = await llamarAPI('importar_csv', { filas })
      if (resultado.feriados) onActualizar(resultado.feriados)
      setModalIA(false)
      setSugerenciasIA([])
      setExito(`${resultado.insertados} feriados agregados con Salix IA`)
      setTimeout(() => setExito(null), DELAY_NOTIFICACION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setProcesando(false)
    }
  }, [sugerenciasIA, llamarAPI, onActualizar])

  // ── Limpiar año ──
  const limpiarAnio = useCallback(async () => {
    setProcesando(true)
    try {
      await llamarAPI('limpiar_anio', { anio: anioActivo })
      onActualizar(feriados.filter(f => !f.fecha.startsWith(`${anioActivo}-`)))
      setConfirmarLimpiar(false)
      setExito(`Feriados de ${anioActivo} eliminados`)
      setTimeout(() => setExito(null), DELAY_ACCION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al limpiar')
    } finally {
      setProcesando(false)
    }
  }, [llamarAPI, anioActivo, feriados, onActualizar])

  const toggleSugerencia = (idx: number) => {
    setSugerenciasIA(prev => prev.map((s, i) => i === idx ? { ...s, seleccionado: !s.seleccionado } : s))
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      {/* Mensajes */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-card bg-insignia-peligro-fondo border border-insignia-peligro/20 text-insignia-peligro text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {exito && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-card bg-insignia-exito-fondo border border-insignia-exito/20 text-insignia-exito text-sm">
          <Check size={16} />
          <span>{exito}</span>
        </div>
      )}

      {/* Tarjeta principal */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-texto-primario">Feriados y días no laborables</h3>
        </div>
        <p className="text-sm text-texto-terciario mb-5">
          Configura los feriados nacionales, puentes y días especiales de tu empresa. Se usan en el calendario y en asistencias.
        </p>

        {/* Selector de año + acciones */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Año */}
          <div className="flex items-center gap-1 bg-superficie-app border border-borde-sutil rounded-card overflow-hidden">
            <button
              onClick={() => setAnioActivo(a => a - 1)}
              className="px-2.5 py-2 text-sm text-texto-secundario hover:bg-superficie-hover transition-colors cursor-pointer"
            >
              ‹
            </button>
            <span className="px-2 py-2 text-sm font-semibold text-texto-primario min-w-[52px] text-center">
              {anioActivo}
            </span>
            <button
              onClick={() => setAnioActivo(a => a + 1)}
              className="px-2.5 py-2 text-sm text-texto-secundario hover:bg-superficie-hover transition-colors cursor-pointer"
            >
              ›
            </button>
          </div>

          {/* Acciones */}
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => setModalPais(true)}
            icono={<Globe size={14} />}
          >
            Cargar por país
          </Boton>

          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => { setModalIA(true); setSugerenciasIA([]) }}
            icono={<Sparkles size={14} />}
          >
            Salix IA
          </Boton>

          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => inputArchivoRef.current?.click()}
            icono={<Upload size={14} />}
          >
            Importar CSV
          </Boton>

          <input
            ref={inputArchivoRef}
            type="file"
            accept=".csv,.txt"
            onChange={manejarArchivo}
            className="hidden"
          />

          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => setModalCrear(true)}
            icono={<Plus size={14} />}
          >
            Agregar
          </Boton>

          {feriadosAnio.length > 0 && (
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => setConfirmarLimpiar(true)}
              icono={<Trash2 size={14} />}
              className="ml-auto text-texto-terciario hover:text-insignia-peligro"
            >
              Limpiar {anioActivo}
            </Boton>
          )}
        </div>

        {/* Lista de feriados */}
        {feriadosAnio.length === 0 ? (
          <div className="text-center py-10 text-texto-terciario">
            <Calendar size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No hay feriados para {anioActivo}</p>
            <p className="text-xs mt-1">
              Cargá feriados por país, importá un CSV, o pedile a Salix IA que los genere.
            </p>
          </div>
        ) : (
          <div className="border border-borde-sutil rounded-card overflow-hidden">
            {/* Header de tabla */}
            <div className="grid grid-cols-[72px_44px_1fr_100px_32px] gap-3 px-4 py-2.5 bg-superficie-app text-xs font-medium text-texto-terciario uppercase tracking-wider border-b border-borde-sutil">
              <span>Fecha</span>
              <span>Día</span>
              <span>Nombre</span>
              <span className="text-center">Tipo</span>
              <span />
            </div>

            {/* Filas */}
            <div className="divide-y divide-borde-sutil/50">
              {feriadosAnio.map(feriado => {
                const tipo = obtenerTipo(feriado.tipo)
                return (
                  <div
                    key={feriado.id}
                    className="grid grid-cols-[72px_44px_1fr_100px_32px] gap-3 items-center px-4 py-3 hover:bg-superficie-hover transition-colors group"
                  >
                    {/* Fecha */}
                    <span className="text-sm font-semibold text-texto-primario whitespace-nowrap">
                      {formatearFecha(feriado.fecha)}
                    </span>

                    {/* Día de la semana */}
                    <span className="text-xs text-texto-terciario capitalize">
                      {diaSemana(feriado.fecha)}
                    </span>

                    {/* Nombre */}
                    <span className="text-sm text-texto-primario">{feriado.nombre}</span>

                    {/* Badge tipo */}
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium text-center ${tipo.fondo} ${tipo.texto} ${tipo.borde}`}>
                      {tipo.etiqueta}
                    </span>

                    {/* Eliminar */}
                    <button
                      onClick={() => eliminarFeriado(feriado.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-insignia-peligro-fondo text-texto-terciario hover:text-insignia-peligro transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-texto-terciario mt-4 pt-3 border-t border-borde-sutil">
          {feriadosAnio.length} feriado{feriadosAnio.length !== 1 ? 's' : ''} en {anioActivo} · Los feriados se aplican a asistencias y nómina automáticamente.
        </p>
      </div>

      {/* ── Modal: Crear feriado manual ── */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalCrear(false)}>
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-modal p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-texto-primario mb-4">Agregar feriado</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-texto-secundario block mb-1.5">Nombre</label>
                <Input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Navidad, Día de la Independencia..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-texto-secundario block mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={e => setNuevaFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-card border border-borde-sutil bg-superficie-tarjeta text-texto-primario text-sm focus:outline-none focus:ring-2 focus:ring-texto-marca/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-texto-secundario block mb-1.5">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_FERIADO.map(t => (
                    <button
                      key={t.valor}
                      onClick={() => setNuevoTipo(t.valor)}
                      className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors cursor-pointer ${
                        nuevoTipo === t.valor
                          ? `${COLORES_TIPO[t.valor].fondo} ${COLORES_TIPO[t.valor].texto} ${COLORES_TIPO[t.valor].borde}`
                          : 'bg-superficie-app text-texto-secundario border-borde-sutil hover:bg-superficie-hover'
                      }`}
                    >
                      {t.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nuevoRecurrente}
                  onChange={e => setNuevoRecurrente(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-texto-secundario">Se repite cada año</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Boton variante="fantasma" onClick={() => setModalCrear(false)}>{t('comun.cancelar')}</Boton>
              <Boton onClick={crearFeriado} cargando={procesando} disabled={!nuevoNombre.trim() || !nuevaFecha}>
                Agregar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cargar por país ── */}
      {modalPais && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalPais(false)}>
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-modal p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-texto-primario mb-2">Cargar feriados por país</h3>
            <p className="text-sm text-texto-terciario mb-5">
              Se cargarán los feriados nacionales oficiales de {anioActivo} usando una base de datos pública.
            </p>

            <div className="mb-5">
              <label className="text-sm font-medium text-texto-secundario block mb-2">País</label>
              <div className="flex flex-wrap gap-2">
                {PAISES_DISPONIBLES.map(p => (
                  <button
                    key={p.codigo}
                    onClick={() => setPaisCargar(p.codigo)}
                    className={`px-3 py-2 rounded-card text-sm font-medium border transition-colors cursor-pointer ${
                      paisCargar === p.codigo
                        ? 'bg-texto-marca text-white border-texto-marca'
                        : 'bg-superficie-app text-texto-secundario border-borde-sutil hover:bg-superficie-hover'
                    }`}
                  >
                    {p.bandera} {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => setModalPais(false)}>{t('comun.cancelar')}</Boton>
              <Boton onClick={cargarPorPais} cargando={procesando} icono={<Globe size={14} />}>
                Cargar feriados
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Salix IA ── */}
      {modalIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalIA(false)}>
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-modal w-full max-w-2xl mx-4 max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header fijo */}
            <div className="p-6 pb-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-texto-marca" />
                <h3 className="text-lg font-semibold text-texto-primario">Generar con Salix IA</h3>
              </div>
              <p className="text-sm text-texto-terciario mb-5">
                {sugerenciasIA.length === 0
                  ? `Salix IA buscará en internet los feriados oficiales, puentes y días no laborables de tu país para ${anioActivo}.`
                  : `${sugerenciasIA.length} feriados encontrados para ${anioActivo}. Elegí cuáles querés agregar.`
                }
              </p>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* Selector de país (solo cuando no hay sugerencias) */}
              {sugerenciasIA.length === 0 && (
                <div className="mb-5">
                  <label className="text-sm font-medium text-texto-secundario block mb-2">País</label>
                  <div className="flex flex-wrap gap-2">
                    {PAISES_DISPONIBLES.map(p => (
                      <button
                        key={p.codigo}
                        onClick={() => setPaisIA(p.codigo)}
                        className={`px-3 py-2 rounded-card text-sm font-medium border transition-colors cursor-pointer ${
                          paisIA === p.codigo
                            ? 'bg-texto-marca text-white border-texto-marca'
                            : 'bg-superficie-app text-texto-secundario border-borde-sutil hover:bg-superficie-hover'
                        }`}
                      >
                        {p.bandera} {p.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de sugerencias */}
              {sugerenciasIA.length > 0 && (
                <div className="mb-4">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-texto-secundario">
                      <span className="font-semibold text-texto-primario">{sugerenciasIA.filter(s => s.seleccionado).length}</span> de {sugerenciasIA.length} seleccionados
                    </span>
                    <button
                      onClick={() => setSugerenciasIA(prev => prev.map(s => ({ ...s, seleccionado: !prev.every(p => p.seleccionado) })))}
                      className="text-xs text-texto-marca hover:underline cursor-pointer"
                    >
                      {sugerenciasIA.every(s => s.seleccionado) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>

                  {/* Header de tabla */}
                  <div className="grid grid-cols-[32px_72px_44px_1fr_100px] gap-3 px-4 py-2.5 text-xs font-medium text-texto-terciario uppercase tracking-wider border-b border-borde-sutil bg-superficie-app rounded-t-lg">
                    <span />
                    <span>Fecha</span>
                    <span>Día</span>
                    <span>Nombre</span>
                    <span className="text-center">Tipo</span>
                  </div>

                  {/* Filas */}
                  <div className="divide-y divide-borde-sutil/50">
                    {sugerenciasIA.map((s, i) => {
                      const tipo = obtenerTipo(s.tipo)
                      return (
                        <button
                          key={i}
                          onClick={() => toggleSugerencia(i)}
                          className={`w-full grid grid-cols-[32px_72px_44px_1fr_100px] gap-3 items-center px-4 py-3 transition-all cursor-pointer text-left ${
                            s.seleccionado ? '' : 'opacity-40'
                          } hover:bg-superficie-hover`}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                            s.seleccionado ? 'bg-texto-marca text-white' : 'border border-borde-fuerte'
                          }`}>
                            {s.seleccionado && <Check size={12} />}
                          </div>

                          {/* Fecha */}
                          <span className="text-sm font-semibold text-texto-primario whitespace-nowrap">
                            {formatearFecha(s.fecha)}
                          </span>

                          {/* Día de la semana */}
                          <span className="text-xs text-texto-terciario capitalize">
                            {diaSemana(s.fecha)}
                          </span>

                          {/* Nombre completo */}
                          <span className="text-sm text-texto-primario">
                            {s.nombre}
                          </span>

                          {/* Badge tipo */}
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium text-center ${tipo.fondo} ${tipo.texto} ${tipo.borde}`}>
                            {tipo.etiqueta}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer fijo */}
            <div className="p-6 pt-4 border-t border-borde-sutil flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => { setModalIA(false); setSugerenciasIA([]) }}>
                Cancelar
              </Boton>
              {sugerenciasIA.length === 0 ? (
                <Boton onClick={generarConIA} cargando={generandoIA} icono={<Sparkles size={14} />}>
                  Buscar feriados
                </Boton>
              ) : (
                <Boton
                  onClick={confirmarSugerenciasIA}
                  cargando={procesando}
                  disabled={sugerenciasIA.filter(s => s.seleccionado).length === 0}
                  icono={<Check size={14} />}
                >
                  Agregar {sugerenciasIA.filter(s => s.seleccionado).length} feriados
                </Boton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar limpieza ── */}
      <ModalConfirmacion
        abierto={confirmarLimpiar}
        onCerrar={() => setConfirmarLimpiar(false)}
        onConfirmar={limpiarAnio}
        titulo={`Eliminar feriados de ${anioActivo}`}
        descripcion={`Se eliminarán los ${feriadosAnio.length} feriados de ${anioActivo}. Esta acción no se puede deshacer.`}
        tipo="peligro"
        cargando={procesando}
      />
    </div>
  )
}

export { SeccionFeriados }
export type { Feriado }

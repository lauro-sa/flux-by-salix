'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useTraduccion } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Columns3, SlidersHorizontal, Bookmark, BookmarkPlus,
  List, LayoutGrid, CalendarDays, ArrowUpDown, Pin, Star, MoreVertical,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import { PortalPaginador } from '@/componentes/tablas/ContextoPaginacion'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { usePreferencias, type ConfigTabla } from '@/hooks/usePreferencias'
import { BREAKPOINTS } from '@/lib/breakpoints'
import {
  useVistasGuardadas, useDetectorVistas,
  type EstadoVistaDatos,
} from '@/hooks/useVistasGuardadas'

/* ── Sub-componentes extraídos ── */
import type {
  ColumnaDinamica, TipoVista, FiltroTabla, AccionLote, OpcionesVisuales,
  TipoCalculo, DireccionOrden, PropiedadesTablaDinamica,
} from '@/componentes/tablas/tipos-tabla'
import {
  obtenerValorCelda, compararValores,
  ANCHO_MINIMO_COLUMNA, ANCHO_DEFAULT_COLUMNA, REGISTROS_POR_PAGINA_DEFAULT,
} from '@/componentes/tablas/tipos-tabla'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { PanelColumnas } from '@/componentes/tablas/PanelColumnas'
import { SeccionFiltroPanel, GuardarVistaInline } from '@/componentes/tablas/PanelFiltros'
import { PieResumenFila } from '@/componentes/tablas/PieResumen'
import { BarraAccionesLote } from '@/componentes/tablas/BarraAccionesLote'

/* ════════════════════════════════════════════
   Componente principal: TablaDinamica
   ════════════════════════════════════════════ */

/**
 * TablaDinamica — Tabla de datos avanzada con múltiples vistas, filtros, paginación y personalización.
 * Se usa en: contactos, actividades, productos, documentos, órdenes, auditoría, etc.
 * Cada página define qué vistas están disponibles y el usuario puede alternar entre ellas.
 */

function TablaDinamica<T>({
  columnas,
  datos,
  claveFila,
  totalRegistros: totalRegistrosExternos,
  vistas = ['lista'],
  vistaInicial,
  renderTarjeta,
  registrosPorPagina = REGISTROS_POR_PAGINA_DEFAULT,
  paginaExterna,
  onCambiarPagina: onCambiarPaginaExterna,
  seleccionables = false,
  busqueda: busquedaExterna,
  onBusqueda,
  placeholder = 'Buscar...',
  filtros = [],
  onLimpiarFiltros,
  accionesLote = [],
  onClickFila,
  onVistaExterna,
  vistaExternaActiva,
  contenidoCustom,
  mostrarResumen = false,
  estadoVacio,
  idModulo,
  columnasVisiblesDefault,
  chipFiltro,
  opcionesOrden,
  accionDerecha,
  className = '',
}: PropiedadesTablaDinamica<T>) {

  const { t } = useTraduccion()
  const { locale } = useFormato()

  /* ── Preferencias (persistencia por usuario+dispositivo) ── */
  const { preferencias, cargando: cargandoPrefs, guardar: guardarPreferencias } = usePreferencias()
  const configGuardada = idModulo ? preferencias.config_tablas?.[idModulo] : undefined
  const configCargadaRef = useRef(false)

  /* Helper para guardar config de esta tabla */
  const guardarConfigTabla = useCallback((cambios: Partial<ConfigTabla>) => {
    if (!idModulo) return
    const configActual = preferencias.config_tablas[idModulo] || {}
    guardarPreferencias({
      config_tablas: {
        ...preferencias.config_tablas,
        [idModulo]: { ...configActual, ...cambios },
      },
    })
  }, [idModulo, preferencias.config_tablas, guardarPreferencias])

  /* ── Estado de vista ── */
  const [vistaActual, setVistaActual] = useState<TipoVista>(
    (configGuardada?.tipoVista as TipoVista) || vistaInicial || vistas[0] || 'lista'
  )
  const [menuVistasMobilAbierto, setMenuVistasMobilAbierto] = useState(false)
  const [esMobil, setEsMobil] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setEsMobil(mq.matches)
    const handler = (e: MediaQueryListEvent) => setEsMobil(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])


  /* En móvil (≤ 768px), forzar tarjetas si está disponible */
  const vistaManualRef = useRef(false)
  useEffect(() => {
    if (!vistas.includes('tarjetas') || vistas.length < 2) return
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS.md}px)`)
    const manejar = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        // Móvil → forzar tarjetas
        vistaManualRef.current = false
        setVistaActual('tarjetas')
      }
      // Desktop → no tocar, el efecto de restaurar config ya se encarga
    }
    manejar(mq)
    mq.addEventListener('change', manejar)
    return () => mq.removeEventListener('change', manejar)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistas])

  /* ── Estado de búsqueda ── */
  const [busquedaInterna, setBusquedaInterna] = useState(busquedaExterna || '')
  const [valorInput, setValorInput] = useState(busquedaExterna || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const medidorRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [inputEnfocado, setInputEnfocado] = useState(false)
  const [inputDesbordando, setInputDesbordando] = useState(false)
  const [anchoBuscador, setAnchoBuscador] = useState(0)

  // Medir ancho del texto para expandir el buscador progresivamente
  // Mínimo generoso en desktop, en móvil se adapta via max-width: 100%
  const ANCHO_MINIMO_BUSCADOR = esMobil ? 280 : 520
  const anchoBaseRef = useRef(0)
  useEffect(() => {
    if (!medidorRef.current) return
    // Calcular ancho base una sola vez (con el placeholder)
    if (anchoBaseRef.current === 0) {
      medidorRef.current.textContent = placeholder || 'Buscar...'
      anchoBaseRef.current = Math.max(medidorRef.current.offsetWidth + 180, ANCHO_MINIMO_BUSCADOR)
    }
    // Si hay texto, medir y usar el mayor entre base y texto
    if (valorInput) {
      medidorRef.current.textContent = valorInput
      const anchoTexto = medidorRef.current.offsetWidth + 180
      setAnchoBuscador(Math.max(anchoBaseRef.current, anchoTexto))
    } else {
      setAnchoBuscador(anchoBaseRef.current)
    }
  }, [valorInput, placeholder])

  /* ── Estado de selección ── */
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  /* Si una fila deja de estar en datos (p. ej. enviada a papelera), sacar su ID de la selección */
  useEffect(() => {
    const idsValidos = new Set(datos.map((fila) => claveFila(fila)))
    setSeleccionados((prev) => {
      if (prev.size === 0) return prev
      const next = new Set([...prev].filter((id) => idsValidos.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [datos, claveFila])

  /* ── Filtros automáticos (generados desde columnas con filtrable: true) ── */
  const columnasFiltrable = useMemo(
    () => columnas.filter(c => c.filtrable),
    [columnas]
  )

  /* Estado interno de cada filtro automático: { clave_columna: valor } */
  const [filtrosInternos, setFiltrosInternos] = useState<Record<string, string | string[]>>(() => {
    const inicial: Record<string, string | string[]> = {}
    columnasFiltrable.forEach(c => {
      const tipo = c.tipoFiltro || (c.tipo === 'fecha' ? 'fecha' : 'seleccion')
      inicial[c.clave] = tipo === 'multiple' ? [] : ''
    })
    return inicial
  })

  /* Generar FiltroTabla[] a partir de columnas filtrables + filtrosInternos */
  const filtrosAutoGenerados: FiltroTabla[] = useMemo(() => {
    return columnasFiltrable.map(col => {
      const tipo = col.tipoFiltro || (col.tipo === 'fecha' ? 'fecha' : 'seleccion')
      return {
        id: col.clave,
        etiqueta: col.etiqueta,
        tipo,
        valor: filtrosInternos[col.clave] ?? (tipo === 'multiple' ? [] : ''),
        onChange: (nuevoValor: string | string[]) => {
          setFiltrosInternos(prev => ({ ...prev, [col.clave]: nuevoValor }))
        },
        opciones: col.opcionesFiltro,
      }
    })
  }, [columnasFiltrable, filtrosInternos])

  /* Combinar filtros externos (prop) con auto-generados */
  const todosLosFiltros = useMemo(
    () => [...filtros, ...filtrosAutoGenerados],
    [filtros, filtrosAutoGenerados]
  )

  /* ── Vistas guardadas (auto-gestión cuando hay idModulo) ── */
  const {
    vistas: vistasGuardadas,
    guardar: guardarVistaBD,
    eliminar: eliminarVistaBD,
    sobrescribir: sobrescribirVistaBD,
    marcarPredefinida: marcarPredefinidaBD,
    vistaPredefinida,
  } = useVistasGuardadas(idModulo)

  /* ── Estado de columnas (inicializa desde config guardada si existe) ── */
  /* Si hay config guardada, se merge con las columnas actuales del código para que
     columnas nuevas aparezcan automáticamente (al final, visibles por defecto) */
  const columnasIniciales = useMemo(() => columnas.map((c) => c.clave), [columnas])
  const columnasDefaultResueltas = columnasVisiblesDefault?.filter(c => columnasIniciales.includes(c)) || columnasIniciales
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>(() => {
    if (!configGuardada?.columnasVisibles) return columnasDefaultResueltas
    // Respetar exactamente lo que el usuario guardó (sin agregar nuevas como visibles)
    return configGuardada.columnasVisibles.filter(c => columnasIniciales.includes(c))
  })
  const [ordenColumnas, setOrdenColumnas] = useState<string[]>(() => {
    if (!configGuardada?.ordenColumnas) return columnasIniciales
    const guardadas = configGuardada.ordenColumnas
    // Columnas nuevas van al orden (para que aparezcan en "Disponibles") pero no visibles
    const nuevas = columnasIniciales.filter(c => !guardadas.includes(c))
    return [...guardadas.filter(c => columnasIniciales.includes(c)), ...nuevas]
  })
  const [columnasAncladas, setColumnasAncladas] = useState<string[]>(
    configGuardada?.columnasAncladas || []
  )
  const [anchoColumnas, setAnchoColumnas] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    columnas.forEach((c) => { m[c.clave] = c.ancho || ANCHO_DEFAULT_COLUMNA })
    return configGuardada?.anchoColumnas ? { ...m, ...configGuardada.anchoColumnas } : m
  })
  const [alineacionColumnas, setAlineacionColumnas] = useState<Record<string, 'left' | 'center' | 'right'>>(() => {
    const m: Record<string, 'left' | 'center' | 'right'> = {}
    columnas.forEach((c) => { if (c.alineacion) m[c.clave] = c.alineacion })
    return configGuardada?.alineacionColumnas ? { ...m, ...(configGuardada.alineacionColumnas as Record<string, 'left' | 'center' | 'right'>) } : m
  })

  /* ── Estado de ordenamiento ── */
  const [ordenamiento, setOrdenamiento] = useState<{ clave: string; direccion: DireccionOrden }[]>([])

  /* ── Estado de opciones visuales ── */
  const [opcionesVisuales, setOpcionesVisuales] = useState<OpcionesVisuales>({
    mostrarDivisores: true,
    filasAlternas: false,
    bordesColumnas: false,
    ...(configGuardada?.opcionesVisuales as Partial<OpcionesVisuales> || {}),
  })

  /* ── Estado de paneles ── */
  const [panelColumnasAbierto, setPanelColumnasAbierto] = useState(false)
  const [panelFiltrosAbierto, setPanelFiltrosAbierto] = useState(false)
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false)

  /* ── Estado de paginación ── */
  const [paginaInterna, setPaginaInterna] = useState(1)
  const esServerSide = paginaExterna !== undefined && onCambiarPaginaExterna !== undefined
  const paginaActual = esServerSide ? paginaExterna : paginaInterna
  const tablaScrollRef = useRef<HTMLDivElement>(null)
  const setPaginaActual = useCallback((p: number) => {
    if (esServerSide) onCambiarPaginaExterna!(p)
    else setPaginaInterna(p)
    // Scroll al tope del contenedor de la tabla al cambiar de página
    tablaScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [esServerSide, onCambiarPaginaExterna])

  /* ── Estado de resize ── */
  const [columnaRedimensionando, setColumnaRedimensionando] = useState<string | null>(null)
  const inicioResizeRef = useRef<{ x: number; anchoInicial: number }>({ x: 0, anchoInicial: 0 })

  /* ── Refs para cerrar paneles al click fuera ── */
  const contenedorRef = useRef<HTMLDivElement>(null)
  const panelColumnasRef = useRef<HTMLDivElement>(null)

  /* ══════════════════════════════════════
     Detector de vistas guardadas
     ══════════════════════════════════════ */

  /* Estado actual de datos — lo que se compara contra vistas guardadas.
     Incluye filtros internos (auto-generados) + filtros externos (prop).
     Filtros en su valorDefault se omiten para que el detector los vea como "sin cambios". */
  const estadoActualDatos: EstadoVistaDatos = useMemo(() => {
    const todosLosFiltrosEstado: Record<string, string | string[]> = { ...filtrosInternos }
    /* Incorporar filtros externos al estado (solo si difieren de su default) */
    filtros.forEach(f => {
      if (f.valorDefault !== undefined) {
        const esDefault = Array.isArray(f.valor) && Array.isArray(f.valorDefault)
          ? f.valor.length === f.valorDefault.length && f.valorDefault.every(d => (f.valor as string[]).includes(d))
          : f.valor === f.valorDefault
        if (esDefault) return // omitir del estado — es el default
      }
      todosLosFiltrosEstado[f.id] = f.valor
    })
    return {
      busqueda: busquedaInterna,
      filtros: todosLosFiltrosEstado,
      ordenamiento,
    }
  }, [busquedaInterna, filtrosInternos, filtros, ordenamiento])

  /* Detector reactivo: default / vista_activa / sin_guardar */
  const detector = useDetectorVistas(estadoActualDatos, vistasGuardadas)

  /* Aplicar vista predefinida al cargar (solo una vez) */
  const vistaPredefAplicadaRef = useRef(false)
  useEffect(() => {
    if (vistaPredefAplicadaRef.current || !vistaPredefinida) return
    vistaPredefAplicadaRef.current = true
    aplicarEstadoVista(vistaPredefinida.estado)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaPredefinida])

  /* Helper: aplicar el estado de una vista (búsqueda + filtros + orden) */
  const aplicarEstadoVista = useCallback((estado: EstadoVistaDatos) => {
    /* Búsqueda */
    setValorInput(estado.busqueda)
    setBusquedaInterna(estado.busqueda)
    onBusqueda?.(estado.busqueda)

    /* Filtros internos */
    setFiltrosInternos(prev => {
      const nuevo = { ...prev }
      for (const clave of Object.keys(nuevo)) {
        nuevo[clave] = estado.filtros[clave] ?? (Array.isArray(nuevo[clave]) ? [] : '')
      }
      return nuevo
    })

    /* Filtros externos: llamar onChange de cada filtro pasado por prop */
    filtros.forEach(f => {
      const valor = estado.filtros[f.id]
      if (valor !== undefined) f.onChange(valor)
    })

    /* Ordenamiento */
    setOrdenamiento(estado.ordenamiento || [])
  }, [filtros, onBusqueda])

  /* Handlers de vistas */
  const manejarGuardarVista = useCallback((nombre: string) => {
    guardarVistaBD(nombre, estadoActualDatos)
  }, [guardarVistaBD, estadoActualDatos])

  const manejarEliminarVista = useCallback((id: string) => {
    eliminarVistaBD(id)
  }, [eliminarVistaBD])

  const manejarAplicarVista = useCallback((id: string) => {
    const vista = vistasGuardadas.find(v => v.id === id)
    if (vista) aplicarEstadoVista(vista.estado)
  }, [vistasGuardadas, aplicarEstadoVista])

  const manejarSobrescribirVista = useCallback((id: string) => {
    sobrescribirVistaBD(id, estadoActualDatos)
  }, [sobrescribirVistaBD, estadoActualDatos])

  const manejarMarcarPredefinida = useCallback((id: string) => {
    marcarPredefinidaBD(id)
  }, [marcarPredefinidaBD])

  /* Limpiar todo: búsqueda + filtros internos + filtros externos + orden */
  const limpiarTodo = useCallback(() => {
    setValorInput('')
    setBusquedaInterna('')
    onBusqueda?.('')
    setInputDesbordando(false)
    /* Reset filtros internos */
    setFiltrosInternos(prev => {
      const limpio: Record<string, string | string[]> = {}
      for (const clave of Object.keys(prev)) {
        limpio[clave] = Array.isArray(prev[clave]) ? [] : ''
      }
      return limpio
    })
    /* Reset filtros externos */
    onLimpiarFiltros?.()
    /* Reset orden */
    setOrdenamiento([])
  }, [onBusqueda, onLimpiarFiltros])

  /* ── Sincronizar búsqueda externa ── */
  useEffect(() => {
    if (busquedaExterna !== undefined) {
      setBusquedaInterna(busquedaExterna)
      setValorInput(busquedaExterna)
    }
  }, [busquedaExterna])

  /* ── Reset selección cuando cambian los datos ── */
  useEffect(() => {
    setSeleccionados(new Set())
  }, [datos])

  /* ── Reset página cuando cambia búsqueda/filtros (solo client-side) ── */
  useEffect(() => {
    if (!esServerSide) setPaginaInterna(1)
  }, [busquedaInterna, filtros, esServerSide])

  /* ── Cerrar paneles al click fuera ── */
  useEffect(() => {
    if (!panelColumnasAbierto && !panelFiltrosAbierto && !menuAccionesAbierto) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setPanelColumnasAbierto(false)
        setPanelFiltrosAbierto(false)
        setMenuAccionesAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelColumnasAbierto, panelFiltrosAbierto, menuAccionesAbierto])

  /* ── Resize de columnas (mouse events globales) ── */
  useEffect(() => {
    if (!columnaRedimensionando) return

    const manejarMove = (e: MouseEvent) => {
      const delta = e.clientX - inicioResizeRef.current.x
      const nuevoAncho = Math.max(
        columnas.find((c) => c.clave === columnaRedimensionando)?.anchoMinimo || ANCHO_MINIMO_COLUMNA,
        inicioResizeRef.current.anchoInicial + delta
      )
      setAnchoColumnas((prev) => ({ ...prev, [columnaRedimensionando]: nuevoAncho }))
    }

    const manejarUp = () => {
      setColumnaRedimensionando(null)
      // Bloquear el click de ordenamiento que se dispara justo después del mouseup
      resizeRecienTerminadoRef.current = true
      setTimeout(() => { resizeRecienTerminadoRef.current = false }, 50)
    }

    document.addEventListener('mousemove', manejarMove)
    document.addEventListener('mouseup', manejarUp)
    return () => {
      document.removeEventListener('mousemove', manejarMove)
      document.removeEventListener('mouseup', manejarUp)
    }
  }, [columnaRedimensionando, columnas])

  /* ── Handlers de búsqueda ── */
  const manejarCambioBusqueda = useCallback((v: string) => {
    setValorInput(v)
    // Detectar si el texto está por desbordar el input (>80% del ancho)
    if (inputRef.current) {
      const { scrollWidth, clientWidth } = inputRef.current
      setInputDesbordando(scrollWidth > clientWidth * 0.8)
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setBusquedaInterna(v)
      onBusqueda?.(v)
    }, 400)
  }, [onBusqueda])

  /* ── Restaurar config guardada cuando las preferencias terminan de cargar ── */
  useEffect(() => {
    // Si vuelve a cargar (ej: auth resuelve y re-fetch de API), resetear flags
    if (cargandoPrefs) {
      configCargadaRef.current = false
      yaInicializado.current = false
      return
    }
    if (configCargadaRef.current || !idModulo) return
    const cfg = preferencias.config_tablas?.[idModulo]
    if (!cfg) { configCargadaRef.current = true; return }

    configCargadaRef.current = true
    // Visibles: respetar exactamente lo guardado (no agregar nuevas como visibles)
    if (cfg.columnasVisibles?.length) {
      setColumnasVisibles(cfg.columnasVisibles.filter(c => columnasIniciales.includes(c)))
    }
    // Orden: agregar columnas nuevas al final (aparecen en "Disponibles" del panel)
    if (cfg.ordenColumnas?.length) {
      const nuevas = columnasIniciales.filter(c => !cfg.ordenColumnas!.includes(c))
      setOrdenColumnas([...cfg.ordenColumnas.filter(c => columnasIniciales.includes(c)), ...nuevas])
    }
    if (cfg.columnasAncladas) setColumnasAncladas(cfg.columnasAncladas)
    if (cfg.anchoColumnas) setAnchoColumnas(prev => ({ ...prev, ...cfg.anchoColumnas }))
    if (cfg.alineacionColumnas) setAlineacionColumnas(prev => ({ ...prev, ...(cfg.alineacionColumnas as Record<string, 'left' | 'center' | 'right'>) }))
    if (cfg.tipoVista) setVistaActual(cfg.tipoVista as TipoVista)
    if (cfg.opcionesVisuales) setOpcionesVisuales(prev => ({ ...prev, ...cfg.opcionesVisuales as Partial<OpcionesVisuales> }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoPrefs, idModulo, preferencias.config_tablas])

  /* ── Persistir config de tabla al cambiar (debounced) ── */
  const persistirRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const yaInicializado = useRef(false)

  useEffect(() => {
    // No guardar hasta que las preferencias se cargaron y se restauró la config
    if (!configCargadaRef.current || !yaInicializado.current) {
      yaInicializado.current = configCargadaRef.current
      return
    }
    if (!idModulo) return

    if (persistirRef.current) clearTimeout(persistirRef.current)
    persistirRef.current = setTimeout(() => {
      guardarConfigTabla({
        columnasVisibles,
        ordenColumnas,
        columnasAncladas,
        anchoColumnas,
        alineacionColumnas,
        tipoVista: vistaActual,
        opcionesVisuales: opcionesVisuales as unknown as Record<string, boolean>,
      })
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnasVisibles, ordenColumnas, columnasAncladas, anchoColumnas, alineacionColumnas, vistaActual, opcionesVisuales, idModulo])

  /* ── Handlers de columnas ── */
  const toggleColumna = (clave: string) => {
    setColumnasVisibles((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    )
  }

  const toggleAnclar = (clave: string) => {
    setColumnasAncladas((prev) => {
      if (prev.includes(clave)) {
        /* Desanclar: quitar esta columna y todas las que están después de ella */
        const indice = ordenColumnas.indexOf(clave)
        return prev.filter((c) => {
          const idx = ordenColumnas.indexOf(c)
          return idx < indice
        })
      } else {
        /* Anclar: anclar todas las columnas visibles desde la primera hasta esta (inclusive) */
        const indice = ordenColumnas.indexOf(clave)
        const nuevas: string[] = []
        for (let i = 0; i <= indice; i++) {
          const col = ordenColumnas[i]
          if (columnasVisibles.includes(col)) {
            nuevas.push(col)
          }
        }
        return nuevas
      }
    })
  }

  const cambiarAlineacion = useCallback((clave: string, alineacion: 'left' | 'center' | 'right') => {
    setAlineacionColumnas(prev => ({ ...prev, [clave]: alineacion }))
  }, [])

  const mostrarTodasColumnas = useCallback(() => {
    setColumnasVisibles(columnasIniciales)
  }, [columnasIniciales])

  const ocultarTodasColumnas = useCallback(() => {
    // Dejar visible solo la primera columna
    setColumnasVisibles([columnasIniciales[0]])
  }, [columnasIniciales])

  const alinearTodasColumnas = useCallback((alineacion: 'left' | 'center' | 'right') => {
    const nuevo: Record<string, 'left' | 'center' | 'right'> = {}
    columnas.forEach(c => { nuevo[c.clave] = alineacion })
    setAlineacionColumnas(nuevo)
  }, [columnas])

  const restablecerColumnas = () => {
    setColumnasVisibles(columnasDefaultResueltas)
    setOrdenColumnas(columnasIniciales)
    setColumnasAncladas([])
    setAlineacionColumnas(() => {
      const m: Record<string, 'left' | 'center' | 'right'> = {}
      columnas.forEach((c) => { if (c.alineacion) m[c.clave] = c.alineacion })
      return m
    })
    setAnchoColumnas(() => {
      const m: Record<string, number> = {}
      columnas.forEach((c) => { m[c.clave] = c.ancho || ANCHO_DEFAULT_COLUMNA })
      return m
    })
    setOpcionesVisuales({ mostrarDivisores: true, filasAlternas: false, bordesColumnas: false })
  }

  const ajustarAnchosAuto = () => {
    /* Misma técnica que el viejo SalixCRM: quitar restricciones de width en th/td,
       medir offsetWidth real, restaurar y aplicar los anchos medidos. */
    const tabla = contenedorRef.current?.querySelector('table') as HTMLTableElement | null
    if (!tabla) return

    const nuevosAnchos: Record<string, number> = {}
    const colsRender = columnasRenderizar
    const startIdx = (seleccionables ? 1 : 0)

    /* Guardar estilos originales */
    const origLayout = tabla.style.tableLayout
    const origWidth = tabla.style.width
    const ths = Array.from(tabla.querySelectorAll('thead tr th')) as HTMLElement[]
    const origThStyles = ths.map(th => ({ width: th.style.width, minWidth: th.style.minWidth, maxWidth: th.style.maxWidth }))

    const colTds = colsRender.map((_, i) => {
      const colIdx = startIdx + i + 1
      return Array.from(tabla.querySelectorAll(`tbody tr td:nth-child(${colIdx})`))
    })
    const origTdStyles = colTds.map(tds =>
      tds.map(td => ({ width: (td as HTMLElement).style.width, minWidth: (td as HTMLElement).style.minWidth, maxWidth: (td as HTMLElement).style.maxWidth }))
    )

    /* Quitar restricciones */
    tabla.style.tableLayout = 'auto'
    tabla.style.width = 'auto'
    ths.forEach(th => { th.style.width = 'auto'; th.style.minWidth = 'auto'; th.style.maxWidth = 'none' })
    colTds.forEach(tds => tds.forEach(td => { (td as HTMLElement).style.width = 'auto'; (td as HTMLElement).style.minWidth = 'auto'; (td as HTMLElement).style.maxWidth = 'none' }))

    /* Forzar reflow */
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tabla.offsetWidth

    /* Medir: max(offsetWidth del th, max offsetWidth de tds) + margen */
    colsRender.forEach((col, i) => {
      const th = ths[startIdx + i]
      const anchoTh = th ? th.offsetWidth : 0
      const anchoMaxTd = colTds[i].reduce((max, td) => Math.max(max, (td as HTMLElement).offsetWidth), 0)
      nuevosAnchos[col.clave] = Math.max(anchoTh, anchoMaxTd) + 12
    })

    /* Restaurar inmediatamente */
    tabla.style.tableLayout = origLayout
    tabla.style.width = origWidth
    ths.forEach((th, i) => Object.assign(th.style, origThStyles[i]))
    colTds.forEach((tds, i) => tds.forEach((td, j) => Object.assign((td as HTMLElement).style, origTdStyles[i][j])))

    /* Columnas no visibles mantienen su ancho */
    columnas.forEach((c) => {
      if (!nuevosAnchos[c.clave]) {
        nuevosAnchos[c.clave] = anchoColumnas[c.clave] || c.ancho || ANCHO_DEFAULT_COLUMNA
      }
    })

    setAnchoColumnas(nuevosAnchos)
  }

  const cambiarOpcionVisual = (opcion: keyof OpcionesVisuales) => {
    setOpcionesVisuales((prev) => ({ ...prev, [opcion]: !prev[opcion] }))
  }

  /* ── Handler de ordenamiento ── */
  const toggleOrden = (clave: string) => {
    setOrdenamiento((prev) => {
      const existente = prev.find((o) => o.clave === clave)
      if (!existente) return [{ clave, direccion: 'asc' }]
      if (existente.direccion === 'asc') return [{ clave, direccion: 'desc' }]
      return [] // tercer click quita el orden
    })
  }

  /* ── Selección ── */
  const toggleTodos = () => {
    if (seleccionados.size === datosPaginados.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(datosPaginados.map(claveFila)))
    }
  }

  const toggleUno = (id: string) => {
    const nuevo = new Set(seleccionados)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    setSeleccionados(nuevo)
  }

  /* ── Iniciar resize ── */
  const resizeRecienTerminadoRef = useRef(false)
  const iniciarResize = (clave: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setColumnaRedimensionando(clave)
    inicioResizeRef.current = { x: e.clientX, anchoInicial: anchoColumnas[clave] || ANCHO_DEFAULT_COLUMNA }
  }

  /* ── Procesamiento de datos ── */

  /* Filtros internos — filtra datos según los filtros auto-generados de columnas */
  const datosFiltrados = useMemo(() => {
    /* Verificar si hay algún filtro activo */
    const filtrosActivos = Object.entries(filtrosInternos).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== ''
    )
    if (filtrosActivos.length === 0) return datos

    return datos.filter(fila => {
      for (const [clave, valorFiltro] of filtrosActivos) {
        const obj = fila as Record<string, unknown>
        const valorCelda = String(obj[clave] ?? '').toLowerCase()

        if (Array.isArray(valorFiltro)) {
          /* Filtro múltiple: el valor de la celda debe estar en la lista */
          if (!valorFiltro.some(v => valorCelda === v.toLowerCase())) return false
        } else {
          /* Filtro simple: coincidencia exacta */
          if (valorCelda !== valorFiltro.toLowerCase()) return false
        }
      }
      return true
    })
  }, [datos, filtrosInternos])

  /* Búsqueda interna — filtra datos buscando en las columnas (solo client-side,
     en server-side el servidor ya filtró) */
  const datosBuscados = useMemo(() => {
    if (esServerSide || !busquedaInterna.trim()) return datosFiltrados
    const termino = busquedaInterna.toLowerCase().trim()
    return datosFiltrados.filter(fila => {
      /* Buscar en todas las columnas */
      for (const col of columnas) {
        const valor = obtenerValorCelda(fila, col)
        if (valor !== null && valor !== undefined && valor !== '') {
          if (String(valor).toLowerCase().includes(termino)) return true
        }
      }
      /* También buscar en propiedades directas del objeto */
      const obj = fila as Record<string, unknown>
      for (const clave of Object.keys(obj)) {
        const v = obj[clave]
        if (typeof v === 'string' && v.toLowerCase().includes(termino)) return true
        if (typeof v === 'number' && String(v).includes(termino)) return true
      }
      return false
    })
  }, [datosFiltrados, busquedaInterna, columnas, esServerSide])

  /* Ordenar */
  const datosOrdenados = useMemo(() => {
    if (ordenamiento.length === 0) return datosBuscados
    const copia = [...datosBuscados]
    copia.sort((a, b) => {
      for (const { clave, direccion } of ordenamiento) {
        const col = columnas.find((c) => c.clave === clave)
        if (!col) continue
        const va = obtenerValorCelda(a, col)
        const vb = obtenerValorCelda(b, col)
        const resultado = compararValores(va, vb, direccion)
        if (resultado !== 0) return resultado
      }
      return 0
    })
    return copia
  }, [datosBuscados, ordenamiento, columnas])

  /* Paginar */
  const totalRegistros = totalRegistrosExternos ?? datosOrdenados.length
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina))
  const registroInicio = (paginaActual - 1) * registrosPorPagina + 1
  const registroFin = Math.min(paginaActual * registrosPorPagina, totalRegistros)
  const datosPaginados = esServerSide
    ? datosOrdenados // datos ya vienen paginados del servidor
    : datosOrdenados.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina)

  /* Columnas visibles en orden */
  const columnasRenderizar = useMemo(() => {
    return ordenColumnas
      .filter((clave) => columnasVisibles.includes(clave))
      .map((clave) => columnas.find((c) => c.clave === clave)!)
      .filter(Boolean)
  }, [ordenColumnas, columnasVisibles, columnas])

  /* Determina si un filtro tiene un valor distinto a su default */
  const filtroEstaActivo = useCallback((f: FiltroTabla) => {
    // Si tiene valorDefault, comparar contra él
    if (f.valorDefault !== undefined) {
      if (Array.isArray(f.valor) && Array.isArray(f.valorDefault)) {
        if (f.valor.length !== f.valorDefault.length) return true
        return !f.valorDefault.every(d => (f.valor as string[]).includes(d))
      }
      return f.valor !== f.valorDefault
    }
    // Sin default: activo si tiene valor no vacío
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }, [])

  /* Conteo de filtros activos (todos: externos + auto-generados) */
  const numFiltrosActivos = todosLosFiltros.filter(filtroEstaActivo).length

  const hayBusquedaOFiltros = valorInput.length > 0 || numFiltrosActivos > 0 || ordenamiento.length > 0

  /* Iconos de vista */
  const iconosVista: Record<TipoVista, ReactNode> = {
    lista: <List size={14} />,
    tarjetas: <LayoutGrid size={14} />,
    matriz: <CalendarDays size={14} />,
  }

  const todoSeleccionado = datosPaginados.length > 0 && seleccionados.size === datosPaginados.length

  /* Ancho total de la tabla = checkbox + suma de columnas visibles */
  const anchoTotalTabla = useMemo(() => {
    let total = seleccionables ? 44 : 0
    for (const col of columnasRenderizar) {
      total += anchoColumnas[col.clave] || col.ancho || ANCHO_DEFAULT_COLUMNA
    }
    return total
  }, [columnasRenderizar, anchoColumnas, seleccionables])

  /* ── Calcular offset left para columnas ancladas ── */
  const offsetAncladas = useMemo(() => {
    const offsets: Record<string, number> = {}
    let acumulado = seleccionables ? 44 : 0
    for (const clave of ordenColumnas) {
      if (!columnasVisibles.includes(clave)) continue
      if (columnasAncladas.includes(clave)) {
        offsets[clave] = acumulado
      }
      acumulado += anchoColumnas[clave] || ANCHO_DEFAULT_COLUMNA
    }
    return offsets
  }, [ordenColumnas, columnasVisibles, columnasAncladas, anchoColumnas, seleccionables])

  /* ════════════════════════════════════════════
     Render
     ════════════════════════════════════════════ */

  /* Placeholder dinámico: incluye el conteo de registros o seleccionados */
  const placeholderDinamico = useMemo(() => {
    if (seleccionados.size > 0) {
      return `${seleccionados.size} seleccionado${seleccionados.size > 1 ? 's' : ''}. ${placeholder}`
    }
    return `${totalRegistros.toLocaleString(locale)} registro${totalRegistros !== 1 ? 's' : ''}. ${placeholder}`
  }, [seleccionados.size, totalRegistros, placeholder])

  /* Elemento paginador reutilizable — se comparte con PlantillaListado via contexto */
  const paginadorElemento = totalPaginas > 1 ? (
    <div className="flex items-center gap-0.5 shrink-0 border border-borde-sutil rounded-lg px-1 h-9">
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<ChevronLeft size={14} />}
        titulo={t('paginacion.pagina_anterior')}
        onClick={() => setPaginaActual(Math.max(1, paginaActual - 1))}
        disabled={paginaActual === 1}
      />
      <Tooltip contenido={paginaActual === totalPaginas ? 'Ir a la primera página' : 'Ir a la última página'}>
        <button
          type="button"
          onClick={() => {
            if (paginaActual === totalPaginas) setPaginaActual(1)
            else setPaginaActual(totalPaginas)
          }}
          className="px-2 py-0.5 text-xs font-medium text-texto-primario hover:bg-superficie-hover cursor-pointer border-none bg-transparent rounded transition-colors whitespace-nowrap tabular-nums focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
        >
          {registroInicio}–{registroFin} / {totalRegistros.toLocaleString(locale)}
        </button>
      </Tooltip>
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<ChevronRight size={14} />}
        titulo={t('paginacion.pagina_siguiente')}
        onClick={() => setPaginaActual(Math.min(totalPaginas, paginaActual + 1))}
        disabled={paginaActual === totalPaginas}
      />
    </div>
  ) : null

  return (
    <>
    {/* Portal: paginador mobile en la fila de acciones de PlantillaListado */}
    <PortalPaginador>{paginadorElemento}</PortalPaginador>

    <div ref={contenedorRef} className={`flex flex-col h-full ${className}`}>

      {/* ═══ TOOLBAR ═══ */}
      <div className={`flex items-center gap-2 pb-3.5 sm:pb-4 px-2 sm:px-6 relative z-30 shrink-0 ${contenidoCustom ? 'justify-end' : ''}`}>

        {/* Buscador — mobile: 100%, desktop: adaptable (oculto en contenidoCustom) */}
        <div className={`min-w-0 w-full sm:w-auto sm:max-w-[700px] relative transition-all duration-200 ${contenidoCustom ? 'hidden' : ''}`} style={esMobil ? undefined : { width: panelFiltrosAbierto ? '700px' : anchoBuscador > 0 ? anchoBuscador : undefined }}>
          {/* Span oculto para medir ancho real del texto */}
          <span ref={medidorRef} className="invisible absolute whitespace-pre text-sm" style={{ pointerEvents: 'none' }} />
          <div className={[
            'flex items-center gap-1.5 px-3 h-9 rounded-lg border bg-superficie-tarjeta transition-all duration-200',
            inputEnfocado ? 'border-borde-foco shadow-foco' : 'border-borde-sutil hover:border-borde-fuerte',
          ].join(' ')}>
            {/* Lupa */}
            <Search size={15} className="text-texto-terciario shrink-0" />

            {/* Chip de filtro activo */}
            {chipFiltro}

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={valorInput}
              onChange={(e) => manejarCambioBusqueda(e.target.value)}
              onFocus={() => setInputEnfocado(true)}
              onBlur={() => setInputEnfocado(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (valorInput) {
                    setValorInput('')
                    setBusquedaInterna('')
                    onBusqueda?.('')
                    setInputDesbordando(false)
                  } else {
                    inputRef.current?.blur()
                  }
                }
              }}
              placeholder={placeholderDinamico}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
            />

            {/* Detector de vistas */}
            <AnimatePresence mode="popLayout">
              {detector.tipo === 'vista_activa' && detector.vistaActiva && (
                <motion.span
                  key="vista-activa"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-superficie-seleccionada text-texto-marca whitespace-nowrap shrink-0 border border-texto-marca/20"
                >
                  <Bookmark size={12} className="fill-current" />
                  {detector.vistaActiva.nombre}
                </motion.span>
              )}

              {detector.tipo === 'sin_guardar' && idModulo && (
                <motion.button
                  key="sin-guardar"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => { setPanelFiltrosAbierto(true); setPanelColumnasAbierto(false) }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-texto-marca hover:bg-superficie-seleccionada whitespace-nowrap shrink-0 cursor-pointer border border-texto-marca/20 bg-transparent transition-colors"
                >
                  <BookmarkPlus size={12} />
                  Guardar vista
                </motion.button>
              )}
            </AnimatePresence>

            {/* Limpiar todo */}
            {hayBusquedaOFiltros && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={12} />} onClick={limpiarTodo} titulo={t('paginacion.limpiar_todo')} className="text-insignia-peligro-texto hover:bg-insignia-peligro-fondo" />
            )}

            {/* Botón filtros + vistas */}
            {(todosLosFiltros.length > 0 || idModulo) && (
              <div className="relative shrink-0">
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<SlidersHorizontal size={14} />}
                  titulo="Filtros y vistas"
                  onClick={() => { setPanelFiltrosAbierto(!panelFiltrosAbierto); setPanelColumnasAbierto(false) }}
                />
                {numFiltrosActivos > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-insignia-peligro" />
                )}
              </div>
            )}

            {/* Botón columnas — siempre al final derecho */}
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<Columns3 size={14} />}
              titulo="Columnas"
              onClick={() => { setPanelColumnasAbierto(!panelColumnasAbierto); setPanelFiltrosAbierto(false) }}
              className="shrink-0"
            />

            {/* Mobile: menú de vistas (3 puntitos dentro del buscador) */}
            {vistas.length > 1 && (
              <div className="sm:hidden relative shrink-0">
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<MoreVertical size={14} />}
                  titulo="Vista"
                  onClick={() => setMenuVistasMobilAbierto(!menuVistasMobilAbierto)}
                />
                <AnimatePresence>
                  {menuVistasMobilAbierto && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuVistasMobilAbierto(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden py-1"
                      >
                        {vistas.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => { if (onVistaExterna && v !== 'lista' && v !== 'tarjetas') { onVistaExterna(v); return } vistaManualRef.current = true; setVistaActual(v); setMenuVistasMobilAbierto(false) }}
                            className={[
                              'flex items-center gap-2.5 w-full px-3 py-2 text-sm cursor-pointer border-none transition-colors',
                              v === vistaActual
                                ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                                : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
                            ].join(' ')}
                          >
                            {iconosVista[v]}
                            <span>{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Pills de filtros activos — debajo de la cápsula para no comprimir botones */}
          {detector.tipo !== 'vista_activa' && (() => {
            const filtrosActivos = todosLosFiltros.filter(filtroEstaActivo)
            if (filtrosActivos.length === 0) return null
            return (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-0.5">
                {filtrosActivos.map((f) => {
                  const valorTexto = Array.isArray(f.valor)
                    ? f.valor.map(v => f.opciones?.find(o => o.valor === v)?.etiqueta || v).slice(0, 3).join(', ') + (f.valor.length > 3 ? ` +${f.valor.length - 3}` : '')
                    : f.opciones?.find((o) => o.valor === f.valor)?.etiqueta || f.valor
                  return (
                    <motion.span
                      key={f.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-primario-fondo text-insignia-primario-texto whitespace-nowrap"
                    >
                      <span className="text-xxs opacity-70">{f.etiqueta}:</span>
                      <span>{valorTexto}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); f.onChange(Array.isArray(f.valor) ? [] : '') }}
                        className="inline-flex items-center justify-center size-3.5 rounded-full hover:bg-black/10 cursor-pointer border-none bg-transparent text-current p-0"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )
                })}
              </div>
            )
          })()}

          {/* Panel de filtros + vistas (desplegable) */}
          <AnimatePresence>
            {panelFiltrosAbierto && (todosLosFiltros.length > 0 || idModulo) && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPanelFiltrosAbierto(false)} />
                <div className="relative z-50">
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    <div className="max-h-[460px] overflow-y-auto">
                      {/* Layout 3 columnas: Filtros | Orden | Favoritos */}
                      <div className="flex divide-x divide-borde-sutil">

                        {/* ── Columna 1: Filtros (primeros 3) ── */}
                        {todosLosFiltros.length > 0 && (() => {
                          const filtrosCol1 = todosLosFiltros.slice(0, 3)
                          const filtrosCol2 = todosLosFiltros.slice(3)
                          return (
                            <>
                              <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider flex items-center gap-1.5">
                                    <SlidersHorizontal size={12} />
                                    Filtros
                                  </span>
                                  {numFiltrosActivos > 0 && (
                                    <Boton variante="peligro" tamano="xs" redondeado onClick={limpiarTodo}>
                                      Limpiar ({numFiltrosActivos})
                                    </Boton>
                                  )}
                                </div>
                                <div className="flex flex-col gap-4">
                                  {filtrosCol1.map(filtro => (
                                    <SeccionFiltroPanel key={filtro.id} filtro={filtro} />
                                  ))}
                                </div>
                              </div>

                              {/* ── Columna 2: Orden + Filtros extra ── */}
                              {(opcionesOrden && opcionesOrden.length > 0 || filtrosCol2.length > 0) && (
                                <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
                                  {opcionesOrden && opcionesOrden.length > 0 && (
                                    <>
                                      <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider flex items-center gap-1.5">
                                        <ArrowUpDown size={12} />
                                        Orden
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {opcionesOrden.map(op => {
                                          const activo = ordenamiento.length > 0 && ordenamiento[0].clave === op.clave && ordenamiento[0].direccion === op.direccion
                                          return (
                                            <button key={`${op.clave}-${op.direccion}`} type="button"
                                              onClick={() => setOrdenamiento([{ clave: op.clave, direccion: op.direccion }])}
                                              className={[
                                                'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                                                activo ? 'bg-texto-marca text-white' : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover',
                                              ].join(' ')}>
                                              {op.etiqueta}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </>
                                  )}
                                  {filtrosCol2.length > 0 && (
                                    <div className="flex flex-col gap-4">
                                      {opcionesOrden && opcionesOrden.length > 0 && (
                                        <div className="border-t border-borde-sutil" />
                                      )}
                                      {filtrosCol2.map(filtro => (
                                        <SeccionFiltroPanel key={filtro.id} filtro={filtro} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )
                        })()}

                        {/* ── Columna 3: Favoritos / Vistas ── */}
                        {idModulo && (
                          <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
                            <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider flex items-center gap-1.5">
                              <Star size={12} />
                              Favoritos
                            </span>

                            {/* Vistas guardadas */}
                            {vistasGuardadas && vistasGuardadas.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {vistasGuardadas.map((v) => {
                                  const esActiva = detector?.vistaActiva?.id === v.id
                                  return (
                                    <div key={v.id}
                                      className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-superficie-hover transition-colors"
                                      onClick={() => manejarAplicarVista(v.id)}>
                                      <Bookmark size={13} className={esActiva ? 'text-texto-marca fill-current' : 'text-texto-terciario'} />
                                      <span className={`flex-1 text-sm truncate ${esActiva ? 'font-semibold text-texto-marca' : 'text-texto-primario'}`}>{v.nombre}</span>
                                      {v.predefinida && <Star size={11} className="text-texto-marca fill-current shrink-0" />}
                                      {esActiva && <Check size={13} className="text-texto-marca shrink-0" />}
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                        {manejarMarcarPredefinida && !v.predefinida && (
                                          <Tooltip contenido="Marcar como predefinida"><button type="button" onClick={(e) => { e.stopPropagation(); manejarMarcarPredefinida(v.id) }}
                                            className="size-5 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-marca transition-colors"
                                            ><Star size={11} /></button></Tooltip>
                                        )}
                                        {manejarEliminarVista && (
                                          <Tooltip contenido="Eliminar"><button type="button" onClick={(e) => { e.stopPropagation(); manejarEliminarVista(v.id) }}
                                            className="size-5 inline-flex items-center justify-center rounded-md hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-colors"
                                            ><X size={11} /></button></Tooltip>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-texto-terciario">Sin vistas guardadas</p>
                            )}

                            {/* Guardar actual */}
                            {manejarGuardarVista && detector?.tipo !== 'default' && (
                              <GuardarVistaInline onGuardar={manejarGuardarVista} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Espaciador — empuja controles a la derecha (solo desktop) */}
        <div className={`hidden sm:block flex-1 ${contenidoCustom ? '!hidden' : ''}`} />

        {/* Paginador compacto — solo desktop (oculto en contenidoCustom) */}
        {paginadorElemento && !contenidoCustom && (
          <div className="hidden sm:block">
            {paginadorElemento}
          </div>
        )}

        {/* Switcher de vistas — desktop only (en mobile está dentro del buscador) */}
        {vistas.length > 1 && (
          <div className="hidden sm:flex items-center gap-0 shrink-0 outline outline-1 outline-borde-sutil rounded-md overflow-hidden">
            {vistas.map((v) => (
              <Tooltip key={v} contenido={v.charAt(0).toUpperCase() + v.slice(1)}>
                <button
                  type="button"
                  onClick={() => {
                    if (onVistaExterna && v !== 'lista' && v !== 'tarjetas') { onVistaExterna(v); return }
                    if (onVistaExterna && vistaExternaActiva) { onVistaExterna(v); }
                    vistaManualRef.current = true; setVistaActual(v)
                  }}
                  className={[
                    'size-8 inline-flex items-center justify-center cursor-pointer border-none transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                    (vistaExternaActiva ? v === vistaExternaActiva : v === vistaActual)
                      ? 'bg-superficie-hover text-texto-primario'
                      : 'bg-transparent text-texto-terciario hover:text-texto-secundario',
                  ].join(' ')}
                >
                  {iconosVista[v]}
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Panel de columnas (sidebar derecho fijo — absolute para no afectar flex) */}
        <div ref={panelColumnasRef} className="contents">
          <AnimatePresence>
            {panelColumnasAbierto && (
              <>
              {/* Overlay para cerrar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 z-40"
                onClick={() => setPanelColumnasAbierto(false)}
              />
              <PanelColumnas
                columnas={columnas}
                columnasVisibles={columnasVisibles}
                ordenColumnas={ordenColumnas}
                columnasAncladas={columnasAncladas}
                alineacionColumnas={alineacionColumnas}
                opcionesVisuales={opcionesVisuales}
                onToggleColumna={toggleColumna}
                onReordenar={setOrdenColumnas}
                onToggleAnclar={toggleAnclar}
                onCambiarAlineacion={cambiarAlineacion}
                onMostrarTodas={mostrarTodasColumnas}
                onOcultarTodas={ocultarTodasColumnas}
                onAlinearTodas={alinearTodasColumnas}
                onCambiarOpcionVisual={cambiarOpcionVisual}
                onRestablecer={restablecerColumnas}
                onAjustarAnchosAuto={ajustarAnchosAuto}
                onCerrar={() => setPanelColumnasAbierto(false)}
              />
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══ CONTENIDO — header fijo, filas scrollean, footer fijo abajo ═══ */}
      {contenidoCustom ? (
        <div className="flex-1 min-h-0 flex flex-col">{contenidoCustom}</div>
      ) : (
      <div className={`flex-1 min-h-0 flex flex-col ${vistaActual === 'tarjetas' ? 'bg-transparent' : 'border-t border-borde-sutil'}`}>
        {/* Estado vacío */}
        {datos.length === 0 && estadoVacio ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {estadoVacio}
          </div>
        ) : (
        <>
        <AnimatePresence mode="wait">
          {vistaActual === 'lista' && (
            <motion.div
              key="lista"
              initial={{ opacity: 0 }}
              ref={tablaScrollRef}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 overflow-auto overscroll-contain bg-superficie-tarjeta"
            >
              <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: anchoTotalTabla, backgroundColor: 'var(--superficie-tarjeta)' }}>
                {/* Header */}
                <thead>
                  <tr className="border-b border-borde-fuerte sticky top-0 z-20" style={{ background: 'var(--superficie-anclada-alterna)' }}>
                    {/* Checkbox header */}
                    {seleccionables && (
                      <th className="w-10 min-w-10 px-2.5 py-2.5 text-center sticky left-0 z-30" style={{ background: 'var(--superficie-anclada-alterna)' }}>
                        <Checkbox
                          marcado={todoSeleccionado}
                          onChange={() => toggleTodos()}
                        />
                      </th>
                    )}

                    {/* Columnas */}
                    {columnasRenderizar.map((col) => {
                      const anclada = columnasAncladas.includes(col.clave)
                      const ordenActual = ordenamiento.find((o) => o.clave === col.clave)
                      const ancho = anchoColumnas[col.clave] || col.ancho || ANCHO_DEFAULT_COLUMNA

                      return (
                        <th
                          key={col.clave}
                          className={[
                            'px-4 py-2.5 text-xs font-semibold text-texto-terciario uppercase tracking-wide text-left relative select-none group',
                            anclada ? 'sticky z-30 border-r-2 border-r-borde-fuerte' : '',
                            col.ordenable !== false ? 'cursor-pointer hover:text-texto-secundario' : '',
                            opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
                          ].join(' ')}
                          style={{
                            width: ancho,
                            minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
                            textAlign: alineacionColumnas[col.clave] || col.alineacion,
                            ...(anclada ? { left: offsetAncladas[col.clave], background: 'var(--superficie-anclada-alterna)' } : {}),
                          }}
                          onClick={() => { if (resizeRecienTerminadoRef.current) return; col.ordenable !== false && toggleOrden(col.clave) }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="truncate">{col.etiqueta}</span>

                            {/* Indicador de orden */}
                            {col.ordenable !== false && (
                              <span className={`shrink-0 transition-opacity ${ordenActual ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                                {ordenActual?.direccion === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                              </span>
                            )}

                            {/* Pin indicator */}
                            {anclada && (
                              <Pin size={10} className="text-texto-marca shrink-0" />
                            )}
                          </div>

                          {/* Handle de resize */}
                          <div
                            onMouseDown={(e) => iniciarResize(col.clave, e)}
                            style={{ position: 'absolute', top: 0, right: 0, width: 6, height: '100%', cursor: 'col-resize' }}
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {datosPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnasRenderizar.length + (seleccionables ? 1 : 0)}
                        className="text-center py-16 text-texto-terciario text-sm"
                      >
                        {t('comun.sin_resultados')}
                      </td>
                    </tr>
                  ) : (
                    datosPaginados.map((fila, indice) => {
                      const id = claveFila(fila)
                      const estaSeleccionado = seleccionados.has(id)
                      const esAlterna = opcionesVisuales.filasAlternas && indice % 2 === 1

                      /* Fondo sólido inline para celdas sticky — evita transparencias */
                      const fondoStickyFila = estaSeleccionado
                        ? 'var(--superficie-anclada-seleccionada)'
                        : esAlterna
                        ? 'var(--superficie-anclada-alterna)'
                        : 'var(--superficie-anclada)'

                      return (
                        <tr
                          key={id}
                          role={onClickFila ? 'button' : undefined}
                          tabIndex={onClickFila ? 0 : undefined}
                          onClick={() => onClickFila?.(fila)}
                          onKeyDown={onClickFila ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickFila(fila) }
                          } : undefined}
                          className={[
                            'transition-colors duration-100',
                            opcionesVisuales.mostrarDivisores ? 'border-b border-borde-sutil last:border-b-0' : '',
                            onClickFila ? 'cursor-pointer' : '',
                            estaSeleccionado
                              ? 'bg-superficie-seleccionada'
                              : esAlterna
                              ? 'bg-superficie-anclada-alterna'
                              : '',
                            !estaSeleccionado ? 'hover:bg-superficie-hover' : '',
                            onClickFila ? 'focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2' : '',
                          ].join(' ')}
                        >
                          {/* Checkbox — siempre sticky con fondo sólido */}
                          {seleccionables && (
                            <td className="w-10 min-w-10 px-2.5 py-2.5 text-center sticky left-0 z-10" style={{ background: fondoStickyFila }} onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                marcado={estaSeleccionado}
                                onChange={() => toggleUno(id)}
                              />
                            </td>
                          )}

                          {/* Celdas */}
                          {columnasRenderizar.map((col) => {
                            const anclada = columnasAncladas.includes(col.clave)
                            const ancho = anchoColumnas[col.clave] || col.ancho || ANCHO_DEFAULT_COLUMNA

                            return (
                              <td
                                key={col.clave}
                                className={[
                                  'px-4 py-2.5 text-texto-primario',
                                  anclada ? 'sticky z-10 border-r-2 border-r-borde-fuerte' : '',
                                  opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
                                ].join(' ')}
                                style={{
                                  width: ancho,
                                  minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
                                  textAlign: alineacionColumnas[col.clave] || col.alineacion,
                                  ...(anclada ? { left: offsetAncladas[col.clave], background: fondoStickyFila } : {}),
                                }}
                              >
                                {col.render
                                  ? col.render(fila)
                                  : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {/* Footer de cálculos — sticky abajo dentro de la tabla */}
                {mostrarResumen && datos.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20" style={{ background: 'var(--superficie-anclada-alterna)' }}>
                    <PieResumenFila
                      columnas={columnas}
                      datos={datosOrdenados}
                      columnasVisibles={columnasVisibles.filter((c) => ordenColumnas.includes(c))}
                      columnasAncladas={columnasAncladas}
                      anchoColumnas={anchoColumnas}
                      seleccionables={seleccionables}
                      opcionesVisuales={opcionesVisuales}
                      offsetAncladas={offsetAncladas}
                    />
                  </tfoot>
                )}
              </table>
            </motion.div>
          )}

          {vistaActual === 'tarjetas' && (
            <motion.div
              key="tarjetas"
              ref={tablaScrollRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 overflow-auto px-2 sm:p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 content-start"
            >
              {datosPaginados.length === 0 ? (
                <div className="col-span-full text-center py-16 text-texto-terciario text-sm">
                  {t('comun.sin_resultados')}
                </div>
              ) : (
                datosPaginados.map((fila) => {
                  const id = claveFila(fila)
                  const estaSeleccionado = seleccionados.has(id)

                  return (
                    <motion.div
                      key={id}
                      layout
                      className={[
                        'relative rounded-lg border p-3 transition-all duration-150 cursor-pointer',
                        estaSeleccionado
                          ? 'border-texto-marca bg-superficie-seleccionada'
                          : 'border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte sm:hover:shadow-sm',
                      ].join(' ')}
                      onClick={() => onClickFila?.(fila)}
                    >
                      {/* Checkbox en tarjeta */}
                      {seleccionables && (
                        <div className="absolute top-2.5 right-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            marcado={estaSeleccionado}
                            onChange={() => toggleUno(id)}
                          />
                        </div>
                      )}

                      {/* Contenido de la tarjeta */}
                      {renderTarjeta ? renderTarjeta(fila) : (
                        <div className="flex flex-col gap-1.5">
                          {columnasRenderizar.slice(0, 4).map((col) => (
                            <div key={col.clave} className="flex items-baseline gap-2">
                              <span className="text-xs text-texto-terciario shrink-0">{col.etiqueta}:</span>
                              <span className="text-sm text-texto-primario truncate">
                                {col.render
                                  ? col.render(fila)
                                  : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    </motion.div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        </>
        )}

      </div>
      )}

      {/* ── Barra flotante de acciones masivas (arrastrable, estilo Attio) ── */}
      <BarraAccionesLote
        seleccionados={seleccionados}
        accionesLote={accionesLote}
        onLimpiarSeleccion={() => setSeleccionados(new Set())}
        preferencias={preferencias}
        guardarPreferencias={guardarPreferencias}
      />
    </div>
    </>
  )
}

/* ── Re-exportar tipos desde tipos-tabla para compatibilidad ── */
export { Paginador } from '@/componentes/tablas/PaginadorTabla'

export {
  TablaDinamica,
  type PropiedadesTablaDinamica,
  type ColumnaDinamica,
  type TipoVista,
  type FiltroTabla,
  type AccionLote,
  type OpcionesVisuales,
  type TipoCalculo,
  type DireccionOrden,
}

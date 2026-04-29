'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { useFiltrosUrl } from '@/hooks/useFiltrosUrl'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { useRol } from '@/hooks/useRol'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Clock, TimerOff, Plus, History, Banknote, Send, List, LayoutGrid, CalendarDays } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalEditarFichaje } from './ModalEditarFichaje'
import { useFormato } from '@/hooks/useFormato'
import { usePreferencias } from '@/hooks/usePreferencias'
import { VistaMatriz } from './VistaMatriz'
import { TarjetaAsistencia } from './TarjetaAsistencia'
import { ModalCrearFichaje } from './ModalCrearFichaje'
import { VistaNomina, type VistaNominaHandle } from './VistaNomina'
import { Tabs } from '@/componentes/ui/Tabs'
import { ETIQUETA_METODO } from '@/lib/constantes/asistencias'

// ─── Constantes ──────────────────────────────────────────────

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: 'En turno',
  almuerzo: 'En almuerzo',
  particular: 'Trámite',
  cerrado: 'Cerrado',
  auto_cerrado: 'Sin salida',
  ausente: 'Ausente',
  feriado: 'Feriado',
  presente: 'Presente',
}

const COLOR_ESTADO: Record<string, string> = {
  activo: 'exito',
  almuerzo: 'advertencia',
  particular: 'info',
  cerrado: 'neutro',
  auto_cerrado: 'peligro',
  ausente: 'peligro',
  feriado: 'info',
  presente: 'exito',
}

// ─── Tipos ───────────────────────────────────────────────────

interface RegistroAsistencia {
  id: string
  miembro_id: string
  miembro_nombre: string
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  estado: string
  tipo: string
  metodo_registro: string
  metodo_salida?: string | null
  puntualidad_min: number | null
  terminal_nombre?: string | null
  cierre_automatico?: boolean
  salida_particular: string | null
  vuelta_particular: string | null
  creado_por: string | null
  creador_nombre: string | null
  creado_en: string | null
  editado_por: string | null
  editor_nombre: string | null
  actualizado_en: string | null
  notas: string | null
  ubicacion_entrada: Record<string, unknown> | null
  ubicacion_salida?: Record<string, unknown> | null
  foto_entrada?: string | null
  foto_salida?: string | null
  tiempo_activo_min?: number | null
  total_heartbeats?: number | null
}

// ─── Helpers ─────────────────────────────────────────────────

function formatearHora(iso: string | null, formato: string = '24h'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (formato === '12h') {
    const h = d.getHours() % 12 || 12
    const m = String(d.getMinutes()).padStart(2, '0')
    const ampm = d.getHours() < 12 ? 'AM' : 'PM'
    return `${h}:${m} ${ampm}`
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function calcularDuracion(entrada: string | null, salida: string | null, inicioAlm: string | null, finAlm: string | null): string {
  if (!entrada) return '—'
  const fin = salida ? new Date(salida) : new Date()
  let minutos = Math.round((fin.getTime() - new Date(entrada).getTime()) / 60000)

  // Descontar almuerzo si hay ambos timestamps
  if (inicioAlm && finAlm) {
    const almMin = Math.round((new Date(finAlm).getTime() - new Date(inicioAlm).getTime()) / 60000)
    minutos -= almMin
  }

  if (minutos < 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatearFecha(fecha: string, locale: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatearUbicacion(ub: Record<string, unknown> | null): string {
  if (!ub) return '—'
  if (ub.direccion) return String(ub.direccion)
  if (ub.lat && ub.lng) return `${Number(ub.lat).toFixed(4)}, ${Number(ub.lng).toFixed(4)}`
  return '—'
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

// ─── Componente ──────────────────────────────────────────────

export default function ContenidoAsistencias({ datosInicialesJson }: Props) {
  // Guard reactivo: basta con tener ver_propio o ver_todos. La UI interna
  // (botones, pestañas, filtros) se condiciona por acción específica.
  return (
    <GuardPagina modulo="asistencias">
      <ContenidoAsistenciasInterno datosInicialesJson={datosInicialesJson} />
    </GuardPagina>
  )
}

function ContenidoAsistenciasInterno({ datosInicialesJson }: Props) {
  const { tienePermiso } = useRol()
  // Asistencias (fichajes)
  const puedeVerTodos = tienePermiso('asistencias', 'ver_todos')
  const puedeMarcar = tienePermiso('asistencias', 'marcar')
  const puedeEditar = tienePermiso('asistencias', 'editar')
  const puedeEliminar = tienePermiso('asistencias', 'eliminar')
  // Nómina (módulo separado) — pestaña, enviar recibos, editar adelantos
  const puedeVerNominaTodos = tienePermiso('nomina', 'ver_todos')
  const puedeVerNominaPropio = tienePermiso('nomina', 'ver_propio')
  const puedeEnviarNomina = tienePermiso('nomina', 'enviar')
  const puedeVerNomina = puedeVerNominaTodos || puedeVerNominaPropio
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { formatoHora, locale } = useFormato()
  const { preferencias, guardar: guardarPrefs } = usePreferencias()
  const [editando, setEditando] = useState<RegistroAsistencia | null>(null)
  const [creando, setCreando] = useState<{ miembroId?: string; miembroNombre?: string; fecha?: string } | null>(null)
  const [matrizKey, setMatrizKey] = useState(0)
  const [seccion, setSeccion] = useState<'fichajes' | 'nomina'>('fichajes')
  // Si el usuario estaba en la pestaña Nómina y le quitan el permiso en vivo,
  // forzamos fallback a Fichajes para no mostrar contenido sin autorización.
  useEffect(() => {
    if (seccion === 'nomina' && !puedeVerNomina) setSeccion('fichajes')
  }, [seccion, puedeVerNomina])
  const nominaRef = useRef<VistaNominaHandle>(null)

  // Filtros con sync bidireccional URL ↔ estado (ver useFiltrosUrl).
  // Mantiene los filtros al volver de un detalle por migajas o botón atrás.
  const filtros = useFiltrosUrl({
    pathname: '/asistencias',
    campos: {
      miembros: { defecto: [] as string[] },
      estados: { defecto: [] as string[] },
      tipos: { defecto: [] as string[] },
      metodos: { defecto: [] as string[] },
      sectores: { defecto: [] as string[] },
      turnos: { defecto: [] as string[] },
      con_tardanza: { defecto: false },
      sin_cerrar: { defecto: false },
      preset_fecha: { defecto: '' },
      creado_por: { defecto: '' },
    },
    busqueda: { claveUrl: 'q' },
    pagina: { defecto: 1 },
  })

  // Aliases para compatibilidad con el resto del componente.
  const f = filtros.valores
  const filtroMiembros = f.miembros
  const filtroEstados = f.estados
  const filtroTipos = f.tipos
  const filtroMetodos = f.metodos
  const filtroSectores = f.sectores
  const filtroTurnos = f.turnos
  const filtroConTardanza = f.con_tardanza
  const filtroSinCerrar = f.sin_cerrar
  const filtroPresetFecha = f.preset_fecha
  const filtroCreadoPor = f.creado_por
  const setFiltroMiembros = (v: string[]) => filtros.set('miembros', v)
  const setFiltroEstados = (v: string[]) => filtros.set('estados', v)
  const setFiltroTipos = (v: string[]) => filtros.set('tipos', v)
  const setFiltroMetodos = (v: string[]) => filtros.set('metodos', v)
  const setFiltroSectores = (v: string[]) => filtros.set('sectores', v)
  const setFiltroTurnos = (v: string[]) => filtros.set('turnos', v)
  const setFiltroConTardanza = (v: boolean) => filtros.set('con_tardanza', v)
  const setFiltroSinCerrar = (v: boolean) => filtros.set('sin_cerrar', v)
  const setFiltroPresetFecha = (v: string) => filtros.set('preset_fecha', v)
  const setFiltroCreadoPor = (v: string) => filtros.set('creado_por', v)
  const busqueda = filtros.busquedaInput
  const setBusqueda = filtros.setBusquedaInput
  const busquedaDebounced = filtros.busquedaActiva
  const pagina = filtros.pagina
  const setPagina = filtros.setPagina

  // Vista persistida por usuario+dispositivo
  // Si no tiene ver_todos forzamos lista (matriz es del equipo completo).
  const vistaGuardada = (preferencias.config_tablas?.asistencias?.tipoVista as 'lista' | 'tarjetas' | 'matriz') || 'lista'
  const vistaInicial = vistaGuardada === 'matriz' && !puedeVerTodos ? 'lista' : vistaGuardada
  const [vista, setVistaLocal] = useState<'lista' | 'tarjetas' | 'matriz'>(vistaInicial)

  const setVista = useCallback((v: 'lista' | 'tarjetas' | 'matriz') => {
    setVistaLocal(v)
    guardarPrefs({
      config_tablas: {
        ...preferencias.config_tablas,
        asistencias: { ...preferencias.config_tablas?.asistencias, tipoVista: v },
      },
    })
  }, [preferencias.config_tablas, guardarPrefs])

  // Solo usar datos iniciales cuando no hay filtros activos (primera carga)
  const sinFiltros =
    !busquedaDebounced &&
    filtroMiembros.length === 0 &&
    filtroEstados.length === 0 &&
    filtroTipos.length === 0 &&
    filtroMetodos.length === 0 &&
    filtroSectores.length === 0 &&
    filtroTurnos.length === 0 &&
    !filtroConTardanza &&
    !filtroSinCerrar &&
    !filtroPresetFecha &&
    !filtroCreadoPor &&
    pagina === 1

  // useListado reemplaza el fetch manual
  const { datos: registros, total, cargando, recargar } = useListado<RegistroAsistencia>({
    clave: 'asistencias',
    url: '/api/asistencias',
    parametros: {
      busqueda: busquedaDebounced,
      miembros: filtroMiembros.length > 0 ? filtroMiembros.join(',') : undefined,
      estados: filtroEstados.length > 0 ? filtroEstados.join(',') : undefined,
      tipos: filtroTipos.length > 0 ? filtroTipos.join(',') : undefined,
      metodos: filtroMetodos.length > 0 ? filtroMetodos.join(',') : undefined,
      sectores: filtroSectores.length > 0 ? filtroSectores.join(',') : undefined,
      turnos: filtroTurnos.length > 0 ? filtroTurnos.join(',') : undefined,
      con_tardanza: filtroConTardanza ? 'true' : undefined,
      sin_cerrar: filtroSinCerrar ? 'true' : undefined,
      preset_fecha: filtroPresetFecha || undefined,
      creado_por: filtroCreadoPor || undefined,
      pagina,
      limite: 50,
    },
    extraerDatos: (json) => (json.registros || []) as RegistroAsistencia[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

  // ── Cargar opciones para los filtros ──

  /** Miembros de la empresa (para selectores Empleados y Creado por) */
  const { data: miembrosData } = useQuery({
    queryKey: ['miembros-empresa'],
    queryFn: () => fetch('/api/miembros').then(r => r.json()),
    staleTime: 5 * 60_000,
    enabled: puedeVerTodos, // Con ver_propio no hace falta cargar el listado: solo se usa el propio.
  })
  /** miembroPropio: id y nombre del miembro del usuario autenticado (lo
   *  usamos cuando solo tiene ver_propio para restringir filtros). */
  const { data: miembroPropio } = useQuery({
    queryKey: ['miembro-propio'],
    queryFn: async () => {
      const res = await fetch('/api/permisos/yo')
      const j = await res.json()
      if (!j?.miembro_id) return null
      const { data } = await fetch(`/api/miembros?incluir_sin_cuenta=true`).then(r => r.json())
      type M = { id: string; nombre: string | null; apellido: string | null }
      return (data as M[] | undefined)?.find(m => m.id === j.miembro_id) || { id: j.miembro_id as string, nombre: null, apellido: null }
    },
    staleTime: 5 * 60_000,
    enabled: !puedeVerTodos,
  })
  const opcionesMiembrosAll = useMemo(() => {
    return ((miembrosData?.miembros || []) as { id: string; usuario_id: string; nombre: string | null; apellido: string | null }[])
  }, [miembrosData])
  const opcionesMiembros = useMemo(() => {
    // Con ver_todos: lista completa. Con ver_propio: solo el propio miembro,
    // para que el filtro "Empleado" no permita consultar asistencias ajenas.
    if (!puedeVerTodos && miembroPropio) {
      const nombre = `${miembroPropio.nombre || ''} ${miembroPropio.apellido || ''}`.trim() || 'Yo'
      return [{ valor: miembroPropio.id, etiqueta: nombre }]
    }
    return opcionesMiembrosAll.map(m => ({
      valor: m.id,
      etiqueta: `${m.nombre || ''} ${m.apellido || ''}`.trim() || 'Sin nombre',
    }))
  }, [opcionesMiembrosAll, puedeVerTodos, miembroPropio])
  const opcionesMiembrosCreador = useMemo(() => {
    // Para "Creado por" usamos miembro.id también (creado_por apunta a miembros.id)
    return opcionesMiembros
  }, [opcionesMiembros])

  /** Config de asistencias — trae sectores, turnos y terminales dinámicos */
  const { data: configData } = useQuery({
    queryKey: ['asistencias-config'],
    queryFn: () => fetch('/api/asistencias/config').then(r => r.json()),
    staleTime: 5 * 60_000,
  })

  /** Sectores dinámicos de la estructura de la empresa */
  const opcionesSectores = useMemo(() => {
    const items = (configData?.sectores || []) as { id: string; nombre: string }[]
    return items.map(s => ({ valor: s.id, etiqueta: s.nombre }))
  }, [configData])

  /** Turnos laborales — de la config */
  const opcionesTurnos = useMemo(() => {
    const items = (configData?.turnos || []) as { id: string; nombre: string }[]
    return items.map(t => ({ valor: t.id, etiqueta: t.nombre }))
  }, [configData])

  // Abrir modal de detalle si viene ?detalle=<id> desde el dashboard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const detalleId = params.get('detalle')
    if (!detalleId) return
    // Limpiar el query param de la URL sin recargar
    window.history.replaceState({}, '', '/asistencias')
    // Cargar detalle completo y abrir modal
    fetch(`/api/asistencias/detalle?id=${detalleId}`)
      .then(res => res.ok ? res.json() : null)
      .then(reg => { if (reg?.id) setEditando(reg) })
      .catch(() => {})
  }, [])

  // Callback para refrescar después de editar/crear fichajes
  const alGuardar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['asistencias'] })
    setMatrizKey(k => k + 1)
  }, [queryClient])

  const columnas: ColumnaDinamica<RegistroAsistencia>[] = [
    {
      clave: 'miembro_nombre',
      etiqueta: 'Empleado',
      ancho: 180,
      ordenable: true,
      render: (r) => (
        <span className="font-medium text-texto-primario">{r.miembro_nombre}</span>
      ),
    },
    {
      clave: 'fecha',
      etiqueta: 'Fecha',
      ancho: 130,
      ordenable: true,
      tipo: 'fecha',
      filtrable: true,
      render: (r) => (
        <span className="text-texto-secundario">{formatearFecha(r.fecha, locale)}</span>
      ),
    },
    {
      clave: 'hora_entrada',
      etiqueta: 'Entrada',
      ancho: 80,
      render: (r) => <span>{formatearHora(r.hora_entrada, formatoHora)}</span>,
    },
    {
      clave: 'hora_salida',
      etiqueta: 'Salida',
      ancho: 80,
      render: (r) => <span>{formatearHora(r.hora_salida, formatoHora)}</span>,
    },
    {
      clave: 'duracion' as keyof RegistroAsistencia,
      etiqueta: 'Duración',
      ancho: 90,
      render: (r) => (
        <span className="text-texto-secundario font-mono text-xs">
          {calcularDuracion(r.hora_entrada, r.hora_salida, r.inicio_almuerzo, r.fin_almuerzo)}
        </span>
      ),
    },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      ancho: 120,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (r) => (
        <Insignia color={COLOR_ESTADO[r.estado] as 'exito' | 'advertencia' | 'info' | 'neutro' | 'peligro' || 'neutro'}>
          {ETIQUETA_ESTADO[r.estado] || r.estado}
        </Insignia>
      ),
    },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      ancho: 100,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'normal', etiqueta: 'Normal' },
        { valor: 'tardanza', etiqueta: 'Tardanza' },
        { valor: 'flexible', etiqueta: 'Flexible' },
        { valor: 'ausencia', etiqueta: 'Ausencia' },
        { valor: 'feriado', etiqueta: 'Feriado' },
      ],
      render: (r) => {
        const colorTipo: Record<string, string> = {
          tardanza: 'advertencia',
          ausencia: 'peligro',
          feriado: 'info',
          normal: 'neutro',
          flexible: 'neutro',
        }
        return (
          <Insignia color={colorTipo[r.tipo] as 'exito' | 'advertencia' | 'info' | 'neutro' | 'peligro' || 'neutro'}>
            {r.tipo.charAt(0).toUpperCase() + r.tipo.slice(1)}
          </Insignia>
        )
      },
    },
    {
      clave: 'metodo_registro',
      etiqueta: 'Método',
      ancho: 100,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETA_METODO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (r) => (
        <span className="text-xs text-texto-terciario">
          {ETIQUETA_METODO[r.metodo_registro] || r.metodo_registro}
        </span>
      ),
    },
    {
      clave: 'ubicacion_entrada' as keyof RegistroAsistencia,
      etiqueta: 'Ubicación',
      ancho: 180,
      render: (r) => (
        <span className="text-xs text-texto-terciario truncate">
          {formatearUbicacion(r.ubicacion_entrada)}
        </span>
      ),
    },
    {
      clave: 'editado_por' as keyof RegistroAsistencia,
      etiqueta: 'Auditoría',
      ancho: 44,
      icono: <History size={12} />,
      render: (r) => (r.editado_por || r.creado_por) ? (
        <IndicadorEditado
          entidadId={r.id}
          nombreCreador={r.creador_nombre}
          fechaCreacion={r.creado_en}
          metodoCreacion={ETIQUETA_METODO[r.metodo_registro] || r.metodo_registro}
          nombreEditor={r.editor_nombre}
          fechaEdicion={r.actualizado_en}
          tablaAuditoria="auditoria_asistencias"
          campoReferencia="asistencia_id"
        />
      ) : null,
    },
  ]

  // La pestaña "Nómina" muestra sueldos del equipo → solo con ver_todos.
  const tabsSeccion = [
    { clave: 'fichajes', etiqueta: 'Fichajes', icono: <Clock size={15} /> },
    // Nómina es un módulo aparte: la pestaña aparece con `nomina:ver_propio`
    // (ve su propio recibo) o `ver_todos` (ve nómina del equipo).
    ...(puedeVerNomina ? [{ clave: 'nomina', etiqueta: 'Nómina', icono: <Banknote size={15} /> }] : []),
  ]

  // Switcher de vistas — se renderiza en el hero de matriz (al lado de ‹ Hoy ›)
  // y se oculta de la toolbar de TablaDinamica cuando vista === 'matriz'.
  const switcherVistasHero = (
    <GrupoBotones>
      {/* Matriz = vista calendario del equipo completo → solo con ver_todos. */}
      {(['lista', 'tarjetas', ...(puedeVerTodos ? ['matriz'] as const : [])] as const).map((v) => {
        const iconos = { lista: <List size={14} />, tarjetas: <LayoutGrid size={14} />, matriz: <CalendarDays size={14} /> }
        return (
          <Boton
            key={v}
            variante="secundario"
            tamano="sm"
            soloIcono
            titulo={v.charAt(0).toUpperCase() + v.slice(1)}
            icono={iconos[v]}
            onClick={() => setVista(v)}
            className={vista === v ? 'bg-superficie-hover text-texto-primario' : 'text-texto-terciario'}
          />
        )
      })}
    </GrupoBotones>
  )

  // Acción principal del hero según pestaña activa y permisos granulares:
  //  • Fichajes  → "Agregar fichaje" (requiere marcar o editar de asistencias).
  //  • Nómina    → "Enviar recibos" (requiere nomina:enviar).
  const accionPrincipalHero =
    seccion === 'fichajes'
      ? ((puedeMarcar || puedeEditar)
        ? { etiqueta: 'Agregar fichaje', icono: <Plus size={14} />, onClick: () => setCreando({}) }
        : undefined)
      : (puedeEnviarNomina
        ? { etiqueta: 'Enviar recibos', icono: <Send size={14} />, onClick: () => nominaRef.current?.enviarRecibos() }
        : undefined)

  // Exportar Excel:
  //  • Fichajes → siempre visible (el API filtra por ver_propio/ver_todos).
  //  • Nómina   → solo con nomina:ver_todos (export del equipo completo).
  const accionesHero = (seccion === 'nomina' && !puedeVerNominaTodos)
    ? []
    : [{
        id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {
          if (seccion === 'nomina') {
            nominaRef.current?.exportar()
          } else {
            window.open('/api/asistencias/exportar', '_blank')
          }
        },
      }]

  return (
    <PlantillaListado
      titulo="Asistencias"
      icono={<Clock size={20} />}
      accionPrincipal={accionPrincipalHero}
      acciones={accionesHero}
      mostrarConfiguracion={puedeVerTodos}
      onConfiguracion={() => router.push('/asistencias/configuracion')}
    >
      {/* ── Tabs: siempre arriba del contenido, pegados al cabezal (mismo bloque de navegación) ── */}
      <div className="px-4 md:px-6 -mt-2">
        <Tabs tabs={tabsSeccion} activo={seccion} onChange={(c) => setSeccion(c as 'fichajes' | 'nomina')} />
      </div>

      {/* ── Contenido según pestaña ── */}
      {seccion === 'fichajes' ? (
        <TablaDinamica
          columnas={columnas}
          datos={registros}
          claveFila={(r) => r.id}
          vistas={['lista', 'tarjetas', ...(puedeVerTodos ? ['matriz'] as const : [])]}
          ocultarSwitcherVistas={vista === 'matriz'}
          ocultarBarraHerramientas={vista === 'matriz'}
          seleccionables
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por empleado o notas..."
          idModulo="asistencias"
          totalRegistros={total}
          registrosPorPagina={50}
          paginaExterna={pagina}
          onCambiarPagina={setPagina}
          filtros={[
            // ── Empleados ──
            {
              id: 'miembros', etiqueta: 'Empleado', tipo: 'multiple-compacto' as const,
              valor: filtroMiembros,
              onChange: (v) => setFiltroMiembros(Array.isArray(v) ? v : []),
              opciones: opcionesMiembros,
              descripcion: 'Filtrá por uno o más empleados específicos.',
            },
            {
              id: 'sectores', etiqueta: 'Sector', tipo: 'multiple-compacto' as const,
              valor: filtroSectores,
              onChange: (v) => setFiltroSectores(Array.isArray(v) ? v : []),
              opciones: opcionesSectores,
              descripcion: 'Filtrá por sector al que pertenecen los empleados.',
            },
            {
              id: 'turnos', etiqueta: 'Turno', tipo: 'multiple-compacto' as const,
              valor: filtroTurnos,
              onChange: (v) => setFiltroTurnos(Array.isArray(v) ? v : []),
              opciones: opcionesTurnos,
              descripcion: 'Filtrá por turno laboral aplicado al fichaje.',
            },
            // ── Estado y tipo ──
            {
              id: 'estados', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
              valor: filtroEstados,
              onChange: (v) => setFiltroEstados(Array.isArray(v) ? v : []),
              opciones: [
                { valor: 'activo', etiqueta: 'Activo (en curso)' },
                { valor: 'almuerzo', etiqueta: 'En almuerzo' },
                { valor: 'particular', etiqueta: 'Salida particular' },
                { valor: 'cerrado', etiqueta: 'Cerrado' },
                { valor: 'auto_cerrado', etiqueta: 'Auto-cerrado' },
                { valor: 'ausente', etiqueta: 'Ausente' },
                { valor: 'feriado', etiqueta: 'Feriado' },
              ],
              descripcion: 'Estado del registro de asistencia.',
            },
            {
              id: 'tipos', etiqueta: 'Tipo', tipo: 'multiple-compacto' as const,
              valor: filtroTipos,
              onChange: (v) => setFiltroTipos(Array.isArray(v) ? v : []),
              opciones: [
                { valor: 'normal', etiqueta: 'Normal' },
                { valor: 'tardanza', etiqueta: 'Tardanza' },
                { valor: 'flexible', etiqueta: 'Flexible' },
                { valor: 'ausencia', etiqueta: 'Ausencia' },
                { valor: 'feriado', etiqueta: 'Feriado' },
              ],
              descripcion: 'Tipo de asistencia según puntualidad o evento especial.',
            },
            {
              id: 'metodos', etiqueta: 'Método de fichaje', tipo: 'multiple-compacto' as const,
              valor: filtroMetodos,
              onChange: (v) => setFiltroMetodos(Array.isArray(v) ? v : []),
              opciones: [
                { valor: 'manual', etiqueta: 'Manual (admin)' },
                { valor: 'rfid', etiqueta: 'RFID' },
                { valor: 'nfc', etiqueta: 'NFC' },
                { valor: 'pin', etiqueta: 'PIN' },
                { valor: 'automatico', etiqueta: 'Automático (PWA)' },
                { valor: 'solicitud', etiqueta: 'Solicitud aprobada' },
                { valor: 'sistema', etiqueta: 'Sistema (cron)' },
              ],
              descripcion: 'Cómo se registró el fichaje.',
            },
            // ── Flags ──
            {
              id: 'con_tardanza', etiqueta: 'Con tardanza', tipo: 'pills' as const,
              valor: filtroConTardanza ? 'true' : '',
              onChange: (v) => setFiltroConTardanza(v === 'true'),
              opciones: [{ valor: 'true', etiqueta: 'Sí' }],
              descripcion: 'Fichajes marcados como tardanza o con puntualidad > 0 minutos.',
            },
            {
              id: 'sin_cerrar', etiqueta: 'Sin cerrar', tipo: 'pills' as const,
              valor: filtroSinCerrar ? 'true' : '',
              onChange: (v) => setFiltroSinCerrar(v === 'true'),
              opciones: [{ valor: 'true', etiqueta: 'Sí' }],
              descripcion: 'Fichajes con entrada pero sin salida (activos, en almuerzo o con salida particular).',
            },
            // ── Período ──
            {
              id: 'preset_fecha', etiqueta: 'Período', tipo: 'pills' as const,
              valor: filtroPresetFecha, onChange: (v) => setFiltroPresetFecha(v as string),
              opciones: [
                { valor: 'hoy', etiqueta: 'Hoy' },
                { valor: 'ayer', etiqueta: 'Ayer' },
                { valor: '7d', etiqueta: '7 días' },
                { valor: 'esta_semana', etiqueta: 'Esta semana' },
                { valor: 'semana_pasada', etiqueta: 'Semana pasada' },
                { valor: 'este_mes', etiqueta: 'Este mes' },
                { valor: 'mes_pasado', etiqueta: 'Mes pasado' },
                { valor: 'este_anio', etiqueta: 'Este año' },
              ],
              descripcion: 'Rango de fechas predefinido para el fichaje.',
            },
            // ── Auditoría ──
            {
              id: 'creado_por', etiqueta: 'Cargado por', tipo: 'seleccion-compacto' as const,
              valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
              opciones: opcionesMiembrosCreador,
              descripcion: 'Admin que cargó manualmente el fichaje (útil para auditoría).',
            },
          ]}
          gruposFiltros={[
            { id: 'empleados', etiqueta: 'Empleados', filtros: ['miembros', 'sectores', 'turnos'] },
            { id: 'estado', etiqueta: 'Estado y tipo', filtros: ['estados', 'tipos', 'metodos'] },
            { id: 'flags', etiqueta: 'Situaciones', filtros: ['con_tardanza', 'sin_cerrar'] },
            { id: 'periodo', etiqueta: 'Período', filtros: ['preset_fecha'] },
            { id: 'auditoria', etiqueta: 'Auditoría', filtros: ['creado_por'] },
          ]}
          onLimpiarFiltros={filtros.limpiar}
          opcionesOrden={[
            { etiqueta: 'Más recientes', clave: 'fecha', direccion: 'desc' },
            { etiqueta: 'Más antiguas', clave: 'fecha', direccion: 'asc' },
            { etiqueta: 'Entrada ↑', clave: 'hora_entrada', direccion: 'asc' },
            { etiqueta: 'Entrada ↓', clave: 'hora_entrada', direccion: 'desc' },
            { etiqueta: 'Puntualidad ↓', clave: 'puntualidad_min', direccion: 'desc' },
          ]}
          onVistaExterna={(v) => setVista(v as 'lista' | 'tarjetas' | 'matriz')}
          vistaExternaActiva={vista === 'matriz' ? 'matriz' : null}
          contenidoCustom={vista === 'matriz' ? <VistaMatriz
            recargarKey={matrizKey}
            slotAcciones={switcherVistasHero}
            onCrearFichaje={(miembroId, miembroNombre, fecha) => setCreando({ miembroId, miembroNombre, fecha })}
            onClickAsistencia={async (id) => {
              const res = await fetch(`/api/asistencias/detalle?id=${id}`)
              if (res.ok) {
                const reg = await res.json()
                if (reg?.id) { setEditando(reg); return }
              }
              const encontrado = registros.find(r => r.id === id)
              if (encontrado) setEditando(encontrado)
            }} /> : undefined}
          renderTarjeta={(r) => <TarjetaAsistencia registro={r} />}
          gridTarjetas="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          onClickFila={async (r) => {
            const res = await fetch(`/api/asistencias/detalle?id=${r.id}`)
            if (res.ok) {
              const detalle = await res.json()
              if (detalle?.id) { setEditando(detalle); return }
            }
            setEditando(r)
          }}
          estadoVacio={
            <EstadoVacio
              icono={<TimerOff size={52} strokeWidth={1} />}
              titulo="Nadie fichó todavía"
              descripcion="Cuando tu equipo empiece a registrar entrada y salida, las fichadas van a aparecer acá."
            />
          }
        />
      ) : (
        <VistaNomina ref={nominaRef} />
      )}

      <ModalEditarFichaje
        abierto={!!editando}
        onCerrar={() => setEditando(null)}
        registro={editando}
        onGuardado={alGuardar}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
      />

      <ModalCrearFichaje
        abierto={!!creando}
        onCerrar={() => setCreando(null)}
        onCreado={alGuardar}
        miembroId={creando?.miembroId}
        miembroNombre={creando?.miembroNombre}
        fecha={creando?.fecha}
      />
    </PlantillaListado>
  )
}

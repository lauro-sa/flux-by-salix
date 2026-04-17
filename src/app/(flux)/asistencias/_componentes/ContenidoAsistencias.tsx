'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Clock, TimerOff, Plus, History, Banknote } from 'lucide-react'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalEditarFichaje } from './ModalEditarFichaje'
import { useFormato } from '@/hooks/useFormato'
import { usePreferencias } from '@/hooks/usePreferencias'
import { VistaMatriz } from './VistaMatriz'
import { TarjetaAsistencia } from './TarjetaAsistencia'
import { ModalCrearFichaje } from './ModalCrearFichaje'
import { VistaNomina } from './VistaNomina'
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
  const router = useRouter()
  const queryClient = useQueryClient()
  const { formatoHora, locale } = useFormato()
  const { preferencias, guardar: guardarPrefs } = usePreferencias()
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState<RegistroAsistencia | null>(null)
  const [creando, setCreando] = useState<{ miembroId?: string; miembroNombre?: string; fecha?: string } | null>(null)
  const [matrizKey, setMatrizKey] = useState(0)
  const [seccion, setSeccion] = useState<'fichajes' | 'nomina'>('fichajes')

  // Vista persistida por usuario+dispositivo
  const vistaGuardada = (preferencias.config_tablas?.asistencias?.tipoVista as 'lista' | 'tarjetas' | 'matriz') || 'lista'
  const [vista, setVistaLocal] = useState<'lista' | 'tarjetas' | 'matriz'>(vistaGuardada)

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
  const sinFiltros = pagina === 1

  // useListado reemplaza el fetch manual
  const { datos: registros, total, cargando, recargar } = useListado<RegistroAsistencia>({
    clave: 'asistencias',
    url: '/api/asistencias',
    parametros: {
      pagina,
      limite: 50,
    },
    extraerDatos: (json) => (json.registros || []) as RegistroAsistencia[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

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

  const tabsSeccion = [
    { clave: 'fichajes', etiqueta: 'Fichajes', icono: <Clock size={15} /> },
    { clave: 'nomina', etiqueta: 'Nómina', icono: <Banknote size={15} /> },
  ]

  if (seccion === 'nomina') {
    return (
      <PlantillaListado
        titulo="Asistencias"
        icono={<Clock size={20} />}
        mostrarConfiguracion
        onConfiguracion={() => router.push('/asistencias/configuracion')}
      >
        <div className="px-4 pt-2 md:px-6">
          <Tabs tabs={tabsSeccion} activo={seccion} onChange={(c) => setSeccion(c as 'fichajes' | 'nomina')} />
        </div>
        <VistaNomina />
      </PlantillaListado>
    )
  }

  return (
    <PlantillaListado
      titulo="Asistencias"
      icono={<Clock size={20} />}
      accionPrincipal={{
        etiqueta: 'Agregar fichaje',
        icono: <Plus size={14} />,
        onClick: () => setCreando({}),
      }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar Excel', icono: <Download size={14} />, onClick: () => {
          window.open('/api/asistencias/exportar', '_blank')
        } },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/asistencias/configuracion')}
    >
      <div className="px-4 pt-2 md:px-6">
        <Tabs tabs={tabsSeccion} activo={seccion} onChange={(c) => setSeccion(c as 'fichajes' | 'nomina')} />
      </div>

      <TablaDinamica
        columnas={columnas}
        datos={registros}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas', 'matriz']}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar empleado..."
        idModulo="asistencias"
        totalRegistros={total}
        registrosPorPagina={50}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        onVistaExterna={(v) => setVista(v as 'lista' | 'tarjetas' | 'matriz')}
        vistaExternaActiva={vista === 'matriz' ? 'matriz' : null}
        contenidoCustom={vista === 'matriz' ? <VistaMatriz
          recargarKey={matrizKey}
          onCrearFichaje={(miembroId, miembroNombre, fecha) => setCreando({ miembroId, miembroNombre, fecha })}
          onClickAsistencia={async (id) => {
          // Siempre buscar detalle completo (incluye tiempo activo)
          const res = await fetch(`/api/asistencias/detalle?id=${id}`)
          if (res.ok) {
            const reg = await res.json()
            if (reg?.id) { setEditando(reg); return }
          }
          // Fallback: usar registro cargado sin tiempo activo
          const encontrado = registros.find(r => r.id === id)
          if (encontrado) setEditando(encontrado)
        }} /> : undefined}
        renderTarjeta={(r) => <TarjetaAsistencia registro={r} />}
        onClickFila={async (r) => {
          // Cargar detalle completo con tiempo activo
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

      <ModalEditarFichaje
        abierto={!!editando}
        onCerrar={() => setEditando(null)}
        registro={editando}
        onGuardado={alGuardar}
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Clock, TimerOff, Pencil } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalEditarFichaje } from './_componentes/ModalEditarFichaje'
import { useFormato } from '@/hooks/useFormato'
import { VistaMatriz } from './_componentes/VistaMatriz'
import { TarjetaAsistencia } from './_componentes/TarjetaAsistencia'

// ─── Constantes ──────────────────────────────────────────────

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: 'En turno',
  almuerzo: 'En almuerzo',
  particular: 'Trámite',
  cerrado: 'Cerrado',
  auto_cerrado: 'Sin salida',
  ausente: 'Ausente',
  presente: 'Presente',
}

const COLOR_ESTADO: Record<string, string> = {
  activo: 'exito',
  almuerzo: 'advertencia',
  particular: 'info',
  cerrado: 'neutro',
  auto_cerrado: 'peligro',
  ausente: 'peligro',
  presente: 'exito',
}

const ETIQUETA_METODO: Record<string, string> = {
  manual: 'Manual',
  rfid: 'RFID',
  nfc: 'NFC',
  pin: 'PIN',
  automatico: 'Automático',
  solicitud: 'Solicitud',
  sistema: 'Sistema',
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
  puntualidad_min: number | null
  salida_particular: string | null
  vuelta_particular: string | null
  editado_por: string | null
  notas: string | null
  ubicacion_entrada: Record<string, unknown> | null
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

function formatearFecha(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatearUbicacion(ub: Record<string, unknown> | null): string {
  if (!ub) return '—'
  if (ub.direccion) return String(ub.direccion)
  if (ub.lat && ub.lng) return `${Number(ub.lat).toFixed(4)}, ${Number(ub.lng).toFixed(4)}`
  return '—'
}

// ─── Página ──────────────────────────────────────────────────

export default function PaginaAsistencias() {
  const router = useRouter()
  const { formatoHora } = useFormato()
  const [busqueda, setBusqueda] = useState('')
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState<RegistroAsistencia | null>(null)
  const [vista, setVista] = useState<'lista' | 'tarjetas' | 'matriz'>('lista')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina), limite: '50' })
      const res = await fetch(`/api/asistencias?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setRegistros(data.registros || [])
      setTotal(data.total || 0)
    } finally {
      setCargando(false)
    }
  }, [pagina])

  useEffect(() => { cargar() }, [cargar])

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
        <span className="text-texto-secundario">{formatearFecha(r.fecha)}</span>
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
      etiqueta: '',
      ancho: 30,
      render: (r) => r.editado_por ? (
        <Pencil size={12} className="text-texto-terciario" />
      ) : null,
    },
  ]

  return (
    <PlantillaListado
      titulo="Asistencias"
      icono={<Clock size={20} />}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/asistencias/configuracion')}
    >
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
        contenidoCustom={vista === 'matriz' ? <VistaMatriz /> : undefined}
        renderTarjeta={(r) => <TarjetaAsistencia registro={r} />}
        onClickFila={(r) => setEditando(r)}
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
        onGuardado={cargar}
      />
    </PlantillaListado>
  )
}

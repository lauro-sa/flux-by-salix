'use client'

/**
 * Página de nómina por empleado: ruta pantalla completa que reemplaza al
 * ModalDetalleNomina. Carga el resultado del empleado + la lista completa
 * del período (para navegación entre empleados) y pasa todo al editor.
 *
 * URL: /asistencias/nomina/[miembro_id]?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useGuardPermiso } from '@/hooks/useGuardPermiso'
import { usePermisosActuales } from '@/hooks/usePermisosActuales'
import { useRol } from '@/hooks/useRol'
import {
  PaginaEditorNominaEmpleado,
  type ResultadoNomina,
  type EmpleadoLista,
} from '@/componentes/entidad/_editor_nomina_empleado/PaginaEditorNominaEmpleado'

// Calcula el período por defecto (mes actual) si no vienen fechas en la URL
function periodoMesActual(): { desde: string; hasta: string } {
  const hoy = new Date()
  const mes = hoy.getMonth()
  const anio = hoy.getFullYear()
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`,
  }
}

function etiquetaPeriodo(desde: string, hasta: string): string {
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  const mesD = d.getMonth(), mesH = h.getMonth()
  const anioD = d.getFullYear(), anioH = h.getFullYear()

  // Mes completo
  if (d.getDate() === 1 && h.getDate() === new Date(anioH, mesH + 1, 0).getDate() && mesD === mesH && anioD === anioH) {
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
  }
  // Quincena
  if (mesD === mesH && anioD === anioH) {
    if (d.getDate() === 1 && h.getDate() === 15) {
      return `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    }
    if (d.getDate() === 16) {
      return `Quincena 16-${h.getDate()} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    }
  }
  // Semana u otro
  return `${d.getDate()}/${mesD + 1} — ${h.getDate()}/${mesH + 1}`
}

export default function PaginaNominaEmpleado() {
  const { bloqueado: sinPermiso } = useGuardPermiso('nomina')
  const { miembroId: miembroIdPropio, cargando: cargandoPermisos } = usePermisosActuales()
  const { tienePermiso } = useRol()
  const puedeVerTodosNomina = tienePermiso('nomina', 'ver_todos')

  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const miembroId = String(params?.miembro_id || '')

  // ver_propio sin ver_todos: la URL debe ser la de su propio miembro_id.
  // Si intenta abrir el recibo de otro empleado, redirect.
  useEffect(() => {
    if (cargandoPermisos) return
    if (puedeVerTodosNomina) return
    if (miembroIdPropio && miembroId !== miembroIdPropio) {
      router.replace('/asistencias?tab=nomina')
    }
  }, [cargandoPermisos, puedeVerTodosNomina, miembroId, miembroIdPropio, router])

  const [cargando, setCargando] = useState(true)
  const [empleado, setEmpleado] = useState<ResultadoNomina | null>(null)
  const [empleadosPeriodo, setEmpleadosPeriodo] = useState<EmpleadoLista[]>([])
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [noEncontrado, setNoEncontrado] = useState(false)

  // Leer fechas de la URL sólo al montar. Cambios posteriores (window.history.replaceState
  // desde el editor) no deben re-disparar este fetch — el editor gestiona sus propios datos.
  const [fechasIniciales] = useState(() => {
    const desdeQuery = search.get('desde')
    const hastaQuery = search.get('hasta')
    const { desde: desdeDefault, hasta: hastaDefault } = periodoMesActual()
    return {
      desde: desdeQuery || desdeDefault,
      hasta: hastaQuery || hastaDefault,
    }
  })
  const { desde, hasta } = fechasIniciales

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setNoEncontrado(false)
      try {
        const res = await fetch(`/api/asistencias/nomina?desde=${desde}&hasta=${hasta}`)
        const data = await res.json()
        if (cancelado) return

        const resultados = (data.resultados || []) as ResultadoNomina[]
        const encontrado = resultados.find(r => r.miembro_id === miembroId)
        if (!encontrado) {
          setNoEncontrado(true)
          setCargando(false)
          return
        }
        setEmpleado(encontrado)
        setEmpleadosPeriodo(resultados.map(r => ({
          miembro_id: r.miembro_id,
          nombre: r.nombre,
          compensacion_frecuencia: r.compensacion_frecuencia,
        })))
        setNombreEmpresa(data.nombre_empresa || '')
      } catch {
        setNoEncontrado(true)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (miembroId) cargar()
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId])

  if (sinPermiso) return null

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando nómina...</p>
      </div>
    )
  }

  if (noEncontrado || !empleado) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-texto-terciario">No se encontró el empleado en este período.</p>
        <button
          onClick={() => router.push('/asistencias?tab=nomina')}
          className="text-sm text-texto-marca hover:underline"
        >
          Volver a nómina
        </button>
      </div>
    )
  }

  return (
    <PaginaEditorNominaEmpleado
      empleadoInicial={empleado}
      periodoInicial={{ desde, hasta, etiqueta: etiquetaPeriodo(desde, hasta) }}
      nombreEmpresa={nombreEmpresa}
      empleadosPeriodoInicial={empleadosPeriodo}
      rutaVolver="/asistencias?tab=nomina"
      textoVolver="Nómina"
    />
  )
}

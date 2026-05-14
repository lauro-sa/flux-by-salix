'use client'

/**
 * Ficha laboral del empleado — pantalla completa con header + tabs.
 *
 * URL: /nominas/empleado/[miembro_id]?tab=...&desde=...&hasta=...
 *
 * Tabs (introducidas en PR 5 del plan):
 *   1. Contrato vigente  — ContratoVigente + CTA "Nuevo contrato".
 *   2. Historial         — TimelineContratos con todos los contratos.
 *   3. Liquidaciones     — PaginaEditorNominaEmpleado existente
 *      (la vista de recibo por período que ya funcionaba).
 *   4. Adelantos         — placeholder hasta el PR dedicado.
 *   5. Conceptos         — placeholder hasta PR 6.
 *
 * Header sticky con foto, nombre, sector/turno/modalidad/monto del
 * contrato vigente. Si el miembro no tiene contrato, se ofrece crear
 * uno desde la primera tab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ArrowLeft, Loader2, Banknote, History, FileText, Wallet, Tag } from 'lucide-react'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { usePermisosActuales } from '@/hooks/usePermisosActuales'
import { useRol } from '@/hooks/useRol'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { ContratoVigente } from '@/app/(flux)/nominas/_componentes/ContratoVigente'
import { TimelineContratos } from '@/app/(flux)/nominas/_componentes/TimelineContratos'
import { EditorContrato } from '@/app/(flux)/nominas/_componentes/EditorContrato'
import { AsignadorConceptosContrato } from '@/app/(flux)/nominas/_componentes/AsignadorConceptosContrato'
import {
  PaginaEditorNominaEmpleado,
  type ResultadoNomina,
  type EmpleadoLista,
} from '@/componentes/entidad/_editor_nomina_empleado/PaginaEditorNominaEmpleado'
import type { ContratoLaboral, ConceptoNomina } from '@/tipos/nominas'

// ────────────────────────────────────────────────────────────────
// Helpers de período (mantenidos del archivo original)
// ────────────────────────────────────────────────────────────────

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
  if (d.getDate() === 1 && h.getDate() === new Date(anioH, mesH + 1, 0).getDate() && mesD === mesH && anioD === anioH) {
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
  }
  if (mesD === mesH && anioD === anioH) {
    if (d.getDate() === 1 && h.getDate() === 15) return `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    if (d.getDate() === 16) return `Quincena 16-${h.getDate()} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
  }
  return `${d.getDate()}/${mesD + 1} — ${h.getDate()}/${mesH + 1}`
}

// ────────────────────────────────────────────────────────────────
// Wrapper con GuardPagina
// ────────────────────────────────────────────────────────────────

export default function PaginaFichaLaboral() {
  return (
    <GuardPagina modulo="nomina">
      <ContenidoFicha />
    </GuardPagina>
  )
}

// ────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ────────────────────────────────────────────────────────────────

type TabClave = 'contrato' | 'historial' | 'liquidaciones' | 'adelantos' | 'conceptos'

interface PerfilMini {
  nombre: string
  apellido: string
  avatar_url: string | null
}

interface OpcionRef { id: string; nombre: string }

// ────────────────────────────────────────────────────────────────
// Contenido
// ────────────────────────────────────────────────────────────────

function ContenidoFicha() {
  const { miembroId: miembroIdPropio, cargando: cargandoPermisos } = usePermisosActuales()
  const { tienePermiso } = useRol()
  const puedeVerTodosNomina = tienePermiso('nomina', 'ver_todos')
  const puedeEditar = tienePermiso('nomina', 'editar')

  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const miembroId = String(params?.miembro_id || '')
  const toast = useToast()

  // ─── ver_propio: redirect si está mirando una ficha que no es la suya ───
  useEffect(() => {
    if (cargandoPermisos || puedeVerTodosNomina) return
    if (miembroIdPropio && miembroId !== miembroIdPropio) router.replace('/nominas')
  }, [cargandoPermisos, puedeVerTodosNomina, miembroId, miembroIdPropio, router])

  // ─── Tab activa sincronizada con ?tab=... ───
  const tabUrl = searchParams.get('tab') as TabClave | null
  const TABS: { clave: TabClave; etiqueta: string; icono: React.ReactNode }[] = [
    { clave: 'contrato',      etiqueta: 'Contrato vigente', icono: <FileText size={15} /> },
    { clave: 'historial',     etiqueta: 'Historial',        icono: <History size={15} /> },
    { clave: 'liquidaciones', etiqueta: 'Liquidaciones',    icono: <Banknote size={15} /> },
    { clave: 'adelantos',     etiqueta: 'Adelantos',        icono: <Wallet size={15} /> },
    { clave: 'conceptos',     etiqueta: 'Conceptos',        icono: <Tag size={15} /> },
  ]
  const [tab, setTab] = useState<TabClave>(
    TABS.some(t => t.clave === tabUrl) ? tabUrl! : 'contrato',
  )
  const cambiarTab = (claveStr: string) => {
    const clave = claveStr as TabClave
    setTab(clave)
    const next = new URLSearchParams(window.location.search)
    if (clave === 'contrato') next.delete('tab')
    else next.set('tab', clave)
    const qs = next.toString()
    router.replace(`/nominas/empleado/${miembroId}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  // ─── Datos del perfil + contratos + catálogos ───
  const [perfil, setPerfil] = useState<PerfilMini | null>(null)
  const [contratos, setContratos] = useState<ContratoLaboral[]>([])
  const [sectores, setSectores] = useState<OpcionRef[]>([])
  const [turnos, setTurnos] = useState<OpcionRef[]>([])
  const [conceptosCatalogo, setConceptosCatalogo] = useState<ConceptoNomina[]>([])
  const [conceptosHeredados, setConceptosHeredados] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [editorAbierto, setEditorAbierto] = useState(false)

  const cargarTodo = useCallback(async () => {
    if (!miembroId) return
    setCargando(true)
    try {
      const supabase = crearClienteNavegador()

      // Identidad del empleado: el endpoint `/api/miembros/[id]` ya consolida
      // perfil (cuenta de Flux) y contacto-equipo (empleado sin cuenta).
      // Aquí sólo cargamos el nombre/apellido para el header; el avatar lo
      // traemos aparte de `perfiles` cuando hay cuenta.
      const [identidadRes, miembroRes, contratosRes, sectoresRes, turnosRes, conceptosRes] = await Promise.all([
        fetch(`/api/miembros/${miembroId}`).then(r => r.ok ? r.json() : null),
        supabase.from('miembros').select('usuario_id').eq('id', miembroId).maybeSingle(),
        fetch(`/api/nominas/contratos?miembro_id=${miembroId}`).then(r => r.json()),
        supabase.from('sectores').select('id, nombre').eq('activo', true).order('orden'),
        supabase.from('turnos_laborales').select('id, nombre').order('orden'),
        fetch('/api/nominas/conceptos').then(r => r.json()),
      ])

      // Avatar sólo aplica a miembros con cuenta.
      let avatarUrl: string | null = null
      const usuarioId = miembroRes.data?.usuario_id ?? null
      if (usuarioId) {
        const { data: perfilAvatar } = await supabase
          .from('perfiles').select('avatar_url').eq('id', usuarioId).maybeSingle()
        avatarUrl = perfilAvatar?.avatar_url ?? null
      }

      setPerfil(identidadRes ? {
        nombre: identidadRes.nombre || '',
        apellido: identidadRes.apellido || '',
        avatar_url: avatarUrl,
      } : null)
      const contratosLista = (contratosRes.contratos ?? []) as ContratoLaboral[]
      setContratos(contratosLista)
      setSectores((sectoresRes.data ?? []) as OpcionRef[])
      setTurnos((turnosRes.data ?? []) as OpcionRef[])
      setConceptosCatalogo((conceptosRes.conceptos ?? []) as ConceptoNomina[])

      // Cargar conceptos heredados del contrato vigente (si existe)
      // para preseleccionarlos en el EditorContrato.
      const vigente = contratosLista.find(c => c.vigente)
      if (vigente) {
        try {
          const conceptosVigenteRes = await fetch(`/api/nominas/contratos/${vigente.id}/conceptos`)
          const conceptosVigenteData = await conceptosVigenteRes.json()
          const asig = (conceptosVigenteData.asignaciones ?? []) as { concepto_id: string; activo: boolean }[]
          setConceptosHeredados(asig.filter(a => a.activo).map(a => a.concepto_id))
        } catch {
          setConceptosHeredados([])
        }
      } else {
        setConceptosHeredados([])
      }
    } catch (err) {
      console.error('[ficha] error', err)
      toast.mostrar('error', 'No se pudo cargar la ficha laboral')
    } finally {
      setCargando(false)
    }
  }, [miembroId, toast])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const sectoresMap = useMemo(() => new Map(sectores.map(s => [s.id, s.nombre])), [sectores])
  const turnosMap = useMemo(() => new Map(turnos.map(t => [t.id, t.nombre])), [turnos])

  const contratoVigente = contratos.find(c => c.vigente) ?? null

  // ─── Header data ───
  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : '...'
  const sectorVigente = contratoVigente?.sector_id ? sectoresMap.get(contratoVigente.sector_id) ?? null : null
  const turnoVigente = contratoVigente?.turno_id ? turnosMap.get(contratoVigente.turno_id) ?? null : null

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="px-4 md:px-6 py-8">
        <EstadoVacio
          icono={<Banknote size={48} strokeWidth={1.5} />}
          titulo="Empleado no encontrado"
          descripcion="No pudimos cargar la ficha del empleado. Puede que haya sido eliminado o que no pertenezca a esta empresa."
          accion={
            <Boton variante="secundario" icono={<ArrowLeft size={14} />} onClick={() => router.push('/nominas')}>
              Volver a Nóminas
            </Boton>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* ─── Header ─── */}
      <div className="border-b border-borde-sutil bg-superficie-app">
        <div className="px-4 md:px-6 py-4">
          {/* Volver */}
          <button
            type="button"
            onClick={() => router.push('/nominas?tab=empleados')}
            className="inline-flex items-center gap-1 text-xs text-texto-terciario hover:text-texto-primario mb-3"
          >
            <ChevronLeft size={14} /> Empleados
          </button>

          {/* Identidad + datos vigentes */}
          <div className="flex items-start gap-4">
            {/* Foto */}
            <div className="shrink-0 w-12 h-12 rounded-full bg-superficie-elevada border border-borde-sutil overflow-hidden flex items-center justify-center text-texto-terciario">
              {perfil.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.avatar_url} alt={nombreCompleto} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base font-medium">
                  {(perfil.nombre[0] ?? '?').toUpperCase()}{(perfil.apellido[0] ?? '').toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-texto-primario">{nombreCompleto}</h1>
              {contratoVigente ? (
                <p className="text-xs text-texto-terciario mt-1">
                  {sectorVigente ?? '—'} · {turnoVigente ?? 'Sin turno'} ·{' '}
                  {modalidadCorta(contratoVigente.modalidad_calculo)} ·{' '}
                  {formatearMonto(contratoVigente.monto_base)} {frecuenciaCorta(contratoVigente.frecuencia_pago)}
                </p>
              ) : (
                <p className="text-xs text-texto-terciario mt-1">Sin contrato laboral cargado</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs pegadas al header */}
        <div className="px-4 md:px-6">
          <Tabs tabs={TABS} activo={tab} onChange={cambiarTab} layoutId="tab-ficha-empleado" sinBorde />
        </div>
      </div>

      {/* ─── Contenido por tab ─── */}
      {tab === 'contrato' && (
        <ContratoVigente
          contrato={contratoVigente}
          sectorNombre={sectorVigente}
          turnoNombre={turnoVigente}
          puedeEditar={puedeEditar}
          onNuevoContrato={() => setEditorAbierto(true)}
        />
      )}

      {tab === 'historial' && (
        <TimelineContratos
          contratos={contratos}
          sectoresMap={sectoresMap}
          turnosMap={turnosMap}
        />
      )}

      {tab === 'liquidaciones' && <SeccionLiquidaciones miembroId={miembroId} />}

      {tab === 'adelantos' && (
        <EstadoVacio
          icono={<Wallet size={48} strokeWidth={1.5} />}
          titulo="Adelantos — en construcción"
          descripcion="Pronto vas a poder ver y administrar los adelantos vigentes de este empleado desde acá. Por ahora se gestionan en la liquidación."
        />
      )}

      {tab === 'conceptos' && (
        contratoVigente ? (
          <div className="px-4 md:px-6 py-4">
            <AsignadorConceptosContrato
              modo="contrato"
              contratoId={contratoVigente.id}
              vigente={true}
            />
          </div>
        ) : (
          <EstadoVacio
            icono={<Tag size={48} strokeWidth={1.5} />}
            titulo="Sin contrato vigente"
            descripcion="Para asignar conceptos primero creá un contrato laboral desde la pestaña Contrato vigente."
            accion={puedeEditar ? (
              <Boton icono={<FileText size={14} />} onClick={() => { setTab('contrato'); setEditorAbierto(true) }}>
                Crear contrato
              </Boton>
            ) : undefined}
          />
        )
      )}

      {/* ─── Modal nuevo contrato ─── */}
      <EditorContrato
        abierto={editorAbierto}
        miembroId={miembroId}
        contratoActual={contratoVigente}
        sectores={sectores}
        turnos={turnos}
        conceptos={conceptosCatalogo}
        conceptosHeredados={conceptosHeredados}
        onCerrar={() => setEditorAbierto(false)}
        onCreado={async () => {
          await cargarTodo()
          setTab('contrato')
        }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Sub-componente: Liquidaciones (wraps the legacy salary editor)
// ────────────────────────────────────────────────────────────────

/**
 * Mantiene la lógica existente del editor de recibo por período.
 * Cuando PR 7 (motor de cálculo) integre `contratos_laborales`, este
 * wrapper se reescribirá para consumir ContratoSnapshot.
 */
function SeccionLiquidaciones({ miembroId }: { miembroId: string }) {
  const search = useSearchParams()
  const [cargando, setCargando] = useState(true)
  const [empleado, setEmpleado] = useState<ResultadoNomina | null>(null)
  const [empleadosPeriodo, setEmpleadosPeriodo] = useState<EmpleadoLista[]>([])
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [fechasIniciales] = useState(() => {
    const desdeQuery = search.get('desde')
    const hastaQuery = search.get('hasta')
    const { desde: desdeDefault, hasta: hastaDefault } = periodoMesActual()
    return { desde: desdeQuery || desdeDefault, hasta: hastaQuery || hastaDefault }
  })
  const { desde, hasta } = fechasIniciales

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setNoEncontrado(false)
      try {
        const res = await fetch(`/api/nominas?desde=${desde}&hasta=${hasta}`)
        const data = await res.json()
        if (cancelado) return
        const resultados = (data.resultados || []) as ResultadoNomina[]
        const encontrado = resultados.find(r => r.miembro_id === miembroId)
        if (!encontrado) { setNoEncontrado(true); setCargando(false); return }
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

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16 text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (noEncontrado || !empleado) {
    return (
      <div className="px-4 md:px-6 py-8">
        <EstadoVacio
          icono={<Banknote size={48} strokeWidth={1.5} />}
          titulo="Sin movimiento en este período"
          descripcion="Este empleado no tiene fichajes ni nómina en el período cargado. Probá con otro mes desde el selector dentro del editor."
        />
      </div>
    )
  }

  return (
    <PaginaEditorNominaEmpleado
      empleadoInicial={empleado}
      periodoInicial={{ desde, hasta, etiqueta: etiquetaPeriodo(desde, hasta) }}
      nombreEmpresa={nombreEmpresa}
      empleadosPeriodoInicial={empleadosPeriodo}
      rutaVolver="/nominas"
      textoVolver="Nóminas"
    />
  )
}

// ────────────────────────────────────────────────────────────────
// Helpers de display
// ────────────────────────────────────────────────────────────────

function modalidadCorta(m: string): string {
  const map: Record<string, string> = {
    por_hora: 'Por hora',
    por_dia: 'Por día',
    fijo_semanal: 'Fijo semanal',
    fijo_quincenal: 'Fijo quincenal',
    fijo_mensual: 'Fijo mensual',
  }
  return map[m] ?? m
}

function frecuenciaCorta(f: string): string {
  const map: Record<string, string> = {
    diaria: 'por día',
    semanal: 'por semana',
    quincenal: 'por quincena',
    mensual: 'por mes',
  }
  return map[f] ?? f
}

function formatearMonto(v: number): string {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Banknote, History, FileText, Wallet, Tag, CalendarOff, Building2, Clock, Briefcase } from 'lucide-react'
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
import { ModalEditarContrato } from '@/app/(flux)/nominas/_componentes/ModalEditarContrato'
import { AsignadorConceptosContrato } from '@/app/(flux)/nominas/_componentes/AsignadorConceptosContrato'
import { SeccionLicencias } from '@/app/(flux)/nominas/_componentes/SeccionLicencias'
import {
  PaginaEditorNominaEmpleado,
  type ResultadoNomina,
  type EmpleadoLista,
} from '@/componentes/entidad/_editor_nomina_empleado/PaginaEditorNominaEmpleado'
import type { ContratoLaboral, ConceptoNomina, ConceptoContratoConDetalle } from '@/tipos/nominas'

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

type TabClave = 'contrato' | 'historial' | 'liquidaciones' | 'adelantos' | 'licencias' | 'conceptos'

interface PerfilMini {
  nombre: string
  apellido: string
  avatar_url: string | null
}

interface OpcionRef { id: string; nombre: string }
interface SectorOpcion extends OpcionRef { turno_id?: string | null }

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
    { clave: 'licencias',     etiqueta: 'Licencias',        icono: <CalendarOff size={15} /> },
    { clave: 'conceptos',     etiqueta: 'Conceptos',        icono: <Tag size={15} /> },
  ]
  const [tab, setTab] = useState<TabClave>(
    TABS.some(t => t.clave === tabUrl) ? tabUrl! : 'contrato',
  )
  // Tabs ya visitadas. Mantenemos vivas en memoria las que ya se
  // mostraron (solo las ocultamos con `hidden`), así cambiar de tab
  // no remonta el componente ni dispara re-fetches: el estado interno
  // y los datos quedan cacheados. La primera visita sí monta (lazy).
  const [tabsVisitadas, setTabsVisitadas] = useState<Set<TabClave>>(() => new Set([tab]))
  useEffect(() => {
    setTabsVisitadas(prev => prev.has(tab) ? prev : new Set([...prev, tab]))
  }, [tab])
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
  const [sectores, setSectores] = useState<SectorOpcion[]>([])
  const [turnos, setTurnos] = useState<OpcionRef[]>([])
  const [conceptosCatalogo, setConceptosCatalogo] = useState<ConceptoNomina[]>([])
  /**
   * Asignaciones completas del contrato vigente (vigentes + cerradas).
   * Las vigentes son las que tienen `fecha_baja === null`. Se usan
   * para mostrar la lista en "Contrato vigente" y derivar
   * `conceptosHeredados` (preselección al renovar).
   */
  const [conceptosAsignados, setConceptosAsignados] = useState<ConceptoContratoConDetalle[]>([])
  /**
   * `primeraCarga` controla si se muestra el spinner full-screen
   * (que reemplaza header + tabs). Solo se muestra en la primera
   * carga; las recargas posteriores (refrescar contratos al renovar,
   * por ejemplo) no tocan este flag para que el header y las tabs
   * permanezcan visibles, evitando la sensación de remontaje.
   */
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [editorAbierto, setEditorAbierto] = useState(false)
  /**
   * Cuando es true, el EditorContrato se abre en modo "Cambiar
   * condiciones": cierra el vigente con motivo `cambio_condiciones` y
   * muestra un aviso explicativo. Cuando es false (default), abre como
   * "Nuevo contrato" sin motivo de cierre.
   */
  const [editorModoCambio, setEditorModoCambio] = useState(false)
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)

  /**
   * Ref al `toast` para usarlo dentro de `cargarTodo` sin meterlo
   * en sus dependencias. El value del context de Toast no está
   * memoizado y cambia de referencia cada vez que el provider
   * re-renderiza (por ejemplo, al aparecer/desaparecer cualquier
   * toast en la app), lo que recreaba `cargarTodo` y disparaba
   * un re-fetch espontáneo que reemplazaba toda la página por el
   * spinner — borrando el header y las tabs visualmente.
   */
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const cargarTodo = useCallback(async () => {
    if (!miembroId) return
    try {
      const supabase = crearClienteNavegador()

      // Identidad del empleado: el endpoint `/api/miembros/[id]` ya consolida
      // perfil (cuenta de Flux) y contacto-equipo (empleado sin cuenta).
      // Aquí sólo cargamos el nombre/apellido para el header; el avatar lo
      // traemos aparte de `perfiles` cuando hay cuenta, y caemos a la foto
      // de kiosco si el perfil no tiene avatar cargado.
      const [identidadRes, miembroRes, contratosRes, sectoresRes, turnosRes, conceptosRes] = await Promise.all([
        fetch(`/api/miembros/${miembroId}`).then(r => r.ok ? r.json() : null),
        supabase.from('miembros').select('usuario_id, foto_kiosco_url').eq('id', miembroId).maybeSingle(),
        fetch(`/api/nominas/contratos?miembro_id=${miembroId}`).then(r => r.json()),
        supabase.from('sectores').select('id, nombre, turno_id').eq('activo', true).order('orden'),
        supabase.from('turnos_laborales').select('id, nombre').order('orden'),
        fetch('/api/nominas/conceptos').then(r => r.json()),
      ])

      // Orden de resolución de la foto del empleado:
      //   1) `perfiles.avatar_url` (la que el empleado se sube desde su cuenta).
      //   2) `miembros.foto_kiosco_url` (la cara que se capturó en el kiosco al
      //      darlo de alta, típica de empleados sin cuenta en el sistema).
      // Esto evita ver iniciales en empleados que sí tienen foto en kiosco
      // aunque nunca se hayan logueado.
      let avatarUrl: string | null = (miembroRes.data?.foto_kiosco_url as string | null) ?? null
      const usuarioId = miembroRes.data?.usuario_id ?? null
      if (usuarioId) {
        const { data: perfilAvatar } = await supabase
          .from('perfiles').select('avatar_url').eq('id', usuarioId).maybeSingle()
        if (perfilAvatar?.avatar_url) avatarUrl = perfilAvatar.avatar_url
      }

      setPerfil(identidadRes ? {
        nombre: identidadRes.nombre || '',
        apellido: identidadRes.apellido || '',
        avatar_url: avatarUrl,
      } : null)
      const contratosLista = (contratosRes.contratos ?? []) as ContratoLaboral[]
      setContratos(contratosLista)
      setSectores((sectoresRes.data ?? []) as SectorOpcion[])
      setTurnos((turnosRes.data ?? []) as OpcionRef[])
      setConceptosCatalogo((conceptosRes.conceptos ?? []) as ConceptoNomina[])

      // Cargar las asignaciones del contrato vigente (si existe). Se
      // usan para mostrar la lista en "Contrato vigente" y para
      // preseleccionar conceptos al renovar/cambiar condiciones.
      const vigente = contratosLista.find(c => c.vigente)
      if (vigente) {
        try {
          const conceptosVigenteRes = await fetch(`/api/nominas/contratos/${vigente.id}/conceptos`)
          const conceptosVigenteData = await conceptosVigenteRes.json()
          setConceptosAsignados((conceptosVigenteData.asignaciones ?? []) as ConceptoContratoConDetalle[])
        } catch {
          setConceptosAsignados([])
        }
      } else {
        setConceptosAsignados([])
      }
    } catch (err) {
      console.error('[ficha] error', err)
      toastRef.current.mostrar('error', 'No se pudo cargar la ficha laboral')
    } finally {
      setPrimeraCarga(false)
    }
  }, [miembroId])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const sectoresMap = useMemo(() => new Map(sectores.map(s => [s.id, s.nombre])), [sectores])
  const turnosMap = useMemo(() => new Map(turnos.map(t => [t.id, t.nombre])), [turnos])
  /**
   * IDs de conceptos vigentes hoy (para preselección al renovar el
   * contrato). Derivado de `conceptosAsignados`: filas con
   * `fecha_baja === null` son las activas.
   */
  const conceptosHeredados = useMemo(
    () => conceptosAsignados.filter(a => a.fecha_baja === null).map(a => a.concepto_id),
    [conceptosAsignados],
  )
  /** Asignaciones vigentes hoy (las que se muestran en Contrato vigente). */
  const conceptosVigentes = useMemo(
    () => conceptosAsignados.filter(a => a.fecha_baja === null),
    [conceptosAsignados],
  )
  /**
   * Mapa sector_id → turno_id del turno predeterminado del sector.
   * Sirve para resolver el "turno efectivo" del contrato: si el contrato
   * no tiene `turno_id` propio, hereda el del sector.
   */
  const sectorTurnoMap = useMemo(
    () => new Map(sectores.map(s => [s.id, s.turno_id ?? null])),
    [sectores],
  )

  /**
   * Devuelve el turno efectivo (nombre + si fue heredado del sector) de
   * un contrato. Lógica: primero mira el turno propio del contrato; si
   * no tiene, cae al turno predeterminado del sector asociado.
   */
  function resolverTurnoEfectivo(contrato: ContratoLaboral | null): { nombre: string; heredado: boolean } | null {
    if (!contrato) return null
    if (contrato.turno_id) {
      const nombre = turnosMap.get(contrato.turno_id)
      if (nombre) return { nombre, heredado: false }
    }
    if (contrato.sector_id) {
      const turnoSector = sectorTurnoMap.get(contrato.sector_id)
      if (turnoSector) {
        const nombre = turnosMap.get(turnoSector)
        if (nombre) return { nombre, heredado: true }
      }
    }
    return null
  }

  const contratoVigente = contratos.find(c => c.vigente) ?? null
  /**
   * Contrato a mostrar en la ficha: el vigente si existe, sino el último
   * (que estará terminado). El API ya devuelve contratos ordenados con
   * `vigente` primero y luego por `fecha_inicio` desc, así que
   * `contratos[0]` es el más reciente cuando no hay vigente. Esto evita
   * que la pestaña "Contrato vigente" se muestre vacía cuando en
   * realidad hay un contrato terminado con motivo y fecha que el
   * operador necesita ver.
   */
  const contratoMostrado = contratoVigente ?? contratos[0] ?? null

  /**
   * Contratos anteriores (cerrados) que NO son el `contratoMostrado`.
   * Aparecen en el listado al pie de la pestaña "Contrato vigente",
   * dando contexto histórico sin necesidad de saltar a la pestaña
   * "Historial". Ya vienen ordenados por fecha_inicio desc desde el API.
   */
  const contratosAnteriores = contratos.filter(c => c.id !== contratoMostrado?.id)

  // ─── Header data ───
  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : '...'
  const sectorMostrado = contratoMostrado?.sector_id ? sectoresMap.get(contratoMostrado.sector_id) ?? null : null
  // Turno efectivo: usa el del contrato si está, sino hereda del sector.
  const turnoEfectivo = resolverTurnoEfectivo(contratoMostrado)
  const turnoMostrado = turnoEfectivo?.nombre ?? null

  // Spinner full-screen SOLO en la primera carga (cuando aún no
  // tenemos datos del perfil). Las recargas posteriores (renovar
  // contrato, refrescar conceptos, etc.) mantienen el header y las
  // tabs visibles para que el usuario no vea la página parpadear.
  if (primeraCarga && !perfil) {
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
      {/* ─── Header sticky ───
          Se mantiene pegado arriba del área de scroll del módulo
          (`<main>` de PlantillaApp) para que al scrollear dentro de
          una pestaña — Contrato vigente, Conceptos, Liquidaciones — el
          operador siempre vea de qué empleado se trata. El z-index lo
          deja por arriba del contenido de la tab pero por debajo de
          modales y popovers. */}
      <div className="sticky top-0 z-20 border-b border-borde-sutil bg-superficie-app">
        {/* Bloque identidad: respira arriba y abajo para separarlo de
            las migajas (arriba) y de las tabs (abajo). */}
        <div className="px-4 md:px-6 pt-6 pb-5">
          <div className="flex items-center gap-4">
            {/* Foto grande: hero del empleado. Si no hay avatar/foto,
                mostramos iniciales con buen contraste. */}
            <div className="shrink-0 size-16 rounded-full bg-superficie-elevada border border-borde-sutil overflow-hidden flex items-center justify-center text-texto-terciario">
              {perfil.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.avatar_url} alt={nombreCompleto} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-semibold tracking-wide">
                  {(perfil.nombre[0] ?? '?').toUpperCase()}{(perfil.apellido[0] ?? '').toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-texto-primario tracking-tight flex items-center gap-2 flex-wrap leading-tight">
                <span className="truncate">{nombreCompleto}</span>
                {contratoMostrado && !contratoMostrado.vigente && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-insignia-peligro/15 text-insignia-peligro">
                    Contrato terminado
                  </span>
                )}
              </h1>
              {contratoMostrado ? (
                // Metadatos como mini-stats: cada dato tiene su label
                // explícito arriba (uppercase chiquita) y el valor abajo
                // con icono. Esto deja claro qué es cada cosa al primer
                // vistazo (antes "Taller · Taller" era ambiguo).
                //
                // El estimado mensual sale calculado según modalidad y
                // frecuencia, sirve para el operador como referencia
                // rápida del costo del empleado.
                <div className="mt-3 flex items-start gap-6 gap-y-3 flex-wrap">
                  {sectorMostrado && (
                    <MetaEmpleado
                      etiqueta="Sector"
                      icono={<Building2 size={12} />}
                      valor={sectorMostrado}
                    />
                  )}
                  {turnoMostrado && turnoMostrado !== sectorMostrado && (
                    <MetaEmpleado
                      etiqueta="Turno"
                      icono={<Clock size={12} />}
                      valor={turnoMostrado}
                    />
                  )}
                  <MetaEmpleado
                    etiqueta="Modalidad"
                    icono={<Briefcase size={12} />}
                    valor={modalidadCorta(contratoMostrado.modalidad_calculo)}
                  />
                  <MetaEmpleado
                    etiqueta="Sueldo base"
                    valor={
                      <span className="tabular-nums">
                        {formatearMonto(contratoMostrado.monto_base)}{' '}
                        <span className="text-texto-terciario text-xs font-normal">
                          / {frecuenciaCortaCompacta(contratoMostrado.frecuencia_pago)}
                        </span>
                      </span>
                    }
                    destacado
                  />
                  {contratoMostrado.frecuencia_pago !== 'mensual' && (
                    <MetaEmpleado
                      etiqueta="Estimado mensual"
                      valor={
                        <span className="tabular-nums text-texto-marca">
                          ≈ {formatearMonto(estimadoMensual(contratoMostrado.modalidad_calculo, contratoMostrado.monto_base))}
                        </span>
                      }
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-texto-terciario mt-2">Sin contrato laboral cargado</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs: separadas del bloque identidad para que se lean como
            navegación, no como una continuación del subtítulo. */}
        <div className="px-4 md:px-6">
          <Tabs tabs={TABS} activo={tab} onChange={cambiarTab} layoutId="tab-ficha-empleado" sinBorde />
        </div>
      </div>

      {/* ─── Contenido por tab ───
          Patrón keep-alive: una tab solo se monta la primera vez que
          el usuario entra. Después se oculta con `hidden`, no se
          desmonta. Esto evita que cada cambio de tab dispare un re-fetch
          (antes hacíamos remount completo y todos los useEffect se
          volvían a ejecutar). Los datos de la ficha (contratos,
          sectores, etc.) los carga `cargarTodo` en el padre y se
          comparten via props, así que un cambio real de datos sigue
          refrescando todo lo necesario. */}

      {tabsVisitadas.has('contrato') && (
        <div hidden={tab !== 'contrato'}>
          <ContratoVigente
            contrato={contratoMostrado}
            contratosAnteriores={contratosAnteriores}
            sectorNombre={sectorMostrado}
            turnoNombre={turnoMostrado}
            turnoHeredadoDelSector={turnoEfectivo?.heredado ?? false}
            sectoresMap={sectoresMap}
            turnosMap={turnosMap}
            sectorTurnoMap={sectorTurnoMap}
            conceptosVigentes={conceptosVigentes}
            puedeEditar={puedeEditar}
            onNuevoContrato={() => {
              setEditorModoCambio(false)
              setEditorAbierto(true)
            }}
            onCambiarCondiciones={() => {
              setEditorModoCambio(true)
              setEditorAbierto(true)
            }}
            onEditarContrato={() => setModalEditarAbierto(true)}
            onIrAConceptos={() => setTab('conceptos')}
            onContratoActualizado={cargarTodo}
          />
        </div>
      )}

      {tabsVisitadas.has('historial') && (
        <div hidden={tab !== 'historial'}>
          <TimelineContratos
            contratos={contratos}
            sectoresMap={sectoresMap}
            turnosMap={turnosMap}
            sectorTurnoMap={sectorTurnoMap}
          />
        </div>
      )}

      {tabsVisitadas.has('liquidaciones') && (
        <div hidden={tab !== 'liquidaciones'}>
          <SeccionLiquidaciones miembroId={miembroId} />
        </div>
      )}

      {tabsVisitadas.has('adelantos') && (
        <div hidden={tab !== 'adelantos'}>
          <EstadoVacio
            icono={<Wallet size={48} strokeWidth={1.5} />}
            titulo="Adelantos — en construcción"
            descripcion="Pronto vas a poder ver y administrar los adelantos vigentes de este empleado desde acá. Por ahora se gestionan en la liquidación."
          />
        </div>
      )}

      {tabsVisitadas.has('licencias') && (
        <div hidden={tab !== 'licencias'}>
          {contratoVigente ? (
            <SeccionLicencias
              contratoId={contratoVigente.id}
              puedeEditar={puedeEditar}
            />
          ) : (
            <EstadoVacio
              icono={<CalendarOff size={48} strokeWidth={1.5} />}
              titulo="Sin contrato vigente"
              descripcion="Las licencias se registran sobre un contrato. Primero creá un contrato laboral desde la pestaña Contrato vigente."
              accion={puedeEditar ? (
                <Boton icono={<FileText size={14} />} onClick={() => { setTab('contrato'); setEditorAbierto(true) }}>
                  Crear contrato
                </Boton>
              ) : undefined}
            />
          )}
        </div>
      )}

      {tabsVisitadas.has('conceptos') && (
        <div hidden={tab !== 'conceptos'}>
          {contratoVigente ? (
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
          )}
        </div>
      )}

      {/* ─── Modal nuevo contrato / cambiar condiciones ─── */}
      <EditorContrato
        abierto={editorAbierto}
        miembroId={miembroId}
        contratoActual={contratoVigente}
        sectores={sectores}
        turnos={turnos}
        conceptos={conceptosCatalogo}
        conceptosHeredados={conceptosHeredados}
        motivoFinAlCerrar={editorModoCambio ? 'cambio_condiciones' : undefined}
        tituloOverride={editorModoCambio ? 'Cambiar condiciones del contrato' : undefined}
        aviso={editorModoCambio
          ? 'Al guardar, el contrato actual se cerrará el día anterior a la nueva fecha de inicio con motivo "Cambio de condiciones", y se abrirá un contrato nuevo con los datos que cargues acá. El empleado sigue activo.'
          : undefined}
        onCerrar={() => {
          setEditorAbierto(false)
          setEditorModoCambio(false)
        }}
        onCreado={async () => {
          await cargarTodo()
          setEditorModoCambio(false)
          setTab('contrato')
        }}
      />

      {/* ─── Modal editar contrato vigente (corrección sin historial) ─── */}
      {modalEditarAbierto && contratoVigente && (
        <ModalEditarContrato
          contrato={contratoVigente}
          sectores={sectores}
          turnos={turnos}
          onCerrar={() => setModalEditarAbierto(false)}
          onActualizado={async () => {
            setModalEditarAbierto(false)
            await cargarTodo()
          }}
        />
      )}
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
      embed
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

/** Versión compacta de la frecuencia para usar como denominador del
 *  monto: "día", "semana", "quincena", "mes" (sin el "por"). Pensado
 *  para mostrar "$45.000 / quincena" como dato financiero. */
function frecuenciaCortaCompacta(f: string): string {
  const map: Record<string, string> = {
    diaria: 'día',
    semanal: 'semana',
    quincenal: 'quincena',
    mensual: 'mes',
  }
  return map[f] ?? f
}

function formatearMonto(v: number): string {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Estima el sueldo mensual aproximado del contrato según su modalidad,
 * solo para mostrar como referencia en el header del empleado. No es el
 * cálculo "real" de un período (eso lo hace el motor de nóminas con
 * días laborales reales y feriados). Acá usamos ≈ 22 días laborales y
 * 8 hs/día para tener un orden de magnitud rápido.
 */
function estimadoMensual(modalidad: string, monto: number): number {
  const DIAS_LABORALES_MES = 22
  const HORAS_DIA = 8
  switch (modalidad) {
    case 'fijo_mensual':    return monto
    case 'fijo_quincenal':  return monto * 2
    case 'fijo_semanal':    return monto * (30 / 7)
    case 'por_dia':         return monto * DIAS_LABORALES_MES
    case 'por_hora':        return monto * DIAS_LABORALES_MES * HORAS_DIA
    default:                return monto
  }
}

/**
 * Mini-stat para el header del empleado: label uppercase chiquita
 * arriba y valor abajo con icono opcional. El prop `destacado` da más
 * peso visual al sueldo base (texto más grande, color primario).
 */
function MetaEmpleado({
  etiqueta,
  valor,
  icono,
  destacado = false,
}: {
  etiqueta: string
  valor: React.ReactNode
  icono?: React.ReactNode
  destacado?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-texto-terciario mb-1">
        {etiqueta}
      </p>
      <div className={`flex items-center gap-1.5 ${destacado ? 'text-base font-semibold text-texto-primario' : 'text-sm text-texto-secundario'}`}>
        {icono && <span className="text-texto-terciario">{icono}</span>}
        <span className="truncate">{valor}</span>
      </div>
    </div>
  )
}

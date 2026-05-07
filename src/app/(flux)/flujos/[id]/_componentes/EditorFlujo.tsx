'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/componentes/feedback/Toast'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Modal } from '@/componentes/ui/Modal'
import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import { obtenerVersionEditable } from '@/lib/workflows/version-editable'
import { plantillaPorId } from '@/lib/workflows/plantillas-sugeridas'
import { crearAccionVacia, crearDisparadorVacio } from '@/lib/workflows/acciones-vacias'
import { asignarIdsAcciones, darIdAAccion, type AccionConId } from '@/lib/workflows/ids-pasos'
import {
  actualizarPasoPorId,
  eliminarPasoPorId,
} from '@/lib/workflows/mutaciones-pasos'
import HeaderEditorFlujo from './HeaderEditorFlujo'
import BannerEditorFlujo from './BannerEditorFlujo'
import CanvasFlujo from './CanvasFlujo'
import CatalogoPasos from './CatalogoPasos'
import PanelEdicionPaso from './PanelEdicionPaso'
import ConsolaSandbox, { useEsMobile } from './_consola/ConsolaSandbox'
import { useConsolaSandbox } from './_consola/hooks/useConsolaSandbox'
import { usePreviewContexto } from './_picker/usePreviewContexto'
import { useEditorFlujo, type FlujoEditable } from './hooks/useEditorFlujo'
import { useAtajosEditorFlujo } from './hooks/useAtajosEditorFlujo'
import { useValidacionFlujo } from './hooks/useValidacionFlujo'
import type { ErrorValidacion } from '@/lib/workflows/validacion-flujo'
import type {
  AccionWorkflow,
  BodyActualizarFlujo,
  DisparadorWorkflow,
  TipoAccion,
  TipoDisparador,
} from '@/tipos/workflow'

/**
 * Componente raíz cliente del editor visual de flujos (sub-PR 19.2).
 *
 * Composición:
 *   • `useEditorFlujo` mantiene el estado + autoguardado debounce.
 *   • `obtenerVersionEditable` decide qué pintar (publicado vs borrador).
 *   • Asigna IDs estables a los pasos cliente-side para dnd-kit.
 *   • Conecta header + banner + canvas + catálogo + panel placeholder.
 *   • Atajos `Esc` y `Cmd/Ctrl+S` (sin mobile).
 *   • Pre-rellenado desde `?plantilla=<id>` si el flujo está vacío.
 *
 * Decisiones que NO viven acá (delegadas):
 *   • Forma de las cards / dnd-kit               → CanvasFlujo y compañía.
 *   • Layout sticky del header                   → HeaderEditorFlujo.
 *   • Decidir versión publicada vs borrador      → obtenerVersionEditable.
 *   • Texto reactivo del indicador de guardado   → useIndicadorGuardado.
 */

interface Props {
  flujoInicial: FlujoEditable
}

export default function EditorFlujo({ flujoInicial }: Props) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const permisos = flujoInicial.permisos ?? { editar: false, eliminar: false, activar: false }
  const soloLectura = !permisos.editar

  const {
    flujo,
    guardando,
    ultimoGuardado,
    actualizar,
    setearFlujoCompleto,
    flush,
  } = useEditorFlujo({ flujoInicial, soloLectura })

  // ─── Versión a pintar (publicado vs borrador interno) ────────────
  const version = useMemo(() => obtenerVersionEditable(flujo), [flujo])

  // ─── IDs estables cliente-side para dnd-kit ──────────────────────
  // El array `acciones` puede ya tener IDs (si el flujo se editó antes)
  // o no (recién creado o pre-PR 19.2). Hidratamos al montar y
  // re-hidratamos cada vez que el server devuelve un nuevo array.
  const [pasosConId, setPasosConId] = useState<AccionConId[]>(() =>
    asignarIdsAcciones(version.acciones),
  )
  // Evitar re-hidratar mientras el usuario edita: comparamos por
  // identidad del array publicado, no por contenido. Si server devolvió
  // el mismo array (porque el PUT no cambió `acciones`), no rehidratamos.
  const ultimoArrayServerRef = useRef<unknown>(version.acciones)
  useEffect(() => {
    if (version.acciones !== ultimoArrayServerRef.current) {
      ultimoArrayServerRef.current = version.acciones
      setPasosConId(asignarIdsAcciones(version.acciones))
    }
  }, [version.acciones])

  // Estado del intento fallido más reciente (sub-PR 19.4). `null` =
  // ningún error a mostrar (ya sea porque nunca intentaste, o porque
  // editaste algo y el reset agresivo lo borró). Cuando NO es null, el
  // banner rojo aparece y los markers por-paso/disparador se pintan.
  // Declarado acá arriba para que `actualizarFlujo` (debajo) referencie
  // el setter de un binding ya inicializado — orden lógico claro.
  const [intentoFallidoPublicar, setIntentoFallidoPublicar] = useState<
    | { tipo: 'activar' | 'publicar'; errores: ErrorValidacion[] }
    | null
  >(null)
  const mostrarErroresValidacion = intentoFallidoPublicar !== null

  // Wrapper común sobre `actualizar` que aplica el reset agresivo del
  // intento fallido (decisión D4): si el parche toca el modelo lógico
  // que valida-flujo chequea (disparador, acciones, condiciones), los
  // errores anteriores pueden estar obsoletos — los borramos. Edits
  // de metadata (nombre, icono, color, etiqueta) NO resetean.
  const actualizarFlujo = useCallback(
    (parche: Partial<BodyActualizarFlujo>) => {
      if ('disparador' in parche || 'acciones' in parche || 'condiciones' in parche) {
        setIntentoFallidoPublicar(null)
      }
      actualizar(parche)
    },
    [actualizar],
  )

  // Helper para escribir las acciones nuevas: actualiza el state local
  // de pasosConId Y dispara el autoguardado del hook (con IDs incluidos —
  // se persisten para que dnd-kit funcione consistente entre sesiones).
  const escribirAcciones = useCallback(
    (nuevos: AccionConId[]) => {
      setPasosConId(nuevos)
      ultimoArrayServerRef.current = nuevos
      actualizarFlujo({ acciones: nuevos as unknown as AccionWorkflow[] })
    },
    [actualizarFlujo],
  )

  // ─── Selección de paso (panel placeholder) ───────────────────────
  const [seleccion, setSeleccion] = useState<
    | { tipo: 'disparador' }
    | { tipo: 'paso'; id: string }
    | null
  >(null)
  const cerrarPanel = useCallback(() => setSeleccion(null), [])

  // ─── Branches: state controlado de qué rama está expandida (19.4) ─
  // Antes vivía como `useState` local en `TarjetaCondicionBranch`. Lo
  // levantamos al editor para que "Ver errores" pueda expandir la rama
  // ancestral antes de scrollear al paso interno (sino el DOM no monta
  // el hijo y el scroll falla silencioso). Default abierto en ambas
  // ramas — el usuario puede colapsar y se recuerda durante la sesión.
  const [ramasAbiertas, setRamasAbiertas] = useState<
    Record<string, { si: boolean; no: boolean }>
  >({})
  const obtenerRamasAbiertas = useCallback(
    (branchId: string): { si: boolean; no: boolean } =>
      ramasAbiertas[branchId] ?? { si: true, no: true },
    [ramasAbiertas],
  )
  const toggleRama = useCallback((branchId: string, rama: 'si' | 'no') => {
    setRamasAbiertas((prev) => {
      const actual = prev[branchId] ?? { si: true, no: true }
      return { ...prev, [branchId]: { ...actual, [rama]: !actual[rama] } }
    })
  }, [])
  const garantizarRamasAbiertas = useCallback(
    (ids: Array<{ branchId: string; rama: 'si' | 'no' }>) => {
      if (ids.length === 0) return
      setRamasAbiertas((prev) => {
        let cambio = false
        const next = { ...prev }
        for (const { branchId, rama } of ids) {
          const actual = next[branchId] ?? { si: true, no: true }
          if (!actual[rama]) {
            next[branchId] = { ...actual, [rama]: true }
            cambio = true
          }
        }
        return cambio ? next : prev
      })
    },
    [],
  )

  // ─── Validación tiempo real (sub-PR 19.4) ────────────────────────
  // Hook puro: valida `disparador` + `pasosConId` con shape-checks del
  // motor (`validacion-flujo.ts`). Resultado es siempre actual con la
  // edición en curso — pero NO lo usamos para mostrar errores hasta
  // que el usuario intentó publicar/activar (decisión D2 + D3 del
  // scope: nada visible si nunca apretaste el botón).
  const validacion = useValidacionFlujo({
    disparador: version.disparador,
    pasosConId,
  })

  // ─── Catálogo: dispara modal en modo disparador o accion ─────────
  const [catalogo, setCatalogo] = useState<
    | { abierto: false }
    | { abierto: true; modo: 'disparador' }
    | { abierto: true; modo: 'accion'; insertar: AccionInsert }
  >({ abierto: false })
  const cerrarCatalogo = useCallback(() => setCatalogo({ abierto: false }), [])

  // ─── Pre-rellenado desde plantilla (?plantilla=<id>) ─────────────
  // Solo si el flujo está vacío (cero acciones, sin disparador), para
  // no pisar contenido si el usuario entra al editor con un link
  // compartido que tenga el query param accidentalmente.
  const yaProcesoPlantillaRef = useRef(false)
  useEffect(() => {
    if (yaProcesoPlantillaRef.current) return
    const id = searchParams.get('plantilla')
    if (!id) {
      yaProcesoPlantillaRef.current = true
      return
    }
    const versionInicial = obtenerVersionEditable(flujoInicial)
    const accionesIniciales = Array.isArray(versionInicial.acciones)
      ? versionInicial.acciones
      : []
    const sinContenido = accionesIniciales.length === 0 && !versionInicial.disparador
    yaProcesoPlantillaRef.current = true

    if (!sinContenido) return
    const plantilla = plantillaPorId(id)
    if (!plantilla) return

    // Aplicamos el disparador y las acciones de la plantilla. Los IDs
    // los pone `asignarIdsAcciones` al hidratar del array que escribimos.
    const accionesPlantilla = asignarIdsAcciones(plantilla.acciones)
    actualizarFlujo({
      disparador: plantilla.disparador,
      acciones: accionesPlantilla as unknown as AccionWorkflow[],
      // El ícono de la plantilla solo se aplica si el flujo no tenía
      // ícono propio — respeta lo elegido manualmente en otros flujos.
      ...(flujoInicial.icono ? {} : { icono: plantilla.icono }),
    })
    setPasosConId(accionesPlantilla)
    ultimoArrayServerRef.current = accionesPlantilla
    // Limpiar el query param para que un F5 no re-aplique.
    const url = new URL(window.location.href)
    url.searchParams.delete('plantilla')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [searchParams, actualizarFlujo, flujoInicial, router])

  // ─── Inserciones / mutaciones del canvas ─────────────────────────
  type AccionInsert =
    | { rama: 'raiz'; posicion: number }
    | { rama: 'si' | 'no'; branchId: string; posicion: number }

  const insertarAccion = useCallback(
    (tipo: TipoAccion, donde: AccionInsert) => {
      const nueva = darIdAAccion(crearAccionVacia(tipo))
      let nuevos: AccionConId[]
      if (donde.rama === 'raiz') {
        nuevos = [...pasosConId]
        nuevos.splice(donde.posicion, 0, nueva)
      } else {
        nuevos = pasosConId.map((p) => {
          if (p.id !== donde.branchId || p.tipo !== 'condicion_branch') return p
          const arr = [
            ...((donde.rama === 'si' ? p.acciones_si : p.acciones_no) as AccionConId[]),
          ]
          arr.splice(donde.posicion, 0, nueva)
          return {
            ...p,
            ...(donde.rama === 'si'
              ? { acciones_si: arr as unknown as AccionWorkflow[] }
              : { acciones_no: arr as unknown as AccionWorkflow[] }),
          } as AccionConId
        })
      }
      escribirAcciones(nuevos)
      setSeleccion({ tipo: 'paso', id: nueva.id })
    },
    [escribirAcciones, pasosConId],
  )

  const elegirDisparador = useCallback(
    (tipo: TipoDisparador) => {
      actualizarFlujo({ disparador: crearDisparadorVacio(tipo) })
      setSeleccion({ tipo: 'disparador' })
    },
    [actualizarFlujo],
  )

  const reordenarRaiz = useCallback(
    (pasos: AccionConId[]) => escribirAcciones(pasos),
    [escribirAcciones],
  )

  const reordenarRama = useCallback(
    (branchId: string, rama: 'si' | 'no', pasos: AccionConId[]) => {
      const nuevos = pasosConId.map((p) => {
        if (p.id !== branchId || p.tipo !== 'condicion_branch') return p
        return {
          ...p,
          ...(rama === 'si'
            ? { acciones_si: pasos as unknown as AccionWorkflow[] }
            : { acciones_no: pasos as unknown as AccionWorkflow[] }),
        } as AccionConId
      })
      escribirAcciones(nuevos)
    },
    [escribirAcciones, pasosConId],
  )

  // ─── Mutaciones desde el panel lateral (sub-PR 19.3a) ────────────
  // El panel necesita poder editar y eliminar pasos por id desde
  // cualquier profundidad del árbol (raíz o ramas si/no de un branch).
  // Las funciones puras `actualizarPasoPorId` y `eliminarPasoPorId`
  // se encargan de la recursión; acá solo conectamos su resultado al
  // hook de autoguardado vía `escribirAcciones`. Si tras eliminar el
  // paso seleccionado, limpiamos la selección para cerrar el panel
  // automáticamente — coherente con la convención de Notion/Linear.
  const actualizarPaso = useCallback(
    (id: string, parche: Partial<AccionWorkflow>) => {
      escribirAcciones(actualizarPasoPorId(pasosConId, id, parche))
    },
    [escribirAcciones, pasosConId],
  )

  const eliminarPaso = useCallback(
    (id: string) => {
      escribirAcciones(eliminarPasoPorId(pasosConId, id))
      // Si justo eliminamos el paso abierto, cerramos el panel.
      setSeleccion((actual) =>
        actual?.tipo === 'paso' && actual.id === id ? null : actual,
      )
    },
    [escribirAcciones, pasosConId],
  )

  const actualizarDisparador = useCallback(
    (parche: Partial<DisparadorWorkflow>) => {
      // El disparador se patchea entero: reemplazamos `tipo` y
      // `configuracion` con los del parche (las secciones del panel ya
      // arman el shape completo). Si en el futuro agregamos un panel que
      // edite parcialmente sin re-armar el shape, hay que mergear acá.
      actualizarFlujo({ disparador: parche })
    },
    [actualizarFlujo],
  )

  // ─── Acciones del header (endpoints aparte) ──────────────────────
  // `accion` distingue activar/publicar para etiquetar errores en el
  // banner rojo (decisión D7: ambos validan client-side antes de
  // llamar al endpoint, idéntico al backend).
  const ejecutarAccionEstado = useCallback(
    async (
      path: string,
      claveOk: string,
      claveErr: string,
      accion?: 'activar' | 'publicar',
    ) => {
      try {
        await flush() // primero persistimos cualquier edición pendiente
        const res = await fetch(`/api/flujos/${flujo.id}${path}`, { method: 'POST' })
        if (!res.ok) {
          // Si el backend devuelve 422 con `errores: string[]`, lo
          // mostramos en el banner rojo en vez de un toast suelto
          // (decisión D6). Convertimos cada string a `ErrorValidacion`
          // sin pasoId — el backend no sabe los IDs cliente-side, así
          // que esos errores caen al disparador (consistente con la
          // regla de "rama vacía" para arrays vacíos).
          const cuerpo = (await res.json().catch(() => ({}))) as {
            error?: string
            errores?: string[]
          }
          if (res.status === 422 && Array.isArray(cuerpo.errores) && accion) {
            const erroresServer: ErrorValidacion[] = cuerpo.errores.map((m) => ({
              ruta: { tipo: 'disparador' },
              mensaje: m,
            }))
            setIntentoFallidoPublicar({ tipo: accion, errores: erroresServer })
            mostrar('error', cuerpo.error ?? t(claveErr))
            return
          }
          throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
        }
        // Refrescamos la fila completa con un GET para mantener
        // permisos/estado coherentes.
        const resGet = await fetch(`/api/flujos/${flujo.id}`)
        if (resGet.ok) {
          const data = (await resGet.json()) as { flujo: FlujoEditable }
          setearFlujoCompleto(data.flujo)
        }
        // Si hubo intento fallido previo y ahora salió bien, lo limpiamos.
        setIntentoFallidoPublicar(null)
        mostrar('exito', t(claveOk))
      } catch (err) {
        mostrar('error', err instanceof Error ? err.message : t(claveErr))
      }
    },
    [flujo.id, flush, mostrar, setearFlujoCompleto, t],
  )

  /**
   * Wrapper común para Activar/Publicar: valida primero client-side.
   * Si falla, setea `intentoFallidoPublicar` y NO llama al endpoint
   * (evita un round-trip seguro para perderlo). Si pasa, delega al
   * `ejecutarAccionEstado` que también captura errores 422 del backend
   * (defensa en profundidad — race condition con otra sesión, o
   * backend más estricto).
   */
  const intentar = useCallback(
    (
      accion: 'activar' | 'publicar',
      path: string,
      claveOk: string,
      claveErr: string,
    ) => {
      if (!validacion.resultado.ok) {
        setIntentoFallidoPublicar({ tipo: accion, errores: validacion.resultado.errores })
        return
      }
      void ejecutarAccionEstado(path, claveOk, claveErr, accion)
    },
    [ejecutarAccionEstado, validacion.resultado],
  )

  const onActivar = useCallback(
    () => intentar('activar', '/activar', 'flujos.toast.activado', 'flujos.toast.error_activar'),
    [intentar],
  )
  const onPausar = useCallback(
    () => ejecutarAccionEstado('/pausar', 'flujos.toast.pausado', 'flujos.toast.error_pausar'),
    [ejecutarAccionEstado],
  )
  const onPublicar = useCallback(
    () => intentar(
      'publicar',
      '/publicar',
      'flujos.editor.toast.publicado',
      'flujos.editor.toast.error_publicar',
    ),
    [intentar],
  )

  // Confirmaciones para acciones destructivas / no-undo.
  const [confirmandoDescartar, setConfirmandoDescartar] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [cargandoEliminar, setCargandoEliminar] = useState(false)

  const onDescartar = useCallback(
    () => ejecutarAccionEstado(
      '/descartar-borrador',
      'flujos.editor.toast.descartado',
      'flujos.editor.toast.error_descartar',
    ),
    [ejecutarAccionEstado],
  )

  const onEliminarConfirmado = useCallback(async () => {
    setCargandoEliminar(true)
    try {
      const res = await fetch(`/api/flujos/${flujo.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      mostrar('exito', t('flujos.toast.eliminado'))
      router.push('/flujos')
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : t('flujos.toast.error_eliminar'))
    } finally {
      setCargandoEliminar(false)
      setConfirmandoEliminar(false)
    }
  }, [flujo.id, mostrar, router, t])

  // ─── Duplicar ────────────────────────────────────────────────────
  const [duplicandoAbierto, setDuplicandoAbierto] = useState(false)
  const [nombreDuplicado, setNombreDuplicado] = useState('')
  const [cargandoDuplicar, setCargandoDuplicar] = useState(false)
  const abrirDuplicar = useCallback(() => {
    setNombreDuplicado(`${flujo.nombre} ${t('flujos.modal_duplicar.sufijo_copia')}`)
    setDuplicandoAbierto(true)
  }, [flujo.nombre, t])
  const confirmarDuplicar = useCallback(async () => {
    if (!nombreDuplicado.trim()) return
    setCargandoDuplicar(true)
    try {
      const res = await fetch('/api/flujos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreDuplicado.trim(),
          basado_en_flujo_id: flujo.id,
        }),
      })
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { flujo?: { id: string } }
      mostrar('exito', t('flujos.toast.duplicado'))
      setDuplicandoAbierto(false)
      if (data.flujo?.id) router.push(`/flujos/${data.flujo.id}`)
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : t('flujos.toast.error_duplicar'))
    } finally {
      setCargandoDuplicar(false)
    }
  }, [flujo.id, mostrar, nombreDuplicado, router, t])

  // ─── "Ver errores" del banner rojo: scroll + select robusto ──────
  // El usuario aprieta "Ver errores" → seleccionamos el primer paso
  // con error y queremos scrollear hasta él. Pero si el paso está
  // dentro de una rama de branch que está colapsada, el DOM no monta
  // al hijo y `scrollIntoView` falla silencioso. Para resolverlo:
  //   1) Garantizamos que las ramas ancestrales estén abiertas
  //      (state `ramasAbiertas` controlado por nosotros).
  //   2) Marcamos `pendienteScrollA` con la ruta del error.
  //   3) Un `useEffect` reactivo a `pendienteScrollA` + `ramasAbiertas`
  //      busca el DOM por id; si lo encuentra, scrollea + clear. Si no
  //      lo encuentra, espera a que el próximo render lo monte.
  //      Robusto contra animaciones de altura futuras (no asume rAF).
  const [pendienteScrollA, setPendienteScrollA] = useState<
    | { tipo: 'disparador' }
    | { tipo: 'paso'; pasoId: string }
    | null
  >(null)

  // Para scrollear al paso interno de un branch necesitamos saber qué
  // rama lo contiene (para abrir esa rama puntual). Hacemos una
  // búsqueda recursiva ad-hoc — barata, es a lo sumo un puñado de
  // niveles. Devuelve la lista de `{branchId, rama}` ancestrales.
  const buscarAncestros = useCallback(
    (pasoId: string): Array<{ branchId: string; rama: 'si' | 'no' }> => {
      const ancestros: Array<{ branchId: string; rama: 'si' | 'no' }> = []
      const recorrer = (
        lista: AccionConId[],
        camino: Array<{ branchId: string; rama: 'si' | 'no' }>,
      ): boolean => {
        for (const p of lista) {
          if (p.id === pasoId) {
            ancestros.push(...camino)
            return true
          }
          if (p.tipo === 'condicion_branch') {
            const si = (p.acciones_si as AccionConId[] | undefined) ?? []
            if (recorrer(si, [...camino, { branchId: p.id, rama: 'si' }])) return true
            const no = (p.acciones_no as AccionConId[] | undefined) ?? []
            if (recorrer(no, [...camino, { branchId: p.id, rama: 'no' }])) return true
          }
        }
        return false
      }
      recorrer(pasosConId, [])
      return ancestros
    },
    [pasosConId],
  )

  const verErrores = useCallback(() => {
    const primero = validacion.primerError ?? intentoFallidoPublicar?.errores[0] ?? null
    if (!primero) return
    if (primero.ruta.tipo === 'disparador') {
      setSeleccion({ tipo: 'disparador' })
      setPendienteScrollA({ tipo: 'disparador' })
      return
    }
    const pasoId = primero.ruta.pasoId
    // Garantizamos que las ramas ancestrales estén abiertas ANTES de
    // intentar scrollear — el efecto de abajo se va a re-disparar
    // cuando el DOM monte el hijo.
    garantizarRamasAbiertas(buscarAncestros(pasoId))
    setSeleccion({ tipo: 'paso', id: pasoId })
    setPendienteScrollA({ tipo: 'paso', pasoId })
  }, [
    validacion.primerError,
    intentoFallidoPublicar,
    buscarAncestros,
    garantizarRamasAbiertas,
  ])

  // Efecto que ejecuta el scroll cuando el DOM ya tiene montado el
  // target. Reactivo a `pendienteScrollA` y a cualquier cambio de
  // `ramasAbiertas` (el último puede haber montado el hijo necesario).
  useEffect(() => {
    if (!pendienteScrollA) return
    const idDom =
      pendienteScrollA.tipo === 'disparador'
        ? 'flujo-disparador'
        : `flujo-paso-${pendienteScrollA.pasoId}`
    const el = typeof document !== 'undefined' ? document.getElementById(idDom) : null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendienteScrollA(null)
    }
    // Si no encontramos el elemento, no limpiamos `pendienteScrollA`:
    // el próximo render (tras montar el hijo o expandir la rama) re-
    // dispara el efecto y vuelve a intentar.
  }, [pendienteScrollA, ramasAbiertas, pasosConId])

  // ─── Sandbox / consola de prueba (sub-PR 19.5) ───────────────────
  // Estado abierto/tab persistido en localStorage. Al abrirla cerramos
  // el panel de paso para no apilar dos paneles que compiten por la
  // atención del usuario.
  const consola = useConsolaSandbox()
  const enMobile = useEsMobile()
  const tipoDisparadorActual = (() => {
    const d = version.disparador
    if (d && typeof d === 'object' && 'tipo' in d && typeof (d as { tipo?: unknown }).tipo === 'string') {
      return (d as { tipo: string }).tipo
    }
    return null
  })()
  // Reusamos exactamente el hook del PickerVariables: mismo endpoint
  // `/preview-contexto`, mismo cache, mismo abort. La consola y el
  // picker comparten contexto.
  const { contexto: contextoPreview } = usePreviewContexto({
    flujoId: flujo.id,
    tipoDisparador: tipoDisparadorActual,
  })
  const eventoSimuladoConsola = (() => {
    const ent = contextoPreview.entidad as
      | { tipo?: string; id?: string; titulo?: string; nombre?: string }
      | null
      | undefined
    if (!ent || typeof ent !== 'object' || !ent.id) return null
    return {
      tipo_entidad: ent.tipo ?? null,
      resumen:
        (typeof ent.titulo === 'string' && ent.titulo) ||
        (typeof ent.nombre === 'string' && ent.nombre) ||
        ent.id,
    }
  })()

  // ─── Atajos ───────────────────────────────────────────────────────
  useAtajosEditorFlujo({
    panelAbierto: seleccion !== null,
    consolaAbierta: consola.abierta,
    onCerrarPanel: cerrarPanel,
    onCerrarConsola: consola.cerrar,
    onVolver: () => router.push('/flujos'),
    onForzarGuardar: () => {
      void flush()
      mostrar('exito', t('flujos.editor.toast.guardado_manual'))
    },
  })

  // ─── Probar / Historial ──────────────────────────────────────────
  // 19.5: "Probar" abre la consola de prueba (panel inferior). Si el
  // panel de paso está abierto, lo cerramos primero — el usuario no
  // puede tener panel + consola al mismo tiempo (apila visualmente).
  const onProbar = useCallback(() => {
    setSeleccion(null)
    consola.abrir()
  }, [consola])
  // Historial sigue no-op hasta el sub-PR 19.6.
  const onHistorial = useCallback(() => {
    mostrar('info', t('flujos.editor.toast.proximamente_historial'))
  }, [mostrar, t])

  // ─── Banner contextual ───────────────────────────────────────────
  // Prioridad (consistente con el comentario de cabecera de
  // `BannerEditorFlujo`): error > lectura > borrador.
  const banner = useMemo<'borrador' | 'lectura' | 'error' | null>(() => {
    if (intentoFallidoPublicar) return 'error'
    if (soloLectura) return 'lectura'
    if (version.esBorradorInterno) return 'borrador'
    return null
  }, [intentoFallidoPublicar, soloLectura, version.esBorradorInterno])

  // ─── Datos derivados para CanvasFlujo ────────────────────────────
  const disparadorRaw =
    version.disparador && typeof version.disparador === 'object'
      ? (version.disparador as { tipo?: TipoDisparador; configuracion?: Record<string, unknown> })
      : null

  return (
    <div className="relative flex flex-col h-full min-h-[calc(100dvh-var(--header-alto))]">
      <HeaderEditorFlujo
        flujo={flujo}
        esBorradorInterno={version.esBorradorInterno}
        guardando={guardando}
        ultimoGuardado={ultimoGuardado}
        soloLectura={soloLectura}
        onCambiarNombre={(nuevo) => actualizar({ nombre: nuevo })}
        onCambiarIcono={(nuevo) => actualizar({ icono: nuevo })}
        onActivar={onActivar}
        onPausar={onPausar}
        onPublicar={onPublicar}
        onDescartarBorrador={() => setConfirmandoDescartar(true)}
        onDuplicar={abrirDuplicar}
        onEliminar={() => setConfirmandoEliminar(true)}
        onProbar={onProbar}
        onHistorial={onHistorial}
      />

      {banner === 'error' && intentoFallidoPublicar ? (
        <BannerEditorFlujo
          tipo="error"
          titulo={t(
            intentoFallidoPublicar.tipo === 'activar'
              ? 'flujos.editor.validacion.titulo_activar'
              : 'flujos.editor.validacion.titulo_publicar',
          )}
          descripcion={t('flujos.editor.validacion.descripcion').replace(
            '{{n}}',
            String(intentoFallidoPublicar.errores.length),
          )}
          errores={intentoFallidoPublicar.errores.map((e) => e.mensaje)}
          accion={{
            etiqueta: t('flujos.editor.validacion.cta_ver_errores'),
            onClick: verErrores,
          }}
        />
      ) : (
        banner && <BannerEditorFlujo tipo={banner} />
      )}

      <div className="flex-1 flex min-h-0">
        <CanvasFlujo
          disparador={disparadorRaw}
          pasosRaiz={pasosConId}
          pasoSeleccionadoId={seleccion?.tipo === 'paso' ? seleccion.id : null}
          disparadorSeleccionado={seleccion?.tipo === 'disparador'}
          soloLectura={soloLectura}
          iconoCustom={flujo.icono}
          onSeleccionarDisparador={() => setSeleccion({ tipo: 'disparador' })}
          onSeleccionarPaso={(id) => setSeleccion({ tipo: 'paso', id })}
          onElegirDisparador={() => setCatalogo({ abierto: true, modo: 'disparador' })}
          onReordenarRaiz={reordenarRaiz}
          onAgregarRaiz={(pos) =>
            setCatalogo({ abierto: true, modo: 'accion', insertar: { rama: 'raiz', posicion: pos } })
          }
          onAgregarEnRama={(branchId, rama, pos) =>
            setCatalogo({
              abierto: true,
              modo: 'accion',
              insertar: { rama, branchId, posicion: pos },
            })
          }
          onReordenarRama={reordenarRama}
          // ─── Validación (sub-PR 19.4) ──────────────────────────────
          mostrarErrores={mostrarErroresValidacion}
          errorDisparador={validacion.errorDisparador}
          erroresPorPaso={validacion.erroresPorPaso}
          // ─── Branches controladas (sub-PR 19.4) ────────────────────
          obtenerRamasAbiertas={obtenerRamasAbiertas}
          onToggleRama={toggleRama}
        />

        {/* Panel real con campos editables — slide-in cuando hay selección */}
        <PanelEdicionPaso
          flujoId={flujo.id}
          abierto={seleccion !== null}
          onCerrar={cerrarPanel}
          seleccion={seleccion}
          disparador={disparadorRaw}
          pasosRaiz={pasosConId}
          soloLectura={soloLectura}
          onActualizarPaso={actualizarPaso}
          onEliminarPaso={eliminarPaso}
          onActualizarDisparador={actualizarDisparador}
        />
      </div>

      {/* Consola de prueba — sub-PR 19.5. Posicionada absolute dentro del
          contenedor relativo padre para flotar arriba del canvas sin
          tapar el header. En mobile renderiza como BottomSheet (D5). */}
      <ConsolaSandbox
        abierta={consola.abierta}
        flujoId={flujo.id}
        acciones={pasosConId}
        contexto={contextoPreview}
        tab={consola.tab}
        onCambiarTab={consola.cambiarTab}
        onCerrar={consola.cerrar}
        flush={flush}
        eventoSimulado={eventoSimuladoConsola}
        enMobile={enMobile}
      />

      {/* Modal del catálogo (modos disparador y acción) */}
      {catalogo.abierto && catalogo.modo === 'disparador' && (
        <CatalogoPasos
          abierto
          modo="disparador"
          onCerrar={cerrarCatalogo}
          onElegirDisparador={(tipo) => {
            elegirDisparador(tipo)
            cerrarCatalogo()
          }}
        />
      )}
      {catalogo.abierto && catalogo.modo === 'accion' && (
        <CatalogoPasos
          abierto
          modo="accion"
          onCerrar={cerrarCatalogo}
          onElegirAccion={(tipo) => {
            insertarAccion(tipo, catalogo.insertar)
            cerrarCatalogo()
          }}
        />
      )}

      {/* Confirmación: descartar borrador (irreversible) */}
      <ModalConfirmacion
        abierto={confirmandoDescartar}
        onCerrar={() => setConfirmandoDescartar(false)}
        onConfirmar={() => {
          setConfirmandoDescartar(false)
          void onDescartar()
        }}
        titulo={t('flujos.editor.confirmar_descartar.titulo')}
        descripcion={t('flujos.editor.confirmar_descartar.descripcion')}
        tipo="advertencia"
        etiquetaConfirmar={t('flujos.editor.confirmar_descartar.confirmar')}
      />

      {/* Confirmación: eliminar flujo (irreversible) */}
      <ModalConfirmacion
        abierto={confirmandoEliminar}
        onCerrar={() => setConfirmandoEliminar(false)}
        onConfirmar={() => void onEliminarConfirmado()}
        titulo={t('flujos.confirmar_eliminar.titulo')}
        descripcion={t('flujos.confirmar_eliminar.descripcion')}
        tipo="peligro"
        etiquetaConfirmar={t('flujos.confirmar_eliminar.confirmar')}
        cargando={cargandoEliminar}
      />

      {/* Modal duplicar — input mínimo con sufijo "(copia)" */}
      <Modal
        abierto={duplicandoAbierto}
        onCerrar={() => setDuplicandoAbierto(false)}
        titulo={t('flujos.modal_duplicar.titulo')}
        tamano="md"
        accionPrimaria={{
          etiqueta: t('flujos.modal_duplicar.confirmar'),
          onClick: () => void confirmarDuplicar(),
          cargando: cargandoDuplicar,
          disabled: !nombreDuplicado.trim(),
        }}
        accionSecundaria={{
          etiqueta: t('comun.cancelar'),
          onClick: () => setDuplicandoAbierto(false),
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto-terciario">{t('flujos.modal_duplicar.descripcion')}</p>
          <Input
            etiqueta={t('flujos.modal_duplicar.nombre_label')}
            value={nombreDuplicado}
            onChange={(e) => setNombreDuplicado(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  )
}


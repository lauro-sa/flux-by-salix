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
import { useEditorFlujo, type FlujoEditable } from './hooks/useEditorFlujo'
import { useAtajosEditorFlujo } from './hooks/useAtajosEditorFlujo'
import type {
  AccionWorkflow,
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

  // Helper para escribir las acciones nuevas: actualiza el state local
  // de pasosConId Y dispara el autoguardado del hook (con IDs incluidos —
  // se persisten para que dnd-kit funcione consistente entre sesiones).
  const escribirAcciones = useCallback(
    (nuevos: AccionConId[]) => {
      setPasosConId(nuevos)
      ultimoArrayServerRef.current = nuevos
      actualizar({ acciones: nuevos as unknown as AccionWorkflow[] })
    },
    [actualizar],
  )

  // ─── Selección de paso (panel placeholder) ───────────────────────
  const [seleccion, setSeleccion] = useState<
    | { tipo: 'disparador' }
    | { tipo: 'paso'; id: string }
    | null
  >(null)
  const cerrarPanel = useCallback(() => setSeleccion(null), [])

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
    actualizar({
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
  }, [searchParams, actualizar, flujoInicial, router])

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
      actualizar({ disparador: crearDisparadorVacio(tipo) })
      setSeleccion({ tipo: 'disparador' })
    },
    [actualizar],
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
      actualizar({ disparador: parche })
    },
    [actualizar],
  )

  // ─── Acciones del header (endpoints aparte) ──────────────────────
  const ejecutarAccionEstado = useCallback(
    async (path: string, claveOk: string, claveErr: string) => {
      try {
        await flush() // primero persistimos cualquier edición pendiente
        const res = await fetch(`/api/flujos/${flujo.id}${path}`, { method: 'POST' })
        if (!res.ok) {
          const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
        }
        // Refrescamos la fila completa con un GET para mantener
        // permisos/estado coherentes.
        const resGet = await fetch(`/api/flujos/${flujo.id}`)
        if (resGet.ok) {
          const data = (await resGet.json()) as { flujo: FlujoEditable }
          setearFlujoCompleto(data.flujo)
        }
        mostrar('exito', t(claveOk))
      } catch (err) {
        mostrar('error', err instanceof Error ? err.message : t(claveErr))
      }
    },
    [flujo.id, flush, mostrar, setearFlujoCompleto, t],
  )

  const onActivar = useCallback(
    () => ejecutarAccionEstado('/activar', 'flujos.toast.activado', 'flujos.toast.error_activar'),
    [ejecutarAccionEstado],
  )
  const onPausar = useCallback(
    () => ejecutarAccionEstado('/pausar', 'flujos.toast.pausado', 'flujos.toast.error_pausar'),
    [ejecutarAccionEstado],
  )
  const onPublicar = useCallback(
    () => ejecutarAccionEstado(
      '/publicar',
      'flujos.editor.toast.publicado',
      'flujos.editor.toast.error_publicar',
    ),
    [ejecutarAccionEstado],
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

  // ─── Atajos ───────────────────────────────────────────────────────
  useAtajosEditorFlujo({
    panelAbierto: seleccion !== null,
    onCerrarPanel: cerrarPanel,
    onVolver: () => router.push('/flujos'),
    onForzarGuardar: () => {
      void flush()
      mostrar('exito', t('flujos.editor.toast.guardado_manual'))
    },
  })

  // ─── Probar / Historial: visuales no-op en 19.2 ──────────────────
  const onProbar = useCallback(() => {
    mostrar('info', t('flujos.editor.toast.proximamente_probar'))
  }, [mostrar, t])
  const onHistorial = useCallback(() => {
    mostrar('info', t('flujos.editor.toast.proximamente_historial'))
  }, [mostrar, t])

  // ─── Banner contextual ───────────────────────────────────────────
  const banner = useMemo<'borrador' | 'lectura' | 'error' | null>(() => {
    if (soloLectura) return 'lectura'
    if (version.esBorradorInterno) return 'borrador'
    return null
  }, [soloLectura, version.esBorradorInterno])

  // ─── Datos derivados para CanvasFlujo ────────────────────────────
  const disparadorRaw =
    version.disparador && typeof version.disparador === 'object'
      ? (version.disparador as { tipo?: TipoDisparador; configuracion?: Record<string, unknown> })
      : null

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-var(--header-alto))]">
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

      {banner && <BannerEditorFlujo tipo={banner} />}

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
        />

        {/* Panel real con campos editables — slide-in cuando hay selección */}
        <PanelEdicionPaso
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


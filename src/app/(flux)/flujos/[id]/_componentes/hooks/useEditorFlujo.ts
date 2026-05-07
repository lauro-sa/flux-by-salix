'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/componentes/feedback/Toast'
import { useTraduccion } from '@/lib/i18n'
import type { BodyActualizarFlujo, Flujo } from '@/tipos/workflow'

/**
 * Hook central del editor visual de flujos (sub-PR 19.2).
 *
 * Responsabilidades:
 *   • Mantener el estado local del flujo (mutaciones inline desde la UI).
 *   • Diff por campo: solo manda al PUT lo que cambió desde el último
 *     guardado exitoso (ahorra ancho de banda y reduce el ruido en
 *     `auditoria_flujos` — el handler ya filtra, pero el cliente
 *     amplifica esa señal mandando solo los campos modificados).
 *   • Autoguardado debounce 500 ms (consistente con `feedback_autoguardado.md`).
 *   • Indicador de guardado: `guardando` boolean + `ultimoGuardado` timestamp.
 *   • `flush()` fuerza el PUT inmediato (`Cmd/Ctrl+S`).
 *
 * NO se encarga de:
 *   • Decidir qué versión pintar (eso es `obtenerVersionEditable`).
 *   • Activar/Pausar/Publicar/Descartar — esos son endpoints aparte que
 *     el header llama directo y al volver invalida `flujo` haciendo
 *     `setearFlujoCompleto`.
 *
 * Consideraciones técnicas:
 *   • Usamos `useRef` para los pending fields y el timer para evitar
 *     re-renders innecesarios — solo mutamos el state cuando llega
 *     respuesta del servidor o cuando cambia el indicador de guardado.
 *   • El backend devuelve la fila actualizada — la mergeamos sobre el
 *     estado local solo para los campos pendientes, así no pisamos
 *     ediciones que ocurrieron mientras el PUT estaba en vuelo
 *     (last-write-wins por campo).
 */

export type FlujoEditable = Flujo & {
  permisos?: { editar: boolean; eliminar: boolean; activar: boolean }
}

/** Campos que se pueden mandar al PUT — espejo del `BodyActualizarFlujo`. */
type CampoEditable = keyof BodyActualizarFlujo

const TODOS_LOS_CAMPOS: readonly CampoEditable[] = [
  'nombre',
  'descripcion',
  'disparador',
  'condiciones',
  'acciones',
  'nodos_json',
  'icono',
  'color',
] as const

const DEBOUNCE_MS = 500

export interface UseEditorFlujoOpts {
  /** Estado inicial — viene del server component vía props del editor. */
  flujoInicial: FlujoEditable
  /** Si está en true, el hook nunca dispara PUTs (modo solo lectura). */
  soloLectura?: boolean
}

export interface UseEditorFlujoReturn {
  flujo: FlujoEditable
  /**
   * Hay cambios locales que aún no se pushearon al backend (se van a
   * pushear al vencer el debounce o al `flush()`).
   */
  dirty: boolean
  /** Hay un PUT en vuelo. */
  guardando: boolean
  /** Timestamp del último guardado exitoso (ms epoch). null si aún no se guardó. */
  ultimoGuardado: number | null
  /**
   * Aplica un parche al estado local. Solo las claves presentes se
   * marcan como pendientes para el próximo PUT.
   *
   *   actualizar({ nombre: 'X' })
   *   actualizar({ acciones: [...nuevasAcciones] })
   */
  actualizar: (parche: Partial<BodyActualizarFlujo>) => void
  /**
   * Reemplaza completamente el estado local con el flujo recién
   * traído del server (post-publicar/descartar/etc.). Limpia pendientes.
   */
  setearFlujoCompleto: (nuevo: FlujoEditable) => void
  /**
   * Fuerza el PUT inmediato si hay cambios pendientes. Devuelve una
   * promesa que resuelve cuando el guardado terminó (éxito o error).
   */
  flush: () => Promise<void>
}

export function useEditorFlujo({
  flujoInicial,
  soloLectura = false,
}: UseEditorFlujoOpts): UseEditorFlujoReturn {
  const { mostrar } = useToast()
  const { t } = useTraduccion()

  const [flujo, setFlujo] = useState<FlujoEditable>(flujoInicial)
  const [guardando, setGuardando] = useState(false)
  const [ultimoGuardado, setUltimoGuardado] = useState<number | null>(null)

  // Refs para no disparar re-renders en cada keystroke.
  const pendientesRef = useRef<Set<CampoEditable>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flujoRef = useRef<FlujoEditable>(flujoInicial)

  // Mantener el ref sincronizado con el state — sin esto, el flush
  // del setTimeout lee un snapshot stale del flujo.
  useEffect(() => {
    flujoRef.current = flujo
  }, [flujo])

  const limpiarTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  /**
   * Lee del estado local los campos marcados como pendientes y arma
   * el body del PUT. Si no hay pendientes, devuelve null (no hace PUT).
   */
  const armarBodyPut = useCallback((): BodyActualizarFlujo | null => {
    if (pendientesRef.current.size === 0) return null
    const body: Record<string, unknown> = {}
    const f = flujoRef.current
    for (const campo of pendientesRef.current) {
      // Para cada campo conocido del body, leemos del flujo. Algunos
      // como `nombre` son strings; otros (`acciones`) son jsonb.
      switch (campo) {
        case 'nombre':
          body.nombre = f.nombre
          break
        case 'descripcion':
          body.descripcion = f.descripcion
          break
        case 'disparador':
          body.disparador = f.disparador
          break
        case 'condiciones':
          body.condiciones = f.condiciones
          break
        case 'acciones':
          body.acciones = f.acciones
          break
        case 'nodos_json':
          body.nodos_json = f.nodos_json
          break
        case 'icono':
          body.icono = f.icono
          break
        case 'color':
          body.color = f.color
          break
      }
    }
    return body as BodyActualizarFlujo
  }, [])

  const ejecutarPut = useCallback(async (): Promise<void> => {
    if (soloLectura) {
      pendientesRef.current.clear()
      return
    }
    const body = armarBodyPut()
    if (!body) return
    // Snapshot de los campos que estamos guardando — si el usuario
    // edita más mientras el PUT está en vuelo, esos cambios quedan
    // en pendientes y se mandan en el próximo flush.
    const camposEnVuelo = new Set(pendientesRef.current)
    pendientesRef.current.clear()

    setGuardando(true)
    try {
      const res = await fetch(`/api/flujos/${flujoRef.current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { flujo: FlujoEditable }
      // Mergear: para los campos en vuelo tomamos lo del server (incluye
      // editado_por, actualizado_en, etc.), para el resto preservamos
      // ediciones locales que ocurrieron post-snapshot.
      setFlujo((actual) => {
        const merged: FlujoEditable = { ...actual }
        const mergedRec = merged as unknown as Record<string, unknown>
        const serverRec = data.flujo as unknown as Record<string, unknown>
        for (const campo of camposEnVuelo) {
          mergedRec[campo] = serverRec[campo]
        }
        // Metadata de auditoría siempre se actualiza (no la edita el usuario).
        merged.editado_por = data.flujo.editado_por
        merged.editado_por_nombre = data.flujo.editado_por_nombre
        merged.actualizado_en = data.flujo.actualizado_en
        // El borrador_jsonb es derivado del PUT en backend — lo refrescamos.
        merged.borrador_jsonb = data.flujo.borrador_jsonb
        return merged
      })
      setUltimoGuardado(Date.now())
    } catch (err) {
      // Si falla, las pendientes que estaban en vuelo vuelven al set
      // para reintentar en el próximo flush. El toast informa al
      // usuario que hay un problema.
      for (const campo of camposEnVuelo) {
        pendientesRef.current.add(campo)
      }
      mostrar('error', err instanceof Error ? err.message : t('flujos.editor.toast.error_guardar'))
    } finally {
      setGuardando(false)
    }
  }, [armarBodyPut, mostrar, soloLectura, t])

  const programarFlush = useCallback(() => {
    if (soloLectura) return
    limpiarTimer()
    timerRef.current = setTimeout(() => {
      void ejecutarPut()
    }, DEBOUNCE_MS)
  }, [ejecutarPut, soloLectura])

  const actualizar = useCallback(
    (parche: Partial<BodyActualizarFlujo>) => {
      if (soloLectura) return
      // Aplicar al state local + marcar pendientes.
      setFlujo((prev) => ({ ...prev, ...parche } as FlujoEditable))
      for (const k of Object.keys(parche) as CampoEditable[]) {
        if (TODOS_LOS_CAMPOS.includes(k)) {
          pendientesRef.current.add(k)
        }
      }
      programarFlush()
    },
    [programarFlush, soloLectura],
  )

  const setearFlujoCompleto = useCallback((nuevo: FlujoEditable) => {
    limpiarTimer()
    pendientesRef.current.clear()
    setFlujo(nuevo)
    setUltimoGuardado(Date.now())
  }, [])

  const flush = useCallback(async () => {
    limpiarTimer()
    await ejecutarPut()
  }, [ejecutarPut])

  // Cleanup: si el componente se desmonta con cambios pendientes,
  // intentamos un last-best-effort flush sincronizado vía
  // `navigator.sendBeacon` queda fuera de scope (la fetch async
  // alcanza para 99% de los casos). Solo limpiamos el timer.
  useEffect(() => {
    return () => limpiarTimer()
  }, [])

  return {
    flujo,
    dirty: pendientesRef.current.size > 0,
    guardando,
    ultimoGuardado,
    actualizar,
    setearFlujoCompleto,
    flush,
  }
}

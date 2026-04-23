'use client'

/**
 * TelefonosContacto — Lista editable de teléfonos del contacto.
 *
 * Modelo simplificado:
 *   - Tipo del teléfono: Móvil / Fijo / Trabajo / Casa / Otro.
 *   - es_whatsapp se DERIVA del tipo: 'movil' → true, el resto → false.
 *     Sigue la convención AR de que casi todos los móviles tienen WhatsApp.
 *     Si en el futuro hay que distinguir "móvil sin WhatsApp", se vuelve a separar el flag.
 *   - El ícono a la izquierda refleja el tipo: WhatsApp para móvil, Phone para fijo,
 *     Briefcase para trabajo, Home para casa, Phone para otro.
 *
 * Persistencia:
 *   - flux:telefono:ultimo_tipo — último tipo que el usuario eligió, para que el siguiente
 *     teléfono herede ese default y la carga sea más rápida.
 */

import { useCallback, useEffect, useState, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Star, X, Phone, Briefcase, Home as HomeIcon } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { normalizarTelefono, formatearTelefonoInternacional } from '@/lib/validaciones'
import type { TelefonoNormalizado, TipoTelefono } from '@/lib/contacto-telefonos'

const TIPOS_OPCIONES: Array<{ valor: TipoTelefono; etiqueta: string }> = [
  { valor: 'movil', etiqueta: 'Móvil' },
  { valor: 'fijo', etiqueta: 'Fijo' },
  { valor: 'trabajo', etiqueta: 'Trabajo' },
  { valor: 'casa', etiqueta: 'Casa' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/** Garantiza que el tipo recibido sea uno válido; cae a 'movil' si no. */
function tipoValido(tipo: string): TipoTelefono {
  return (TIPOS_OPCIONES.some(o => o.valor === tipo) ? tipo : 'movil') as TipoTelefono
}

/** Regla simple: solo los móviles se asumen como WhatsApp. */
function esWhatsAppPorTipo(tipo: string): boolean {
  return tipo === 'movil'
}

const KEY_ULTIMO_TIPO = 'flux:telefono:ultimo_tipo'

interface TelefonoUI {
  id: string
  tipo: TipoTelefono
  valor: string
  es_principal: boolean
  etiqueta: string | null
  orden: number
}

interface Props {
  telefonos: TelefonoNormalizado[]
  onChange: (telefonos: TelefonoNormalizado[]) => void
  permitirVacio?: boolean
}

/** Ícono que representa el tipo. Móvil siempre se muestra como WhatsApp. */
function iconoParaTipo(tipo: TipoTelefono) {
  switch (tipo) {
    case 'movil': return <IconoWhatsApp size={14} />
    case 'fijo': return <Phone size={14} />
    case 'trabajo': return <Briefcase size={14} />
    case 'casa': return <HomeIcon size={14} />
    default: return <Phone size={14} />
  }
}

function colorIconoTipo(tipo: TipoTelefono): string {
  // Móvil → color marca (representa WhatsApp). Resto → color terciario.
  return tipo === 'movil' ? 'text-texto-marca' : 'text-texto-terciario'
}

function leerUltimoTipo(): TipoTelefono {
  if (typeof window === 'undefined') return 'movil'
  const v = window.localStorage.getItem(KEY_ULTIMO_TIPO) as TipoTelefono | null
  if (v && TIPOS_OPCIONES.some(o => o.valor === v)) return v
  return 'movil'
}

function guardarUltimoTipo(tipo: string) {
  if (typeof window === 'undefined') return
  if (TIPOS_OPCIONES.some(o => o.valor === tipo)) {
    window.localStorage.setItem(KEY_ULTIMO_TIPO, tipo)
  }
}

export function TelefonosContacto({ telefonos, onChange, permitirVacio }: Props) {
  const reactId = useId()
  const [items, setItems] = useState<TelefonoUI[]>(() =>
    telefonos.map((t, i) => ({
      id: `${reactId}-${i}-${t.valor}`,
      tipo: tipoValido(t.tipo),
      valor: t.valor,
      es_principal: t.es_principal,
      etiqueta: t.etiqueta,
      orden: t.orden,
    }))
  )

  // ID del item cuyo input debe recibir foco tras agregar. Se limpia al primer focus
  // para que sucesivos re-renders no re-enfoquen.
  const [autofocusId, setAutofocusId] = useState<string | null>(null)

  // ID del item actualmente enfocado. Los demás se muestran con formato internacional
  // ("+54 9 11 5602-9403"). El enfocado muestra el valor raw ("5491156029403") para edición.
  const [itemEnfocadoId, setItemEnfocadoId] = useState<string | null>(null)

  // Sincronizar items cuando cambian los telefonos desde afuera (re-fetch del contacto, etc).
  // CRUCIAL: preservar los items locales con valor vacío (recién agregados, sin propagar).
  // Si los pisamos, el botón "+ Agregar" parece no funcionar porque el item nuevo desaparece
  // en el siguiente re-render del padre.
  useEffect(() => {
    const itemsConValor = items.filter(t => t.valor.trim() !== '')
    const itemsActuales = itemsConValor.map(t => `${t.valor}|${t.es_principal ? 1 : 0}`).join(',')
    const itemsNuevos = telefonos.map(t => `${t.valor}|${t.es_principal ? 1 : 0}`).join(',')
    if (itemsActuales !== itemsNuevos) {
      const desdePadre: TelefonoUI[] = telefonos.map((t, i) => ({
        id: `${reactId}-ext-${i}-${t.valor}`,
        tipo: tipoValido(t.tipo),
        valor: t.valor,
        es_principal: t.es_principal,
        etiqueta: t.etiqueta,
        orden: t.orden,
      }))
      // Conservar items locales sin valor (formularios pendientes de input del usuario).
      const localesVacios = items.filter(t => t.valor.trim() === '')
      setItems([...desdePadre, ...localesVacios])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefonos])

  /**
   * Notificar al padre la lista normalizada y deduplicada.
   * Deriva es_whatsapp del tipo. Garantiza un solo principal.
   */
  const propagar = useCallback((nuevos: TelefonoUI[]) => {
    const normalizados: TelefonoNormalizado[] = []
    let principalEncontrado = false
    for (const t of nuevos) {
      const valorNorm = normalizarTelefono(t.valor)
      if (!valorNorm) continue
      const esPrincipal = t.es_principal && !principalEncontrado
      if (esPrincipal) principalEncontrado = true
      normalizados.push({
        tipo: t.tipo,
        valor: valorNorm,
        es_whatsapp: esWhatsAppPorTipo(t.tipo),
        es_principal: esPrincipal,
        etiqueta: t.etiqueta,
        orden: t.orden,
      })
    }
    if (normalizados.length > 0 && !principalEncontrado) {
      normalizados[0].es_principal = true
    }
    onChange(normalizados)
  }, [onChange])

  const agregar = useCallback(() => {
    const ultimoTipo = leerUltimoTipo()
    const ningunoPrincipal = items.length === 0
    const nuevo: TelefonoUI = {
      id: `${reactId}-${Date.now()}`,
      tipo: ultimoTipo,
      valor: '',
      es_principal: ningunoPrincipal,
      etiqueta: null,
      orden: items.length,
    }
    setItems(prev => [...prev, nuevo])
    // Autofocus: el próximo render dará foco al input del item recién agregado.
    setAutofocusId(nuevo.id)
    // No propagamos al padre con valor vacío — el item se conserva en estado local
    // hasta que el usuario tipee algo. El useEffect de sincronización lo respeta.
  }, [items.length, reactId])

  // Patrón: calculamos el nuevo state desde `items` (no desde el updater de setItems).
  // Esto permite llamar a `propagar()` (que dispara setState del padre) DESPUÉS de setItems,
  // fuera de la fase de render. Hacerlo dentro del updater dispara el warning
  // "Cannot update a component while rendering a different component".
  const eliminar = useCallback((id: string) => {
    const nuevos = items.filter(t => t.id !== id)
    if (nuevos.length > 0 && !nuevos.some(t => t.es_principal)) {
      nuevos[0].es_principal = true
    }
    setItems(nuevos)
    propagar(nuevos)
  }, [items, propagar])

  const cambiarValor = useCallback((id: string, valor: string) => {
    setItems(prev => prev.map(t => t.id === id ? { ...t, valor } : t))
  }, [])

  const blurValor = useCallback((id: string) => {
    propagar(items.map(t => t.id === id ? { ...t } : t))
  }, [items, propagar])

  const cambiarTipo = useCallback((id: string, tipo: string) => {
    guardarUltimoTipo(tipo)
    const nuevos = items.map(t => t.id === id ? { ...t, tipo: tipoValido(tipo) } : t)
    setItems(nuevos)
    propagar(nuevos)
  }, [items, propagar])

  const marcarPrincipal = useCallback((id: string) => {
    const nuevos = items.map(t => ({ ...t, es_principal: t.id === id }))
    setItems(nuevos)
    propagar(nuevos)
  }, [items, propagar])

  const tieneItems = items.length > 0
  const mostrarVacio = !tieneItems && !permitirVacio

  return (
    <div className="space-y-2">
      {/* Header: título + botón agregar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-texto-primario">Teléfonos</h3>
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo="Agregar teléfono"
          icono={<Plus size={14} />}
          onClick={agregar}
          redondeado
        />
      </div>

      {/* Estado vacío */}
      {mostrarVacio && (
        <button
          onClick={agregar}
          className="w-full text-left text-sm text-texto-terciario hover:text-texto-secundario py-1.5 px-1 rounded transition-colors"
        >
          + Agregar teléfono
        </button>
      )}

      {/* Lista de teléfonos */}
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 group">
              {/* Ícono del tipo (decorativo, refleja el tipo seleccionado abajo) */}
              <div className={`shrink-0 inline-flex items-center justify-center w-7 h-7 ${colorIconoTipo(t.tipo)}`}>
                {iconoParaTipo(t.tipo)}
              </div>

              {/* Input del número.
                  - Enfocado: muestra el valor raw (5491156029403) para editar.
                  - No enfocado: muestra el formato internacional (+54 9 11 5602-9403).
                  - Autofocus cuando es el item recién agregado. */}
              <div className="flex-1 min-w-0">
                <Input
                  variante="plano"
                  tipo="tel"
                  formato="telefono"
                  autoFocus={t.id === autofocusId}
                  value={t.id === itemEnfocadoId ? t.valor : (formatearTelefonoInternacional(t.valor) || t.valor)}
                  onFocus={() => {
                    setItemEnfocadoId(t.id)
                    if (t.id === autofocusId) setAutofocusId(null)
                  }}
                  onChange={(e) => cambiarValor(t.id, e.target.value)}
                  onBlur={() => {
                    setItemEnfocadoId(null)
                    blurValor(t.id)
                  }}
                  placeholder="Número"
                />
              </div>

              {/* Selector de tipo (movil/fijo/trabajo/casa/otro).
                  Móvil → asume WhatsApp. Fijo y demás → sin WhatsApp. */}
              <div className="w-28 shrink-0">
                <Select
                  variante="plano"
                  opciones={TIPOS_OPCIONES}
                  valor={t.tipo}
                  onChange={(v) => cambiarTipo(t.id, v)}
                  placeholder="Tipo"
                />
              </div>

              {/* Marca principal */}
              <button
                onClick={() => marcarPrincipal(t.id)}
                className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  t.es_principal
                    ? 'text-insignia-advertencia'
                    : 'text-texto-terciario hover:text-texto-secundario hover:bg-white/[0.04]'
                }`}
                title={t.es_principal ? 'Principal' : 'Marcar como principal'}
              >
                <Star size={13} fill={t.es_principal ? 'currentColor' : 'none'} />
              </button>

              {/* Eliminar */}
              <button
                onClick={() => eliminar(t.id)}
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-texto-terciario hover:text-insignia-peligro hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100"
                title="Eliminar teléfono"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

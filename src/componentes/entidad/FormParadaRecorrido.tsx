'use client'

/**
 * FormParadaRecorrido — Mini-formulario para agregar una parada genérica
 * (NO visita al cliente) a un recorrido.
 *
 * Usado por:
 *  - ModalRecorrido (coordinador en /visitas/planificación)
 *  - PaginaRecorrido (visitador en /recorrido, respetando config.puede_agregar_paradas)
 *
 * Dos formas de elegir dirección:
 *  1. "A mano" — input libre (ej: "Estación YPF Av. Colón").
 *  2. "Desde contacto" — buscador SelectorContacto; al elegir un contacto con
 *     direcciones, usa la primera dirección principal como snapshot de texto/lat/lng.
 *     Se muestra solo si el usuario tiene permiso `contactos.ver`.
 *
 * IMPORTANTE: aunque se elija un contacto, la parada es tipo='parada' — no crea
 * una visita ni contamina las métricas del contacto.
 */

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { MapPin, User, X, Loader2, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { InputDireccion } from '@/componentes/ui/InputDireccion'
import { useRol } from '@/hooks/useRol'
import { SelectorContacto, type ContactoResultado, type ContactoSeleccionado } from './SelectorContacto'
import type { Direccion } from '@/tipos/direccion'

// ── Tipos ──

export interface PayloadParadaGenerica {
  tipo: 'parada'
  titulo: string
  motivo: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  direccion_id: string | null
  contacto_id: string | null
  contacto_nombre: string | null
}

interface Props {
  onGuardar: (payload: PayloadParadaGenerica) => Promise<void> | void
  onCancelar: () => void
  guardando?: boolean
  /** Si true, el form no renderiza su footer de Cancelar/Guardar — útil cuando se
   *  usa dentro de un modal que ya provee accionPrimaria/accionSecundaria. */
  sinFooter?: boolean
  /** Callback que notifica al padre cuando cambia el flag "se puede guardar"
   *  (validez del título). Lo usa el modal para habilitar/deshabilitar su botón. */
  onCambioValidez?: (valido: boolean) => void
}

/** Handle imperativo para que el padre dispare el guardar desde un botón externo. */
export interface FormParadaRecorridoHandle {
  guardar: () => Promise<void> | void
}

type Modo = 'mano' | 'contacto'

export const FormParadaRecorrido = forwardRef<FormParadaRecorridoHandle, Props>(function FormParadaRecorrido(
  { onGuardar, onCancelar, guardando, sinFooter, onCambioValidez },
  ref
) {
  const { tienePermiso } = useRol()
  const puedeVerContactos = tienePermiso('contactos', 'ver')

  const [titulo, setTitulo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState<Modo>('mano')

  // Modo 'mano' — resuelto via Google Places (InputDireccion),
  // guardamos texto + coords para que la parada se pinte en el mapa.
  const [direccionTexto, setDireccionTexto] = useState('')
  const [direccionLat, setDireccionLat] = useState<number | null>(null)
  const [direccionLng, setDireccionLng] = useState<number | null>(null)

  // Modo 'contacto'
  const [contacto, setContacto] = useState<ContactoSeleccionado | null>(null)
  const [direccionContactoId, setDireccionContactoId] = useState<string | null>(null)
  const [direccionContactoTexto, setDireccionContactoTexto] = useState<string | null>(null)

  const puedeGuardar = titulo.trim().length > 0 && !guardando

  // Notificar al padre los cambios de validez (para sincronizar el botón externo)
  useEffect(() => {
    onCambioValidez?.(titulo.trim().length > 0)
  }, [titulo, onCambioValidez])

  const manejarGuardar = async () => {
    if (!puedeGuardar) return

    const payload: PayloadParadaGenerica =
      modo === 'contacto' && contacto
        ? {
            tipo: 'parada',
            titulo: titulo.trim(),
            motivo: motivo.trim() || null,
            direccion_texto: direccionContactoTexto,
            direccion_lat: null, // SelectorContacto no expone lat/lng de la dirección — se puede ampliar más adelante
            direccion_lng: null,
            direccion_id: direccionContactoId,
            contacto_id: contacto.id,
            contacto_nombre: `${contacto.nombre} ${contacto.apellido || ''}`.trim() || contacto.nombre,
          }
        : {
            tipo: 'parada',
            titulo: titulo.trim(),
            motivo: motivo.trim() || null,
            direccion_texto: direccionTexto.trim() || null,
            direccion_lat: direccionLat,
            direccion_lng: direccionLng,
            direccion_id: null,
            contacto_id: null,
            contacto_nombre: null,
          }

    await onGuardar(payload)
  }

  // Exponer la acción de guardar para que el padre pueda dispararla desde su footer.
  // Tiene que ir DESPUÉS de declarar manejarGuardar (es un const, no se hoistea).
  useImperativeHandle(ref, () => ({
    guardar: () => manejarGuardar(),
  }))

  const manejarCambioContacto = (c: ContactoResultado | null) => {
    if (!c) {
      setContacto(null)
      setDireccionContactoId(null)
      setDireccionContactoTexto(null)
      return
    }
    setContacto({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
      telefono: c.telefono,
      whatsapp: c.whatsapp,
      tipo_contacto: c.tipo_contacto,
      numero_identificacion: c.numero_identificacion,
      condicion_iva: c.condicion_iva,
      direccion: null,
      direcciones: c.direcciones,
    })
    // Snapshot de la dirección principal si existe
    const principal = c.direcciones?.find(d => d.es_principal) || c.direcciones?.[0]
    if (principal) {
      setDireccionContactoId(principal.id || null)
      setDireccionContactoTexto(principal.texto || null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Título */}
      <div>
        <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
          Título<span className="text-insignia-peligro ml-0.5">*</span>
        </label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Cargar combustible, café, depósito…"
          autoFocus
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-card px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario focus:border-texto-marca/40 focus:outline-none"
        />
      </div>

      {/* Motivo opcional */}
      <div>
        <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
          Motivo <span className="text-texto-terciario/50 normal-case">(opcional)</span>
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por qué vas a esta parada"
          rows={2}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-card px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:border-texto-marca/40 focus:outline-none"
        />
      </div>

      {/* Selector de modo de dirección */}
      {puedeVerContactos && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setModo('mano')}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-card text-xs font-medium border transition-colors',
              modo === 'mano'
                ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-marca'
                : 'border-borde-sutil text-texto-terciario hover:bg-superficie-elevada',
            ].join(' ')}
          >
            <MapPin size={12} />
            Dirección a mano
          </button>
          <button
            type="button"
            onClick={() => setModo('contacto')}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-card text-xs font-medium border transition-colors',
              modo === 'contacto'
                ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-marca'
                : 'border-borde-sutil text-texto-terciario hover:bg-superficie-elevada',
            ].join(' ')}
          >
            <User size={12} />
            Desde contacto
          </button>
        </div>
      )}

      {/* Input dirección según modo */}
      {modo === 'mano' ? (
        <div>
          <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
            Dirección <span className="text-texto-terciario/50 normal-case">(opcional)</span>
          </label>
          <InputDireccion
            placeholder="Buscar dirección en Google Maps…"
            valorInicial={direccionTexto}
            compacto
            alSeleccionar={(d: Direccion) => {
              setDireccionTexto(d.textoCompleto)
              setDireccionLat(d.coordenadas?.lat ?? null)
              setDireccionLng(d.coordenadas?.lng ?? null)
            }}
            alLimpiar={() => {
              setDireccionTexto('')
              setDireccionLat(null)
              setDireccionLng(null)
            }}
          />
          <p className="text-[10px] text-texto-terciario/70 mt-1">
            Esta parada no cuenta como visita al cliente.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
            Contacto
          </label>
          <SelectorContacto
            contacto={contacto}
            onChange={manejarCambioContacto}
            sinAlertaCorreo
            sinDatosFiscales
            placeholder="Buscar contacto para usar su dirección…"
          />
          {direccionContactoTexto && (
            <div className="mt-2 flex items-start gap-1.5 rounded-card bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
              <MapPin size={11} className="text-texto-terciario shrink-0 mt-0.5" />
              <span className="text-[11px] text-texto-secundario leading-tight">{direccionContactoTexto}</span>
            </div>
          )}
          <p className="text-[10px] text-texto-terciario/70 mt-1">
            Se usa la dirección del contacto, pero NO se registra como visita.
          </p>
        </div>
      )}

      {/* Acciones — sticky al fondo para que no se tapen con la bottom bar del sheet.
          Cuando se usa dentro de un Modal estándar (sinFooter=true), las acciones las
          provee el modal vía accionPrimaria/accionSecundaria — acá no renderizamos
          un footer propio para no duplicar. */}
      {!sinFooter && (
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-1 flex items-center justify-end gap-2 bg-superficie-app/95 backdrop-blur-sm border-t border-white/[0.06] px-3 py-2 rounded-b-card">
          <Boton variante="fantasma" tamano="sm" onClick={onCancelar} icono={<X size={13} />}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            tamano="sm"
            onClick={manejarGuardar}
            disabled={!puedeGuardar}
            icono={guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          >
            Agregar parada
          </Boton>
        </div>
      )}
    </div>
  )
})

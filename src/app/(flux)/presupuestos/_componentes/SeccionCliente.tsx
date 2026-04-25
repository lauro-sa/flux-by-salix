'use client'

/**
 * SeccionCliente — Columna izquierda del grid: selector de cliente y "Dirigido a".
 * Se usa en: EditorPresupuesto.tsx
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone, ExternalLink, Copy, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import SelectorContactoPresupuesto from './SelectorContactoPresupuesto'
import { useTraduccion } from '@/lib/i18n'
import type { ContactoResumido, Vinculacion } from './tipos-editor'
import type { PresupuestoConLineas } from '@/tipos/presupuesto'

interface PropsSeccionCliente {
  modo: 'crear' | 'editar'
  esEditable: boolean
  contactoSeleccionado: ContactoResumido | null
  vinculaciones: Vinculacion[]
  atencionId: string | null
  atencionSeleccionada: Vinculacion['vinculado'] | null
  presupuesto: PresupuestoConLineas | null
  idPresupuesto: string | null | undefined
  // Callbacks
  onSeleccionarContacto: (contacto: ContactoResumido) => void
  onLimpiarContacto: () => void
  onSeleccionarAtencion: (vinc: Vinculacion) => void
  onCambiarContactoEditar: (contacto: ContactoResumido | null) => void
  onCambiarAtencionEditar: (vincId: string | null, vinculado: Vinculacion['vinculado'] | null, datos?: Record<string, unknown>) => void
  onSeleccionarConDirigidoA: (padre: ContactoResumido, hijoId: string) => void
}

export default function SeccionCliente({
  modo,
  esEditable,
  contactoSeleccionado,
  vinculaciones,
  atencionId,
  atencionSeleccionada,
  presupuesto,
  idPresupuesto,
  onSeleccionarContacto,
  onLimpiarContacto,
  onSeleccionarAtencion,
  onCambiarContactoEditar,
  onCambiarAtencionEditar,
  onSeleccionarConDirigidoA,
}: PropsSeccionCliente) {
  const router = useRouter()
  const { t } = useTraduccion()

  const hayVinculacionesConCorreo = vinculaciones.some(v => v.vinculado.correo)
  // El contacto no tiene correo si: el seleccionado no tiene, O el snapshot del presupuesto no tiene
  const correoContacto = contactoSeleccionado?.correo || presupuesto?.contacto_correo
  const clienteSinCorreo = !correoContacto

  return (
    <div className="space-y-3 py-3">
      {/* CLIENTE */}
      <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
        <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
          {t('documentos.cliente')}
        </span>
        <div className="mt-1.5">
          {modo === 'crear' ? (
            <SelectorContactoPresupuesto
              autoFocus={!contactoSeleccionado}
              contacto={contactoSeleccionado ? {
                id: contactoSeleccionado.id,
                nombre: contactoSeleccionado.nombre,
                apellido: contactoSeleccionado.apellido,
                correo: contactoSeleccionado.correo,
                telefono: contactoSeleccionado.telefono,
                whatsapp: contactoSeleccionado.whatsapp || null,
                tipo_contacto: contactoSeleccionado.tipo_contacto,
                numero_identificacion: contactoSeleccionado.numero_identificacion,
                condicion_iva: contactoSeleccionado.condicion_iva || null,
                direccion: contactoSeleccionado.direcciones?.find(d => d.es_principal)?.texto || null,
                direcciones: contactoSeleccionado.direcciones || [],
              } : null}
              onChange={(c) => {
                if (c) {
                  onSeleccionarContacto(c)
                } else {
                  onLimpiarContacto()
                }
              }}
              hayVinculacionesConCorreo={hayVinculacionesConCorreo}
              onSeleccionarConDirigidoA={(padre, hijoId) => {
                onSeleccionarConDirigidoA(padre, hijoId)
              }}
            />
          ) : (
            <SelectorContactoPresupuesto
              contacto={contactoSeleccionado ? {
                id: contactoSeleccionado.id,
                nombre: contactoSeleccionado.nombre,
                apellido: contactoSeleccionado.apellido,
                correo: contactoSeleccionado.correo,
                telefono: contactoSeleccionado.telefono,
                whatsapp: contactoSeleccionado.whatsapp || null,
                tipo_contacto: contactoSeleccionado.tipo_contacto,
                numero_identificacion: contactoSeleccionado.numero_identificacion,
                condicion_iva: contactoSeleccionado.condicion_iva || null,
                direccion: contactoSeleccionado.direcciones?.find(d => d.es_principal)?.texto || presupuesto?.contacto_direccion || null,
                direcciones: contactoSeleccionado.direcciones || [],
              } : presupuesto?.contacto_nombre ? {
                id: presupuesto.contacto_id || '',
                nombre: presupuesto.contacto_nombre,
                apellido: presupuesto.contacto_apellido || null,
                correo: presupuesto.contacto_correo || null,
                telefono: presupuesto.contacto_telefono || null,
                tipo_contacto: presupuesto.contacto_tipo ? { clave: presupuesto.contacto_tipo, etiqueta: presupuesto.contacto_tipo } : null,
                numero_identificacion: presupuesto.contacto_identificacion || null,
                condicion_iva: presupuesto.contacto_condicion_iva || null,
                direccion: presupuesto.contacto_direccion || null,
              } : null}
              onChange={(c) => onCambiarContactoEditar(c)}
              soloLectura={!esEditable}
              hayVinculacionesConCorreo={hayVinculacionesConCorreo}
            />
          )}
        </div>
      </div>

      {/* DIRIGIDO A — modo crear */}
      {modo === 'crear' && contactoSeleccionado && vinculaciones.length > 0 && (
        <DirigidoACrear
          atencionSeleccionada={atencionSeleccionada}
          vinculaciones={vinculaciones}
          onSeleccionarAtencion={onSeleccionarAtencion}
          onLimpiar={() => onCambiarAtencionEditar(null, null)}
        />
      )}

      {/* DIRIGIDO A — modo editar, con selección previa */}
      {modo === 'editar' && presupuesto?.atencion_nombre && (
        <DirigidoAEditarExistente
          presupuesto={presupuesto}
          atencionSeleccionada={atencionSeleccionada}
          vinculaciones={vinculaciones}
          esEditable={esEditable}
          onCambiar={() => onCambiarAtencionEditar(null, null, {
            atencion_contacto_id: null,
            atencion_nombre: '',
            atencion_correo: '',
          })}
        />
      )}

      {/* DIRIGIDO A — modo editar, vinculaciones disponibles, sin selección previa */}
      {modo === 'editar' && !presupuesto?.atencion_nombre && vinculaciones.length > 0 && esEditable && (
        <DirigidoAEditarLista
          vinculaciones={vinculaciones}
          clienteSinCorreo={clienteSinCorreo}
          onSeleccionar={(v) => {
            onCambiarAtencionEditar(v.vinculado.id, v.vinculado, {
              atencion_contacto_id: v.vinculado.id,
              atencion_nombre: `${v.vinculado.nombre} ${v.vinculado.apellido || ''}`.trim(),
              atencion_correo: v.vinculado.correo,
            })
          }}
        />
      )}
    </div>
  )
}

/** Botoncito de copiar al portapapeles */
function BotonCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  return (
    <button type="button" onClick={copiar} className="text-texto-terciario hover:text-texto-primario transition-colors p-0.5 -m-0.5 rounded" title="Copiar">
      {copiado ? <Check size={11} className="text-insignia-exito" /> : <Copy size={11} />}
    </button>
  )
}

// ─── Sub-componentes internos de "Dirigido a" ──────────────────────────────

function DirigidoACrear({
  atencionSeleccionada,
  vinculaciones,
  onSeleccionarAtencion,
  onLimpiar,
}: {
  atencionSeleccionada: Vinculacion['vinculado'] | null
  vinculaciones: Vinculacion[]
  onSeleccionarAtencion: (vinc: Vinculacion) => void
  onLimpiar: () => void
}) {
  const router = useRouter()

  return (
    <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
      <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
        Dirigido a
      </span>

      {atencionSeleccionada ? (
        <div className="mt-1.5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-texto-primario">
                {atencionSeleccionada.nombre} {atencionSeleccionada.apellido || ''}
              </p>
              {atencionSeleccionada.correo && (
                <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                  <Mail size={13} className="shrink-0" />
                  {atencionSeleccionada.correo}
                  <BotonCopiar valor={atencionSeleccionada.correo} />
                </p>
              )}
              {(atencionSeleccionada.whatsapp || atencionSeleccionada.telefono) && (
                <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                  <Phone size={13} className="shrink-0" />
                  <TextoTelefono valor={atencionSeleccionada.whatsapp || atencionSeleccionada.telefono} />
                  <BotonCopiar valor={atencionSeleccionada.whatsapp || atencionSeleccionada.telefono || ''} />
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Boton variante="fantasma" tamano="xs" onClick={onLimpiar}>Cambiar</Boton>
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={13} />} onClick={() => router.push(`/contactos/${atencionSeleccionada.id}`)} titulo="Ver ficha del contacto" />
            </div>
          </div>
          <p className="text-xxs text-texto-terciario mt-2">
            Aparecera como &quot;Atencion:&quot; en el PDF del documento
          </p>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          {vinculaciones.map(v => (
            <Boton
              key={v.id}
              variante="fantasma"
              tamano="sm"
              onClick={() => onSeleccionarAtencion(v)}
              className="w-full text-left px-2 py-2 h-auto"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-texto-primario truncate">
                  {v.vinculado.nombre} {v.vinculado.apellido || ''}
                </div>
                <div className="text-xs text-texto-terciario truncate">
                  {v.puesto || v.vinculado.correo || ''}
                </div>
              </div>
            </Boton>
          ))}
        </div>
      )}
    </div>
  )
}

function DirigidoAEditarExistente({
  presupuesto,
  atencionSeleccionada,
  vinculaciones,
  esEditable,
  onCambiar,
}: {
  presupuesto: PresupuestoConLineas
  atencionSeleccionada: Vinculacion['vinculado'] | null
  vinculaciones: Vinculacion[]
  esEditable: boolean
  onCambiar: () => void
}) {
  const router = useRouter()

  return (
    <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
      <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
        Dirigido a
      </span>
      <div className="mt-1.5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-texto-primario">{presupuesto.atencion_nombre}</p>
            {(atencionSeleccionada?.correo || presupuesto.atencion_correo) && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <Mail size={13} className="shrink-0" />
                {atencionSeleccionada?.correo || presupuesto.atencion_correo}
                <BotonCopiar valor={atencionSeleccionada?.correo || presupuesto.atencion_correo || ''} />
              </p>
            )}
            {(atencionSeleccionada?.whatsapp || atencionSeleccionada?.telefono) && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <Phone size={13} className="shrink-0" />
                <TextoTelefono valor={atencionSeleccionada.whatsapp || atencionSeleccionada.telefono} />
                <BotonCopiar valor={atencionSeleccionada.whatsapp || atencionSeleccionada.telefono || ''} />
              </p>
            )}
            {presupuesto.atencion_cargo && (
              <p className="text-xs text-texto-terciario">{presupuesto.atencion_cargo}</p>
            )}
          </div>
          {esEditable && (
            <div className="flex items-center gap-1 shrink-0">
              {vinculaciones.length > 0 && (
                <Boton variante="fantasma" tamano="xs" onClick={onCambiar}>Cambiar</Boton>
              )}
              {presupuesto.atencion_contacto_id && (
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={13} />} onClick={() => router.push(`/contactos/${presupuesto.atencion_contacto_id}`)} titulo="Ver ficha del contacto" />
              )}
            </div>
          )}
        </div>
        <p className="text-xxs text-texto-terciario mt-2">Aparecera como &quot;Atencion:&quot; en el PDF del documento</p>
      </div>
    </div>
  )
}

function DirigidoAEditarLista({
  vinculaciones,
  clienteSinCorreo = false,
  onSeleccionar,
}: {
  vinculaciones: Vinculacion[]
  clienteSinCorreo?: boolean
  onSeleccionar: (v: Vinculacion) => void
}) {
  const tieneConCorreo = vinculaciones.some(v => v.vinculado.correo)

  return (
    <div className={`bg-superficie-hover/50 rounded-card px-3 py-3 -mx-3 ${
      clienteSinCorreo && tieneConCorreo
        ? 'border border-insignia-advertencia/30 ring-1 ring-insignia-advertencia/10'
        : 'border border-borde-sutil/50'
    }`}>
      <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
        Dirigido a
      </span>
      {clienteSinCorreo && tieneConCorreo ? (
        <p className="text-xxs text-insignia-advertencia mt-0.5 mb-2">Seleccioná un contacto para poder enviar por email</p>
      ) : (
        <p className="text-xxs text-texto-terciario mt-0.5 mb-2">Aparecera como &quot;Atencion:&quot; en el PDF del documento</p>
      )}
      <div className="space-y-1">
        {vinculaciones.map(v => (
          <Boton
            key={v.id}
            variante="fantasma"
            tamano="sm"
            onClick={() => onSeleccionar(v)}
            className="w-full text-left px-3 py-2 h-auto border border-transparent hover:border-borde-sutil"
          >
            <div className="size-7 rounded-full bg-superficie-app text-texto-terciario flex items-center justify-center text-xs font-bold">
              {v.vinculado.nombre[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-texto-primario truncate">
                {v.vinculado.nombre} {v.vinculado.apellido || ''}
              </div>
              <div className="text-xs text-texto-terciario truncate">
                {v.puesto || v.vinculado.correo || ''}
              </div>
            </div>
          </Boton>
        ))}
      </div>
    </div>
  )
}

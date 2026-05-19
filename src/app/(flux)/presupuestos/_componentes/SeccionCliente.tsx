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
import SelectorVisitaPresupuesto from './SelectorVisitaPresupuesto'
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
  /** ID de la dirección elegida (snapshot persistido o selección en curso) */
  direccionIdSeleccionada: string | null
  /** Visita de origen vinculada al presupuesto (relevamiento del visitador). */
  visitaId: string | null
  // Callbacks
  onSeleccionarContacto: (contacto: ContactoResumido) => void
  onLimpiarContacto: () => void
  onSeleccionarAtencion: (vinc: Vinculacion) => void
  onCambiarContactoEditar: (contacto: ContactoResumido | null) => void
  onCambiarAtencionEditar: (vincId: string | null, vinculado: Vinculacion['vinculado'] | null, datos?: Record<string, unknown>) => void
  onSeleccionarConDirigidoA: (padre: ContactoResumido, hijoId: string) => void
  onCambiarDireccion: (direccionId: string, texto: string) => void
  /** Cambia la visita vinculada. null = quitar vínculo. */
  onCambiarVisita: (visitaId: string | null) => void
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
  direccionIdSeleccionada,
  visitaId,
  onSeleccionarContacto,
  onLimpiarContacto,
  onSeleccionarAtencion,
  onCambiarContactoEditar,
  onCambiarAtencionEditar,
  onSeleccionarConDirigidoA,
  onCambiarDireccion,
  onCambiarVisita,
}: PropsSeccionCliente) {
  const router = useRouter()
  const { t } = useTraduccion()

  const hayVinculacionesConCorreo = vinculaciones.some(v => v.vinculado.correo)
  // El contacto no tiene correo si: el seleccionado no tiene, O el snapshot del presupuesto no tiene
  const correoContacto = contactoSeleccionado?.correo || presupuesto?.contacto_correo
  const clienteSinCorreo = !correoContacto

  // ID del contacto cliente para el botón ↗ "ver ficha" del header. Vive
  // afuera del card para no competir visualmente con los metadatos
  // (Empresa, Principal) que tenemos a la derecha dentro de la tarjeta.
  const contactoIdHeader = contactoSeleccionado?.id || presupuesto?.contacto_id || null
  const qsDesde = qsDesdePresupuesto(presupuesto)

  return (
    <div className="space-y-3 py-3">
      {/* CLIENTE */}
      <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
            {t('documentos.cliente')}
          </span>
          {contactoIdHeader && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<ExternalLink size={14} />}
              onClick={() => router.push(`/contactos/${contactoIdHeader}${qsDesde}`)}
              titulo="Ver ficha del contacto"
              className="-my-1 text-texto-terciario hover:text-texto-primario hover:bg-transparent transition-colors"
            />
          )}
        </div>
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
              direccionIdSeleccionada={direccionIdSeleccionada}
              onCambiarDireccion={onCambiarDireccion}
              qsDesde={qsDesde}
              ocultarBotonIrAContacto
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
              direccionIdSeleccionada={direccionIdSeleccionada}
              onCambiarDireccion={onCambiarDireccion}
              qsDesde={qsDesde}
              ocultarBotonIrAContacto
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
          qsDesde={qsDesdePresupuesto(presupuesto)}
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

      {/* VISITA DE ORIGEN — relevamiento del visitador.
          Sólo se muestra cuando hay contacto seleccionado: las visitas se
          listan filtradas por contacto. La visita se hereda a la OT al
          generarla y siembra la galería de relevamiento. */}
      {(contactoSeleccionado?.id || presupuesto?.contacto_id) && (
        <SelectorVisitaPresupuesto
          contactoId={contactoSeleccionado?.id || presupuesto?.contacto_id || null}
          visitaId={visitaId}
          onCambiar={onCambiarVisita}
          esEditable={esEditable}
        />
      )}
    </div>
  )
}

/**
 * Botoncito de copiar al portapapeles. Pensado para vivir al final de una
 * fila con hover bg: el botón se hace visible al pasar el mouse por la fila
 * y muestra la palabra "Copiar" inline. El texto principal de la fila sigue
 * siendo seleccionable porque el botón no captura el click sobre el texto.
 *
 * Tras copiar muestra "Copiado ✓" durante 1.5s como feedback inmediato.
 */
function BotonCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  // Feedback verde + label "Copiado" durante 1.5s. El label se hace visible
  // siempre que esté copiado (no depende del hover) para que el usuario vea
  // el efecto incluso si ya sacó el mouse del botón al hacer click.
  // Ancho mínimo reservado para que el botón mida lo mismo con o sin el
  // label "Copiar" visible. Sin esto, al aparecer el texto en hover, el
  // botón crece y "mueve" los elementos vecinos (montos, direcciones).
  const claseBase = 'ml-auto shrink-0 inline-flex items-center justify-end gap-1 min-w-[5rem] px-1.5 py-0 rounded transition-colors'
  const claseEstado = copiado
    ? 'text-insignia-exito bg-insignia-exito/15'
    : 'text-texto-terciario hover:text-texto-primario hover:bg-superficie-tarjeta'

  return (
    <button
      type="button"
      onClick={copiar}
      className={`${claseBase} ${claseEstado}`}
      title={copiado ? 'Copiado' : 'Copiar'}
    >
      {/* Texto a la izquierda del ícono: así el ícono queda anclado a la
          derecha y no se mueve cuando aparece/desaparece el label en hover. */}
      <span className={`text-xxs ${copiado ? 'inline' : 'hidden group-hover/fila:inline'}`}>
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
      {copiado ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ─── Sub-componentes internos de "Dirigido a" ──────────────────────────────

/**
 * TarjetaDirigidoA — Render visual unificado de un Dirigido a seleccionado.
 * Se usa tanto en modo crear como editar para que el look sea idéntico en
 * borrador, enviado y bloqueado; solo cambian las acciones (Cambiar).
 *
 * Jerarquía: nombre arriba (lo más útil para reconocer al destinatario),
 * separador sutil, correo y teléfono más chicos, y al pie el aviso de que
 * aparecerá como "Atención:" en el PDF.
 */
function TarjetaDirigidoA({
  nombre,
  correo,
  telefono,
  cargo,
  mostrarCambiar,
  onCambiar,
}: {
  nombre: string
  correo: string | null | undefined
  telefono: string | null | undefined
  cargo?: string | null
  mostrarCambiar: boolean
  onCambiar?: () => void
}) {
  const tieneDatosContacto = !!correo || !!telefono

  return (
    <div className="mt-1.5 rounded-card bg-superficie-app/50 px-3 py-3">
      {/* Bloque identidad: nombre + cargo + acciones. El botón ↗ ahora vive
          afuera del card, junto al label "DIRIGIDO A", así la columna
          derecha del card queda más limpia y los metadatos del contacto no
          compiten visualmente con la acción de navegar a su ficha. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-texto-primario truncate">
            {nombre}
          </p>
          {cargo && (
            <p className="text-xxs text-texto-terciario mt-0.5">{cargo}</p>
          )}
        </div>
        {mostrarCambiar && onCambiar && (
          <Boton variante="fantasma" tamano="xs" onClick={onCambiar} className="shrink-0">Cambiar</Boton>
        )}
      </div>

      {/* Separador sutil entre identidad y datos de contacto */}
      {tieneDatosContacto && (
        <div className="mt-3 border-t border-borde-sutil/50" />
      )}

      {/* Bloque contacto: correo + teléfono. Datos secundarios pero útiles.
          Cada fila tiene hover bg para invitar al copiado; el texto sigue
          siendo seleccionable (no hay pointer-events:none en el span). */}
      {tieneDatosContacto && (
        <div className="mt-3 space-y-0.5">
          {correo && (
            <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
              <Mail size={11} className="shrink-0" />
              <span className="truncate flex-1 select-text">{correo}</span>
              <BotonCopiar valor={correo} />
            </div>
          )}
          {telefono && (
            <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
              <Phone size={11} className="shrink-0" />
              <span className="flex-1 select-text"><TextoTelefono valor={telefono} /></span>
              <BotonCopiar valor={telefono} />
            </div>
          )}
        </div>
      )}

      {/* Pie informativo: aclaración para el usuario, no protagonista. */}
      <p className="text-xxs text-texto-terciario/70 mt-3">
        Aparecerá como &quot;Atención:&quot; en el PDF del documento
      </p>
    </div>
  )
}

function DirigidoACrear({
  atencionSeleccionada,
  vinculaciones,
  onSeleccionarAtencion,
  onLimpiar,
  qsDesde,
}: {
  atencionSeleccionada: Vinculacion['vinculado'] | null
  vinculaciones: Vinculacion[]
  onSeleccionarAtencion: (vinc: Vinculacion) => void
  onLimpiar: () => void
  qsDesde: string
}) {
  const router = useRouter()
  return (
    <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
          Dirigido a
        </span>
        {atencionSeleccionada?.id && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<ExternalLink size={14} />}
            onClick={() => router.push(`/contactos/${atencionSeleccionada.id}${qsDesde}`)}
            titulo="Ver ficha del contacto"
            className="-my-1 text-texto-terciario hover:text-texto-primario hover:bg-transparent transition-colors"
          />
        )}
      </div>

      {atencionSeleccionada ? (
        <TarjetaDirigidoA
          nombre={`${atencionSeleccionada.nombre} ${atencionSeleccionada.apellido || ''}`.trim()}
          correo={atencionSeleccionada.correo}
          telefono={atencionSeleccionada.whatsapp || atencionSeleccionada.telefono}
          mostrarCambiar
          onCambiar={onLimpiar}
        />
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

// Construye el query string `?desde=...&desde_nombre=...` para que la página
// del contacto destino arme su breadcrumb apuntando al presupuesto de origen.
// Sin esto, al navegar a un contacto vinculado las migajas vuelven al listado
// "Contactos" y se pierde el rastro del documento desde el que se entró.
function qsDesdePresupuesto(presupuesto: PresupuestoConLineas | null | undefined): string {
  if (!presupuesto?.id) return ''
  const etiqueta = presupuesto.numero || 'Presupuesto'
  return `?desde=${encodeURIComponent(`/presupuestos/${presupuesto.id}`)}&desde_nombre=${encodeURIComponent(etiqueta)}`
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
  const qsDesde = qsDesdePresupuesto(presupuesto)
  return (
    <div className="bg-superficie-hover/50 border border-borde-sutil/50 rounded-card px-3 py-3 -mx-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-texto-secundario uppercase tracking-wider">
          Dirigido a
        </span>
        {presupuesto.atencion_contacto_id && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<ExternalLink size={14} />}
            onClick={() => router.push(`/contactos/${presupuesto.atencion_contacto_id}${qsDesde}`)}
            titulo="Ver ficha del contacto"
            className="-my-1 text-texto-terciario hover:text-texto-primario hover:bg-transparent transition-colors"
          />
        )}
      </div>
      <TarjetaDirigidoA
        nombre={presupuesto.atencion_nombre || ''}
        correo={atencionSeleccionada?.correo || presupuesto.atencion_correo}
        telefono={atencionSeleccionada?.whatsapp || atencionSeleccionada?.telefono}
        cargo={presupuesto.atencion_cargo}
        mostrarCambiar={esEditable && vinculaciones.length > 0}
        onCambiar={onCambiar}
      />
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

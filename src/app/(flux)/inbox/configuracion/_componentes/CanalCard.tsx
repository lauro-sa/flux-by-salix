'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { Insignia } from '@/componentes/ui/Insignia'
import { Pencil, Trash2, Shield, ChevronDown, Mail } from 'lucide-react'
import type { CanalInbox, TipoCanal } from '@/tipos/inbox'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ModalAgregarCanal } from '../../_componentes/ModalAgregarCanal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useTraduccion } from '@/lib/i18n'

/**
 * Card visual de canal conectado — muestra todos los datos de la cuenta.
 * Se usa en SeccionCorreo para listar bandejas de correo.
 */
export function CanalCard({ canal, onRecargar, onHacerPrincipal }: { canal: CanalInbox; onRecargar?: () => void; onHacerPrincipal?: (canalId: string) => void }) {
  const { t } = useTraduccion()
  const [expandido, setExpandido] = useState(false)
  const [cargandoCalidad, setCargandoCalidad] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [modalPrincipal, setModalPrincipal] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [editando, setEditando] = useState(false)
  type DatosCalidad = { rating: string; tier: string; status: string }
  const calidadInicial = (canal.config_conexion as Record<string, unknown>)?.calidadActual as DatosCalidad | undefined
  const [calidad, setCalidad] = useState<DatosCalidad | null>(calidadInicial || null)

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      await fetch(`/api/inbox/canales/${canal.id}`, { method: 'DELETE' })
      setModalEliminar(false)
      onRecargar?.()
    } catch { /* silenciar */ }
    setEliminando(false)
  }

  const conectado = canal.estado_conexion === 'conectado'
  const error = canal.estado_conexion === 'error'
  const config = canal.config_conexion as Record<string, unknown>
  const esWhatsApp = canal.tipo === 'whatsapp'

  // Colores de calidad
  const colorCalidad: Record<string, string> = {
    GREEN: 'exito', YELLOW: 'advertencia', RED: 'peligro',
  }

  const consultarCalidad = async () => {
    setCargandoCalidad(true)
    try {
      const res = await fetch(`/api/inbox/whatsapp/calidad?canal_id=${canal.id}`)
      const data = await res.json()
      if (data.calidad) setCalidad({
        rating: data.calidad.quality_rating,
        tier: data.calidad.messaging_limit_tier,
        status: data.calidad.status,
      })
    } catch { /* silenciar */ }
    setCargandoCalidad(false)
  }

  // Datos a mostrar según proveedor
  const datosVisibles: { etiqueta: string; valor: string; sensible?: boolean }[] = []

  if (esWhatsApp && canal.proveedor === 'meta_api') {
    datosVisibles.push(
      { etiqueta: 'Número', valor: (config.numeroTelefono || config.numero_telefono || '—') as string },
      { etiqueta: 'Phone Number ID', valor: (config.phoneNumberId || config.phone_number_id || '—') as string },
      { etiqueta: 'WABA ID', valor: (config.wabaId || config.waba_id || '—') as string },
      { etiqueta: 'Access Token', valor: (config.tokenAcceso || config.access_token || '') as string, sensible: true },
      { etiqueta: 'Webhook Secret', valor: (config.secretoWebhook || '') as string, sensible: true },
      { etiqueta: 'Webhook Verify Token', valor: (config.tokenVerificacion || '') as string, sensible: true },
    )
  } else if (esWhatsApp && canal.proveedor === 'twilio') {
    datosVisibles.push(
      { etiqueta: 'Número', valor: (config.from_number || '—') as string },
      { etiqueta: 'Account SID', valor: (config.account_sid || '—') as string },
      { etiqueta: 'Auth Token', valor: (config.auth_token || '') as string, sensible: true },
    )
  } else if (canal.proveedor === 'imap') {
    datosVisibles.push(
      { etiqueta: 'Servidor IMAP', valor: `${config.host || '—'}:${config.puerto || '993'}` },
      { etiqueta: 'Usuario', valor: (config.usuario || '—') as string },
      { etiqueta: 'SSL', valor: config.ssl ? 'Sí' : 'No' },
      { etiqueta: 'SMTP', valor: `${config.smtp_host || config.host || '—'}:${config.smtp_puerto || '587'}` },
    )
  } else if (canal.proveedor === 'gmail_oauth') {
    datosVisibles.push(
      { etiqueta: 'Correo', valor: (config.email || '—') as string },
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        border: expandido ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Header — siempre visible */}
      <Boton
        variante="fantasma"
        tamano="sm"
        anchoCompleto
        onClick={() => setExpandido(!expandido)}
        className="p-4 text-left"
      >
        <span className="w-full flex items-center gap-3">
          {/* Icono del canal */}
          <span
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: esWhatsApp ? 'rgba(37, 211, 102, 0.1)' : 'rgba(37, 99, 235, 0.1)',
            }}
          >
            {esWhatsApp ? (
              <IconoWhatsApp size={20} style={{ color: 'var(--canal-whatsapp)' }} />
            ) : (
              <Mail size={20} style={{ color: 'var(--canal-correo)' }} />
            )}
          </span>

          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                {canal.nombre}
              </span>
              <Insignia color={conectado ? 'exito' : error ? 'peligro' : 'neutro'} tamano="sm">
                {conectado ? t('inbox.config.estado_conectado') : error ? t('inbox.config.estado_error') : t('inbox.config.estado_desconectado')}
              </Insignia>
              {canal.es_principal && (
                <Insignia color="primario" tamano="sm">
                  Principal
                </Insignia>
              )}
              {calidad && (
                <Insignia color={colorCalidad[calidad.rating] as 'exito' | 'advertencia' | 'peligro'} tamano="sm">
                  {calidad.rating}
                </Insignia>
              )}
            </span>
            <span className="flex items-center gap-3 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                {canal.proveedor === 'imap' && 'IMAP/SMTP'}
                {canal.proveedor === 'gmail_oauth' && 'Gmail OAuth'}
                {canal.proveedor === 'meta_api' && 'Meta Business API'}
                {canal.proveedor === 'twilio' && 'Twilio'}
              </span>
              {esWhatsApp && (
                <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  {(config.numeroTelefono || config.numero_telefono || config.from_number || '') as string}
                </span>
              )}
              {!esWhatsApp && (
                <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  {(config.usuario || config.email || '') as string}
                </span>
              )}
              {/* Módulos se configuran ahora en la matriz global de disponibilidad */}
            </span>
            {error && canal.ultimo_error && (
              <span className="text-xxs mt-1 block" style={{ color: 'var(--insignia-peligro)' }}>
                {canal.ultimo_error}
              </span>
            )}
          </span>

          <span className="flex items-center gap-1 flex-shrink-0">
            <ChevronDown
              size={16}
              style={{
                color: 'var(--texto-terciario)',
                transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms',
              }}
            />
          </span>
        </span>
      </Boton>

      {/* Detalle expandido */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
              {/* Tabla de datos */}
              <div className="pt-3">
                <table className="w-full">
                  <tbody>
                    {datosVisibles.filter(d => d.valor && d.valor !== '—' || !d.sensible).map((dato) => (
                      <tr key={dato.etiqueta}>
                        <td className="py-1.5 pr-4 text-xs font-medium align-top" style={{ color: 'var(--texto-terciario)', width: '40%' }}>
                          {dato.etiqueta}
                        </td>
                        <td className="py-1.5 text-xs align-top" style={{ color: 'var(--texto-primario)' }}>
                          {dato.sensible ? (
                            <span className="font-mono text-xxs px-1.5 py-0.5 rounded" style={{ background: 'var(--superficie-hover)' }}>
                              {dato.valor ? `${dato.valor.substring(0, 8)}${'•'.repeat(20)}` : '—'}
                            </span>
                          ) : (
                            <span className="font-mono text-xxs">{dato.valor}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calidad del número (solo WA) */}
              {esWhatsApp && calidad && (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
                      Calidad del número
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: calidad.rating === 'GREEN' ? 'var(--insignia-exito)'
                              : calidad.rating === 'YELLOW' ? 'var(--insignia-advertencia)'
                              : 'var(--insignia-peligro)',
                          }}
                        />
                        <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
                          {calidad.rating}
                        </span>
                      </div>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        Tier: {calidad.tier}
                      </span>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        Estado: {calidad.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook URL (solo WA Meta) */}
              {esWhatsApp && canal.proveedor === 'meta_api' && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--texto-secundario)' }}>
                    URL del Webhook (configurar en Meta)
                  </p>
                  <code
                    className="text-xxs font-mono block p-2 rounded"
                    style={{
                      background: 'var(--superficie-app)',
                      color: 'var(--texto-marca)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/inbox/whatsapp/webhook` : '/api/inbox/whatsapp/webhook'}
                  </code>
                </div>
              )}

              {/* Firma de correo inline */}
              {!esWhatsApp && (
                <div className="pt-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>
                    Firma de correo
                  </label>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--borde-sutil)' }}
                  >
                    <EditorTexto
                      contenido={((canal.config_conexion as Record<string, unknown>).firma || '') as string}
                      onChange={(html: string) => {
                        // Autoguardado con debounce — usa el mismo patrón que EditorFirmaCanal
                        clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)[`firma_${canal.id}`])
                        ;(window as unknown as Record<string, ReturnType<typeof setTimeout>>)[`firma_${canal.id}`] = setTimeout(async () => {
                          await fetch(`/api/inbox/canales/${canal.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              config_conexion: { ...(canal.config_conexion as Record<string, unknown>), firma: html },
                            }),
                          })
                        }, 1000)
                      }}
                      placeholder="Ej: Juan Pérez — Ventas — Mi Empresa S.A."
                      alturaMinima={80}
                    />
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2">
                {esWhatsApp && (
                  <Boton
                    variante="secundario"
                    tamano="xs"
                    onClick={consultarCalidad}
                    cargando={cargandoCalidad}
                  >
                    Consultar calidad
                  </Boton>
                )}
                {!esWhatsApp && !canal.es_principal && onHacerPrincipal && (
                  <Boton
                    variante="secundario"
                    tamano="xs"
                    icono={<Shield size={12} />}
                    onClick={() => setModalPrincipal(true)}
                  >
                    Hacer principal
                  </Boton>
                )}
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  icono={<Pencil size={12} />}
                  onClick={() => setEditando(true)}
                >
                  {t('comun.editar')}
                </Boton>
                <Boton
                  variante="peligro"
                  tamano="xs"
                  icono={<Trash2 size={12} />}
                  onClick={() => setModalEliminar(true)}
                >
                  {t('comun.eliminar')}
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal confirmar eliminación */}
      <ModalConfirmacion
        abierto={modalEliminar}
        onCerrar={() => setModalEliminar(false)}
        onConfirmar={handleEliminar}
        titulo={`${t('comun.eliminar')} ${canal.nombre}`}
        descripcion={`¿Estás seguro de que querés eliminar la conexión "${canal.nombre}"? Esta acción no se puede deshacer. Se perderán todas las conversaciones y mensajes asociados a este canal.`}
        tipo="peligro"
        etiquetaConfirmar="Sí, eliminar"
        cargando={eliminando}
      />

      {/* Modal confirmar hacer principal */}
      <ModalConfirmacion
        abierto={modalPrincipal}
        onCerrar={() => setModalPrincipal(false)}
        onConfirmar={() => {
          setModalPrincipal(false)
          onHacerPrincipal?.(canal.id)
        }}
        titulo="Cambiar cuenta principal"
        descripcion={`"${canal.nombre}" será la nueva cuenta principal. Todos los correos que no tengan una regla por tipo de contacto se enviarán desde esta bandeja.`}
        tipo="info"
        etiquetaConfirmar="Sí, hacer principal"
      />

      {/* Modal editar canal */}
      {editando && (
        <ModalAgregarCanal
          abierto={editando}
          onCerrar={() => setEditando(false)}
          tipoCanal={canal.tipo as TipoCanal}
          onCanalCreado={() => { setEditando(false); onRecargar?.() }}
          canalEditar={{
            id: canal.id,
            nombre: canal.nombre,
            proveedor: canal.proveedor,
            config_conexion: canal.config_conexion as Record<string, unknown>,
            modulos_disponibles: canal.modulos_disponibles || [],
          }}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Insignia } from '@/componentes/ui/Insignia'
import { Alerta } from '@/componentes/ui/Alerta'
import { Avatar } from '@/componentes/ui/Avatar'
import {
  Plus, Zap, Settings, Check, Eye, EyeOff,
  Copy, Phone, Shield, Smartphone, ChevronDown, ChevronUp,
  BarChart3, Trash2, HelpCircle, Users, Bell, RefreshCw,
  CircleDot, Pencil, Globe, Link2, CheckCircle,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useTraduccion } from '@/lib/i18n'
import type { CanalInbox } from '@/tipos/inbox'

/**
 * Sección completa de configuración de WhatsApp.
 * Replica la UX del software anterior: stepper de progreso, formulario guiado,
 * preview de firma, modo coexistencia, FAQs, calidad del número.
 */

interface PropiedadesSeccionWhatsApp {
  canales: CanalInbox[]
  onRecargar: () => void
}

// Campos requeridos para Meta API
const CAMPOS_META = [
  { clave: 'nombre', etiqueta: 'Nombre' },
  { clave: 'numeroTelefono', etiqueta: 'Teléfono' },
  { clave: 'phoneNumberId', etiqueta: 'Phone ID' },
  { clave: 'idAppMeta', etiqueta: 'App ID' },
  { clave: 'tokenVerificacion', etiqueta: 'Verificación' },
  { clave: 'tokenAcceso', etiqueta: 'Token acceso' },
  { clave: 'secretoWebhook', etiqueta: 'Clave secreta' },
]

// Formatear teléfono para mostrar bonito (+54 9 11 2715-49993)
function formatearTelefono(tel: string): string {
  if (!tel) return ''
  const limpio = tel.replace(/\D/g, '')
  // Argentina: +54 9 XX XXXX-XXXX
  if (limpio.startsWith('54') && limpio.length >= 12) {
    const codigo = limpio.slice(2, 3) === '9' ? limpio.slice(3, 5) : limpio.slice(2, 4)
    const resto = limpio.slice(limpio.length - 8)
    return `+54 9 ${codigo} ${resto.slice(0, 4)}-${resto.slice(4)}`
  }
  // Genérico: agrupar de a 4
  if (limpio.length > 4) {
    return '+' + limpio.replace(/(\d{2})(\d{2,4})(\d{4})(\d+)?/, '$1 $2 $3-$4').replace(/-$/, '')
  }
  return tel
}

export function SeccionWhatsApp({ canales, onRecargar }: PropiedadesSeccionWhatsApp) {
  const { t } = useTraduccion()
  const canalesWA = canales.filter(c => c.tipo === 'whatsapp')
  const [cuentaActiva, setCuentaActiva] = useState<string | null>(canalesWA[0]?.id || null)
  const [modoCrear, setModoCrear] = useState(false)

  // Si los canales cambian (después de crear uno nuevo), seleccionar el último
  useEffect(() => {
    if (canalesWA.length > 0 && !cuentaActiva && !modoCrear) {
      setCuentaActiva(canalesWA[canalesWA.length - 1].id)
    }
  }, [canales])

  const canalActivo = canalesWA.find(c => c.id === cuentaActiva) || null

  // Callback después de crear: recargar canales, cerrar formulario, seleccionar la nueva
  const handleCuentaCreada = () => {
    setModoCrear(false)
    setCuentaActiva(null) // Se auto-selecciona en el useEffect cuando llegan los nuevos canales
    onRecargar()
  }

  return (
    <div className="space-y-6">
      {/* Descripción */}
      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
        Conectá tu número de WhatsApp Business para enviar y recibir mensajes
      </p>

      {/* Card principal */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          border: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-tarjeta)',
        }}
      >
        {/* Header con tabs de cuentas */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                WhatsApp Business
              </h3>
              <p className="text-xxs mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
                {canalesWA.length} conexión{canalesWA.length !== 1 ? 'es' : ''} configurada{canalesWA.length !== 1 ? 's' : ''}
              </p>
            </div>
            {canalesWA.length > 0 && (
              <Insignia color="exito" tamano="sm">
                {canalesWA.filter(c => c.activo).length}/{canalesWA.length} activas
              </Insignia>
            )}
          </div>

          {/* Tabs de cuentas */}
          <div className="flex items-center gap-2 flex-wrap">
            {canalesWA.map((c) => {
              const activa = c.id === cuentaActiva
              return (
                <button
                  key={c.id}
                  onClick={() => { setCuentaActiva(c.id); setModoCrear(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: activa ? 'var(--superficie-seleccionada)' : 'transparent',
                    border: activa ? '2px solid var(--canal-whatsapp)' : '1px solid var(--borde-sutil)',
                    color: activa ? 'var(--texto-primario)' : 'var(--texto-secundario)',
                  }}
                >
                  <CircleDot size={8} style={{ color: c.activo ? 'var(--canal-whatsapp)' : 'var(--texto-terciario)' }} />
                  {c.nombre}
                  {c.activo && <Check size={10} style={{ color: 'var(--canal-whatsapp)' }} />}
                </button>
              )
            })}
            <button
              onClick={() => { setModoCrear(true); setCuentaActiva(null) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{
                border: modoCrear ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)',
                color: 'var(--texto-secundario)',
              }}
            >
              <Plus size={12} /> Manual
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{ border: '1px solid var(--borde-sutil)', color: 'var(--texto-secundario)' }}
            >
              <Zap size={12} /> Meta
            </button>
          </div>
        </div>

        {/* Contenido: formulario de la cuenta */}
        {modoCrear ? (
          <FormularioNuevaCuenta onCrear={handleCuentaCreada} onCancelar={() => setModoCrear(false)} />
        ) : canalActivo ? (
          <DetalleCuenta canal={canalActivo} onRecargar={onRecargar} />
        ) : (
          <div className="p-8 text-center">
            <IconoWhatsApp size={32} style={{ color: 'var(--texto-terciario)', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
              Seleccioná una cuenta o creá una nueva
            </p>
          </div>
        )}
      </div>

      {/* Notificaciones push */}
      <NotificacionesPush />
    </div>
  )
}

// ═══════════════════════════════════════
// DETALLE DE UNA CUENTA EXISTENTE
// ═══════════════════════════════════════

function DetalleCuenta({ canal, onRecargar }: { canal: CanalInbox; onRecargar: () => void }) {
  const { t } = useTraduccion()
  const config = canal.config_conexion as Record<string, unknown>
  const [guardando, setGuardando] = useState(false)
  const [calidad, setCalidad] = useState<{ rating: string; tier: string; status: string } | null>(
    config.calidadActual as { rating: string; tier: string; status: string } | null
  )
  const [cargandoCalidad, setCargandoCalidad] = useState(false)
  const [faqAbierta, setFaqAbierta] = useState<string | null>(null)

  // Campos visibles/ocultos
  const [mostrarToken, setMostrarToken] = useState(false)
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false)
  const [mostrarSecreto, setMostrarSecreto] = useState(false)

  // Config de firma
  const [firmaActiva, setFirmaActiva] = useState((config.firmaActiva as boolean) || false)
  const [coexistencia, setCoexistencia] = useState((config.coexistencia as boolean) || false)

  // Stepper: calcular campos completados
  const camposCompletados = CAMPOS_META.filter(c => {
    if (c.clave === 'nombre') return !!canal.nombre
    return !!config[c.clave]
  }).length

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

  const guardarCampo = async (campo: string, valor: unknown) => {
    setGuardando(true)
    try {
      const nuevaConfig = { ...config, [campo]: valor }
      await fetch(`/api/inbox/canales/${canal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_conexion: nuevaConfig }),
      })
    } catch { /* silenciar */ }
    setGuardando(false)
  }

  const copiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/inbox/whatsapp/webhook`
    : '/api/inbox/whatsapp/webhook'

  return (
    <div className="space-y-5 p-5">

      {/* ═══ Stepper de progreso ═══ */}
      <div
        className="rounded-lg p-5"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Pencil size={14} style={{ color: 'var(--texto-secundario)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {canal.nombre}
            </span>
          </div>
          <Insignia color={camposCompletados === 7 ? 'exito' : 'advertencia'} tamano="sm">
            {camposCompletados}/7
          </Insignia>
        </div>

        {/* Stepper visual — scroll horizontal en pantallas chicas */}
        <div className="overflow-x-auto">
          <div className="flex items-center min-w-[500px]">
            {CAMPOS_META.map((campo, i) => {
              const completado = campo.clave === 'nombre' ? !!canal.nombre : !!config[campo.clave]
              return (
                <div key={campo.clave} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 48 }}>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xxs font-bold flex-shrink-0"
                      style={{
                        background: completado ? 'var(--insignia-exito)' : 'var(--superficie-hover)',
                        color: completado ? 'var(--texto-inverso)' : 'var(--texto-terciario)',
                      }}
                    >
                      {completado ? <Check size={10} /> : i + 1}
                    </div>
                    <span className="text-xxs text-center leading-tight whitespace-nowrap" style={{ color: 'var(--texto-terciario)' }}>
                      {campo.etiqueta}
                    </span>
                  </div>
                  {i < CAMPOS_META.length - 1 && (
                    <div
                      className="h-0.5 flex-1 mx-1 rounded-full mt-[-16px]"
                      style={{ background: completado ? 'var(--insignia-exito)' : 'var(--borde-sutil)', minWidth: 16 }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ Datos básicos ═══ */}
      <div
        className="rounded-lg p-5 space-y-5"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        {/* Nombre */}
        <CampoConIndicador etiqueta={t('configuracion.whatsapp.nombre_descriptivo')} completado={!!canal.nombre}>
          <Input
            defaultValue={canal.nombre}
            placeholder="WhatsApp Ventas"
            onBlur={(e) => {
              if (e.target.value !== canal.nombre) {
                fetch(`/api/inbox/canales/${canal.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nombre: e.target.value }),
                }).then(onRecargar)
              }
            }}
          />
        </CampoConIndicador>

        {/* Tipo de integración */}
        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--texto-primario)' }}>
            Tipo de integración
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-4 rounded-lg cursor-pointer"
              style={{
                border: canal.proveedor === 'meta_api' ? '2px solid var(--insignia-exito)' : '1px solid var(--borde-sutil)',
                background: canal.proveedor === 'meta_api' ? 'var(--insignia-exito-fondo)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--insignia-exito)' }}>
                  Meta Cloud API
                </span>
                {canal.proveedor === 'meta_api' && <CheckCircle size={14} style={{ color: 'var(--insignia-exito)' }} />}
              </div>
              <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                Conexión directa con Meta — sin intermediarios ni costos extra
              </p>
            </div>
            <div
              className="p-4 rounded-lg cursor-pointer"
              style={{ border: canal.proveedor === 'twilio' ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
                Servicio intermediario
              </span>
              <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
                WATI, 360dialog, Vonage u otro proveedor compatible
              </p>
            </div>
          </div>
        </div>

        {/* Número de teléfono */}
        <CampoConIndicador
          etiqueta={t('configuracion.whatsapp.numero_telefono')}
          completado={!!(config.numeroTelefono || config.numero_telefono)}
        >
          <Input
            tipo="tel"
            formato="telefono"
            icono={<Phone size={14} />}
            defaultValue={(config.numeroTelefono || config.numero_telefono || '') as string}
            placeholder="+54 9 11 5555-1234"
            onBlur={(e) => guardarCampo('numeroTelefono', e.target.value)}
          />
        </CampoConIndicador>
      </div>

      {/* ═══ Credenciales Meta Cloud API ═══ */}
      {canal.proveedor === 'meta_api' && (
        <div
          className="rounded-lg p-5 space-y-5"
          style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
        >
          <div className="flex items-center gap-2">
            <Globe size={14} style={{ color: 'var(--insignia-exito)' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--insignia-exito)' }}>
              Meta Cloud API
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoAPI
              etiqueta={t('configuracion.whatsapp.phone_id')}
              ayuda='En Meta: Configuración de la API → "Identificador de número de teléfono"'
              valor={(config.phoneNumberId || config.phone_number_id || '') as string}
              completado={!!(config.phoneNumberId || config.phone_number_id)}
              onGuardar={(v) => guardarCampo('phoneNumberId', v)}
            />
            <CampoAPI
              etiqueta={t('configuracion.whatsapp.app_id')}
              ayuda='En Meta: Configuración → Basic → "Identificador de la app"'
              valor={(config.idAppMeta || '') as string}
              completado={!!config.idAppMeta}
              onGuardar={(v) => guardarCampo('idAppMeta', v)}
            />
          </div>

          <CampoAPI
            etiqueta={t('configuracion.whatsapp.waba_id')}
            ayuda="En Meta: Business Manager → Configuración → Cuentas → Cuentas de WhatsApp → ID"
            valor={(config.wabaId || config.waba_id || '') as string}
            completado={!!(config.wabaId || config.waba_id)}
            onGuardar={(v) => guardarCampo('wabaId', v)}
            anchoCompleto
          />

          <CampoConIndicador
            etiqueta={t('configuracion.whatsapp.token_verificacion')}
            completado={!!config.tokenVerificacion}
            ayuda='En Meta: Configuración → Webhook → "Token de verificación" — inventás vos este valor y lo pegás en ambos lados'
          >
            <CampoSecreto
              valor={(config.tokenVerificacion || '') as string}
              visible={mostrarVerificacion}
              onToggle={() => setMostrarVerificacion(!mostrarVerificacion)}
              onGuardar={(v) => guardarCampo('tokenVerificacion', v)}
              placeholder="Un token secreto que vos elegís"
            />
          </CampoConIndicador>

          <CampoConIndicador
            etiqueta={t('configuracion.whatsapp.token_acceso')}
            completado={!!config.tokenAcceso}
            extra={config.tokenAcceso ? '(ya guardado — dejá en blanco para no cambiar)' : undefined}
            ayuda='En Meta: Configuración de la API → "Generar token de acceso"'
          >
            <CampoSecreto
              valor={(config.tokenAcceso || config.access_token || '') as string}
              visible={mostrarToken}
              onToggle={() => setMostrarToken(!mostrarToken)}
              onGuardar={(v) => guardarCampo('tokenAcceso', v)}
              placeholder="Token de acceso permanente"
            />
          </CampoConIndicador>

          <CampoConIndicador
            etiqueta={t('configuracion.whatsapp.clave_secreta')}
            completado={!!config.secretoWebhook}
            extra={config.secretoWebhook ? '(ya guardada)' : undefined}
            ayuda='En Meta: Configuración → Basic → "Clave secreta de la app" → Mostrar'
          >
            <CampoSecreto
              valor={(config.secretoWebhook || '') as string}
              visible={mostrarSecreto}
              onToggle={() => setMostrarSecreto(!mostrarSecreto)}
              onGuardar={(v) => guardarCampo('secretoWebhook', v)}
              placeholder="Clave secreta para verificar webhooks"
            />
          </CampoConIndicador>

          {/* URL del webhook */}
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
              URL de devolución de llamada
            </p>
            <p className="text-xxs mb-2" style={{ color: 'var(--texto-terciario)' }}>
              En Meta: Configuración → Webhook → copiá y pegá este valor
            </p>
            <div
              className="flex items-center gap-2 p-3 rounded-lg font-mono text-xs"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
            >
              <span className="flex-1 break-all">{webhookUrl}</span>
              <button
                onClick={() => copiarTexto(webhookUrl)}
                className="p-1.5 rounded-md transition-colors flex-shrink-0"
                style={{ color: 'var(--texto-terciario)', background: 'var(--superficie-app)' }}
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Firma de agente ═══ */}
      <div
        className="rounded-lg p-5"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Firma de agente
            </p>
            <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Agrega automáticamente el nombre y sector del agente al final de cada mensaje enviado. Similar a una firma de correo.
            </p>
          </div>
          <Interruptor
            activo={firmaActiva}
            onChange={(v) => { setFirmaActiva(v); guardarCampo('firmaActiva', v) }}
          />
        </div>
        {firmaActiva && (
          <div
            className="mt-4 p-4 rounded-lg"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <p className="text-xxs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--texto-terciario)' }}>
              Vista previa — cómo lo ve el cliente
            </p>
            <div
              className="inline-block px-4 py-3 rounded-lg"
              style={{ background: 'var(--superficie-app)' }}
            >
              <p className="text-xs font-bold" style={{ color: 'var(--texto-primario)' }}>
                J.G. | Ventas:
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--texto-primario)' }}>
                Hola, ¿en qué te puedo ayudar?
              </p>
            </div>
            <p className="text-xxs mt-3" style={{ color: 'var(--texto-terciario)' }}>
              Las iniciales y sector se agregan automáticamente encima del mensaje. El cliente ve el nombre del agente en negrita.
            </p>
          </div>
        )}
      </div>

      {/* ═══ Modo coexistencia ═══ */}
      <div
        className="rounded-lg p-5"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3 pr-4">
            <Smartphone size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--texto-marca)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                Modo coexistencia
              </p>
              <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
                Permite usar este número en la app WhatsApp Business del teléfono <strong>y</strong> en Flux al mismo tiempo. Si lo desactivás, el número solo funcionará a través de Flux.
              </p>
            </div>
          </div>
          <Interruptor
            activo={coexistencia}
            onChange={(v) => { setCoexistencia(v); guardarCampo('coexistencia', v) }}
          />
        </div>
        {!coexistencia && (
          <div className="mt-4">
            <Alerta tipo="info">
              Con la coexistencia desactivada, este número solo funciona a través de Flux. Ideal para equipos grandes donde se necesita centralizar toda la comunicación en un solo lugar.
            </Alerta>
          </div>
        )}
      </div>

      {/* ═══ FAQs ═══ */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        <FAQItem
          icono={<HelpCircle size={14} />}
          titulo="¿Cómo obtener mis credenciales de Meta?"
          abierta={faqAbierta === 'credenciales'}
          onToggle={() => setFaqAbierta(faqAbierta === 'credenciales' ? null : 'credenciales')}
        >
          <ol className="text-xs space-y-2.5 list-decimal pl-4" style={{ color: 'var(--texto-secundario)' }}>
            <li>Andá a <strong>developers.facebook.com</strong> y creá una app de tipo "Business"</li>
            <li>Agregá el producto "WhatsApp" a tu app</li>
            <li>En <strong>Configuración de la API</strong> vas a encontrar el Phone Number ID y podés generar un token de acceso permanente</li>
            <li>El <strong>WABA ID</strong> lo encontrás en Business Manager → Configuración → Cuentas → Cuentas de WhatsApp</li>
            <li>La <strong>Clave secreta</strong> está en Configuración → Basic → Clave secreta de la app</li>
            <li>El <strong>Token de verificación</strong> lo inventás vos — es un texto que ponés acá y también en Meta al configurar el webhook</li>
          </ol>
        </FAQItem>
        <FAQItem
          icono={<Smartphone size={14} />}
          titulo="¿Qué es la coexistencia y cómo activarla en Meta?"
          abierta={faqAbierta === 'coexistencia'}
          onToggle={() => setFaqAbierta(faqAbierta === 'coexistencia' ? null : 'coexistencia')}
        >
          <div className="text-xs space-y-2.5" style={{ color: 'var(--texto-secundario)' }}>
            <p>La coexistencia permite que el mismo número funcione en la app WhatsApp Business del teléfono y en Flux al mismo tiempo.</p>
            <p>Para activarla en Meta: Business Manager → Configuración → Cuentas de WhatsApp → tu cuenta → Configuración → Coexistencia → Activar.</p>
            <p><strong>Importante:</strong> Si la desactivás, los mensajes solo se recibirán en Flux y no en el teléfono.</p>
          </div>
        </FAQItem>
      </div>

      {/* ═══ Calidad del número ═══ */}
      <div
        className="rounded-lg p-5"
        style={{ border: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <BarChart3 size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                Calidad del número
              </p>
              {calidad ? (
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
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
                    Tier: {calidad.tier} · {calidad.status}
                  </span>
                </div>
              ) : (
                <p className="text-xxs mt-1" style={{ color: 'var(--texto-terciario)' }}>
                  Sin datos de calidad. Tocá "Verificar" para consultar a Meta.
                </p>
              )}
            </div>
          </div>
          <Boton
            variante="secundario"
            tamano="xs"
            icono={<RefreshCw size={12} />}
            onClick={consultarCalidad}
            cargando={cargandoCalidad}
          >
            Verificar
          </Boton>
        </div>
      </div>

      {/* ═══ Eliminar ═══ */}
      <div className="pt-2">
        <button
          className="flex items-center gap-2 text-xs transition-colors"
          style={{ color: 'var(--insignia-peligro)' }}
        >
          <Trash2 size={14} />
          Eliminar esta conexión
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// FORMULARIO NUEVA CUENTA
// ═══════════════════════════════════════

function FormularioNuevaCuenta({ onCrear, onCancelar }: { onCrear: () => void; onCancelar: () => void }) {
  const { t } = useTraduccion()
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [proveedor, setProveedor] = useState<'meta_api' | 'twilio'>('meta_api')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/inbox/canales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'whatsapp',
          nombre: nombre.trim(),
          proveedor,
          config_conexion: { numeroTelefono: numero },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear')
        return
      }
      onCrear()
    } catch {
      setError('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {error && <Alerta tipo="peligro" cerrable onCerrar={() => setError('')}>{error}</Alerta>}

      <Input
        etiqueta={t('configuracion.whatsapp.nombre_cuenta')}
        placeholder="WhatsApp Ventas"
        defaultValue={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <Input
        etiqueta={t('configuracion.whatsapp.numero_telefono')}
        placeholder="+54 9 11 5555-1234"
        defaultValue={numero}
        onChange={(e) => setNumero(e.target.value)}
      />

      <div className="flex items-center gap-2 pt-2">
        <Boton variante="primario" tamano="sm" onClick={handleCrear} cargando={guardando}>
          Crear cuenta
        </Boton>
        <Boton variante="secundario" tamano="sm" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════

function CampoConIndicador({
  etiqueta, completado, ayuda, extra, children,
}: {
  etiqueta: string; completado: boolean; ayuda?: string; extra?: string; children: React.ReactNode
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          {etiqueta}
        </p>
        {completado && <CheckCircle size={14} style={{ color: 'var(--insignia-exito)' }} />}
        {extra && (
          <span className="text-xxs" style={{ color: 'var(--insignia-exito)' }}>
            {extra}
          </span>
        )}
      </div>
      {ayuda && (
        <p className="text-xxs mb-2" style={{ color: 'var(--texto-terciario)' }}>
          {ayuda}
        </p>
      )}
      {children}
    </div>
  )
}

function CampoAPI({
  etiqueta, ayuda, valor, completado, onGuardar, anchoCompleto,
}: {
  etiqueta: string; ayuda: string; valor: string; completado: boolean
  onGuardar: (v: string) => void; anchoCompleto?: boolean
}) {
  return (
    <div className={anchoCompleto ? 'col-span-2' : ''}>
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>
          {etiqueta}
        </p>
        {completado && <CheckCircle size={12} style={{ color: 'var(--insignia-exito)' }} />}
      </div>
      <p className="text-xxs mb-1.5" style={{ color: 'var(--texto-terciario)' }}>
        {ayuda}
      </p>
      <Input
        defaultValue={valor}
        onBlur={(e) => { if (e.target.value !== valor) onGuardar(e.target.value) }}
        placeholder="—"
      />
    </div>
  )
}

function CampoSecreto({
  valor, visible, onToggle, onGuardar, placeholder,
}: {
  valor: string; visible: boolean; onToggle: () => void
  onGuardar: (v: string) => void; placeholder: string
}) {
  return (
    <div className="relative">
      <Input
        tipo={visible ? 'text' : 'password'}
        defaultValue={valor}
        placeholder={placeholder}
        onBlur={(e) => { if (e.target.value && e.target.value !== valor) onGuardar(e.target.value) }}
      />
      <button
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
        style={{ color: 'var(--texto-terciario)' }}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function FAQItem({
  icono, titulo, abierta, onToggle, children,
}: {
  icono: React.ReactNode; titulo: string; abierta: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-4 text-sm font-medium transition-colors"
        style={{
          color: 'var(--texto-primario)',
          background: abierta ? 'var(--superficie-hover)' : 'transparent',
        }}
      >
        <span style={{ color: 'var(--texto-terciario)' }}>{icono}</span>
        <span className="flex-1 text-left">{titulo}</span>
        {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-3 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotificacionesPush() {
  const [modo, setModo] = useState<'admins' | 'elegir' | 'nadie'>('admins')

  return (
    <div
      className="rounded-lg p-4"
      style={{
        border: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
        Notificaciones push (sin asignar)
      </h3>
      <p className="text-xxs mt-0.5 mb-3" style={{ color: 'var(--texto-terciario)' }}>
        Cuando un mensaje de WhatsApp llega a una conversación sin agente asignado, ¿quién recibe la notificación push?
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { clave: 'admins' as const, etiqueta: 'Todos los admins', icono: <Users size={12} /> },
          { clave: 'elegir' as const, etiqueta: 'Elegir personas', icono: <Users size={12} /> },
          { clave: 'nadie' as const, etiqueta: 'Nadie', icono: <Bell size={12} /> },
        ].map((opcion) => (
          <button
            key={opcion.clave}
            onClick={() => setModo(opcion.clave)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: modo === opcion.clave ? 'var(--texto-marca)' : 'var(--superficie-hover)',
              color: modo === opcion.clave ? 'var(--texto-inverso)' : 'var(--texto-secundario)',
            }}
          >
            {opcion.icono}
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Boton variante="primario" tamano="xs" icono={<Check size={12} />}>
          Guardar
        </Boton>
        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
          Las conversaciones asignadas siempre notifican al agente asignado.
        </span>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Alerta } from '@/componentes/ui/Alerta'
import {
  Mail, Smartphone, Globe, Lock,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useTraduccion } from '@/lib/i18n'
import type { TipoCanal, ProveedorCanal } from '@/tipos/inbox'

/**
 * Modal para agregar un nuevo canal de WhatsApp o Correo.
 * Se usa en: configuración del inbox, secciones WhatsApp y Correo.
 */

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  tipoCanal: TipoCanal
  onCanalCreado: () => void
  /** Si se pasa, el modal entra en modo edición con datos precargados */
  canalEditar?: {
    id: string
    nombre: string
    proveedor: string | null
    config_conexion: Record<string, unknown>
  } | null
}

// Proveedores disponibles por tipo de canal
const PROVEEDORES_WA = [
  { valor: 'meta_api', etiqueta: 'Meta Business API', descripcion: 'Conexión oficial de WhatsApp Business' },
  { valor: 'twilio', etiqueta: 'Twilio', descripcion: 'A través de la plataforma Twilio' },
]

const PROVEEDORES_CORREO = [
  { valor: 'gmail_oauth', etiqueta: 'Gmail (Google)', descripcion: 'Conectar cuenta de Gmail directamente' },
  { valor: 'outlook_oauth', etiqueta: 'Outlook / Microsoft 365', descripcion: 'Conectar cuenta de Outlook, Hotmail o Microsoft 365' },
  { valor: 'imap', etiqueta: 'IMAP/SMTP', descripcion: 'Cualquier servidor de correo (Yahoo, propio, etc.)' },
]

export function ModalAgregarCanal({ abierto, onCerrar, tipoCanal, onCanalCreado, canalEditar }: PropiedadesModal) {
  const { t } = useTraduccion()
  const modoEdicion = !!canalEditar
  const cfg = canalEditar?.config_conexion || {}

  const [paso, setPaso] = useState(modoEdicion ? 2 : 1) // Si edita, ir directo a paso 2
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Campos — precargados si es edición
  const [nombre, setNombre] = useState(canalEditar?.nombre || '')
  const [proveedor, setProveedor] = useState<ProveedorCanal>(
    (canalEditar?.proveedor as ProveedorCanal) || null
  )

  // IMAP
  const [imapHost, setImapHost] = useState((cfg.host || '') as string)
  const [imapPuerto, setImapPuerto] = useState(String(cfg.puerto || '993'))
  const [imapUsuario, setImapUsuario] = useState((cfg.usuario || '') as string)
  const [imapPassword, setImapPassword] = useState('')  // No precargar contraseñas
  const [imapSSL, setImapSSL] = useState((cfg.ssl as boolean) ?? true)
  const [smtpHost, setSmtpHost] = useState((cfg.smtp_host || '') as string)
  const [smtpPuerto, setSmtpPuerto] = useState(String(cfg.smtp_puerto || '587'))

  // WhatsApp Meta
  const [waPhoneId, setWaPhoneId] = useState((cfg.phoneNumberId || cfg.phone_number_id || '') as string)
  const [waAccessToken, setWaAccessToken] = useState('') // No precargar tokens
  const [waWabaId, setWaWabaId] = useState((cfg.wabaId || cfg.waba_id || '') as string)
  const [waNumero, setWaNumero] = useState((cfg.numeroTelefono || cfg.numero_telefono || '') as string)

  // WhatsApp Twilio
  const [twilioSid, setTwilioSid] = useState((cfg.account_sid || '') as string)
  const [twilioToken, setTwilioToken] = useState('') // No precargar tokens
  const [twilioNumero, setTwilioNumero] = useState((cfg.from_number || '') as string)

  // Gmail
  const [gmailEmail, setGmailEmail] = useState((cfg.email || '') as string)

  const proveedores = tipoCanal === 'whatsapp' ? PROVEEDORES_WA : PROVEEDORES_CORREO

  const resetear = () => {
    setPaso(1)
    setNombre('')
    setProveedor(null)
    setError('')
    setImapHost('')
    setImapUsuario('')
    setImapPassword('')
    setWaPhoneId('')
    setWaAccessToken('')
    setWaWabaId('')
    setWaNumero('')
    setTwilioSid('')
    setTwilioToken('')
    setTwilioNumero('')
    setGmailEmail('')
  }

  const handleCerrar = () => {
    resetear()
    onCerrar()
  }

  const handleGuardar = async () => {
    if (!nombre.trim() || !proveedor) {
      setError('Completá el nombre y seleccioná un proveedor')
      return
    }

    // Gmail/Outlook OAuth: iniciar flujo de autorización en vez de guardar directo
    if (proveedor === 'gmail_oauth' || proveedor === 'outlook_oauth') {
      setGuardando(true)
      setError('')
      try {
        const res = await fetch('/api/inbox/correo/oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canal_id: modoEdicion ? canalEditar?.id : null,
            nombre: nombre.trim() || gmailEmail,
          }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          setError(data.error || 'Error al iniciar conexión con Google')
        }
      } catch {
        setError('Error de conexión. Verificá tu red.')
      } finally {
        setGuardando(false)
      }
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Construir config según proveedor
      let config_conexion: Record<string, unknown> = {}

      if (proveedor === 'imap') {
        config_conexion = {
          host: imapHost,
          puerto: parseInt(imapPuerto),
          usuario: imapUsuario,
          password_cifrada: imapPassword, // TODO: cifrar en servidor
          ssl: imapSSL,
          smtp_host: smtpHost || imapHost,
          smtp_puerto: parseInt(smtpPuerto),
        }
      } else if (proveedor === 'meta_api') {
        config_conexion = {
          phone_number_id: waPhoneId,
          access_token: waAccessToken,
          waba_id: waWabaId,
          numero_telefono: waNumero,
        }
      } else if (proveedor === 'twilio') {
        config_conexion = {
          account_sid: twilioSid,
          auth_token: twilioToken,
          from_number: twilioNumero,
        }
      }

      let res: Response

      if (modoEdicion && canalEditar) {
        // En edición: solo enviar campos que cambiaron, no pisar tokens existentes si están vacíos
        const configFinal = { ...cfg }
        for (const [k, v] of Object.entries(config_conexion)) {
          if (v !== '' && v !== undefined) configFinal[k] = v
        }

        res = await fetch(`/api/inbox/canales/${canalEditar.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            config_conexion: configFinal,
          }),
        })
      } else {
        res = await fetch('/api/inbox/canales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: tipoCanal,
            nombre: nombre.trim(),
            proveedor,
            config_conexion,
          }),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || (modoEdicion ? 'Error al guardar' : 'Error al crear el canal'))
        return
      }

      onCanalCreado()
      handleCerrar()
    } catch {
      setError('Error de conexión. Verificá tu red.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={handleCerrar}
      titulo={modoEdicion
        ? `Editar ${canalEditar?.nombre || 'canal'}`
        : tipoCanal === 'whatsapp' ? 'Agregar canal de WhatsApp' : 'Agregar bandeja de correo'
      }
      tamano="lg"
      acciones={
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={handleCerrar}>
            Cancelar
          </Boton>
          {paso === 1 ? (
            <Boton
              variante="primario"
              tamano="sm"
              onClick={() => proveedor ? setPaso(2) : setError('Seleccioná un proveedor')}
              disabled={!proveedor}
            >
              Siguiente
            </Boton>
          ) : (
            <Boton
              variante="primario"
              tamano="sm"
              onClick={handleGuardar}
              cargando={guardando}
              disabled={!nombre.trim()}
            >
              {modoEdicion ? 'Guardar cambios' : 'Conectar'}
            </Boton>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alerta tipo="peligro" cerrable onCerrar={() => setError('')}>
            {error}
          </Alerta>
        )}

        {/* Paso 1: Seleccionar proveedor */}
        {paso === 1 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
              Seleccioná cómo querés conectar {tipoCanal === 'whatsapp' ? 'WhatsApp' : 'el correo'}:
            </p>
            <div className="space-y-2">
              {proveedores.map((p) => (
                <button
                  key={p.valor}
                  onClick={() => setProveedor(p.valor as ProveedorCanal)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                  style={{
                    border: proveedor === p.valor
                      ? '2px solid var(--texto-marca)'
                      : '1px solid var(--borde-sutil)',
                    background: proveedor === p.valor
                      ? 'var(--superficie-seleccionada)'
                      : 'transparent',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--superficie-hover)' }}
                  >
                    {tipoCanal === 'whatsapp' ? (
                      <IconoWhatsApp size={20} style={{ color: 'var(--canal-whatsapp)' }} />
                    ) : p.valor === 'gmail_oauth' ? (
                      <Globe size={20} style={{ color: '#4285F4' }} />
                    ) : (
                      <Mail size={20} style={{ color: 'var(--canal-correo)' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                      {p.etiqueta}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                      {p.descripcion}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paso 2: Configurar conexión */}
        {paso === 2 && (
          <div className="space-y-4">
            <Input
              etiqueta={t('inbox.nombre_canal')}
              placeholder={tipoCanal === 'whatsapp' ? 'WhatsApp Ventas' : 'ventas@miempresa.com'}
              defaultValue={nombre}
              onBlur={(e) => setNombre(e.target.value)}
              onChange={(e) => setNombre(e.target.value)}
            />

            {/* IMAP */}
            {proveedor === 'imap' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    etiqueta="Servidor IMAP"
                    placeholder="imap.gmail.com"
                    defaultValue={imapHost}
                    onBlur={(e) => setImapHost(e.target.value)}
                    onChange={(e) => setImapHost(e.target.value)}
                  />
                  <Input
                    tipo="number"
                    etiqueta="Puerto IMAP"
                    defaultValue={imapPuerto}
                    onBlur={(e) => setImapPuerto(e.target.value)}
                    onChange={(e) => setImapPuerto(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    etiqueta="Usuario"
                    placeholder="correo@empresa.com"
                    defaultValue={imapUsuario}
                    onBlur={(e) => setImapUsuario(e.target.value)}
                    onChange={(e) => setImapUsuario(e.target.value)}
                  />
                  <Input
                    tipo="password"
                    etiqueta="Contraseña"
                    defaultValue={imapPassword}
                    onBlur={(e) => setImapPassword(e.target.value)}
                    onChange={(e) => setImapPassword(e.target.value)}
                  />
                </div>
                <Interruptor
                  activo={imapSSL}
                  onChange={setImapSSL}
                  etiqueta="Usar SSL/TLS"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    etiqueta="Servidor SMTP (envío)"
                    placeholder="smtp.gmail.com"
                    defaultValue={smtpHost}
                    onBlur={(e) => setSmtpHost(e.target.value)}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    ayuda="Dejalo vacío para usar el mismo host IMAP"
                  />
                  <Input
                    tipo="number"
                    etiqueta="Puerto SMTP"
                    defaultValue={smtpPuerto}
                    onBlur={(e) => setSmtpPuerto(e.target.value)}
                    onChange={(e) => setSmtpPuerto(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Gmail OAuth */}
            {proveedor === 'gmail_oauth' && (
              <>
                <Input
                  tipo="email"
                  etiqueta="Correo de Gmail"
                  placeholder="usuario@gmail.com"
                  defaultValue={gmailEmail}
                  onBlur={(e) => setGmailEmail(e.target.value)}
                  onChange={(e) => setGmailEmail(e.target.value)}
                />
                <Alerta tipo="info">
                  Al conectar, se abrirá una ventana de Google para autorizar el acceso. Solo se accede a tu correo, no se modifica nada más.
                </Alerta>
              </>
            )}

            {/* Meta API */}
            {proveedor === 'meta_api' && (
              <>
                <Input
                  etiqueta="Número de teléfono"
                  placeholder="+54 9 11 5555-1234"
                  defaultValue={waNumero}
                  onBlur={(e) => setWaNumero(e.target.value)}
                  onChange={(e) => setWaNumero(e.target.value)}
                />
                <Input
                  etiqueta="Phone Number ID"
                  placeholder="ID del número en Meta Business"
                  defaultValue={waPhoneId}
                  onBlur={(e) => setWaPhoneId(e.target.value)}
                  onChange={(e) => setWaPhoneId(e.target.value)}
                />
                <Input
                  etiqueta="WABA ID"
                  placeholder="ID de la cuenta de WhatsApp Business"
                  defaultValue={waWabaId}
                  onBlur={(e) => setWaWabaId(e.target.value)}
                  onChange={(e) => setWaWabaId(e.target.value)}
                />
                <Input
                  tipo="password"
                  etiqueta="Access Token"
                  placeholder="Token de acceso permanente"
                  defaultValue={waAccessToken}
                  onBlur={(e) => setWaAccessToken(e.target.value)}
                  onChange={(e) => setWaAccessToken(e.target.value)}
                />
                <Alerta tipo="advertencia">
                  Necesitás una cuenta de Meta Business verificada y acceso a la API de WhatsApp Business.
                </Alerta>
              </>
            )}

            {/* Twilio */}
            {proveedor === 'twilio' && (
              <>
                <Input
                  etiqueta="Número de WhatsApp"
                  placeholder="+14155238886"
                  defaultValue={twilioNumero}
                  onBlur={(e) => setTwilioNumero(e.target.value)}
                  onChange={(e) => setTwilioNumero(e.target.value)}
                />
                <Input
                  etiqueta="Account SID"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  defaultValue={twilioSid}
                  onBlur={(e) => setTwilioSid(e.target.value)}
                  onChange={(e) => setTwilioSid(e.target.value)}
                />
                <Input
                  tipo="password"
                  etiqueta="Auth Token"
                  defaultValue={twilioToken}
                  onBlur={(e) => setTwilioToken(e.target.value)}
                  onChange={(e) => setTwilioToken(e.target.value)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

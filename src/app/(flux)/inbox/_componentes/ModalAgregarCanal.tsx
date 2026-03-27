'use client'

import { useState } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Alerta } from '@/componentes/ui/Alerta'
import {
  MessageCircle, Mail, Smartphone, Globe, Lock,
} from 'lucide-react'
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
}

// Proveedores disponibles por tipo de canal
const PROVEEDORES_WA = [
  { valor: 'meta_api', etiqueta: 'Meta Business API', descripcion: 'Conexión oficial de WhatsApp Business' },
  { valor: 'twilio', etiqueta: 'Twilio', descripcion: 'A través de la plataforma Twilio' },
]

const PROVEEDORES_CORREO = [
  { valor: 'imap', etiqueta: 'IMAP/SMTP', descripcion: 'Cualquier servidor de correo (Outlook, Yahoo, propio)' },
  { valor: 'gmail_oauth', etiqueta: 'Gmail (Google)', descripcion: 'Conectar cuenta de Gmail directamente' },
]

export function ModalAgregarCanal({ abierto, onCerrar, tipoCanal, onCanalCreado }: PropiedadesModal) {
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Campos
  const [nombre, setNombre] = useState('')
  const [proveedor, setProveedor] = useState<ProveedorCanal>(null)

  // IMAP
  const [imapHost, setImapHost] = useState('')
  const [imapPuerto, setImapPuerto] = useState('993')
  const [imapUsuario, setImapUsuario] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapSSL, setImapSSL] = useState(true)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPuerto, setSmtpPuerto] = useState('587')

  // WhatsApp Meta
  const [waPhoneId, setWaPhoneId] = useState('')
  const [waAccessToken, setWaAccessToken] = useState('')
  const [waWabaId, setWaWabaId] = useState('')
  const [waNumero, setWaNumero] = useState('')

  // WhatsApp Twilio
  const [twilioSid, setTwilioSid] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioNumero, setTwilioNumero] = useState('')

  // Gmail
  const [gmailEmail, setGmailEmail] = useState('')

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
      } else if (proveedor === 'gmail_oauth') {
        config_conexion = { email: gmailEmail }
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

      const res = await fetch('/api/inbox/canales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoCanal,
          nombre: nombre.trim(),
          proveedor,
          config_conexion,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear el canal')
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
      titulo={tipoCanal === 'whatsapp' ? 'Agregar canal de WhatsApp' : 'Agregar bandeja de correo'}
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
              Conectar
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
                      <MessageCircle size={20} style={{ color: 'var(--canal-whatsapp)' }} />
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
              etiqueta="Nombre del canal"
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

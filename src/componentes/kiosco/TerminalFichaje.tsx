/**
 * Máquina de estados principal del kiosco de fichaje.
 * Orquesta las 9 pantallas del terminal y maneja la lógica de identificación.
 *
 * Estados: ESPERA → IDENTIFICANDO → ACCIONES → EJECUTANDO → CONFIRMACION → ESPERA
 *          + TECLADO_PIN, SOLICITUD, ERROR
 */
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useEscuchaRFID } from '@/hooks/kiosco/useEscuchaRFID'
import { useEscuchaNFC } from '@/hooks/kiosco/useEscuchaNFC'
import { sonarError } from '@/lib/kiosco/sonidos'
import { capturarFotoInstantanea } from '@/lib/kiosco/camara'

import PantallaEspera from './PantallaEspera'
import PantallaIdentificando from './PantallaIdentificando'
import PantallaAcciones from './PantallaAcciones'
import PantallaConfirmacion from './PantallaConfirmacion'
import PantallaError from './PantallaError'
import PantallaSolicitud, { type DatosSolicitud } from './PantallaSolicitud'
import TecladoPIN from './TecladoPIN'

type EstadoTerminal =
  | 'ESPERA'
  | 'TECLADO_PIN'
  | 'IDENTIFICANDO'
  | 'ACCIONES'
  | 'EJECUTANDO'
  | 'CONFIRMACION'
  | 'ERROR'
  | 'SOLICITUD'

type Accion = 'entrada' | 'salida' | 'almuerzo' | 'volver_almuerzo' | 'particular' | 'volver_particular'

interface ConfigTerminal {
  terminalId: string
  terminalNombre: string
  empresaId: string
  nombreEmpresa: string
  logoUrl?: string | null
  modoEmpresa: 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  metodoLectura: 'rfid_hid' | 'nfc'
  capturarFoto: boolean
  tokenJWT: string
}

interface DatosEmpleado {
  miembroId: string
  nombre: string
  sector?: string | null
  fotoUrl?: string | null
  fechaNacimiento?: string | null
  estadoTurno: 'activo' | 'almuerzo' | 'particular' | null
  yaAlmorzo: boolean
  tieneSolicitudes: boolean
  turnoSinCerrar: boolean
}

interface ResultadoFichaje {
  accion: Accion
  horasTrabajadas?: string | null
  jornadaCompleta?: boolean
  esTardanza?: boolean
  minutosRetraso?: number | null
}

function esCumpleanosHoy(fechaNacimiento: string | null | undefined): boolean {
  if (!fechaNacimiento) return false
  const nacimiento = new Date(fechaNacimiento + 'T12:00:00')
  const hoy = new Date()
  return nacimiento.getDate() === hoy.getDate() && nacimiento.getMonth() === hoy.getMonth()
}

export default function TerminalFichaje({ config }: { config: ConfigTerminal }) {
  const [estado, setEstado] = useState<EstadoTerminal>('ESPERA')
  const [empleado, setEmpleado] = useState<DatosEmpleado | null>(null)
  const [resultado, setResultado] = useState<ResultadoFichaje | null>(null)
  const [mensajeError, setMensajeError] = useState('')
  const fotoCapturada = useRef<Blob | null>(null)
  const metodoUsado = useRef<'rfid' | 'nfc' | 'pin'>('rfid')

  // La cámara NO se mantiene encendida — se abre solo al momento de fichar

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Resetear a pantalla de espera
  const irAEspera = useCallback(() => {
    setEstado('ESPERA')
    setEmpleado(null)
    setResultado(null)
    setMensajeError('')
    fotoCapturada.current = null
  }, [])

  // Mostrar error y volver a espera
  const mostrarError = useCallback((mensaje: string) => {
    sonarError()
    setMensajeError(mensaje)
    setEstado('ERROR')
  }, [])

  // Buscar empleado en la BD por código (RFID/NFC/PIN)
  const identificarEmpleado = useCallback(async (codigo: string, metodo: 'rfid' | 'nfc' | 'pin') => {
    if (estado !== 'ESPERA' && estado !== 'TECLADO_PIN') return

    setEstado('IDENTIFICANDO')
    metodoUsado.current = metodo

    // Capturar foto ANTES de autenticar: abrir cámara → foto → cerrar (~500ms)
    // La persona aún está frente a la cámara, después se identifica
    if (config.capturarFoto) {
      fotoCapturada.current = await capturarFotoInstantanea()
    }

    try {
      const res = await fetch('/api/kiosco/identificar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.tokenJWT}`,
        },
        body: JSON.stringify({
          codigo,
          metodo,
          empresaId: config.empresaId,
          terminalId: config.terminalId,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error de conexión' }))
        const msg = res.status === 404
          ? (metodo === 'pin' ? 'PIN incorrecto o empleado no encontrado' : 'Llavero no registrado. Contactá al administrador.')
          : (error.error || 'Error de conexión. Intentá nuevamente.')
        mostrarError(msg)
        return
      }

      const datos: DatosEmpleado = await res.json()
      setEmpleado(datos)

      // Si no tiene turno abierto y no tiene solicitudes → entrada automática
      if (!datos.estadoTurno && !datos.tieneSolicitudes) {
        await ejecutarAccion('entrada', datos.miembroId)
      } else {
        setEstado('ACCIONES')
      }
    } catch {
      mostrarError('Error de conexión')
    }
  }, [estado, config, mostrarError])

  // Ejecutar acción de fichaje
  const ejecutarAccion = useCallback(async (accion: Accion, miembroIdOverride?: string) => {
    const miembroId = miembroIdOverride || empleado?.miembroId
    if (!miembroId) return

    setEstado('EJECUTANDO')

    try {
      const res = await fetch('/api/kiosco/fichar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.tokenJWT}`,
        },
        body: JSON.stringify({
          miembroId,
          accion,
          empresaId: config.empresaId,
          terminalId: config.terminalId,
          terminalNombre: config.terminalNombre,
          metodo: metodoUsado.current,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error al fichar' }))
        mostrarError(error.error || 'Error al fichar')
        return
      }

      const datos = await res.json()

      // Subir foto si fue capturada y la acción es entrada o salida
      if (fotoCapturada.current && (accion === 'entrada' || accion === 'salida') && datos.asistenciaId) {
        subirFoto(datos.asistenciaId, accion)
      }

      setResultado({
        accion,
        horasTrabajadas: datos.horasTrabajadas,
        jornadaCompleta: datos.jornadaCompleta,
        esTardanza: datos.esTardanza,
        minutosRetraso: datos.minutosRetraso,
      })
      setEstado('CONFIRMACION')
    } catch {
      mostrarError('Error de conexión')
    }
  }, [empleado, config, mostrarError])

  // Subir foto al storage (fire-and-forget)
  const subirFoto = useCallback(async (asistenciaId: string, tipo: 'entrada' | 'salida') => {
    const foto = fotoCapturada.current
    if (!foto) return

    try {
      const formData = new FormData()
      formData.append('foto', foto)
      formData.append('asistenciaId', asistenciaId)
      formData.append('tipo', tipo)
      formData.append('empresaId', config.empresaId)

      await fetch('/api/kiosco/foto', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.tokenJWT}` },
        body: formData,
      })
    } catch {
      // Silencioso — la foto es opcional
    }
  }, [config])

  // Enviar solicitud de fichaje
  const enviarSolicitud = useCallback(async (datos: DatosSolicitud) => {
    if (!empleado) return

    setEstado('EJECUTANDO')

    try {
      const res = await fetch('/api/kiosco/solicitud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.tokenJWT}`,
        },
        body: JSON.stringify({
          miembroId: empleado.miembroId,
          empresaId: config.empresaId,
          terminalNombre: config.terminalNombre,
          ...datos,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Error al enviar' }))
        mostrarError(error.error || 'Error al enviar solicitud')
        return
      }

      setResultado({ accion: 'entrada' }) // Usar entrada para mostrar confirmación genérica
      setEstado('CONFIRMACION')
    } catch {
      mostrarError('Error de conexión')
    }
  }, [empleado, config, mostrarError])

  // Hooks de lectura — solo activos en estado ESPERA
  const escuchaActiva = estado === 'ESPERA'

  useEscuchaRFID({
    alLeer: (codigo) => identificarEmpleado(codigo, 'rfid'),
    activo: escuchaActiva && config.metodoLectura === 'rfid_hid',
  })

  useEscuchaNFC({
    alLeer: (codigo) => identificarEmpleado(codigo, 'nfc'),
    activo: escuchaActiva && config.metodoLectura === 'nfc',
  })

  return (
    <div
      className="h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: 'var(--superficie-app)' }}
    >
      <AnimatePresence mode="wait">
        {estado === 'ESPERA' && (
          <PantallaEspera
            key="espera"
            nombreEmpresa={config.nombreEmpresa}
            logoUrl={config.logoUrl}
            modoEmpresa={config.modoEmpresa}
            metodoLectura={config.metodoLectura}
            nombreTerminal={config.terminalNombre}
            alAbrirPIN={() => setEstado('TECLADO_PIN')}
            alToggleFullscreen={toggleFullscreen}
          />
        )}

        {estado === 'TECLADO_PIN' && (
          <TecladoPIN
            key="pin"
            alEnviar={(pin) => identificarEmpleado(pin, 'pin')}
            alCancelar={irAEspera}
          />
        )}

        {(estado === 'IDENTIFICANDO' || estado === 'EJECUTANDO') && (
          <PantallaIdentificando key="identificando" />
        )}

        {estado === 'ACCIONES' && empleado && (
          <PantallaAcciones
            key="acciones"
            nombre={empleado.nombre}
            fotoUrl={empleado.fotoUrl}
            estadoTurno={empleado.estadoTurno}
            yaAlmorzo={empleado.yaAlmorzo}
            tieneSolicitudes={empleado.tieneSolicitudes}
            alAccionar={(accion) => ejecutarAccion(accion)}
            alReportar={() => setEstado('SOLICITUD')}
            alTimeout={irAEspera}
          />
        )}

        {estado === 'CONFIRMACION' && empleado && resultado && (
          <PantallaConfirmacion
            key="confirmacion"
            nombre={empleado.nombre}
            sector={empleado.sector}
            fotoUrl={empleado.fotoUrl}
            accion={resultado.accion}
            esCumpleanos={esCumpleanosHoy(empleado.fechaNacimiento)}
            horasTrabajadas={resultado.horasTrabajadas}
            jornadaCompleta={resultado.jornadaCompleta}
            esTardanza={resultado.esTardanza}
            minutosRetraso={resultado.minutosRetraso}
            alDismiss={irAEspera}
          />
        )}

        {estado === 'ERROR' && (
          <PantallaError
            key="error"
            mensaje={mensajeError}
            alDismiss={irAEspera}
          />
        )}

        {estado === 'SOLICITUD' && empleado && (
          <PantallaSolicitud
            key="solicitud"
            nombre={empleado.nombre}
            alEnviar={enviarSolicitud}
            alCancelar={() => setEstado('ACCIONES')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

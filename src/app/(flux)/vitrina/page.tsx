'use client'

import { useState, useEffect } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Cargador, CargadorSeccion } from '@/componentes/ui/Cargador'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { Modal } from '@/componentes/ui/Modal'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { Avatar } from '@/componentes/ui/Avatar'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Alerta } from '@/componentes/ui/Alerta'
import { Tabs } from '@/componentes/ui/Tabs'
import { Select } from '@/componentes/ui/Select'
import { Pildora } from '@/componentes/ui/Pildora'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Separador } from '@/componentes/ui/Separador'
import { Buscador } from '@/componentes/ui/Buscador'
import { LineaTiempo } from '@/componentes/ui/LineaTiempo'
import {
  UserCircle, BarChart3, CalendarDays, PlusCircle, ArrowRight,
  FileEdit, FileText, ClipboardList, Users,
  Download, Trash2, Mail, Tag,
} from 'lucide-react'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica, FiltroTabla, AccionLote } from '@/componentes/tablas/TablaDinamica'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { ModalEnviarDocumento } from '@/componentes/entidad/ModalEnviarDocumento'
import { useColoresEmpresa } from '@/hooks/useColoresEmpresa'
import { LogoSalix, SplashSalix, IconoSalix } from '@/componentes/marca'
import type { VarianteIcono } from '@/componentes/marca'
import { useToast } from '@/componentes/feedback/Toast'
import { DELAY_TRANSICION, DELAY_ACCION } from '@/lib/constantes/timeouts'
import { Popover } from '@/componentes/ui/Popover'
import { PanelNotificaciones, type ItemNotificacion } from '@/componentes/ui/PanelNotificaciones'
import {
  ClipboardCheck, Bell, MessageSquare, Eye, PartyPopper, UserPlus, CalendarClock,
  BellOff, BellRing, AlertTriangle, FileCheck, Megaphone, AtSign, AlarmClock, Zap,
} from 'lucide-react'
import { useModoConcentracion } from '@/hooks/useModoConcentracion'
import { useTema, type Tema, type Efecto, type FondoCristal, type EscalaTexto } from '@/hooks/useTema'
import { useTraduccion } from '@/lib/i18n'

/* Vitrina de Componentes — Flux by Salix */

/* Datos extendidos para la TablaDinamica */
interface ContactoDemo {
  id: string
  nombre: string
  correo: string
  tipo: string
  etapa: string
  telefono: string
  empresa: string
  valorEstimado: number
  ultimoContacto: string
  ciudad: string
}

const contactosExtendidos: ContactoDemo[] = [
  { id: '1', nombre: 'Juan Pérez', correo: 'juan@empresa.com', tipo: 'Cliente', etapa: 'Negociación', telefono: '+54 11 4567-8900', empresa: 'TechCorp', valorEstimado: 15000, ultimoContacto: '2026-03-20', ciudad: 'Buenos Aires' },
  { id: '2', nombre: 'María López', correo: 'maria@corp.com', tipo: 'Prospecto', etapa: 'Contactado', telefono: '+54 11 2345-6789', empresa: 'DataVision', valorEstimado: 8500, ultimoContacto: '2026-03-18', ciudad: 'Córdoba' },
  { id: '3', nombre: 'Carlos Ruiz', correo: 'carlos@demo.com', tipo: 'Proveedor', etapa: 'Nuevo', telefono: '+54 351 456-7890', empresa: 'LogiPro', valorEstimado: 0, ultimoContacto: '2026-03-22', ciudad: 'Rosario' },
  { id: '4', nombre: 'Ana García', correo: 'ana@tech.io', tipo: 'Cliente', etapa: 'Cerrado', telefono: '+54 11 9876-5432', empresa: 'InnovateLab', valorEstimado: 42000, ultimoContacto: '2026-03-15', ciudad: 'Buenos Aires' },
  { id: '5', nombre: 'Pedro Martínez', correo: 'pedro@saas.com', tipo: 'Prospecto', etapa: 'Nuevo', telefono: '+54 261 345-6789', empresa: 'CloudBase', valorEstimado: 5000, ultimoContacto: '2026-03-24', ciudad: 'Mendoza' },
  { id: '6', nombre: 'Lucía Fernández', correo: 'lucia@global.com', tipo: 'Cliente', etapa: 'Negociación', telefono: '+54 11 1234-5678', empresa: 'GlobalTrade', valorEstimado: 28000, ultimoContacto: '2026-03-21', ciudad: 'Buenos Aires' },
  { id: '7', nombre: 'Diego Romero', correo: 'diego@startup.io', tipo: 'Prospecto', etapa: 'Contactado', telefono: '+54 341 567-8901', empresa: 'StartupFlow', valorEstimado: 12000, ultimoContacto: '2026-03-19', ciudad: 'Rosario' },
  { id: '8', nombre: 'Valentina Sosa', correo: 'vale@design.co', tipo: 'Cliente', etapa: 'Cerrado', telefono: '+54 11 8765-4321', empresa: 'DesignStudio', valorEstimado: 9500, ultimoContacto: '2026-03-10', ciudad: 'La Plata' },
  { id: '9', nombre: 'Martín Acosta', correo: 'martin@indus.com', tipo: 'Proveedor', etapa: 'Nuevo', telefono: '+54 381 234-5678', empresa: 'IndusGroup', valorEstimado: 0, ultimoContacto: '2026-03-23', ciudad: 'Tucumán' },
  { id: '10', nombre: 'Camila Torres', correo: 'camila@fintech.ar', tipo: 'Prospecto', etapa: 'Negociación', telefono: '+54 11 3456-7890', empresa: 'FinTechAR', valorEstimado: 35000, ultimoContacto: '2026-03-25', ciudad: 'Buenos Aires' },
  { id: '11', nombre: 'Sebastián Molina', correo: 'seba@retail.com', tipo: 'Cliente', etapa: 'Contactado', telefono: '+54 223 456-7890', empresa: 'RetailMax', valorEstimado: 18000, ultimoContacto: '2026-03-17', ciudad: 'Mar del Plata' },
  { id: '12', nombre: 'Florencia Díaz', correo: 'flor@media.com', tipo: 'Prospecto', etapa: 'Nuevo', telefono: '+54 11 6543-2109', empresa: 'MediaPulse', valorEstimado: 7200, ultimoContacto: '2026-03-16', ciudad: 'Buenos Aires' },
]

const itemsTimeline = [
  { id: '1', titulo: 'Contacto creado', descripcion: 'Juan Pérez fue registrado como cliente', fecha: 'Hace 2h', icono: <PlusCircle size={14} />, color: 'bg-insignia-exito-fondo text-insignia-exito-texto' },
  { id: '2', titulo: 'Etapa cambiada', descripcion: 'Nuevo → Contactado', fecha: 'Hace 1h', icono: <ArrowRight size={14} />, color: 'bg-insignia-info-fondo text-insignia-info-texto' },
  { id: '3', titulo: 'Nota agregada', descripcion: 'Se acordó reunión para el jueves', fecha: 'Hace 30min', icono: <FileEdit size={14} />, color: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto' },
  { id: '4', titulo: 'Presupuesto enviado', descripcion: 'PRE-2026-00042 por $15,000', fecha: 'Hace 10min', icono: <FileText size={14} />, color: 'bg-insignia-primario-fondo text-insignia-primario-texto' },
]

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-5 flex flex-col gap-4 cristal-panel scroll-mt-20">
      <h2 className="text-lg font-semibold text-texto-primario pb-2 border-b border-borde-sutil">{titulo}</h2>
      {children}
    </section>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-texto-terciario font-medium">{children}</span>
}

function Fila({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 items-center">{children}</div>
}

/** Botón reutilizable para selectores de apariencia */
function BotonOpcion({ activo, deshabilitado, onClick, icono, etiqueta, descripcion, titulo }: {
  activo: boolean
  deshabilitado?: boolean
  onClick: () => void
  icono: React.ReactNode
  etiqueta: string
  descripcion: string
  titulo?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      className={`
        relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200 cursor-pointer
        ${activo ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover'}
        ${deshabilitado ? 'opacity-40 cursor-not-allowed' : ''}
      `}
      title={titulo}
    >
      <span className={activo ? 'text-texto-marca' : 'text-texto-secundario'}>{icono}</span>
      <span className={`text-sm font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>{etiqueta}</span>
      <span className="text-xs text-texto-terciario text-center leading-tight">{descripcion}</span>
      {activo && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
    </button>
  )
}

/** Mini preview de UI para las tarjetas de tema */
function MiniUI({ fondo, barra, lineas }: { fondo: string; barra: string; lineas: string }) {
  return (
    <div className={`w-full h-20 rounded-md ${fondo} p-2 flex flex-col gap-1.5 border border-borde-sutil`}>
      <div className={`h-2 w-full rounded-sm ${barra}`} />
      <div className={`h-1.5 w-3/4 rounded-sm ${lineas}`} />
      <div className={`h-1.5 w-1/2 rounded-sm ${lineas}`} />
      <div className="mt-auto flex gap-1">
        <div className={`h-2.5 w-10 rounded-sm ${barra}`} />
        <div className={`h-2.5 w-8 rounded-sm ${lineas}`} />
      </div>
    </div>
  )
}

/** Selector visual completo: fuente + modo color + intensidad glass + fondo */
function SelectorApariencia() {
  const { tema, efecto, fondoCristal, escala, soportaCristal, razonNoCristal, cambiarTema, cambiarEfecto, cambiarFondo, cambiarEscala } = useTema()

  return (
    <div className="flex flex-col gap-6">

      {/* TAMAÑO DE FUENTE */}
      <div>
        <Etiqueta>Tamaño de fuente</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'compacto' as EscalaTexto, etiqueta: 'Normal', descripcion: 'Tamaño estándar', tamano: 'text-lg' },
            { clave: 'normal' as EscalaTexto, etiqueta: 'Mediano', descripcion: 'Un poco más grande', tamano: 'text-xl' },
            { clave: 'comodo' as EscalaTexto, etiqueta: 'Grande', descripcion: 'Más legible', tamano: 'text-2xl' },
          ]).map((e) => (
            <button
              key={e.clave}
              onClick={() => cambiarEscala(e.clave)}
              className={`
                relative flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer text-left
                ${escala === e.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover'}
              `}
            >
              <span className={`${e.tamano} font-bold ${escala === e.clave ? 'text-texto-marca' : 'text-texto-secundario'} shrink-0`}>Aa</span>
              <div className="flex flex-col min-w-0">
                <span className={`text-sm font-medium ${escala === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario">{e.descripcion}</span>
              </div>
              {escala === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </button>
          ))}
        </div>
      </div>

      <Separador />

      {/* MODO DE COLOR */}
      <div>
        <Etiqueta>Modo de color</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'claro' as Tema, etiqueta: 'Claro', fondo: 'bg-superficie-tarjeta', barra: 'bg-borde-sutil', lineas: 'bg-superficie-app' },
            { clave: 'oscuro' as Tema, etiqueta: 'Oscuro', fondo: 'bg-superficie-sidebar', barra: 'bg-borde-fuerte', lineas: 'bg-superficie-tarjeta' },
            { clave: 'sistema' as Tema, etiqueta: 'Automático', fondo: 'bg-gradient-to-r from-superficie-tarjeta to-superficie-sidebar', barra: 'bg-texto-terciario', lineas: 'bg-texto-terciario/30' },
          ]).map((t) => (
            <button
              key={t.clave}
              onClick={() => cambiarTema(t.clave)}
              className={`
                relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer
                ${tema === t.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover'}
              `}
            >
              <MiniUI fondo={t.fondo} barra={t.barra} lineas={t.lineas} />
              <span className={`text-sm font-medium ${tema === t.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>
                {t.etiqueta}
              </span>
              {t.clave === 'sistema' && <span className="text-xxs text-texto-terciario">(sistema)</span>}
              {tema === t.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </button>
          ))}
        </div>
      </div>

      <Separador />

      {/* INTENSIDAD GLASS */}
      <div>
        <Etiqueta>Intensidad glass</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'cristal' as Efecto, etiqueta: 'Glass', descripcion: 'Translúcido con blur', opacidad: 'opacity-30' },
            { clave: 'semi-cristal' as Efecto, etiqueta: 'Semi Glass', descripcion: 'Semi-opaco, menos blur', opacidad: 'opacity-60' },
            { clave: 'solido' as Efecto, etiqueta: 'Sólido', descripcion: 'Sin transparencia', opacidad: 'opacity-100' },
          ]).map((e) => {
            const deshabilitado = e.clave !== 'solido' && !soportaCristal
            return (
              <button
                key={e.clave}
                onClick={() => !deshabilitado && cambiarEfecto(e.clave)}
                disabled={deshabilitado}
                className={`
                  relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer
                  ${efecto === e.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover'}
                  ${deshabilitado ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={deshabilitado ? razonNoCristal : undefined}
              >
                {/* Preview: rectángulos simulando paneles con diferente opacidad */}
                <div className="w-full h-20 rounded-md bg-gradient-to-br from-insignia-violeta/20 via-insignia-info/15 to-insignia-cyan/10 p-2 flex flex-col gap-1.5 border border-borde-sutil relative overflow-hidden">
                  <div className={`h-2 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad}`} />
                  <div className={`h-6 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad} mt-auto`} />
                </div>
                <span className={`text-sm font-medium ${efecto === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario text-center">{e.descripcion}</span>
                {efecto === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </button>
            )
          })}
        </div>
        {!soportaCristal && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-insignia-advertencia-fondo text-insignia-advertencia-texto text-xs">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{razonNoCristal || 'Los efectos de transparencia requieren un dispositivo con GPU potente. En equipos más antiguos la interfaz puede sentirse lenta.'} Usá el modo <strong>Sólido</strong>.</span>
          </div>
        )}
      </div>

      {/* FONDO DE PANTALLA (solo si no es sólido) */}
      {efecto !== 'solido' && (
        <>
          <Separador />
          <div>
            <Etiqueta>Fondo de pantalla</Etiqueta>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {([
                { clave: 'aurora' as FondoCristal, etiqueta: 'Aurora', descripcion: 'Colorido', gradiente: 'from-insignia-violeta/40 via-insignia-cyan/30 to-insignia-exito/20' },
                { clave: 'medianoche' as FondoCristal, etiqueta: 'Medianoche', descripcion: 'Azul profundo', gradiente: 'from-insignia-info/40 via-texto-marca/30 to-insignia-info/20' },
                { clave: 'ambar' as FondoCristal, etiqueta: 'Ámbar', descripcion: 'Cálido dorado', gradiente: 'from-insignia-advertencia/40 via-insignia-naranja/30 to-insignia-peligro/20' },
                { clave: 'ninguno' as FondoCristal, etiqueta: 'Sin fondo', descripcion: 'Solo blur', gradiente: '' },
              ]).map((f) => (
                <button
                  key={f.clave}
                  onClick={() => cambiarFondo(f.clave)}
                  className={`
                    relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer
                    ${fondoCristal === f.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover'}
                  `}
                >
                  <div className={`w-full h-14 rounded-md border border-borde-sutil ${f.gradiente ? 'bg-gradient-to-br ' + f.gradiente : 'bg-superficie-app'}`} />
                  <span className={`text-xs font-medium ${fondoCristal === f.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{f.etiqueta}</span>
                  <span className="text-xxs text-texto-terciario">{f.descripcion}</span>
                  {fondoCristal === f.clave && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-texto-marca" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Sección de la Tabla Dinámica — separada para organizar el estado */
function SeccionTablaDinamica({ id, mostrar }: { id?: string; mostrar: (tipo: 'exito' | 'error' | 'advertencia' | 'info', mensaje: string) => void }) {
  const [busquedaTD, setBusquedaTD] = useState('')
  const [filtroTipoTD, setFiltroTipoTD] = useState('')
  const [filtroEtapaTD, setFiltroEtapaTD] = useState<string[]>([])
  const [filtroFechaTD, setFiltroFechaTD] = useState('')
  const columnasTD: ColumnaDinamica<ContactoDemo>[] = [
    {
      clave: 'nombre',
      etiqueta: 'Nombre',
      ancho: 200,
      ordenable: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-insignia-primario-fondo text-insignia-primario-texto inline-flex items-center justify-center text-xs font-semibold shrink-0">
            {c.nombre.split(' ').map((n) => n[0]).join('')}
          </div>
          <span className="font-medium text-texto-primario">{c.nombre}</span>
        </div>
      ),
    },
    { clave: 'correo', etiqueta: 'Correo', ancho: 200, ordenable: true },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      ancho: 120,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'Cliente', etiqueta: 'Cliente' },
        { valor: 'Prospecto', etiqueta: 'Prospecto' },
        { valor: 'Proveedor', etiqueta: 'Proveedor' },
      ],
      render: (c) => {
        const colores: Record<string, string> = { Cliente: 'exito', Prospecto: 'info', Proveedor: 'neutro' }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-${colores[c.tipo] || 'neutro'}-fondo text-insignia-${colores[c.tipo] || 'neutro'}-texto`}>
            {c.tipo}
          </span>
        )
      },
    },
    {
      clave: 'etapa',
      etiqueta: 'Etapa',
      ancho: 130,
      ordenable: true,
      filtrable: true,
      tipoFiltro: 'multiple',
      opcionesFiltro: [
        { valor: 'Nuevo', etiqueta: 'Nuevo' },
        { valor: 'Contactado', etiqueta: 'Contactado' },
        { valor: 'Negociación', etiqueta: 'Negociación' },
        { valor: 'Cerrado', etiqueta: 'Cerrado' },
      ],
      render: (c) => {
        const colores: Record<string, string> = { Nuevo: 'info', Contactado: 'advertencia', Negociación: 'primario', Cerrado: 'exito' }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-${colores[c.etapa] || 'neutro'}-fondo text-insignia-${colores[c.etapa] || 'neutro'}-texto`}>
            {c.etapa}
          </span>
        )
      },
    },
    { clave: 'empresa', etiqueta: 'Empresa', ancho: 150, ordenable: true },
    { clave: 'telefono', etiqueta: 'Teléfono', ancho: 160 },
    {
      clave: 'valorEstimado',
      etiqueta: 'Valor estimado',
      ancho: 140,
      ordenable: true,
      tipo: 'moneda',
      alineacion: 'right',
      resumen: 'suma',
      obtenerValor: (c) => c.valorEstimado,
      render: (c) => (
        <span className="font-medium tabular-nums">
          {c.valorEstimado > 0 ? `$${c.valorEstimado.toLocaleString('es-AR')}` : '—'}
        </span>
      ),
    },
    { clave: 'ciudad', etiqueta: 'Ciudad', ancho: 130, ordenable: true },
    { clave: 'ultimoContacto', etiqueta: 'Último contacto', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  ]

  const filtrosTD: FiltroTabla[] = [
    {
      id: 'tipo',
      etiqueta: 'Tipo',
      icono: <UserCircle size={14} />,
      tipo: 'seleccion',
      valor: filtroTipoTD,
      onChange: (v) => setFiltroTipoTD(v as string),
      opciones: [
        { valor: 'Cliente', etiqueta: 'Cliente' },
        { valor: 'Prospecto', etiqueta: 'Prospecto' },
        { valor: 'Proveedor', etiqueta: 'Proveedor' },
      ],
    },
    {
      id: 'etapa',
      etiqueta: 'Etapa',
      icono: <BarChart3 size={14} />,
      tipo: 'multiple',
      valor: filtroEtapaTD,
      onChange: (v) => setFiltroEtapaTD(v as string[]),
      opciones: [
        { valor: 'Nuevo', etiqueta: 'Nuevo' },
        { valor: 'Contactado', etiqueta: 'Contactado' },
        { valor: 'Negociación', etiqueta: 'Negociación' },
        { valor: 'Cerrado', etiqueta: 'Cerrado' },
      ],
    },
    {
      id: 'fecha',
      etiqueta: 'Último contacto',
      icono: <CalendarDays size={14} />,
      tipo: 'fecha',
      valor: filtroFechaTD,
      onChange: (v) => setFiltroFechaTD(v as string),
    },
  ]

  const accionesLoteTD: AccionLote[] = [
    { id: 'exportar', etiqueta: 'Exportar selección', icono: <Download size={14} />, onClick: (ids) => mostrar('info', `Exportando ${ids.size} registros`) },
    { id: 'enviar-correo', etiqueta: 'Enviar correo', icono: <Mail size={14} />, onClick: (ids) => mostrar('info', `Enviando correo a ${ids.size} contactos`) },
    { id: 'etiquetar', etiqueta: 'Etiquetar', icono: <Tag size={14} />, onClick: (ids) => mostrar('info', `Etiquetando ${ids.size} contactos`) },
    { id: 'eliminar', etiqueta: 'Eliminar', icono: <Trash2 size={14} />, onClick: (ids) => mostrar('advertencia', `¿Eliminar ${ids.size} contactos?`), peligro: true },
  ]

  /* Filtrar datos localmente para la demo */
  const datosFiltrados = contactosExtendidos.filter((c) => {
    if (busquedaTD && !c.nombre.toLowerCase().includes(busquedaTD.toLowerCase()) && !c.correo.toLowerCase().includes(busquedaTD.toLowerCase())) return false
    if (filtroTipoTD && c.tipo !== filtroTipoTD) return false
    if (filtroEtapaTD.length > 0 && !filtroEtapaTD.includes(c.etapa)) return false
    return true
  })

  return (
    <Seccion id={id} titulo="Tabla Dinámica">
      <p className="text-sm text-texto-secundario -mt-2 mb-2">
        Componente central con múltiples vistas, filtros, columnas configurables, paginación, ordenamiento, selección y más.
      </p>
      <div className="h-[520px]">
      <TablaDinamica<ContactoDemo>
        columnas={columnasTD}
        datos={datosFiltrados}
        claveFila={(c) => c.id}
        vistas={['lista', 'tarjetas']}
        vistaInicial="lista"
        registrosPorPagina={8}
        seleccionables
        busqueda={busquedaTD}
        onBusqueda={setBusquedaTD}
        placeholder="Buscar..."
        filtros={filtrosTD}
        onLimpiarFiltros={() => { setFiltroTipoTD(''); setFiltroEtapaTD([]); setFiltroFechaTD('') }}
        accionesLote={accionesLoteTD}
        idModulo="vitrina_demo"
        onClickFila={(c) => mostrar('info', `Abriendo ${c.nombre}`)}
        mostrarResumen
        renderTarjeta={(c) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-insignia-primario-fondo text-insignia-primario-texto inline-flex items-center justify-center text-xs font-semibold shrink-0">
                {c.nombre.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-texto-primario truncate">{c.nombre}</p>
                <p className="text-xs text-texto-terciario truncate">{c.empresa}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-insignia-${c.tipo === 'Cliente' ? 'exito' : c.tipo === 'Prospecto' ? 'info' : 'neutro'}-fondo text-insignia-${c.tipo === 'Cliente' ? 'exito' : c.tipo === 'Prospecto' ? 'info' : 'neutro'}-texto`}>
                {c.tipo}
              </span>
              {c.valorEstimado > 0 && (
                <span className="text-xs font-medium text-texto-primario tabular-nums">${c.valorEstimado.toLocaleString('es-AR')}</span>
              )}
            </div>
            <p className="text-xs text-texto-terciario">{c.correo}</p>
          </div>
        )}
      />
      </div>
    </Seccion>
  )
}

function SeccionEditorTexto({ id }: { id?: string }) {
  const [html, setHtml] = useState('')
  const { colores } = useColoresEmpresa()

  return (
    <Seccion id={id} titulo="Editor de Texto">
      <p className="text-sm text-texto-secundario mb-3">
        Seleccioná texto para ver el toolbar de formateo: negrita, itálica, tamaños, colores, alineación, listas y links.
      </p>
      <EditorTexto
        contenido="<p>Este es un <strong>editor de texto enriquecido</strong> con toolbar flotante. Seleccioná cualquier parte del texto para ver las opciones de formateo.</p><p>Podés aplicar <em>itálica</em>, <u>subrayado</u>, cambiar el <span style='color: #3b82f6'>color del texto</span>, agregar <mark style='background-color: #fef08a'>resaltado</mark>, crear listas y mucho más.</p><h2>Títulos</h2><p>También soporta encabezados H1, H2 y H3 para organizar el contenido.</p><ul><li>Listas con viñetas</li><li>Numeradas</li></ul><p>Y <a href='https://fluxsalix.com'>enlaces</a> también.</p>"
        onChange={setHtml}
        placeholder="Escribí algo..."
        coloresMarca={colores}
        alturaMinima={200}
      />
      {html && (
        <details className="mt-3">
          <summary className="text-xxs text-texto-terciario cursor-pointer">Ver HTML generado</summary>
          <pre className="mt-2 p-3 rounded-md bg-superficie-hover text-xxs text-texto-secundario overflow-x-auto max-h-32">
            {html}
          </pre>
        </details>
      )}
    </Seccion>
  )
}

function SeccionModalEnviarDocumento({ id }: { id?: string }) {
  const [abierto, setAbierto] = useState(false)

  const canalesDemo = [
    { id: '1', nombre: 'Ventas', email: 'ventas@miempresa.com', predeterminado: true },
    { id: '2', nombre: 'Info', email: 'info@miempresa.com' },
    { id: '3', nombre: 'Soporte', email: 'soporte@miempresa.com' },
  ]

  const plantillasDemo = [
    { id: '1', nombre: 'Presupuesto estándar', asunto: 'Presupuesto #{numero}', contenido_html: '<p>Estimado/a <strong>{nombre}</strong>,</p><p>Adjunto encontrará el presupuesto solicitado.</p><p>Quedamos a disposición para cualquier consulta.</p><p>Saludos cordiales.</p>' },
    { id: '2', nombre: 'Seguimiento', asunto: 'Seguimiento - Presupuesto #{numero}', contenido_html: '<p>Hola <strong>{nombre}</strong>,</p><p>Le escribimos para dar seguimiento al presupuesto enviado.</p><p>¿Tiene alguna pregunta o comentario?</p>' },
  ]

  const adjuntoDemo = {
    id: 'pdf-1',
    nombre_archivo: 'P-00042.pdf',
    tipo_mime: 'application/pdf',
    tamano_bytes: 245000,
    url: '#',
    miniatura_url: null,
    es_documento_principal: true,
  }

  return (
    <Seccion id={id} titulo="Modal Enviar Documento">
      <div>
        <Etiqueta>Modal completo para envío de documentos por correo</Etiqueta>
        <p className="text-xs mb-3" style={{ color: 'var(--texto-terciario)' }}>
          Incluye: selector de canal remitente, destinatarios con autocomplete, CC/CCO colapsables, asunto con variables,
          plantillas de correo, editor rico con inserción de variables, adjuntos, enlace al portal, programación de envío,
          guardar como borrador y guardar como plantilla.
        </p>
        <Boton variante="primario" tamano="sm" icono={<Mail size={14} />} onClick={() => setAbierto(true)}>
          Abrir modal de envío
        </Boton>
      </div>
      <ModalEnviarDocumento
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onEnviar={async (datos) => {
          console.log('Datos de envío:', datos)
          await new Promise(r => setTimeout(r, DELAY_TRANSICION))
          setAbierto(false)
        }}
        canales={canalesDemo}
        plantillas={plantillasDemo}
        correosDestinatario={['cliente@ejemplo.com']}
        nombreDestinatario="Juan Pérez"
        asuntoPredeterminado="Presupuesto #P-00042"
        adjuntoDocumento={adjuntoDemo}
        urlPortal="https://app.fluxsalix.com/portal/presupuestos/abc123"
        tipoDocumento="Presupuesto"
        onGuardarBorrador={(datos) => { console.log('Borrador guardado:', datos) }}
        onGuardarPlantilla={(datos) => { console.log('Plantilla guardada:', datos) }}
      />
    </Seccion>
  )
}

/* ── Datos demo para PanelNotificaciones ── */
/* ── Catálogo completo de tipos de notificación ── */
const catalogoTipos = [
  // INBOX
  { categoria: 'Inbox', tipo: 'mensaje_whatsapp', icono: <MessageSquare size={13} />, iconoNotif: iconoNotifPeq(MessageSquare, 'var(--canal-whatsapp)'), titulo: '💬 Mensaje de Juan Pérez', descripcion: '¿Tienen stock del modelo XR-500?' },
  { categoria: 'Inbox', tipo: 'mensaje_correo', icono: <Mail size={13} />, iconoNotif: iconoNotifPeq(Mail, 'var(--canal-correo)'), titulo: '📩 Nuevo correo de María López', descripcion: 'Re: Presupuesto #142 — Confirmamos el pedido' },
  { categoria: 'Inbox', tipo: 'mensaje_interno', icono: <MessageSquare size={13} />, iconoNotif: iconoNotifPeq(MessageSquare, 'var(--canal-interno)'), titulo: '💬 Pedro Martínez en #ventas', descripcion: 'Revisá el presupuesto de GlobalTrade' },
  { categoria: 'Inbox', tipo: 'mencion', icono: <AtSign size={13} />, iconoNotif: iconoNotifPeq(AtSign, 'var(--texto-marca)'), titulo: '💬 Ana García te mencionó', descripcion: '@sal ¿podés aprobar este descuento del 15%?' },
  // ACTIVIDADES
  { categoria: 'Actividades', tipo: 'actividad_asignada', icono: <Zap size={13} />, iconoNotif: iconoNotifPeq(UserPlus, 'var(--texto-marca)'), titulo: '📋 Carlos Ruiz te asignó una actividad', descripcion: 'Llamar a TechCorp para seguimiento' },
  { categoria: 'Actividades', tipo: 'actividad_pronto_vence', icono: <Zap size={13} />, iconoNotif: iconoNotifPeq(CalendarClock, 'var(--insignia-advertencia-texto)'), titulo: '⏰ Actividad vence hoy', descripcion: 'Enviar catálogo a DataVision' },
  { categoria: 'Actividades', tipo: 'actividad_vencida', icono: <Zap size={13} />, iconoNotif: iconoNotifPeq(AlertTriangle, 'var(--insignia-peligro-texto)'), titulo: '🚨 Actividad vencida', descripcion: 'Propuesta técnica para MegaIndustrial — venció ayer' },
  { categoria: 'Actividades', tipo: 'recordatorio', icono: <Zap size={13} />, iconoNotif: iconoNotifPeq(AlarmClock, 'var(--texto-marca)'), titulo: '🔔 Llamar a Juan Pérez', descripcion: 'Confirmar disponibilidad para la reunión del viernes' },
  // SISTEMA
  { categoria: 'Sistema', tipo: 'portal_vista', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(Eye, 'var(--insignia-info-texto)'), titulo: '👁️ María López abrió el presupuesto #142', descripcion: 'Primera visita al portal' },
  { categoria: 'Sistema', tipo: 'portal_aceptado', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(FileCheck, 'var(--insignia-exito-texto)'), titulo: '✅ Roberto Torres aceptó el presupuesto', descripcion: 'Presupuesto #089 — $45.000 USD' },
  { categoria: 'Sistema', tipo: 'portal_rechazado', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(AlertTriangle, 'var(--insignia-peligro-texto)'), titulo: '❌ El cliente rechazó el presupuesto', descripcion: 'Presupuesto #076 — precio fuera de presupuesto' },
  { categoria: 'Sistema', tipo: 'portal_cancelado', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(AlertTriangle, 'var(--insignia-advertencia-texto)'), titulo: '⚠️ El cliente canceló la aceptación', descripcion: 'Presupuesto #089 — Roberto Torres revirtió su firma' },
  { categoria: 'Sistema', tipo: 'comprobante', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(FileCheck, 'var(--insignia-info-texto)'), titulo: '🧾 El cliente subió un comprobante de pago', descripcion: 'comprobante_marzo.pdf — $22.500' },
  { categoria: 'Sistema', tipo: 'cumpleanios_colega', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(PartyPopper, 'var(--insignia-rosa-texto)'), titulo: '🎂 Hoy cumple años Carlos Ruiz', descripcion: '¡No olvides saludarlo!' },
  { categoria: 'Sistema', tipo: 'cumpleanios_propio', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(PartyPopper, 'var(--insignia-rosa-texto)'), titulo: '🎂 ¡Feliz cumpleaños!', descripcion: '¡Todo el equipo te desea un excelente día!' },
  { categoria: 'Sistema', tipo: 'anuncio', icono: <Bell size={13} />, iconoNotif: iconoNotifPeq(Megaphone, 'var(--insignia-violeta-texto)'), titulo: '📢 Nuevo módulo disponible: Calendario', descripcion: 'Activalo desde Configuración → Módulos' },
]

function iconoNotifPeq(Icono: typeof Mail, color: string) {
  return (
    <div
      className="size-6 rounded-md flex items-center justify-center shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <Icono size={12} style={{ color }} />
    </div>
  )
}

/* ── Toasts del sistema (las barras laterales exito/error/etc) ── */
const toastsSistemaDemo: { id: string; tipo: 'exito' | 'error' | 'advertencia' | 'info'; etiqueta: string; mensaje: string }[] = [
  { id: 'ts1', tipo: 'exito', etiqueta: 'Éxito', mensaje: 'Contacto guardado correctamente' },
  { id: 'ts2', tipo: 'exito', etiqueta: 'Éxito', mensaje: 'Presupuesto #142 enviado al cliente' },
  { id: 'ts3', tipo: 'exito', etiqueta: 'Éxito', mensaje: 'Actividad completada' },
  { id: 'ts4', tipo: 'exito', etiqueta: 'Éxito', mensaje: 'Todas las notificaciones marcadas como leídas' },
  { id: 'ts5', tipo: 'error', etiqueta: 'Error', mensaje: 'Error al guardar el contacto' },
  { id: 'ts6', tipo: 'error', etiqueta: 'Error', mensaje: 'No se pudo enviar el correo. Verificá tu conexión' },
  { id: 'ts7', tipo: 'error', etiqueta: 'Error', mensaje: 'Error al sincronizar bandeja de entrada' },
  { id: 'ts8', tipo: 'advertencia', etiqueta: 'Advertencia', mensaje: 'El presupuesto PRE-2026-00042 vence mañana' },
  { id: 'ts9', tipo: 'advertencia', etiqueta: 'Advertencia', mensaje: 'Tenés 3 actividades vencidas sin completar' },
  { id: 'ts10', tipo: 'advertencia', etiqueta: 'Advertencia', mensaje: 'El archivo supera el límite de 10 MB' },
  { id: 'ts11', tipo: 'info', etiqueta: 'Info', mensaje: 'Nuevo mensaje de Juan Pérez en inbox' },
  { id: 'ts12', tipo: 'info', etiqueta: 'Info', mensaje: 'Sincronización de correo completada — 5 mensajes nuevos' },
  { id: 'ts13', tipo: 'info', etiqueta: 'Info', mensaje: 'Notificación descartada' },
]

/* ── Toasts de notificación en tiempo real (tarjetas flotantes) ── */
const toastsNotifDemo = [
  { id: 'tn1', etiqueta: 'WhatsApp', color: 'var(--canal-whatsapp)', iconoComp: <MessageSquare size={18} style={{ color: 'var(--canal-whatsapp)' }} />, titulo: 'Mensaje de Juan Pérez', descripcion: '¿Tienen stock del modelo XR-500? Necesito 20 unidades' },
  { id: 'tn2', etiqueta: 'Correo', color: 'var(--canal-correo)', iconoComp: <Mail size={18} style={{ color: 'var(--canal-correo)' }} />, titulo: 'Nuevo correo de María López', descripcion: 'Re: Presupuesto #142 — Perfecto, confirmamos el pedido' },
  { id: 'tn3', etiqueta: 'Portal', color: 'var(--insignia-info-texto)', iconoComp: <Eye size={18} style={{ color: 'var(--insignia-info-texto)' }} />, titulo: 'María López abrió el presupuesto #142', descripcion: 'Primera visita al portal — hace 5 minutos' },
  { id: 'tn3b', etiqueta: 'Aceptado', color: 'var(--insignia-exito-texto)', iconoComp: <FileCheck size={18} style={{ color: 'var(--insignia-exito-texto)' }} />, titulo: 'Roberto Torres aceptó el presupuesto', descripcion: 'Presupuesto #089 — $45.000 USD' },
  { id: 'tn4', etiqueta: 'Rechazado', color: 'var(--insignia-peligro-texto)', iconoComp: <AlertTriangle size={18} style={{ color: 'var(--insignia-peligro-texto)' }} />, titulo: 'El cliente rechazó el presupuesto', descripcion: 'Presupuesto #076 — precio fuera de presupuesto' },
  { id: 'tn5', etiqueta: 'Vencimiento', color: 'var(--insignia-advertencia-texto)', iconoComp: <CalendarClock size={18} style={{ color: 'var(--insignia-advertencia-texto)' }} />, titulo: 'Actividad vence hoy', descripcion: 'Enviar catálogo actualizado a DataVision' },
  { id: 'tn6', etiqueta: 'Recordatorio', color: 'var(--texto-marca)', iconoComp: <AlarmClock size={18} style={{ color: 'var(--texto-marca)' }} />, titulo: 'Llamar a Juan Pérez', descripcion: 'Confirmar disponibilidad para la reunión del viernes' },
  { id: 'tn7', etiqueta: 'Actividad', color: 'var(--texto-marca)', iconoComp: <UserPlus size={18} style={{ color: 'var(--texto-marca)' }} />, titulo: 'Carlos Ruiz te asignó una actividad', descripcion: 'Llamar a TechCorp para seguimiento del presupuesto' },
]

/* ── Push notifications demo (nativas del SO) ── */
const pushDemo = [
  { id: 'p1', titulo: '💬 Mensaje de Juan Pérez', cuerpo: '¿Tienen stock del modelo XR-500? Necesito 20 unidades', tiempo: 'ahora' },
  { id: 'p1b', titulo: '👁️ María López abrió el presupuesto #142', cuerpo: 'Primera visita al portal', tiempo: 'hace 1 min' },
  { id: 'p2', titulo: '✅ Roberto Torres aceptó el presupuesto', cuerpo: 'Presupuesto #089 — $45.000 USD', tiempo: 'hace 2 min' },
  { id: 'p3', titulo: '⏰ Actividad vence hoy', cuerpo: 'Enviar catálogo actualizado a DataVision', tiempo: 'hace 15 min' },
  { id: 'p4', titulo: '🔔 Llamar a Juan Pérez', cuerpo: 'Confirmar disponibilidad para la reunión del viernes', tiempo: 'hace 30 min' },
  { id: 'p5', titulo: '🎂 Hoy cumple años Carlos Ruiz', cuerpo: '¡No olvides saludarlo!', tiempo: '9:00' },
]

/* ── Helper para íconos de notificación ── */
function iconoNotif(Icono: typeof Mail, color: string) {
  return (
    <div
      className="size-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <Icono size={16} style={{ color }} />
    </div>
  )
}

/* ── Datos demo: INBOX (correos, WhatsApp, internos, menciones) ── */
const notificacionesDemo: ItemNotificacion[] = [
  {
    id: 'i-wa1',
    icono: iconoNotif(MessageSquare, 'var(--canal-whatsapp)'),
    titulo: '💬 Mensaje de Juan Pérez',
    descripcion: '¿Tienen stock del modelo XR-500? Necesito 20 unidades',
    tiempo: 'hace 2 min',
    leida: false,
  },
  {
    id: 'i-correo1',
    icono: iconoNotif(Mail, 'var(--canal-correo)'),
    titulo: '📩 Nuevo correo de María López',
    descripcion: 'Re: Presupuesto #142 — Perfecto, confirmamos el pedido',
    tiempo: 'hace 15 min',
    leida: false,
  },
  {
    id: 'i-interno1',
    icono: iconoNotif(MessageSquare, 'var(--canal-interno)'),
    titulo: '💬 Pedro Martínez en #ventas',
    descripcion: 'Revisá el presupuesto de GlobalTrade cuando puedas',
    tiempo: 'hace 1h',
    leida: false,
  },
  {
    id: 'i-mencion1',
    icono: iconoNotif(AtSign, 'var(--texto-marca)'),
    titulo: '💬 Ana García te mencionó',
    descripcion: '@sal ¿podés aprobar este descuento del 15%?',
    tiempo: 'hace 2h',
    leida: true,
  },
  {
    id: 'i-wa2',
    icono: iconoNotif(MessageSquare, 'var(--canal-whatsapp)'),
    titulo: 'Mensaje de Roberto Torres',
    descripcion: 'Buenas, quería consultar por los plazos de entrega',
    tiempo: 'hace 3h',
    leida: true,
  },
]

/* ── Datos demo: ACTIVIDADES (asignaciones, vencimientos, recordatorios) ── */
const actividadesDemo: ItemNotificacion[] = [
  {
    id: 'a-asignada1',
    icono: iconoNotif(UserPlus, 'var(--texto-marca)'),
    titulo: '📋 Carlos Ruiz te asignó una actividad',
    descripcion: 'Llamar a TechCorp para seguimiento del presupuesto',
    tiempo: 'hace 30 min',
    leida: false,
  },
  {
    id: 'a-pronto1',
    icono: iconoNotif(CalendarClock, 'var(--insignia-advertencia-texto)'),
    titulo: '⏰ Actividad vence hoy',
    descripcion: 'Enviar catálogo actualizado a DataVision',
    tiempo: 'hace 1h',
    leida: false,
  },
  {
    id: 'a-vencida1',
    icono: iconoNotif(AlertTriangle, 'var(--insignia-peligro-texto)'),
    titulo: '🚨 Actividad vencida',
    descripcion: 'Preparar propuesta técnica para MegaIndustrial — venció ayer',
    tiempo: 'hace 1d',
    leida: false,
  },
  {
    id: 'a-recordatorio1',
    icono: iconoNotif(AlarmClock, 'var(--texto-marca)'),
    titulo: '🔔 Llamar a Juan Pérez',
    descripcion: 'Confirmar disponibilidad para la reunión del viernes',
    tiempo: 'hace 15 min',
    leida: true,
  },
]

/* ── Datos demo: SISTEMA (portal, cumpleaños, anuncios) ── */
const sistemaDemo: ItemNotificacion[] = [
  {
    id: 's-vista1',
    icono: iconoNotif(Eye, 'var(--insignia-info-texto)'),
    titulo: '👁️ María López abrió el presupuesto #142',
    descripcion: 'Primera visita al portal — hace 5 minutos',
    tiempo: 'hace 5 min',
    leida: false,
  },
  {
    id: 's-aceptado1',
    icono: iconoNotif(FileCheck, 'var(--insignia-exito-texto)'),
    titulo: '✅ Roberto Torres aceptó el presupuesto',
    descripcion: 'Presupuesto #089 — $45.000 USD',
    tiempo: 'hace 20 min',
    leida: false,
  },
  {
    id: 's-rechazado1',
    icono: iconoNotif(AlertTriangle, 'var(--insignia-peligro-texto)'),
    titulo: '❌ El cliente rechazó el presupuesto',
    descripcion: 'Presupuesto #076 — Motivo: precio fuera de presupuesto',
    tiempo: 'hace 2h',
    leida: false,
  },
  {
    id: 's-cancelado1',
    icono: iconoNotif(AlertTriangle, 'var(--insignia-advertencia-texto)'),
    titulo: '⚠️ El cliente canceló la aceptación',
    descripcion: 'Presupuesto #089 — Roberto Torres revirtió su firma',
    tiempo: 'hace 3h',
    leida: true,
  },
  {
    id: 's-comprobante1',
    icono: iconoNotif(FileCheck, 'var(--insignia-info-texto)'),
    titulo: '🧾 El cliente subió un comprobante de pago',
    descripcion: 'comprobante_marzo.pdf — $22.500',
    tiempo: 'hace 4h',
    leida: true,
  },
  {
    id: 's-cumple1',
    icono: iconoNotif(PartyPopper, 'var(--insignia-rosa-texto)'),
    titulo: 'Hoy cumple años Carlos Ruiz',
    descripcion: '¡No olvides saludarlo!',
    tiempo: '9:00',
    leida: true,
  },
  {
    id: 's-cumple-propio',
    icono: iconoNotif(PartyPopper, 'var(--insignia-rosa-texto)'),
    titulo: '¡Feliz cumpleaños!',
    descripcion: '¡Todo el equipo te desea un excelente día!',
    tiempo: '9:00',
    leida: true,
  },
  {
    id: 's-anuncio1',
    icono: iconoNotif(Megaphone, 'var(--insignia-violeta-texto)'),
    titulo: '📢 Nuevo módulo disponible: Calendario',
    descripcion: 'Activalo desde Configuración → Módulos',
    tiempo: 'ayer',
    leida: true,
  },
]

function SeccionModoConcentracion() {
  const { activo, textoEstado, textoSiguiente, ciclar, desactivar } = useModoConcentracion()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Etiqueta>Ciclo rápido (como aparece en el menú Flux)</Etiqueta>
        <div className="flex items-center gap-3 mt-2 p-4 rounded-xl bg-superficie-hover">
          <button
            onClick={ciclar}
            className={[
              'flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-left',
              activo
                ? 'bg-insignia-advertencia-fondo/50 border-insignia-advertencia-texto/20 text-insignia-advertencia-texto'
                : 'bg-superficie-tarjeta border-borde-sutil text-texto-secundario hover:text-texto-primario hover:border-borde-fuerte',
            ].join(' ')}
          >
            {activo ? <BellOff size={16} /> : <BellRing size={16} />}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium">
                {activo ? textoEstado() : 'Silenciar notificaciones'}
              </span>
              <span className="text-xxs opacity-70">{textoSiguiente()}</span>
            </div>
          </button>
          {activo && (
            <Boton variante="secundario" tamano="sm" icono={<BellRing size={13} />} onClick={desactivar} className="shrink-0">
              Desactivar
            </Boton>
          )}
        </div>
      </div>
      <p className="text-xs text-texto-terciario">
        Cada click cicla: 30 min → 1h → 4h → hasta mañana → desactivar.
        Los íconos del header se atenúan y los badges cambian de color. Persiste en localStorage.
      </p>
    </div>
  )
}

function SeccionNotificacionesVitrina({ id, mostrar }: { id?: string; mostrar: (tipo: 'exito' | 'error' | 'advertencia' | 'info', mensaje: string) => void }) {
  const [itemsInbox, setItemsInbox] = useState(notificacionesDemo)
  const [itemsActividades, setItemsActividades] = useState(actividadesDemo)
  const [itemsSistema, setItemsSistema] = useState(sistemaDemo)

  const marcarLeidas = (items: ItemNotificacion[], setItems: (items: ItemNotificacion[]) => void) => {
    setItems(items.map((i) => ({ ...i, leida: true })))
    mostrar('exito', 'Todas marcadas como leídas')
  }

  const descartarItem = (id: string, items: ItemNotificacion[], setItems: (items: ItemNotificacion[]) => void) => {
    setItems(items.filter((i) => i.id !== id))
    mostrar('info', 'Notificación descartada')
  }

  return (
    <Seccion id={id} titulo="Panel de Notificaciones">
      <div>
        <Etiqueta>3 paneles como aparecen en el header (dentro de Popovers)</Etiqueta>
        <div className="flex flex-wrap gap-3 mt-3">
          <Popover
            alineacion="inicio"
            ancho={400}
            contenido={
              <PanelNotificaciones
                titulo="Inbox"
                iconoTitulo={<Mail size={16} className="text-texto-terciario" />}
                items={itemsInbox}
                noLeidas={itemsInbox.filter((i) => !i.leida).length}
                onMarcarTodasLeidas={() => marcarLeidas(itemsInbox, setItemsInbox)}
                onDescartar={(id) => descartarItem(id, itemsInbox, setItemsInbox)}
                textoVacio="Sin mensajes nuevos"
                iconoVacio={<Mail size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
                pie={
                  <Boton variante="fantasma" tamano="xs" anchoCompleto>
                    Ver todo en Inbox →
                  </Boton>
                }
              />
            }
          >
            <Boton variante="secundario" tamano="sm">
              <Mail size={16} />
              Inbox (con {itemsInbox.filter((i) => !i.leida).length} nuevas)
            </Boton>
          </Popover>

          <Popover
            alineacion="centro"
            ancho={400}
            contenido={
              <PanelNotificaciones
                titulo="Actividades"
                iconoTitulo={<ClipboardCheck size={16} className="text-texto-terciario" />}
                items={itemsActividades}
                noLeidas={itemsActividades.filter((i) => !i.leida).length}
                onMarcarTodasLeidas={() => marcarLeidas(itemsActividades, setItemsActividades)}
                onDescartar={(id) => descartarItem(id, itemsActividades, setItemsActividades)}
                textoVacio="Sin actividades pendientes"
                iconoVacio={<ClipboardCheck size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
                pie={
                  <Boton variante="fantasma" tamano="xs" anchoCompleto>
                    Ver todas las actividades →
                  </Boton>
                }
              />
            }
          >
            <Boton variante="secundario" tamano="sm">
              <ClipboardCheck size={16} />
              Actividades (con {itemsActividades.filter((i) => !i.leida).length} nuevas)
            </Boton>
          </Popover>

          <Popover
            alineacion="fin"
            ancho={400}
            contenido={
              <PanelNotificaciones
                titulo="Notificaciones"
                iconoTitulo={<Bell size={16} className="text-texto-terciario" />}
                items={itemsSistema}
                noLeidas={itemsSistema.filter((i) => !i.leida).length}
                onMarcarTodasLeidas={() => marcarLeidas(itemsSistema, setItemsSistema)}
                onDescartar={(id) => descartarItem(id, itemsSistema, setItemsSistema)}
                textoVacio="Sin notificaciones"
                iconoVacio={<Bell size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
                pie={
                  <Boton variante="fantasma" tamano="xs" anchoCompleto>
                    Ver configuración →
                  </Boton>
                }
              />
            }
          >
            <Boton variante="secundario" tamano="sm">
              <Bell size={16} />
              Sistema (con {itemsSistema.filter((i) => !i.leida).length} nuevas)
            </Boton>
          </Popover>
        </div>
      </div>

      <Separador etiqueta="Catálogo de tipos de notificación" />
      <div>
        <Etiqueta>Todos los tipos que existen en el sistema, organizados por categoría</Etiqueta>
        <div className="mt-3 border border-borde-sutil rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-superficie-hover text-texto-terciario text-xs text-left">
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Título de ejemplo</th>
                <th className="px-4 py-2.5 font-medium">Descripción de ejemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-sutil">
              {catalogoTipos.map((tipo) => (
                <tr key={tipo.tipo} className="hover:bg-superficie-hover/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-texto-terciario">
                      {tipo.icono}
                      {tipo.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-xs px-1.5 py-0.5 rounded bg-superficie-hover text-texto-secundario">{tipo.tipo}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {tipo.iconoNotif}
                      <span className="text-sm text-texto-primario">{tipo.titulo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-texto-terciario max-w-[300px] truncate">{tipo.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separador etiqueta="Panel en estado vacío" />
      <div className="border border-borde-sutil rounded-2xl overflow-hidden max-w-[400px]">
        <PanelNotificaciones
          titulo="Inbox"
          iconoTitulo={<Mail size={16} className="text-texto-terciario" />}
          items={[]}
          noLeidas={0}
          textoVacio="Sin mensajes nuevos"
          iconoVacio={<Mail size={32} strokeWidth={1.2} className="text-texto-terciario/40" />}
        />
      </div>

      <Separador etiqueta="Panel cargando" />
      <div className="border border-borde-sutil rounded-2xl overflow-hidden max-w-[400px]">
        <PanelNotificaciones
          titulo="Actividades"
          iconoTitulo={<ClipboardCheck size={16} className="text-texto-terciario" />}
          items={[]}
          noLeidas={0}
          cargando
        />
      </div>

      <Separador etiqueta="Modo concentración (No molestar)" />
      <SeccionModoConcentracion />
    </Seccion>
  )
}

function SeccionMarca({ id }: { id?: string }) {
  const [animacion, setAnimacion] = useState<VarianteIcono>('estatico')
  const [mostrarSplash, setMostrarSplash] = useState(false)
  const [keyReset, setKeyReset] = useState(0)

  const reproducir = (v: VarianteIcono) => {
    setAnimacion('estatico')
    setKeyReset(k => k + 1)
    setTimeout(() => setAnimacion(v), 50)
  }

  return (
    <Seccion id={id} titulo="Marca / Logo">
      {/* Layouts — todos con hover+tap activo por defecto */}
      <div>
        <Etiqueta>Layouts — pasá el mouse por encima</Etiqueta>
        <div className="flex flex-wrap items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <LogoSalix layout="icono" tamano={36} />
            <span className="text-xxs text-texto-terciario">icono</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LogoSalix layout="horizontal" tamano={32} />
            <span className="text-xxs text-texto-terciario">horizontal</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LogoSalix layout="completo" tamano={36} />
            <span className="text-xxs text-texto-terciario">completo</span>
          </div>
        </div>
      </div>

      {/* Tamaños — todos con hover */}
      <div>
        <Etiqueta>Tamaños — hover en cada uno</Etiqueta>
        <Fila>
          {[16, 24, 32, 48, 64].map(t => (
            <div key={t} className="flex flex-col items-center gap-1">
              <IconoSalix tamano={t} hover tap />
              <span className="text-xxs text-texto-terciario">{t}px</span>
            </div>
          ))}
        </Fila>
      </div>

      {/* Entrada automática con ensamble */}
      <div>
        <Etiqueta>Entrada automática al cargar (ensamble + hover)</Etiqueta>
        <div className="flex items-center justify-center py-8 rounded-lg" style={{ backgroundColor: 'var(--superficie-hover)' }}>
          <LogoSalix layout="completo" tamano={52} animacion="ensamble" escalaTexto={1.2} />
        </div>
      </div>

      {/* Otros productos */}
      <div>
        <Etiqueta>Otros productos (misma marca)</Etiqueta>
        <div className="flex flex-wrap items-center gap-6">
          <LogoSalix layout="horizontal" tamano={26} producto="flux" />
          <LogoSalix layout="horizontal" tamano={26} producto="envíos" />
          <LogoSalix layout="horizontal" tamano={26} producto="canchas" />
          <LogoSalix layout="horizontal" tamano={26} producto="pedidos" />
        </div>
      </div>

      {/* Animaciones bajo demanda */}
      <Separador etiqueta="Animaciones bajo demanda" />
      <div>
        <Etiqueta>Reproducir animaciones de entrada</Etiqueta>
        <div className="flex flex-col items-center gap-6 py-6 rounded-lg" style={{ backgroundColor: 'var(--superficie-hover)' }}>
          <div key={keyReset}>
            <LogoSalix layout="completo" tamano={48} animacion={animacion} escalaTexto={1.1} hover={false} tap={false} />
          </div>
          <Fila>
            <Boton tamano="sm" variante={animacion === 'entrada' ? 'primario' : 'secundario'} onClick={() => reproducir('entrada')}>Entrada</Boton>
            <Boton tamano="sm" variante={animacion === 'ensamble' ? 'primario' : 'secundario'} onClick={() => reproducir('ensamble')}>Ensamble</Boton>
            <Boton tamano="sm" variante={animacion === 'pulso' ? 'primario' : 'secundario'} onClick={() => reproducir('pulso')}>Pulso</Boton>
          </Fila>
        </div>
      </div>

      {/* Splash */}
      <div>
        <Etiqueta>Splash Screen (pantalla de carga)</Etiqueta>
        <div className="flex gap-4">
          <Boton tamano="sm" onClick={() => setMostrarSplash(true)}>Ver Splash completo</Boton>
          <span className="text-xxs text-texto-terciario self-center">Se cierra solo después de 3s</span>
        </div>
        {mostrarSplash && (
          <>
            <SplashSalix producto="flux" />
            <AutoCerrarSplash onCerrar={() => setMostrarSplash(false)} />
          </>
        )}
        <Separador etiqueta="Splash inline" />
        <SplashSalix producto="flux" inline tamano={36} />
      </div>

      {/* Sobre fondos */}
      <div>
        <Etiqueta>Sobre fondos</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-center py-6 rounded-lg bg-white">
            <LogoSalix layout="horizontal" tamano={28} color="#111111" />
          </div>
          <div className="flex items-center justify-center py-6 rounded-lg bg-superficie-app">
            <LogoSalix layout="horizontal" tamano={28} color="#ffffff" />
          </div>
        </div>
      </div>
    </Seccion>
  )
}

/** Cierra el splash después de 3 segundos */
function AutoCerrarSplash({ onCerrar }: { onCerrar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, DELAY_ACCION)
    return () => clearTimeout(t)
  }, [onCerrar])
  return null
}

export default function PaginaVitrina() {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [tabActivo, setTabActivo] = useState('todos')
  const [selectValor, setSelectValor] = useState('')
  const [interruptor1, setInterruptor1] = useState(true)
  const [interruptor2, setInterruptor2] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pildorasActivas, setPildorasActivas] = useState(new Set(['cliente']))

  const togglePildora = (p: string) => {
    const nuevo = new Set(pildorasActivas)
    if (nuevo.has(p)) nuevo.delete(p)
    else nuevo.add(p)
    setPildorasActivas(nuevo)
  }

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-texto-primario">Vitrina de Componentes</h1>
        <p className="text-texto-secundario text-sm mt-1">Sistema de diseño de Flux by Salix — todos los componentes reutilizables</p>
      </div>

      {/* Indice de navegacion */}
      <nav className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-5 cristal-panel">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Fundamentos</h3>
            <ul className="space-y-1">
              <li><a href="#apariencia" className="text-texto-secundario hover:text-texto-marca transition-colors">Apariencia</a></li>
              <li><a href="#tokens" className="text-texto-secundario hover:text-texto-marca transition-colors">Tokens de color</a></li>
              <li><a href="#marca" className="text-texto-secundario hover:text-texto-marca transition-colors">Marca / Logo</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Entrada</h3>
            <ul className="space-y-1">
              <li><a href="#boton" className="text-texto-secundario hover:text-texto-marca transition-colors">Boton</a></li>
              <li><a href="#input" className="text-texto-secundario hover:text-texto-marca transition-colors">Input y Buscador</a></li>
              <li><a href="#select" className="text-texto-secundario hover:text-texto-marca transition-colors">Select</a></li>
              <li><a href="#interruptor" className="text-texto-secundario hover:text-texto-marca transition-colors">Interruptor</a></li>
              <li><a href="#editor" className="text-texto-secundario hover:text-texto-marca transition-colors">Editor de Texto</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Datos</h3>
            <ul className="space-y-1">
              <li><a href="#insignias" className="text-texto-secundario hover:text-texto-marca transition-colors">Insignias y Pildoras</a></li>
              <li><a href="#avatar" className="text-texto-secundario hover:text-texto-marca transition-colors">Avatar</a></li>
              <li><a href="#tarjeta" className="text-texto-secundario hover:text-texto-marca transition-colors">Tarjeta</a></li>
              <li><a href="#tabla" className="text-texto-secundario hover:text-texto-marca transition-colors">Tabla Dinamica</a></li>
              <li><a href="#timeline" className="text-texto-secundario hover:text-texto-marca transition-colors">Linea de tiempo</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Feedback</h3>
            <ul className="space-y-1">
              <li><a href="#alertas" className="text-texto-secundario hover:text-texto-marca transition-colors">Alertas</a></li>
              <li><a href="#toasts" className="text-texto-secundario hover:text-texto-marca transition-colors">Toasts</a></li>
              <li><a href="#notificaciones" className="text-texto-secundario hover:text-texto-marca transition-colors">Notificaciones</a></li>
              <li><a href="#vacio" className="text-texto-secundario hover:text-texto-marca transition-colors">Estado vacio</a></li>
              <li><a href="#cargadores" className="text-texto-secundario hover:text-texto-marca transition-colors">Cargadores</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Navegacion</h3>
            <ul className="space-y-1">
              <li><a href="#tabs" className="text-texto-secundario hover:text-texto-marca transition-colors">Tabs</a></li>
              <li><a href="#popover" className="text-texto-secundario hover:text-texto-marca transition-colors">Popover</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Superposiciones</h3>
            <ul className="space-y-1">
              <li><a href="#modal" className="text-texto-secundario hover:text-texto-marca transition-colors">Modal y BottomSheet</a></li>
              <li><a href="#enviar-doc" className="text-texto-secundario hover:text-texto-marca transition-colors">Modal Enviar Documento</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-2">Utilidades</h3>
            <ul className="space-y-1">
              <li><a href="#separador" className="text-texto-secundario hover:text-texto-marca transition-colors">Separador</a></li>
            </ul>
          </div>
        </div>
      </nav>

      {/* ═══ FUNDAMENTOS ═══ */}
      <Seccion id="apariencia" titulo="Apariencia">
        <SelectorApariencia />
      </Seccion>

      <Seccion id="tokens" titulo="Tokens de color">
        <div>
          <Etiqueta>Modulos</Etiqueta>
          <Fila>
            {['contactos','actividades','documentos','asistencias','visitas','inbox','productos','ordenes','calendario','auditoria'].map(m => (
              <div key={m} className="flex items-center gap-2 text-sm">
                <div className="size-3 rounded-full" style={{ backgroundColor: `var(--seccion-${m})` }} />
                {m}
              </div>
            ))}
          </Fila>
        </div>
        <div>
          <Etiqueta>Canales</Etiqueta>
          <Fila>
            <span className="px-3 py-1.5 rounded-md bg-canal-whatsapp-fondo text-canal-whatsapp text-sm font-medium">WhatsApp</span>
            <span className="px-3 py-1.5 rounded-md bg-canal-correo-fondo text-canal-correo text-sm font-medium">Correo</span>
            <span className="px-3 py-1.5 rounded-md bg-canal-interno-fondo text-canal-interno text-sm font-medium">Interno</span>
          </Fila>
        </div>
      </Seccion>

      <SeccionMarca id="marca" />

      {/* ═══ ENTRADA ═══ */}
      <Seccion id="boton" titulo="Boton">
        <div>
          <Etiqueta>Variantes</Etiqueta>
          <Fila>
            <Boton variante="primario">Primario</Boton>
            <Boton variante="secundario">Secundario</Boton>
            <Boton variante="fantasma">Fantasma</Boton>
            <Boton variante="peligro">Peligro</Boton>
            <Boton variante="exito">Éxito</Boton>
            <Boton variante="advertencia">Advertencia</Boton>
          </Fila>
        </div>
        <div>
          <Etiqueta>Tamaños</Etiqueta>
          <Fila>
            <Boton tamano="xs">Extra pequeño</Boton>
            <Boton tamano="sm">Pequeño</Boton>
            <Boton tamano="md">Mediano</Boton>
            <Boton tamano="lg">Grande</Boton>
          </Fila>
        </div>
        <div>
          <Etiqueta>Estados</Etiqueta>
          <Fila>
            <Boton cargando>Cargando</Boton>
            <Boton disabled>Deshabilitado</Boton>
            <Boton anchoCompleto variante="secundario">Ancho completo</Boton>
          </Fila>
        </div>
      </Seccion>

      <Seccion id="input" titulo="Input y Buscador">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input etiqueta="Nombre" placeholder="Juan Pérez" />
          <Input etiqueta="Correo" tipo="email" placeholder="juan@empresa.com" />
          <Input etiqueta="Contraseña" tipo="password" placeholder="••••••••" />
          <Input etiqueta="Con error" error="Este campo es requerido" />
          <Input etiqueta="Con ayuda" ayuda="Mínimo 8 caracteres" placeholder="Escribe aquí" />
          <Input etiqueta="Compacto" compacto placeholder="Campo compacto" />
        </div>
        <Separador etiqueta="Buscador con debounce" />
        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar contactos..." />
        {busqueda && <p className="text-xs text-texto-terciario">Buscando: &quot;{busqueda}&quot;</p>}
      </Seccion>

      <Seccion id="select" titulo="Select">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            etiqueta="Tipo de contacto"
            placeholder="Seleccionar tipo..."
            opciones={[
              { valor: 'cliente', etiqueta: 'Cliente', descripcion: 'Compra tus productos' },
              { valor: 'proveedor', etiqueta: 'Proveedor', descripcion: 'Te vende insumos' },
              { valor: 'prospecto', etiqueta: 'Prospecto', descripcion: 'Potencial cliente' },
              { valor: 'competidor', etiqueta: 'Competidor', deshabilitada: true },
            ]}
            valor={selectValor}
            onChange={setSelectValor}
          />
          <Select
            etiqueta="Con error"
            error="Seleccioná una opción"
            opciones={[
              { valor: 'a', etiqueta: 'Opción A' },
              { valor: 'b', etiqueta: 'Opción B' },
            ]}
            valor=""
            onChange={() => {}}
          />
        </div>
      </Seccion>

      <Seccion id="interruptor" titulo="Interruptor">
        <div className="flex flex-col gap-3">
          <Interruptor activo={interruptor1} onChange={setInterruptor1} etiqueta="Notificaciones push" />
          <Interruptor activo={interruptor2} onChange={setInterruptor2} etiqueta="Modo oscuro" />
          <Interruptor activo={false} onChange={() => {}} etiqueta="Deshabilitado" deshabilitado />
        </div>
      </Seccion>

      <SeccionEditorTexto id="editor" />

      {/* ═══ DATOS ═══ */}
      <Seccion id="insignias" titulo="Insignias y Píldoras">
        <div>
          <Etiqueta>Insignias (badges estáticos)</Etiqueta>
          <Fila>
            <Insignia color="exito">Activo</Insignia>
            <Insignia color="peligro">Urgente</Insignia>
            <Insignia color="advertencia">Pendiente</Insignia>
            <Insignia color="info">Nuevo</Insignia>
            <Insignia color="primario">Flux</Insignia>
            <Insignia color="neutro">Borrador</Insignia>
            <Insignia color="rosa">VIP</Insignia>
            <Insignia color="cyan">Soporte</Insignia>
            <Insignia color="violeta">Premium</Insignia>
            <Insignia color="naranja">Vencido</Insignia>
          </Fila>
        </div>
        <div>
          <Etiqueta>Insignias removibles</Etiqueta>
          <Fila>
            <Insignia color="primario" removible onRemover={() => mostrar('info', 'Tag removido')}>Etiqueta</Insignia>
            <Insignia color="exito" removible tamano="md" onRemover={() => {}}>Cliente VIP</Insignia>
          </Fila>
        </div>
        <Separador />
        <div>
          <Etiqueta>Píldoras (filtros clickeables)</Etiqueta>
          <Fila>
            <Pildora activa={pildorasActivas.has('cliente')} onClick={() => togglePildora('cliente')}>Cliente</Pildora>
            <Pildora activa={pildorasActivas.has('proveedor')} onClick={() => togglePildora('proveedor')}>Proveedor</Pildora>
            <Pildora activa={pildorasActivas.has('prospecto')} onClick={() => togglePildora('prospecto')}>Prospecto</Pildora>
            <Pildora removible onRemover={() => mostrar('info', 'Filtro removido')}>Buenos Aires</Pildora>
          </Fila>
        </div>
      </Seccion>

      <Seccion id="avatar" titulo="Avatar">
        <div>
          <Etiqueta>Tamaños con iniciales</Etiqueta>
          <Fila>
            <Avatar nombre="Juan Pérez" tamano="xs" />
            <Avatar nombre="María López" tamano="sm" />
            <Avatar nombre="Carlos Ruiz" tamano="md" />
            <Avatar nombre="Ana García" tamano="lg" />
            <Avatar nombre="Pedro Martínez" tamano="xl" />
          </Fila>
        </div>
        <div>
          <Etiqueta>Con indicador online/offline</Etiqueta>
          <Fila>
            <Avatar nombre="Juan Pérez" enLinea={true} />
            <Avatar nombre="María López" enLinea={false} />
            <Avatar nombre="Carlos Ruiz" enLinea={true} />
          </Fila>
        </div>
      </Seccion>

      <Seccion id="tarjeta" titulo="Tarjeta">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Tarjeta titulo="Contactos nuevos" subtitulo="Este mes" onClick={() => mostrar('info', 'Click en tarjeta')}>
            <p className="text-2xl font-bold text-texto-primario">24</p>
          </Tarjeta>
          <Tarjeta titulo="Presupuestos" subtitulo="Pendientes" acciones={<Insignia color="advertencia">3 vencen</Insignia>}>
            <p className="text-2xl font-bold text-texto-primario">$45,200</p>
          </Tarjeta>
          <Tarjeta titulo="Inbox" compacta>
            <div className="flex items-center gap-2">
              <Insignia color="exito">WhatsApp: 5</Insignia>
              <Insignia color="info">Correo: 2</Insignia>
            </div>
          </Tarjeta>
        </div>
      </Seccion>

      <SeccionTablaDinamica id="tabla" mostrar={mostrar} />

      <Seccion id="timeline" titulo="Línea de tiempo">
        <LineaTiempo items={itemsTimeline} />
      </Seccion>

      {/* ═══ FEEDBACK ═══ */}
      <Seccion id="alertas" titulo="Alertas">
        <Alerta tipo="exito" titulo="Contacto guardado">Los datos se actualizaron correctamente.</Alerta>
        <Alerta tipo="peligro" titulo="Error de conexión">No se pudo conectar con el servidor. Intentá de nuevo.</Alerta>
        <Alerta tipo="advertencia">El presupuesto PRE-2026-00042 vence mañana.</Alerta>
        <Alerta tipo="info" cerrable onCerrar={() => mostrar('info', 'Alerta cerrada')}>
          Hay 3 mensajes sin leer en tu inbox.
        </Alerta>
      </Seccion>

      <Seccion id="toasts" titulo="Toasts y alertas flotantes">
        <div>
          <Etiqueta>Toasts del sistema — aparecen abajo a la derecha con sonido, barra de progreso, auto-descarte en 4s</Etiqueta>
          <Fila>
            <Boton variante="exito" onClick={() => mostrar('exito', 'Contacto guardado correctamente')}>Éxito</Boton>
            <Boton variante="peligro" onClick={() => mostrar('error', 'Error al guardar el contacto')}>Error</Boton>
            <Boton variante="advertencia" onClick={() => mostrar('advertencia', 'El presupuesto PRE-2026-00042 vence mañana')}>Advertencia</Boton>
            <Boton variante="secundario" onClick={() => mostrar('info', 'Nuevo mensaje de Juan Pérez en inbox')}>Info</Boton>
          </Fila>
        </div>

        <Separador etiqueta="Textos reales por tipo" />
        <div>
          <Etiqueta>Ejemplos de cada variante con textos del sistema real</Etiqueta>
          <div className="flex flex-col gap-2 mt-3 max-w-[420px]">
            {toastsSistemaDemo.map((t) => (
              <button
                key={t.id}
                onClick={() => mostrar(t.tipo, t.mensaje)}
                className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-borde-sutil hover:bg-superficie-hover bg-superficie-tarjeta cursor-pointer transition-colors"
              >
                <span className={`shrink-0 size-2 rounded-full ${t.tipo === 'exito' ? 'bg-insignia-exito' : t.tipo === 'error' ? 'bg-insignia-peligro' : t.tipo === 'advertencia' ? 'bg-insignia-advertencia' : 'bg-insignia-info'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-texto-secundario">{t.etiqueta}</span>
                  <p className="text-sm text-texto-primario truncate">{t.mensaje}</p>
                </div>
                <span className="text-xxs text-texto-terciario shrink-0">Click para probar →</span>
              </button>
            ))}
          </div>
        </div>

        <Separador etiqueta="Toasts de notificación en tiempo real" />
        <div>
          <Etiqueta>Tarjetas flotantes que aparecen arriba a la derecha al recibir una notificación — se auto-descartan en 8s, máximo 3 visibles</Etiqueta>
          <div className="mt-3 flex flex-col gap-3 max-w-[380px]">
            {toastsNotifDemo.map((t) => (
              <div
                key={t.id}
                className="border border-borde-sutil rounded-2xl overflow-hidden shadow-sm"
                style={{ backgroundColor: 'var(--superficie-elevada)' }}
              >
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="size-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${t.color} 12%, transparent)` }}
                  >
                    {t.iconoComp}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: t.color }}>{t.etiqueta}</span>
                      <span className="text-xxs text-texto-terciario">Ahora</span>
                    </div>
                    <p className="text-sm font-medium text-texto-primario mt-0.5 truncate">{t.titulo}</p>
                    <p className="text-xs text-texto-terciario mt-0.5 line-clamp-2">{t.descripcion}</p>
                  </div>
                </div>
                <div className="flex border-t border-borde-sutil">
                  <span className="flex-1 py-2.5 text-xs font-medium text-texto-terciario text-center cursor-default">Descartar</span>
                  <div className="w-px bg-borde-sutil" />
                  <span className="flex-1 py-2.5 text-xs font-medium text-texto-marca text-center cursor-default">Ver</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separador etiqueta="Push Notifications (nativas del SO)" />
        <div>
          <Etiqueta>Así se ven las notificaciones push en el sistema operativo — requieren permiso + suscripción en Mi Cuenta</Etiqueta>
          <div className="mt-3 flex flex-col gap-3 max-w-[420px]">
            {pushDemo.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border border-borde-sutil bg-superficie-tarjeta"
              >
                <div className="size-10 rounded-lg bg-texto-marca/10 flex items-center justify-center shrink-0">
                  <img src="/icons/icon-72x72.png" alt="Flux" className="size-6 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-texto-primario">Flux</span>
                    <span className="text-xxs text-texto-terciario">{p.tiempo}</span>
                  </div>
                  <p className="text-sm font-medium text-texto-primario mt-0.5">{p.titulo}</p>
                  <p className="text-xs text-texto-terciario mt-0.5">{p.cuerpo}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-texto-terciario mt-1">
              Las push se envían automáticamente al crear cualquier notificación. El usuario las activa desde Mi Cuenta → Notificaciones push.
            </p>
          </div>
        </div>
      </Seccion>

      <SeccionNotificacionesVitrina id="notificaciones" mostrar={mostrar} />

      <Seccion id="vacio" titulo="Estado vacío">
        <EstadoVacio
          icono={<Users size={48} strokeWidth={1.2} />}
          titulo="Por acá se está muy solo..."
          descripcion="Todavía no hay contactos. Sumá al primero y empezá a llenar esto."
          accion={<Boton>Crear primer contacto</Boton>}
        />
      </Seccion>

      <Seccion id="cargadores" titulo="Cargadores">
        <div>
          <Etiqueta>Inline (sm / md / lg)</Etiqueta>
          <Fila>
            <div className="flex flex-col items-center gap-1">
              <Cargador tamano="sm" />
              <span className="text-xxs text-texto-terciario">sm</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Cargador tamano="md" />
              <span className="text-xxs text-texto-terciario">md</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Cargador tamano="lg" />
              <span className="text-xxs text-texto-terciario">lg</span>
            </div>
          </Fila>
        </div>
        <Separador etiqueta="Cargador de página (con logo Salix)" />
        <div className="rounded-xl border border-borde-sutil overflow-hidden" style={{ backgroundColor: 'var(--superficie-app)' }}>
          <Cargador tamano="pagina" texto="Cargando..." />
        </div>
        <div>
          <Etiqueta>Sección</Etiqueta>
          <CargadorSeccion texto="Cargando contactos..." />
        </div>
      </Seccion>

      {/* ═══ NAVEGACIÓN ═══ */}
      <Seccion id="tabs" titulo="Tabs">
        <Tabs
          tabs={[
            { clave: 'todos', etiqueta: 'Todos', contador: 42 },
            { clave: 'clientes', etiqueta: 'Clientes', contador: 18 },
            { clave: 'prospectos', etiqueta: 'Prospectos', contador: 12 },
            { clave: 'proveedores', etiqueta: 'Proveedores', contador: 7 },
          ]}
          activo={tabActivo}
          onChange={setTabActivo}
        />
        <p className="text-sm text-texto-secundario">Tab activo: <strong>{tabActivo}</strong></p>
      </Seccion>

      <Seccion id="popover" titulo="Popover">
        <div>
          <Etiqueta>Alineación y posición</Etiqueta>
          <Fila>
            <Popover
              alineacion="inicio"
              ancho={260}
              contenido={
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-texto-primario">Popover inicio</p>
                  <p className="text-xs text-texto-terciario">Se alinea al inicio (izquierda) del trigger. Cierra con Escape o click fuera.</p>
                </div>
              }
            >
              <Boton variante="secundario" tamano="sm">Inicio</Boton>
            </Popover>
            <Popover
              alineacion="centro"
              ancho={260}
              contenido={
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-texto-primario">Popover centro</p>
                  <p className="text-xs text-texto-terciario">Se centra respecto al trigger. Soporta modo cristal.</p>
                </div>
              }
            >
              <Boton variante="secundario" tamano="sm">Centro</Boton>
            </Popover>
            <Popover
              alineacion="fin"
              ancho={260}
              contenido={
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-texto-primario">Popover fin</p>
                  <p className="text-xs text-texto-terciario">Se alinea al final (derecha) del trigger. Es el más común para menús.</p>
                </div>
              }
            >
              <Boton variante="secundario" tamano="sm">Fin (default)</Boton>
            </Popover>
          </Fila>
        </div>
        <div>
          <Etiqueta>Anchos personalizados</Etiqueta>
          <Fila>
            <Popover
              ancho={200}
              contenido={<div className="p-4 text-sm text-texto-primario">200px de ancho</div>}
            >
              <Boton variante="fantasma" tamano="sm">Angosto (200)</Boton>
            </Popover>
            <Popover
              ancho={450}
              contenido={<div className="p-4 text-sm text-texto-primario">450px de ancho — ideal para paneles de notificaciones</div>}
            >
              <Boton variante="fantasma" tamano="sm">Ancho (450)</Boton>
            </Popover>
          </Fila>
        </div>
      </Seccion>

      {/* ═══ SUPERPOSICIONES ═══ */}
      <Seccion id="modal" titulo="Modal y BottomSheet">
        <Fila>
          <Boton onClick={() => setModalAbierto(true)}>Abrir modal</Boton>
          <Boton variante="secundario" onClick={() => setSheetAbierto(true)}>Abrir BottomSheet</Boton>
        </Fila>

        <Modal
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          titulo="Nuevo contacto"
          acciones={<>
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>{t('comun.cancelar')}</Boton>
            <Boton onClick={() => { setModalAbierto(false); mostrar('exito', 'Contacto guardado') }}>{t('comun.guardar')}</Boton>
          </>}
        >
          <div className="flex flex-col gap-4">
            <Input etiqueta="Nombre" placeholder="Nombre del contacto" />
            <Input etiqueta="Correo" tipo="email" placeholder="correo@empresa.com" />
            <Select etiqueta="Tipo" opciones={[
              { valor: 'cliente', etiqueta: 'Cliente' },
              { valor: 'prospecto', etiqueta: 'Prospecto' },
            ]} valor="" onChange={() => {}} />
          </div>
        </Modal>

        <BottomSheet
          abierto={sheetAbierto}
          onCerrar={() => setSheetAbierto(false)}
          titulo="Filtros"
          acciones={<>
            <Boton variante="secundario" anchoCompleto onClick={() => setSheetAbierto(false)}>Limpiar</Boton>
            <Boton anchoCompleto onClick={() => { setSheetAbierto(false); mostrar('exito', 'Filtros aplicados') }}>Aplicar</Boton>
          </>}
        >
          <div className="flex flex-col gap-4">
            <Select etiqueta="Tipo" opciones={[
              { valor: 'cliente', etiqueta: 'Cliente' },
              { valor: 'prospecto', etiqueta: 'Prospecto' },
            ]} valor="" onChange={() => {}} />
            <Interruptor activo={true} onChange={() => {}} etiqueta="Solo activos" />
          </div>
        </BottomSheet>
      </Seccion>

      <SeccionModalEnviarDocumento id="enviar-doc" />

      {/* ═══ UTILIDADES ═══ */}
      <Seccion id="separador" titulo="Separador">
        <Separador />
        <Separador etiqueta="O continuar con" />
        <Separador etiqueta="Sección 3" />
      </Seccion>
    </div>
  )
}

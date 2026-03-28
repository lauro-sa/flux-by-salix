'use client'

import { useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
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
import { BarraBusqueda } from '@/componentes/ui/BarraBusqueda'
import type { Filtro, PillGrupo, Plantilla, OpcionVista } from '@/componentes/ui/BarraBusqueda'
import {
  UserCircle, BarChart3, CalendarDays, PlusCircle, ArrowRight,
  FileEdit, FileText, ClipboardList, List, LayoutGrid, Columns3, Users,
  Sun, Moon, Gem, Monitor, Download, Trash2, Mail, Tag,
} from 'lucide-react'
import { TablaBase } from '@/componentes/tablas/TablaBase'
import { Kanban } from '@/componentes/tablas/Kanban'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica, FiltroTabla, AccionLote } from '@/componentes/tablas/TablaDinamica'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { useColoresEmpresa } from '@/hooks/useColoresEmpresa'
import { useToast } from '@/componentes/feedback/Toast'
import { useTema, type Tema, type Efecto, type FondoCristal, type EscalaTexto } from '@/hooks/useTema'
import { ALargeSmall } from 'lucide-react'

/* Vitrina de Componentes — Flux by Salix */

// Datos de ejemplo
const contactosEjemplo = [
  { id: '1', nombre: 'Juan Pérez', correo: 'juan@empresa.com', tipo: 'Cliente', etapa: 'Negociación' },
  { id: '2', nombre: 'María López', correo: 'maria@corp.com', tipo: 'Prospecto', etapa: 'Contactado' },
  { id: '3', nombre: 'Carlos Ruiz', correo: 'carlos@demo.com', tipo: 'Proveedor', etapa: 'Nuevo' },
  { id: '4', nombre: 'Ana García', correo: 'ana@tech.io', tipo: 'Cliente', etapa: 'Cerrado' },
  { id: '5', nombre: 'Pedro Martínez', correo: 'pedro@saas.com', tipo: 'Prospecto', etapa: 'Nuevo' },
]

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

const columnasKanban = [
  { id: 'Nuevo', titulo: 'Nuevo', color: 'var(--insignia-info)' },
  { id: 'Contactado', titulo: 'Contactado', color: 'var(--insignia-advertencia)' },
  { id: 'Negociación', titulo: 'Negociación', color: 'var(--insignia-primario)' },
  { id: 'Cerrado', titulo: 'Cerrado', color: 'var(--insignia-exito)' },
]

const itemsTimeline = [
  { id: '1', titulo: 'Contacto creado', descripcion: 'Juan Pérez fue registrado como cliente', fecha: 'Hace 2h', icono: <PlusCircle size={14} />, color: 'bg-insignia-exito-fondo text-insignia-exito-texto' },
  { id: '2', titulo: 'Etapa cambiada', descripcion: 'Nuevo → Contactado', fecha: 'Hace 1h', icono: <ArrowRight size={14} />, color: 'bg-insignia-info-fondo text-insignia-info-texto' },
  { id: '3', titulo: 'Nota agregada', descripcion: 'Se acordó reunión para el jueves', fecha: 'Hace 30min', icono: <FileEdit size={14} />, color: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto' },
  { id: '4', titulo: 'Presupuesto enviado', descripcion: 'PRE-2026-00042 por $15,000', fecha: 'Hace 10min', icono: <FileText size={14} />, color: 'bg-insignia-primario-fondo text-insignia-primario-texto' },
]

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-5 flex flex-col gap-4 cristal-panel">
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
            { clave: 'claro' as Tema, etiqueta: 'Claro', fondo: 'bg-white', barra: 'bg-gray-200', lineas: 'bg-gray-100' },
            { clave: 'oscuro' as Tema, etiqueta: 'Oscuro', fondo: 'bg-zinc-900', barra: 'bg-zinc-700', lineas: 'bg-zinc-800' },
            { clave: 'sistema' as Tema, etiqueta: 'Automático', fondo: 'bg-gradient-to-r from-white to-zinc-900', barra: 'bg-gray-400', lineas: 'bg-gray-500' },
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
                <div className="w-full h-20 rounded-md bg-gradient-to-br from-violet-500/20 via-blue-500/15 to-cyan-500/10 p-2 flex flex-col gap-1.5 border border-borde-sutil relative overflow-hidden">
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
                { clave: 'aurora' as FondoCristal, etiqueta: 'Aurora', descripcion: 'Colorido', gradiente: 'from-violet-600/40 via-cyan-500/30 to-emerald-500/20' },
                { clave: 'medianoche' as FondoCristal, etiqueta: 'Medianoche', descripcion: 'Azul profundo', gradiente: 'from-blue-700/40 via-indigo-600/30 to-blue-900/20' },
                { clave: 'ambar' as FondoCristal, etiqueta: 'Ámbar', descripcion: 'Cálido dorado', gradiente: 'from-amber-500/40 via-orange-500/30 to-red-500/20' },
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
function SeccionTablaDinamica({ mostrar }: { mostrar: (tipo: 'exito' | 'error' | 'advertencia' | 'info', mensaje: string) => void }) {
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
          {c.valorEstimado > 0 ? `$${c.valorEstimado.toLocaleString('es')}` : '—'}
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
    <Seccion titulo="Tabla Dinámica">
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
                <span className="text-xs font-medium text-texto-primario tabular-nums">${c.valorEstimado.toLocaleString('es')}</span>
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

function SeccionEditorTexto() {
  const [html, setHtml] = useState('')
  const { colores } = useColoresEmpresa()

  return (
    <Seccion titulo="Editor de Texto">
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

export default function PaginaVitrina() {
  const { mostrar } = useToast()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [tabActivo, setTabActivo] = useState('todos')
  const [selectValor, setSelectValor] = useState('')
  const [interruptor1, setInterruptor1] = useState(true)
  const [interruptor2, setInterruptor2] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [pildorasActivas, setPildorasActivas] = useState(new Set(['cliente']))

  /* Estado BarraBusqueda */
  const [barraBusqueda, setBarraBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState<string[]>([])
  const [filtroFecha, setFiltroFecha] = useState('')
  const [pillTipo, setPillTipo] = useState('todos')
  const [vistaActiva, setVistaActiva] = useState('lista')
  const [plantillasGuardadas, setPlantillasGuardadas] = useState<Plantilla[]>([
    { id: 'default', nombre: 'Todos los contactos', predefinida: true },
    { id: 'clientes-activos', nombre: 'Clientes activos', predefinida: false },
  ])
  const [plantillaActiva, setPlantillaActiva] = useState('')

  const filtrosDemo: Filtro[] = [
    {
      id: 'tipo',
      etiqueta: 'Tipo',
      icono: <UserCircle size={14} />,
      tipo: 'seleccion',
      valor: filtroTipo,
      onChange: (v) => setFiltroTipo(v as string),
      opciones: [
        { valor: 'cliente', etiqueta: 'Cliente' },
        { valor: 'prospecto', etiqueta: 'Prospecto' },
        { valor: 'proveedor', etiqueta: 'Proveedor' },
      ],
    },
    {
      id: 'etapa',
      etiqueta: 'Etapa',
      icono: <BarChart3 size={14} />,
      tipo: 'multiple',
      valor: filtroEtapa,
      onChange: (v) => setFiltroEtapa(v as string[]),
      opciones: [
        { valor: 'nuevo', etiqueta: 'Nuevo' },
        { valor: 'contactado', etiqueta: 'Contactado' },
        { valor: 'negociacion', etiqueta: 'Negociación' },
        { valor: 'cerrado', etiqueta: 'Cerrado' },
      ],
    },
    {
      id: 'fecha',
      etiqueta: 'Fecha de creación',
      icono: <CalendarDays size={14} />,
      tipo: 'fecha',
      valor: filtroFecha,
      onChange: (v) => setFiltroFecha(v as string),
    },
  ]

  const pillsGruposDemo: PillGrupo[] = [
    {
      id: 'tipo-rapido',
      etiqueta: 'Tipo',
      opciones: [
        { id: 'todos', etiqueta: 'Todos', conteo: 42 },
        { id: 'clientes', etiqueta: 'Clientes', conteo: 18 },
        { id: 'prospectos', etiqueta: 'Prospectos', conteo: 12 },
      ],
      activo: pillTipo,
      onChange: setPillTipo,
    },
  ]

  const opcionesVistaDemo: OpcionVista[] = [
    { id: 'lista', etiqueta: 'Lista', icono: <List size={14} /> },
    { id: 'tarjetas', etiqueta: 'Tarjetas', icono: <LayoutGrid size={14} /> },
    { id: 'kanban', etiqueta: 'Kanban', icono: <Columns3 size={14} /> },
  ]

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

      {/* SELECTOR DE APARIENCIA */}
      <Seccion titulo="Apariencia">
        <SelectorApariencia />
      </Seccion>

      {/* BOTONES */}
      <Seccion titulo="Boton">
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

      {/* INPUT + BUSCADOR */}
      <Seccion titulo="Input y Buscador">
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

      {/* SELECT */}
      <Seccion titulo="Select">
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

      {/* TABS */}
      <Seccion titulo="Tabs">
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

      {/* INSIGNIAS + PÍLDORAS */}
      <Seccion titulo="Insignias y Píldoras">
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

      {/* AVATARES */}
      <Seccion titulo="Avatar">
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

      {/* ALERTAS */}
      <Seccion titulo="Alertas">
        <Alerta tipo="exito" titulo="Contacto guardado">Los datos se actualizaron correctamente.</Alerta>
        <Alerta tipo="peligro" titulo="Error de conexión">No se pudo conectar con el servidor. Intentá de nuevo.</Alerta>
        <Alerta tipo="advertencia">El presupuesto PRE-2026-00042 vence mañana.</Alerta>
        <Alerta tipo="info" cerrable onCerrar={() => mostrar('info', 'Alerta cerrada')}>
          Hay 3 mensajes sin leer en tu inbox.
        </Alerta>
      </Seccion>

      {/* INTERRUPTORES */}
      <Seccion titulo="Interruptor">
        <div className="flex flex-col gap-3">
          <Interruptor activo={interruptor1} onChange={setInterruptor1} etiqueta="Notificaciones push" />
          <Interruptor activo={interruptor2} onChange={setInterruptor2} etiqueta="Modo oscuro" />
          <Interruptor activo={false} onChange={() => {}} etiqueta="Deshabilitado" deshabilitado />
        </div>
      </Seccion>

      {/* TARJETAS */}
      <Seccion titulo="Tarjeta">
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

      {/* BARRA DE BÚSQUEDA AVANZADA */}
      <Seccion titulo="Barra de Búsqueda">
        <div>
          <Etiqueta>Completa con filtros, vistas y favoritos</Etiqueta>
          <div className="mt-2">
            <BarraBusqueda
              busqueda={barraBusqueda}
              onBusqueda={setBarraBusqueda}
              placeholder="Buscar contactos..."
              contadorResultados={234}
              filtros={filtrosDemo}
              onLimpiarFiltros={() => {
                setFiltroTipo('')
                setFiltroEtapa([])
                setFiltroFecha('')
              }}
              pillsGrupos={pillsGruposDemo}
              plantillas={plantillasGuardadas}
              plantillaActivaId={plantillaActiva}
              onAplicarPlantilla={setPlantillaActiva}
              onGuardarNuevaPlantilla={(nombre) => {
                setPlantillasGuardadas([...plantillasGuardadas, { id: Date.now().toString(), nombre, predefinida: false }])
                mostrar('exito', `Vista "${nombre}" guardada`)
              }}
              onEliminarPlantilla={(id) => {
                setPlantillasGuardadas(plantillasGuardadas.filter((p) => p.id !== id))
                if (plantillaActiva === id) setPlantillaActiva('')
                mostrar('info', 'Vista eliminada')
              }}
              vistaActual={vistaActiva}
              opcionesVista={opcionesVistaDemo}
              onCambiarVista={setVistaActiva}
              mostrarBotonColumnas
              onAbrirColumnas={() => mostrar('info', 'Abrir selector de columnas')}
            />
          </div>
          {(barraBusqueda || filtroTipo || filtroEtapa.length > 0 || filtroFecha) && (
            <p className="text-xs text-texto-terciario mt-2">
              Busqueda: &quot;{barraBusqueda}&quot; | Tipo: {filtroTipo || '—'} | Etapas: {filtroEtapa.length > 0 ? filtroEtapa.join(', ') : '—'} | Fecha: {filtroFecha || '—'} | Vista: {vistaActiva}
            </p>
          )}
        </div>
        <Separador etiqueta="Solo búsqueda (mínima)" />
        <BarraBusqueda
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Búsqueda simple sin filtros..."
        />
      </Seccion>

      {/* TABLA DINÁMICA */}
      <SeccionTablaDinamica mostrar={mostrar} />

      {/* TABLA */}
      <Seccion titulo="Tabla (base)">
        <TablaBase
          columnas={[
            { clave: 'nombre', etiqueta: 'Nombre', render: (c) => (
              <div className="flex items-center gap-2">
                <Avatar nombre={c.nombre} tamano="xs" />
                <span className="font-medium">{c.nombre}</span>
              </div>
            )},
            { clave: 'correo', etiqueta: 'Correo' },
            { clave: 'tipo', etiqueta: 'Tipo', render: (c) => <Insignia color={c.tipo === 'Cliente' ? 'exito' : c.tipo === 'Prospecto' ? 'info' : 'neutro'}>{c.tipo}</Insignia> },
            { clave: 'etapa', etiqueta: 'Etapa' },
          ]}
          datos={contactosEjemplo}
          claveFila={(c) => c.id}
          seleccionables
          seleccionados={seleccionados}
          onSeleccionar={setSeleccionados}
          onClickFila={(c) => mostrar('info', `Click en ${c.nombre}`)}
        />
      </Seccion>

      {/* KANBAN */}
      <Seccion titulo="Kanban">
        <Kanban
          columnas={columnasKanban}
          items={contactosEjemplo}
          obtenerColumna={(c) => c.etapa}
          claveItem={(c) => c.id}
          renderItem={(c) => (
            <Tarjeta compacta onClick={() => mostrar('info', c.nombre)}>
              <div className="flex items-center gap-2">
                <Avatar nombre={c.nombre} tamano="sm" />
                <div>
                  <p className="text-sm font-medium text-texto-primario">{c.nombre}</p>
                  <p className="text-xs text-texto-terciario">{c.correo}</p>
                </div>
              </div>
            </Tarjeta>
          )}
        />
      </Seccion>

      {/* LÍNEA DE TIEMPO */}
      <Seccion titulo="Línea de tiempo">
        <LineaTiempo items={itemsTimeline} />
      </Seccion>

      {/* MODALES */}
      <Seccion titulo="Modal y BottomSheet">
        <Fila>
          <Boton onClick={() => setModalAbierto(true)}>Abrir modal</Boton>
          <Boton variante="secundario" onClick={() => setSheetAbierto(true)}>Abrir BottomSheet</Boton>
        </Fila>

        <Modal
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          titulo="Nuevo contacto"
          acciones={<>
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton onClick={() => { setModalAbierto(false); mostrar('exito', 'Contacto guardado') }}>Guardar</Boton>
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

      {/* TOASTS */}
      <Seccion titulo="Toast (notificaciones)">
        <Fila>
          <Boton variante="exito" onClick={() => mostrar('exito', 'Contacto guardado correctamente')}>Éxito</Boton>
          <Boton variante="peligro" onClick={() => mostrar('error', 'Error al guardar el contacto')}>Error</Boton>
          <Boton variante="advertencia" onClick={() => mostrar('advertencia', 'El presupuesto vence mañana')}>Advertencia</Boton>
          <Boton variante="secundario" onClick={() => mostrar('info', 'Nuevo mensaje en inbox')}>Info</Boton>
        </Fila>
      </Seccion>

      {/* ESTADO VACÍO */}
      <Seccion titulo="Estado vacío">
        <EstadoVacio
          icono={<Users size={48} strokeWidth={1.2} />}
          titulo="Por acá se está muy solo..."
          descripcion="Todavía no hay contactos. Sumá al primero y empezá a llenar esto."
          accion={<Boton>Crear primer contacto</Boton>}
        />
      </Seccion>

      {/* SEPARADORES */}
      <Seccion titulo="Separador">
        <Separador />
        <Separador etiqueta="O continuar con" />
        <Separador etiqueta="Sección 3" />
      </Seccion>

      {/* EDITOR DE TEXTO */}
      <SeccionEditorTexto />

      {/* TOKENS DE COLOR */}
      <Seccion titulo="Tokens de color">
        <div>
          <Etiqueta>Módulos</Etiqueta>
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
    </div>
  )
}

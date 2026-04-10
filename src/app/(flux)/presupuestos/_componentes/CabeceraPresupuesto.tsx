'use client'

/**
 * CabeceraPresupuesto — Cabecera del editor con título, iconos de acción,
 * barra de estado y botones de transición.
 * Se usa en: EditorPresupuesto.tsx
 */

import { useState, useRef, useEffect } from 'react'
import {
  Cloud, X, Info, RefreshCw,
  Send, Printer, FileCheck, Eye, Receipt, Ban, RotateCcw,
  Loader2, MoreHorizontal,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import BarraEstadoPresupuesto from './BarraEstadoPresupuesto'
import { ETIQUETAS_ESTADO, TRANSICIONES_ESTADO } from '@/tipos/presupuesto'
import type { EstadoPresupuesto } from '@/tipos/presupuesto'
import { Lock } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

interface PropsCabeceraPresupuesto {
  modo: 'crear' | 'editar'
  titulo: string
  estadoActual: EstadoPresupuesto
  esEditable: boolean
  estaCancelado: boolean
  estadosPosibles: EstadoPresupuesto[]
  guardando: boolean
  generandoPdf: boolean
  contactoId: string | null
  idPresupuesto: string | null | undefined
  presupuestoIdCreado: string | null
  fechaEmision: string
  presupuestoFechaEmision?: string | null
  // Callbacks
  onGuardar: () => void
  onDescartar: () => void
  onRegenerarPdf: () => Promise<void>
  onCambiarEstado: (estado: EstadoPresupuesto) => void
  onEnviar: () => void
  onEnviarProforma: () => void
  onImprimir: () => Promise<void>
  onVistaPrevia: () => Promise<void>
  onReEmitir: () => void
  onCrearPresupuesto: () => void
}

export default function CabeceraPresupuesto({
  modo,
  titulo,
  estadoActual,
  esEditable,
  estaCancelado,
  estadosPosibles,
  guardando,
  generandoPdf,
  contactoId,
  idPresupuesto,
  presupuestoIdCreado,
  fechaEmision,
  presupuestoFechaEmision,
  onGuardar,
  onDescartar,
  onRegenerarPdf,
  onCambiarEstado,
  onEnviar,
  onEnviarProforma,
  onImprimir,
  onVistaPrevia,
  onReEmitir,
  onCrearPresupuesto,
}: PropsCabeceraPresupuesto) {
  const { t } = useTraduccion()

  return (
    <div className="px-6 pt-5 pb-4 border-b border-borde-sutil">
      {/* Fila 1: Título */}
      <h1 className={`text-2xl sm:text-3xl font-semibold mb-2 ${
        modo === 'editar' ? 'text-texto-secundario' : 'text-texto-primario'
      }`}>
        {titulo}
      </h1>

      {/* Fila 2: Iconos izquierda + Barra de estados derecha */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Cloud size={16} />} onClick={modo === 'crear' && !idPresupuesto ? onCrearPresupuesto : onGuardar} disabled={modo === 'crear' && (!contactoId || guardando)} titulo={guardando ? 'Guardando...' : idPresupuesto ? 'Guardado' : modo === 'crear' && contactoId ? 'Guardar presupuesto' : 'Selecciona un cliente primero'} className={guardando ? 'text-texto-marca animate-pulse' : ''} />
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={16} />} onClick={onDescartar} titulo={idPresupuesto ? 'Eliminar presupuesto' : 'Descartar'} className={idPresupuesto ? 'text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10' : ''} />
          {/* Info y RefreshCw en modo editar o post-creación */}
          {(modo === 'editar' || presupuestoIdCreado) && (
            <>
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<Info size={16} />} titulo="Informacion del documento" />
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<RefreshCw size={16} className={generandoPdf ? 'animate-spin' : ''} />} onClick={onRegenerarPdf} disabled={generandoPdf} titulo="Regenerar PDF" />
            </>
          )}
        </div>
        <div className="ml-auto">
          <BarraEstadoPresupuesto estadoActual={estadoActual} onCambiarEstado={onCambiarEstado} />
        </div>
      </div>

      {/* Fila 3: Botones de acción (modo editar o post-creación) */}
      {(modo === 'editar' || presupuestoIdCreado) && (
        <div className="flex items-center gap-2 flex-wrap">
          <BotonesAccion
            estadoActual={estadoActual}
            estaCancelado={estaCancelado}
            estadosPosibles={estadosPosibles}
            generandoPdf={generandoPdf}
            presupuestoFechaEmision={presupuestoFechaEmision}
            fechaEmision={fechaEmision}
            onCambiarEstado={onCambiarEstado}
            onImprimir={onImprimir}
            onEnviar={onEnviar}
            onEnviarProforma={onEnviarProforma}
            onVistaPrevia={onVistaPrevia}
            onReEmitir={onReEmitir}
            t={t}
          />
        </div>
      )}

      {/* Indicación modo crear sin contacto */}
      {modo === 'crear' && !contactoId && !idPresupuesto && (
        <p className="text-sm text-texto-terciario">
          Selecciona un cliente para crear el presupuesto
        </p>
      )}
    </div>
  )
}

/** Botones de acción — principales visibles + secundarios en menú ··· */
function BotonesAccion({
  estadoActual, estaCancelado, estadosPosibles, generandoPdf,
  presupuestoFechaEmision, fechaEmision,
  onCambiarEstado, onImprimir, onEnviar, onEnviarProforma, onVistaPrevia, onReEmitir, t,
}: {
  estadoActual: EstadoPresupuesto
  estaCancelado: boolean
  estadosPosibles: EstadoPresupuesto[]
  generandoPdf: boolean
  presupuestoFechaEmision?: string | null
  fechaEmision?: string | null
  onCambiarEstado: (estado: EstadoPresupuesto) => void
  onImprimir: () => void
  onEnviar: () => void
  onEnviarProforma: () => void
  onVistaPrevia: () => void
  onReEmitir: () => void
  t: (key: string) => string
}) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const refMenu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAbierto) return
    const cerrar = (e: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuAbierto])

  const BotonAccion = ({ onClick, icono: Icono, label, variante = 'default', disabled = false, animarIcono = false }: {
    onClick: () => void; icono: typeof Send; label: string; variante?: string; disabled?: boolean; animarIcono?: boolean
  }) => (
    <Boton
      onClick={onClick}
      disabled={disabled}
      variante={variante === 'primario' ? 'primario' : variante === 'peligro' ? 'peligro' : 'secundario'}
      tamano="sm"
      icono={<Icono size={15} className={animarIcono ? 'animate-spin' : ''} />}
    >
      <span className="hidden sm:inline">{label}</span>
    </Boton>
  )

  const esEnviado = estadoActual === 'enviado'
  const esConfirmadoCliente = estadoActual === 'confirmado_cliente'
  const hoyStr = new Date().toISOString().split('T')[0]
  const emisionStr = (presupuestoFechaEmision || fechaEmision || '').slice(0, 10)
  const puedeReEmitir = emisionStr < hoyStr

  // Solo avanzar: desde enviado → orden_venta, desde confirmado_cliente → orden_venta
  const siguienteEstado: EstadoPresupuesto | undefined =
    esEnviado ? 'orden_venta'
    : esConfirmadoCliente ? 'orden_venta'
    : undefined

  if (estaCancelado) {
    return <BotonAccion onClick={() => onCambiarEstado('borrador')} icono={RotateCcw} label={t('documentos.restablecer_borrador')} />
  }

  // Opciones del menú ···
  const opcionesMenu: { icono: typeof Send; label: string; onClick: () => void; peligro?: boolean }[] = []
  opcionesMenu.push({ icono: Receipt, label: 'Enviar Factura Proforma', onClick: onEnviarProforma })
  if (puedeReEmitir) opcionesMenu.push({ icono: RefreshCw, label: 'Re-emitir', onClick: onReEmitir })

  // Orden fijo: Confirmar/Aprobar OV → Enviar → Imprimir → ··· → Cancelar
  const labelConfirmar = esConfirmadoCliente ? 'Aprobar Orden de Venta' : t('comun.confirmar')

  return (
    <>
      {siguienteEstado && (
        <BotonAccion
          onClick={() => onCambiarEstado(siguienteEstado)}
          icono={FileCheck}
          label={labelConfirmar}
          variante="primario"
        />
      )}
      <BotonAccion onClick={onEnviar} icono={Send} label={t('documentos.enviar')} />
      <BotonAccion onClick={onImprimir} icono={generandoPdf ? Loader2 : Printer} label={generandoPdf ? 'Generando...' : t('documentos.imprimir')} disabled={generandoPdf} animarIcono={generandoPdf} />
      <BotonAccion onClick={onVistaPrevia} icono={Eye} label={t('documentos.vista_previa')} />

      {/* Menú ··· con acciones secundarias */}
      <div ref={refMenu} className="relative">
        <Boton
          variante="secundario"
          tamano="sm"
          soloIcono
          icono={<MoreHorizontal size={16} />}
          onClick={() => setMenuAbierto(v => !v)}
          titulo="Más acciones"
        />
        {menuAbierto && (
          <div className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden py-1">
            {opcionesMenu.map(op => (
              <button
                key={op.label}
                type="button"
                onClick={() => { op.onClick(); setMenuAbierto(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-superficie-tarjeta ${op.peligro ? 'text-insignia-peligro' : 'text-texto-secundario hover:text-texto-primario'}`}
              >
                <op.icono size={15} />
                {op.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cancelar siempre visible al final */}
      {!estaCancelado && estadosPosibles.includes('cancelado') && (
        <BotonAccion onClick={() => onCambiarEstado('cancelado')} icono={Ban} label={t('comun.cancelar')} variante="peligro" />
      )}
    </>
  )
}

/** Banner de bloqueo — se muestra debajo de la cabecera si el documento no es editable */
export function BannerBloqueo({
  estadoActual,
  estadosPosibles,
  onCambiarEstado,
}: {
  estadoActual: EstadoPresupuesto
  estadosPosibles: EstadoPresupuesto[]
  onCambiarEstado: (estado: EstadoPresupuesto) => void
}) {
  return (
    <div className="px-6 py-3 bg-insignia-advertencia/10 border-b border-insignia-advertencia/20 flex items-center gap-2">
      <Lock size={14} className="text-insignia-advertencia" />
      <span className="text-sm text-texto-secundario">
        Este documento esta en estado <strong>{ETIQUETAS_ESTADO[estadoActual]}</strong> y no se puede editar.
      </span>
      {estadosPosibles.includes('borrador') && (
        <Boton variante="fantasma" tamano="xs" onClick={() => onCambiarEstado('borrador')} className="ml-1">Volver a Borrador</Boton>
      )}
    </div>
  )
}

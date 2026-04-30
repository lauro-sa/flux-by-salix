'use client'

/**
 * CabeceraPresupuesto — Cabecera del editor con título, iconos de acción,
 * barra de estado y botones de transición.
 * Se usa en: EditorPresupuesto.tsx
 */

import { useState, useRef, useEffect } from 'react'
import {
  Cloud, CloudCheck, X, Info, RefreshCw,
  Send, Printer, FileCheck, Eye, Receipt, Ban, RotateCcw,
  Loader2, MoreHorizontal, Wrench, ShieldCheck, Save,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
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
  /** Timestamp del último guardado exitoso. Se usa para mostrar el feedback
   *  "Guardado ✓" durante unos segundos después del autoguardado. */
  ultimoGuardadoEn?: number | null
  generandoPdf: boolean
  contactoId: string | null
  idPresupuesto: string | null | undefined
  presupuestoIdCreado: string | null
  fechaEmision: string
  presupuestoFechaEmision?: string | null
  /** Cantidad de re-emisiones (0 = nunca re-emitido) */
  cantidadReEmisiones?: number
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
  onGenerarOT?: () => void
  onVerOT?: () => void
  generandoOT?: boolean
  /** OT viva vinculada al presupuesto; si existe, se oculta "Generar OT" y se muestra "Ver OT". */
  ordenTrabajoVinculada?: { id: string; numero: string } | null
  /** True si el usuario es propietario o administrador y puede activar la edición administrativa */
  puedeEdicionAdmin?: boolean
  /** True si el documento está actualmente en modo de edición administrativa */
  modoEdicionAdmin?: boolean
  onActivarEdicionAdmin?: () => void
}

export default function CabeceraPresupuesto({
  modo,
  titulo,
  estadoActual,
  esEditable,
  estaCancelado,
  estadosPosibles,
  guardando,
  ultimoGuardadoEn,
  generandoPdf,
  contactoId,
  idPresupuesto,
  presupuestoIdCreado,
  fechaEmision,
  presupuestoFechaEmision,
  cantidadReEmisiones = 0,
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
  onGenerarOT,
  onVerOT,
  generandoOT,
  ordenTrabajoVinculada,
  puedeEdicionAdmin = false,
  modoEdicionAdmin = false,
  onActivarEdicionAdmin,
}: PropsCabeceraPresupuesto) {
  const { t } = useTraduccion()

  // Indicador "Guardado ✓" verde por 2s después de cada guardado exitoso.
  // Después vuelve al icono Cloud normal. Permite confirmación visual de
  // los autoguardados sin necesidad de toasts ruidosos.
  const [mostrarGuardado, setMostrarGuardado] = useState(false)
  useEffect(() => {
    if (!ultimoGuardadoEn) return
    setMostrarGuardado(true)
    const t = setTimeout(() => setMostrarGuardado(false), 2000)
    return () => clearTimeout(t)
  }, [ultimoGuardadoEn])

  return (
    <div className="px-6 pt-5 pb-4 border-b border-borde-sutil">
      {/* Fila 1: Título + badge re-emisión */}
      <div className="flex items-center gap-3 mb-2">
        <h1 className={`text-2xl sm:text-3xl font-semibold ${
          modo === 'editar' ? 'text-texto-secundario' : 'text-texto-primario'
        }`}>
          {titulo}
        </h1>
        {cantidadReEmisiones > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-insignia-advertencia/15 text-insignia-advertencia border border-insignia-advertencia/30">
            <RefreshCw size={12} />
            Re-emitido{cantidadReEmisiones > 1 ? ` ×${cantidadReEmisiones}` : ''}
          </span>
        )}
      </div>

      {/* Fila 2: Iconos izquierda + Barra de estados derecha */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={
              guardando
                ? <Cloud size={16} />
                : mostrarGuardado
                  ? <CloudCheck size={16} />
                  : <Cloud size={16} />
            }
            onClick={modo === 'crear' && !idPresupuesto ? onCrearPresupuesto : onGuardar}
            disabled={modo === 'crear' && (!contactoId || guardando)}
            titulo={
              guardando
                ? 'Guardando…'
                : mostrarGuardado
                  ? 'Guardado'
                  : idPresupuesto
                    ? 'Guardado'
                    : modo === 'crear' && contactoId
                      ? 'Guardar presupuesto'
                      : 'Selecciona un cliente primero'
            }
            className={
              guardando
                ? 'text-texto-marca animate-pulse'
                : mostrarGuardado
                  ? 'text-insignia-exito'
                  : ''
            }
          />
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
        <div className="flex items-center">
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
            onGenerarOT={onGenerarOT}
            onVerOT={onVerOT}
            generandoOT={generandoOT}
            ordenTrabajoVinculada={ordenTrabajoVinculada}
            puedeEdicionAdmin={puedeEdicionAdmin}
            modoEdicionAdmin={modoEdicionAdmin}
            onActivarEdicionAdmin={onActivarEdicionAdmin}
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
  onCambiarEstado, onImprimir, onEnviar, onEnviarProforma, onVistaPrevia, onReEmitir,
  onGenerarOT, onVerOT, generandoOT, ordenTrabajoVinculada,
  puedeEdicionAdmin, modoEdicionAdmin, onActivarEdicionAdmin, t,
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
  onGenerarOT?: () => void
  onVerOT?: () => void
  generandoOT?: boolean
  ordenTrabajoVinculada?: { id: string; numero: string } | null
  puedeEdicionAdmin?: boolean
  modoEdicionAdmin?: boolean
  onActivarEdicionAdmin?: () => void
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
  // Edición administrativa: solo para admin/propietario, en estados no
  // editables (≠ borrador) y cuando aún no se activó. La salida del modo
  // se hace desde el banner (botón "Guardar correcciones"), no desde aquí.
  if (
    puedeEdicionAdmin
    && !modoEdicionAdmin
    && estadoActual !== 'borrador'
    && !estaCancelado
    && onActivarEdicionAdmin
  ) {
    opcionesMenu.push({
      icono: ShieldCheck,
      label: 'Editar como administrador',
      onClick: onActivarEdicionAdmin,
    })
  }

  // Orden fijo: Confirmar/Aprobar OV → Enviar → Imprimir → ··· → Cancelar
  const labelConfirmar = esConfirmadoCliente ? 'Aprobar Orden de Venta' : t('comun.confirmar')

  return (
    <GrupoBotones>
      {siguienteEstado && (
        <BotonAccion
          onClick={() => onCambiarEstado(siguienteEstado)}
          icono={FileCheck}
          label={labelConfirmar}
          variante="primario"
        />
      )}
      {/* OT: si ya existe una viva vinculada → "Ver OT"; si no y el estado es
          orden_venta → "Generar OT". La OT en papelera se trata como inexistente
          (se permite regenerar) porque el GET solo devuelve OT no-papelera. */}
      {estadoActual === 'orden_venta' && (
        ordenTrabajoVinculada && onVerOT ? (
          <BotonAccion
            onClick={onVerOT}
            icono={Wrench}
            label={`Ver OT ${ordenTrabajoVinculada.numero}`}
          />
        ) : onGenerarOT ? (
          <BotonAccion
            onClick={onGenerarOT}
            icono={generandoOT ? Loader2 : Wrench}
            label={generandoOT ? 'Generando...' : 'Generar OT'}
            disabled={generandoOT}
            animarIcono={generandoOT}
          />
        ) : null
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
          <div className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg overflow-hidden py-1">
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
    </GrupoBotones>
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

/** Banner de edición administrativa — se muestra cuando un admin/propietario
 *  activó la corrección del documento. El estado, las fechas de envío y los
 *  contadores se preservan; al guardar se regenera el PDF y queda traza en
 *  historial + chatter. */
export function BannerEdicionAdmin({
  estadoActual,
  guardando,
  onGuardar,
  onCancelar,
}: {
  estadoActual: EstadoPresupuesto
  guardando: boolean
  onGuardar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="px-6 py-3 bg-insignia-info/10 border-b border-insignia-info/30 flex items-center gap-3">
      <ShieldCheck size={15} className="text-insignia-info shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-texto-secundario">
          <strong className="text-texto-primario">Edición administrativa</strong>
          {' — '}
          se mantiene el estado <strong>{ETIQUETAS_ESTADO[estadoActual]}</strong> y las fechas originales.
          Al guardar se regenera el PDF y queda traza en el historial.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Boton
          variante="fantasma"
          tamano="xs"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Boton>
        <Boton
          variante="primario"
          tamano="xs"
          onClick={onGuardar}
          disabled={guardando}
          icono={<Save size={14} className={guardando ? 'animate-pulse' : ''} />}
        >
          {guardando ? 'Guardando…' : 'Guardar correcciones'}
        </Boton>
      </div>
    </div>
  )
}

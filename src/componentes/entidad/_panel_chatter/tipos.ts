/**
 * Tipos locales del PanelChatter y sus sub-componentes.
 * Se usa en: PanelChatter, BarraAcciones, EntradaTimeline, EditorNota.
 */

import type { ReactNode } from 'react'
import type { AccionSistema, AdjuntoChatter, EntradaChatter, FiltroChatter } from '@/tipos/chatter'
import type { AdjuntoConOrigen } from './SeccionAdjuntos'

// ─── Modo de visualización del chatter ───
export type ModoChatter = 'inferior' | 'lateral'

// ─── Props del PanelChatter principal ───
export interface PropsPanelChatter {
  entidadTipo: string
  entidadId: string
  /** Datos del contacto vinculado (para pre-llenar acciones de correo/WA/actividad) */
  contacto?: ContactoChatter
  /** Contacto principal del documento (ej: edificio) — se usa para vincular en actividades */
  contactoPrincipal?: { id: string; nombre: string } | null
  /** Tipo de documento para contexto en modales ('Presupuesto', 'Factura', etc.) */
  tipoDocumento?: string
  /** Datos del documento para resolución de variables en plantillas WA */
  datosDocumento?: DatosDocumentoChatter
  /** Callback para abrir modal de envío de correo (el padre maneja el modal) */
  onAbrirCorreo?: () => void
  /** Adjuntos propios del documento (PDF generado, archivos vinculados, etc.) */
  adjuntosDocumento?: AdjuntoConOrigen[]
  /** Modo de visualización: 'lateral' (al costado) o 'inferior' (debajo) */
  modo?: ModoChatter
  /** Sección actual (ej: 'presupuestos', 'facturas') para config por sección */
  seccion?: string
  /** Secciones donde el usuario desactivó lateral. ['*'] = todas */
  sinLateral?: string[]
  /** Callback para cambiar config lateral */
  onCambiarSinLateral?: (sinLateral: string[]) => void
  /**
   * Callback para registrar un pago contra el documento. Si se provee, aparece
   * el botón "Pago" en la barra de acciones y la opción "Registrar como pago"
   * en cada mensaje/correo del timeline. El `entradaOrigen` indica desde qué
   * entrada del chatter se disparó (null = desde la barra principal); su `id`
   * se guarda en `presupuesto_pagos.chatter_origen_id`.
   */
  onRegistrarPago?: (entradaOrigen: EntradaChatter | null) => void
  /** Abrir el modal de edición de un pago existente (lápiz en la EntradaPago). */
  onEditarPago?: (pagoId: string) => void
  /** Confirmar eliminación de un pago (tacho en la EntradaPago). */
  onEliminarPago?: (pagoId: string, monto: string, moneda: string) => void
  className?: string
}

// ─── Datos del documento para preview de plantillas WA ───
export interface DatosDocumentoChatter {
  numero?: string
  total?: string
  fecha?: string
  estado?: string
  empresaNombre?: string
  urlPortal?: string
  /** Objeto crudo del presupuesto/orden/visita/actividad para que las variables
   *  del catálogo (documento_*, orden_*, visita_*, etc.) se resuelvan con datos reales. */
  entidades?: {
    presupuesto?: Record<string, unknown> | null
    orden?: Record<string, unknown> | null
    visita?: Record<string, unknown> | null
    actividad?: Record<string, unknown> | null
  }
}

// ─── Contacto simplificado para el chatter ───
export interface ContactoChatter {
  id?: string
  nombre?: string
  correo?: string
  whatsapp?: string
  telefono?: string
}

// ─── Config de íconos por acción ───
export interface ConfigIconoAccion {
  icono: ReactNode
  color: string
  etiqueta?: string
}

// ─── Props de EntradaTimeline ───
export interface PropsEntradaTimeline {
  entrada: EntradaChatter
  entidadTipo: string
  entidadId: string
  usuarioActualId?: string
  /** Formato de hora de la empresa: '24h' o '12h' */
  formatoHora?: string
  onAccionComprobante: (entradaId: string, comprobanteId: string, accion: 'confirmar' | 'rechazar') => void
  onEditarNota?: (entrada: EntradaChatter) => void
  onEliminarNota?: (entradaId: string) => void
  onRecargar: () => void
  /** Set de IDs de actividades que ya fueron completadas/canceladas/pospuestas — oculta botones */
  actividadesResueltas?: Set<string>
  /** Callbacks para acciones rápidas de actividad desde el chatter */
  onCompletarActividad?: (actividadId: string) => Promise<void>
  onPosponerActividad?: (actividadId: string, dias: number) => Promise<void>
  onCancelarActividad?: (actividadId: string) => Promise<void>
  onEditarActividad?: (actividadId: string) => void
  onEliminarActividad?: (actividadId: string) => Promise<void>
  /** Callback para abrir modal de visualización de actividad */
  onVerActividad?: (actividadId: string, metadata: Record<string, unknown>) => void
  /** Callback para registrar un pago tomando esta entrada como origen
   *  (vincula el comprobante al mensaje/correo entrante). */
  onRegistrarPagoDesdeMensaje?: (entrada: EntradaChatter) => void
  /** Editar un pago existente (lápiz en hover en EntradaPago) */
  onEditarPago?: (pagoId: string) => void
  /** Eliminar un pago existente (tacho en hover en EntradaPago) */
  onEliminarPago?: (pagoId: string, monto: string, moneda: string) => void
}

// ─── Props de EditorNota ───
export interface PropsEditorNota {
  entidadTipo: string
  entidadId: string
  /** Nota existente para editar (si es undefined, crea nueva) */
  notaEditando?: import('@/tipos/chatter').EntradaChatter | null
  onEnviado: () => void
  onCancelar: () => void
}

// ─── Props de BarraAcciones ───
export interface PropsBarraAcciones {
  onCorreo?: () => void
  onWhatsApp?: () => void
  onNota: () => void
  onActividad?: () => void
  onVisita?: () => void
  /** Si se provee, aparece botón "Pago" — usado en presupuestos. */
  onPago?: () => void
  tieneCorreo: boolean
  tieneWhatsApp: boolean
  tieneActividad: boolean
  tieneVisita?: boolean
  tienePago?: boolean
}

// ─── Props de FiltrosChatter ───
export interface PropsFiltrosChatter {
  filtro: FiltroChatter
  onChange: (filtro: FiltroChatter) => void
  contadores: Record<FiltroChatter, number>
}

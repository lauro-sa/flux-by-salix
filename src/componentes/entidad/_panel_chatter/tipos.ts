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
  tieneCorreo: boolean
  tieneWhatsApp: boolean
  tieneActividad: boolean
}

// ─── Props de FiltrosChatter ───
export interface PropsFiltrosChatter {
  filtro: FiltroChatter
  onChange: (filtro: FiltroChatter) => void
  contadores: Record<FiltroChatter, number>
}

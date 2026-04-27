/**
 * Mapeo `accion_destino` → acción inteligente del tipo de actividad.
 *
 * Los tipos de actividad son dinámicos: cada empresa define los suyos en
 * configuración → tipos de actividad. Cada tipo elige una `accion_destino`
 * de este catálogo, lo que determina qué documento crea al ejecutarse.
 *
 * Para agregar una acción nueva (ej. 'orden_trabajo'), basta con agregar la
 * entrada acá y la opción en `ACCIONES_DESTINO` del editor de tipo.
 */

import { FileText, MapPin, Mail as MailIcon } from 'lucide-react'

export interface AccionTipoActividad {
  etiqueta: string
  icono: typeof FileText
  /** Construye la ruta destino. `aId` se pasa como `actividad_origen_id` para que el backend
   *  pueda completarla automáticamente según `evento_auto_completar` del tipo. */
  ruta: (contactoId?: string, actividadOrigenId?: string) => string
}

function construirRuta(base: string, contactoId?: string, actividadOrigenId?: string): string {
  const params = new URLSearchParams({ desde: '/actividades' })
  if (contactoId) params.set('contacto_id', contactoId)
  if (actividadOrigenId) params.set('actividad_origen_id', actividadOrigenId)
  return `${base}?${params}`
}

export const ACCIONES_TIPO_ACTIVIDAD: Record<string, AccionTipoActividad> = {
  presupuesto: {
    etiqueta: 'Crear presupuesto',
    icono: FileText,
    ruta: (cId, aId) => construirRuta('/presupuestos/nuevo', cId, aId),
  },
  visita: {
    etiqueta: 'Ir a visitas',
    icono: MapPin,
    ruta: (cId, aId) => construirRuta('/visitas', cId, aId),
  },
  correo: {
    etiqueta: 'Enviar correo',
    icono: MailIcon,
    ruta: (cId, aId) => construirRuta('/inbox', cId, aId),
  },
}

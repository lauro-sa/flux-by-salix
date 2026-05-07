/**
 * Resolver de íconos lucide-react para las plantillas y filas del listado.
 *
 * El catálogo `plantillas-sugeridas.ts` referencia íconos por string
 * (ej: 'BellRing'). Acá los mapeamos al componente real. Mantenemos el
 * mapa explícito para evitar arrastrar todo lucide-react al bundle vía
 * imports dinámicos por nombre.
 *
 * Cuando 19.2 agregue íconos nuevos al editor, se suman acá.
 */

import {
  AlarmClock,
  ArrowRightCircle,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

const ICONOS: Record<string, LucideIcon> = {
  AlarmClock,
  ArrowRightCircle,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Workflow,
}

/**
 * Resuelve el componente de ícono. Si la clave no está en el mapa,
 * devuelve `Workflow` como fallback razonable (es el ícono del módulo).
 */
export function iconoLucide(nombre: string | null | undefined): LucideIcon {
  if (!nombre) return Workflow
  return ICONOS[nombre] ?? Workflow
}

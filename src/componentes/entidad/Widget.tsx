'use client'

import { ReactNode } from 'react'
import { useRol } from '@/hooks/useRol'
import { useModulos } from '@/hooks/useModulos'
import type { Modulo, Accion } from '@/tipos'
import type { Rol } from '@/tipos/miembro'

/**
 * Widget — Wrapper declarativo para secciones del dashboard (u otras páginas)
 * que deben ocultarse según módulo activo de la empresa o permiso del usuario.
 *
 * No renderiza DOM propio; si no cumple condiciones → devuelve null (no carga data,
 * no queda hueco en el grid). Usarlo SIEMPRE envolviendo widgets que consuman datos
 * sensibles: así evitamos fetch innecesario y fuga de información por UI.
 *
 * Ejemplo:
 *   <Widget modulo="ordenes_trabajo" permiso={{ modulo: 'ordenes_trabajo', accion: 'ver_todas' }}>
 *     <WidgetOrdenesSinPublicar />
 *   </Widget>
 *
 * Regla:
 * - Si se pasa `modulo` y la empresa NO lo tiene instalado → null.
 * - Si se pasa `permiso` y el usuario NO lo cumple → null.
 * - Se pueden combinar (AND): ambos deben cumplirse.
 * - Si no se pasan condiciones, siempre renderiza (equivalente a no usar el wrapper).
 */

interface PropsWidget {
  /** Slug del módulo requerido (ej: 'ordenes_trabajo', 'visitas'). Si la empresa no lo tiene instalado, no se renderiza. */
  modulo?: string
  /** Permiso requerido del usuario. Si no lo tiene, no se renderiza. */
  permiso?: { modulo: Modulo; accion: Accion }
  /** Rol específico (alternativa/complemento a permiso). Acepta un rol o lista. */
  rolEn?: Rol[]
  children: ReactNode
}

export function Widget({ modulo, permiso, rolEn, children }: PropsWidget) {
  const { rol, tienePermiso } = useRol()
  const { tieneModulo } = useModulos()

  // 1. Módulo: si se requiere y no está instalado, no renderizar
  if (modulo && !tieneModulo(modulo)) return null

  // 2. Permiso: si se requiere y no se cumple, no renderizar
  if (permiso && !tienePermiso(permiso.modulo, permiso.accion)) return null

  // 3. Rol: si se pasó lista de roles y el actual no está, no renderizar
  if (rolEn && rol && !rolEn.includes(rol)) return null
  if (rolEn && !rol) return null

  return <>{children}</>
}

/**
 * Definiciones de items de navegacion del Sidebar.
 * Genera items traducidos para cada seccion: principal, empresa, aplicaciones.
 */

import {
  Users, MapPin, FileText, Package,
  Mail, Clock, Calendar, Shield,
  Blocks, Building2,
  UserCog, Trash2,
  Route, Wrench,
  Zap, LayoutDashboard,
  Megaphone, FileBarChart,
} from 'lucide-react'
import { createElement } from 'react'
import type { ItemNav } from './tipos'

/** Crea un icono de Lucide con tamaño y grosor estandar del sidebar */
const icono = (Componente: typeof Mail) => createElement(Componente, { size: 20, strokeWidth: 1.75 })

/** Genera items de navegacion traducidos */
export function crearItemsNav(t: (c: string) => string): ItemNav[] {
  return [
    { id: 'inbox', etiqueta: t('navegacion.inbox'), icono: icono(Mail), ruta: '/inbox', seccion: 'principal', modulo: 'inbox_interno', moduloCatalogo: 'inbox' },
    { id: 'contactos', etiqueta: t('navegacion.contactos'), icono: icono(Users), ruta: '/contactos', seccion: 'principal', modulo: 'contactos', moduloCatalogo: 'contactos' },
    { id: 'actividades', etiqueta: t('navegacion.actividades'), icono: icono(Zap), ruta: '/actividades', seccion: 'principal', modulo: 'actividades', moduloCatalogo: 'actividades' },
    { id: 'calendario', etiqueta: t('navegacion.calendario'), icono: icono(Calendar), ruta: '/calendario', seccion: 'principal', modulo: 'calendario', moduloCatalogo: 'calendario' },
    { id: 'visitas', etiqueta: t('navegacion.visitas'), icono: icono(MapPin), ruta: '/visitas', seccion: 'principal', modulo: 'visitas', moduloCatalogo: 'visitas' },
    { id: 'recorrido', etiqueta: t('navegacion.recorrido'), icono: icono(Route), ruta: '/recorrido', seccion: 'principal', modulo: 'recorrido', moduloCatalogo: 'recorrido' },
    { id: 'productos', etiqueta: t('navegacion.productos'), icono: icono(Package), ruta: '/productos', seccion: 'documentos', modulo: 'productos', moduloCatalogo: 'productos' },
    { id: 'presupuestos', etiqueta: t('navegacion.presupuestos'), icono: icono(FileText), ruta: '/presupuestos', seccion: 'documentos', modulo: 'presupuestos', moduloCatalogo: 'presupuestos' },
    { id: 'informes', etiqueta: t('navegacion.informes'), icono: icono(FileBarChart), ruta: '/informes', seccion: 'documentos', modulo: 'informes', moduloCatalogo: 'informes' },
    { id: 'ordenes', etiqueta: t('navegacion.ordenes'), icono: icono(Wrench), ruta: '/ordenes', seccion: 'documentos', modulo: 'ordenes_trabajo', moduloCatalogo: 'ordenes_trabajo' },
    { id: 'marketing', etiqueta: t('navegacion.marketing'), icono: icono(Megaphone), ruta: '/marketing', seccion: 'principal', moduloCatalogo: 'marketing' },
    { id: 'asistencias', etiqueta: t('navegacion.asistencias'), icono: icono(Clock), ruta: '/asistencias', seccion: 'admin', modulo: 'asistencias', moduloCatalogo: 'asistencias' },
    { id: 'auditoria', etiqueta: t('navegacion.auditoria'), icono: icono(Shield), ruta: '/auditoria', seccion: 'admin', modulo: 'auditoria', moduloCatalogo: 'auditoria' },
    { id: 'papelera', etiqueta: t('navegacion.papelera'), icono: icono(Trash2), ruta: '/papelera', seccion: 'otros' },
  ]
}

export function crearItemsEmpresa(t: (c: string) => string): ItemNav[] {
  return [
    { id: 'empresa', etiqueta: t('empresa.titulo'), icono: icono(Building2), ruta: '/configuracion', fijo: true, seccion: 'otros', modulo: 'empresa' },
    { id: 'usuarios', etiqueta: t('navegacion.usuarios'), icono: icono(UserCog), ruta: '/usuarios', fijo: true, seccion: 'otros', modulo: 'usuarios' },
  ]
}

/** Aplicaciones — separado de empresa, es otro tipo de accion */
export function crearItemAplicaciones(t: (c: string) => string): ItemNav {
  return { id: 'aplicaciones', etiqueta: t('navegacion.aplicaciones'), icono: icono(Blocks), ruta: '/aplicaciones', fijo: true, seccion: 'otros' }
}

export function crearSecciones(t: (c: string) => string) {
  return [
    { id: 'principal', etiqueta: t('sidebar.secciones.principal') },
    { id: 'documentos', etiqueta: t('sidebar.secciones.documentos') },
    { id: 'admin', etiqueta: t('sidebar.secciones.admin') },
    { id: 'otros', etiqueta: t('sidebar.secciones.otros') },
  ]
}

/** Item de Inicio — siempre primero, sin seccion */
export function crearItemInicio(t: (c: string) => string): ItemNav {
  return { id: 'inicio', etiqueta: t('navegacion.inicio'), icono: icono(LayoutDashboard), ruta: '/dashboard', fijo: true, seccion: 'principal' }
}

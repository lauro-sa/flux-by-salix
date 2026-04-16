/**
 * Registro central de herramientas de Salix IA.
 * Mapea cada nombre de herramienta a su función ejecutora.
 */

import type { NombreHerramienta, EjecutorHerramienta } from '@/tipos/salix-ia'

import { ejecutarBuscarContactos } from './ejecutores/buscar-contactos'
import { ejecutarObtenerContacto } from './ejecutores/obtener-contacto'
import { ejecutarCrearContacto } from './ejecutores/crear-contacto'
import { ejecutarCrearActividad } from './ejecutores/crear-actividad'
import { ejecutarCrearRecordatorio } from './ejecutores/crear-recordatorio'
import { ejecutarCrearVisita } from './ejecutores/crear-visita'
import { ejecutarConsultarAsistencias } from './ejecutores/consultar-asistencias'
import { ejecutarConsultarCalendario } from './ejecutores/consultar-calendario'
import { ejecutarConsultarActividades } from './ejecutores/consultar-actividades'
import { ejecutarConsultarVisitas } from './ejecutores/consultar-visitas'
import { ejecutarBuscarPresupuestos } from './ejecutores/buscar-presupuestos'
import { ejecutarObtenerPresupuesto } from './ejecutores/obtener-presupuesto'
import { ejecutarConsultarEquipo } from './ejecutores/consultar-equipo'
import { ejecutarConsultarProductos } from './ejecutores/consultar-productos'
import { ejecutarModificarContacto } from './ejecutores/modificar-contacto'
import { ejecutarBuscarDireccion } from './ejecutores/buscar-direccion'
import { ejecutarModificarActividad } from './ejecutores/modificar-actividad'
import { ejecutarModificarVisita } from './ejecutores/modificar-visita'
import { ejecutarModificarPresupuesto } from './ejecutores/modificar-presupuesto'
import { ejecutarModificarEvento } from './ejecutores/modificar-evento'
import { ejecutarAnotarNota } from './ejecutores/anotar-nota'
import { ejecutarConsultarNotas } from './ejecutores/consultar-notas'
import { ejecutarModificarNota } from './ejecutores/modificar-nota'

/** Mapa de nombre → función ejecutora */
export const REGISTRO_EJECUTORES: Record<NombreHerramienta, EjecutorHerramienta> = {
  buscar_contactos: ejecutarBuscarContactos,
  obtener_contacto: ejecutarObtenerContacto,
  crear_contacto: ejecutarCrearContacto,
  crear_actividad: ejecutarCrearActividad,
  crear_recordatorio: ejecutarCrearRecordatorio,
  crear_visita: ejecutarCrearVisita,
  consultar_asistencias: ejecutarConsultarAsistencias,
  consultar_calendario: ejecutarConsultarCalendario,
  consultar_actividades: ejecutarConsultarActividades,
  consultar_visitas: ejecutarConsultarVisitas,
  buscar_presupuestos: ejecutarBuscarPresupuestos,
  obtener_presupuesto: ejecutarObtenerPresupuesto,
  consultar_equipo: ejecutarConsultarEquipo,
  consultar_productos: ejecutarConsultarProductos,
  modificar_contacto: ejecutarModificarContacto,
  buscar_direccion: ejecutarBuscarDireccion,
  modificar_actividad: ejecutarModificarActividad,
  modificar_visita: ejecutarModificarVisita,
  modificar_presupuesto: ejecutarModificarPresupuesto,
  modificar_evento: ejecutarModificarEvento,
  anotar_nota: ejecutarAnotarNota,
  consultar_notas: ejecutarConsultarNotas,
  modificar_nota: ejecutarModificarNota,
}

/**
 * Obtiene el ejecutor de una herramienta por su nombre.
 * Retorna null si la herramienta no existe.
 */
export function obtenerEjecutor(nombre: string): EjecutorHerramienta | null {
  return REGISTRO_EJECUTORES[nombre as NombreHerramienta] || null
}

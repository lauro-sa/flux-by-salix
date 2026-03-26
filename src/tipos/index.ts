/**
 * Barrel export de todos los tipos de Flux.
 * Importar desde: import type { Empresa, Perfil, ... } from '@/tipos'
 */
export type { Empresa } from './empresa'
export type { Perfil } from './perfil'
export type { Miembro, Rol, CompensacionTipo, CompensacionFrecuencia, HorarioTipo, MetodoFichaje } from './miembro'
export type { Invitacion } from './invitacion'
export type { Modulo, ModuloOperacional, ModuloDocumento, ModuloComunicacion, ModuloAdmin, ModuloConfig, Accion, PermisosMapa } from './permisos'
export { CATEGORIAS_MODULOS, ACCIONES_POR_MODULO, ETIQUETAS_MODULO, ETIQUETAS_ACCION } from './permisos'
export type { PermisoAuditoria } from './permisos_auditoria'
export type {
  TipoContacto, TipoContactoPredefinido,
  TipoRelacion, TipoRelacionPredefinido,
  Contacto, ContactoConRelaciones, ContactoResumido, OrigenContacto,
  VinculacionContacto, DireccionContacto, TipoDireccion,
  ResponsableContacto, SeguidorContacto,
  CampoFiscalPais, OpcionFiscal,
  CrearContactoPayload, EditarContactoPayload,
  Secuencia, FiltrosContacto,
} from './contacto'

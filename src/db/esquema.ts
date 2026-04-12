import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex, index, numeric, integer, date, doublePrecision, check, primaryKey, time, bigint } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Schema de Drizzle ORM para Flux by Salix.
 * Tablas globales (sin RLS) para auth y multi-tenant.
 * Tablas de negocio con empresa_id + RLS.
 */

// Empresas — cada organización en Flux
export const empresas = pgTable('empresas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  slug: text('slug').notNull().unique(),
  logo_url: text('logo_url'),
  pais: text('pais'), // país principal (legacy)
  paises: text('paises').array().notNull().default(sql`'{}'`), // países donde opera la empresa
  color_marca: text('color_marca'),
  descripcion: text('descripcion'),
  datos_fiscales: jsonb('datos_fiscales').notNull().default(sql`'{}'`), // datos fiscales dinámicos según país (cuit, condicion_iva, etc.)
  datos_bancarios: jsonb('datos_bancarios').notNull().default(sql`'{}'`), // {banco, titular, numero_cuenta, cbu, alias}
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Perfiles — datos del usuario, FK a auth.users
export const perfiles = pgTable('perfiles', {
  id: uuid('id').primaryKey(), // FK a auth.users.id (se setea manualmente)
  nombre: text('nombre').notNull(),
  apellido: text('apellido').notNull(),
  avatar_url: text('avatar_url'),
  telefono: text('telefono'),
  correo: text('correo'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
  contacto_emergencia: jsonb('contacto_emergencia'),
  fecha_nacimiento: date('fecha_nacimiento'),
  formato_nombre_remitente: text('formato_nombre_remitente').default('nombre_inicial_sector'),
  // Contacto empresa
  correo_empresa: text('correo_empresa'),
  telefono_empresa: text('telefono_empresa'),
  // Personal
  genero: text('genero'), // 'masculino' | 'femenino' | 'otro'
  documento_numero: text('documento_numero'),
  // Dirección
  domicilio: text('domicilio'),
  direccion: jsonb('direccion'),
})

// Miembros — relación usuario↔empresa con rol y estado de activación
export const miembros = pgTable('miembros', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  rol: text('rol').notNull().default('empleado'),
  activo: boolean('activo').notNull().default(false),
  permisos_custom: jsonb('permisos_custom'),
  unido_en: timestamp('unido_en', { withTimezone: true }).defaultNow().notNull(),
  // Laboral
  numero_empleado: integer('numero_empleado'),
  puesto_id: uuid('puesto_id'),
  puesto_nombre: text('puesto_nombre'),
  sector: text('sector'),
  // Horario y fichaje
  horario_tipo: text('horario_tipo'), // 'lunes_viernes' | 'lunes_sabado' | 'todos' | 'custom'
  horario_flexible: boolean('horario_flexible').notNull().default(false),
  metodo_fichaje: text('metodo_fichaje'), // 'kiosco' | 'automatico' | 'manual'
  fichaje_auto_movil: boolean('fichaje_auto_movil').notNull().default(false), // permitir fichaje automático desde móvil/PWA
  salix_ia_habilitado: boolean('salix_ia_habilitado').notNull().default(false),
  // Kiosco
  kiosco_rfid: text('kiosco_rfid'),
  kiosco_pin: text('kiosco_pin'),
  foto_kiosco_url: text('foto_kiosco_url'),
  // Asistencias
  turno_id: uuid('turno_id'), // FK a turnos_laborales (nullable, hereda sector → empresa)
  fecha_nacimiento: date('fecha_nacimiento'), // para saludos de cumpleaños en kiosco
  // Compensación / n��mina
  compensacion_tipo: text('compensacion_tipo').default('fijo'), // 'fijo' | 'por_dia' | 'por_hora'
  compensacion_monto: numeric('compensacion_monto').default('0'),
  compensacion_frecuencia: text('compensacion_frecuencia').default('mensual'), // 'semanal' | 'quincenal' | 'mensual' | 'eventual'
  dias_trabajo: integer('dias_trabajo').default(5), // 1-7 días por semana
}, (tabla) => [
  uniqueIndex('miembros_usuario_empresa_idx').on(tabla.usuario_id, tabla.empresa_id),
  index('miembros_empresa_idx').on(tabla.empresa_id),
])

// Invitaciones — tokens para unirse a una empresa
export const invitaciones = pgTable('invitaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  rol: text('rol').notNull().default('empleado'),
  correo: text('correo').notNull(),
  creado_por: uuid('creado_por').notNull(),
  usado: boolean('usado').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  expira_en: timestamp('expira_en', { withTimezone: true }).notNull(),
}, (tabla) => [
  index('invitaciones_token_idx').on(tabla.token),
  index('invitaciones_empresa_idx').on(tabla.empresa_id),
])

// Vistas guardadas — snapshots de filtros/búsqueda/orden por usuario y módulo
export const vistas_guardadas = pgTable('vistas_guardadas', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  modulo: text('modulo').notNull(),
  nombre: text('nombre').notNull(),
  predefinida: boolean('predefinida').notNull().default(false),
  estado: jsonb('estado').notNull().default({}),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('vistas_guardadas_usuario_modulo_idx').on(tabla.usuario_id, tabla.empresa_id, tabla.modulo),
])

// Permisos Auditoria — registro de cambios en permisos de miembros
export const permisos_auditoria = pgTable('permisos_auditoria', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  modulo: text('modulo'), // null = cambio global (revocacion total, restablecer)
  accion_tipo: text('accion_tipo').notNull(), // 'editar_permisos' | 'revocar_todo' | 'restablecer_rol'
  permisos_antes: jsonb('permisos_antes'), // snapshot de permisos antes del cambio
  permisos_despues: jsonb('permisos_despues'), // snapshot de permisos despues del cambio
  motivo: text('motivo'), // obligatorio en revocacion de emergencia
  editado_por: uuid('editado_por').notNull(), // usuario_id del propietario que hizo el cambio
  editado_en: timestamp('editado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('permisos_auditoria_miembro_idx').on(tabla.miembro_id),
  index('permisos_auditoria_empresa_idx').on(tabla.empresa_id),
])

// Pagos de nómina — registros de liquidación por miembro
export const pagos_nomina = pgTable('pagos_nomina', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  // Período
  fecha_inicio_periodo: date('fecha_inicio_periodo').notNull(),
  fecha_fin_periodo: date('fecha_fin_periodo').notNull(),
  concepto: text('concepto').notNull(),
  // Montos
  monto_sugerido: numeric('monto_sugerido').notNull().default('0'),
  monto_abonado: numeric('monto_abonado').notNull().default('0'),
  // Estadísticas snapshot
  dias_habiles: integer('dias_habiles').notNull().default(0),
  dias_trabajados: integer('dias_trabajados').notNull().default(0),
  dias_ausentes: integer('dias_ausentes').notNull().default(0),
  tardanzas: integer('tardanzas').notNull().default(0),
  // Comprobante y notas
  comprobante_url: text('comprobante_url'),
  notas: text('notas'),
  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  editado_por: uuid('editado_por'),
  editado_en: timestamp('editado_en', { withTimezone: true }),
  // Soft delete
  eliminado: boolean('eliminado').notNull().default(false),
  eliminado_en: timestamp('eliminado_en', { withTimezone: true }),
  eliminado_por: uuid('eliminado_por'),
}, (tabla) => [
  index('pagos_nomina_empresa_idx').on(tabla.empresa_id),
  index('pagos_nomina_miembro_idx').on(tabla.miembro_id),
  index('pagos_nomina_periodo_idx').on(tabla.empresa_id, tabla.miembro_id, tabla.fecha_inicio_periodo),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE CONTACTOS
// ═══════════════════════════════════════════════════════════════

// Tipos de contacto — configurables por empresa (persona, empresa, edificio, etc.)
export const tipos_contacto = pgTable('tipos_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  icono: text('icono').notNull().default('user'),
  color: text('color').notNull().default('primario'),
  puede_tener_hijos: boolean('puede_tener_hijos').notNull().default(false),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_contacto_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_contacto_empresa_idx').on(tabla.empresa_id),
])

// Tipos de relación — configurables por empresa (empleado_de, administra, etc.)
export const tipos_relacion = pgTable('tipos_relacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  etiqueta_inversa: text('etiqueta_inversa').notNull(),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_relacion_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_relacion_empresa_idx').on(tabla.empresa_id),
])

// Campos fiscales por país — tabla global de referencia (sin empresa_id)
export const campos_fiscales_pais = pgTable('campos_fiscales_pais', {
  id: uuid('id').primaryKey().defaultRandom(),
  pais: text('pais').notNull(),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  tipo_campo: text('tipo_campo').notNull().default('texto'), // 'texto', 'select', 'numero'
  opciones: jsonb('opciones'), // para selects
  obligatorio: boolean('obligatorio').notNull().default(false),
  patron_validacion: text('patron_validacion'), // regex
  mascara: text('mascara'), // máscara de input
  orden: integer('orden').notNull().default(0),
  aplica_a: text('aplica_a').array().notNull().default(sql`'{}'`), // tipos de contacto
  es_identificacion: boolean('es_identificacion').notNull().default(false), // true = campo de identidad (DNI, CUIT, RFC, etc.)
}, (tabla) => [
  uniqueIndex('campos_fiscales_pais_clave_idx').on(tabla.pais, tabla.clave),
])

// Contactos — tabla principal de CRM
export const contactos = pgTable('contactos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  tipo_contacto_id: uuid('tipo_contacto_id').notNull().references(() => tipos_contacto.id),
  codigo: text('codigo').notNull(),

  // Identidad
  nombre: text('nombre').notNull(),
  apellido: text('apellido'),
  titulo: text('titulo'), // Sr., Dra., Ing.

  // Contacto directo
  correo: text('correo'),
  telefono: text('telefono'),
  whatsapp: text('whatsapp'),
  web: text('web'),

  // Laboral
  cargo: text('cargo'),
  rubro: text('rubro'),

  // Comercial
  moneda: text('moneda').default('ARS'),
  idioma: text('idioma').default('es'),
  zona_horaria: text('zona_horaria'),
  limite_credito: numeric('limite_credito'),
  plazo_pago_cliente: text('plazo_pago_cliente'),
  plazo_pago_proveedor: text('plazo_pago_proveedor'),
  rank_cliente: integer('rank_cliente'),
  rank_proveedor: integer('rank_proveedor'),

  // Identificación fiscal
  pais_fiscal: text('pais_fiscal'), // código de país (AR, MX, CO, ES) — determina qué campos fiscales aplican
  tipo_identificacion: text('tipo_identificacion'),
  numero_identificacion: text('numero_identificacion'),
  datos_fiscales: jsonb('datos_fiscales').default({}), // campos específicos del país

  // Etiquetas (array nativo)
  etiquetas: text('etiquetas').array().default(sql`'{}'`),

  // Notas
  notas: text('notas'),

  // Estado
  activo: boolean('activo').notNull().default(true),
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
  es_provisorio: boolean('es_provisorio').notNull().default(false),

  // Origen
  origen: text('origen').notNull().default('manual'),

  // Vínculo con usuario (tipo 'equipo' se sincroniza con miembro)
  miembro_id: uuid('miembro_id').references(() => miembros.id, { onDelete: 'set null' }),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  editado_por: uuid('editado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('contactos_empresa_codigo_idx').on(tabla.empresa_id, tabla.codigo),
  index('contactos_empresa_idx').on(tabla.empresa_id),
  index('contactos_tipo_idx').on(tabla.empresa_id, tabla.tipo_contacto_id),
  index('contactos_correo_idx').on(tabla.empresa_id, tabla.correo),
  index('contactos_telefono_idx').on(tabla.empresa_id, tabla.telefono),
  index('contactos_whatsapp_idx').on(tabla.empresa_id, tabla.whatsapp),
  index('contactos_miembro_idx').on(tabla.miembro_id),
])

// Vinculaciones entre contactos — tabla intermedia bidireccional
export const contacto_vinculaciones = pgTable('contacto_vinculaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  vinculado_id: uuid('vinculado_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  tipo_relacion_id: uuid('tipo_relacion_id').references(() => tipos_relacion.id, { onDelete: 'set null' }),
  puesto: text('puesto'), // rol contextual libre
  recibe_documentos: boolean('recibe_documentos').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('vinculaciones_unica_idx').on(tabla.contacto_id, tabla.vinculado_id),
  index('vinculaciones_contacto_idx').on(tabla.contacto_id),
  index('vinculaciones_vinculado_idx').on(tabla.vinculado_id),
  index('vinculaciones_empresa_idx').on(tabla.empresa_id),
  check('no_auto_vinculacion', sql`contacto_id <> vinculado_id`),
])

// Direcciones de contacto
export const contacto_direcciones = pgTable('contacto_direcciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull().default('principal'), // 'principal', 'fiscal', 'entrega', 'otra'
  calle: text('calle'),
  numero: text('numero'),
  piso: text('piso'),
  departamento: text('departamento'),
  barrio: text('barrio'),
  ciudad: text('ciudad'),
  provincia: text('provincia'),
  codigo_postal: text('codigo_postal'),
  pais: text('pais'),
  timbre: text('timbre'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  texto: text('texto'), // dirección completa formateada
  es_principal: boolean('es_principal').notNull().default(false),
  // Contadores de visitas (actualizados al completar/cancelar visitas)
  total_visitas: integer('total_visitas').notNull().default(0),
  ultima_visita: timestamp('ultima_visita', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('direcciones_contacto_idx').on(tabla.contacto_id),
])

// Responsables asignados a un contacto
export const contacto_responsables = pgTable('contacto_responsables', {
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  asignado_en: timestamp('asignado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.contacto_id, tabla.usuario_id] }),
  index('responsables_usuario_idx').on(tabla.usuario_id),
])

// Seguidores de contacto — reciben notificaciones
export const contacto_seguidores = pgTable('contacto_seguidores', {
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  modo_copia: text('modo_copia'), // null = solo notificación, 'CC', 'CCO'
  agregado_en: timestamp('agregado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.contacto_id, tabla.usuario_id] }),
  index('seguidores_usuario_idx').on(tabla.usuario_id),
])

// Secuencias — generador de códigos atómicos por empresa y entidad
export const secuencias = pgTable('secuencias', {
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  entidad: text('entidad').notNull(), // 'contacto', 'presupuesto', 'factura', etc.
  prefijo: text('prefijo').notNull().default('C'),
  siguiente: integer('siguiente').notNull().default(1),
  digitos: integer('digitos').notNull().default(4),
}, (tabla) => [
  primaryKey({ columns: [tabla.empresa_id, tabla.entidad] }),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PRESUPUESTOS
// ═══════════════════════════════════════════════════════════════

// Presupuestos — cotizaciones comerciales vinculadas a contactos
export const presupuestos = pgTable('presupuestos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(), // P-0001 (generado por secuencia)
  estado: text('estado').notNull().default('borrador'), // borrador, enviado, aceptado, rechazado, vencido, cancelado

  // Contacto vinculado (snapshot al crear)
  contacto_id: uuid('contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  contacto_nombre: text('contacto_nombre'),
  contacto_apellido: text('contacto_apellido'),
  contacto_tipo: text('contacto_tipo'), // persona, empresa, etc.
  contacto_identificacion: text('contacto_identificacion'), // CUIT, DNI, etc.
  contacto_condicion_iva: text('contacto_condicion_iva'),
  contacto_direccion: text('contacto_direccion'),
  contacto_correo: text('contacto_correo'),
  contacto_telefono: text('contacto_telefono'),

  // Dirigido a (persona dentro de empresa, opcional)
  atencion_contacto_id: uuid('atencion_contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  atencion_nombre: text('atencion_nombre'),
  atencion_correo: text('atencion_correo'),
  atencion_cargo: text('atencion_cargo'),

  // Referencia interna opcional
  referencia: text('referencia'),

  // Moneda y condiciones de pago
  moneda: text('moneda').notNull().default('ARS'),
  cotizacion_cambio: numeric('cotizacion_cambio').default('1'), // tipo de cambio
  condicion_pago_id: text('condicion_pago_id'),
  condicion_pago_label: text('condicion_pago_label'),
  condicion_pago_tipo: text('condicion_pago_tipo'), // plazo_fijo, hitos

  // Fechas
  fecha_emision: timestamp('fecha_emision', { withTimezone: true }).defaultNow().notNull(),
  fecha_emision_original: timestamp('fecha_emision_original', { withTimezone: true }), // Se llena al re-emitir
  fecha_aceptacion: timestamp('fecha_aceptacion', { withTimezone: true }), // Se llena al pasar a confirmado_cliente u orden_venta
  dias_vencimiento: integer('dias_vencimiento').notNull().default(30),
  fecha_vencimiento: timestamp('fecha_vencimiento', { withTimezone: true }),

  // Totales (calculados desde líneas)
  subtotal_neto: numeric('subtotal_neto').notNull().default('0'),
  total_impuestos: numeric('total_impuestos').notNull().default('0'),
  descuento_global: numeric('descuento_global').notNull().default('0'), // porcentaje
  descuento_global_monto: numeric('descuento_global_monto').notNull().default('0'),
  total_final: numeric('total_final').notNull().default('0'),

  // Columnas visibles en la tabla de líneas (configurable por presupuesto)
  columnas_lineas: jsonb('columnas_lineas').default(sql`'["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]'`),

  // Notas y condiciones (HTML rico)
  notas_html: text('notas_html'),
  condiciones_html: text('condiciones_html'),
  nota_plan_pago: text('nota_plan_pago'),

  // PDF
  pdf_url: text('pdf_url'),
  pdf_miniatura_url: text('pdf_miniatura_url'),
  pdf_storage_path: text('pdf_storage_path'),
  pdf_generado_en: timestamp('pdf_generado_en', { withTimezone: true }),
  // PDF firmado (certificado de aceptación)
  pdf_firmado_url: text('pdf_firmado_url'),
  pdf_firmado_storage_path: text('pdf_firmado_storage_path'),

  // Vinculación con documento origen (para cadena presupuesto → factura)
  origen_documento_id: uuid('origen_documento_id'),
  origen_documento_numero: text('origen_documento_numero'),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),

  // Soft delete
  activo: boolean('activo').notNull().default(true),
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
}, (tabla) => [
  uniqueIndex('presupuestos_empresa_numero_idx').on(tabla.empresa_id, tabla.numero),
  index('presupuestos_empresa_idx').on(tabla.empresa_id),
  index('presupuestos_contacto_idx').on(tabla.contacto_id),
  index('presupuestos_estado_idx').on(tabla.empresa_id, tabla.estado),
  index('presupuestos_fecha_idx').on(tabla.empresa_id, tabla.fecha_emision),
])

// Líneas de presupuesto — productos, servicios, secciones, notas, descuentos
export const lineas_presupuesto = pgTable('lineas_presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Tipo de línea: producto (calculable), seccion (separador visual), nota (texto libre), descuento (monto fijo)
  tipo_linea: text('tipo_linea').notNull().default('producto'), // producto, seccion, nota, descuento
  orden: integer('orden').notNull().default(0),

  // Datos del producto/servicio (solo tipo_linea = 'producto')
  codigo_producto: text('codigo_producto'),
  descripcion: text('descripcion'),
  descripcion_detalle: text('descripcion_detalle'), // descripción extendida
  cantidad: numeric('cantidad').default('1'),
  unidad: text('unidad'), // hs, un, kg, m2, etc.
  precio_unitario: numeric('precio_unitario').default('0'),
  descuento: numeric('descuento').default('0'), // porcentaje por línea
  impuesto_label: text('impuesto_label'), // "IVA 21%"
  impuesto_porcentaje: numeric('impuesto_porcentaje').default('0'),

  // Calculados
  subtotal: numeric('subtotal').default('0'), // cantidad * precio * (1 - descuento/100)
  impuesto_monto: numeric('impuesto_monto').default('0'),
  total: numeric('total').default('0'),

  // Para tipo_linea = 'descuento' (monto fijo negativo)
  monto: numeric('monto'),

  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('lineas_presupuesto_presupuesto_idx').on(tabla.presupuesto_id),
  index('lineas_presupuesto_empresa_idx').on(tabla.empresa_id),
  index('lineas_presupuesto_orden_idx').on(tabla.presupuesto_id, tabla.orden),
])

// Historial de estados de presupuesto
export const presupuesto_historial = pgTable('presupuesto_historial', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  estado: text('estado').notNull(),
  usuario_id: uuid('usuario_id').notNull(),
  usuario_nombre: text('usuario_nombre'),
  fecha: timestamp('fecha', { withTimezone: true }).defaultNow().notNull(),
  notas: text('notas'), // motivo de rechazo, etc.
}, (tabla) => [
  index('presupuesto_historial_presupuesto_idx').on(tabla.presupuesto_id),
])

// Cuotas de pago de presupuesto (para condición tipo 'hitos')
export const presupuesto_cuotas = pgTable('presupuesto_cuotas', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  descripcion: text('descripcion'),
  porcentaje: numeric('porcentaje').notNull(),
  monto: numeric('monto').notNull().default('0'),
  dias_desde_emision: integer('dias_desde_emision').default(0),
  estado: text('estado').notNull().default('pendiente'), // pendiente, cobrada
  fecha_cobro: timestamp('fecha_cobro', { withTimezone: true }),
  cobrado_por_nombre: text('cobrado_por_nombre'),
}, (tabla) => [
  index('presupuesto_cuotas_presupuesto_idx').on(tabla.presupuesto_id),
])

// Configuración de presupuestos por empresa (JSONB flexible)
export const config_presupuestos = pgTable('config_presupuestos', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),

  // Impuestos disponibles
  impuestos: jsonb('impuestos').notNull().default(sql`'[{"id":"iva21","label":"IVA 21%","porcentaje":21,"activo":true},{"id":"iva105","label":"IVA 10.5%","porcentaje":10.5,"activo":true},{"id":"exento","label":"Exento","porcentaje":0,"activo":true}]'`),

  // Monedas disponibles
  monedas: jsonb('monedas').notNull().default(sql`'[{"id":"ARS","label":"Peso Argentino","simbolo":"$","activo":true},{"id":"USD","label":"Dólar","simbolo":"US$","activo":true},{"id":"EUR","label":"Euro","simbolo":"€","activo":true}]'`),
  moneda_predeterminada: text('moneda_predeterminada').notNull().default('ARS'),

  // Condiciones de pago
  condiciones_pago: jsonb('condiciones_pago').notNull().default(sql`'[{"id":"contado","label":"Contado","tipo":"plazo_fijo","diasVencimiento":0,"hitos":[],"notaPlanPago":"Pago al contado","predeterminado":false},{"id":"15dias","label":"15 días","tipo":"plazo_fijo","diasVencimiento":15,"hitos":[],"notaPlanPago":"Pago dentro de 15 días","predeterminado":false},{"id":"30dias","label":"30 días","tipo":"plazo_fijo","diasVencimiento":30,"hitos":[],"notaPlanPago":"Pago dentro de 30 días","predeterminado":true},{"id":"50_50","label":"50% adelanto + 50% al finalizar","tipo":"hitos","diasVencimiento":0,"hitos":[{"id":"h1","porcentaje":50,"descripcion":"Adelanto","diasDesdeEmision":0},{"id":"h2","porcentaje":50,"descripcion":"Al finalizar","diasDesdeEmision":0}],"predeterminado":false}]'`),

  // Días de vencimiento por defecto
  dias_vencimiento_predeterminado: integer('dias_vencimiento_predeterminado').notNull().default(30),

  // Condiciones y notas por defecto
  condiciones_predeterminadas: text('condiciones_predeterminadas'),
  notas_predeterminadas: text('notas_predeterminadas'),

  // Unidades de medida disponibles
  unidades: jsonb('unidades').notNull().default(sql`'[{"id":"un","label":"Unidad","abreviatura":"un"},{"id":"hs","label":"Hora","abreviatura":"hs"},{"id":"kg","label":"Kilogramo","abreviatura":"kg"},{"id":"m","label":"Metro","abreviatura":"m"},{"id":"m2","label":"Metro cuadrado","abreviatura":"m²"},{"id":"lt","label":"Litro","abreviatura":"lt"},{"id":"gl","label":"Global","abreviatura":"gl"}]'`),

  // Columnas por defecto para la tabla de líneas
  columnas_lineas_default: jsonb('columnas_lineas_default').default(sql`'["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]'`),

  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE MÓDULOS / APLICACIONES
// ═══════════════════════════════════════════════════════════════

// Catálogo maestro de módulos disponibles en Flux (tabla global, sin RLS)
export const catalogo_modulos = pgTable('catalogo_modulos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion').notNull().default(''),
  icono: text('icono').notNull().default('box'),
  categoria: text('categoria').notNull().default('operacional'), // base, operacional, documentos, comunicacion, admin, premium
  es_base: boolean('es_base').notNull().default(false),
  requiere: text('requiere').array().notNull().default(sql`'{}'`),
  orden: integer('orden').notNull().default(0),
  precio_mensual_usd: numeric('precio_mensual_usd').default('0'),
  precio_anual_usd: numeric('precio_anual_usd').default('0'),
  tier: text('tier').notNull().default('free'), // free, starter, pro, enterprise
  version: text('version').notNull().default('1.0.0'),
  destacado: boolean('destacado').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Módulos instalados por empresa
export const modulos_empresa = pgTable('modulos_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  modulo: text('modulo').notNull(), // slug del catálogo
  activo: boolean('activo').notNull().default(true),
  activado_en: timestamp('activado_en', { withTimezone: true }).defaultNow(),
  desactivado_en: timestamp('desactivado_en', { withTimezone: true }),
  config: jsonb('config').notNull().default(sql`'{}'`),
  catalogo_modulo_id: uuid('catalogo_modulo_id').references(() => catalogo_modulos.id),
  instalado_por: uuid('instalado_por'),
  version: text('version').default('1.0.0'),
  purga_programada_en: timestamp('purga_programada_en', { withTimezone: true }),
  purgado: boolean('purgado').notNull().default(false),
  notificacion_purga_enviada: boolean('notificacion_purga_enviada').notNull().default(false),
}, (tabla) => [
  uniqueIndex('modulos_empresa_unico_idx').on(tabla.empresa_id, tabla.modulo),
  index('modulos_empresa_empresa_idx').on(tabla.empresa_id),
])

// Suscripciones por empresa (preparada para Stripe)
export const suscripciones = pgTable('suscripciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('free'), // free, starter, pro, enterprise
  estado: text('estado').notNull().default('activa'), // activa, trial, vencida, cancelada
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  inicio_en: timestamp('inicio_en', { withTimezone: true }).defaultNow().notNull(),
  vence_en: timestamp('vence_en', { withTimezone: true }),
  trial_hasta: timestamp('trial_hasta', { withTimezone: true }),
  cancelado_en: timestamp('cancelado_en', { withTimezone: true }),
  limite_usuarios: integer('limite_usuarios'),
  limite_contactos: integer('limite_contactos'),
  limite_storage_mb: integer('limite_storage_mb'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('suscripciones_empresa_unica_idx').on(tabla.empresa_id),
])

// Portal — tokens de acceso público para que clientes vean presupuestos sin auth
export const portal_tokens = pgTable('portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  expira_en: timestamp('expira_en', { withTimezone: true }).notNull(),
  visto_en: timestamp('visto_en', { withTimezone: true }),
  veces_visto: integer('veces_visto').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  // PDF firmado (certificado de aceptación)
  pdf_firmado_url: text('pdf_firmado_url'),
  pdf_firmado_storage_path: text('pdf_firmado_storage_path'),
}, (tabla) => [
  index('portal_tokens_token_idx').on(tabla.token),
  index('portal_tokens_presupuesto_idx').on(tabla.presupuesto_id),
  index('portal_tokens_empresa_idx').on(tabla.empresa_id),
])

// ═══════════════════════════════════════════════════════════════
// CHATTER — Mensajes y eventos vinculados a cualquier entidad
// ═══════════════════════════════════════════════════════════════

export const chatter = pgTable('chatter', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Vínculo polimórfico
  entidad_tipo: text('entidad_tipo').notNull(), // 'presupuesto', 'contacto', 'orden', etc.
  entidad_id: uuid('entidad_id').notNull(),

  // Tipo de entrada
  tipo: text('tipo').notNull().default('mensaje'), // 'mensaje' | 'sistema' | 'nota_interna'

  // Contenido
  contenido: text('contenido').notNull(),

  // Autor
  autor_id: text('autor_id'), // uuid o 'portal', 'sistema', 'ia'
  autor_nombre: text('autor_nombre').notNull(),
  autor_avatar_url: text('autor_avatar_url'),

  // Adjuntos [{url, nombre, tipo, tamano}]
  adjuntos: jsonb('adjuntos').notNull().default(sql`'[]'`),

  // Metadata flexible {accion, detalles, ...}
  metadata: jsonb('metadata').notNull().default(sql`'{}'`),

  // Timestamps
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  editado_en: timestamp('editado_en', { withTimezone: true }),
}, (tabla) => [
  index('chatter_entidad_idx').on(tabla.entidad_tipo, tabla.entidad_id),
  index('chatter_empresa_idx').on(tabla.empresa_id),
  index('chatter_fecha_idx').on(tabla.entidad_tipo, tabla.entidad_id, tabla.creado_en),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PRODUCTOS Y SERVICIOS
// ═══════════════════════════════════════════════════════════════

// Productos — catálogo de productos y servicios por empresa
export const productos = pgTable('productos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  codigo: text('codigo').notNull(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').notNull().default('servicio'), // 'servicio' | 'producto' (default: servicio)

  // Categorización
  categoria: text('categoria'),
  favorito: boolean('favorito').notNull().default(false),
  referencia_interna: text('referencia_interna'),
  codigo_barras: text('codigo_barras'),
  imagen_url: text('imagen_url'),

  // Precios e impuestos
  precio_unitario: numeric('precio_unitario'),
  moneda: text('moneda'),
  costo: numeric('costo'),
  desglose_costos: jsonb('desglose_costos').notNull().default(sql`'[]'`),
  impuesto_id: text('impuesto_id'),
  impuesto_compra_id: text('impuesto_compra_id'),
  unidad: text('unidad').notNull().default('unidad'),

  // Descripciones
  descripcion: text('descripcion'),
  descripcion_venta: text('descripcion_venta'),
  notas_internas: text('notas_internas'),

  // Logística (solo tipo = 'producto')
  peso: numeric('peso'),
  volumen: numeric('volumen'),

  // Capacidades
  puede_venderse: boolean('puede_venderse').notNull().default(true),
  puede_comprarse: boolean('puede_comprarse').notNull().default(false),
  activo: boolean('activo').notNull().default(true),

  // Soft delete
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),

  // Origen: 'manual' = usuario, 'asistente_salix' = creado por IA
  origen: text('origen').notNull().default('manual'),
  // Provisorio: creado por IA, se confirma al guardar el presupuesto
  es_provisorio: boolean('es_provisorio').notNull().default(false),

  // Conteo de uso (actualizado automáticamente por triggers SQL)
  veces_presupuestado: integer('veces_presupuestado').notNull().default(0),
  veces_vendido: integer('veces_vendido').notNull().default(0),
  presupuestado_anual: jsonb('presupuestado_anual').notNull().default(sql`'{}'`),
  vendido_anual: jsonb('vendido_anual').notNull().default(sql`'{}'`),
}, (tabla) => [
  uniqueIndex('productos_empresa_codigo_idx').on(tabla.empresa_id, tabla.codigo),
  index('productos_empresa_idx').on(tabla.empresa_id),
  index('productos_tipo_idx').on(tabla.empresa_id, tabla.tipo),
  index('productos_categoria_idx').on(tabla.empresa_id, tabla.categoria),
  index('productos_activo_idx').on(tabla.empresa_id, tabla.activo),
  index('productos_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE ACTIVIDADES
// ═══════════════════════════════════════════════════════════════

// Tipos de actividad — configurables por empresa (Llamada, Reunión, Tarea, Visita, etc.)
export const tipos_actividad = pgTable('tipos_actividad', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(), // 'llamada', 'reunion', 'tarea', etc.
  etiqueta: text('etiqueta').notNull(), // 'Llamada', 'Reunión', etc.
  icono: text('icono').notNull().default('Activity'), // nombre del ícono Lucide
  color: text('color').notNull().default('#5b5bd6'), // hex color
  // Módulos donde está disponible este tipo de actividad
  modulos_disponibles: text('modulos_disponibles').array().notNull().default(sql`'{"contactos"}'`),
  // Vencimiento por defecto en días (0 = sin vencimiento)
  dias_vencimiento: integer('dias_vencimiento').notNull().default(1),
  // Campos habilitados para este tipo
  campo_fecha: boolean('campo_fecha').notNull().default(true),
  campo_descripcion: boolean('campo_descripcion').notNull().default(true),
  campo_responsable: boolean('campo_responsable').notNull().default(true),
  campo_prioridad: boolean('campo_prioridad').notNull().default(false),
  campo_checklist: boolean('campo_checklist').notNull().default(false),
  campo_calendario: boolean('campo_calendario').notNull().default(false),
  // Orden, estado, predefinido
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  // Tipos del sistema: no se puede editar nombre/clave/icono/color ni eliminar. Solo toggle activo y reordenar.
  es_sistema: boolean('es_sistema').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_actividad_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_actividad_empresa_idx').on(tabla.empresa_id),
])

// Estados de actividad — configurables por empresa (Pendiente, Completada, etc.)
export const estados_actividad = pgTable('estados_actividad', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(), // 'pendiente', 'completada', etc.
  etiqueta: text('etiqueta').notNull(),
  icono: text('icono').notNull().default('Circle'),
  color: text('color').notNull().default('#6b7280'),
  // Grupo de comportamiento: activo (visible en chatter), completado (timeline), cancelado (terminal)
  grupo: text('grupo').notNull().default('activo'), // 'activo' | 'completado' | 'cancelado'
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('estados_actividad_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('estados_actividad_empresa_idx').on(tabla.empresa_id),
])

// Configuración de posposición — presets por empresa
export const config_actividades = pgTable('config_actividades', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),
  // Presets de posposición [{id, etiqueta, dias}]
  presets_posposicion: jsonb('presets_posposicion').notNull().default(sql`'[{"id":"1d","etiqueta":"1 día","dias":1},{"id":"3d","etiqueta":"3 días","dias":3},{"id":"1s","etiqueta":"1 semana","dias":7},{"id":"2s","etiqueta":"2 semanas","dias":14}]'`),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Actividades — tareas, llamadas, reuniones, etc. vinculadas a entidades
export const actividades = pgTable('actividades', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Contenido
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion'),

  // Tipo y estado (FK a tablas configurables)
  tipo_id: uuid('tipo_id').notNull().references(() => tipos_actividad.id),
  tipo_clave: text('tipo_clave').notNull(), // snapshot para queries rápidas
  estado_id: uuid('estado_id').notNull().references(() => estados_actividad.id),
  estado_clave: text('estado_clave').notNull().default('pendiente'),

  // Prioridad
  prioridad: text('prioridad').notNull().default('normal'), // 'baja' | 'normal' | 'alta'

  // Fechas
  fecha_vencimiento: timestamp('fecha_vencimiento', { withTimezone: true }),
  fecha_completada: timestamp('fecha_completada', { withTimezone: true }),

  // Responsable (miembro del equipo asignado)
  asignado_a: uuid('asignado_a'), // usuario_id
  asignado_nombre: text('asignado_nombre'),

  // Checklist [{id, texto, completado}]
  checklist: jsonb('checklist').notNull().default(sql`'[]'`),

  // Vínculos a entidades [{tipo, id, nombre}]
  vinculos: jsonb('vinculos').notNull().default(sql`'[]'`),
  // Array de IDs para queries con array-contains
  vinculo_ids: text('vinculo_ids').array().notNull().default(sql`'{}'`),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),

  // Seguimientos (reclamos/follow-ups del cliente)
  seguimientos: jsonb('seguimientos').default([]),

  // Soft delete
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
}, (tabla) => [
  index('actividades_empresa_idx').on(tabla.empresa_id),
  index('actividades_tipo_idx').on(tabla.empresa_id, tabla.tipo_clave),
  index('actividades_estado_idx').on(tabla.empresa_id, tabla.estado_clave),
  index('actividades_asignado_idx').on(tabla.empresa_id, tabla.asignado_a),
  index('actividades_vencimiento_idx').on(tabla.empresa_id, tabla.fecha_vencimiento),
  index('actividades_creado_por_idx').on(tabla.empresa_id, tabla.creado_por),
  index('actividades_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
])

// ═══ CALENDARIO ═══

// Tipos de evento de calendario — configurables por empresa
export const tipos_evento_calendario = pgTable('tipos_evento_calendario', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  icono: text('icono').notNull().default('Calendar'),
  color: text('color').notNull().default('#3B82F6'),
  duracion_default: integer('duracion_default').notNull().default(60),
  todo_el_dia_default: boolean('todo_el_dia_default').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  orden: integer('orden').notNull().default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_evento_cal_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_evento_cal_empresa_idx').on(tabla.empresa_id),
])

// Configuración del calendario por empresa
export const config_calendario = pgTable('config_calendario', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),
  hora_inicio_laboral: time('hora_inicio_laboral').notNull().default('08:00'),
  hora_fin_laboral: time('hora_fin_laboral').notNull().default('18:00'),
  dias_laborales: integer('dias_laborales').array().notNull().default(sql`'{1,2,3,4,5}'`),
  intervalo_slot: integer('intervalo_slot').notNull().default(30),
  vista_default: text('vista_default').notNull().default('semana'),
  mostrar_fines_semana: boolean('mostrar_fines_semana').notNull().default(true),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Eventos de calendario — reuniones, tareas, bloqueos, etc.
export const eventos_calendario = pgTable('eventos_calendario', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Contenido
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion'),
  ubicacion: text('ubicacion'),

  // Tipo (FK a tabla configurable)
  tipo_id: uuid('tipo_id').references(() => tipos_evento_calendario.id),
  tipo_clave: text('tipo_clave'),
  color: text('color'),

  // Temporalidad
  fecha_inicio: timestamp('fecha_inicio', { withTimezone: true }).notNull(),
  fecha_fin: timestamp('fecha_fin', { withTimezone: true }).notNull(),
  todo_el_dia: boolean('todo_el_dia').notNull().default(false),

  // Recurrencia
  recurrencia: jsonb('recurrencia'),
  evento_padre_id: uuid('evento_padre_id'),
  es_excepcion: boolean('es_excepcion').notNull().default(false),
  fecha_excepcion: timestamp('fecha_excepcion', { withTimezone: true }),

  // Asignación múltiple [{id, nombre}]
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  asignados: jsonb('asignados').notNull().default(sql`'[]'`),
  asignado_ids: text('asignado_ids').array().notNull().default(sql`'{}'`),

  // Visibilidad: 'publica' | 'ocupado' | 'privada'
  visibilidad: text('visibilidad').notNull().default('publica'),

  // Vinculaciones polimórficas [{tipo, id, nombre}]
  vinculos: jsonb('vinculos').notNull().default(sql`'[]'`),
  vinculo_ids: text('vinculo_ids').array().notNull().default(sql`'{}'`),

  // Actividad vinculada (relación directa opcional)
  actividad_id: uuid('actividad_id'),

  // Estado: 'tentativo' | 'confirmado' | 'cancelado'
  estado: text('estado').notNull().default('confirmado'),

  // Notas
  notas: text('notas'),

  // Auditoría
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),

  // Recordatorio (minutos antes del evento, 0 = sin recordatorio)
  recordatorio_minutos: integer('recordatorio_minutos').notNull().default(0),

  // Soft delete
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
}, (tabla) => [
  index('eventos_cal_empresa_rango_idx').on(tabla.empresa_id, tabla.fecha_inicio, tabla.fecha_fin),
  index('eventos_cal_empresa_creador_idx').on(tabla.empresa_id, tabla.creado_por),
  index('eventos_cal_empresa_tipo_idx').on(tabla.empresa_id, tabla.tipo_clave),
  index('eventos_cal_empresa_actividad_idx').on(tabla.empresa_id, tabla.actividad_id),
  index('eventos_cal_empresa_padre_idx').on(tabla.empresa_id, tabla.evento_padre_id),
  index('eventos_cal_empresa_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
])

// Recordatorios de calendario — programados para enviar antes de un evento
export const recordatorios_calendario = pgTable('recordatorios_calendario', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  evento_id: uuid('evento_id').notNull().references(() => eventos_calendario.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  usuario_nombre: text('usuario_nombre'),
  programado_para: timestamp('programado_para', { withTimezone: true }).notNull(),
  enviado: boolean('enviado').notNull().default(false),
  enviado_en: timestamp('enviado_en', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('recordatorios_cal_pendientes_idx').on(tabla.programado_para, tabla.enviado),
  index('recordatorios_cal_evento_idx').on(tabla.evento_id),
])

// Feriados — días no laborables configurados por empresa
export const feriados = pgTable('feriados', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  fecha: date('fecha').notNull(),
  tipo: text('tipo').notNull().default('nacional'), // 'nacional' | 'puente' | 'empresa' | 'regional'
  pais_codigo: text('pais_codigo'), // ISO 3166-1 alpha-2 (nullable — null = aplica a todos)
  recurrente: boolean('recurrente').notNull().default(false),
  dia_mes: integer('dia_mes'), // día del mes para recurrentes (ej: 25 para Navidad)
  mes: integer('mes'), // mes para recurrentes (ej: 12 para Navidad)
  activo: boolean('activo').notNull().default(true),
  origen: text('origen').notNull().default('manual'), // 'libreria' | 'manual' | 'importado'
  creado_por: uuid('creado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('feriados_empresa_fecha_idx').on(tabla.empresa_id, tabla.fecha),
  index('feriados_empresa_anio_idx').on(tabla.empresa_id, tabla.activo),
  uniqueIndex('feriados_empresa_fecha_nombre_idx').on(tabla.empresa_id, tabla.fecha, tabla.nombre),
])

// ═══ PRODUCTOS ═══

// Configuración de productos por empresa (JSONB flexible)
export const config_productos = pgTable('config_productos', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),

  // Categorías de producto/servicio
  categorias: jsonb('categorias').notNull().default(sql`'[{"id":"general","label":"General"},{"id":"tecnologia","label":"Tecnología"},{"id":"limpieza","label":"Limpieza"},{"id":"mantenimiento","label":"Mantenimiento"},{"id":"consultoria","label":"Consultoría"},{"id":"insumos","label":"Insumos"}]'`),

  // Unidades de medida
  unidades: jsonb('unidades').notNull().default(sql`'[{"id":"unidad","label":"Unidad","abreviatura":"un"},{"id":"hora","label":"Hora","abreviatura":"hs"},{"id":"servicio","label":"Servicio","abreviatura":"srv"},{"id":"metro","label":"Metro","abreviatura":"m"},{"id":"kg","label":"Kilogramo","abreviatura":"kg"},{"id":"litro","label":"Litro","abreviatura":"lt"},{"id":"dia","label":"Día","abreviatura":"día"},{"id":"mes","label":"Mes","abreviatura":"mes"},{"id":"global","label":"Global","abreviatura":"gl"},{"id":"m2","label":"Metro cuadrado","abreviatura":"m²"}]'`),

  // Prefijos de código (cada uno con su secuencia independiente)
  prefijos: jsonb('prefijos').notNull().default(sql`'[{"id":"producto","prefijo":"PRD","label":"Producto","siguiente":1},{"id":"servicio","prefijo":"SRV","label":"Servicio","siguiente":1}]'`),

  // Categorías de desglose de costos
  categorias_costo: jsonb('categorias_costo').notNull().default(sql`'[{"id":"mano_obra","label":"Mano de obra"},{"id":"materiales","label":"Materiales"},{"id":"horas_hombre","label":"Horas hombre"},{"id":"movilidad","label":"Movilidad"},{"id":"flete","label":"Flete"},{"id":"seguros","label":"Seguros"},{"id":"repuestos","label":"Repuestos"},{"id":"traslado","label":"Traslado"}]'`),

  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Notificaciones — notificaciones in-app por usuario
export const notificaciones = pgTable('notificaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  tipo: text('tipo').notNull(), // 'nuevo_mensaje', 'asignacion', 'mencion', 'sla_vencido', 'actividad', 'portal_vista', etc.
  titulo: text('titulo').notNull(),
  cuerpo: text('cuerpo'),
  icono: text('icono'), // nombre de ícono lucide
  color: text('color'), // color semántico
  url: text('url'), // ruta para navegar al abrir
  leida: boolean('leida').notNull().default(false),
  referencia_tipo: text('referencia_tipo'), // 'conversacion', 'mensaje', 'contacto', 'actividad', 'presupuesto', etc.
  referencia_id: uuid('referencia_id'),
  creada_en: timestamp('creada_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('idx_notificaciones_usuario').on(tabla.usuario_id, tabla.empresa_id, tabla.leida, tabla.creada_en),
  index('idx_notificaciones_empresa').on(tabla.empresa_id),
])

// Recordatorios — recordatorios personales de cada usuario
export const recordatorios = pgTable('recordatorios', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  creado_por: uuid('creado_por').notNull(), // usuario que lo creó
  asignado_a: uuid('asignado_a').notNull(), // usuario al que va dirigido (puede ser él mismo u otro)
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion'),
  fecha: date('fecha').notNull(), // fecha del recordatorio
  hora: text('hora'), // null = todo el día, "14:30" = hora específica
  repetir: text('repetir').notNull().default('ninguno'), // 'ninguno' | 'diario' | 'semanal' | 'mensual' | 'anual' | 'personalizado'
  recurrencia: jsonb('recurrencia'), // Config avanzada: { diasSemana?: number[], diaMes?: number, semanaDelMes?: number, cadaMeses?: number }
  alerta_modal: boolean('alerta_modal').notNull().default(false), // true = abre modal al momento, false = solo notificación en campana
  completado: boolean('completado').notNull().default(false),
  completado_en: timestamp('completado_en', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('idx_recordatorios_usuario').on(tabla.asignado_a, tabla.empresa_id, tabla.completado, tabla.fecha),
  index('idx_recordatorios_empresa').on(tabla.empresa_id),
])

// Suscripciones Push — para notificaciones PWA en segundo plano
export const suscripcionesPush = pgTable('suscripciones_push', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  user_agent: text('user_agent'),
  activa: boolean('activa').notNull().default(true),
  creada_en: timestamp('creada_en', { withTimezone: true }).defaultNow().notNull(),
  ultima_notificacion_en: timestamp('ultima_notificacion_en', { withTimezone: true }),
}, (tabla) => [
  index('idx_suscripciones_push_usuario').on(tabla.usuario_id, tabla.empresa_id),
])

// ═══════════════════════════════════════════════════════════════
// INBOX / MENSAJERÍA
// ═══════════════════════════════════════════════════════════════

// Canales de inbox — conexiones de correo, WhatsApp, etc.
export const canales_inbox = pgTable('canales_inbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(), // 'correo', 'whatsapp', etc.
  nombre: text('nombre').notNull(),
  proveedor: text('proveedor'), // 'gmail', 'imap', 'meta', etc.
  activo: boolean('activo').notNull().default(true),
  config_conexion: jsonb('config_conexion').notNull().default(sql`'{}'`),
  estado_conexion: text('estado_conexion').notNull().default('desconectado'),
  ultimo_error: text('ultimo_error'),
  ultima_sincronizacion: timestamp('ultima_sincronizacion', { withTimezone: true }),
  sync_cursor: jsonb('sync_cursor').default(sql`'{}'`),
  modulos_disponibles: text('modulos_disponibles').array().notNull().default(sql`'{}'`),
  es_principal: boolean('es_principal').notNull().default(false),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('canales_inbox_empresa_idx').on(tabla.empresa_id),
])

// Reglas de correo por tipo de contacto — qué bandeja usar para cada tipo
export const correo_por_tipo_contacto = pgTable('correo_por_tipo_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  tipo_contacto_id: uuid('tipo_contacto_id').notNull().references(() => tipos_contacto.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').notNull().references(() => canales_inbox.id, { onDelete: 'cascade' }),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('correo_tipo_contacto_empresa_idx').on(tabla.empresa_id, tabla.tipo_contacto_id),
  index('correo_por_tipo_contacto_empresa_idx').on(tabla.empresa_id),
])

// Canales internos — chat de equipo (públicos, privados, DMs)
export const canales_internos = pgTable('canales_internos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  tipo: text('tipo').notNull().default('publico'), // 'publico' | 'privado' | 'dm'
  icono: text('icono'),
  color: text('color'),
  participantes_dm: uuid('participantes_dm').array(), // solo para tipo = 'dm'
  archivado: boolean('archivado').notNull().default(false),
  ultimo_mensaje_texto: text('ultimo_mensaje_texto'),
  ultimo_mensaje_en: timestamp('ultimo_mensaje_en', { withTimezone: true }),
  ultimo_mensaje_por: text('ultimo_mensaje_por'),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('canales_internos_empresa_idx').on(tabla.empresa_id),
])

// Miembros de canales internos
export const canal_interno_miembros = pgTable('canal_interno_miembros', {
  canal_id: uuid('canal_id').notNull().references(() => canales_internos.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  rol: text('rol').notNull().default('miembro'),
  silenciado: boolean('silenciado').notNull().default(false),
  ultimo_leido_en: timestamp('ultimo_leido_en', { withTimezone: true }),
  unido_en: timestamp('unido_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.canal_id, tabla.usuario_id] }),
])

// Agentes asignados a canales de inbox
export const canal_agentes = pgTable('canal_agentes', {
  canal_id: uuid('canal_id').notNull().references(() => canales_inbox.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  rol_canal: text('rol_canal').notNull().default('agente'),
  asignado_en: timestamp('asignado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.canal_id, tabla.usuario_id] }),
])

// Conversaciones — hilos de comunicación con contactos externos
export const conversaciones = pgTable('conversaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').references(() => canales_inbox.id), // nullable para canales internos
  tipo_canal: text('tipo_canal').notNull(), // 'correo', 'whatsapp', etc.
  identificador_externo: text('identificador_externo'), // email, teléfono WA
  hilo_externo_id: text('hilo_externo_id'), // thread ID externo
  contacto_id: uuid('contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  contacto_nombre: text('contacto_nombre'),
  estado: text('estado').notNull().default('abierta'), // 'abierta', 'cerrada', 'archivada'
  prioridad: text('prioridad').notNull().default('normal'),
  asignado_a: uuid('asignado_a'),
  asignado_a_nombre: text('asignado_a_nombre'),
  asunto: text('asunto'),
  canal_interno_id: uuid('canal_interno_id').references(() => canales_internos.id, { onDelete: 'set null' }),
  // Cache del último mensaje
  ultimo_mensaje_texto: text('ultimo_mensaje_texto'),
  ultimo_mensaje_en: timestamp('ultimo_mensaje_en', { withTimezone: true }),
  ultimo_mensaje_es_entrante: boolean('ultimo_mensaje_es_entrante').default(true),
  mensajes_sin_leer: integer('mensajes_sin_leer').notNull().default(0),
  // Métricas de respuesta
  primera_respuesta_en: timestamp('primera_respuesta_en', { withTimezone: true }),
  tiempo_sin_respuesta_desde: timestamp('tiempo_sin_respuesta_desde', { withTimezone: true }),
  // Etiquetas (array nativo)
  etiquetas: text('etiquetas').array().default(sql`'{}'`),
  // IA
  resumen_ia: text('resumen_ia'),
  sentimiento: text('sentimiento'),
  idioma_detectado: text('idioma_detectado'),
  chatbot_activo: boolean('chatbot_activo').notNull().default(true),
  agente_ia_activo: boolean('agente_ia_activo').default(true),
  clasificacion_ia: jsonb('clasificacion_ia'),
  metadata: jsonb('metadata').default(sql`'{}'`),
  // Timestamps
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
  cerrado_en: timestamp('cerrado_en', { withTimezone: true }),
  cerrado_por: uuid('cerrado_por'),
  // Etapa del pipeline
  etapa_id: uuid('etapa_id'),
  // Sector asignado (denormalizado)
  sector_id: uuid('sector_id'),
  sector_nombre: text('sector_nombre'),
  sector_color: text('sector_color'),
  // Bloqueo, pipeline, papelera
  bloqueada: boolean('bloqueada').notNull().default(false),
  en_pipeline: boolean('en_pipeline').notNull().default(true),
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
  // Bot / IA pause
  chatbot_pausado_hasta: timestamp('chatbot_pausado_hasta', { withTimezone: true }),
  ia_pausado_hasta: timestamp('ia_pausado_hasta', { withTimezone: true }),
  // Snooze / recordatorio
  snooze_hasta: timestamp('snooze_hasta', { withTimezone: true }),
  snooze_nota: text('snooze_nota'),
  snooze_por: uuid('snooze_por'),
}, (tabla) => [
  index('conversaciones_empresa_idx').on(tabla.empresa_id),
  index('conversaciones_canal_idx').on(tabla.canal_id),
  index('conversaciones_contacto_idx').on(tabla.contacto_id),
  index('conversaciones_estado_idx').on(tabla.empresa_id, tabla.estado),
  index('conversaciones_asignado_idx').on(tabla.empresa_id, tabla.asignado_a),
  index('conversaciones_ultimo_mensaje_idx').on(tabla.empresa_id, tabla.ultimo_mensaje_en),
  index('conversaciones_etapa_idx').on(tabla.empresa_id, tabla.etapa_id),
  index('conversaciones_snooze_idx').on(tabla.empresa_id, tabla.snooze_hasta),
  index('conversaciones_sector_idx').on(tabla.empresa_id, tabla.sector_id),
  index('conversaciones_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
])

// Mensajes — contenido de cada conversación
export const mensajes = pgTable('mensajes', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  es_entrante: boolean('es_entrante').notNull().default(true),
  remitente_tipo: text('remitente_tipo').notNull().default('contacto'), // 'contacto', 'agente', 'sistema', 'ia'
  remitente_id: uuid('remitente_id'),
  remitente_nombre: text('remitente_nombre'),
  tipo_contenido: text('tipo_contenido').notNull().default('texto'), // 'texto', 'imagen', 'audio', 'documento', 'video', 'sticker'
  texto: text('texto'),
  html: text('html'),
  // Campos específicos de correo
  correo_de: text('correo_de'),
  correo_para: text('correo_para').array(),
  correo_cc: text('correo_cc').array(),
  correo_cco: text('correo_cco').array(),
  correo_asunto: text('correo_asunto'),
  correo_message_id: text('correo_message_id'),
  correo_in_reply_to: text('correo_in_reply_to'),
  correo_references: text('correo_references').array(),
  // Campos específicos de WhatsApp
  wa_message_id: text('wa_message_id'),
  wa_status: text('wa_status'),
  wa_tipo_mensaje: text('wa_tipo_mensaje'),
  // Hilos y respuestas
  respuesta_a_id: uuid('respuesta_a_id'),
  hilo_raiz_id: uuid('hilo_raiz_id'),
  cantidad_respuestas: integer('cantidad_respuestas').notNull().default(0),
  reacciones: jsonb('reacciones').default(sql`'{}'`),
  metadata: jsonb('metadata').default(sql`'{}'`),
  // Estado
  estado: text('estado').notNull().default('enviado'),
  error_envio: text('error_envio'),
  es_nota_interna: boolean('es_nota_interna').notNull().default(false),
  plantilla_id: uuid('plantilla_id'),
  // Timestamps
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  editado_en: timestamp('editado_en', { withTimezone: true }),
  eliminado_en: timestamp('eliminado_en', { withTimezone: true }),
}, (tabla) => [
  index('mensajes_empresa_idx').on(tabla.empresa_id),
  index('mensajes_conversacion_idx').on(tabla.conversacion_id),
  index('mensajes_fecha_idx').on(tabla.conversacion_id, tabla.creado_en),
])

// Lecturas de mensajes (read receipts estilo WhatsApp)
export const mensaje_lecturas = pgTable('mensaje_lecturas', {
  mensaje_id: uuid('mensaje_id').notNull().references(() => mensajes.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  leido_en: timestamp('leido_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('mensaje_lecturas_mensaje_idx').on(tabla.mensaje_id),
  index('mensaje_lecturas_usuario_idx').on(tabla.usuario_id),
])

// Adjuntos de mensajes
export const mensaje_adjuntos = pgTable('mensaje_adjuntos', {
  id: uuid('id').primaryKey().defaultRandom(),
  mensaje_id: uuid('mensaje_id').references(() => mensajes.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre_archivo: text('nombre_archivo').notNull(),
  tipo_mime: text('tipo_mime').notNull(),
  tamano_bytes: bigint('tamano_bytes', { mode: 'number' }),
  url: text('url').notNull(),
  storage_path: text('storage_path').notNull(),
  miniatura_url: text('miniatura_url'),
  duracion_segundos: integer('duracion_segundos'),
  es_sticker: boolean('es_sticker').default(false),
  es_animado: boolean('es_animado').default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('mensaje_adjuntos_mensaje_idx').on(tabla.mensaje_id),
  index('mensaje_adjuntos_empresa_idx').on(tabla.empresa_id),
])

// Asignaciones de inbox — historial de asignación de conversaciones
export const asignaciones_inbox = pgTable('asignaciones_inbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  usuario_nombre: text('usuario_nombre'),
  tipo: text('tipo').notNull().default('manual'), // 'manual', 'automatica', 'round_robin'
  asignado_por: uuid('asignado_por'),
  asignado_por_nombre: text('asignado_por_nombre'),
  notas: text('notas'),
  asignado_en: timestamp('asignado_en', { withTimezone: true }).defaultNow().notNull(),
  desasignado_en: timestamp('desasignado_en', { withTimezone: true }),
}, (tabla) => [
  index('asignaciones_inbox_empresa_idx').on(tabla.empresa_id),
  index('asignaciones_inbox_conversacion_idx').on(tabla.conversacion_id),
])

// Etiquetas de inbox — etiquetas para clasificar conversaciones
export const etiquetas_inbox = pgTable('etiquetas_inbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icono: text('icono'),
  orden: integer('orden').default(0),
  es_default: boolean('es_default').notNull().default(false),
  clave_default: text('clave_default'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('etiquetas_inbox_empresa_idx').on(tabla.empresa_id),
])

// Relación conversación↔etiqueta
export const conversacion_etiquetas = pgTable('conversacion_etiquetas', {
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  etiqueta_id: uuid('etiqueta_id').notNull().references(() => etiquetas_inbox.id, { onDelete: 'cascade' }),
  asignado_en: timestamp('asignado_en', { withTimezone: true }).defaultNow().notNull(),
  asignado_por: uuid('asignado_por'),
}, (tabla) => [
  primaryKey({ columns: [tabla.conversacion_id, tabla.etiqueta_id] }),
])

// Configuración global de inbox por empresa
export const config_inbox = pgTable('config_inbox', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),
  // Asignación automática
  asignacion_automatica: boolean('asignacion_automatica').notNull().default(false),
  algoritmo_asignacion: text('algoritmo_asignacion').notNull().default('round_robin'),
  // SLA
  sla_primera_respuesta_minutos: integer('sla_primera_respuesta_minutos').default(60),
  sla_resolucion_horas: integer('sla_resolucion_horas').default(24),
  // Horario de atención
  horario_atencion: jsonb('horario_atencion'),
  zona_horaria: text('zona_horaria').default('America/Argentina/Buenos_Aires'),
  respuesta_fuera_horario: boolean('respuesta_fuera_horario').notNull().default(false),
  mensaje_fuera_horario: text('mensaje_fuera_horario'),
  // Notificaciones
  notificar_nuevo_mensaje: boolean('notificar_nuevo_mensaje').notNull().default(true),
  notificar_asignacion: boolean('notificar_asignacion').notNull().default(true),
  notificar_sla_vencido: boolean('notificar_sla_vencido').notNull().default(true),
  sonido_notificacion: boolean('sonido_notificacion').notNull().default(true),
  // Listas de correo
  correo_lista_permitidos: text('correo_lista_permitidos').array().default(sql`'{}'`),
  correo_lista_bloqueados: text('correo_lista_bloqueados').array().default(sql`'{}'`),
  // IA inline
  ia_proveedor: text('ia_proveedor').default('anthropic'),
  ia_api_key_cifrada: text('ia_api_key_cifrada'),
  ia_modelo: text('ia_modelo').default('claude-haiku-4-5-20251001'),
  ia_habilitada: boolean('ia_habilitada').notNull().default(false),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Etapas de conversación — pipeline configurable por empresa y tipo de canal
export const etapas_conversacion = pgTable('etapas_conversacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  tipo_canal: text('tipo_canal').notNull(), // 'whatsapp' | 'correo'
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icono: text('icono'),
  orden: integer('orden').notNull().default(0),
  es_predefinida: boolean('es_predefinida').notNull().default(false),
  activa: boolean('activa').notNull().default(true),
  // Validaciones del pipeline
  requisitos: jsonb('requisitos').notNull().default(sql`'[]'`), // [{campo, estricto}]
  sectores_permitidos: uuid('sectores_permitidos').array().notNull().default(sql`'{}'`),
  acciones_auto: jsonb('acciones_auto').notNull().default(sql`'[]'`), // [{tipo, config?}]
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('etapas_conversacion_empresa_canal_clave_idx').on(tabla.empresa_id, tabla.tipo_canal, tabla.clave),
  index('etapas_conversacion_empresa_idx').on(tabla.empresa_id, tabla.tipo_canal),
])

// Pins de conversación — fijar por usuario
export const conversacion_pins = pgTable('conversacion_pins', {
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  fijada_en: timestamp('fijada_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.conversacion_id, tabla.usuario_id] }),
  index('conversacion_pins_usuario_idx').on(tabla.usuario_id),
])

// Seguidores de conversación — reciben push notifications
export const conversacion_seguidores = pgTable('conversacion_seguidores', {
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  agregado_en: timestamp('agregado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.conversacion_id, tabla.usuario_id] }),
  index('conversacion_seguidores_usuario_idx').on(tabla.usuario_id),
])

// Silencios de conversación — mute por usuario
export const conversacion_silencios = pgTable('conversacion_silencios', {
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  silenciado_en: timestamp('silenciado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.conversacion_id, tabla.usuario_id] }),
])

// WhatsApp programados — envío diferido de mensajes WhatsApp
export const whatsapp_programados = pgTable('whatsapp_programados', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').notNull().references(() => canales_inbox.id),
  conversacion_id: uuid('conversacion_id').references(() => conversaciones.id, { onDelete: 'set null' }),
  creado_por: uuid('creado_por').notNull(),
  destinatario: text('destinatario').notNull(), // número de teléfono
  tipo_contenido: text('tipo_contenido').notNull().default('texto'), // 'texto' | 'imagen' | 'audio' | 'video' | 'documento' | 'plantilla'
  texto: text('texto'),
  media_url: text('media_url'),
  media_nombre: text('media_nombre'),
  plantilla_nombre: text('plantilla_nombre'),
  plantilla_idioma: text('plantilla_idioma'),
  plantilla_componentes: jsonb('plantilla_componentes'),
  enviar_en: timestamp('enviar_en', { withTimezone: true }).notNull(),
  estado: text('estado').notNull().default('pendiente'), // 'pendiente' | 'enviado' | 'cancelado' | 'error'
  enviado_en: timestamp('enviado_en', { withTimezone: true }),
  wa_message_id: text('wa_message_id'),
  error: text('error'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('whatsapp_programados_empresa_idx').on(tabla.empresa_id),
  index('whatsapp_programados_estado_idx').on(tabla.estado, tabla.enviar_en),
])

// Correos programados — envío diferido
export const correos_programados = pgTable('correos_programados', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').notNull().references(() => canales_inbox.id),
  conversacion_id: uuid('conversacion_id').references(() => conversaciones.id, { onDelete: 'set null' }),
  creado_por: uuid('creado_por').notNull(),
  correo_para: text('correo_para').array().notNull(),
  correo_cc: text('correo_cc').array(),
  correo_cco: text('correo_cco').array(),
  correo_asunto: text('correo_asunto').notNull(),
  texto: text('texto'),
  html: text('html'),
  correo_in_reply_to: text('correo_in_reply_to'),
  correo_references: text('correo_references').array(),
  adjuntos_ids: uuid('adjuntos_ids').array(),
  enviar_en: timestamp('enviar_en', { withTimezone: true }).notNull(),
  estado: text('estado').notNull().default('pendiente'), // 'pendiente', 'enviado', 'error', 'cancelado'
  enviado_en: timestamp('enviado_en', { withTimezone: true }),
  error: text('error'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('correos_programados_empresa_idx').on(tabla.empresa_id),
  index('correos_programados_estado_idx').on(tabla.estado, tabla.enviar_en),
])

// Plantillas de respuesta rápida
export const plantillas_respuesta = pgTable('plantillas_respuesta', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  categoria: text('categoria'),
  canal: text('canal').notNull(), // 'correo', 'whatsapp', 'todos'
  asunto: text('asunto'),
  contenido: text('contenido').notNull(),
  contenido_html: text('contenido_html'),
  variables: jsonb('variables').default(sql`'[]'`),
  modulos: text('modulos').array().default(sql`'{}'`),
  // Permisos de acceso
  disponible_para: text('disponible_para').notNull().default('todos'), // 'todos', 'roles', 'usuarios'
  roles_permitidos: text('roles_permitidos').array().default(sql`'{}'`),
  usuarios_permitidos: uuid('usuarios_permitidos').array().default(sql`'{}'`),
  activo: boolean('activo').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('plantillas_respuesta_empresa_idx').on(tabla.empresa_id),
])

// Reglas de correo — automatización de inbox
export const reglas_correo = pgTable('reglas_correo', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  activa: boolean('activa').default(true),
  orden: integer('orden').default(0),
  condiciones: jsonb('condiciones').notNull().default(sql`'[]'`),
  acciones: jsonb('acciones').notNull().default(sql`'[]'`),
  creado_por: uuid('creado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('reglas_correo_empresa_idx').on(tabla.empresa_id),
])

// Métricas de correo — estadísticas diarias por canal
export const metricas_correo = pgTable('metricas_correo', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').references(() => canales_inbox.id, { onDelete: 'set null' }),
  fecha: date('fecha').notNull(),
  correos_recibidos: integer('correos_recibidos').default(0),
  correos_enviados: integer('correos_enviados').default(0),
  conversaciones_nuevas: integer('conversaciones_nuevas').default(0),
  conversaciones_resueltas: integer('conversaciones_resueltas').default(0),
  correos_spam: integer('correos_spam').default(0),
  tiempo_primera_respuesta_promedio: numeric('tiempo_primera_respuesta_promedio'),
  tiempo_resolucion_promedio: numeric('tiempo_resolucion_promedio'),
}, (tabla) => [
  index('metricas_correo_empresa_idx').on(tabla.empresa_id),
  index('metricas_correo_fecha_idx').on(tabla.empresa_id, tabla.fecha),
])

// Plantillas de WhatsApp (Meta Business Templates)
export const plantillas_whatsapp = pgTable('plantillas_whatsapp', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  canal_id: uuid('canal_id').references(() => canales_inbox.id, { onDelete: 'set null' }),
  // Identidad Meta
  nombre: text('nombre').notNull(),
  nombre_api: text('nombre_api').notNull(), // lowercase_underscore, max 512
  categoria: text('categoria').notNull().default('UTILITY'), // MARKETING | UTILITY | AUTHENTICATION
  idioma: text('idioma').notNull().default('es'),
  // Componentes (estructura Meta)
  componentes: jsonb('componentes').notNull().default(sql`'{}'`),
  // Estado Meta
  estado_meta: text('estado_meta').notNull().default('BORRADOR'), // BORRADOR | PENDING | APPROVED | REJECTED | DISABLED | PAUSED | ERROR
  id_template_meta: text('id_template_meta'),
  error_meta: text('error_meta'),
  ultima_sincronizacion: timestamp('ultima_sincronizacion', { withTimezone: true }),
  // Disponibilidad
  modulos: text('modulos').array().default(sql`'{}'`),
  es_por_defecto: boolean('es_por_defecto').default(false),
  disponible_para: text('disponible_para').default('todos'),
  roles_permitidos: text('roles_permitidos').array().default(sql`'{}'`),
  usuarios_permitidos: uuid('usuarios_permitidos').array().default(sql`'{}'`),
  // Auditoría
  activo: boolean('activo').notNull().default(true),
  creado_por: uuid('creado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('plantillas_wa_empresa_idx').on(tabla.empresa_id),
  index('plantillas_wa_estado_idx').on(tabla.empresa_id, tabla.estado_meta),
  uniqueIndex('plantillas_wa_nombre_api_idx').on(tabla.empresa_id, tabla.canal_id, tabla.nombre_api),
])

// ═══════════════════════════════════════════════════════════════
// INTELIGENCIA ARTIFICIAL
// ═══════════════════════════════════════════════════════════════

// Configuración global de IA por empresa
export const config_ia = pgTable('config_ia', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  habilitado: boolean('habilitado').notNull().default(false),
  proveedor_defecto: text('proveedor_defecto').notNull().default('anthropic'),
  // API keys por proveedor
  api_key_anthropic: text('api_key_anthropic'),
  api_key_openai: text('api_key_openai'),
  api_key_google: text('api_key_google'),
  api_key_xai: text('api_key_xai'),
  // Modelos por proveedor
  modelo_anthropic: text('modelo_anthropic').notNull().default('claude-sonnet-4-20250514'),
  modelo_openai: text('modelo_openai').notNull().default('gpt-4o'),
  modelo_google: text('modelo_google').notNull().default('gemini-2.0-flash'),
  modelo_xai: text('modelo_xai').notNull().default('grok-3'),
  // Parámetros
  temperatura: numeric('temperatura').notNull().default('0.7'),
  max_tokens: integer('max_tokens').notNull().default(4096),
  modulos_accesibles: text('modulos_accesibles').array().notNull().default(sql`ARRAY['contactos','actividades','visitas','productos','presupuestos','facturas','ordenes_trabajo']`),
  // Prompts custom
  prompt_asistente: text('prompt_asistente'),
  prompt_asistente_presupuestos: text('prompt_asistente_presupuestos'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('config_ia_empresa_idx').on(tabla.empresa_id),
])

// Configuración del agente IA conversacional por empresa
export const config_agente_ia = pgTable('config_agente_ia', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  activo: boolean('activo').default(false),
  nombre: text('nombre').default('Asistente Flux'),
  apodo: text('apodo').default(''),
  personalidad: text('personalidad').default(''),
  instrucciones: text('instrucciones').default(''),
  idioma: text('idioma').default('es'),
  // Canales y activación
  canales_activos: text('canales_activos').array().default(sql`'{}'`),
  modo_activacion: text('modo_activacion').default('despues_chatbot'),
  delay_segundos: integer('delay_segundos').default(0),
  max_mensajes_auto: integer('max_mensajes_auto').default(5),
  // Capacidades
  puede_responder: boolean('puede_responder').default(true),
  puede_clasificar: boolean('puede_clasificar').default(true),
  puede_enrutar: boolean('puede_enrutar').default(false),
  puede_resumir: boolean('puede_resumir').default(true),
  puede_sentimiento: boolean('puede_sentimiento').default(true),
  puede_crear_actividad: boolean('puede_crear_actividad').default(false),
  puede_actualizar_contacto: boolean('puede_actualizar_contacto').default(false),
  puede_etiquetar: boolean('puede_etiquetar').default(true),
  // Estilo de respuesta
  modo_respuesta: text('modo_respuesta').default('sugerir'), // 'sugerir', 'auto'
  tono: text('tono').default('profesional'),
  largo_respuesta: text('largo_respuesta').default('medio'),
  firmar_como: text('firmar_como').default(''),
  // Base de conocimiento
  usar_base_conocimiento: boolean('usar_base_conocimiento').default(false),
  // Escalamiento
  escalar_si_negativo: boolean('escalar_si_negativo').default(true),
  escalar_si_no_sabe: boolean('escalar_si_no_sabe').default(true),
  escalar_palabras: text('escalar_palabras').array().default(sql`ARRAY['hablar con persona','agente','humano','gerente']`),
  mensaje_escalamiento: text('mensaje_escalamiento').default('Te voy a comunicar con un agente. Un momento por favor.'),
  // Acciones y métricas
  acciones_habilitadas: jsonb('acciones_habilitadas').default(sql`'[]'`),
  total_mensajes_enviados: integer('total_mensajes_enviados').default(0),
  total_escalamientos: integer('total_escalamientos').default(0),
  // Contexto de negocio
  zona_cobertura: text('zona_cobertura').default(''),
  sitio_web: text('sitio_web').default(''),
  horario_atencion: text('horario_atencion').default(''),
  correo_empresa: text('correo_empresa').default(''),
  servicios_si: text('servicios_si').default(''),
  servicios_no: text('servicios_no').default(''),
  tipos_contacto: jsonb('tipos_contacto').default(sql`'[]'`),
  flujo_conversacion: jsonb('flujo_conversacion').default(sql`'[]'`),
  reglas_agenda: text('reglas_agenda').default(''),
  info_precios: text('info_precios').default(''),
  situaciones_especiales: text('situaciones_especiales').default(''),
  ejemplos_conversacion: jsonb('ejemplos_conversacion').default(sql`'[]'`),
  respuesta_si_bot: text('respuesta_si_bot').default(''),
  vocabulario_natural: text('vocabulario_natural').default(''),
  // Análisis
  ultimo_analisis_conversaciones: timestamp('ultimo_analisis_conversaciones', { withTimezone: true }),
  total_conversaciones_analizadas: integer('total_conversaciones_analizadas').default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow(),
}, (tabla) => [
  index('config_agente_ia_empresa_idx').on(tabla.empresa_id),
])

// Configuración del chatbot (respuestas automáticas simples) por empresa
export const config_chatbot = pgTable('config_chatbot', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),
  activo: boolean('activo').notNull().default(false),
  // Bienvenida
  bienvenida_activa: boolean('bienvenida_activa').notNull().default(true),
  mensaje_bienvenida: text('mensaje_bienvenida').notNull().default('¡Hola! 👋 Gracias por comunicarte con nosotros.'),
  bienvenida_frecuencia: text('bienvenida_frecuencia').notNull().default('dias_sin_contacto'),
  bienvenida_dias_sin_contacto: integer('bienvenida_dias_sin_contacto').notNull().default(30),
  // Menú interactivo
  menu_activo: boolean('menu_activo').notNull().default(false),
  mensaje_menu: text('mensaje_menu'),
  opciones_menu: jsonb('opciones_menu').notNull().default(sql`'[]'`),
  menu_tipo: text('menu_tipo').notNull().default('botones'), // 'botones', 'lista'
  menu_titulo_lista: text('menu_titulo_lista').default('Elegí una opción'),
  // Palabras clave y respuestas
  palabras_clave: jsonb('palabras_clave').notNull().default(sql`'[]'`),
  mensaje_defecto: text('mensaje_defecto'),
  // Transferencia a agente
  palabra_transferir: text('palabra_transferir').default('asesor'),
  mensaje_transferencia: text('mensaje_transferencia'),
  // Modo de activación
  modo: text('modo').notNull().default('siempre'), // 'siempre', 'fuera_horario', 'manual'
  // Variables disponibles para plantillas
  variables_disponibles: jsonb('variables_disponibles').notNull().default(sql`'[{"clave":"nombre","etiqueta":"Nombre del contacto"},{"clave":"empresa","etiqueta":"Nombre de tu empresa"}]'`),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Base de conocimiento para IA — artículos y FAQ
export const base_conocimiento_ia = pgTable('base_conocimiento_ia', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  contenido: text('contenido').notNull(),
  categoria: text('categoria').default('general'),
  etiquetas: text('etiquetas').array().default(sql`'{}'`),
  activo: boolean('activo').default(true),
  // Nota: columna 'embedding' es tipo vector, se omite en Drizzle (gestionada por pgvector directamente)
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow(),
}, (tabla) => [
  index('base_conocimiento_ia_empresa_idx').on(tabla.empresa_id),
])

// Log del agente IA — registro de acciones y uso de tokens
export const log_agente_ia = pgTable('log_agente_ia', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  conversacion_id: uuid('conversacion_id').notNull().references(() => conversaciones.id, { onDelete: 'cascade' }),
  mensaje_id: uuid('mensaje_id'),
  accion: text('accion').notNull(),
  entrada: jsonb('entrada'),
  salida: jsonb('salida'),
  exito: boolean('exito').default(true),
  error: text('error'),
  proveedor: text('proveedor'),
  modelo: text('modelo'),
  tokens_entrada: integer('tokens_entrada').default(0),
  tokens_salida: integer('tokens_salida').default(0),
  latencia_ms: integer('latencia_ms').default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow(),
}, (tabla) => [
  index('log_agente_ia_empresa_idx').on(tabla.empresa_id),
  index('log_agente_ia_conversacion_idx').on(tabla.conversacion_id),
])

// ═══════════════════════════════════════════════════════════════
// RRHH / ESTRUCTURA ORGANIZACIONAL
// ═══════════════════════════════════════════════════════════════

// Turnos laborales — horarios configurables por empresa, asignables a sectores o miembros
export const turnos_laborales = pgTable('turnos_laborales', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(), // "Horario general", "Turno fábrica"
  es_default: boolean('es_default').notNull().default(false), // uno solo por empresa
  flexible: boolean('flexible').notNull().default(false), // sin control de puntualidad ni ausencia
  tolerancia_min: integer('tolerancia_min').notNull().default(10), // minutos de gracia para tardanza
  dias: jsonb('dias').notNull().default(sql`'{"lunes":{"activo":true,"desde":"09:00","hasta":"18:00"},"martes":{"activo":true,"desde":"09:00","hasta":"18:00"},"miercoles":{"activo":true,"desde":"09:00","hasta":"18:00"},"jueves":{"activo":true,"desde":"09:00","hasta":"18:00"},"viernes":{"activo":true,"desde":"09:00","hasta":"18:00"},"sabado":{"activo":false,"desde":"09:00","hasta":"13:00"},"domingo":{"activo":false,"desde":"09:00","hasta":"13:00"}}'`),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('turnos_laborales_empresa_idx').on(tabla.empresa_id),
  index('turnos_laborales_default_idx').on(tabla.empresa_id, tabla.es_default),
])

// Asistencias — registro diario de fichaje por miembro (un registro por persona por día)
export const asistencias = pgTable('asistencias', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  // Timestamps de jornada
  hora_entrada: timestamp('hora_entrada', { withTimezone: true }),
  hora_salida: timestamp('hora_salida', { withTimezone: true }),
  inicio_almuerzo: timestamp('inicio_almuerzo', { withTimezone: true }),
  fin_almuerzo: timestamp('fin_almuerzo', { withTimezone: true }),
  salida_particular: timestamp('salida_particular', { withTimezone: true }), // salida breve (trámite)
  vuelta_particular: timestamp('vuelta_particular', { withTimezone: true }),
  // Estado de la jornada (máquina de estados)
  estado: text('estado').notNull().default('activo'), // 'activo' | 'almuerzo' | 'particular' | 'cerrado' | 'auto_cerrado' | 'ausente'
  // Clasificación
  tipo: text('tipo').notNull().default('normal'), // 'normal' | 'tardanza' | 'ausencia' | 'flexible'
  puntualidad_min: integer('puntualidad_min'), // minutos de desvío vs horario esperado
  // Método de registro
  metodo_registro: text('metodo_registro').notNull().default('manual'), // 'manual' | 'rfid' | 'nfc' | 'pin' | 'automatico' | 'solicitud' | 'sistema'
  metodo_salida: text('metodo_salida'), // 'manual' | 'rfid' | 'nfc' | 'pin' | 'automatico' | 'sistema' — null si no fichó salida
  terminal_id: uuid('terminal_id'),
  terminal_nombre: text('terminal_nombre'),
  // Ubicación (geocoding inverso: "Av. Directorio 800, Parque Patricios, CABA")
  ubicacion_entrada: jsonb('ubicacion_entrada'), // { lat, lng, direccion, barrio, ciudad }
  ubicacion_salida: jsonb('ubicacion_salida'),
  // Fotos silenciosas
  foto_entrada: text('foto_entrada'), // URL Supabase Storage
  foto_salida: text('foto_salida'),
  // Turno laboral aplicado
  turno_id: uuid('turno_id'),
  // Auditoría
  cierre_automatico: boolean('cierre_automatico').notNull().default(false),
  creado_por: uuid('creado_por'),
  editado_por: uuid('editado_por'),
  solicitud_id: uuid('solicitud_id'),
  notas: text('notas'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('asistencias_empresa_idx').on(tabla.empresa_id),
  index('asistencias_miembro_idx').on(tabla.miembro_id),
  uniqueIndex('asistencias_miembro_fecha_idx').on(tabla.empresa_id, tabla.miembro_id, tabla.fecha),
  index('asistencias_estado_entrada_idx').on(tabla.empresa_id, tabla.estado, tabla.hora_entrada),
  index('asistencias_fecha_empresa_idx').on(tabla.empresa_id, tabla.fecha),
])

// Fichajes de actividad — heartbeats para fichaje automático y tracking de uso real
export const fichajes_actividad = pgTable('fichajes_actividad', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  tipo: text('tipo').notNull(), // 'login' | 'heartbeat' | 'beforeunload' | 'visibility'
  metadata: jsonb('metadata'), // { navegador, so, dispositivo, pestana_visible }
}, (tabla) => [
  index('fichajes_actividad_miembro_fecha_idx').on(tabla.empresa_id, tabla.miembro_id, tabla.fecha),
  index('fichajes_actividad_timestamp_idx').on(tabla.empresa_id, tabla.miembro_id, tabla.timestamp),
])

// Solicitudes de fichaje — reclamos de corrección de asistencia desde el kiosco
export const solicitudes_fichaje = pgTable('solicitudes_fichaje', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  solicitante_id: uuid('solicitante_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(), // día de la asistencia reclamada
  hora_entrada: text('hora_entrada'), // "09:15" (formato HH:mm)
  hora_salida: text('hora_salida'), // "18:30"
  motivo: text('motivo').notNull(), // descripción libre
  terminal_nombre: text('terminal_nombre'), // desde qué terminal se envió
  // Resolución
  estado: text('estado').notNull().default('pendiente'), // 'pendiente' | 'aprobada' | 'rechazada'
  resuelto_por: uuid('resuelto_por'),
  resuelto_en: timestamp('resuelto_en', { withTimezone: true }),
  notas_resolucion: text('notas_resolucion'), // feedback del admin
  // Apelación (máximo 1)
  solicitud_original_id: uuid('solicitud_original_id'), // FK a solicitudes_fichaje si es apelación
  es_apelacion: boolean('es_apelacion').notNull().default(false),
  motivo_apelacion: text('motivo_apelacion'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('solicitudes_fichaje_solicitante_idx').on(tabla.empresa_id, tabla.solicitante_id, tabla.fecha),
  index('solicitudes_fichaje_estado_idx').on(tabla.empresa_id, tabla.estado),
])

// Terminales de kiosco — dispositivos registrados por empresa
export const terminales_kiosco = pgTable('terminales_kiosco', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(), // "Entrada Principal", "Planta 2"
  zona_horaria: text('zona_horaria'), // null = usa la de la empresa. Ej: 'America/Argentina/Buenos_Aires'
  activo: boolean('activo').notNull().default(true),
  ultimo_ping: timestamp('ultimo_ping', { withTimezone: true }),
  token_hash: text('token_hash'), // hash del token de setup
  creado_por: uuid('creado_por'),
  revocado_por: uuid('revocado_por'),
  revocado_en: timestamp('revocado_en', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('terminales_kiosco_empresa_idx').on(tabla.empresa_id),
  index('terminales_kiosco_activo_idx').on(tabla.empresa_id, tabla.activo),
])

// Configuración de asistencias — una por empresa
export const config_asistencias = pgTable('config_asistencias', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }).unique(),
  // Kiosco
  kiosco_habilitado: boolean('kiosco_habilitado').notNull().default(false),
  kiosco_metodo_lectura: text('kiosco_metodo_lectura').notNull().default('rfid_hid'), // 'rfid_hid' | 'nfc'
  kiosco_pin_admin: text('kiosco_pin_admin'), // PIN 4 dígitos para salir del kiosco
  kiosco_capturar_foto: boolean('kiosco_capturar_foto').notNull().default(false),
  kiosco_modo_empresa: text('kiosco_modo_empresa').notNull().default('logo_y_nombre'), // 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  // Auto-checkout
  auto_checkout_habilitado: boolean('auto_checkout_habilitado').notNull().default(true),
  auto_checkout_max_horas: integer('auto_checkout_max_horas').notNull().default(12),
  // Cálculo de horas
  descontar_almuerzo: boolean('descontar_almuerzo').notNull().default(true),
  duracion_almuerzo_min: integer('duracion_almuerzo_min').notNull().default(60),
  horas_minimas_diarias: numeric('horas_minimas_diarias', { precision: 4, scale: 2 }).notNull().default('0'),
  horas_maximas_diarias: numeric('horas_maximas_diarias', { precision: 4, scale: 2 }).notNull().default('0'),
  // Fichaje automático
  fichaje_auto_habilitado: boolean('fichaje_auto_habilitado').notNull().default(false),
  fichaje_auto_notif_min: integer('fichaje_auto_notif_min').notNull().default(10),
  fichaje_auto_umbral_salida: integer('fichaje_auto_umbral_salida').notNull().default(30),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('config_asistencias_empresa_idx').on(tabla.empresa_id),
])

// Auditoría de asistencias — registro de ediciones manuales
export const auditoria_asistencias = pgTable('auditoria_asistencias', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  asistencia_id: uuid('asistencia_id').notNull(),
  editado_por: uuid('editado_por').notNull(), // miembro_id del admin
  campo_modificado: text('campo_modificado').notNull(),
  valor_anterior: text('valor_anterior'),
  valor_nuevo: text('valor_nuevo'),
  motivo: text('motivo'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('auditoria_asistencias_asistencia_idx').on(tabla.asistencia_id),
  index('auditoria_asistencias_empresa_idx').on(tabla.empresa_id),
])

// Sectores — departamentos / áreas de la empresa
export const sectores = pgTable('sectores', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  color: text('color').notNull().default('#6366f1'),
  icono: text('icono').notNull().default('Building'),
  activo: boolean('activo').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  padre_id: uuid('padre_id'), // auto-referencia para sub-sectores
  jefe_id: uuid('jefe_id'), // miembro_id del jefe del sector
  turno_id: uuid('turno_id'), // FK a turnos_laborales (nullable, si null hereda default empresa)
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('sectores_empresa_idx').on(tabla.empresa_id),
])

// Relación miembro↔sector (un miembro puede pertenecer a varios sectores)
export const miembros_sectores = pgTable('miembros_sectores', {
  id: uuid('id').primaryKey().defaultRandom(),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  sector_id: uuid('sector_id').notNull().references(() => sectores.id, { onDelete: 'cascade' }),
  es_primario: boolean('es_primario').notNull().default(false),
}, (tabla) => [
  index('miembros_sectores_miembro_idx').on(tabla.miembro_id),
  index('miembros_sectores_sector_idx').on(tabla.sector_id),
])

// Horarios — franjas horarias por sector y día de semana
export const horarios = pgTable('horarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  sector_id: uuid('sector_id').references(() => sectores.id, { onDelete: 'cascade' }),
  dia_semana: integer('dia_semana').notNull(), // 0=domingo, 1=lunes, ..., 6=sábado
  hora_inicio: time('hora_inicio').notNull().default('09:00:00'),
  hora_fin: time('hora_fin').notNull().default('18:00:00'),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('horarios_empresa_idx').on(tabla.empresa_id),
  index('horarios_sector_idx').on(tabla.sector_id),
])

// Puestos — cargos / roles de trabajo por empresa
export const puestos = pgTable('puestos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  color: text('color').notNull().default('#6366f1'),
  icono: text('icono').notNull().default('Briefcase'),
  activo: boolean('activo').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  sector_ids: uuid('sector_ids').array().default(sql`'{}'`),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('puestos_empresa_idx').on(tabla.empresa_id),
])

// Puestos de contacto — cargos posibles para contactos (diferente a puestos de equipo)
export const puestos_contacto = pgTable('puestos_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  activo: boolean('activo').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('puestos_contacto_empresa_idx').on(tabla.empresa_id),
])

// Contactos de emergencia de miembros
export const contactos_emergencia = pgTable('contactos_emergencia', {
  id: uuid('id').primaryKey().defaultRandom(),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  relacion: text('relacion'),
  telefono: text('telefono'),
  direccion: text('direccion'),
}, (tabla) => [
  index('contactos_emergencia_miembro_idx').on(tabla.miembro_id),
])

// Documentos de usuario — archivos vinculados a un miembro (DNI, contrato, etc.)
export const documentos_usuario = pgTable('documentos_usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(), // 'dni', 'contrato', 'titulo', etc.
  nombre_archivo: text('nombre_archivo').notNull().default(''),
  url: text('url').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('documentos_usuario_miembro_idx').on(tabla.miembro_id),
])

// Educación de usuario — formación académica
export const educacion_usuario = pgTable('educacion_usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(), // 'universitario', 'terciario', 'curso', etc.
  institucion: text('institucion').notNull(),
  titulo: text('titulo'),
  desde: date('desde'),
  hasta: date('hasta'),
  en_curso: boolean('en_curso').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('educacion_usuario_miembro_idx').on(tabla.miembro_id),
])

// Catálogo de bancos por empresa — se crean al usarlos y se reutilizan entre miembros
export const bancos = pgTable('bancos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('bancos_empresa_idx').on(tabla.empresa_id),
])

// Información bancaria de miembros
export const info_bancaria = pgTable('info_bancaria', {
  id: uuid('id').primaryKey().defaultRandom(),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  tipo_cuenta: text('tipo_cuenta'),
  banco: text('banco'),
  numero_cuenta: text('numero_cuenta'),
  alias: text('alias'),
}, (tabla) => [
  index('info_bancaria_miembro_idx').on(tabla.miembro_id),
])

// Preferencias de usuario — tema, sidebar, etc. por dispositivo
export const preferencias_usuario = pgTable('preferencias_usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  dispositivo_id: text('dispositivo_id').notNull(),
  // Apariencia
  tema: text('tema').notNull().default('sistema'), // 'claro', 'oscuro', 'sistema'
  efecto: text('efecto').notNull().default('solido'),
  fondo_cristal: text('fondo_cristal').notNull().default('aurora'),
  escala: text('escala').notNull().default('normal'),
  // Sidebar
  sidebar_orden: jsonb('sidebar_orden'),
  sidebar_ocultos: jsonb('sidebar_ocultos'),
  sidebar_deshabilitados: jsonb('sidebar_deshabilitados'),
  sidebar_colapsado: boolean('sidebar_colapsado').notNull().default(false),
  sidebar_auto_ocultar: boolean('sidebar_auto_ocultar').notNull().default(false),
  sidebar_auto_colapsar_config: boolean('sidebar_auto_colapsar_config').notNull().default(true),
  sidebar_secciones: jsonb('sidebar_secciones').default(sql`'{}'`),
  // Tablas
  config_tablas: jsonb('config_tablas').default(sql`'{}'`),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('preferencias_usuario_dispositivo_idx').on(tabla.usuario_id, tabla.dispositivo_id),
])

// Rubros de contacto — clasificación de industria/rubro configurable por empresa
export const rubros_contacto = pgTable('rubros_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  activo: boolean('activo').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('rubros_contacto_empresa_idx').on(tabla.empresa_id),
])

// Etiquetas de contacto — tags configurables por empresa
export const etiquetas_contacto = pgTable('etiquetas_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  color: text('color').notNull().default('neutro'),
  activa: boolean('activa').notNull().default(true),
  orden: integer('orden').notNull().default(0),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('etiquetas_contacto_empresa_idx').on(tabla.empresa_id),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE VISITAS
// ═══════════════════════════════════════════════════════════════

// Visitas — registro de visita a un contacto en una dirección
export const visitas = pgTable('visitas', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Relaciones
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  contacto_nombre: text('contacto_nombre').notNull(), // snapshot para listados rápidos
  direccion_id: uuid('direccion_id').references(() => contacto_direcciones.id, { onDelete: 'set null' }),
  direccion_texto: text('direccion_texto'), // snapshot de la dirección al momento de crear
  direccion_lat: doublePrecision('direccion_lat'),
  direccion_lng: doublePrecision('direccion_lng'),

  // Asignación
  asignado_a: uuid('asignado_a'), // miembro que debe realizar la visita
  asignado_nombre: text('asignado_nombre'),

  // Programación
  fecha_programada: timestamp('fecha_programada', { withTimezone: true }).notNull(),
  fecha_inicio: timestamp('fecha_inicio', { withTimezone: true }), // cuando arrancó (en_camino)
  fecha_llegada: timestamp('fecha_llegada', { withTimezone: true }), // cuando llegó (en_sitio)
  fecha_completada: timestamp('fecha_completada', { withTimezone: true }),
  duracion_estimada_min: integer('duracion_estimada_min').default(30),
  duracion_real_min: integer('duracion_real_min'),

  // Estado
  estado: text('estado').notNull().default('programada'), // programada, en_camino, en_sitio, completada, cancelada, reprogramada

  // Contenido
  motivo: text('motivo'), // por qué se hace la visita
  resultado: text('resultado'), // qué pasó al completarla
  notas: text('notas'),
  temperatura: text('temperatura'), // factibilidad: frio, tibio, caliente

  // Contacto de recepción (quien recibe al visitador, puede ser diferente al principal)
  recibe_contacto_id: uuid('recibe_contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  recibe_nombre: text('recibe_nombre'),
  recibe_telefono: text('recibe_telefono'),
  prioridad: text('prioridad').notNull().default('normal'), // baja, normal, alta, urgente

  // Checklist configurable (items a verificar durante la visita)
  checklist: jsonb('checklist').notNull().default(sql`'[]'`), // [{id, texto, completado}]

  // Geolocalización de registro (donde realmente estaba el visitador)
  registro_lat: doublePrecision('registro_lat'),
  registro_lng: doublePrecision('registro_lng'),
  registro_precision_m: integer('registro_precision_m'), // precisión GPS en metros

  // Vinculación con actividades
  actividad_id: uuid('actividad_id'), // actividad asociada si se creó desde una
  vinculos: jsonb('vinculos').notNull().default(sql`'[]'`), // [{tipo, id, nombre}]

  // Archivo automático (visitas completadas > 30 días)
  archivada: boolean('archivada').notNull().default(false),
  archivada_en: timestamp('archivada_en', { withTimezone: true }),

  // Soft delete
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('visitas_empresa_idx').on(tabla.empresa_id),
  index('visitas_contacto_idx').on(tabla.empresa_id, tabla.contacto_id),
  index('visitas_asignado_idx').on(tabla.empresa_id, tabla.asignado_a),
  index('visitas_estado_idx').on(tabla.empresa_id, tabla.estado),
  index('visitas_fecha_idx').on(tabla.empresa_id, tabla.fecha_programada),
  index('visitas_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
  index('visitas_archivada_idx').on(tabla.empresa_id, tabla.archivada),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE RECORRIDOS
// ═══════════════════════════════════════════════════════════════

// Recorridos — agrupación ordenada de visitas para un día
export const recorridos = pgTable('recorridos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Asignación
  asignado_a: uuid('asignado_a').notNull(), // miembro que recorre
  asignado_nombre: text('asignado_nombre').notNull(),

  // Fecha
  fecha: date('fecha').notNull(), // día del recorrido

  // Estado del recorrido
  estado: text('estado').notNull().default('pendiente'), // pendiente, en_curso, completado

  // Punto de partida (ubicación del visitador)
  origen_lat: doublePrecision('origen_lat'),
  origen_lng: doublePrecision('origen_lng'),
  origen_texto: text('origen_texto'), // "Mi ubicación" o dirección escrita

  // Resumen (se actualiza al completar)
  total_visitas: integer('total_visitas').notNull().default(0),
  visitas_completadas: integer('visitas_completadas').notNull().default(0),
  distancia_total_km: numeric('distancia_total_km'),
  duracion_total_min: integer('duracion_total_min'),

  // Notas del día
  notas: text('notas'),

  // Config de permisos del visitador (qué puede hacer en este recorrido)
  config: jsonb('config').notNull().default(sql`'{}'`),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('recorridos_empresa_idx').on(tabla.empresa_id),
  index('recorridos_asignado_fecha_idx').on(tabla.empresa_id, tabla.asignado_a, tabla.fecha),
  uniqueIndex('recorridos_unico_idx').on(tabla.empresa_id, tabla.asignado_a, tabla.fecha),
])

// Paradas del recorrido — cada visita como parada ordenada
export const recorrido_paradas = pgTable('recorrido_paradas', {
  id: uuid('id').primaryKey().defaultRandom(),
  recorrido_id: uuid('recorrido_id').notNull().references(() => recorridos.id, { onDelete: 'cascade' }),
  visita_id: uuid('visita_id').notNull().references(() => visitas.id, { onDelete: 'cascade' }),

  // Orden de la parada en el recorrido
  orden: integer('orden').notNull().default(0),

  // Estimaciones de ruta (desde la parada anterior)
  distancia_km: numeric('distancia_km'),
  duracion_viaje_min: integer('duracion_viaje_min'),
  hora_estimada_llegada: timestamp('hora_estimada_llegada', { withTimezone: true }),

  // Notas específicas de esta parada
  notas: text('notas'),

  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('recorrido_paradas_recorrido_idx').on(tabla.recorrido_id),
  uniqueIndex('recorrido_paradas_unico_idx').on(tabla.recorrido_id, tabla.visita_id),
])

// Plantillas de recorrido — recorridos guardados para reutilizar
export const plantillas_recorrido = pgTable('plantillas_recorrido', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  // Paradas predefinidas: [{contacto_id, contacto_nombre, direccion_id, direccion_texto, lat, lng, orden}]
  paradas: jsonb('paradas').notNull().default(sql`'[]'`),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('plantillas_recorrido_empresa_idx').on(tabla.empresa_id),
])

// Configuración del módulo visitas por empresa
export const config_visitas = pgTable('config_visitas', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  // Checklist por defecto para nuevas visitas
  checklist_predeterminado: jsonb('checklist_predeterminado').notNull().default(sql`'[]'`),
  // Requiere geolocalización al registrar llegada
  requiere_geolocalizacion: boolean('requiere_geolocalizacion').notNull().default(false),
  // Distancia máxima en metros para validar geolocalización
  distancia_maxima_m: integer('distancia_maxima_m').notNull().default(500),
  // Duración estimada por defecto en minutos
  duracion_estimada_default: integer('duracion_estimada_default').notNull().default(30),
  // Motivos predefinidos
  motivos_predefinidos: jsonb('motivos_predefinidos').notNull().default(sql`'[]'`),
  // Resultados predefinidos
  resultados_predefinidos: jsonb('resultados_predefinidos').notNull().default(sql`'[]'`),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('config_visitas_empresa_idx').on(tabla.empresa_id),
])

// Configuración de Google Drive — sincronización de datos con Sheets
export const configuracion_google_drive = pgTable('configuracion_google_drive', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  conectado: boolean('conectado').notNull().default(false),
  email: text('email'),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  token_expira_en: timestamp('token_expira_en', { withTimezone: true }),
  frecuencia_horas: integer('frecuencia_horas').notNull().default(24),
  modulos_activos: text('modulos_activos').array().notNull().default(sql`ARRAY['contactos']`),
  folder_id: text('folder_id'),
  hojas: jsonb('hojas').notNull().default(sql`'{}'`),
  ultima_sync: timestamp('ultima_sync', { withTimezone: true }),
  ultimo_error: text('ultimo_error'),
  resumen: jsonb('resumen').notNull().default(sql`'{}'`),
  conectado_por: uuid('conectado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('configuracion_google_drive_empresa_idx').on(tabla.empresa_id),
])

// Historial de entidades recientes por usuario — para acceso rápido desde el dashboard
export const historial_recientes = pgTable('historial_recientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  tipo_entidad: text('tipo_entidad').notNull(), // 'contacto', 'presupuesto', 'actividad', 'documento', 'conversacion'
  entidad_id: uuid('entidad_id').notNull(),
  titulo: text('titulo').notNull(),
  subtitulo: text('subtitulo'),
  icono: text('icono'),
  accion: text('accion').notNull().default('visto'),
  accedido_en: timestamp('accedido_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('historial_recientes_usuario_idx').on(tabla.empresa_id, tabla.usuario_id),
  index('historial_recientes_entidad_idx').on(tabla.tipo_entidad, tabla.entidad_id),
])

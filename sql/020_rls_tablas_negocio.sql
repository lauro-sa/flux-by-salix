-- =============================================================
-- RLS Policies para tablas de negocio — Aislamiento multi-tenant
-- Todas las tablas con empresa_id que no tenían RLS habilitado.
-- Usa empresa_actual() definida en 002_rls_policies.sql
-- =============================================================

-- Nota: Las tablas empresas, perfiles, miembros, invitaciones,
-- permisos_auditoria, productos, config_productos y vistas_guardadas
-- ya tienen RLS habilitado en migraciones anteriores.

-- =============================================================
-- PAGOS NOMINA
-- =============================================================
ALTER TABLE public.pagos_nomina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_nomina_select" ON public.pagos_nomina
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "pagos_nomina_insert" ON public.pagos_nomina
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "pagos_nomina_update" ON public.pagos_nomina
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "pagos_nomina_delete" ON public.pagos_nomina
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- TIPOS DE CONTACTO
-- =============================================================
ALTER TABLE public.tipos_contacto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_contacto_select" ON public.tipos_contacto
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_contacto_insert" ON public.tipos_contacto
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "tipos_contacto_update" ON public.tipos_contacto
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_contacto_delete" ON public.tipos_contacto
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- TIPOS DE RELACION
-- =============================================================
ALTER TABLE public.tipos_relacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_relacion_select" ON public.tipos_relacion
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_relacion_insert" ON public.tipos_relacion
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "tipos_relacion_update" ON public.tipos_relacion
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_relacion_delete" ON public.tipos_relacion
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CAMPOS FISCALES POR PAIS
-- =============================================================
ALTER TABLE public.campos_fiscales_pais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_fiscales_pais_select" ON public.campos_fiscales_pais
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "campos_fiscales_pais_insert" ON public.campos_fiscales_pais
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "campos_fiscales_pais_update" ON public.campos_fiscales_pais
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "campos_fiscales_pais_delete" ON public.campos_fiscales_pais
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONTACTOS
-- =============================================================
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contactos_select" ON public.contactos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contactos_insert" ON public.contactos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contactos_update" ON public.contactos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "contactos_delete" ON public.contactos
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONTACTO VINCULACIONES
-- =============================================================
ALTER TABLE public.contacto_vinculaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacto_vinculaciones_select" ON public.contacto_vinculaciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_vinculaciones_insert" ON public.contacto_vinculaciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contacto_vinculaciones_update" ON public.contacto_vinculaciones
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_vinculaciones_delete" ON public.contacto_vinculaciones
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONTACTO DIRECCIONES
-- =============================================================
ALTER TABLE public.contacto_direcciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacto_direcciones_select" ON public.contacto_direcciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_direcciones_insert" ON public.contacto_direcciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contacto_direcciones_update" ON public.contacto_direcciones
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_direcciones_delete" ON public.contacto_direcciones
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONTACTO RESPONSABLES
-- =============================================================
ALTER TABLE public.contacto_responsables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacto_responsables_select" ON public.contacto_responsables
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_responsables_insert" ON public.contacto_responsables
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contacto_responsables_update" ON public.contacto_responsables
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_responsables_delete" ON public.contacto_responsables
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONTACTO SEGUIDORES
-- =============================================================
ALTER TABLE public.contacto_seguidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacto_seguidores_select" ON public.contacto_seguidores
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "contacto_seguidores_insert" ON public.contacto_seguidores
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "contacto_seguidores_delete" ON public.contacto_seguidores
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- SECUENCIAS (contadores de código por empresa)
-- =============================================================
ALTER TABLE public.secuencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secuencias_select" ON public.secuencias
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "secuencias_insert" ON public.secuencias
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "secuencias_update" ON public.secuencias
  FOR UPDATE USING (empresa_id = empresa_actual());

-- =============================================================
-- PRESUPUESTOS
-- =============================================================
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuestos_select" ON public.presupuestos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_insert" ON public.presupuestos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_update" ON public.presupuestos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "presupuestos_delete" ON public.presupuestos
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- LINEAS DE PRESUPUESTO
-- =============================================================
ALTER TABLE public.lineas_presupuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_presupuesto_select" ON public.lineas_presupuesto
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_insert" ON public.lineas_presupuesto
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_update" ON public.lineas_presupuesto
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "lineas_presupuesto_delete" ON public.lineas_presupuesto
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- PRESUPUESTO HISTORIAL
-- =============================================================
ALTER TABLE public.presupuesto_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_historial_select" ON public.presupuesto_historial
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_historial_insert" ON public.presupuesto_historial
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

-- =============================================================
-- PRESUPUESTO CUOTAS
-- =============================================================
ALTER TABLE public.presupuesto_cuotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_cuotas_select" ON public.presupuesto_cuotas
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_insert" ON public.presupuesto_cuotas
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_update" ON public.presupuesto_cuotas
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_cuotas_delete" ON public.presupuesto_cuotas
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONFIG PRESUPUESTOS
-- =============================================================
ALTER TABLE public.config_presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_presupuestos_select" ON public.config_presupuestos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "config_presupuestos_insert" ON public.config_presupuestos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "config_presupuestos_update" ON public.config_presupuestos
  FOR UPDATE USING (empresa_id = empresa_actual());

-- =============================================================
-- MODULOS EMPRESA
-- =============================================================
ALTER TABLE public.modulos_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modulos_empresa_select" ON public.modulos_empresa
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "modulos_empresa_insert" ON public.modulos_empresa
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "modulos_empresa_update" ON public.modulos_empresa
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "modulos_empresa_delete" ON public.modulos_empresa
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- SUSCRIPCIONES
-- =============================================================
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suscripciones_select" ON public.suscripciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "suscripciones_insert" ON public.suscripciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "suscripciones_update" ON public.suscripciones
  FOR UPDATE USING (empresa_id = empresa_actual());

-- =============================================================
-- PORTAL TOKENS
-- =============================================================
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_tokens_select" ON public.portal_tokens
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "portal_tokens_insert" ON public.portal_tokens
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "portal_tokens_update" ON public.portal_tokens
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "portal_tokens_delete" ON public.portal_tokens
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CHATTER (mensajes, eventos, notas)
-- =============================================================
ALTER TABLE public.chatter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatter_select" ON public.chatter
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "chatter_insert" ON public.chatter
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "chatter_update" ON public.chatter
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "chatter_delete" ON public.chatter
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- TIPOS DE ACTIVIDAD
-- =============================================================
ALTER TABLE public.tipos_actividad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_actividad_select" ON public.tipos_actividad
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_actividad_insert" ON public.tipos_actividad
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "tipos_actividad_update" ON public.tipos_actividad
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "tipos_actividad_delete" ON public.tipos_actividad
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- ESTADOS DE ACTIVIDAD
-- =============================================================
ALTER TABLE public.estados_actividad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estados_actividad_select" ON public.estados_actividad
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "estados_actividad_insert" ON public.estados_actividad
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "estados_actividad_update" ON public.estados_actividad
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "estados_actividad_delete" ON public.estados_actividad
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- CONFIG ACTIVIDADES
-- =============================================================
ALTER TABLE public.config_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_actividades_select" ON public.config_actividades
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "config_actividades_insert" ON public.config_actividades
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "config_actividades_update" ON public.config_actividades
  FOR UPDATE USING (empresa_id = empresa_actual());

-- =============================================================
-- ACTIVIDADES
-- =============================================================
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actividades_select" ON public.actividades
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "actividades_insert" ON public.actividades
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "actividades_update" ON public.actividades
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "actividades_delete" ON public.actividades
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- NOTIFICACIONES
-- =============================================================
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificaciones_select" ON public.notificaciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "notificaciones_insert" ON public.notificaciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "notificaciones_update" ON public.notificaciones
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "notificaciones_delete" ON public.notificaciones
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- RECORDATORIOS
-- =============================================================
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordatorios_select" ON public.recordatorios
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "recordatorios_insert" ON public.recordatorios
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "recordatorios_update" ON public.recordatorios
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "recordatorios_delete" ON public.recordatorios
  FOR DELETE USING (empresa_id = empresa_actual());

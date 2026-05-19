-- Migración 109: fixes críticos sobre Supabase tras incidente de saturación de IO.
--
-- Cambios:
--  1. Reescribir 226 RLS policies envolviendo auth.uid()/auth.jwt() en (select ...)
--     para que Postgres evalúe la función UNA vez por query en vez de por fila.
--     Patrón oficial Supabase 'auth RLS initplan'.
--  2. Sacar 'miembros' y 'chatter' de la publicación supabase_realtime: estas
--     tablas no necesitan tiempo real cliente-lado y cada UPDATE/INSERT se
--     decodificaba para cada suscriptor (35M+ ms acumulados en queries wal->>...).
--  3. Reemplazar el índice partial actual en miembros por uno completo con
--     INCLUDE (rol, permisos_custom) para conseguir index-only scans en el
--     gate de permisos que corre 211k+ veces.

BEGIN;

-- =========================================================================
-- 1. Reescritura de RLS policies (auth.uid()/auth.jwt() → (select ...))
-- =========================================================================

ALTER POLICY "actividades_all" ON public.actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "actividades_select" ON public.actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_actividades_empresa" ON public.actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_adelantos_cuotas" ON public.adelantos_cuotas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_adelantos_nomina" ON public.adelantos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ajustes_concepto_periodo_delete" ON public.ajustes_concepto_periodo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ajustes_concepto_periodo_insert" ON public.ajustes_concepto_periodo
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ajustes_concepto_periodo_select" ON public.ajustes_concepto_periodo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ajustes_concepto_periodo_update" ON public.ajustes_concepto_periodo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "asignaciones_inbox_rls" ON public.asignaciones_inbox
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_asignaciones_inbox_empresa" ON public.asignaciones_inbox
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "asignados_ot_empresa_policy" ON public.asignados_orden_trabajo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_asistencias_empresa" ON public.asistencias
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_actividades_empresa" ON public.auditoria_actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_ajustes_concepto_periodo_insert" ON public.auditoria_ajustes_concepto_periodo
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_ajustes_concepto_periodo_select" ON public.auditoria_ajustes_concepto_periodo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_auditoria_asistencias" ON public.auditoria_asistencias
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_conceptos_contrato_insert" ON public.auditoria_conceptos_contrato
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_conceptos_contrato_select" ON public.auditoria_conceptos_contrato
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_auditoria_conceptos_nomina" ON public.auditoria_conceptos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_auditoria_contacto_telefonos_empresa" ON public.auditoria_contacto_telefonos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_contactos_empresa" ON public.auditoria_contactos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_auditoria_contratos_laborales" ON public.auditoria_contratos_laborales
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_entidades_financieras_insert" ON public.auditoria_entidades_financieras
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_entidades_financieras_select" ON public.auditoria_entidades_financieras
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_info_bancaria_insert" ON public.auditoria_info_bancaria
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_info_bancaria_select" ON public.auditoria_info_bancaria
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_plantillas_correo_empresa" ON public.auditoria_plantillas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_plantillas_whatsapp_empresa" ON public.auditoria_plantillas_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_presupuestos_empresa" ON public.auditoria_presupuestos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_productos_empresa" ON public.auditoria_productos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_respuestas_rapidas_correo_empresa" ON public.auditoria_respuestas_rapidas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "auditoria_respuestas_rapidas_whatsapp_empresa" ON public.auditoria_respuestas_rapidas_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_aislada" ON public.base_conocimiento_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_base_conocimiento_ia_empresa" ON public.base_conocimiento_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_canal_agentes_empresa" ON public.canal_agentes
  USING (((EXISTS ( SELECT 1
   FROM canales_correo
  WHERE ((canales_correo.id = canal_agentes.canal_id) AND (canales_correo.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))) OR (EXISTS ( SELECT 1
   FROM canales_whatsapp
  WHERE ((canales_whatsapp.id = canal_agentes.canal_id) AND (canales_whatsapp.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))))));

ALTER POLICY "rls_canal_interno_miembros_empresa" ON public.canal_interno_miembros
  USING ((EXISTS ( SELECT 1
   FROM canales_internos
  WHERE ((canales_internos.id = canal_interno_miembros.canal_id) AND (canales_internos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM canales_internos
  WHERE ((canales_internos.id = canal_interno_miembros.canal_id) AND (canales_internos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "canales_correo_empresa" ON public.canales_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "canales_internos_rls" ON public.canales_internos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_canales_internos_empresa" ON public.canales_internos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "canales_whatsapp_empresa" ON public.canales_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "cargas_credito_ia_empresa" ON public.cargas_credito_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "chatter_insert" ON public.chatter
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "chatter_select" ON public.chatter
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_chatter_empresa" ON public.chatter
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "conceptos_aplicados_pago_tenant" ON public.conceptos_aplicados_pago
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "conceptos_contrato_tenant" ON public.conceptos_contrato
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "conceptos_nomina_tenant" ON public.conceptos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_actividades_all" ON public.config_actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "config_actividades_select" ON public.config_actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_config_actividades_empresa" ON public.config_actividades
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_aislada" ON public.config_agente_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_config_agente_ia_empresa" ON public.config_agente_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_config_asistencias" ON public.config_asistencias
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_calendario_empresa_policy" ON public.config_calendario
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_config_chatbot_empresa" ON public.config_chatbot
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_correo_empresa" ON public.config_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar config IA" ON public.config_ia
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))
  WITH CHECK ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Leer config IA" ON public.config_ia
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_config_ia_empresa" ON public.config_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_ia_empresa" ON public.config_ia_empresa
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_config_presupuestos_empresa" ON public.config_presupuestos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_productos_empresa_policy" ON public.config_productos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_config_productos_empresa" ON public.config_productos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_salix_ia_empresa" ON public.config_salix_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_visitas_policy" ON public.config_visitas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "config_whatsapp_empresa" ON public.config_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Admins modifican config Google Drive" ON public.configuracion_google_drive
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Miembros ven config Google Drive" ON public.configuracion_google_drive
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_configuracion_google_drive_empresa" ON public.configuracion_google_drive
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "configuracion_nomina_empresa_tenant" ON public.configuracion_nomina_empresa
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_contacto_direcciones_empresa" ON public.contacto_direcciones
  USING ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_direcciones.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_direcciones.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "rls_contacto_responsables_empresa" ON public.contacto_responsables
  USING ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_responsables.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_responsables.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "rls_contacto_seguidores_empresa" ON public.contacto_seguidores
  USING ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_seguidores.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contactos
  WHERE ((contactos.id = contacto_seguidores.contacto_id) AND (contactos.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "rls_contacto_telefonos_empresa" ON public.contacto_telefonos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_contacto_vinculaciones_empresa" ON public.contacto_vinculaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_contactos_empresa" ON public.contactos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar contacto emergencia" ON public.contactos_emergencia
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))))
  WITH CHECK ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "Leer contacto emergencia" ON public.contactos_emergencia
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "rls_contactos_emergencia_empresa" ON public.contactos_emergencia
  USING ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = contactos_emergencia.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = contactos_emergencia.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "contratos_laborales_tenant" ON public.contratos_laborales
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_conversacion_etiquetas_empresa" ON public.conversacion_etiquetas
  USING ((EXISTS ( SELECT 1
   FROM conversaciones
  WHERE ((conversaciones.id = conversacion_etiquetas.conversacion_id) AND (conversaciones.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversaciones
  WHERE ((conversaciones.id = conversacion_etiquetas.conversacion_id) AND (conversaciones.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "conversacion_pins_usuario" ON public.conversacion_pins
  USING ((usuario_id = (select auth.uid())));

ALTER POLICY "conversacion_seguidores_gestionar" ON public.conversacion_seguidores
  USING ((usuario_id = (select auth.uid())));

ALTER POLICY "conversacion_silencios_usuario" ON public.conversacion_silencios
  USING ((usuario_id = (select auth.uid())));

ALTER POLICY "conversaciones_rls" ON public.conversaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_conversaciones_empresa" ON public.conversaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "conversaciones_salix_ia_propio" ON public.conversaciones_salix_ia
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "correo_por_tipo_contacto_empresa" ON public.correo_por_tipo_contacto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "correos_programados_rls" ON public.correos_programados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_correos_programados_empresa" ON public.correos_programados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar documentos usuario" ON public.documentos_usuario
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))))
  WITH CHECK ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "Leer documentos usuario" ON public.documentos_usuario
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "rls_documentos_usuario_empresa" ON public.documentos_usuario
  USING ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = documentos_usuario.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = documentos_usuario.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "Gestionar educacion" ON public.educacion_usuario
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))))
  WITH CHECK ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "Leer educacion" ON public.educacion_usuario
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "rls_educacion_usuario_empresa" ON public.educacion_usuario
  USING ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = educacion_usuario.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = educacion_usuario.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "Actualizar empresa propia" ON public.empresas
  USING ((id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))
  WITH CHECK ((id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Leer empresas" ON public.empresas
  USING (((id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid) OR (id IN ( SELECT miembros.empresa_id
   FROM miembros
  WHERE (miembros.usuario_id = (select auth.uid()))))));

ALTER POLICY "bancos_empresa" ON public.entidades_financieras
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "entidades_financieras_delete" ON public.entidades_financieras
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "entidades_financieras_insert" ON public.entidades_financieras
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "entidades_financieras_select" ON public.entidades_financieras
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "entidades_financieras_update" ON public.entidades_financieras
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "estados_actividad_all" ON public.estados_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "estados_actividad_select" ON public.estados_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_estados_actividad_empresa" ON public.estados_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "etapas_conversacion_empresa" ON public.etapas_conversacion
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_etiquetas_contacto_empresa" ON public.etiquetas_contacto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "etiquetas_correo_rls" ON public.etiquetas_inbox
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_etiquetas_inbox_empresa" ON public.etiquetas_inbox
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "eventos_calendario_empresa_policy" ON public.eventos_calendario
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "feriados_delete" ON public.feriados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "feriados_insert" ON public.feriados
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "feriados_select" ON public.feriados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "feriados_update" ON public.feriados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_fichajes_actividad" ON public.fichajes_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_historial_compensacion" ON public.historial_compensacion
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "historial_plantillas_wa_insert" ON public.historial_plantillas_whatsapp
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "historial_plantillas_wa_select" ON public.historial_plantillas_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Usuarios actualizan sus propios recientes" ON public.historial_recientes
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "Usuarios eliminan sus propios recientes" ON public.historial_recientes
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "Usuarios insertan sus propios recientes" ON public.historial_recientes
  WITH CHECK (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "Usuarios ven sus propios recientes" ON public.historial_recientes
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "Gestionar info bancaria" ON public.info_bancaria
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))))
  WITH CHECK ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "Leer info bancaria" ON public.info_bancaria
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "info_bancaria_delete" ON public.info_bancaria
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "info_bancaria_insert" ON public.info_bancaria
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "info_bancaria_select" ON public.info_bancaria
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "info_bancaria_update" ON public.info_bancaria
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_info_bancaria_empresa" ON public.info_bancaria
  USING ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = info_bancaria.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM miembros
  WHERE ((miembros.id = info_bancaria.miembro_id) AND (miembros.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "Leer invitaciones" ON public.invitaciones
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_invitaciones_empresa" ON public.invitaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "licencias_contrato_tenant" ON public.licencias_contrato
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "lineas_ot_empresa_policy" ON public.lineas_orden_trabajo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_lineas_presupuesto_empresa" ON public.lineas_presupuesto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_aislada" ON public.log_agente_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_log_agente_ia_empresa" ON public.log_agente_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "log_salix_ia_admin" ON public.log_salix_ia
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "mensaje_adjuntos_rls" ON public.mensaje_adjuntos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_mensaje_adjuntos_empresa" ON public.mensaje_adjuntos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_mensaje_lecturas_empresa" ON public.mensaje_lecturas
  USING ((EXISTS ( SELECT 1
   FROM mensajes
  WHERE ((mensajes.id = mensaje_lecturas.mensaje_id) AND (mensajes.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM mensajes
  WHERE ((mensajes.id = mensaje_lecturas.mensaje_id) AND (mensajes.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "mensajes_rls" ON public.mensajes
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_mensajes_empresa" ON public.mensajes
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "metricas_correo_rls" ON public.metricas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_metricas_correo_empresa" ON public.metricas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Actualizar miembros" ON public.miembros
  USING ((empresa_id IN ( SELECT ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid AS uuid)));

ALTER POLICY "Eliminar miembros" ON public.miembros
  USING ((empresa_id IN ( SELECT ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid AS uuid)));

ALTER POLICY "Insertar miembros" ON public.miembros
  WITH CHECK ((empresa_id IN ( SELECT ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid AS uuid)));

ALTER POLICY "Leer miembros" ON public.miembros
  USING (((usuario_id = (select auth.uid())) OR (empresa_id IN ( SELECT ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid AS uuid))));

ALTER POLICY "rls_miembros_empresa" ON public.miembros
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar asignaciones sectores" ON public.miembros_sectores
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))))
  WITH CHECK ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "Leer asignaciones sectores" ON public.miembros_sectores
  USING ((miembro_id IN ( SELECT miembros.id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))));

ALTER POLICY "rls_miembros_sectores_empresa" ON public.miembros_sectores
  USING ((EXISTS ( SELECT 1
   FROM sectores
  WHERE ((sectores.id = miembros_sectores.sector_id) AND (sectores.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM sectores
  WHERE ((sectores.id = miembros_sectores.sector_id) AND (sectores.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "modulos_empresa_rls" ON public.modulos_empresa
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_modulos_empresa_empresa" ON public.modulos_empresa
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "notas_rapidas_empresa" ON public.notas_rapidas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "notas_compartidas_acceso" ON public.notas_rapidas_compartidas
  USING ((nota_id IN ( SELECT notas_rapidas.id
   FROM notas_rapidas
  WHERE (notas_rapidas.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))));

ALTER POLICY "notificaciones_rls" ON public.notificaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_notificaciones_empresa" ON public.notificaciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ot_historial_empresa_policy" ON public.orden_trabajo_historial
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "ordenes_trabajo_empresa_policy" ON public.ordenes_trabajo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "pagos_nomina_delete" ON public.pagos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "pagos_nomina_insert" ON public.pagos_nomina
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "pagos_nomina_select" ON public.pagos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "pagos_nomina_update" ON public.pagos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_pagos_nomina_empresa" ON public.pagos_nomina
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Editar perfil propio" ON public.perfiles
  USING ((id = (select auth.uid())))
  WITH CHECK ((id = (select auth.uid())));

ALTER POLICY "Leer perfiles" ON public.perfiles
  USING (((id = (select auth.uid())) OR (id IN ( SELECT miembros.usuario_id
   FROM miembros
  WHERE (miembros.empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid)))));

ALTER POLICY "rls_plantillas_correo_empresa" ON public.plantillas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "plantillas_recorrido_policy" ON public.plantillas_recorrido
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "plantillas_whatsapp_empresa" ON public.plantillas_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_portal_tokens_empresa" ON public.portal_tokens
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Actualizar preferencias propias" ON public.preferencias_usuario
  USING ((usuario_id = (select auth.uid())))
  WITH CHECK ((usuario_id = (select auth.uid())));

ALTER POLICY "Escribir preferencias propias" ON public.preferencias_usuario
  WITH CHECK ((usuario_id = (select auth.uid())));

ALTER POLICY "Leer preferencias propias" ON public.preferencias_usuario
  USING ((usuario_id = (select auth.uid())));

ALTER POLICY "rls_preferencias_usuario_propio" ON public.preferencias_usuario
  USING ((usuario_id = (select auth.uid())))
  WITH CHECK ((usuario_id = (select auth.uid())));

ALTER POLICY "rls_presets_actividades_usuario" ON public.presets_actividades
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))))
  WITH CHECK (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "rls_presets_visitas_usuario" ON public.presets_visitas
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))))
  WITH CHECK (((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid) AND (usuario_id = (select auth.uid()))));

ALTER POLICY "rls_presupuesto_cuotas_empresa" ON public.presupuesto_cuotas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_presupuesto_historial_empresa" ON public.presupuesto_historial
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_presupuesto_pago_auditoria_empresa" ON public.presupuesto_pago_auditoria
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_presupuesto_pago_comprobantes_empresa" ON public.presupuesto_pago_comprobantes
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_presupuestos_empresa" ON public.presupuestos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "productos_empresa_policy" ON public.productos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_productos_empresa" ON public.productos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar puestos" ON public.puestos
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))
  WITH CHECK ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Leer puestos" ON public.puestos
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_puestos_empresa" ON public.puestos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_puestos_contacto_empresa" ON public.puestos_contacto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "recordatorios_delete" ON public.recordatorios
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid) AND (asignado_a = (select auth.uid()))));

ALTER POLICY "recordatorios_insert" ON public.recordatorios
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "recordatorios_select" ON public.recordatorios
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid) AND (asignado_a = (select auth.uid()))));

ALTER POLICY "recordatorios_update" ON public.recordatorios
  USING (((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid) AND (asignado_a = (select auth.uid()))));

ALTER POLICY "rls_recordatorios_empresa" ON public.recordatorios
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "recordatorios_cal_empresa_policy" ON public.recordatorios_calendario
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "recorrido_paradas_policy" ON public.recorrido_paradas
  USING ((EXISTS ( SELECT 1
   FROM recorridos r
  WHERE ((r.id = recorrido_paradas.recorrido_id) AND (r.empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))));

ALTER POLICY "recorridos_empresa_policy" ON public.recorridos
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "reglas_correo_rls" ON public.reglas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_reglas_correo_empresa" ON public.reglas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "respuestas_rapidas_correo_empresa" ON public.respuestas_rapidas_correo
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "respuestas_rapidas_whatsapp_empresa" ON public.respuestas_rapidas_whatsapp
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_rubros_contacto_empresa" ON public.rubros_contacto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "Gestionar sectores" ON public.sectores
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid))
  WITH CHECK ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Leer sectores" ON public.sectores
  USING ((empresa_id = ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_sectores_empresa" ON public.sectores
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_secuencias_empresa" ON public.secuencias
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_solicitudes_fichaje" ON public.solicitudes_fichaje
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_suscripciones_empresa" ON public.suscripciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "suscripciones_rls" ON public.suscripciones
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_suscripciones_push_empresa" ON public.suscripciones_push
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "suscripciones_push_rls" ON public.suscripciones_push
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "tareas_orden_empresa" ON public.tareas_orden
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_terminales_kiosco" ON public.terminales_kiosco
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_tipos_actividad_empresa" ON public.tipos_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "tipos_actividad_all" ON public.tipos_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "tipos_actividad_select" ON public.tipos_actividad
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "rls_tipos_contacto_empresa" ON public.tipos_contacto
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "tipos_evento_cal_empresa_policy" ON public.tipos_evento_calendario
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "rls_tipos_relacion_empresa" ON public.tipos_relacion
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "empresa_turnos_laborales" ON public.turnos_laborales
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "uso_storage_empresa" ON public.uso_storage
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "visitas_empresa_policy" ON public.visitas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_activa_id'::text))::uuid));

ALTER POLICY "Usuarios ven sus propias vistas" ON public.vistas_guardadas
  USING (((usuario_id = (select auth.uid())) AND (empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)))
  WITH CHECK (((usuario_id = (select auth.uid())) AND (empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid)));

ALTER POLICY "rls_vistas_guardadas_empresa" ON public.vistas_guardadas
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid))
  WITH CHECK ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

ALTER POLICY "whatsapp_programados_empresa" ON public.whatsapp_programados
  USING ((empresa_id = (((select auth.jwt()) ->> 'empresa_id'::text))::uuid));

-- =========================================================================
-- 2. Sacar 'miembros' y 'chatter' de la publicación supabase_realtime
-- =========================================================================

ALTER PUBLICATION supabase_realtime DROP TABLE public.miembros;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chatter;

-- =========================================================================
-- 3. Índice compuesto completo en miembros con INCLUDE
-- =========================================================================

-- El índice existente miembros_usuario_empresa_idx es partial (WHERE usuario_id IS NOT NULL)
-- y no incluye rol/permisos_custom, así que el planner cae a seq scan.
-- Creamos uno completo que cubre el gate de permisos del backend.
CREATE INDEX IF NOT EXISTS idx_miembros_gate_permisos
  ON public.miembros (usuario_id, empresa_id)
  INCLUDE (rol, permisos_custom, activo)
  WHERE usuario_id IS NOT NULL;

COMMIT;

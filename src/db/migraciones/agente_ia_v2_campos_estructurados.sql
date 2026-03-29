-- Agente IA v2: campos estructurados para configuración por empresa
-- Datos del negocio
ALTER TABLE config_agente_ia ADD COLUMN zona_cobertura TEXT DEFAULT '';
ALTER TABLE config_agente_ia ADD COLUMN sitio_web TEXT DEFAULT '';
ALTER TABLE config_agente_ia ADD COLUMN horario_atencion TEXT DEFAULT '';
ALTER TABLE config_agente_ia ADD COLUMN correo_empresa TEXT DEFAULT '';

-- Servicios
ALTER TABLE config_agente_ia ADD COLUMN servicios_si TEXT DEFAULT '';
ALTER TABLE config_agente_ia ADD COLUMN servicios_no TEXT DEFAULT '';

-- Tipos de contacto: [{tipo, nombre, icono, formulario, instrucciones}]
ALTER TABLE config_agente_ia ADD COLUMN tipos_contacto JSONB DEFAULT '[]'::jsonb;

-- Flujo de conversación: [{paso, titulo, descripcion, condicion_avance}]
ALTER TABLE config_agente_ia ADD COLUMN flujo_conversacion JSONB DEFAULT '[]'::jsonb;

-- Reglas de agenda
ALTER TABLE config_agente_ia ADD COLUMN reglas_agenda TEXT DEFAULT '';

-- Precios de referencia
ALTER TABLE config_agente_ia ADD COLUMN info_precios TEXT DEFAULT '';

-- Situaciones especiales
ALTER TABLE config_agente_ia ADD COLUMN situaciones_especiales TEXT DEFAULT '';

-- Ejemplos few-shot: [{titulo, mensajes: [{rol, texto}]}]
ALTER TABLE config_agente_ia ADD COLUMN ejemplos_conversacion JSONB DEFAULT '[]'::jsonb;

-- Respuesta si preguntan si es bot
ALTER TABLE config_agente_ia ADD COLUMN respuesta_si_bot TEXT DEFAULT '';

-- Vocabulario natural del agente
ALTER TABLE config_agente_ia ADD COLUMN vocabulario_natural TEXT DEFAULT '';

-- Tracking de análisis de conversaciones
ALTER TABLE config_agente_ia ADD COLUMN ultimo_analisis_conversaciones TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE config_agente_ia ADD COLUMN total_conversaciones_analizadas INT DEFAULT 0;

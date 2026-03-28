-- =============================================================
-- Migración: Configuración de PDF para presupuestos
-- Agrega columnas de membrete, pie de página, plantilla HTML,
-- patrón de nombre y datos de empresa para PDF
-- =============================================================

-- Agregar columnas de configuración PDF a config_presupuestos
ALTER TABLE public.config_presupuestos
  ADD COLUMN IF NOT EXISTS membrete jsonb DEFAULT '{
    "mostrar_logo": true,
    "posicion_logo": "izquierda",
    "ancho_logo": 30,
    "contenido_html": "",
    "alineacion_texto": "izquierda",
    "tamano_texto": 14,
    "linea_separadora": true
  }',
  ADD COLUMN IF NOT EXISTS pie_pagina jsonb DEFAULT '{
    "linea_superior": true,
    "tamano_texto": 10,
    "columnas": {
      "izquierda": { "tipo": "texto", "texto": "" },
      "centro": { "tipo": "vacio" },
      "derecha": { "tipo": "numeracion" }
    }
  }',
  ADD COLUMN IF NOT EXISTS plantilla_html text,
  ADD COLUMN IF NOT EXISTS patron_nombre_pdf text DEFAULT '{numero} - {contacto_nombre}',
  ADD COLUMN IF NOT EXISTS datos_empresa_pdf jsonb DEFAULT '{
    "mostrar_razon_social": true,
    "mostrar_identificacion": true,
    "mostrar_condicion_fiscal": true,
    "mostrar_direccion": true,
    "mostrar_telefono": true,
    "mostrar_correo": true,
    "mostrar_pagina_web": false,
    "mostrar_datos_bancarios": false,
    "datos_bancarios": {
      "banco": "",
      "titular": "",
      "cbu": "",
      "alias": ""
    }
  }';

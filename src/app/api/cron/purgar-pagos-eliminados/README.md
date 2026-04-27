# Cron pendiente: purgar pagos en papelera

**Estado**: deuda registrada (no implementado).

## Qué tiene que hacer

Borrar físicamente los `presupuesto_pagos` con `eliminado_en < NOW() - INTERVAL '7 days'` y todos sus comprobantes en Storage. Pasados los 7 días, la papelera ya no permite restaurar (UX clara: "se elimina definitivamente").

## Cómo implementarlo

1. Crear `src/app/api/cron/purgar-pagos-eliminados/route.ts` con `GET` (Vercel Cron).
2. Para cada pago a purgar:
   - Leer `presupuesto_pago_comprobantes` por `pago_id` para obtener storage paths.
   - `admin.storage.from('documentos-pdf').remove(paths)`.
   - `descontarUsoStorage(empresa_id, 'documentos-pdf', bytes_total)`.
   - DELETE físico del pago (CASCADE borra los comprobantes en BD).
3. Registrar el batch en logs.

## Configuración Vercel

En `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/purgar-pagos-eliminados",
      "schedule": "0 4 * * *"
    }
  ]
}
```

(Cuenta Vercel Pro requerida — ver memoria `project_crons_hobby`).

## Mientras tanto

Los pagos eliminados se acumulan en BD pero no afectan funcionalidad: los queries
del módulo ya filtran `eliminado_en IS NULL` y la auditoría
(`presupuesto_pago_auditoria`) registra todos los cambios. La purga es solo
para liberar espacio en Storage y mantener la BD limpia a largo plazo.

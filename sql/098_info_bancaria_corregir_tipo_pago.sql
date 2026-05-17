-- 098 — Corregir tipo_pago en filas existentes de info_bancaria
--
-- Contexto:
-- En sql/093 se agregó la columna tipo_pago ('banco' | 'digital') con DEFAULT 'banco'.
-- Las cuentas creadas antes (o creadas por la UI vieja de Usuarios que no enviaba
-- tipo_pago) quedaron todas como 'banco', incluso cuando claramente son billeteras
-- virtuales (Mercado Pago, Ualá, Naranja X, Personal Pay, etc.) o tienen tipo_cuenta = 'cvu'.
--
-- Este backfill reclasifica esas filas a tipo_pago = 'digital' para que el modal de
-- "Registrar pago" en Nóminas las agrupe correctamente en la pestaña "Billetera virtual".
--
-- Regla aplicada (en orden):
--   1. tipo_cuenta = 'cvu' → digital
--   2. banco ilike alguno de los nombres conocidos de billeteras → digital
--   3. Resto se queda como 'banco' (valor por defecto correcto para CBU bancario)

UPDATE info_bancaria
SET tipo_pago = 'digital'
WHERE tipo_pago = 'banco'
  AND (
    tipo_cuenta = 'cvu'
    OR banco ILIKE '%mercado pago%'
    OR banco ILIKE '%mercadopago%'
    OR banco ILIKE '%ual%'
    OR banco ILIKE '%naranja x%'
    OR banco ILIKE '%naranjax%'
    OR banco ILIKE '%personal pay%'
    OR banco ILIKE '%personalpay%'
    OR banco ILIKE '%modo%'
    OR banco ILIKE '%brubank%'
    OR banco ILIKE '%lemon%'
    OR banco ILIKE '%belo%'
    OR banco ILIKE '%prex%'
    OR banco ILIKE '%cuenta dni%'
  );

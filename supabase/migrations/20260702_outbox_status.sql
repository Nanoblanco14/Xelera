-- ═══════════════════════════════════════════════════════════════
--  OUTBOX — estados de entrega de WhatsApp (Meta statuses)
--
--  Cada mensaje saliente guarda su wamid (provider_message_id);
--  los webhooks de statuses de Meta actualizan delivery_status:
--    sent → delivered → read   (✓ → ✓✓ → ✓✓ azul en el inbox)
--    failed                     (⚠ + delivery_error + alerta)
--
--  lead_messages ya está en la publication supabase_realtime con
--  REPLICA IDENTITY FULL (fase 0) → los UPDATE llegan al inbox
--  en tiempo real sin cambios adicionales.
--  Ejecutar en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lead_messages
    ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
    ADD COLUMN IF NOT EXISTS delivery_status TEXT
        CHECK (delivery_status IN ('sent','delivered','read','failed')),
    ADD COLUMN IF NOT EXISTS delivery_error TEXT;

-- Lookup del webhook de statuses: wamid → fila del mensaje
CREATE INDEX IF NOT EXISTS idx_lead_messages_provider_id
    ON lead_messages(provider_message_id)
    WHERE provider_message_id IS NOT NULL;

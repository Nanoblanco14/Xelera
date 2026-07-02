-- ═══════════════════════════════════════════════════════════════
--  webhook_events — deduplicación de mensajes entrantes
--
--  Meta (y Twilio) reintentan el webhook si la respuesta tarda.
--  Cada mensaje procesado registra su ID de proveedor (wamid.* /
--  MessageSid); un conflicto de PK significa que otro request ya
--  procesó ese mensaje y debe ignorarse.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhook_events (
    message_id      TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_org_created
    ON webhook_events(organization_id, created_at);

-- Solo el service role (webhook) escribe aquí; sin acceso anon.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Limpieza: los IDs solo importan durante la ventana de reintentos
-- de Meta (~24 h). Ejecutar periódicamente (pg_cron o manual):
--   DELETE FROM webhook_events WHERE created_at < now() - interval '48 hours';

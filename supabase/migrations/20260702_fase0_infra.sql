-- ═══════════════════════════════════════════════════════════════
--  FASE 0 + FASE 1 (base) — Infraestructura Enterprise
--  1. ai_usage_log         → telemetría de costos IA por tenant
--  2. inbound_message_buffer → cola con debounce para el webhook
--  3. Realtime publication  → inbox en tiempo real sin polling
--  Ejecutar completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. TELEMETRÍA DE COSTOS IA
--    Una fila por completion/embedding de OpenAI. Permite auditar
--    costo por tenant, detectar abuso y facturar por uso después.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
    model             TEXT NOT NULL,
    purpose           TEXT NOT NULL,          -- 'chat' | 'chat_followup' | 'embedding' | 'test_chat' | ...
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultas típicas: costo por org por período
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_date
    ON ai_usage_log(organization_id, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Los miembros de la org pueden ver su propio consumo (dashboard futuro)
CREATE POLICY "Org members read own ai usage"
    ON ai_usage_log FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- ─────────────────────────────────────────────────────────────
-- 2. COLA DE MENSAJES ENTRANTES (debounce de ráfagas)
--    El webhook inserta aquí y responde 200 al instante. Un worker
--    diferido (after() + sweeper del cron) procesa el lote completo
--    cuando el cliente deja de escribir (~8s).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbound_message_buffer (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id             UUID REFERENCES leads(id) ON DELETE CASCADE,
    phone               TEXT NOT NULL,
    content             TEXT NOT NULL,
    provider_message_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at        TIMESTAMPTZ,
    batch_id            UUID
);

-- Lookup principal: mensajes sin procesar de una conversación
CREATE INDEX IF NOT EXISTS idx_imb_pending
    ON inbound_message_buffer(organization_id, phone, created_at)
    WHERE processed_at IS NULL;

-- Sweeper: lotes huérfanos (timer serverless muerto)
CREATE INDEX IF NOT EXISTS idx_imb_stale
    ON inbound_message_buffer(created_at)
    WHERE processed_at IS NULL;

ALTER TABLE inbound_message_buffer ENABLE ROW LEVEL SECURITY;
-- Solo el service role (webhook/cron) opera esta tabla — sin policies públicas.

-- Limpieza recomendada (pg_cron o manual):
--   DELETE FROM inbound_message_buffer WHERE processed_at < now() - interval '7 days';

-- ─────────────────────────────────────────────────────────────
-- 3. REALTIME PARA EL INBOX
--    postgres_changes requiere que las tablas estén en la
--    publication supabase_realtime. Las policies RLS existentes
--    (org_members) delimitan qué eventos recibe cada usuario.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- lead_messages: INSERT de cada mensaje entrante/saliente
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lead_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE lead_messages;
    END IF;

    -- leads: cambios de etapa / estado / pausa del bot
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    END IF;
END $$;

-- Necesario para que los eventos UPDATE incluyan la fila completa
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE lead_messages REPLICA IDENTITY FULL;

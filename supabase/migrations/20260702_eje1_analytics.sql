-- ═══════════════════════════════════════════════════════════════
--  EJE 1 — Dashboard avanzado: event sourcing ligero + agregados
--
--  analytics_events   : una fila por evento operativo (append-only)
--  daily_org_metrics  : agregado diario por org, mantenido por el
--                       cron (idempotente: recalcula hoy y ayer)
--
--  El dashboard lee agregados — nunca recalcula sobre tablas crudas.
--  Ejecutar completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. EVENTOS (append-only)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN (
                        'message_received',   -- mensaje entrante de WhatsApp
                        'bot_replied',        -- respuesta del agente (latency_ms poblado)
                        'handoff',            -- derivado a humano
                        'stage_changed',      -- transición de etapa en el pipeline
                        'appointment_booked', -- cita creada
                        'lead_created'        -- lead nuevo captado
                    )),
    latency_ms      INTEGER,                  -- solo bot_replied: última msg del cliente → respuesta
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_type_date
    ON analytics_events(organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_date
    ON analytics_events(organization_id, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read analytics_events"
    ON analytics_events FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- ─────────────────────────────────────────────────────────────
-- 2. AGREGADO DIARIO POR ORG
--    Upsert idempotente desde el cron: (org, fecha) es la PK,
--    recalcular el mismo día simplemente sobreescribe.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_org_metrics (
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_date          DATE NOT NULL,
    messages_received    INTEGER NOT NULL DEFAULT 0,
    bot_replies          INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms       INTEGER,             -- promedio de bot_replied.latency_ms
    active_conversations INTEGER NOT NULL DEFAULT 0,  -- leads distintos con mensajes ese día
    handoffs             INTEGER NOT NULL DEFAULT 0,
    leads_created        INTEGER NOT NULL DEFAULT 0,
    appointments_booked  INTEGER NOT NULL DEFAULT 0,
    stage_changes        INTEGER NOT NULL DEFAULT 0,
    prompt_tokens        BIGINT NOT NULL DEFAULT 0,
    completion_tokens    BIGINT NOT NULL DEFAULT 0,
    total_tokens         BIGINT NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_org_metrics_date
    ON daily_org_metrics(organization_id, metric_date DESC);

ALTER TABLE daily_org_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read daily_org_metrics"
    ON daily_org_metrics FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- Limpieza recomendada de eventos crudos (los agregados los preservan):
--   DELETE FROM analytics_events WHERE created_at < now() - interval '90 days';

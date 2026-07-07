-- ═══════════════════════════════════════════════════════════════
--  RULE ENGINE — triggers proactivos (evento → condición → acción)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS automation_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('event','schedule')),
    -- event: tipo de analytics_events (stage_changed, handoff, appointment_booked…)
    -- schedule: 'inactive_lead' (barrido del cron)
    trigger_event   TEXT NOT NULL,
    conditions      JSONB NOT NULL DEFAULT '{"all":[]}'::jsonb,
    action_type     TEXT NOT NULL CHECK (action_type IN
                        ('send_text','send_template','notify_owner','create_notification','move_stage')),
    action_params   JSONB NOT NULL DEFAULT '{}'::jsonb,
    cooldown_hours  INTEGER NOT NULL DEFAULT 24,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org
    ON automation_rules(organization_id, enabled, trigger_type);

-- Log de ejecuciones + dedupe por (regla, lead, ventana de cooldown)
CREATE TABLE IF NOT EXISTS automation_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    success         BOOLEAN NOT NULL DEFAULT true,
    detail          TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_dedupe
    ON automation_runs(rule_id, lead_id, executed_at DESC);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage automation_rules"
    ON automation_rules FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Org members read automation_runs"
    ON automation_runs FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

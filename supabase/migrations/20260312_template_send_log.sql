-- ═══════════════════════════════════════════════════════════════
--  Template Send Log — tracks all auto-sent WhatsApp templates
--  Used for anti-spam (cooldowns, daily limits, deduplication)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS template_send_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event text NOT NULL,
    template_name text NOT NULL,
    parameters jsonb DEFAULT '[]'::jsonb,
    sent_at timestamptz DEFAULT now(),
    success boolean DEFAULT true,
    error text
);

-- Fast lookup: cooldown check (last send per lead+event)
CREATE INDEX IF NOT EXISTS idx_tsl_lead_event ON template_send_log(lead_id, event, sent_at DESC);

-- Fast lookup: daily limit (all sends today per lead)
CREATE INDEX IF NOT EXISTS idx_tsl_lead_date ON template_send_log(lead_id, sent_at DESC);

-- Analytics: org-level stats
CREATE INDEX IF NOT EXISTS idx_tsl_org ON template_send_log(organization_id, sent_at DESC);

-- RLS
ALTER TABLE template_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template logs for their org"
    ON template_send_log FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

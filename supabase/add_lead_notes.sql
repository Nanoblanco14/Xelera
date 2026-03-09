-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Migración: Notas Internas de Leads (multi-tenant, equipo) ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS lead_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    author_email    TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_org_id  ON lead_notes(organization_id);

-- RLS
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_access_lead_notes" ON lead_notes
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
    );

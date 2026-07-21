-- ═══════════════════════════════════════════════════════════════
--  PILAR 3 — Lead Scoring (temperatura de intención de compra)
--  El LLM infiere la temperatura en la MISMA llamada a
--  gestionar_lead_crm (cero latencia / cero costo extra).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS temperature TEXT
        CHECK (temperature IN ('caliente', 'tibio', 'frio'));

-- Filtro rápido del pipeline por temperatura
CREATE INDEX IF NOT EXISTS idx_leads_temperature
    ON leads(organization_id, temperature)
    WHERE temperature IS NOT NULL;

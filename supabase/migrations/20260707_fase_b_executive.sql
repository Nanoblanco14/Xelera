-- ═══════════════════════════════════════════════════════════════
--  FASE B (Executive) — Reporte de Impacto semanal
--  Marcador de cadencia en columna propia (patrón token-health:
--  cero read-modify-write sobre settings JSONB).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS impact_report_sent_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
--  QA PRE-DEPLOY — fix race condition en organizations.settings
--  El marcador del health-check sale del JSONB (read-modify-write
--  pisaba la config del usuario) a su propia columna atómica.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS meta_token_checked_at TIMESTAMPTZ;

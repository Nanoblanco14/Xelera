-- ============================================================
-- Plan/Tier system — Add plan column to organizations
-- ============================================================

-- Add plan column with default 'free'
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Index for quick plan lookups
CREATE INDEX IF NOT EXISTS idx_org_plan ON organizations(plan);

-- Comment for clarity
COMMENT ON COLUMN organizations.plan IS 'Subscription tier: free | pro | business';

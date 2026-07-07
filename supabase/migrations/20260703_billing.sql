-- ═══════════════════════════════════════════════════════════════
--  BILLING (Stripe) — campos de suscripción en organizations
--  El webhook de Stripe es la única fuente de verdad de `plan`.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS plan_status            TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active','past_due','canceled','trialing'));

-- Lookup del webhook: customer → org
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer
    ON organizations(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- webhook_events también deduplica eventos de Stripe (sin org asociada)
ALTER TABLE webhook_events ALTER COLUMN organization_id DROP NOT NULL;

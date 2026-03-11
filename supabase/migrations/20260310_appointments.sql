-- ═══════════════════════════════════════════════════════════════
--  MiAgente — Appointment Scheduling System
--  Tables: business_hours, blocked_dates, appointments
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Business Hours (weekly schedule per org) ──────────────
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    is_open BOOLEAN NOT NULL DEFAULT false,
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '18:00',
    break_start TIME,  -- optional lunch/rest break
    break_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_org ON business_hours(organization_id);

-- ── 2. Blocked Dates (holidays, vacations, special closures) ─
CREATE TABLE IF NOT EXISTS blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    blocked_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_org ON blocked_dates(organization_id, blocked_date);

-- ── 3. Appointments ──────────────────────────────────────────
CREATE TYPE appointment_status AS ENUM (
    'confirmed',
    'cancelled',
    'completed',
    'no_show',
    'rescheduled'
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,

    status appointment_status NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    cancellation_reason TEXT,
    rescheduled_from_id UUID REFERENCES appointments(id),

    -- Notification tracking
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON appointments(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(organization_id, status);

-- Partial index for the reminder cron job
CREATE INDEX IF NOT EXISTS idx_appointments_reminder
    ON appointments(status, reminder_sent_at, start_time)
    WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

-- Anti double-booking: database-level exclusion constraint
-- Prevents two 'confirmed' appointments from overlapping in the same org
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
    organization_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status = 'confirmed');

-- ── 4. Row Level Security ─────────────────────────────────────

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_access_business_hours" ON business_hours
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_access_blocked_dates" ON blocked_dates
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_access_appointments" ON appointments
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- ── 5. Auto-update updated_at trigger ─────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_business_hours_updated_at
    BEFORE UPDATE ON business_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

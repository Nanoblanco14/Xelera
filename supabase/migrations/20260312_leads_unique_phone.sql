-- ============================================================
-- Prevent duplicate leads per organization + phone
-- ============================================================
-- This adds a UNIQUE constraint so that the same phone number
-- cannot appear twice within the same organization.
-- Empty/null phones are excluded (manual leads without phone).

-- Step 1: Clean up any existing duplicates BEFORE adding constraint.
-- Keep the oldest lead (earliest created_at) for each org+phone pair.
-- Transfer messages and appointments from duplicates to the survivor.
DO $$
DECLARE
    dup RECORD;
    survivor_id UUID;
BEGIN
    FOR dup IN
        SELECT organization_id, phone, array_agg(id ORDER BY created_at ASC) AS ids
        FROM leads
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY organization_id, phone
        HAVING count(*) > 1
    LOOP
        survivor_id := dup.ids[1]; -- oldest lead

        -- Move messages from duplicates to survivor
        UPDATE lead_messages
        SET lead_id = survivor_id
        WHERE lead_id = ANY(dup.ids[2:]);

        -- Move appointments from duplicates to survivor (if table exists)
        BEGIN
            UPDATE appointments
            SET lead_id = survivor_id
            WHERE lead_id = ANY(dup.ids[2:]);
        EXCEPTION WHEN undefined_table THEN
            NULL; -- appointments table might not exist
        END;

        -- Move stage history from duplicates to survivor
        BEGIN
            UPDATE lead_stage_history
            SET lead_id = survivor_id
            WHERE lead_id = ANY(dup.ids[2:]);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- Move template send logs
        BEGIN
            UPDATE template_send_log
            SET lead_id = survivor_id
            WHERE lead_id = ANY(dup.ids[2:]);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- Delete the duplicate leads (keeping the survivor)
        DELETE FROM leads
        WHERE id = ANY(dup.ids[2:]);

        RAISE NOTICE 'Merged % duplicate leads for org % phone %',
            array_length(dup.ids, 1) - 1, dup.organization_id, dup.phone;
    END LOOP;
END $$;

-- Step 2: Add unique partial index (excludes empty phones)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_phone_unique
    ON leads (organization_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

-- Step 3: Add a regular index for fast phone lookups (used in webhook)
CREATE INDEX IF NOT EXISTS idx_leads_org_phone_lookup
    ON leads (organization_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

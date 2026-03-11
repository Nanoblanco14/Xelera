-- ============================================================
-- PIPELINE STATE MACHINE: Reglas de Transición + Historial
-- Mejora incremental - NO modifica tablas existentes
-- ============================================================

-- 1. TABLA: Reglas de transición válidas entre etapas
-- Define qué movimientos están permitidos en el pipeline
CREATE TABLE IF NOT EXISTS pipeline_stage_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    is_ai_allowed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Evitar reglas duplicadas
    UNIQUE(organization_id, from_stage_id, to_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_rules_org ON pipeline_stage_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_stage_rules_from ON pipeline_stage_rules(from_stage_id);

-- RLS
ALTER TABLE pipeline_stage_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_access_stage_rules" ON pipeline_stage_rules
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- 2. TABLA: Historial de cambios de etapa (audit log)
-- Registra cada movimiento de un lead entre etapas
CREATE TABLE IF NOT EXISTS lead_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    changed_by TEXT NOT NULL DEFAULT 'ai',  -- 'ai', 'human', 'system'
    reason TEXT DEFAULT '',                  -- Motivo del cambio
    metadata JSONB DEFAULT '{}',            -- Datos extra (estado_filtro, etc)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_lead ON lead_stage_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_history_org ON lead_stage_history(organization_id);

-- RLS
ALTER TABLE lead_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_access_stage_history" ON lead_stage_history
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- 3. FUNCIÓN: Generar reglas por defecto para una organización
-- Crea transiciones lineales (Nuevo→Interesado→Visita→Cierre) + saltos a Descartado
CREATE OR REPLACE FUNCTION generate_default_stage_rules(org_id UUID)
RETURNS void AS $$
DECLARE
    stages RECORD;
    prev_stage_id UUID := NULL;
    descartado_id UUID := NULL;
    stage_ids UUID[];
    i INT;
    j INT;
BEGIN
    -- Obtener todas las etapas ordenadas por posición
    FOR stages IN
        SELECT id, name, position
        FROM pipeline_stages
        WHERE organization_id = org_id
        ORDER BY position ASC
    LOOP
        -- Guardar IDs en array
        stage_ids := array_append(stage_ids, stages.id);

        -- Detectar etapa "Descartado" (por nombre parcial)
        IF LOWER(stages.name) LIKE '%descart%' OR LOWER(stages.name) LIKE '%perdid%' OR LOWER(stages.name) LIKE '%cancel%' THEN
            descartado_id := stages.id;
        END IF;

        -- Transición lineal: etapa anterior → etapa actual
        IF prev_stage_id IS NOT NULL THEN
            INSERT INTO pipeline_stage_rules (organization_id, from_stage_id, to_stage_id, is_ai_allowed)
            VALUES (org_id, prev_stage_id, stages.id, true)
            ON CONFLICT (organization_id, from_stage_id, to_stage_id) DO NOTHING;
        END IF;

        prev_stage_id := stages.id;
    END LOOP;

    -- Permitir que cualquier etapa pueda ir a "Descartado" (si existe)
    IF descartado_id IS NOT NULL AND stage_ids IS NOT NULL THEN
        FOR i IN 1..array_length(stage_ids, 1) LOOP
            IF stage_ids[i] != descartado_id THEN
                INSERT INTO pipeline_stage_rules (organization_id, from_stage_id, to_stage_id, is_ai_allowed)
                VALUES (org_id, stage_ids[i], descartado_id, true)
                ON CONFLICT (organization_id, from_stage_id, to_stage_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- Permitir retroceso: cualquier etapa puede volver a la anterior (útil para re-engagement)
    IF stage_ids IS NOT NULL AND array_length(stage_ids, 1) > 1 THEN
        FOR i IN 2..array_length(stage_ids, 1) LOOP
            IF stage_ids[i] != descartado_id THEN
                INSERT INTO pipeline_stage_rules (organization_id, from_stage_id, to_stage_id, is_ai_allowed)
                VALUES (org_id, stage_ids[i], stage_ids[i-1], false) -- Solo humanos pueden retroceder
                ON CONFLICT (organization_id, from_stage_id, to_stage_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCIÓN: Validar si una transición es permitida
CREATE OR REPLACE FUNCTION validate_stage_transition(
    p_org_id UUID,
    p_from_stage_id UUID,
    p_to_stage_id UUID,
    p_changed_by TEXT DEFAULT 'ai'
)
RETURNS TABLE(is_valid BOOLEAN, message TEXT) AS $$
BEGIN
    -- Misma etapa = no necesita transición
    IF p_from_stage_id = p_to_stage_id THEN
        RETURN QUERY SELECT true, 'Sin cambio de etapa'::TEXT;
        RETURN;
    END IF;

    -- Buscar si existe la regla
    IF EXISTS (
        SELECT 1 FROM pipeline_stage_rules
        WHERE organization_id = p_org_id
        AND from_stage_id = p_from_stage_id
        AND to_stage_id = p_to_stage_id
        AND (p_changed_by != 'ai' OR is_ai_allowed = true)
    ) THEN
        RETURN QUERY SELECT true, 'Transición válida'::TEXT;
    ELSE
        -- Si no hay reglas configuradas para esta org, permitir (backwards compatible)
        IF NOT EXISTS (
            SELECT 1 FROM pipeline_stage_rules WHERE organization_id = p_org_id
        ) THEN
            RETURN QUERY SELECT true, 'Sin reglas configuradas - transición permitida por defecto'::TEXT;
        ELSE
            RETURN QUERY SELECT false, 'Transición no permitida'::TEXT;
        END IF;
    END IF;
    RETURN;
END;
$$ LANGUAGE plpgsql;

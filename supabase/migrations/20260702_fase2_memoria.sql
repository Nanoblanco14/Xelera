-- ═══════════════════════════════════════════════════════════════
--  FASE 2 — Inteligencia: Memoria de 3 capas + RAG unificado
--
--  Capa corta  : últimos 15 mensajes (ya existe, lead_messages)
--  Capa media  : resumen progresivo por lead (columnas en leads)
--  Capa larga  : hechos persistentes por lead (lead_memories)
--  RAG         : knowledge_chunks (FAQs + conocimiento scrapeado)
--
--  Prerrequisito: CREATE EXTENSION IF NOT EXISTS vector;
--  Ejecutar completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. CAPA MEDIA — resumen progresivo de conversación
--    Se actualiza cada ~10 mensajes: condensa lo que quedó fuera
--    de la ventana de 15 mensajes para que las conversaciones
--    largas no pierdan el inicio.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
    ADD COLUMN IF NOT EXISTS summary_message_count INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 2. CAPA LARGA — hechos persistentes por lead
--    "presupuesto 3.000 UF", "prefiere Ñuñoa", "tiene perro".
--    Sobreviven entre sesiones: el lead que vuelve a los 2 meses
--    es recordado.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    fact            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'general'
                    CHECK (category IN ('personal','presupuesto','preferencia','contexto','general')),
    source          TEXT NOT NULL DEFAULT 'ai',   -- 'ai' | 'crm_tool' | 'human'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_memories_lead
    ON lead_memories(lead_id, created_at DESC);

-- Evita hechos duplicados exactos por lead
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_memories_unique_fact
    ON lead_memories(lead_id, fact);

ALTER TABLE lead_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage lead_memories"
    ON lead_memories FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- ─────────────────────────────────────────────────────────────
-- 3. RAG UNIFICADO — knowledge_chunks
--    FAQs y conocimiento scrapeado en chunks con embeddings.
--    Antes iban ENTEROS al prompt en cada mensaje (hasta 12k
--    caracteres); ahora solo los fragmentos relevantes al turno.
--    (Los productos mantienen su match_products existente.)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL CHECK (source_type IN ('faq','scraped')),
    source_ref      TEXT,                 -- id de la FAQ / marcador de la fuente
    content         TEXT NOT NULL,
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org
    ON knowledge_chunks(organization_id, source_type);

-- Índice vectorial (HNSW: buen recall sin tuning, ideal para
-- volúmenes por-org pequeños/medianos)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read knowledge_chunks"
    ON knowledge_chunks FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM org_members WHERE user_id = auth.uid()
    ));

-- ─────────────────────────────────────────────────────────────
-- 4. RPC match_knowledge — espejo de match_products
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(1536),
    match_org_id    UUID,
    match_threshold FLOAT DEFAULT 0.25,
    match_count     INT DEFAULT 6
)
RETURNS TABLE (
    id          UUID,
    source_type TEXT,
    content     TEXT,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.source_type,
        k.content,
        1 - (k.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks k
    WHERE k.organization_id = match_org_id
        AND k.embedding IS NOT NULL
        AND 1 - (k.embedding <=> query_embedding) > match_threshold
    ORDER BY k.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

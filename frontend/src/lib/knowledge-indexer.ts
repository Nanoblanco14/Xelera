// ═══════════════════════════════════════════════════════════════
//  📚 KNOWLEDGE INDEXER — RAG unificado sobre knowledge_chunks
//
//  Antes: FAQs + scraped_context iban ENTEROS al prompt en cada
//  mensaje (hasta 12k caracteres fijos). Ahora se trocean, se
//  embeben una sola vez al guardarlos, y en cada turno solo se
//  inyectan los fragmentos relevantes vía match_knowledge.
//
//  (Los productos mantienen su pipeline existente: products.embedding
//  + match_products.)
//
//  Reindexación: se dispara fire-and-forget al guardar FAQs o
//  conocimiento scrapeado. Degrada sin romper si la tabla no
//  existe: el procesador cae al modo legacy (inyección completa).
// ═══════════════════════════════════════════════════════════════

import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAiUsage } from "@/lib/ai-usage";
import { captureError } from "@/lib/monitoring";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_TARGET_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 120;

export interface KnowledgeChunkRow {
    source_type: "faq" | "scraped";
    source_ref: string | null;
    content: string;
}

export interface RetrievedChunk {
    source_type: string;
    content: string;
    similarity: number;
}

// ═══════════════════════════════════════════════════════════════
//  CHUNKING
// ═══════════════════════════════════════════════════════════════

interface FaqItem {
    id?: string;
    question: string;
    answer: string;
}

/** Una FAQ = un chunk (unidad semántica natural). */
export function chunkFaqs(faqs: FaqItem[]): KnowledgeChunkRow[] {
    return (faqs || [])
        .filter((f) => f?.question?.trim() && f?.answer?.trim())
        .map((f) => ({
            source_type: "faq" as const,
            source_ref: f.id || null,
            content: `P: ${f.question.trim()}\nR: ${f.answer.trim()}`,
        }));
}

/**
 * Texto libre (scraping) → chunks de ~900 caracteres cortados en
 * límites de párrafo, con solapamiento para no perder contexto.
 */
export function chunkFreeText(text: string): KnowledgeChunkRow[] {
    const clean = (text || "").trim();
    if (!clean) return [];

    const paragraphs = clean
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
        if (current && current.length + para.length + 2 > CHUNK_TARGET_CHARS) {
            chunks.push(current);
            // Solapamiento: arrastra la cola del chunk anterior
            current = current.slice(-CHUNK_OVERLAP_CHARS) + "\n\n" + para;
        } else {
            current = current ? `${current}\n\n${para}` : para;
        }
        // Párrafos gigantes: cortar duro
        while (current.length > CHUNK_TARGET_CHARS * 1.5) {
            chunks.push(current.slice(0, CHUNK_TARGET_CHARS));
            current = current.slice(CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS);
        }
    }
    if (current.trim()) chunks.push(current);

    return chunks.map((c, i) => ({
        source_type: "scraped" as const,
        source_ref: `chunk_${i}`,
        content: c,
    }));
}

// ═══════════════════════════════════════════════════════════════
//  REINDEXACIÓN (escritura)
// ═══════════════════════════════════════════════════════════════

/**
 * Reconstruye el índice de conocimiento de una org: FAQs actuales
 * + scraped_context del agente. Borra e inserta (el volumen por
 * org es pequeño; la simplicidad gana). Fire-and-forget.
 */
export async function reindexOrgKnowledge(orgId: string): Promise<void> {
    try {
        const db = getSupabaseAdmin();

        // ── Cargar fuentes + API key del tenant ──
        const [{ data: org }, { data: agent }] = await Promise.all([
            db.from("organizations")
                .select("openai_api_key, settings")
                .eq("id", orgId)
                .single(),
            db.from("agents")
                .select("scraped_context")
                .eq("organization_id", orgId)
                .limit(1)
                .maybeSingle(),
        ]);

        if (!org?.openai_api_key) {
            console.warn(`[Knowledge] Org ${orgId} sin API key — reindexación omitida`);
            return;
        }

        const settings = (org.settings || {}) as Record<string, unknown>;
        const faqs = (settings.faqs || []) as FaqItem[];
        const scraped = (agent?.scraped_context as string) || "";

        const rows: KnowledgeChunkRow[] = [
            ...chunkFaqs(faqs),
            ...chunkFreeText(scraped),
        ];

        // ── Verificar que la tabla exista antes de embeber (ahorro) ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: probeError } = await (db as any)
            .from("knowledge_chunks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", orgId)
            .limit(1);

        if (probeError?.code === "42P01") {
            console.warn(
                "[Knowledge] Tabla knowledge_chunks no existe — ejecuta la migración 20260702_fase2_memoria.sql"
            );
            return;
        }

        // ── Borrar índice anterior de la org ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
            .from("knowledge_chunks")
            .delete()
            .eq("organization_id", orgId);

        if (rows.length === 0) {
            console.log(`📚 [Knowledge] Org ${orgId}: sin contenido — índice vaciado`);
            return;
        }

        // ── Embeber en batch (una sola llamada) ──
        const openai = new OpenAI({ apiKey: org.openai_api_key });
        const embRes = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: rows.map((r) => r.content.slice(0, 4000)),
        });

        void logAiUsage({
            orgId,
            model: EMBEDDING_MODEL,
            purpose: "embedding",
            promptTokens: embRes.usage?.prompt_tokens,
            totalTokens: embRes.usage?.total_tokens,
        });

        // ── Insertar chunks con sus vectores ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (db as any).from("knowledge_chunks").insert(
            rows.map((r, i) => ({
                organization_id: orgId,
                source_type: r.source_type,
                source_ref: r.source_ref,
                content: r.content,
                embedding: JSON.stringify(embRes.data[i].embedding),
            }))
        );

        if (insertError) {
            captureError(insertError, "knowledge:index", { orgId });
            return;
        }

        console.log(
            `📚 [Knowledge] Org ${orgId}: ${rows.length} chunks indexados ` +
            `(${rows.filter(r => r.source_type === "faq").length} FAQ, ` +
            `${rows.filter(r => r.source_type === "scraped").length} scraped)`
        );
    } catch (err) {
        captureError(err, "knowledge:reindex", { orgId });
    }
}

// ═══════════════════════════════════════════════════════════════
//  RETRIEVAL (lectura en cada turno)
// ═══════════════════════════════════════════════════════════════

/** ¿La org tiene índice? (decide RAG vs. inyección legacy) */
export async function orgHasKnowledgeIndex(orgId: string): Promise<boolean> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (db as any)
            .from("knowledge_chunks")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId);

        if (error) return false; // tabla inexistente u otro error → legacy
        return (count || 0) > 0;
    } catch {
        return false;
    }
}

/**
 * Recupera los fragmentos relevantes para el turno actual.
 * Devuelve null si no hay índice/RPC (→ el caller usa modo legacy).
 */
export async function retrieveKnowledge(
    orgId: string,
    queryEmbedding: number[],
    matchCount = 6
): Promise<RetrievedChunk[] | null> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (db as any).rpc("match_knowledge", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_org_id: orgId,
            match_threshold: 0.25,
            match_count: matchCount,
        });

        if (error) {
            // RPC inexistente → legacy sin ruido
            if (!/match_knowledge/.test(error.message || "")) {
                captureError(error, "knowledge:retrieve", { orgId });
            }
            return null;
        }
        return (data || []) as RetrievedChunk[];
    } catch {
        return null;
    }
}

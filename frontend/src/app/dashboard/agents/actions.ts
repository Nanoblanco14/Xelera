"use server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authorizeAction } from "@/lib/api-auth";
import { reindexOrgKnowledge } from "@/lib/knowledge-indexer";

// Allow up to 60 s of execution time for this Server Action route


const JINA_TIMEOUT_MS = 45_000;          // 45 s — páginas pesadas necesitan tiempo
const MAX_CHARS_PER_URL = 6_000;
const MAX_TOTAL_CHARS = 12_000;

/**
 * Fetches one URL via Jina AI reader (https://r.jina.ai/<url>)
 * which returns clean Markdown — no nav, footer, scripts, ads.
 */
async function fetchViaJina(url: string): Promise<{ ok: boolean; text?: string; error?: string }> {
    try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        const res = await fetch(jinaUrl, {
            headers: {
                "Accept": "text/plain, text/markdown",
                "User-Agent": "KnowledgeBot/2.0",
                // Jina respects X-Return-Format: markdown (optional, already default)
                "X-Return-Format": "markdown",
            },
            signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
        });

        if (!res.ok) {
            return {
                ok: false,
                error: `No se pudo acceder a ${url} (código HTTP ${res.status}). Verifica que la URL sea pública y correcta.`,
            };
        }

        let text = await res.text();

        // Trim Jina metadata header (first line is usually "URL: …")
        text = text.replace(/^(URL|Title|Source):[^\n]*\n/gim, "").trim();

        if (text.length < 50) {
            return {
                ok: false,
                error: `No se encontró contenido útil en ${url}. La página puede estar protegida o ser dinámica (JavaScript-only).`,
            };
        }

        // Per-URL cap — keeps individual pages from dwarfing others
        if (text.length > MAX_CHARS_PER_URL) {
            text = text.slice(0, MAX_CHARS_PER_URL) + "\n\n[...contenido truncado...]";
        }

        return { ok: true, text };
    } catch (rawErr) {
        const err = rawErr as { name?: string; message?: string } | null;
        const isTimeout =
            err?.name === "TimeoutError" ||
            err?.name === "AbortError" ||
            (err?.message ?? "").toLowerCase().includes("timeout") ||
            (err?.message ?? "").toLowerCase().includes("aborted");

        if (isTimeout) {
            return {
                ok: false,
                error: `⏱️ ${url} tardó demasiado en responder (más de 45 s). Tip: copia y pega el contenido manualmente en el cuadro de revisión.`,
            };
        }

        return {
            ok: false,
            error: `Error al acceder a ${url}: ${err?.message ?? "error desconocido"}. Si el problema persiste, pega el contenido manualmente.`,
        };
    }
}

/**
 * Scrapes multiple URLs via Jina AI and returns the combined Markdown
 * text for user review. Does NOT write to the database.
 */
export async function scrapeUrlsForPreview(
    urls: string[]
): Promise<{ ok: boolean; text?: string; errors?: string[] }> {
    const authz = await authorizeAction();
    if (!authz.ok) return { ok: false, errors: [authz.error] };

    const validUrls = urls.map((u) => u.trim()).filter(Boolean);

    if (validUrls.length === 0) {
        return { ok: false, errors: ["Debes ingresar al menos una URL."] };
    }

    const results = await Promise.allSettled(validUrls.map(fetchViaJina));

    const sections: string[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
        const url = validUrls[i];
        if (result.status === "fulfilled" && result.value.ok && result.value.text) {
            sections.push(`## Fuente: ${url}\n\n${result.value.text}`);
        } else {
            const errMsg =
                result.status === "rejected"
                    ? result.reason?.message
                    : result.value.error;
            errors.push(`⚠️ ${url}: ${errMsg}`);
            sections.push(`## Fuente: ${url}\n\n_No se pudo extraer contenido de esta URL._`);
        }
    });

    let combined = sections.join("\n\n---\n\n");

    // Global cap
    if (combined.length > MAX_TOTAL_CHARS) {
        combined = combined.slice(0, MAX_TOTAL_CHARS) + "\n\n[...contexto total truncado a 12 000 caracteres...]";
    }

    if (!combined.trim()) {
        return { ok: false, errors: errors.length ? errors : ["No se extrajo ningún contenido."] };
    }

    return { ok: true, text: combined, errors: errors.length ? errors : undefined };
}

/**
 * Persists the (possibly user-edited) text to agents.scraped_context.
 * Called only after the user reviews and approves the content.
 */
export async function saveScrapedContext(
    agentId: string,
    text: string
): Promise<{ ok: boolean; error?: string }> {
    if (!agentId || !text?.trim()) {
        return { ok: false, error: "Faltan parámetros." };
    }

    const authz = await authorizeAction();
    if (!authz.ok) return { ok: false, error: authz.error };

    const db = getSupabaseAdmin();

    // The agent must belong to the caller's organization
    const { data: agent } = await db
        .from("agents")
        .select("organization_id")
        .eq("id", agentId)
        .single();

    if (!agent || agent.organization_id !== authz.auth.orgId) {
        return { ok: false, error: "No tienes acceso a este agente." };
    }

    const { error: dbErr } = await db
        .from("agents")
        .update({ scraped_context: text.trim() })
        .eq("id", agentId);

    if (dbErr) {
        return { ok: false, error: `Error al guardar: ${dbErr.message}` };
    }

    // 📚 Fase 2: reconstruir el índice RAG con el nuevo contenido
    // (fire-and-forget — el guardado ya está confirmado)
    reindexOrgKnowledge(authz.auth.orgId).catch(() => { /* no bloquear */ });

    return { ok: true };
}

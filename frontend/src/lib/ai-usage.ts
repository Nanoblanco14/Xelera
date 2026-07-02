// ═══════════════════════════════════════════════════════════════
//  📊 AI USAGE TELEMETRY — costo de OpenAI por tenant
//
//  Registra los tokens de cada completion/embedding. Base para:
//  auditoría de margen, detección de abuso y billing por uso.
//  Degrada sin romper si la tabla aún no existe (migración pendiente).
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";

export type AiUsagePurpose =
    | "chat"
    | "chat_followup"
    | "embedding"
    | "test_chat"
    | "other";

export interface AiUsageEntry {
    orgId: string;
    leadId?: string | null;
    model: string;
    purpose: AiUsagePurpose;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}

let tableMissingWarned = false;

/**
 * Registra el consumo de una llamada a OpenAI. Fire-and-forget:
 * nunca lanza — la telemetría jamás debe romper el flujo del bot.
 */
export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any).from("ai_usage_log").insert({
            organization_id: entry.orgId,
            lead_id: entry.leadId || null,
            model: entry.model,
            purpose: entry.purpose,
            prompt_tokens: entry.promptTokens ?? 0,
            completion_tokens: entry.completionTokens ?? 0,
            total_tokens:
                entry.totalTokens ??
                (entry.promptTokens ?? 0) + (entry.completionTokens ?? 0),
        });

        if (error) {
            if (error.code === "42P01") {
                if (!tableMissingWarned) {
                    tableMissingWarned = true;
                    console.warn(
                        "[AiUsage] Tabla ai_usage_log no existe — ejecuta la migración 20260702_fase0_infra.sql para activar la telemetría de costos."
                    );
                }
            } else {
                console.error("[AiUsage] Insert error:", error.message);
            }
        }
    } catch (err) {
        console.error("[AiUsage] Unexpected error:", err);
    }
}

/**
 * Atajo para registrar directamente el objeto `usage` que devuelve
 * la API de OpenAI en completions y embeddings.
 */
export function logOpenAiCompletionUsage(
    orgId: string,
    leadId: string | null,
    model: string,
    purpose: AiUsagePurpose,
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    } | null
): void {
    if (!usage) return;
    void logAiUsage({
        orgId,
        leadId,
        model,
        purpose,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
    });
}

// ═══════════════════════════════════════════════════════════════
//  📈 ANALYTICS ENGINE — event sourcing ligero + agregación diaria
//
//  trackEvent()            → escribe eventos operativos (fire-and-forget)
//  aggregateDailyMetrics() → job del cron: consolida eventos +
//                            ai_usage_log en daily_org_metrics
//  getPerformanceStats()   → lectura para el dashboard: histórico
//                            desde el agregado + HOY en vivo
//
//  Todo degrada sin romper si las tablas no existen (migración
//  20260702_eje1_analytics.sql pendiente).
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { captureError } from "@/lib/monitoring";

const CHILE_TZ = "America/Santiago";

export type AnalyticsEventType =
    | "message_received"
    | "bot_replied"
    | "handoff"
    | "stage_changed"
    | "appointment_booked"
    | "lead_created";

// ── Precios de referencia OpenAI (USD por millón de tokens) ──
// Solo para el costo ESTIMADO del dashboard; actualizar si cambian.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "text-embedding-3-small": { input: 0.02, output: 0 },
};

export function estimateCostUsd(
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const p = PRICING_PER_MTOK[model] || PRICING_PER_MTOK["gpt-4o-mini"];
    return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}

// ═══════════════════════════════════════════════════════════════
//  ESCRITURA — trackEvent (fire-and-forget)
// ═══════════════════════════════════════════════════════════════

let eventsTableMissingWarned = false;

export async function trackEvent(params: {
    orgId: string;
    leadId?: string | null;
    type: AnalyticsEventType;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any).from("analytics_events").insert({
            organization_id: params.orgId,
            lead_id: params.leadId || null,
            event_type: params.type,
            latency_ms: params.latencyMs ?? null,
            metadata: params.metadata || {},
        });

        if (error) {
            if (error.code === "42P01") {
                if (!eventsTableMissingWarned) {
                    eventsTableMissingWarned = true;
                    console.warn(
                        "[Analytics] Tabla analytics_events no existe — ejecuta la migración 20260702_eje1_analytics.sql"
                    );
                }
            } else {
                console.error("[Analytics] Insert error:", error.message);
            }
        }

        // ⚙️ Rule Engine (reactivo): evalúa reglas del tenant para este
        // evento. Import dinámico (sin ciclos) + fire-and-forget — la
        // analítica y el turno jamás esperan a las automatizaciones.
        import("@/lib/rule-engine")
            .then((m) =>
                m.evaluateEventRules(
                    params.orgId,
                    params.type,
                    params.leadId || null,
                    params.metadata || {}
                )
            )
            .catch(() => { /* no bloquear */ });
    } catch (err) {
        console.error("[Analytics] Unexpected error:", err);
    }
}

// ═══════════════════════════════════════════════════════════════
//  AGREGACIÓN — job del cron (idempotente)
// ═══════════════════════════════════════════════════════════════

function chileDateStr(d: Date): string {
    const inChile = new Date(d.toLocaleString("en-US", { timeZone: CHILE_TZ }));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${inChile.getFullYear()}-${pad(inChile.getMonth() + 1)}-${pad(inChile.getDate())}`;
}

/** Rango UTC [start, end) que cubre un día calendario de Chile. */
function chileDayRangeUtc(dateStr: string): { start: string; end: string } {
    // Chile: UTC-3 (verano) / UTC-4 (invierno). Usamos una ventana
    // generosa y filtramos por fecha-Chile en memoria cuando importa
    // la exactitud; para agregados diarios el desfase es tolerable
    // con offset fijo -4 (peor caso: 1h en el borde, se autocorrige
    // al recalcular el día siguiente).
    const start = new Date(`${dateStr}T00:00:00-04:00`).toISOString();
    const end = new Date(new Date(`${dateStr}T00:00:00-04:00`).getTime() + 24 * 3600 * 1000).toISOString();
    return { start, end };
}

async function aggregateOrgDay(orgId: string, dateStr: string): Promise<void> {
    const db = getSupabaseAdmin();
    const { start, end } = chileDayRangeUtc(dateStr);

    // ── Eventos del día ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error: evErr } = await (db as any)
        .from("analytics_events")
        .select("event_type, latency_ms, lead_id")
        .eq("organization_id", orgId)
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(20000);

    if (evErr) return; // tabla inexistente → nada que agregar

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evts = (events || []) as any[];

    const count = (type: string) => evts.filter((e) => e.event_type === type).length;
    const latencies = evts
        .filter((e) => e.event_type === "bot_replied" && typeof e.latency_ms === "number")
        .map((e) => e.latency_ms as number);
    const avgLatency = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
    const activeConversations = new Set(
        evts.filter((e) => e.event_type === "message_received" && e.lead_id).map((e) => e.lead_id)
    ).size;

    // ── Tokens del día (ai_usage_log) ──
    let promptTokens = 0, completionTokens = 0, totalTokens = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usage } = await (db as any)
        .from("ai_usage_log")
        .select("prompt_tokens, completion_tokens, total_tokens")
        .eq("organization_id", orgId)
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(20000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (usage || []) as any[]) {
        promptTokens += u.prompt_tokens || 0;
        completionTokens += u.completion_tokens || 0;
        totalTokens += u.total_tokens || 0;
    }

    // Día sin actividad alguna → no crear fila vacía
    if (evts.length === 0 && totalTokens === 0) return;

    // ── Upsert idempotente ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (db as any).from("daily_org_metrics").upsert(
        {
            organization_id: orgId,
            metric_date: dateStr,
            messages_received: count("message_received"),
            bot_replies: count("bot_replied"),
            avg_latency_ms: avgLatency,
            active_conversations: activeConversations,
            handoffs: count("handoff"),
            leads_created: count("lead_created"),
            appointments_booked: count("appointment_booked"),
            stage_changes: count("stage_changed"),
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,metric_date" }
    );

    if (upErr && upErr.code !== "42P01") {
        captureError(upErr, "analytics:aggregate", { orgId, dateStr });
    }
}

/**
 * Job del cron: consolida HOY y AYER (Chile) para todas las orgs
 * con actividad. Idempotente — cada corrida recalcula y sobreescribe.
 */
export async function aggregateDailyMetrics(): Promise<number> {
    try {
        const db = getSupabaseAdmin();

        const today = chileDateStr(new Date());
        const yesterday = chileDateStr(new Date(Date.now() - 24 * 3600 * 1000));
        const { start } = chileDayRangeUtc(yesterday);

        // Orgs con actividad en la ventana (eventos o consumo IA)
         
        const [{ data: evOrgs, error: evErr }, { data: aiOrgs }] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db as any).from("analytics_events")
                .select("organization_id")
                .gte("created_at", start)
                .limit(5000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db as any).from("ai_usage_log")
                .select("organization_id")
                .gte("created_at", start)
                .limit(5000),
        ]);

        if (evErr?.code === "42P01") return 0; // migración pendiente

        const orgIds = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (evOrgs || []) as any[]) orgIds.add(r.organization_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (aiOrgs || []) as any[]) orgIds.add(r.organization_id);

        let updated = 0;
        for (const orgId of orgIds) {
            await aggregateOrgDay(orgId, yesterday);
            await aggregateOrgDay(orgId, today);
            updated++;
        }
        return updated;
    } catch (err) {
        captureError(err, "analytics:aggregate_job");
        return 0;
    }
}

// ═══════════════════════════════════════════════════════════════
//  LECTURA — stats para el dashboard
// ═══════════════════════════════════════════════════════════════

export interface DailyMetricRow {
    metric_date: string;
    messages_received: number;
    bot_replies: number;
    avg_latency_ms: number | null;
    active_conversations: number;
    handoffs: number;
    leads_created: number;
    appointments_booked: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
}

export interface PerformanceStats {
    // KPIs del período
    avgResponseSeconds: number | null;
    resolutionRate: number | null;      // % conversaciones sin handoff
    totalConversations: number;
    botReplies: number;
    totalTokens: number;
    estimatedCostUsd: number;
    // Serie diaria para el gráfico (asc por fecha)
    daily: DailyMetricRow[];
    // Disponibilidad de datos (para estados vacíos honestos)
    hasEventData: boolean;
}

/**
 * Histórico desde daily_org_metrics + HOY calculado en vivo desde
 * las tablas crudas (el agregado de hoy puede tener horas de rezago).
 */
export async function getPerformanceStats(
    orgId: string,
    days = 14
): Promise<PerformanceStats> {
    const db = getSupabaseAdmin();
    const today = chileDateStr(new Date());

    // ── 1. Histórico agregado (excluye hoy — se calcula en vivo) ──
    let daily: DailyMetricRow[] = [];
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (db as any)
            .from("daily_org_metrics")
            .select(
                "metric_date, messages_received, bot_replies, avg_latency_ms, " +
                "active_conversations, handoffs, leads_created, appointments_booked, " +
                "total_tokens, prompt_tokens, completion_tokens"
            )
            .eq("organization_id", orgId)
            .lt("metric_date", today)
            .order("metric_date", { ascending: false })
            .limit(days - 1);

        daily = ((data || []) as DailyMetricRow[]).reverse();
    } catch { /* tabla inexistente → solo hoy en vivo */ }

    // ── 2. HOY en vivo ──
    const { start, end } = chileDayRangeUtc(today);

    const [{ data: todayEvents, error: evErr }, { data: todayUsage }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).from("analytics_events")
            .select("event_type, latency_ms, lead_id")
            .eq("organization_id", orgId)
            .gte("created_at", start)
            .lt("created_at", end)
            .limit(10000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).from("ai_usage_log")
            .select("prompt_tokens, completion_tokens, total_tokens")
            .eq("organization_id", orgId)
            .gte("created_at", start)
            .lt("created_at", end)
            .limit(10000),
    ]);

    const hasEventData = !evErr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evts = (todayEvents || []) as any[];
    const countToday = (t: string) => evts.filter((e) => e.event_type === t).length;
    const todayLatencies = evts
        .filter((e) => e.event_type === "bot_replied" && typeof e.latency_ms === "number")
        .map((e) => e.latency_ms as number);

    let tPrompt = 0, tCompletion = 0, tTotal = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (todayUsage || []) as any[]) {
        tPrompt += u.prompt_tokens || 0;
        tCompletion += u.completion_tokens || 0;
        tTotal += u.total_tokens || 0;
    }

    const todayRow: DailyMetricRow = {
        metric_date: today,
        messages_received: countToday("message_received"),
        bot_replies: countToday("bot_replied"),
        avg_latency_ms: todayLatencies.length
            ? Math.round(todayLatencies.reduce((a, b) => a + b, 0) / todayLatencies.length)
            : null,
        active_conversations: new Set(
            evts.filter((e) => e.event_type === "message_received" && e.lead_id).map((e) => e.lead_id)
        ).size,
        handoffs: countToday("handoff"),
        leads_created: countToday("lead_created"),
        appointments_booked: countToday("appointment_booked"),
        total_tokens: tTotal,
        prompt_tokens: tPrompt,
        completion_tokens: tCompletion,
    };

    const series = [...daily, todayRow];

    // ── 3. KPIs del período completo ──
    const sum = (fn: (r: DailyMetricRow) => number) =>
        series.reduce((acc, r) => acc + fn(r), 0);

    const weightedLatencies = series.filter(
        (r) => r.avg_latency_ms !== null && r.bot_replies > 0
    );
    const latencySum = weightedLatencies.reduce(
        (acc, r) => acc + (r.avg_latency_ms as number) * r.bot_replies, 0
    );
    const latencyWeight = weightedLatencies.reduce((acc, r) => acc + r.bot_replies, 0);

    const totalConversations = sum((r) => r.active_conversations);
    const totalHandoffs = sum((r) => r.handoffs);
    const promptTotal = sum((r) => r.prompt_tokens);
    const completionTotal = sum((r) => r.completion_tokens);

    return {
        avgResponseSeconds: latencyWeight
            ? Math.round((latencySum / latencyWeight) / 100) / 10
            : null,
        resolutionRate: totalConversations
            ? Math.round((1 - Math.min(totalHandoffs / totalConversations, 1)) * 100)
            : null,
        totalConversations,
        botReplies: sum((r) => r.bot_replies),
        totalTokens: sum((r) => r.total_tokens),
        estimatedCostUsd:
            Math.round(estimateCostUsd("gpt-4o-mini", promptTotal, completionTotal) * 100) / 100,
        daily: series,
        hasEventData,
    };
}

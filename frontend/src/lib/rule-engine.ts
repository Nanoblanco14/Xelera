// ═══════════════════════════════════════════════════════════════
//  ⚙️ RULE ENGINE — triggers proactivos: evento → condición → acción
//
//  Reactivo : evaluateEventRules() — invocado fire-and-forget desde
//             trackEvent() (import dinámico, sin ciclos)
//  Temporal : runScheduledRules() — Job 9 del cron ('inactive_lead')
//
//  Guardrails heredados: send_template pasa por sendAutoTemplate
//  (quiet hours + daily limit + cooldown anti-spam); send_text por
//  sendWhatsAppMessage. Dedupe propio por (regla, lead, cooldown).
//  Las acciones NUNCA emiten trackEvent (evita recursión de reglas).
//  Una regla rota jamás tumba el turno. Tabla ausente → warn-once.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { captureError } from "@/lib/monitoring";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendAutoTemplate, type AutoTemplateEvent } from "@/lib/auto-templates";
import { notifyOwnerHotLead } from "@/lib/owner-alerts";

// ── Tipos ────────────────────────────────────────────────────

export interface RuleCondition {
    field: string;   // stage_name | chat_status | is_bot_paused | hours_since_last_message | lead_age_days | metadata.*
    op: "eq" | "neq" | "gte" | "lte" | "in" | "contains";
    value: unknown;
}

export interface AutomationRule {
    id: string;
    organization_id: string;
    name: string;
    enabled: boolean;
    trigger_type: "event" | "schedule";
    trigger_event: string;
    conditions: { all: RuleCondition[] };
    action_type: "send_text" | "send_template" | "notify_owner" | "create_notification" | "move_stage";
    action_params: Record<string, unknown>;
    cooldown_hours: number;
}

interface LeadContext {
    id: string;
    name: string;
    phone: string;
    chat_status: string | null;
    is_bot_paused: boolean;
    created_at: string;
    stage_name: string | null;
    hours_since_last_message: number | null;
}

let tableMissingWarned = false;

// ── Carga de reglas ──────────────────────────────────────────

async function loadRules(
    orgId: string,
    triggerType: "event" | "schedule",
    triggerEvent?: string
): Promise<AutomationRule[]> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (db as any)
        .from("automation_rules")
        .select("*")
        .eq("organization_id", orgId)
        .eq("enabled", true)
        .eq("trigger_type", triggerType);
    if (triggerEvent) q = q.eq("trigger_event", triggerEvent);

    const { data, error } = await q;
    if (error) {
        if (error.code === "42P01") {
            if (!tableMissingWarned) {
                tableMissingWarned = true;
                console.warn("[RuleEngine] Tabla automation_rules no existe — ejecuta 20260707_rule_engine.sql");
            }
        } else captureError(error, "rules:load", { orgId });
        return [];
    }
    return (data || []) as AutomationRule[];
}

// ── Contexto del lead ────────────────────────────────────────

async function loadLeadContext(leadId: string): Promise<LeadContext | null> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (db as any)
        .from("leads")
        .select("id, name, phone, chat_status, is_bot_paused, created_at, pipeline_stages(name)")
        .eq("id", leadId)
        .maybeSingle();
    if (!lead) return null;

    const { data: lastMsg } = await db
        .from("lead_messages")
        .select("created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1);

    return {
        id: lead.id,
        name: lead.name || "",
        phone: lead.phone || "",
        chat_status: lead.chat_status,
        is_bot_paused: !!lead.is_bot_paused,
        created_at: lead.created_at,
        stage_name: lead.pipeline_stages?.name ?? null,
        hours_since_last_message: lastMsg?.[0]
            ? (Date.now() - new Date(lastMsg[0].created_at).getTime()) / 3600_000
            : null,
    };
}

// ── Evaluador de condiciones ─────────────────────────────────

function resolveField(
    field: string,
    lead: LeadContext,
    metadata: Record<string, unknown>
): unknown {
    if (field.startsWith("metadata.")) return metadata[field.slice(9)];
    switch (field) {
        case "stage_name": return lead.stage_name;
        case "chat_status": return lead.chat_status;
        case "is_bot_paused": return lead.is_bot_paused;
        case "hours_since_last_message": return lead.hours_since_last_message;
        case "lead_age_days":
            return (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000;
        default: return undefined;
    }
}

function checkCondition(cond: RuleCondition, actual: unknown): boolean {
    switch (cond.op) {
        case "eq": return actual === cond.value;
        case "neq": return actual !== cond.value;
        case "gte": return typeof actual === "number" && actual >= Number(cond.value);
        case "lte": return typeof actual === "number" && actual <= Number(cond.value);
        case "in": return Array.isArray(cond.value) && cond.value.includes(actual);
        case "contains":
            return typeof actual === "string" &&
                actual.toLowerCase().includes(String(cond.value).toLowerCase());
        default: return false;
    }
}

function conditionsPass(
    rule: AutomationRule,
    lead: LeadContext,
    metadata: Record<string, unknown>
): boolean {
    const conds = rule.conditions?.all;
    if (!Array.isArray(conds) || conds.length === 0) return true;
    return conds.every((c) => checkCondition(c, resolveField(c.field, lead, metadata)));
}

// ── Dedupe por cooldown ──────────────────────────────────────

async function ranRecently(rule: AutomationRule, leadId: string | null): Promise<boolean> {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - rule.cooldown_hours * 3600_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (db as any)
        .from("automation_runs")
        .select("id")
        .eq("rule_id", rule.id)
        .gte("executed_at", since)
        .limit(1);
    q = leadId ? q.eq("lead_id", leadId) : q.is("lead_id", null);

    const { data, error } = await q;
    if (error) return true; // fail closed: ante duda, no spamear
    return !!(data && data.length > 0);
}

async function logRun(
    rule: AutomationRule,
    leadId: string | null,
    success: boolean,
    detail?: string
): Promise<void> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("automation_runs").insert({
        rule_id: rule.id,
        organization_id: rule.organization_id,
        lead_id: leadId,
        success,
        detail: detail?.slice(0, 300) || null,
    });
}

// ── Ejecutor de acciones ─────────────────────────────────────

async function executeAction(rule: AutomationRule, lead: LeadContext): Promise<string> {
    const db = getSupabaseAdmin();
    const p = rule.action_params || {};
    const firstName = lead.name && !/^lead/i.test(lead.name) ? lead.name.split(" ")[0] : "";

    switch (rule.action_type) {
        case "send_text": {
            const text = String(p.text || "").replace(/\{nombre\}/g, firstName || "").trim();
            if (!text || !lead.phone) return "sin texto/teléfono";
            const r = await sendWhatsAppMessage(rule.organization_id, lead.phone, text);
            if (r.success) {
                await db.from("lead_messages").insert({
                    lead_id: lead.id, role: "assistant", content: text,
                });
            }
            return r.success ? "texto enviado" : `envío falló: ${r.error}`;
        }

        case "send_template": {
            if (!lead.phone) return "sin teléfono";
            const r = await sendAutoTemplate({
                orgId: rule.organization_id,
                leadId: lead.id,
                phone: lead.phone,
                event: String(p.event || "follow_up_inactive") as AutoTemplateEvent,
                parameters: [firstName],
                fallbackText: p.fallback_text ? String(p.fallback_text) : undefined,
            });
            return r.sent ? `template enviado (${r.method})` : `no enviado: ${r.reason}`;
        }

        case "notify_owner": {
            await notifyOwnerHotLead({
                orgId: rule.organization_id,
                leadName: lead.name,
                leadPhone: lead.phone,
                reason: String(p.reason || `Regla "${rule.name}" activada`),
            });
            return "dueño notificado";
        }

        case "create_notification": {
            await db.from("notifications").insert({
                tenant_id: rule.organization_id,
                lead_id: lead.id,
                type: "automation",
                message: String(p.message || `Regla "${rule.name}" activada para ${lead.name || lead.phone}`)
                    .replace(/\{nombre\}/g, lead.name || lead.phone),
            });
            return "notificación creada";
        }

        case "move_stage": {
            const stageName = String(p.stage_name || "");
            if (!stageName) return "sin stage_name";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: stage } = await (db as any)
                .from("pipeline_stages")
                .select("id")
                .eq("organization_id", rule.organization_id)
                .ilike("name", `%${stageName}%`)
                .limit(1)
                .maybeSingle();
            if (!stage) return `etapa "${stageName}" no existe`;

            await db.from("leads").update({ stage_id: stage.id }).eq("id", lead.id);
            // Historial directo (changed_by system); sin trackEvent
            // para no re-disparar reglas (anti-recursión)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any).from("lead_stage_history").insert({
                lead_id: lead.id,
                organization_id: rule.organization_id,
                from_stage_id: null,
                to_stage_id: stage.id,
                changed_by: "system",
                reason: `Automatización: ${rule.name}`,
            }).catch?.(() => { /* no bloquear */ });
            return `movido a ${stageName}`;
        }

        default: return "acción desconocida";
    }
}

// ── Pipeline común regla→lead ────────────────────────────────

async function runRuleForLead(
    rule: AutomationRule,
    lead: LeadContext,
    metadata: Record<string, unknown>
): Promise<boolean> {
    try {
        if (!conditionsPass(rule, lead, metadata)) return false;
        if (await ranRecently(rule, lead.id)) return false;

        const detail = await executeAction(rule, lead);
        await logRun(rule, lead.id, true, detail);
        console.log(`⚙️ [RuleEngine] "${rule.name}" → lead ${lead.id}: ${detail}`);
        return true;
    } catch (err) {
        captureError(err, "rules:execute", { ruleId: rule.id, leadId: lead.id });
        await logRun(rule, lead.id, false, String(err)).catch(() => { /* no bloquear */ });
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
//  API PÚBLICA
// ═══════════════════════════════════════════════════════════════

/** Reactivo: se invoca fire-and-forget tras cada trackEvent(). */
export async function evaluateEventRules(
    orgId: string,
    eventType: string,
    leadId: string | null,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    try {
        const rules = await loadRules(orgId, "event", eventType);
        if (rules.length === 0 || !leadId) return;

        const lead = await loadLeadContext(leadId);
        if (!lead) return;

        for (const rule of rules) {
            await runRuleForLead(rule, lead, metadata);
        }
    } catch (err) {
        captureError(err, "rules:evaluate_event", { orgId, eventType });
    }
}

/** Temporal (cron Job 9): reglas 'schedule' tipo inactive_lead. */
export async function runScheduledRules(): Promise<number> {
    const db = getSupabaseAdmin();
    let executed = 0;

    try {
        // Orgs con reglas schedule activas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rules, error } = await (db as any)
            .from("automation_rules")
            .select("*")
            .eq("enabled", true)
            .eq("trigger_type", "schedule");

        if (error || !rules?.length) return 0;

        for (const rule of rules as AutomationRule[]) {
            try {
                // Candidatos: leads activos de la org (cap 100, recientes primero)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: leads } = await (db as any)
                    .from("leads")
                    .select("id")
                    .eq("organization_id", rule.organization_id)
                    .eq("is_bot_paused", false)
                    .order("updated_at", { ascending: false })
                    .limit(100);

                let hits = 0;
                for (const row of (leads || []) as Array<{ id: string }>) {
                    if (hits >= 25) break; // cap de ejecuciones por regla/corrida
                    const lead = await loadLeadContext(row.id);
                    if (!lead) continue;
                    if (await runRuleForLead(rule, lead, {})) { hits++; executed++; }
                }
            } catch (err) {
                captureError(err, "rules:scheduled_rule", { ruleId: rule.id });
            }
        }
    } catch (err) {
        captureError(err, "rules:scheduled");
    }
    return executed;
}

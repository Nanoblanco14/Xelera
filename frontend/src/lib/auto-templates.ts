// ═══════════════════════════════════════════════════════════════
//  🤖 AUTO-TEMPLATES ENGINE — Automated WhatsApp Template Sending
//  Anti-spam controls: cooldowns, daily limits, quiet hours,
//  deduplication, and per-event toggles.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { sendTemplateDirect } from "@/lib/send-template-direct";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { checkFeatureAccess } from "@/lib/plan-limits";

// ── Event Types ─────────────────────────────────────────────

export type AutoTemplateEvent =
    | "appointment_confirmed"
    | "appointment_reminder"
    | "appointment_cancelled"
    | "appointment_rescheduled"
    | "stage_interested"
    | "stage_qualified"
    | "stage_handoff"
    | "follow_up_post_visit"
    | "follow_up_inactive"
    | "welcome_new_lead";

// ── Configuration Types ─────────────────────────────────────

export interface AutoTemplateEventConfig {
    enabled: boolean;
    template_name: string;
    cooldown_hours: number;
}

export interface AutoTemplateConfig {
    enabled: boolean;
    events: Partial<Record<AutoTemplateEvent, AutoTemplateEventConfig>>;
    global_daily_limit: number;
    quiet_hours: { start: string; end: string };
}

// ── Event metadata for UI ───────────────────────────────────

export const AUTO_TEMPLATE_EVENT_META: Record<AutoTemplateEvent, {
    label: string;
    description: string;
    category: "appointment" | "stage" | "follow_up" | "welcome";
    defaultCooldown: number;
}> = {
    appointment_confirmed: {
        label: "Cita confirmada",
        description: "Se envia cuando se agenda una nueva cita",
        category: "appointment",
        defaultCooldown: 0.5,
    },
    appointment_reminder: {
        label: "Recordatorio de cita",
        description: "Se envia 24h antes de la cita agendada",
        category: "appointment",
        defaultCooldown: 12,
    },
    appointment_cancelled: {
        label: "Cita cancelada",
        description: "Se envia cuando se cancela una cita",
        category: "appointment",
        defaultCooldown: 0.5,
    },
    appointment_rescheduled: {
        label: "Cita reagendada",
        description: "Se envia cuando se cambia la fecha/hora de una cita",
        category: "appointment",
        defaultCooldown: 0.5,
    },
    stage_interested: {
        label: "Lead interesado",
        description: "Se envia cuando el lead muestra interes activo",
        category: "stage",
        defaultCooldown: 24,
    },
    stage_qualified: {
        label: "Lead calificado",
        description: "Se envia cuando el lead se califica (confirma cita/pedido)",
        category: "stage",
        defaultCooldown: 24,
    },
    stage_handoff: {
        label: "Derivado a humano",
        description: "Se envia cuando el lead requiere atencion humana",
        category: "stage",
        defaultCooldown: 24,
    },
    follow_up_post_visit: {
        label: "Seguimiento post-visita",
        description: "Se envia 48h despues de una cita completada",
        category: "follow_up",
        defaultCooldown: 48,
    },
    follow_up_inactive: {
        label: "Lead inactivo",
        description: "Se envia 7 dias sin actividad (leads interesados/calificados)",
        category: "follow_up",
        defaultCooldown: 168, // 7 days
    },
    welcome_new_lead: {
        label: "Bienvenida nuevo lead",
        description: "Se envia cuando se crea un nuevo lead",
        category: "welcome",
        defaultCooldown: 24,
    },
};

// ── Industry Default Configs ────────────────────────────────

const REAL_ESTATE_DEFAULTS: AutoTemplateConfig = {
    enabled: true,
    events: {
        welcome_new_lead: { enabled: true, template_name: "bienvenida_inmobiliaria", cooldown_hours: 24 },
        appointment_confirmed: { enabled: true, template_name: "agendar_visita", cooldown_hours: 1 },
        appointment_reminder: { enabled: true, template_name: "recordatorio_visita", cooldown_hours: 12 },
        appointment_cancelled: { enabled: true, template_name: "", cooldown_hours: 1 },
        appointment_rescheduled: { enabled: true, template_name: "", cooldown_hours: 1 },
        follow_up_post_visit: { enabled: true, template_name: "seguimiento_visita", cooldown_hours: 48 },
        follow_up_inactive: { enabled: true, template_name: "oferta_exclusiva_propiedad", cooldown_hours: 168 },
        stage_interested: { enabled: false, template_name: "", cooldown_hours: 24 },
        stage_qualified: { enabled: false, template_name: "", cooldown_hours: 24 },
        stage_handoff: { enabled: false, template_name: "", cooldown_hours: 24 },
    },
    global_daily_limit: 3,
    quiet_hours: { start: "22:00", end: "08:00" },
};

const HAIR_SALON_DEFAULTS: AutoTemplateConfig = {
    enabled: true,
    events: {
        welcome_new_lead: { enabled: true, template_name: "bienvenida_salon", cooldown_hours: 24 },
        appointment_confirmed: { enabled: true, template_name: "confirmacion_cita_salon", cooldown_hours: 1 },
        appointment_reminder: { enabled: true, template_name: "recordatorio_cita_salon", cooldown_hours: 12 },
        appointment_cancelled: { enabled: true, template_name: "", cooldown_hours: 1 },
        appointment_rescheduled: { enabled: true, template_name: "", cooldown_hours: 1 },
        follow_up_post_visit: { enabled: true, template_name: "agradecimiento_visita_salon", cooldown_hours: 48 },
        follow_up_inactive: { enabled: true, template_name: "reactivacion_cliente_salon", cooldown_hours: 168 },
        stage_interested: { enabled: false, template_name: "", cooldown_hours: 24 },
        stage_qualified: { enabled: false, template_name: "", cooldown_hours: 24 },
        stage_handoff: { enabled: false, template_name: "", cooldown_hours: 24 },
    },
    global_daily_limit: 3,
    quiet_hours: { start: "22:00", end: "08:00" },
};

const ECOMMERCE_DEFAULTS: AutoTemplateConfig = {
    enabled: true,
    events: {
        welcome_new_lead: { enabled: true, template_name: "bienvenida_tienda", cooldown_hours: 24 },
        appointment_confirmed: { enabled: false, template_name: "", cooldown_hours: 1 },
        appointment_reminder: { enabled: false, template_name: "", cooldown_hours: 12 },
        appointment_cancelled: { enabled: false, template_name: "", cooldown_hours: 1 },
        appointment_rescheduled: { enabled: false, template_name: "", cooldown_hours: 1 },
        stage_qualified: { enabled: true, template_name: "confirmacion_pedido", cooldown_hours: 1 },
        follow_up_post_visit: { enabled: false, template_name: "", cooldown_hours: 48 },
        follow_up_inactive: { enabled: true, template_name: "carrito_abandonado", cooldown_hours: 168 },
        stage_interested: { enabled: false, template_name: "", cooldown_hours: 24 },
        stage_handoff: { enabled: false, template_name: "", cooldown_hours: 24 },
    },
    global_daily_limit: 4,
    quiet_hours: { start: "22:00", end: "08:00" },
};

const BLANK_DEFAULTS: AutoTemplateConfig = {
    enabled: false,
    events: {},
    global_daily_limit: 3,
    quiet_hours: { start: "22:00", end: "08:00" },
};

export function getIndustryDefaults(industry: string): AutoTemplateConfig {
    switch (industry) {
        case "real_estate": return structuredClone(REAL_ESTATE_DEFAULTS);
        case "hair_salon": return structuredClone(HAIR_SALON_DEFAULTS);
        case "ecommerce": return structuredClone(ECOMMERCE_DEFAULTS);
        default: return structuredClone(BLANK_DEFAULTS);
    }
}

// ── Core: Get org auto-template config ──────────────────────

export async function getAutoTemplateConfig(orgId: string): Promise<AutoTemplateConfig | null> {
    const db = getSupabaseAdmin();
    const { data: org } = await db
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

    if (!org) return null;

    const settings = (org.settings || {}) as Record<string, unknown>;

    // If org has auto_templates config, use it
    if (settings.auto_templates) {
        return settings.auto_templates as AutoTemplateConfig;
    }

    // Otherwise, return defaults based on industry
    const industry = (settings.industry_template as string) || "blank";
    return getIndustryDefaults(industry);
}

// ── Anti-Spam Checks ────────────────────────────────────────

const CHILE_TZ = "America/Santiago";
const HARD_DAILY_LIMIT = 5; // absolute max, non-configurable

function isInQuietHours(quietHours: { start: string; end: string }): boolean {
    if (!quietHours.start || !quietHours.end) return false;

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: CHILE_TZ }));
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietHours.start.split(":").map(Number);
    const [endH, endM] = quietHours.end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight ranges (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

async function checkCooldown(
    db: ReturnType<typeof getSupabaseAdmin>,
    leadId: string,
    event: AutoTemplateEvent,
    cooldownHours: number
): Promise<boolean> {
    if (cooldownHours <= 0) return true; // no cooldown

    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("template_send_log")
        .select("id")
        .eq("lead_id", leadId)
        .eq("event", event)
        .eq("success", true)
        .gte("sent_at", since)
        .limit(1);

    if (error) {
        console.error("[AutoTemplate] Cooldown check error:", error);
        return true; // fail open — don't block on DB errors
    }

    return !data || data.length === 0; // true = cooldown passed (no recent sends)
}

async function checkDailyLimit(
    db: ReturnType<typeof getSupabaseAdmin>,
    leadId: string,
    dailyLimit: number
): Promise<boolean> {
    const effectiveLimit = Math.min(dailyLimit, HARD_DAILY_LIMIT);

    // Get today's start in Chile timezone
    const nowChile = new Date(new Date().toLocaleString("en-US", { timeZone: CHILE_TZ }));
    const todayStart = new Date(nowChile.getFullYear(), nowChile.getMonth(), nowChile.getDate());
    // Convert back to UTC for query
    const todayStartUTC = new Date(todayStart.toLocaleString("en-US", { timeZone: "UTC" }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (db as any)
        .from("template_send_log")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("success", true)
        .gte("sent_at", todayStartUTC.toISOString());

    if (error) {
        console.error("[AutoTemplate] Daily limit check error:", error);
        return true; // fail open
    }

    return (count || 0) < effectiveLimit;
}

// ── Log template send ───────────────────────────────────────

async function logTemplateSend(
    db: ReturnType<typeof getSupabaseAdmin>,
    orgId: string,
    leadId: string,
    event: AutoTemplateEvent,
    templateName: string,
    parameters: string[],
    success: boolean,
    error?: string
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from("template_send_log").insert({
            organization_id: orgId,
            lead_id: leadId,
            event,
            template_name: templateName,
            parameters: JSON.stringify(parameters),
            success,
            error: error || null,
        });
    } catch (err) {
        // Non-blocking — don't fail the send if logging fails
        console.error("[AutoTemplate] Log insert error:", err);
    }
}

// ── Main: Send Auto Template ────────────────────────────────

export interface SendAutoTemplateParams {
    orgId: string;
    leadId: string;
    phone: string;
    event: AutoTemplateEvent;
    parameters: string[];
    /** Optional plain-text fallback if template send fails */
    fallbackText?: string;
}

export interface SendAutoTemplateResult {
    sent: boolean;
    method?: "template" | "fallback_text";
    reason?: string;
}

/**
 * Sends a WhatsApp template if all anti-spam checks pass.
 * Falls back to plain text if template isn't available and fallbackText is provided.
 */
export async function sendAutoTemplate(params: SendAutoTemplateParams): Promise<SendAutoTemplateResult> {
    const { orgId, leadId, phone, event, parameters, fallbackText } = params;

    const db = getSupabaseAdmin();

    // 0. Check plan allows auto-templates
    const featureCheck = await checkFeatureAccess(orgId, "auto_templates");
    if (!featureCheck.allowed) {
        if (fallbackText) {
            await sendWhatsAppMessage(orgId, phone, fallbackText);
            return { sent: true, method: "fallback_text", reason: "plan_limit" };
        }
        return { sent: false, reason: "plan_limit" };
    }

    // 1. Get config
    const config = await getAutoTemplateConfig(orgId);
    if (!config || !config.enabled) {
        // Auto-templates disabled — use fallback if available
        if (fallbackText) {
            await sendWhatsAppMessage(orgId, phone, fallbackText);
            return { sent: true, method: "fallback_text", reason: "auto_templates_disabled" };
        }
        return { sent: false, reason: "auto_templates_disabled" };
    }

    // 2. Check event is enabled
    const eventConfig = config.events[event];
    if (!eventConfig || !eventConfig.enabled) {
        if (fallbackText) {
            await sendWhatsAppMessage(orgId, phone, fallbackText);
            return { sent: true, method: "fallback_text", reason: "event_disabled" };
        }
        return { sent: false, reason: "event_disabled" };
    }

    // 3. Check template name is configured
    if (!eventConfig.template_name) {
        if (fallbackText) {
            await sendWhatsAppMessage(orgId, phone, fallbackText);
            return { sent: true, method: "fallback_text", reason: "no_template_configured" };
        }
        return { sent: false, reason: "no_template_configured" };
    }

    // 4. Check quiet hours
    if (isInQuietHours(config.quiet_hours)) {
        return { sent: false, reason: "quiet_hours" };
    }

    // 5. Check cooldown
    const cooldownOk = await checkCooldown(db, leadId, event, eventConfig.cooldown_hours);
    if (!cooldownOk) {
        return { sent: false, reason: "cooldown_active" };
    }

    // 6. Check daily limit
    const limitOk = await checkDailyLimit(db, leadId, config.global_daily_limit);
    if (!limitOk) {
        return { sent: false, reason: "daily_limit_reached" };
    }

    // 7. Send template
    const result = await sendTemplateDirect({
        orgId,
        leadId,
        phone,
        templateName: eventConfig.template_name,
        parameters,
    });

    // 8. Log the attempt
    await logTemplateSend(
        db, orgId, leadId, event,
        eventConfig.template_name, parameters,
        result.success, result.error
    );

    if (result.success) {
        return { sent: true, method: "template" };
    }

    // Template failed — try fallback
    if (fallbackText) {
        await sendWhatsAppMessage(orgId, phone, fallbackText);
        return { sent: true, method: "fallback_text", reason: `template_error: ${result.error}` };
    }

    return { sent: false, reason: `template_error: ${result.error}` };
}

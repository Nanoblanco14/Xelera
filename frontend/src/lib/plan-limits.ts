// ============================================================
// Plan & Tier System — Definitions, Limits, Enforcement
// ============================================================

import { getSupabaseAdmin } from "@/lib/supabase";

// ── Plan types ──────────────────────────────────────────────

// Posicionamiento dual: starter (pymes self-service) y executive
// (high-ticket). pro/business quedan como tiers legacy compatibles.
export type PlanTier = "free" | "starter" | "pro" | "business" | "executive";

export interface PlanLimits {
    max_agents: number;
    max_products: number;
    max_leads: number;
    max_conversations: number;
    max_templates_per_day: number;
    max_team_members: number;
    /** Presupuesto mensual de tokens IA (ai_usage_log) */
    max_ai_tokens_month: number;
    appointment_scheduling: boolean;
    auto_templates: boolean;
    analytics_advanced: boolean;
    custom_branding: boolean;
    priority_support: boolean;
    // ── Flags de segmento (Starter/Executive) ──
    /** Modo Guardián: autonomía alta org-level */
    guardian_mode: boolean;
    /** Resumen nocturno condensado al dueño */
    nightly_digest: boolean;
    /** Reporte de Impacto semanal (ROI) */
    impact_report_weekly: boolean;
    /** Webhooks salientes por-tenant (CRM/Zapier) */
    outbound_webhooks: boolean;
    /** Widgets de ROI (horas ahorradas) en dashboard */
    roi_widgets: boolean;
}

export interface PlanDefinition {
    tier: PlanTier;
    name: string;
    description: string;
    price_monthly: number;    // USD — display only (Stripe handles billing)
    /** Precio display en CLP (segmentos chilenos) */
    price_clp?: number;
    limits: PlanLimits;
}

// ── Plan definitions ────────────────────────────────────────

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
    free: {
        tier: "free",
        name: "Free",
        description: "Para probar la plataforma",
        price_monthly: 0,
        limits: {
            max_agents: 1,
            max_products: 10,
            max_leads: 50,
            max_conversations: 50,
            max_templates_per_day: 5,
            max_team_members: 1,
            max_ai_tokens_month: 200_000,
            appointment_scheduling: true,
            auto_templates: false,
            analytics_advanced: false,
            custom_branding: false,
            priority_support: false,
            guardian_mode: false,
            nightly_digest: true,
            impact_report_weekly: false,
            outbound_webhooks: false,
            roi_widgets: false,
        },
    },
    starter: {
        tier: "starter",
        name: "Starter",
        description: "Tranquilidad 24/7 para tu pyme",
        price_monthly: 25,
        price_clp: 24_990,
        limits: {
            max_agents: 1,
            max_products: 50,
            max_leads: 300,
            max_conversations: 300,
            max_templates_per_day: 20,
            max_team_members: 1,
            max_ai_tokens_month: 1_000_000,
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: false,
            custom_branding: false,
            priority_support: false,
            guardian_mode: true,
            nightly_digest: true,
            impact_report_weekly: false,
            outbound_webhooks: false,
            roi_widgets: false,
        },
    },
    pro: {
        tier: "pro",
        name: "Pro",
        description: "Para negocios en crecimiento",
        price_monthly: 29,
        limits: {
            max_agents: 3,
            max_products: 100,
            max_leads: 500,
            max_conversations: 500,
            max_templates_per_day: 50,
            max_team_members: 5,
            max_ai_tokens_month: 2_000_000,
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: true,
            custom_branding: false,
            priority_support: false,
            guardian_mode: true,
            nightly_digest: true,
            impact_report_weekly: false,
            outbound_webhooks: false,
            roi_widgets: false,
        },
    },
    business: {
        tier: "business",
        name: "Business",
        description: "Para empresas establecidas",
        price_monthly: 79,
        limits: {
            max_agents: 10,
            max_products: 1000,
            max_leads: 5000,
            max_conversations: 5000,
            max_templates_per_day: 200,
            max_team_members: 20,
            max_ai_tokens_month: 10_000_000,
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: true,
            custom_branding: true,
            priority_support: true,
            guardian_mode: true,
            nightly_digest: true,
            impact_report_weekly: true,
            outbound_webhooks: true,
            roi_widgets: true,
        },
    },
    executive: {
        tier: "executive",
        name: "Executive",
        description: "Ahorro de tiempo ejecutivo con ROI medible",
        price_monthly: 200,
        price_clp: 180_000,
        limits: {
            max_agents: 10,
            max_products: 2000,
            max_leads: 10_000,
            max_conversations: 10_000,
            max_templates_per_day: 500,
            max_team_members: 10,
            max_ai_tokens_month: 20_000_000,
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: true,
            custom_branding: true,
            priority_support: true,
            guardian_mode: true,
            nightly_digest: true,
            impact_report_weekly: true,
            outbound_webhooks: true,
            roi_widgets: true,
        },
    },
};

// ── Helpers ─────────────────────────────────────────────────

/** Get the plan definition for a tier (defaults to free) */
export function getPlanDef(tier?: string | null): PlanDefinition {
    if (tier && tier in PLAN_DEFINITIONS) {
        return PLAN_DEFINITIONS[tier as PlanTier];
    }
    return PLAN_DEFINITIONS.free;
}

/** Get limits for a given plan tier */
export function getPlanLimits(tier?: string | null): PlanLimits {
    return getPlanDef(tier).limits;
}

// ── Resource types for limit checking ───────────────────────

export type LimitedResource =
    | "agents"
    | "products"
    | "leads"
    | "conversations"
    | "team_members";

const RESOURCE_TABLE_MAP: Record<LimitedResource, string> = {
    agents: "agents",
    products: "products",
    leads: "leads",
    conversations: "lead_messages",
    team_members: "org_members",
};

const RESOURCE_LIMIT_MAP: Record<LimitedResource, keyof PlanLimits> = {
    agents: "max_agents",
    products: "max_products",
    leads: "max_leads",
    conversations: "max_conversations",
    team_members: "max_team_members",
};

const RESOURCE_LABEL_MAP: Record<LimitedResource, string> = {
    agents: "agentes",
    products: "productos",
    leads: "leads",
    conversations: "conversaciones",
    team_members: "miembros del equipo",
};

// ── Server-side enforcement ─────────────────────────────────

export interface LimitCheckResult {
    allowed: boolean;
    current: number;
    limit: number;
    resource: string;
    plan: PlanTier;
    message?: string;
}

/**
 * Check if an organization can create one more of a resource.
 * Call this BEFORE insert operations in API routes.
 */
export async function checkResourceLimit(
    orgId: string,
    resource: LimitedResource
): Promise<LimitCheckResult> {
    const db = getSupabaseAdmin();

    // 1. Get org plan
    const { data: org } = await db
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .single();

    const plan = (org?.plan as PlanTier) || "free";
    const limits = getPlanLimits(plan);
    const maxKey = RESOURCE_LIMIT_MAP[resource];
    const max = limits[maxKey] as number;

    // 2. Count current resources
    let current = 0;

    if (resource === "conversations") {
        // Conversaciones = leads unicos que tienen al menos 1 mensaje
        const { count, error } = await db
            .rpc("count_org_conversations", { org_id: orgId });
        if (error) {
            // Fallback: contar leads con source = 'whatsapp' (tienen conversacion)
            const { count: fallbackCount } = await db
                .from("leads")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", orgId)
                .eq("source", "whatsapp");
            current = fallbackCount || 0;
        } else {
            current = count || 0;
        }
    } else {
        const table = RESOURCE_TABLE_MAP[resource];
        const { count, error } = await db
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId);

        if (error) {
            console.error(`[PlanLimits] Count error for ${resource}:`, error.message);
            return { allowed: true, current: 0, limit: max, resource, plan };
        }
        current = count || 0;
    }
    const allowed = current < max;

    return {
        allowed,
        current,
        limit: max,
        resource,
        plan,
        message: allowed
            ? undefined
            : `Has alcanzado el limite de ${max} ${RESOURCE_LABEL_MAP[resource]} en tu plan ${PLAN_DEFINITIONS[plan].name}. Actualiza tu plan para continuar.`,
    };
}

/**
 * Check if a feature is enabled for the org's plan.
 */
export async function checkFeatureAccess(
    orgId: string,
    feature: keyof PlanLimits
): Promise<{ allowed: boolean; plan: PlanTier; message?: string }> {
    const db = getSupabaseAdmin();

    const { data: org } = await db
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .single();

    const plan = (org?.plan as PlanTier) || "free";
    const limits = getPlanLimits(plan);
    const allowed = !!limits[feature];

    return {
        allowed,
        plan,
        message: allowed
            ? undefined
            : `La funcion "${feature}" no esta disponible en tu plan ${PLAN_DEFINITIONS[plan].name}. Actualiza tu plan para acceder.`,
    };
}

/**
 * Get full usage stats for an org (for dashboard display).
 */
export async function getOrgUsage(orgId: string): Promise<{
    plan: PlanTier;
    planName: string;
    usage: Record<LimitedResource, { current: number; limit: number; percentage: number }>;
}> {
    const db = getSupabaseAdmin();

    // Get org plan
    const { data: org } = await db
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .single();

    const plan = (org?.plan as PlanTier) || "free";
    const limits = getPlanLimits(plan);

    // Count all resources in parallel
    const resources: LimitedResource[] = [
        "agents", "products", "leads", "conversations", "team_members",
    ];

    const counts = await Promise.all(
        resources.map(async (resource) => {
            if (resource === "conversations") {
                // Contar leads con source='whatsapp' (tienen conversacion activa)
                const { count } = await db
                    .from("leads")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("source", "whatsapp");
                return { resource, count: count || 0 };
            }
            const table = RESOURCE_TABLE_MAP[resource];
            const { count } = await db
                .from(table)
                .select("id", { count: "exact", head: true })
                .eq("organization_id", orgId);
            return { resource, count: count || 0 };
        })
    );

    const usage = {} as Record<LimitedResource, { current: number; limit: number; percentage: number }>;
    for (const { resource, count } of counts) {
        const maxKey = RESOURCE_LIMIT_MAP[resource];
        const limit = limits[maxKey] as number;
        usage[resource] = {
            current: count,
            limit,
            percentage: limit > 0 ? Math.round((count / limit) * 100) : 0,
        };
    }

    return {
        plan,
        planName: PLAN_DEFINITIONS[plan].name,
        usage,
    };
}

// ── AI Budget (Billing) ─────────────────────────────────────

export interface AiBudgetResult {
    allowed: boolean;
    used: number;
    limit: number;
    percentage: number;
    plan: PlanTier;
}

/**
 * ¿La org tiene presupuesto de tokens IA este mes?
 * Cruza ai_usage_log (telemetría) con max_ai_tokens_month del plan.
 * El procesador congela el bot al 100%. Falla abierto: un error de
 * lectura nunca debe silenciar al agente.
 */
export async function checkAiBudget(orgId: string): Promise<AiBudgetResult> {
    const db = getSupabaseAdmin();

    const { data: org } = await db
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .single();

    const plan = (org?.plan as PlanTier) || "free";
    const limit = getPlanLimits(plan).max_ai_tokens_month;

    // Mes calendario actual (UTC es suficiente para presupuestos)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    let used = 0;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (db as any)
            .from("ai_usage_log")
            .select("total_tokens")
            .eq("organization_id", orgId)
            .gte("created_at", monthStart)
            .limit(50000);

        if (error) {
            return { allowed: true, used: 0, limit, percentage: 0, plan }; // fail open
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of (data || []) as any[]) used += row.total_tokens || 0;
    } catch {
        return { allowed: true, used: 0, limit, percentage: 0, plan };
    }

    return {
        allowed: used < limit,
        used,
        limit,
        percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
        plan,
    };
}

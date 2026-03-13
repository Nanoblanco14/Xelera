// ============================================================
// Plan & Tier System — Definitions, Limits, Enforcement
// ============================================================

import { getSupabaseAdmin } from "@/lib/supabase";

// ── Plan types ──────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "business";

export interface PlanLimits {
    max_agents: number;
    max_products: number;
    max_leads: number;
    max_conversations: number;
    max_templates_per_day: number;
    max_team_members: number;
    appointment_scheduling: boolean;
    auto_templates: boolean;
    analytics_advanced: boolean;
    custom_branding: boolean;
    priority_support: boolean;
}

export interface PlanDefinition {
    tier: PlanTier;
    name: string;
    description: string;
    price_monthly: number;    // USD — display only (Stripe handles billing)
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
            appointment_scheduling: true,
            auto_templates: false,
            analytics_advanced: false,
            custom_branding: false,
            priority_support: false,
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
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: true,
            custom_branding: false,
            priority_support: false,
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
            appointment_scheduling: true,
            auto_templates: true,
            analytics_advanced: true,
            custom_branding: true,
            priority_support: true,
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

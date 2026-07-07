// ── /api/automations — CRUD org-scoped de reglas (patrón FAQs) ──
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";

const VALID_TRIGGERS = ["event", "schedule"];
const VALID_ACTIONS = ["send_text", "send_template", "notify_owner", "create_notification", "move_stage"];

// GET /api/automations?org_id=xxx
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("automations:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");
        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (db as any)
            .from("automation_rules")
            .select("*")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: true });

        if (error?.code === "42P01") {
            return NextResponse.json({ data: [], migration_pending: true });
        }
        if (error) throw error;
        return NextResponse.json({ data: data ?? [] });
    } catch (err) {
        return serverError(err, "automations:GET");
    }
}

// PUT /api/automations?org_id=xxx — reemplaza la lista completa
export async function PUT(req: NextRequest) {
    try {
        const result = await authenticateRequest("automations:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");
        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const { rules } = (await req.json()) as { rules: Array<Record<string, unknown>> };
        if (!Array.isArray(rules) || rules.length > 30) {
            return apiError("rules debe ser un array (máx. 30)", 400, "INVALID_BODY");
        }

        // Validación defensiva por regla
        const clean = rules.map((r) => ({
            organization_id: orgId,
            name: String(r.name || "Regla sin nombre").slice(0, 120),
            enabled: r.enabled !== false,
            trigger_type: VALID_TRIGGERS.includes(String(r.trigger_type)) ? r.trigger_type : "event",
            trigger_event: String(r.trigger_event || "stage_changed").slice(0, 60),
            conditions: r.conditions && typeof r.conditions === "object" ? r.conditions : { all: [] },
            action_type: VALID_ACTIONS.includes(String(r.action_type)) ? r.action_type : "create_notification",
            action_params: r.action_params && typeof r.action_params === "object" ? r.action_params : {},
            cooldown_hours: Math.min(Math.max(Number(r.cooldown_hours) || 24, 1), 720),
        }));

        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: delError } = await (db as any)
            .from("automation_rules")
            .delete()
            .eq("organization_id", orgId);

        if (delError?.code === "42P01") {
            return apiError("Ejecuta la migración 20260707_rule_engine.sql primero", 503, "MIGRATION_PENDING");
        }
        if (delError) throw delError;

        if (clean.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insError } = await (db as any)
                .from("automation_rules")
                .insert(clean);
            if (insError) throw insError;
        }

        return NextResponse.json({ data: { saved: clean.length } });
    } catch (err) {
        return serverError(err, "automations:PUT");
    }
}

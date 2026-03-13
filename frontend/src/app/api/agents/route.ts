import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import { checkResourceLimit } from "@/lib/plan-limits";
import type { AgentCreate } from "@/lib/types";

// ── GET /api/agents?org_id=xxx ─────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("agents:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("agents")
            .select("*")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "agents:GET");
    }
}

// ── POST /api/agents ───────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("agents:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body: AgentCreate = await req.json();
        if (!body.organization_id || !body.name) {
            return apiError("organization_id and name required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, body.organization_id);
        if (orgCheck) return orgCheck;

        // ── Plan limit check ──
        const limit = await checkResourceLimit(body.organization_id, "agents");
        if (!limit.allowed) {
            return apiError(limit.message!, 403, "PLAN_LIMIT");
        }

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("agents")
            .insert({
                organization_id: body.organization_id,
                name: body.name,
                system_prompt: body.system_prompt || "",
                personality: body.personality || "professional",
                language: body.language || "es",
                temperature: body.temperature ?? 0.7,
                max_tokens: body.max_tokens ?? 1024,
                welcome_message: body.welcome_message || "¡Hola! ¿En qué puedo ayudarte?",
                whatsapp_config: body.whatsapp_config || {},
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        return serverError(err, "agents:POST");
    }
}

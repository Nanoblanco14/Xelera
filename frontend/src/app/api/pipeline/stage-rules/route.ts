import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";

// ── GET /api/pipeline/stage-rules?org_id=xxx ────────────────
// Fetch all transition rules for an organization
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("stage-rules:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id") || auth.orgId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = getSupabaseAdmin() as any;

        const { data, error } = await db
            .from("pipeline_stage_rules")
            .select("id, from_stage_id, to_stage_id, is_ai_allowed, created_at")
            .eq("organization_id", orgId);

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        return serverError(err, "stage-rules:GET");
    }
}

// ── POST /api/pipeline/stage-rules ──────────────────────────
// Create a new transition rule
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("stage-rules:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { from_stage_id, to_stage_id, is_ai_allowed = true } = body;

        if (!from_stage_id || !to_stage_id) {
            return apiError("from_stage_id y to_stage_id son requeridos", 400, "MISSING_FIELDS");
        }

        if (from_stage_id === to_stage_id) {
            return apiError("No se puede crear una regla a la misma etapa", 400, "SAME_STAGE");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = getSupabaseAdmin() as any;

        const { data, error } = await db
            .from("pipeline_stage_rules")
            .upsert({
                organization_id: auth.orgId,
                from_stage_id,
                to_stage_id,
                is_ai_allowed,
            }, {
                onConflict: "organization_id,from_stage_id,to_stage_id",
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "stage-rules:POST");
    }
}

// ── DELETE /api/pipeline/stage-rules ────────────────────────
// Delete a transition rule by ID
export async function DELETE(req: NextRequest) {
    try {
        const result = await authenticateRequest("stage-rules:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const ruleId = req.nextUrl.searchParams.get("rule_id");
        if (!ruleId) {
            return apiError("rule_id es requerido", 400, "MISSING_RULE_ID");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = getSupabaseAdmin() as any;

        // Verify rule belongs to this org
        const { data: existing } = await db
            .from("pipeline_stage_rules")
            .select("organization_id")
            .eq("id", ruleId)
            .single();

        if (!existing || existing.organization_id !== auth.orgId) {
            return apiError("Regla no encontrada", 404, "NOT_FOUND");
        }

        const { error } = await db
            .from("pipeline_stage_rules")
            .delete()
            .eq("id", ruleId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "stage-rules:DELETE");
    }
}

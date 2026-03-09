import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";

// ── GET /api/pipeline/leads/[id]/history ────────────────────
// Fetch stage change history for a specific lead
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    void req; // consumed by authenticateRequest
    try {
        const result = await authenticateRequest("lead-history:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const db = getSupabaseAdmin();

        // Verify lead belongs to org
        const { data: lead } = await db
            .from("leads")
            .select("organization_id")
            .eq("id", id)
            .single();

        if (!lead || lead.organization_id !== auth.orgId) {
            return apiError("Lead no encontrado", 404, "NOT_FOUND");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbAny = db as any;
        const { data, error } = await dbAny
            .from("lead_stage_history")
            .select("*")
            .eq("lead_id", id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        return serverError(err, "lead-history:GET");
    }
}

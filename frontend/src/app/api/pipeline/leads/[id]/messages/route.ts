import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";

// ── GET /api/pipeline/leads/[id]/messages ─────────────────
// Returns all chat messages for a given lead, ordered ASC
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("messages:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const db = getSupabaseAdmin();

        // Verify the lead belongs to the user's org
        const { data: lead } = await db
            .from("leads")
            .select("organization_id")
            .eq("id", id)
            .single();

        if (!lead || lead.organization_id !== auth.orgId) {
            return apiError("Lead no encontrado", 404, "NOT_FOUND");
        }

        // Incluye los estados de entrega (✓/✓✓); si la migración
        // del outbox no corrió aún, cae al select clásico.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any[] | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let error: any = null;

        ({ data, error } = await db
            .from("lead_messages")
            .select("id, lead_id, role, content, created_at, delivery_status, delivery_error")
            .eq("lead_id", id)
            .order("created_at", { ascending: true }));

        if (error && (error.code === "42703" || /column|schema cache/i.test(error.message || ""))) {
            ({ data, error } = await db
                .from("lead_messages")
                .select("id, lead_id, role, content, created_at")
                .eq("lead_id", id)
                .order("created_at", { ascending: true }));
        }

        if (error) throw error;
        return NextResponse.json({ data: data ?? [] });
    } catch (err) {
        return serverError(err, "messages:GET");
    }
}

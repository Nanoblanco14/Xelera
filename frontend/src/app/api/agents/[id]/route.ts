import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import type { AgentUpdate } from "@/lib/types";

// ── PUT /api/agents/[id] ───────────────────────────────────
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("agents:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const body: AgentUpdate = await req.json();
        const db = getSupabaseAdmin();

        // ── Sanitize: only allow known safe columns ──
        const ALLOWED_FIELDS = [
            'name', 'system_prompt', 'welcome_message', 'model',
            'personality', 'language', 'temperature', 'max_tokens',
            'whatsapp_config', 'booking_url', 'conversation_tone',
            'escalation_rule', 'scraped_context', 'is_active'
        ];

        const safeUpdate: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in (body as Record<string, unknown>)) {
                safeUpdate[key] = (body as Record<string, unknown>)[key];
            }
        }

        if (Object.keys(safeUpdate).length === 0) {
            return apiError("No hay campos válidos para actualizar", 400, "EMPTY_UPDATE");
        }

        safeUpdate.updated_at = new Date().toISOString();

        // Verify the agent belongs to the user's org
        const { data: existing } = await db
            .from("agents")
            .select("organization_id")
            .eq("id", id)
            .single();

        if (!existing || existing.organization_id !== auth.orgId) {
            return apiError("Agente no encontrado", 404, "NOT_FOUND");
        }

        const { data, error } = await db
            .from("agents")
            .update(safeUpdate)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("[agents:PUT] Supabase error:", error);
            return NextResponse.json(
                { error: error.message || "Error al actualizar el agente", code: "DB_ERROR" },
                { status: 500 }
            );
        }

        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "agents:PUT");
    }
}

// ── DELETE /api/agents/[id] ────────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("agents:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const db = getSupabaseAdmin();

        // Verify the agent belongs to the user's org
        const { data: existing } = await db
            .from("agents")
            .select("organization_id")
            .eq("id", id)
            .single();

        if (!existing || existing.organization_id !== auth.orgId) {
            return apiError("Agente no encontrado", 404, "NOT_FOUND");
        }

        const { error } = await db.from("agents").delete().eq("id", id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "agents:DELETE");
    }
}

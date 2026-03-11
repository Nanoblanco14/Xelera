import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// GET /api/leads/[id]/notes?org_id=xxx
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("lead-notes:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id: leadId } = await params;
        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const sb = getSupabaseAdmin();
        const { data, error } = await sb
            .from("lead_notes")
            .select("id, content, author_email, created_at")
            .eq("lead_id", leadId)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "lead-notes:GET");
    }
}

// POST /api/leads/[id]/notes  body: { org_id, content, author_email }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("lead-notes:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id: leadId } = await params;
        const body = await req.json();
        const { org_id, content, author_email } = body;

        if (!org_id || !content?.trim()) {
            return apiError("org_id and content required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, org_id);
        if (orgCheck) return orgCheck;

        const sb = getSupabaseAdmin();
        const { data, error } = await sb
            .from("lead_notes")
            .insert({
                lead_id: leadId,
                organization_id: org_id,
                content: content.trim(),
                author_email: author_email || "",
            })
            .select("id, content, author_email, created_at")
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "lead-notes:POST");
    }
}

// DELETE /api/leads/[id]/notes?note_id=xxx&org_id=xxx
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("lead-notes:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        await params;
        const noteId = req.nextUrl.searchParams.get("note_id");
        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!noteId) return apiError("note_id required", 400, "MISSING_PARAM");

        // If org_id provided, verify access; otherwise use auth.orgId
        if (orgId) {
            const orgCheck = verifyOrgAccess(auth, orgId);
            if (orgCheck) return orgCheck;
        }

        const sb = getSupabaseAdmin();

        // Verify the note belongs to the user's organization before deleting
        const { data: note, error: fetchErr } = await sb
            .from("lead_notes")
            .select("id, organization_id")
            .eq("id", noteId)
            .single();

        if (fetchErr || !note) return apiError("Nota no encontrada", 404, "NOT_FOUND");

        if (note.organization_id !== auth.orgId) {
            return apiError("No tienes permiso para eliminar esta nota", 403, "FORBIDDEN");
        }

        const { error } = await sb
            .from("lead_notes")
            .delete()
            .eq("id", noteId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "lead-notes:DELETE");
    }
}

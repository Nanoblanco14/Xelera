import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/leads/[id]/notes?org_id=xxx
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: leadId } = await params;
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) {
        return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
        .from("lead_notes")
        .select("id, content, author_email, created_at")
        .eq("lead_id", leadId)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

// POST /api/leads/[id]/notes  body: { org_id, content, author_email }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: leadId } = await params;
    const body = await req.json();
    const { org_id, content, author_email } = body;

    if (!org_id || !content?.trim()) {
        return NextResponse.json(
            { error: "org_id and content required" },
            { status: 400 }
        );
    }

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

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

// DELETE /api/leads/[id]/notes?note_id=xxx
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    await params; // consume params
    const noteId = req.nextUrl.searchParams.get("note_id");
    if (!noteId) {
        return NextResponse.json({ error: "note_id required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb
        .from("lead_notes")
        .delete()
        .eq("id", noteId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

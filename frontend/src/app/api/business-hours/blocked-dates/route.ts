import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// ── GET /api/business-hours/blocked-dates?org_id=xxx ────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("blocked-dates:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("blocked_dates")
            .select("*")
            .eq("organization_id", orgId)
            .order("blocked_date", { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "blocked-dates:GET");
    }
}

// ── POST /api/business-hours/blocked-dates ──────────────────
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("blocked-dates:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { organization_id, blocked_date, reason } = body as {
            organization_id: string;
            blocked_date: string;
            reason?: string;
        };

        if (!organization_id || !blocked_date) {
            return apiError("organization_id and blocked_date required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("blocked_dates")
            .insert({
                organization_id,
                blocked_date,
                reason: reason || null,
            })
            .select("*")
            .single();

        if (error) throw error;
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        return serverError(err, "blocked-dates:POST");
    }
}

// ── DELETE /api/business-hours/blocked-dates?id=xxx&org_id=xxx
export async function DELETE(req: NextRequest) {
    try {
        const result = await authenticateRequest("blocked-dates:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const id = req.nextUrl.searchParams.get("id");
        const orgId = req.nextUrl.searchParams.get("org_id");

        if (!id || !orgId) {
            return apiError("id and org_id required", 400, "MISSING_PARAM");
        }

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();

        // Verify the blocked date belongs to this org before deleting
        const { data: existing, error: fetchError } = await db
            .from("blocked_dates")
            .select("id")
            .eq("id", id)
            .eq("organization_id", orgId)
            .single();

        if (fetchError || !existing) {
            return apiError("Fecha bloqueada no encontrada", 404, "NOT_FOUND");
        }

        const { error } = await db
            .from("blocked_dates")
            .delete()
            .eq("id", id)
            .eq("organization_id", orgId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "blocked-dates:DELETE");
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// ── PUT /api/org/settings ───────────────────────────────────
// Updates the `settings` JSONB column on the organizations table.
export async function PUT(req: NextRequest) {
    try {
        const result = await authenticateRequest("org-settings:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { organization_id, settings } = body as {
            organization_id: string;
            settings: Record<string, unknown>;
        };

        if (!organization_id || !settings) {
            return apiError("organization_id and settings required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("organizations")
            .update({ settings })
            .eq("id", organization_id)
            .select("settings")
            .single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "org-settings:PUT");
    }
}

// ── GET /api/org/settings?org_id=xxx ────────────────────────
// Returns the `settings` JSONB from the organizations table.
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("org-settings:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .single();

        if (error) throw error;

        return NextResponse.json({ data: data?.settings || {} });
    } catch (err) {
        return serverError(err, "org-settings:GET");
    }
}

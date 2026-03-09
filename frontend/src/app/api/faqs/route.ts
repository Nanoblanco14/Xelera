import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";

export interface FaqItem {
    id: string;
    question: string;
    answer: string;
}

// ── GET /api/faqs?org_id=xxx ─────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("faqs:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data: org, error } = await db
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .single();

        if (error) throw error;

        const settings = (org?.settings || {}) as Record<string, unknown>;
        const faqs = (settings.faqs || []) as FaqItem[];

        return NextResponse.json({ data: faqs });
    } catch (err) {
        return serverError(err, "faqs:GET");
    }
}

// ── PUT /api/faqs?org_id=xxx ──────────────────────────────
// Replaces the entire FAQ list (simpler than individual CRUD)
export async function PUT(req: NextRequest) {
    try {
        const result = await authenticateRequest("faqs:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const { faqs } = (await req.json()) as { faqs: FaqItem[] };
        if (!Array.isArray(faqs)) {
            return apiError("faqs must be an array", 400, "INVALID_BODY");
        }

        const db = getSupabaseAdmin();

        // Load existing settings to merge
        const { data: org } = await db
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .single();

        const currentSettings = (org?.settings || {}) as Record<string, unknown>;
        const updatedSettings = { ...currentSettings, faqs };

        const { error } = await db
            .from("organizations")
            .update({ settings: updatedSettings })
            .eq("id", orgId);

        if (error) throw error;

        return NextResponse.json({ data: faqs });
    } catch (err) {
        return serverError(err, "faqs:PUT");
    }
}

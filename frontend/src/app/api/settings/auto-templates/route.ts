import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AutoTemplateConfig } from "@/lib/auto-templates";

// ═══════════════════════════════════════════════════════════════
//  POST — Save auto-template configuration to org settings
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("auto-templates:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { orgId, config } = body as { orgId: string; config: AutoTemplateConfig };

        if (!orgId || !config) {
            return apiError("orgId y config son requeridos", 400);
        }

        // Verify user has access to this org
        if (orgId !== auth.orgId) {
            return apiError("No autorizado", 403);
        }

        // Validate limits
        if (config.global_daily_limit > 5) {
            config.global_daily_limit = 5;
        }
        if (config.global_daily_limit < 1) {
            config.global_daily_limit = 1;
        }

        const db = getSupabaseAdmin();

        // Get current org settings
        const { data: org } = await db
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .single();

        if (!org) {
            return apiError("Organizacion no encontrada", 404);
        }

        // Merge auto_templates into existing settings
        const currentSettings = (org.settings || {}) as Record<string, unknown>;
        const updatedSettings = {
            ...currentSettings,
            auto_templates: config,
        };

        const { error: updateError } = await db
            .from("organizations")
            .update({ settings: updatedSettings })
            .eq("id", orgId);

        if (updateError) {
            return apiError(updateError.message, 500);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "auto-templates:POST");
    }
}

// ═══════════════════════════════════════════════════════════════
//  GET — Load auto-template configuration
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("auto-templates:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const db = getSupabaseAdmin();
        const { data: org } = await db
            .from("organizations")
            .select("settings")
            .eq("id", auth.orgId)
            .single();

        if (!org) {
            return apiError("Organizacion no encontrada", 404);
        }

        const settings = (org.settings || {}) as Record<string, unknown>;
        const config = settings.auto_templates || null;

        return NextResponse.json({ config });
    } catch (err) {
        return serverError(err, "auto-templates:GET");
    }
}

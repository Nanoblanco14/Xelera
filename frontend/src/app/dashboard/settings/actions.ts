"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { authorizeAction } from "@/lib/api-auth";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

// ═══════════════════════════════════════════════════════════════
//  Secret masking — API keys and tokens are never sent back to
//  the browser in full. A masked value round-tripped to a save
//  action means "unchanged" and is dropped/merged server-side.
// ═══════════════════════════════════════════════════════════════
const MASK_CHARS = "••••••••";

function maskSecret(secret: string): string {
    if (!secret) return "";
    if (secret.length <= 8) return MASK_CHARS;
    return `${secret.slice(0, 3)}${MASK_CHARS}${secret.slice(-4)}`;
}

function isMasked(value: unknown): boolean {
    return typeof value === "string" && value.includes("••");
}

export interface TenantSettingsPayload {
    orgId: string;
    openai_api_key?: string;
    whatsapp_provider?: "twilio" | "meta";
    whatsapp_credentials?: Record<string, string>;
    system_prompt?: string;
}

/**
 * Updates tenant configuration fields on the organizations table
 * and optionally the agent's system_prompt.
 */
export async function updateTenantSettings(
    payload: TenantSettingsPayload
): Promise<{ success: boolean; error?: string }> {
    const authz = await authorizeAction(payload.orgId);
    if (!authz.ok) return { success: false, error: authz.error };

    const admin = getSupabaseAdmin();

    // Build the org update
    const orgUpdate: Record<string, unknown> = {};
    if (payload.openai_api_key !== undefined && !isMasked(payload.openai_api_key))
        orgUpdate.openai_api_key = payload.openai_api_key;
    if (payload.whatsapp_provider !== undefined)
        orgUpdate.whatsapp_provider = payload.whatsapp_provider;

    if (payload.whatsapp_credentials !== undefined) {
        // Merge: keep the stored value for any credential the client
        // sent back masked (i.e. unchanged).
        const incoming = payload.whatsapp_credentials;
        const hasMaskedValues = Object.values(incoming).some(isMasked);
        if (hasMaskedValues) {
            const { data: currentOrg } = await admin
                .from("organizations")
                .select("whatsapp_credentials")
                .eq("id", payload.orgId)
                .single();
            const stored = (currentOrg?.whatsapp_credentials || {}) as Record<string, string>;
            const merged: Record<string, string> = { ...incoming };
            for (const [key, value] of Object.entries(incoming)) {
                if (isMasked(value)) merged[key] = stored[key] || "";
            }
            orgUpdate.whatsapp_credentials = merged;
        } else {
            orgUpdate.whatsapp_credentials = incoming;
        }
    }

    // Update organizations table if there are changes
    if (Object.keys(orgUpdate).length > 0) {
        const { error: orgError } = await admin
            .from("organizations")
            .update(orgUpdate)
            .eq("id", payload.orgId);

        if (orgError) {
            return { success: false, error: orgError.message };
        }
    }

    // Update agent's system_prompt if provided
    if (payload.system_prompt !== undefined) {
        const { data: agents } = await admin
            .from("agents")
            .select("id")
            .eq("organization_id", payload.orgId)
            .eq("is_active", true)
            .limit(1);

        if (agents && agents.length > 0) {
            const { error: agentError } = await admin
                .from("agents")
                .update({ system_prompt: payload.system_prompt })
                .eq("id", agents[0].id);

            if (agentError) {
                return { success: false, error: agentError.message };
            }
        } else {
            // Create a default agent with the provided prompt
            const { error: createError } = await admin
                .from("agents")
                .insert({
                    organization_id: payload.orgId,
                    name: "Asistente Virtual",
                    system_prompt: payload.system_prompt,
                    is_active: true,
                });

            if (createError) {
                return { success: false, error: createError.message };
            }
        }
    }

    return { success: true };
}

/**
 * Loads the tenant config (org + agent prompt) for the settings form.
 * Secrets (OpenAI key, WhatsApp access token) are returned MASKED.
 */
export async function loadTenantSettings(orgId: string): Promise<{
    openai_api_key: string;
    whatsapp_provider: "twilio" | "meta";
    whatsapp_credentials: Record<string, string>;
    system_prompt: string;
} | null> {
    const authz = await authorizeAction(orgId);
    if (!authz.ok) return null;

    const admin = getSupabaseAdmin();

    const { data: org } = await admin
        .from("organizations")
        .select(
            "openai_api_key, whatsapp_provider, whatsapp_credentials"
        )
        .eq("id", orgId)
        .single();

    if (!org) return null;

    // Get agent prompt
    const { data: agent } = await admin
        .from("agents")
        .select("system_prompt")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .limit(1)
        .single();

    const credentials = { ...(org.whatsapp_credentials || {}) } as Record<string, string>;
    for (const secretKey of ["access_token", "auth_token"]) {
        if (credentials[secretKey]) {
            credentials[secretKey] = maskSecret(credentials[secretKey]);
        }
    }

    return {
        openai_api_key: maskSecret(org.openai_api_key || ""),
        whatsapp_provider: org.whatsapp_provider || "twilio",
        whatsapp_credentials: credentials,
        system_prompt: agent?.system_prompt || "",
    };
}

// ═══════════════════════════════════════════════════════════════
//  🏭 APPLY INDUSTRY TEMPLATE
// ═══════════════════════════════════════════════════════════════
export interface ApplyTemplateResult {
    success: boolean;
    stagesCreated: boolean;
    error?: string;
}

/**
 * Applies an industry template to a tenant:
 *  1. Sets the agent system_prompt (creates agent if missing)
 *  2. Seeds pipeline_stages ONLY if the tenant has none yet
 */
export async function applyIndustryTemplate(
    orgId: string,
    templateId: string
): Promise<ApplyTemplateResult> {
    const authz = await authorizeAction(orgId);
    if (!authz.ok) return { success: false, stagesCreated: false, error: authz.error };

    const template = INDUSTRY_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
        return { success: false, stagesCreated: false, error: "Plantilla no encontrada" };
    }

    const admin = getSupabaseAdmin();

    // ── 1. Update or create the agent's system_prompt ─────────
    const { data: agents } = await admin
        .from("agents")
        .select("id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .limit(1);

    if (agents && agents.length > 0) {
        const { error } = await admin
            .from("agents")
            .update({
                system_prompt: template.systemPrompt,
                name: template.defaultName,
                welcome_message: template.defaultWelcome,
            })
            .eq("id", agents[0].id);
        if (error) return { success: false, stagesCreated: false, error: error.message };
    } else {
        const { error } = await admin
            .from("agents")
            .insert({
                organization_id: orgId,
                name: template.defaultName,
                system_prompt: template.systemPrompt,
                welcome_message: template.defaultWelcome,
                is_active: true,
            });
        if (error) return { success: false, stagesCreated: false, error: error.message };
    }

    // ── 2. Check existing pipeline stages ────────────────────
    const { data: existingStages, error: stagesError } = await admin
        .from("pipeline_stages")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1);

    if (stagesError) {
        // Non-blocking: prompt was already saved successfully
        console.error("Error checking pipeline stages:", stagesError.message);
        return { success: true, stagesCreated: false };
    }

    // If tenant already has stages, don't overwrite them
    if (existingStages && existingStages.length > 0) {
        return { success: true, stagesCreated: false };
    }

    // ── 3. Seed pipeline stages from template ─────────────────
    const stagesToInsert = template.stages.map((s) => ({
        organization_id: orgId,
        name: s.name,
        color: s.color,
        position: s.position,
    }));

    const { error: insertError } = await admin
        .from("pipeline_stages")
        .insert(stagesToInsert);

    if (insertError) {
        console.error("Error inserting pipeline stages:", insertError.message);
        // Prompt was saved OK, just stages failed
        return { success: true, stagesCreated: false, error: insertError.message };
    }

    return { success: true, stagesCreated: true };
}

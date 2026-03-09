"use server";

import { createClient } from "@supabase/supabase-js";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * Marks onboarding as completed in organization settings.
 */
export async function completeOnboarding(
    orgId: string
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdmin();

    // Fetch current settings to merge
    const { data: org } = await admin
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

    const currentSettings = (org?.settings as Record<string, unknown>) || {};

    const { error } = await admin
        .from("organizations")
        .update({
            settings: { ...currentSettings, onboarding_completed: true },
        })
        .eq("id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Saves industry template selection to org settings
 * and applies the template (creates agent + pipeline stages).
 */
export async function applyOnboardingTemplate(
    orgId: string,
    templateId: string
): Promise<{ success: boolean; agentId?: string; error?: string }> {
    const template = INDUSTRY_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { success: false, error: "Plantilla no encontrada" };

    const admin = getAdmin();

    // Save industry_template to org settings
    const { data: org } = await admin
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

    const currentSettings = (org?.settings as Record<string, unknown>) || {};

    await admin
        .from("organizations")
        .update({
            settings: { ...currentSettings, industry_template: templateId },
        })
        .eq("id", orgId);

    // Create or update agent
    const { data: existingAgents } = await admin
        .from("agents")
        .select("id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .limit(1);

    let agentId: string;

    if (existingAgents && existingAgents.length > 0) {
        agentId = existingAgents[0].id;
        const { error } = await admin
            .from("agents")
            .update({
                name: template.defaultName,
                system_prompt: template.systemPrompt,
                welcome_message: template.defaultWelcome,
            })
            .eq("id", agentId);
        if (error) return { success: false, error: error.message };
    } else {
        const { data: newAgent, error } = await admin
            .from("agents")
            .insert({
                organization_id: orgId,
                name: template.defaultName,
                system_prompt: template.systemPrompt,
                welcome_message: template.defaultWelcome,
                is_active: true,
            })
            .select("id")
            .single();
        if (error || !newAgent) return { success: false, error: error?.message || "Error creando agente" };
        agentId = newAgent.id;
    }

    // Seed pipeline stages if none exist
    const { data: existingStages } = await admin
        .from("pipeline_stages")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1);

    if (!existingStages || existingStages.length === 0) {
        await admin.from("pipeline_stages").insert(
            template.stages.map((s) => ({
                organization_id: orgId,
                name: s.name,
                color: s.color,
                position: s.position,
            }))
        );
    }

    return { success: true, agentId };
}

/**
 * Updates agent details during onboarding (name, welcome message, tone).
 */
export async function updateOnboardingAgent(
    agentId: string,
    data: { name?: string; welcome_message?: string; conversation_tone?: string }
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdmin();

    const update: Record<string, unknown> = {};
    if (data.name) update.name = data.name;
    if (data.welcome_message) update.welcome_message = data.welcome_message;
    if (data.conversation_tone) update.conversation_tone = data.conversation_tone;

    const { error } = await admin
        .from("agents")
        .update(update)
        .eq("id", agentId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Saves OpenAI API key to org during onboarding.
 */
export async function saveOnboardingApiKey(
    orgId: string,
    apiKey: string
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdmin();

    const { error } = await admin
        .from("organizations")
        .update({ openai_api_key: apiKey })
        .eq("id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Saves WhatsApp credentials during onboarding.
 */
export async function saveOnboardingWhatsApp(
    orgId: string,
    credentials: { phone_number_id: string; access_token: string }
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdmin();

    const { error } = await admin
        .from("organizations")
        .update({
            whatsapp_provider: "meta",
            whatsapp_credentials: credentials,
        })
        .eq("id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

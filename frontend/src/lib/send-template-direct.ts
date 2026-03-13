// ═══════════════════════════════════════════════════════════════
//  Server-side WhatsApp Template Sender
//  Sends templates directly using org credentials (no user auth)
//  Used by: auto-templates engine, cron jobs, webhook hooks
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";

const META_API = "https://graph.facebook.com/v22.0";

interface SendTemplateResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Send a WhatsApp template message directly using org credentials.
 * This bypasses user authentication — intended for server-side automation only.
 */
export async function sendTemplateDirect(params: {
    orgId: string;
    leadId: string;
    phone: string;
    templateName: string;
    templateLanguage?: string;
    parameters?: string[];
}): Promise<SendTemplateResult> {
    const { orgId, leadId, phone, templateName, templateLanguage = "es", parameters } = params;

    try {
        const db = getSupabaseAdmin();

        // Get org WhatsApp credentials
        const { data: org, error: orgError } = await db
            .from("organizations")
            .select("whatsapp_provider, whatsapp_credentials")
            .eq("id", orgId)
            .single();

        if (orgError || !org) {
            return { success: false, error: "Organizacion no encontrada" };
        }

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        const provider = org.whatsapp_provider as string;

        if (provider !== "meta") {
            return { success: false, error: "Templates solo disponibles con Meta WhatsApp" };
        }

        if (!creds.phone_number_id || !creds.access_token) {
            return { success: false, error: "WhatsApp no configurado" };
        }

        // Build template payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const templateObj: Record<string, any> = {
            name: templateName,
            language: { code: templateLanguage },
        };

        // Add body parameters if provided
        if (parameters && parameters.length > 0) {
            templateObj.components = [
                {
                    type: "body",
                    parameters: parameters.map((p: string) => ({
                        type: "text",
                        text: p,
                    })),
                },
            ];
        }

        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: templateObj,
        };

        // Send via Meta Graph API
        const res = await fetch(
            `${META_API}/${creds.phone_number_id}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const errorMsg = data?.error?.message || `Meta API error: ${res.status}`;
            console.error(`[SendTemplateDirect] Error sending ${templateName}:`, errorMsg);
            return { success: false, error: errorMsg };
        }

        const messageId = data?.messages?.[0]?.id;

        // Log to lead_messages for conversation history
        await db.from("lead_messages").insert({
            lead_id: leadId,
            role: "assistant",
            content: `[Template: ${templateName}]${parameters?.length ? " — " + parameters.join(", ") : ""}`,
        });

        return { success: true, messageId };
    } catch (err) {
        console.error("[SendTemplateDirect] Unexpected error:", err);
        return { success: false, error: "Error interno enviando template" };
    }
}

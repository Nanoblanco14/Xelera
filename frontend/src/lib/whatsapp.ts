// ═══════════════════════════════════════════════════════════════
//  Shared WhatsApp Message Sending Utility
//  Used by: inbox/send, appointment reminders, daily digest
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";

interface SendResult {
    success: boolean;
    error?: string;
}

/**
 * Send a WhatsApp text message to a phone number on behalf of an org.
 * Loads the org's WhatsApp credentials and sends via Meta or Twilio.
 */
export async function sendWhatsAppMessage(
    orgId: string,
    recipientPhone: string,
    messageText: string
): Promise<SendResult> {
    try {
        const db = getSupabaseAdmin();

        const { data: org, error: orgError } = await db
            .from("organizations")
            .select("whatsapp_provider, whatsapp_credentials")
            .eq("id", orgId)
            .single();

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada" };
        }

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        const provider = org.whatsapp_provider;

        if (provider === "meta" && creds.phone_number_id && creds.access_token) {
            const res = await fetch(
                `https://graph.facebook.com/v22.0/${creds.phone_number_id}/messages`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${creds.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: recipientPhone,
                        type: "text",
                        text: { body: messageText },
                    }),
                }
            );
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("[WhatsApp:Meta] Send error:", errData);
                return { success: false, error: `Meta API error: ${res.status}` };
            }
            return { success: true };
        }

        if (provider === "twilio" && creds.account_sid && creds.auth_token) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`;
            const formData = new URLSearchParams();
            formData.append("From", `whatsapp:${creds.from_number || ""}`);
            formData.append("To", `whatsapp:+${recipientPhone}`);
            formData.append("Body", messageText);

            const res = await fetch(twilioUrl, {
                method: "POST",
                headers: {
                    Authorization: `Basic ${Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData.toString(),
            });
            if (!res.ok) {
                console.error("[WhatsApp:Twilio] Send error:", res.status);
                return { success: false, error: `Twilio error: ${res.status}` };
            }
            return { success: true };
        }

        return { success: false, error: "WhatsApp no configurado para esta organización" };
    } catch (err) {
        console.error("[WhatsApp:Send]", err);
        return { success: false, error: "Error enviando mensaje WhatsApp" };
    }
}

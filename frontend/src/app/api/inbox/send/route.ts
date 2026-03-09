import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    apiError,
    serverError,
} from "@/lib/api-auth";

// ── POST /api/inbox/send ──────────────────────────────────
// Send a message as a human agent (pause bot + send via WhatsApp)
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("inbox:send:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { lead_id, message } = await req.json();
        if (!lead_id || !message?.trim()) {
            return apiError("lead_id and message required", 400, "MISSING_PARAM");
        }

        const db = getSupabaseAdmin();

        // Get lead + verify org access
        const { data: lead, error: leadError } = await db
            .from("leads")
            .select("id, phone, organization_id")
            .eq("id", lead_id)
            .single();

        if (leadError || !lead) {
            return apiError("Lead no encontrado", 404, "NOT_FOUND");
        }

        if (lead.organization_id !== auth.orgId) {
            return apiError("No tienes acceso a este lead", 403, "FORBIDDEN");
        }

        // Get org WhatsApp config
        const { data: org, error: orgError } = await db
            .from("organizations")
            .select("whatsapp_provider, whatsapp_credentials")
            .eq("id", auth.orgId)
            .single();

        if (orgError || !org) {
            return apiError("Organización no encontrada", 404, "NOT_FOUND");
        }

        // Pause bot for this lead (human takeover)
        await db
            .from("leads")
            .update({ is_bot_paused: true })
            .eq("id", lead_id);

        // Save message in DB
        const { error: msgError } = await db
            .from("lead_messages")
            .insert({
                lead_id,
                role: "assistant", // From the customer's perspective, it's still the "assistant"
                content: message.trim(),
            });

        if (msgError) throw msgError;

        // Send via WhatsApp
        const creds = org.whatsapp_credentials || {};

        if (org.whatsapp_provider === "meta" && creds.phone_number_id && creds.access_token) {
            try {
                await fetch(
                    `https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${creds.access_token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            messaging_product: "whatsapp",
                            to: lead.phone,
                            type: "text",
                            text: { body: message.trim() },
                        }),
                    }
                );
            } catch (whatsappErr) {
                console.error("WhatsApp send error:", whatsappErr);
                // Message saved in DB even if WhatsApp fails
            }
        } else if (org.whatsapp_provider === "twilio" && creds.account_sid && creds.auth_token) {
            try {
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`;
                const formData = new URLSearchParams();
                formData.append("From", `whatsapp:${creds.from_number || ""}`);
                formData.append("To", `whatsapp:+${lead.phone}`);
                formData.append("Body", message.trim());

                await fetch(twilioUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString("base64")}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: formData.toString(),
                });
            } catch (twilioErr) {
                console.error("Twilio send error:", twilioErr);
            }
        }

        return NextResponse.json({
            data: { success: true, bot_paused: true },
        });
    } catch (err) {
        return serverError(err, "inbox:send:POST");
    }
}

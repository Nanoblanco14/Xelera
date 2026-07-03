import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    apiError,
    serverError,
} from "@/lib/api-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { linkOutboundMessage, markOutboundFailed } from "@/lib/delivery-status";

// ── POST /api/inbox/send ──────────────────────────────────
// Send a message as a human agent (pause bot + send via WhatsApp).
// El envío usa la lib compartida y vincula el wamid para que los
// checks ✓/✓✓ del outbox también funcionen en mensajes humanos.
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

        // Pause bot for this lead (human takeover)
        await db
            .from("leads")
            .update({ is_bot_paused: true })
            .eq("id", lead_id);

        // Save message in DB (capturamos el id para vincular el wamid)
        const { data: insertedMsg, error: msgError } = await db
            .from("lead_messages")
            .insert({
                lead_id,
                role: "assistant", // From the customer's perspective, it's still the "assistant"
                content: message.trim(),
            })
            .select("id")
            .single();

        if (msgError) throw msgError;
        const messageRowId: string | null = insertedMsg?.id ?? null;

        // Send via WhatsApp (lib compartida: Meta o Twilio según la org)
        const sendResult = await sendWhatsAppMessage(
            auth.orgId,
            lead.phone,
            message.trim()
        );

        let whatsappError: string | null = null;
        if (!sendResult.success) {
            whatsappError = sendResult.error || "No se pudo enviar por WhatsApp";
            if (messageRowId) {
                // ⚠ inmediato en el inbox
                markOutboundFailed(messageRowId, whatsappError)
                    .catch(() => { /* no bloquear */ });
            }
        } else if (messageRowId && sendResult.providerMessageId) {
            // ✓ los statuses de Meta actualizarán delivered/read
            linkOutboundMessage(messageRowId, sendResult.providerMessageId)
                .catch(() => { /* no bloquear */ });
        }

        return NextResponse.json({
            data: { success: true, bot_paused: true },
            ...(whatsappError ? { whatsapp_error: whatsappError } : {}),
        });
    } catch (err) {
        return serverError(err, "inbox:send:POST");
    }
}

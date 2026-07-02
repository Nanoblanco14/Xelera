// ═══════════════════════════════════════════════════════════════
//  📥 WEBHOOK MULTI-TENANT — capa delgada de ingesta
//
//  Responsabilidad: verificar firma, parsear, deduplicar, asegurar
//  el lead, persistir el mensaje entrante y ENCOLARLO. Responde 200
//  en cuanto el mensaje está a salvo en la cola (<1s) — el pipeline
//  de IA corre después vía after() con ventana de debounce (agrupa
//  ráfagas de mensajes en un solo turno de OpenAI).
//
//  Fallback: si la tabla inbound_message_buffer no existe aún
//  (migración pendiente), procesa inline como el webhook original.
//
//  El pipeline completo vive en @/lib/message-processor.
// ═══════════════════════════════════════════════════════════════

import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkResourceLimit } from "@/lib/plan-limits";
import {
    verifyMetaSignature,
    verifyTwilioSignature,
    getPublicWebhookUrl,
    escapeXml,
} from "@/lib/webhook-security";
import { processLeadTurn, getOrCreateFirstStage } from "@/lib/message-processor";
import { bufferIncomingMessage, runDebouncedProcessing } from "@/lib/message-queue";
import { captureError } from "@/lib/monitoring";
import { trackEvent } from "@/lib/analytics";

// ── Supabase Admin (bypasses RLS for webhook) ───────────────
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// ═══════════════════════════════════════════════════════════════
//  📨 MESSAGE PARSERS — Extract message/sender per provider
// ═══════════════════════════════════════════════════════════════

interface ParsedMessage {
    body: string;
    sender: string;
    phoneClean: string;
    /** Meta message id (wamid.*) — used for deduplication on retries */
    messageId?: string;
}

function parseTwilioParams(rawBody: string): Record<string, string> {
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(rawBody)) {
        params[key] = value;
    }
    return params;
}

function parseTwilioMessage(params: Record<string, string>): ParsedMessage {
    const body = params["Body"] || "";
    const sender = params["From"] || "";
    const phoneClean = sender.replace("whatsapp:", "");
    return { body, sender, phoneClean, messageId: params["MessageSid"] || undefined };
}

// Non-text message types the bot can't read — mapped to a context
// placeholder so the AI (and the human inbox) know what arrived.
const MEDIA_PLACEHOLDERS: Record<string, string> = {
    image: "una imagen",
    audio: "un mensaje de voz",
    video: "un video",
    document: "un documento",
    location: "una ubicación",
    sticker: "un sticker",
};

function parseMetaMessage(rawBody: string): ParsedMessage | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any;
    try {
        json = JSON.parse(rawBody);
    } catch {
        return null;
    }
    const entry = json?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    const sender = msg.from || "";
    const phoneClean = sender.replace(/^\+/, "");
    const messageId: string | undefined = msg.id || undefined;

    if (msg.type === "text" || msg.text?.body) {
        return { body: msg.text?.body || "", sender, phoneClean, messageId };
    }

    // Media / location: inject a placeholder so the conversation
    // keeps context and the AI can ask the client to describe it.
    const mediaLabel = MEDIA_PLACEHOLDERS[msg.type as string];
    if (mediaLabel) {
        return {
            body: `[El cliente envió ${mediaLabel} que no puedes ver. Pídele amablemente que escriba por texto lo que necesita.]`,
            sender,
            phoneClean,
            messageId,
        };
    }

    // Reactions, system events, unknown types → ignore silently
    return null;
}

// ── TwiML helpers ───────────────────────────────────────────

function buildTwilioResponse(text: string): Response {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>${text ? `
    <Message>${escapeXml(text)}</Message>` : ""}
</Response>`;
    return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

// ═══════════════════════════════════════════════════════════════
//  🔁 DEDUPLICATION — Meta retries webhooks on slow responses.
// ═══════════════════════════════════════════════════════════════
async function isDuplicateMessage(
    orgId: string,
    messageId: string
): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from("webhook_events")
        .insert({ message_id: messageId, organization_id: orgId });

    if (!error) return false;
    if (error.code === "23505") return true; // unique_violation → duplicate
    if (error.code !== "42P01") {
        console.warn(`⚠️ webhook_events insert error (no bloqueante):`, error.message);
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════
//  GET handler — Meta Webhook Verification (challenge)
//
//  Two-tier verify_token strategy:
//    1. META_VERIFY_TOKEN env var  →  single global token for all tenants
//    2. Per-tenant token stored in organizations.whatsapp_credentials
// ═══════════════════════════════════════════════════════════════
export async function GET(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    const { tenantId } = await params;
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Only respond to Meta's subscription verification handshake
    if (mode !== "subscribe" || !token || !challenge) {
        return new Response("OK", { status: 200 });
    }

    // ── Option 1: Global env var (META_VERIFY_TOKEN) ──────────
    const globalToken = process.env.META_VERIFY_TOKEN;
    if (globalToken) {
        if (token === globalToken) {
            console.log(`✅ Webhook verified via META_VERIFY_TOKEN [tenant: ${tenantId}]`);
            return new Response(challenge, { status: 200 });
        }
        console.warn(`🚫 Webhook verification failed — token mismatch [tenant: ${tenantId}]`);
        return new Response("Forbidden", { status: 403 });
    }

    // ── Option 2: Per-tenant token stored in Supabase ─────────
    const { data: org, error } = await supabaseAdmin
        .from("organizations")
        .select("whatsapp_credentials")
        .eq("id", tenantId)
        .single();

    if (error || !org) {
        console.warn(`🚫 Webhook verification — tenant not found [${tenantId}]`);
        return new Response("Forbidden", { status: 403 });
    }

    const storedToken = org?.whatsapp_credentials?.verify_token;
    if (storedToken && storedToken === token) {
        console.log(`✅ Webhook verified via per-tenant token [tenant: ${tenantId}]`);
        return new Response(challenge, { status: 200 });
    }

    console.warn(`🚫 Webhook verification failed — token mismatch [tenant: ${tenantId}]`);
    return new Response("Forbidden", { status: 403 });
}

// ═══════════════════════════════════════════════════════════════
//  POST handler — ingesta + encolado (respuesta <1s)
// ═══════════════════════════════════════════════════════════════
export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    const { tenantId } = await params;

    try {
        // Raw body is needed for signature verification (HMAC is
        // computed over the exact bytes, before any parsing).
        const rawBody = await req.text();

        // ── 1. Load tenant config (solo lo necesario aquí) ────
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from("organizations")
            .select("id, name, whatsapp_provider, whatsapp_credentials")
            .eq("id", tenantId)
            .single();

        if (tenantError || !tenant) {
            console.error(`❌ Tenant not found: ${tenantId}`);
            return new Response(
                JSON.stringify({ error: "Tenant not found" }),
                { status: 404 }
            );
        }

        const provider: "twilio" | "meta" = tenant.whatsapp_provider || "twilio";
        const credentials = (tenant.whatsapp_credentials || {}) as Record<string, string>;
        const tenantName = tenant.name as string;

        // ── 1b. Verify webhook signature ──────────────────────
        // Without this check anyone who knows a tenantId can inject
        // fake messages, burn the tenant's OpenAI credits and make
        // the bot send WhatsApps to arbitrary numbers.
        const allowUnsigned = process.env.WEBHOOK_ALLOW_UNSIGNED === "true";

        if (provider === "meta") {
            const appSecret = process.env.META_APP_SECRET;
            if (appSecret) {
                const signature = req.headers.get("x-hub-signature-256");
                if (!verifyMetaSignature(rawBody, signature, appSecret)) {
                    console.warn(`🚫 [${tenantName}] Firma de Meta inválida — request rechazado`);
                    return new Response("Invalid signature", { status: 401 });
                }
            } else if (!allowUnsigned) {
                console.warn(
                    `⚠️ [${tenantName}] META_APP_SECRET no configurado — el webhook acepta requests SIN verificar firma. ` +
                    `Configura META_APP_SECRET en producción o WEBHOOK_ALLOW_UNSIGNED=true para silenciar este aviso en desarrollo.`
                );
            }
        } else if (provider === "twilio") {
            const authToken = credentials?.auth_token;
            if (authToken) {
                const signature = req.headers.get("x-twilio-signature");
                const publicUrl = getPublicWebhookUrl(req);
                const twilioParams = parseTwilioParams(rawBody);
                if (!verifyTwilioSignature(publicUrl, twilioParams, signature, authToken)) {
                    console.warn(`🚫 [${tenantName}] Firma de Twilio inválida — request rechazado`);
                    return new Response("Invalid signature", { status: 401 });
                }
            } else if (!allowUnsigned) {
                console.warn(
                    `⚠️ [${tenantName}] Sin auth_token de Twilio en credenciales — firma no verificada.`
                );
            }
        }

        // ── 2. Parse incoming message by provider ─────────────
        let parsed: ParsedMessage | null = null;

        if (provider === "twilio") {
            parsed = parseTwilioMessage(parseTwilioParams(rawBody));
        } else if (provider === "meta") {
            parsed = parseMetaMessage(rawBody);
            // Meta sends status updates that have no messages
            if (!parsed) {
                return new Response("OK", { status: 200 });
            }
        }

        if (!parsed || !parsed.body) {
            return new Response("OK", { status: 200 });
        }

        const { body: incomingMsg, sender, phoneClean } = parsed;

        // ── 2b. Deduplicate provider retries ──────────────────
        if (parsed.messageId && (await isDuplicateMessage(tenantId, parsed.messageId))) {
            console.log(`🔁 [${tenantName}] Mensaje duplicado ignorado (${parsed.messageId})`);
            return new Response("OK", { status: 200 });
        }

        console.log(`📩 [${tenantName}] WhatsApp de ${sender}: ${incomingMsg}`);

        // ── 3. Find or create lead; check bot-paused state ────
        const { data: existingForStatus } = await supabaseAdmin
            .from("leads")
            .select("id, is_bot_paused")
            .eq("organization_id", tenantId)
            .eq("phone", phoneClean)
            .limit(1);

        const leadAlreadyExists = existingForStatus && existingForStatus.length > 0;

        // ── 3a. Human takeover — persistir el mensaje para el
        // inbox pero NO responder con el bot ──────────────────
        if (leadAlreadyExists && existingForStatus[0].is_bot_paused) {
            await supabaseAdmin.from("lead_messages").insert({
                lead_id: existingForStatus[0].id,
                role: "user",
                content: incomingMsg,
            });
            console.log(`⏸️ [${tenantName}] Bot pausado para ${phoneClean}. Mensaje guardado, sin respuesta.`);
            if (provider === "twilio") return buildTwilioResponse("");
            return new Response("OK", { status: 200 });
        }

        if (!leadAlreadyExists) {
            // ── Plan limit check for new leads ──
            const leadLimit = await checkResourceLimit(tenantId, "leads");
            if (!leadLimit.allowed) {
                console.warn(`[Webhook] Lead limit reached for org ${tenantId} (${leadLimit.current}/${leadLimit.limit})`);
                return new Response("OK", { status: 200 });
            }

            const firstStageId = await getOrCreateFirstStage(tenantId);
            if (firstStageId) {
                // Upsert to prevent duplicates from race conditions
                await supabaseAdmin.from("leads").upsert(
                    {
                        organization_id: tenantId,
                        stage_id: firstStageId,
                        name: "Lead WhatsApp",
                        phone: phoneClean,
                        source: "whatsapp",
                        chat_status: "Contacto inicial",
                    },
                    { onConflict: "organization_id,phone", ignoreDuplicates: true }
                );
            }

            // 📈 Evento: lead nuevo captado
            trackEvent({ orgId: tenantId, type: "lead_created" })
                .catch(() => { /* no bloquear */ });
        }

        // ── 3b. Resolve leadId ────────────────────────────────
        let leadId: string | null = null;
        if (leadAlreadyExists) {
            leadId = existingForStatus[0].id;
        } else {
            const { data: newLeadRow } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("organization_id", tenantId)
                .eq("phone", phoneClean)
                .limit(1)
                .maybeSingle();
            leadId = newLeadRow?.id ?? null;
        }

        // ── 3c. Persist the incoming user message ─────────────
        // Inmediato: el inbox (Realtime) lo muestra al instante,
        // y el historial ya lo incluye cuando corra el procesador.
        if (leadId) {
            await supabaseAdmin.from("lead_messages").insert({
                lead_id: leadId,
                role: "user",
                content: incomingMsg,
            });
        }

        // 📈 Evento: mensaje entrante
        trackEvent({ orgId: tenantId, leadId, type: "message_received" })
            .catch(() => { /* no bloquear */ });

        // ── 4. Encolar con debounce ───────────────────────────
        const buffered = await bufferIncomingMessage({
            orgId: tenantId,
            phone: phoneClean,
            leadId,
            content: incomingMsg,
            providerMessageId: parsed.messageId,
        });

        if (buffered.buffered && buffered.bufferId) {
            // after() corre DESPUÉS de enviar la respuesta HTTP —
            // el proveedor recibe su 200 al instante y el timer de
            // debounce vive en background.
            const bufferId = buffered.bufferId;
            after(async () => {
                await runDebouncedProcessing(tenantId, phoneClean, bufferId);
            });

            if (provider === "twilio") return buildTwilioResponse("");
            return new Response("OK", { status: 200 });
        }

        // ── 4b. Fallback inline (tabla de cola no existe aún) ──
        // Comportamiento original: procesa dentro del request.
        const { botResponse } = await processLeadTurn({
            orgId: tenantId,
            phone: phoneClean,
            leadId,
            combinedText: incomingMsg,
            // Meta: el procesador envía por API. Twilio: respondemos TwiML.
            sendReply: provider === "meta",
            lastUserMessageAt: new Date().toISOString(),
            batchMessageCount: 1,
        });

        if (provider === "twilio") {
            return buildTwilioResponse(botResponse || "");
        }
        return new Response("OK", { status: 200 });
    } catch (error) {
        captureError(error, "webhook:post", { tenantId });
        return new Response("Error", { status: 500 });
    }
}

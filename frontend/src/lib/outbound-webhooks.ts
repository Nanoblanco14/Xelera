// ═══════════════════════════════════════════════════════════════
//  🔗 OUTBOUND WEBHOOKS (Executive) — integración CRM por-tenant
//
//  El tenant configura URL + secreto en Settings; Xelera emite
//  eventos firmados con HMAC-SHA256 sobre el raw body:
//    X-Xelera-Event: lead_updated | appointment_booked | handoff
//    X-Xelera-Timestamp: epoch ms (anti-replay del lado receptor)
//    X-Xelera-Signature: sha256=<hmac(secret, timestamp.body)>
//
//  Verificación receptor: hmac_sha256(secret, `${ts}.${rawBody}`).
//  Fire-and-forget: un CRM caído jamás afecta la conversación.
//  Gated por flag outbound_webhooks del plan.
// ═══════════════════════════════════════════════════════════════

import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getPlanLimits } from "@/lib/plan-limits";
import { captureError } from "@/lib/monitoring";

const TIMEOUT_MS = 10_000;

export type OutboundEvent =
    | "lead_updated"
    | "appointment_booked"
    | "handoff";

export interface OutboundWebhookConfig {
    enabled: boolean;
    url: string;
    secret: string;
}

/**
 * Emite un evento al webhook del tenant (si está configurado y su
 * plan lo permite). NUNCA lanza — siempre fire-and-forget.
 */
export async function emitOutboundEvent(
    orgId: string,
    event: OutboundEvent,
    payload: Record<string, unknown>
): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: org } = await (db as any)
            .from("organizations")
            .select("plan, settings")
            .eq("id", orgId)
            .single();
        if (!org) return;

        // ── Gate por plan ──
        if (!getPlanLimits(org.plan).outbound_webhooks) return;

        const cfg = (org.settings?.outbound_webhook || {}) as Partial<OutboundWebhookConfig>;
        if (!cfg.enabled || !cfg.url || !/^https?:\/\//.test(cfg.url)) return;

        const timestamp = Date.now().toString();
        const body = JSON.stringify({
            event,
            organization_id: orgId,
            timestamp: Number(timestamp),
            data: payload,
        });

        const signature = cfg.secret
            ? "sha256=" + createHmac("sha256", cfg.secret)
                .update(`${timestamp}.${body}`, "utf8")
                .digest("hex")
            : "";

        const res = await fetch(cfg.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Xelera-Event": event,
                "X-Xelera-Timestamp": timestamp,
                ...(signature ? { "X-Xelera-Signature": signature } : {}),
            },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
            console.warn(`🔗 [Outbound] ${event} → ${res.status} (org ${orgId})`);
        } else {
            console.log(`🔗 [Outbound] ${event} entregado (org ${orgId})`);
        }
    } catch (err) {
        // Timeout / DNS / CRM caído → log sin romper nada
        captureError(err, "outbound:emit", { orgId, event });
    }
}

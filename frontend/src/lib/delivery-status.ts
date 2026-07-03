// ═══════════════════════════════════════════════════════════════
//  ✓✓ DELIVERY STATUS — outbox de WhatsApp (Meta statuses)
//
//  linkOutboundMessage()   → asocia el wamid devuelto por Meta a
//                            la fila de lead_messages recién creada
//  applyDeliveryStatuses() → procesa los webhooks de statuses:
//                            sent/delivered/read/failed, con
//                            monotonicidad (read nunca baja a
//                            delivered por webhooks fuera de orden)
//
//  Fallos: cada mensaje failed persiste su error, va a Sentry y
//  genera una alerta in-app centralizada (deduplicada 6h) — con
//  detección específica de token de Meta vencido.
//
//  Degrada sin romper si las columnas no existen (migración
//  20260702_outbox_status.sql pendiente).
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { captureError, captureMessage } from "@/lib/monitoring";

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

// Orden monotónico: un webhook 'delivered' que llega DESPUÉS del
// 'read' (Meta no garantiza orden) no debe retroceder el check.
const STATUS_RANK: Record<DeliveryStatus, number> = {
    sent: 1,
    delivered: 2,
    read: 3,
    failed: 99, // failed siempre se aplica
};

export interface MetaStatusUpdate {
    /** wamid.* del mensaje saliente */
    wamid: string;
    status: DeliveryStatus;
    /** errores de Meta cuando status === 'failed' */
    errors?: Array<{
        code?: number;
        title?: string;
        message?: string;
        error_data?: { details?: string };
    }>;
}

let columnsMissingWarned = false;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    // 42703 = undefined_column (SQL directo); PGRST204 = columna
    // desconocida en el schema cache de PostgREST
    return error.code === "42703" || error.code === "PGRST204" ||
        /column|schema cache/i.test(error.message || "");
}

function warnColumnsMissing(): void {
    if (!columnsMissingWarned) {
        columnsMissingWarned = true;
        console.warn(
            "[Outbox] Columnas de delivery no existen en lead_messages — " +
            "ejecuta la migración 20260702_outbox_status.sql para activar los checks ✓✓"
        );
    }
}

// ═══════════════════════════════════════════════════════════════
//  ESCRITURA AL ENVIAR — vincular wamid
// ═══════════════════════════════════════════════════════════════

/**
 * Asocia el id de proveedor (wamid/SID) al mensaje recién insertado
 * en lead_messages y lo marca como 'sent'. Fire-and-forget.
 */
export async function linkOutboundMessage(
    messageRowId: string,
    providerMessageId: string
): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any)
            .from("lead_messages")
            .update({
                provider_message_id: providerMessageId,
                delivery_status: "sent",
            })
            .eq("id", messageRowId);

        if (error) {
            if (isMissingColumnError(error)) warnColumnsMissing();
            else captureError(error, "outbox:link", { messageRowId });
        }
    } catch (err) {
        captureError(err, "outbox:link", { messageRowId });
    }
}

/**
 * Marca un mensaje saliente como fallido cuando el ENVÍO mismo
 * falló (la API rechazó la request — nunca habrá webhook de status).
 */
export async function markOutboundFailed(
    messageRowId: string,
    errorText: string
): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any)
            .from("lead_messages")
            .update({
                delivery_status: "failed",
                delivery_error: errorText.slice(0, 500),
            })
            .eq("id", messageRowId);

        if (error) {
            if (isMissingColumnError(error)) warnColumnsMissing();
            else captureError(error, "outbox:mark_failed", { messageRowId });
        }
    } catch (err) {
        captureError(err, "outbox:mark_failed", { messageRowId });
    }
}

// ═══════════════════════════════════════════════════════════════
//  ESCRITURA DESDE EL WEBHOOK — aplicar statuses
// ═══════════════════════════════════════════════════════════════

/**
 * Aplica un lote de statuses de Meta. Corre en after() — nunca
 * bloquea la respuesta 200 al webhook.
 */
export async function applyDeliveryStatuses(
    orgId: string,
    updates: MetaStatusUpdate[]
): Promise<void> {
    const db = getSupabaseAdmin();

    for (const update of updates) {
        try {
            // ── Buscar el mensaje por wamid ──
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: rows, error: findError } = await (db as any)
                .from("lead_messages")
                .select("id, delivery_status, lead_id")
                .eq("provider_message_id", update.wamid)
                .limit(1);

            if (findError) {
                if (isMissingColumnError(findError)) { warnColumnsMissing(); return; }
                captureError(findError, "outbox:find", { wamid: update.wamid });
                continue;
            }

            const row = rows?.[0];
            if (!row) continue; // mensaje no vinculado (template, pre-migración…)

            // ── Monotonicidad: solo avanzar, salvo failed ──
            const currentRank = row.delivery_status
                ? STATUS_RANK[row.delivery_status as DeliveryStatus] ?? 0
                : 0;
            if (STATUS_RANK[update.status] <= currentRank && update.status !== "failed") {
                continue;
            }

            const firstError = update.errors?.[0];
            const errorText = update.status === "failed"
                ? [
                    firstError?.code ? `[${firstError.code}]` : "",
                    firstError?.title || "",
                    firstError?.message || "",
                    firstError?.error_data?.details || "",
                ].filter(Boolean).join(" ").slice(0, 500) || "Fallo de entrega desconocido"
                : null;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any)
                .from("lead_messages")
                .update({
                    delivery_status: update.status,
                    ...(errorText ? { delivery_error: errorText } : {}),
                })
                .eq("id", row.id);

            // ── Fallo → alerta centralizada ──
            if (update.status === "failed") {
                await handleDeliveryFailure(orgId, row.lead_id, update, errorText || "");
            }
        } catch (err) {
            captureError(err, "outbox:apply", { orgId, wamid: update.wamid });
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  ALERTA CENTRALIZADA DE FALLOS
// ═══════════════════════════════════════════════════════════════

// Códigos de Meta que indican credenciales rotas (token vencido /
// revocado / app deshabilitada) — el fallo se repetirá en TODOS
// los mensajes hasta que el dueño reconecte WhatsApp.
const TOKEN_ERROR_CODES = new Set([0, 190, 3, 10, 200, 131031]);

async function handleDeliveryFailure(
    orgId: string,
    leadId: string | null,
    update: MetaStatusUpdate,
    errorText: string
): Promise<void> {
    const code = update.errors?.[0]?.code;
    const isTokenIssue = typeof code === "number" && TOKEN_ERROR_CODES.has(code);

    // 1. Sentry — visibilidad centralizada para el operador de Xelera
    captureMessage(
        isTokenIssue
            ? `Token de Meta inválido/vencido — entregas fallando (org ${orgId})`
            : `Mensaje de WhatsApp falló (org ${orgId}): ${errorText}`,
        "outbox:failed",
        "warning",
        { orgId, wamid: update.wamid, code, errorText }
    );

    // 2. Alerta in-app para el dueño (deduplicada: máx. 1 cada 6h
    //    por org — un token roto haría fallar cada mensaje)
    try {
        const db = getSupabaseAdmin();
        const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

        const { data: recent } = await db
            .from("notifications")
            .select("id")
            .eq("tenant_id", orgId)
            .eq("type", "delivery_failure")
            .gte("created_at", sixHoursAgo)
            .limit(1);

        if (recent && recent.length > 0) return; // ya avisado

        const message = isTokenIssue
            ? "⚠️ Tus mensajes de WhatsApp están fallando: el token de Meta parece vencido o inválido. Reconecta WhatsApp en Configuración."
            : `⚠️ Un mensaje de WhatsApp no se pudo entregar: ${errorText.slice(0, 140)}`;

        await db.from("notifications").insert({
            tenant_id: orgId,
            lead_id: leadId,
            type: "delivery_failure",
            message,
        });
        console.warn(`🔔 [Outbox] Alerta de fallo de entrega creada (org ${orgId}${isTokenIssue ? ", token" : ""})`);
    } catch (err) {
        captureError(err, "outbox:notify", { orgId });
    }
}

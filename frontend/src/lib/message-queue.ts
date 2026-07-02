// ═══════════════════════════════════════════════════════════════
//  📬 MESSAGE QUEUE — buffer con debounce para mensajes entrantes
//
//  Problema: los usuarios de WhatsApp escriben en ráfagas
//  ("hola" / "quería preguntar" / "por el depto"). Procesar cada
//  mensaje por separado genera 3 respuestas que se pisan y 3x el
//  costo de OpenAI.
//
//  Solución: el webhook inserta cada mensaje en
//  inbound_message_buffer y responde 200 al instante. Un timer
//  diferido (after() de Next) espera la ventana de debounce; si al
//  despertar su mensaje sigue siendo EL MÁS RECIENTE sin procesar
//  de esa conversación, reclama el lote completo y lo procesa como
//  un solo turno. Si llegó algo más nuevo, se retira — el timer del
//  mensaje nuevo será el dueño del lote.
//
//  Red de seguridad: si un timer serverless muere, el sweeper del
//  cron procesa los lotes huérfanos (>90s sin procesar).
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { captureError } from "@/lib/monitoring";
import { processLeadTurn } from "@/lib/message-processor";

// Ventana de debounce (ms). Configurable por env; 0 desactiva la
// espera (procesa inmediato pero mantiene la cola/claim).
export const DEBOUNCE_MS = (() => {
    const raw = Number(process.env.MESSAGE_DEBOUNCE_MS);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 8000;
})();

// Edad a partir de la cual el sweeper considera huérfano un mensaje
export const STALE_AFTER_MS = 90_000;

export interface BufferResult {
    /** false → la tabla no existe aún; usar procesamiento inline */
    buffered: boolean;
    bufferId?: string;
}

export interface ClaimedBatch {
    combinedText: string;
    messageCount: number;
    leadId: string | null;
    batchId: string;
}

let bufferMissingWarned = false;

/**
 * Encola un mensaje entrante. Si la tabla no existe (migración
 * pendiente), devuelve { buffered: false } para que el webhook
 * procese inline como antes — degradación sin pérdida de servicio.
 */
export async function bufferIncomingMessage(params: {
    orgId: string;
    phone: string;
    leadId: string | null;
    content: string;
    providerMessageId?: string;
}): Promise<BufferResult> {
    const db = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("inbound_message_buffer")
        .insert({
            organization_id: params.orgId,
            phone: params.phone,
            lead_id: params.leadId,
            content: params.content,
            provider_message_id: params.providerMessageId || null,
        })
        .select("id")
        .single();

    if (error) {
        if (error.code === "42P01") {
            if (!bufferMissingWarned) {
                bufferMissingWarned = true;
                console.warn(
                    "[Queue] Tabla inbound_message_buffer no existe — el webhook procesa inline. " +
                    "Ejecuta la migración 20260702_fase0_infra.sql para activar el debounce."
                );
            }
            return { buffered: false };
        }
        captureError(error, "queue:buffer", { orgId: params.orgId });
        return { buffered: false }; // fail open → inline
    }

    return { buffered: true, bufferId: data.id };
}

/**
 * ¿Mi mensaje sigue siendo el más reciente sin procesar de la
 * conversación? Si no, otro timer es el dueño del lote.
 */
export async function isLatestPending(
    orgId: string,
    phone: string,
    bufferId: string
): Promise<boolean> {
    const db = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("inbound_message_buffer")
        .select("id")
        .eq("organization_id", orgId)
        .eq("phone", phone)
        .is("processed_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return false; // ya procesado
    return data[0].id === bufferId;
}

/**
 * Reclama atómicamente TODOS los mensajes pendientes de una
 * conversación (UPDATE ... WHERE processed_at IS NULL RETURNING).
 * Dos workers compitiendo no pueden reclamar el mismo lote: el
 * segundo recibe 0 filas y se retira.
 */
export async function claimBatch(
    orgId: string,
    phone: string
): Promise<ClaimedBatch | null> {
    const db = getSupabaseAdmin();
    const batchId = crypto.randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("inbound_message_buffer")
        .update({ processed_at: new Date().toISOString(), batch_id: batchId })
        .eq("organization_id", orgId)
        .eq("phone", phone)
        .is("processed_at", null)
        .select("id, content, lead_id, created_at");

    if (error) {
        captureError(error, "queue:claim", { orgId, phone });
        return null;
    }
    if (!data || data.length === 0) return null; // otro worker ganó

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data as any[]).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return {
        combinedText: rows.map((r) => r.content).join("\n"),
        messageCount: rows.length,
        leadId: rows.find((r) => r.lead_id)?.lead_id ?? null,
        batchId,
    };
}

/**
 * Ejecutor del debounce — corre dentro de after() en el webhook,
 * DESPUÉS de haber respondido 200 al proveedor:
 *   1. Duerme la ventana de debounce.
 *   2. Si llegó un mensaje más nuevo, se retira (el timer de ese
 *      mensaje será el dueño del lote).
 *   3. Reclama el lote completo y lo procesa como UN solo turno.
 */
export async function runDebouncedProcessing(
    orgId: string,
    phone: string,
    bufferId: string
): Promise<void> {
    try {
        if (DEBOUNCE_MS > 0) {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
        }

        if (!(await isLatestPending(orgId, phone, bufferId))) {
            // Un mensaje más nuevo llegó durante la ventana (o el
            // lote ya fue procesado) — este timer no es el dueño.
            return;
        }

        const batch = await claimBatch(orgId, phone);
        if (!batch) return; // otro worker lo reclamó primero

        console.log(
            `📦 [Queue] Procesando lote de ${batch.messageCount} mensaje(s) para ${phone} (org ${orgId})`
        );

        await processLeadTurn({
            orgId,
            phone,
            leadId: batch.leadId,
            combinedText: batch.combinedText,
            sendReply: true,
        });
    } catch (err) {
        captureError(err, "queue:debounce", { orgId, phone });
    }
}

/**
 * Sweeper (llamado por el cron): rescata conversaciones con
 * mensajes pendientes de hace >90s — timers serverless que
 * murieron sin procesar su lote.
 */
export async function sweepStaleMessages(): Promise<number> {
    const conversations = await findStaleConversations();
    if (conversations.length === 0) return 0;

    let processed = 0;
    for (const convo of conversations) {
        try {
            const batch = await claimBatch(convo.orgId, convo.phone);
            if (!batch) continue;

            console.log(
                `🧹 [Queue:Sweeper] Rescatando lote huérfano de ${batch.messageCount} mensaje(s) para ${convo.phone}`
            );

            await processLeadTurn({
                orgId: convo.orgId,
                phone: convo.phone,
                leadId: batch.leadId,
                combinedText: batch.combinedText,
                sendReply: true,
            });
            processed++;
        } catch (err) {
            captureError(err, "queue:sweeper", convo);
        }
    }
    return processed;
}

/**
 * Encuentra conversaciones con mensajes pendientes >90s.
 */
export async function findStaleConversations(): Promise<
    Array<{ orgId: string; phone: string }>
> {
    const db = getSupabaseAdmin();
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("inbound_message_buffer")
        .select("organization_id, phone")
        .is("processed_at", null)
        .lte("created_at", staleBefore)
        .limit(100);

    if (error) {
        if (error.code !== "42P01") {
            captureError(error, "queue:sweep");
        }
        return [];
    }
    if (!data || data.length === 0) return [];

    // Deduplicar conversaciones
    const seen = new Set<string>();
    const result: Array<{ orgId: string; phone: string }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
        const key = `${row.organization_id}|${row.phone}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ orgId: row.organization_id, phone: row.phone });
        }
    }
    return result;
}

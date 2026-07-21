// ═══════════════════════════════════════════════════════════════
//  Cron Endpoint: Automatizaciones programadas
//  GET|POST /api/appointments/reminders — protegido por CRON_SECRET
//
//  Vercel Cron invoca por GET (con Authorization: Bearer CRON_SECRET
//  automático si la env var existe). POST se mantiene para invocación
//  manual o crons externos (cron-job.org).
//
//  Jobs:
//   1. Recordatorio de cita 24h antes (template + fallback)
//   2. Recordatorio de cita 1h antes
//   3. Resumen diario al dueño (leads nuevos + citas + pendientes)
//   4. Follow-up post-visita (48h después de cita completada)
//   5. Reactivación de leads inactivos (7+ días)
//   6. Follow-up de conversaciones estancadas (20-23h, antes de que
//      cierre la ventana de sesión de WhatsApp de 24h)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// 9 jobs secuenciales (recordatorios, digest, sweeper, agregación,
// token health, reglas) superan los 10s default de Vercel.
export const maxDuration = 300;
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
    sendAutoTemplate,
    getAutoTemplateConfig,
    isInQuietHours,
} from "@/lib/auto-templates";
import { checkFeatureAccess } from "@/lib/plan-limits";
import { formatChileDate } from "@/lib/appointments";
import { sweepStaleMessages } from "@/lib/message-queue";
import { aggregateDailyMetrics } from "@/lib/analytics";
import { linkOutboundMessage } from "@/lib/delivery-status";
import { checkMetaTokenHealth } from "@/lib/token-health";
import { runScheduledRules } from "@/lib/rule-engine";
import { captureError } from "@/lib/monitoring";

const CHILE_TZ = "America/Santiago";

// ── Auth guard ───────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Helper: log de envíos free-text en template_send_log ────
// Reutiliza la tabla como registro de deduplicación aunque el
// mensaje no sea un template de Meta.

async function logSend(
    orgId: string,
    leadId: string,
    event: string,
    success: boolean,
    error?: string
): Promise<void> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from("template_send_log").insert({
            organization_id: orgId,
            lead_id: leadId,
            event,
            template_name: "(texto_directo)",
            parameters: "[]",
            success,
            error: error || null,
        });
    } catch (err) {
        console.error("[Cron] Log insert error:", err);
    }
}

async function wasSentRecently(
    leadId: string,
    event: string,
    sinceIso: string
): Promise<boolean> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from("template_send_log")
        .select("id")
        .eq("lead_id", leadId)
        .eq("event", event)
        .eq("success", true)
        .gte("sent_at", sinceIso)
        .limit(1);

    if (error) {
        console.error("[Cron] Dedup check error:", error);
        return true; // fail closed para no duplicar mensajes
    }
    return !!(data && data.length > 0);
}

// ── Job 1: Recordatorios 24h antes ───────────────────────────

async function sendReminders(): Promise<number> {
    const db = getSupabaseAdmin();

    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000); // now + 23h
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // now + 25h

    const { data: rawAppointments, error } = await db
        .from("appointments")
        .select(
            "id, start_time, organization_id, lead_id, " +
            "leads!inner(name, phone), products(name)"
        )
        .eq("status", "confirmed")
        .is("reminder_sent_at", null)
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString());

    if (error) {
        console.error("[Reminders24h] Query error:", error);
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appointments = (rawAppointments || []) as any[];
    if (appointments.length === 0) return 0;

    let sent = 0;

    for (const appt of appointments) {
        try {
            const lead = appt.leads as { name: string; phone: string };
            const product = appt.products as { name: string } | null;

            if (!lead?.phone) {
                console.warn(`[Reminders24h] Appointment ${appt.id}: lead has no phone, skipping`);
                continue;
            }

            const productName = product?.name || "tu cita";
            const formattedDate = formatChileDate(appt.start_time);
            const leadName = lead.name?.split(" ")[0] || "";

            const fallbackMessage =
                `¡Hola${leadName ? ` ${leadName}` : ""}! 👋\n\n` +
                `Te recordamos que mañana tienes una cita agendada:\n\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `📋 Servicio: ${productName}\n\n` +
                `Si necesitas cancelar o reagendar, contáctanos con anticipación.\n` +
                `¡Te esperamos! 😊`;

            const result = await sendAutoTemplate({
                orgId: appt.organization_id,
                leadId: appt.lead_id,
                phone: lead.phone,
                event: "appointment_reminder",
                parameters: [leadName, productName, formattedDate],
                fallbackText: fallbackMessage,
            });

            if (result.sent) {
                await db
                    .from("appointments")
                    .update({ reminder_sent_at: new Date().toISOString() })
                    .eq("id", appt.id);
                sent++;
            } else {
                console.warn(
                    `[Reminders24h] Not sent to ${lead.phone} for appt ${appt.id}: ${result.reason}`
                );
            }
        } catch (err) {
            console.error(`[Reminders24h] Error processing appt ${appt.id}:`, err);
        }
    }

    return sent;
}

// ── Job 2: Recordatorios 1h antes ────────────────────────────
// Dedup vía template_send_log (evento appointment_reminder_1h en
// las últimas 3h) — no requiere columnas nuevas.

async function sendOneHourReminders(): Promise<number> {
    const db = getSupabaseAdmin();

    const now = new Date();
    const from = new Date(now.getTime() + 45 * 60 * 1000);  // now + 45min
    const to = new Date(now.getTime() + 75 * 60 * 1000);    // now + 75min
    const dedupSince = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

    const { data: rawAppointments, error } = await db
        .from("appointments")
        .select(
            "id, start_time, organization_id, lead_id, " +
            "leads!inner(name, phone), products(name)"
        )
        .eq("status", "confirmed")
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString());

    if (error) {
        console.error("[Reminders1h] Query error:", error);
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appointments = (rawAppointments || []) as any[];
    if (appointments.length === 0) return 0;

    let sent = 0;

    for (const appt of appointments) {
        try {
            const lead = appt.leads as { name: string; phone: string };
            if (!lead?.phone) continue;

            if (await wasSentRecently(appt.lead_id, "appointment_reminder_1h", dedupSince)) {
                continue;
            }

            const productName = (appt.products as { name: string } | null)?.name || "tu cita";
            const leadName = lead.name?.split(" ")[0] || "";

            // Hora de la cita en Chile
            const apptInChile = new Date(
                new Date(appt.start_time).toLocaleString("en-US", { timeZone: CHILE_TZ })
            );
            const hh = String(apptInChile.getHours()).padStart(2, "0");
            const mm = String(apptInChile.getMinutes()).padStart(2, "0");

            const message =
                `⏰ ¡Hola${leadName ? ` ${leadName}` : ""}! ` +
                `Te esperamos en 1 hora (${hh}:${mm}) para ${productName}.\n\n` +
                `Si tienes algún inconveniente, avísanos por aquí. ¡Nos vemos pronto!`;

            const result = await sendWhatsAppMessage(
                appt.organization_id,
                lead.phone,
                message
            );

            await logSend(
                appt.organization_id,
                appt.lead_id,
                "appointment_reminder_1h",
                result.success,
                result.error
            );

            if (result.success) sent++;
        } catch (err) {
            console.error(`[Reminders1h] Error processing appt ${appt.id}:`, err);
        }
    }

    return sent;
}

// ── Job 3: Resumen diario al dueño ───────────────────────────
// Antes solo se enviaba si había citas hoy. Ahora resume la
// operación completa: leads nuevos de ayer, citas de hoy y leads
// esperando atención humana.

async function sendDailyDigests(): Promise<number> {
    const db = getSupabaseAdmin();

    const nowInChile = new Date(
        new Date().toLocaleString("en-US", { timeZone: CHILE_TZ })
    );
    const currentTotalMinutes = nowInChile.getHours() * 60 + nowInChile.getMinutes();

    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const todayStr = dateStr(nowInChile);
    const yesterday = new Date(nowInChile);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = dateStr(yesterday);

    // Todas las orgs con digest habilitado (tabla pequeña; filtro en JS)
    const { data: orgs, error: orgsError } = await db
        .from("organizations")
        .select("id, settings");

    if (orgsError || !orgs) {
        console.error("[Digest] Orgs query error:", orgsError);
        return 0;
    }

    let sent = 0;

    for (const org of orgs) {
        try {
            const settings = (org.settings || {}) as Record<string, unknown>;
            const config = {
                daily_digest_enabled: false,
                daily_digest_time: "08:00",
                owner_phone: "",
                ...((settings.appointment_config as Record<string, unknown>) || {}),
            } as { daily_digest_enabled: boolean; daily_digest_time: string; owner_phone: string };

            if (!config.daily_digest_enabled || !config.owner_phone) continue;

            // Ventana ±30 min respecto a la hora configurada
            const [digestHour, digestMinute] = (config.daily_digest_time || "08:00")
                .split(":").map(Number);
            const diff = Math.abs(currentTotalMinutes - (digestHour * 60 + digestMinute));
            if (diff > 30) continue;

            // ── Datos del resumen (en paralelo) ──
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [apptsRes, newLeadsRes, waitingRes, eventsRes]: any[] = await Promise.all([
                db.from("appointments")
                    .select("start_time, leads!inner(name), products(name)")
                    .eq("organization_id", org.id)
                    .eq("status", "confirmed")
                    .gte("start_time", `${todayStr}T00:00:00`)
                    .lte("start_time", `${todayStr}T23:59:59`)
                    .order("start_time", { ascending: true }),
                db.from("leads")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", org.id)
                    .gte("created_at", `${yesterdayStr}T00:00:00`)
                    .lt("created_at", `${todayStr}T00:00:00`),
                db.from("leads")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", org.id)
                    .eq("is_bot_paused", true),
                // Actividad del agente hoy (para el resumen nocturno)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (db as any).from("analytics_events")
                    .select("event_type, metadata")
                    .eq("organization_id", org.id)
                    .in("event_type", ["handoff", "stage_changed", "appointment_booked", "bot_replied"])
                    .gte("created_at", `${todayStr}T00:00:00`)
                    .lte("created_at", `${todayStr}T23:59:59`)
                    .limit(2000),
            ]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const todayAppts = (apptsRes.data || []) as any[];
            const newLeads = newLeadsRes.count || 0;
            const waitingHuman = waitingRes.count || 0;

            // Actividad del agente hoy (Resumen Nocturno enriquecido)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const todayEvents = (eventsRes?.data || []) as any[];
            const botTurns = todayEvents.filter((e) => e.event_type === "bot_replied").length;
            const advancedByAi = todayEvents.filter(
                (e) => e.event_type === "stage_changed" && e.metadata?.by === "ai"
            ).length;
            const bookedToday = todayEvents.filter((e) => e.event_type === "appointment_booked").length;
            const handoffsToday = todayEvents.filter((e) => e.event_type === "handoff").length;

            // Nada que contar → no molestar al dueño
            if (
                todayAppts.length === 0 && newLeads === 0 && waitingHuman === 0 &&
                botTurns === 0 && handoffsToday === 0
            ) continue;

            const sections: string[] = [`☀️ *Tu resumen Xelera de hoy*`];

            // ── Lo que tu agente resolvió solo ──
            if (botTurns > 0 || advancedByAi > 0 || bookedToday > 0) {
                const done: string[] = [];
                if (botTurns > 0) done.push(`${botTurns} conversaci${botTurns === 1 ? "ón atendida" : "ones atendidas"}`);
                if (bookedToday > 0) done.push(`${bookedToday} cita${bookedToday === 1 ? "" : "s"} agendada${bookedToday === 1 ? "" : "s"}`);
                if (advancedByAi > 0) done.push(`${advancedByAi} lead${advancedByAi === 1 ? "" : "s"} avanzado${advancedByAi === 1 ? "" : "s"} de etapa`);
                sections.push(`\n🤖 *Tu agente hoy:* ${done.join(" · ")}`);
            }

            sections.push(
                `📈 ${newLeads} lead${newLeads === 1 ? "" : "s"} nuevo${newLeads === 1 ? "" : "s"} captado${newLeads === 1 ? "" : "s"}`
            );

            // ── Lo que requiere (o requirió) tu aprobación ──
            if (waitingHuman > 0 || handoffsToday > 0) {
                const parts: string[] = [];
                if (waitingHuman > 0) parts.push(`${waitingHuman} esperando tu respuesta AHORA en el Inbox`);
                if (handoffsToday > 0) parts.push(`${handoffsToday} pidieron humano hoy`);
                sections.push(`🙋 *Requieren tu atención:* ${parts.join(" · ")}`);
            }

            if (todayAppts.length > 0) {
                const lines = todayAppts.map((appt, i) => {
                    const apptInChile = new Date(
                        new Date(appt.start_time).toLocaleString("en-US", { timeZone: CHILE_TZ })
                    );
                    const time = `${pad(apptInChile.getHours())}:${pad(apptInChile.getMinutes())}`;
                    const leadName = (appt.leads as { name: string })?.name || "Sin nombre";
                    const productName = (appt.products as { name: string } | null)?.name || "";
                    return `${i + 1}. ${time} — ${leadName}${productName ? ` (${productName})` : ""}`;
                });
                sections.push(
                    `\n📅 *Citas de hoy (${todayAppts.length}):*\n${lines.join("\n")}`
                );
            } else {
                sections.push(`\n📅 Hoy no tienes citas agendadas.`);
            }

            sections.push(`\n¡Que tengas un excelente día! 💪`);

            const result = await sendWhatsAppMessage(
                org.id,
                config.owner_phone,
                sections.join("\n")
            );

            if (result.success) {
                sent++;
            } else {
                console.error(`[Digest] Failed for org ${org.id}:`, result.error);
            }
        } catch (err) {
            console.error(`[Digest] Error processing org ${org.id}:`, err);
        }
    }

    return sent;
}

// ── Job 4: Follow-up post-visita (48h después) ───────────────

async function sendPostVisitFollowUps(): Promise<number> {
    const db = getSupabaseAdmin();

    const now = new Date();
    const from = new Date(now.getTime() - 50 * 60 * 60 * 1000); // 50h ago
    const to = new Date(now.getTime() - 46 * 60 * 60 * 1000);   // 46h ago

    const { data: rawAppts, error } = await db
        .from("appointments")
        .select(
            "id, start_time, organization_id, lead_id, " +
            "leads!inner(name, phone), products(name)"
        )
        .eq("status", "completed")
        .gte("start_time", from.toISOString())
        .lte("start_time", to.toISOString());

    if (error) {
        console.error("[PostVisit] Query error:", error);
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appointments = (rawAppts || []) as any[];
    if (appointments.length === 0) return 0;

    let sent = 0;

    for (const appt of appointments) {
        try {
            const lead = appt.leads as { name: string; phone: string };
            if (!lead?.phone) continue;

            if (await wasSentRecently(appt.lead_id, "follow_up_post_visit", from.toISOString())) {
                continue;
            }

            const productName = (appt.products as { name: string } | null)?.name || "tu servicio";
            const leadName = lead.name?.split(" ")[0] || "";

            const result = await sendAutoTemplate({
                orgId: appt.organization_id,
                leadId: appt.lead_id,
                phone: lead.phone,
                event: "follow_up_post_visit",
                parameters: [leadName, productName],
            });

            if (result.sent) {
                sent++;
                console.log(`[PostVisit] Sent follow-up for appt ${appt.id} to ${lead.phone}`);
            }
        } catch (err) {
            console.error(`[PostVisit] Error processing appt ${appt.id}:`, err);
        }
    }

    return sent;
}

// ── Job 5: Reactivación de leads inactivos (7+ días) ─────────

async function sendInactiveLeadFollowUps(): Promise<number> {
    const db = getSupabaseAdmin();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveLeads, error } = await db
        .from("leads")
        .select("id, name, phone, organization_id, chat_status, updated_at")
        .in("chat_status", ["Interesado activo", "Negociando horario"])
        .lte("updated_at", sevenDaysAgo)
        .limit(50);

    if (error) {
        console.error("[InactiveLeads] Query error:", error);
        return 0;
    }

    if (!inactiveLeads || inactiveLeads.length === 0) return 0;

    let sent = 0;

    for (const lead of inactiveLeads) {
        try {
            if (!lead.phone) continue;

            if (await wasSentRecently(lead.id, "follow_up_inactive", fourteenDaysAgo)) {
                continue;
            }

            const leadName = lead.name?.split(" ")[0] || "";

            const result = await sendAutoTemplate({
                orgId: lead.organization_id,
                leadId: lead.id,
                phone: lead.phone,
                event: "follow_up_inactive",
                parameters: [leadName],
            });

            if (result.sent) {
                sent++;
                console.log(`[InactiveLeads] Sent reactivation to ${lead.phone} (lead ${lead.id})`);
            }
        } catch (err) {
            console.error(`[InactiveLeads] Error processing lead ${lead.id}:`, err);
        }
    }

    return sent;
}

// ── Job 6: Conversaciones estancadas (20-23h) ────────────────
// Si el bot respondió y el cliente no contestó en ~20h, se envía
// un empujón ANTES de que cierre la ventana de sesión de 24h de
// WhatsApp (después de eso, solo se puede contactar con template).

const STALLED_STATUSES = [
    "Contacto inicial",
    "Consultando opciones",
    "Filtrando perfil",
    "Interesado activo",
    "Negociando horario",
];

async function sendStalledConversationNudges(): Promise<number> {
    const db = getSupabaseAdmin();

    const now = Date.now();
    const windowStart = new Date(now - 23 * 60 * 60 * 1000).toISOString(); // 23h ago
    const windowEnd = new Date(now - 20 * 60 * 60 * 1000).toISOString();   // 20h ago
    const dedupSince = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 días

    // Mensajes del bot enviados hace 20-23h (candidatos a "sin respuesta")
    const { data: botMessages, error } = await db
        .from("lead_messages")
        .select("lead_id, created_at")
        .eq("role", "assistant")
        .gte("created_at", windowStart)
        .lte("created_at", windowEnd)
        .order("created_at", { ascending: false })
        .limit(300);

    if (error) {
        console.error("[Stalled] Query error:", error);
        return 0;
    }
    if (!botMessages || botMessages.length === 0) return 0;

    const candidateLeadIds = [...new Set(botMessages.map((m) => m.lead_id))].slice(0, 50);

    let sent = 0;

    for (const leadId of candidateLeadIds) {
        try {
            // El último mensaje de la conversación debe seguir siendo
            // ese mensaje del bot (nadie escribió después)
            const { data: lastMsgRows } = await db
                .from("lead_messages")
                .select("role, created_at")
                .eq("lead_id", leadId)
                .order("created_at", { ascending: false })
                .limit(1);

            const lastMsg = lastMsgRows?.[0];
            if (!lastMsg || lastMsg.role !== "assistant") continue;
            if (lastMsg.created_at > windowEnd) continue; // la conversación siguió

            // Lead elegible: estado temprano, bot activo, con teléfono
            const { data: lead } = await db
                .from("leads")
                .select("id, name, phone, organization_id, chat_status, is_bot_paused")
                .eq("id", leadId)
                .single();

            if (!lead || !lead.phone) continue;
            if (lead.is_bot_paused) continue;
            if (!STALLED_STATUSES.includes(lead.chat_status || "")) continue;

            // No repetir el empujón a un mismo lead en 5 días
            if (await wasSentRecently(lead.id, "warm_follow_up", dedupSince)) continue;

            // Respeta plan, master switch y quiet hours de la org
            const feature = await checkFeatureAccess(lead.organization_id, "auto_templates");
            if (!feature.allowed) continue;

            const config = await getAutoTemplateConfig(lead.organization_id);
            if (!config || !config.enabled) continue;
            if (isInQuietHours(config.quiet_hours)) continue;

            const firstName =
                lead.name && !/^lead/i.test(lead.name) ? lead.name.split(" ")[0] : "";

            const message =
                `¡Hola${firstName ? ` ${firstName}` : ""}! 👋 ` +
                `Quedé atento a tu consulta de ayer. ` +
                `¿Te gustaría que sigamos avanzando o tienes alguna otra pregunta? ` +
                `Estoy aquí para ayudarte. 😊`;

            const result = await sendWhatsAppMessage(
                lead.organization_id,
                lead.phone,
                message
            );

            await logSend(
                lead.organization_id,
                lead.id,
                "warm_follow_up",
                result.success,
                result.error
            );

            if (result.success) {
                // Persistir en el historial para que el Inbox (y la IA
                // en el próximo turno) vean el empujón
                const { data: nudgeMsg } = await db
                    .from("lead_messages")
                    .insert({
                        lead_id: lead.id,
                        role: "assistant",
                        content: message,
                    })
                    .select("id")
                    .single();

                // Outbox: vincular wamid para checks ✓/✓✓
                if (nudgeMsg?.id && result.providerMessageId) {
                    linkOutboundMessage(nudgeMsg.id, result.providerMessageId)
                        .catch(() => { /* no bloquear */ });
                }
                sent++;
                console.log(`[Stalled] Nudge sent to ${lead.phone} (lead ${lead.id})`);
            }
        } catch (err) {
            console.error(`[Stalled] Error processing lead ${leadId}:`, err);
        }
    }

    return sent;
}

// ── Handler compartido ───────────────────────────────────────

async function runAllJobs() {
    // Job 0 (primero, fuera del batch): rescatar lotes de mensajes
    // cuyo timer de debounce serverless murió sin procesarlos.
    let sweptBatches = 0;
    try {
        sweptBatches = await sweepStaleMessages();
    } catch (err) {
        captureError(err, "cron:sweeper");
    }

    const [
        remindersSent,
        oneHourSent,
        digestsSent,
        postVisitSent,
        inactiveSent,
        stalledSent,
    ] = await Promise.all([
        sendReminders(),
        sendOneHourReminders(),
        sendDailyDigests(),
        sendPostVisitFollowUps(),
        sendInactiveLeadFollowUps(),
        sendStalledConversationNudges(),
    ]);

    // Job final: consolidar métricas diarias (hoy + ayer, idempotente)
    let orgsAggregated = 0;
    try {
        orgsAggregated = await aggregateDailyMetrics();
    } catch (err) {
        captureError(err, "cron:aggregate");
    }

    // 🩺 Health-check de tokens Meta: cadencia diaria POR ORG
    // (el marcador meta_token_checked_at gobierna la frecuencia,
    // no la hora del cron — funciona con cron horario o diario)
    let tokenHealth = { orgsChecked: 0, alertsCreated: 0 };
    try {
        tokenHealth = await checkMetaTokenHealth();
    } catch (err) {
        captureError(err, "cron:token_health");
    }

    // ⚙️ Job 9: reglas de automatización temporales (schedule)
    let rulesExecuted = 0;
    try {
        rulesExecuted = await runScheduledRules();
    } catch (err) {
        captureError(err, "cron:rules");
    }

    console.log(
        `[Cron] Done — swept: ${sweptBatches}, 24h: ${remindersSent}, 1h: ${oneHourSent}, digests: ${digestsSent}, ` +
        `post_visit: ${postVisitSent}, inactive: ${inactiveSent}, stalled: ${stalledSent}, aggregated: ${orgsAggregated}, ` +
        `tokens: ${tokenHealth.orgsChecked} checked/${tokenHealth.alertsCreated} alerts`
    );

    return {
        automation_rules_executed: rulesExecuted,
        tokens_checked: tokenHealth.orgsChecked,
        token_alerts_created: tokenHealth.alertsCreated,
        orgs_metrics_aggregated: orgsAggregated,
        swept_message_batches: sweptBatches,
        reminders_24h_sent: remindersSent,
        reminders_1h_sent: oneHourSent,
        digests_sent: digestsSent,
        post_visit_follow_ups_sent: postVisitSent,
        inactive_lead_follow_ups_sent: inactiveSent,
        stalled_nudges_sent: stalledSent,
    };
}

async function handleCron(req: NextRequest) {
    if (!verifyCronAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await runAllJobs();
        return NextResponse.json(result);
    } catch (err) {
        console.error("[Cron] Unexpected error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Vercel Cron invoca GET; POST queda para crons externos/manuales
export async function GET(req: NextRequest) {
    return handleCron(req);
}

export async function POST(req: NextRequest) {
    return handleCron(req);
}

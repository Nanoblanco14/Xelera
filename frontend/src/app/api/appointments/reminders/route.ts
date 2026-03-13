// ═══════════════════════════════════════════════════════════════
//  Cron Endpoint: Appointment Reminders, Digest & Follow-ups
//  POST /api/appointments/reminders
//  Protected by CRON_SECRET — not user-authenticated
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendAutoTemplate } from "@/lib/auto-templates";
import { getAppointmentConfig, formatChileDate } from "@/lib/appointments";

const CHILE_TZ = "America/Santiago";

// ── Auth guard ───────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Job 1: 24-hour Reminders (upgraded to auto-template) ────

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
        console.error("[Reminders] Query error:", error);
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
                console.warn(`[Reminders] Appointment ${appt.id}: lead has no phone, skipping`);
                continue;
            }

            const productName = product?.name || "tu cita";
            const formattedDate = formatChileDate(appt.start_time);
            const leadName = lead.name?.split(" ")[0] || "";

            // Plain-text fallback message
            const fallbackMessage =
                `¡Hola${leadName ? ` ${leadName}` : ""}! 👋\n\n` +
                `Te recordamos que mañana tienes una cita agendada:\n\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `📋 Servicio: ${productName}\n\n` +
                `Si necesitas cancelar o reagendar, contáctanos con anticipación.\n` +
                `¡Te esperamos! 😊`;

            // Try auto-template first, fallback to plain text
            const result = await sendAutoTemplate({
                orgId: appt.organization_id,
                leadId: appt.lead_id,
                phone: lead.phone,
                event: "appointment_reminder",
                parameters: [leadName, productName, formattedDate],
                fallbackText: fallbackMessage,
            });

            if (result.sent) {
                // Mark reminder as sent
                await db
                    .from("appointments")
                    .update({ reminder_sent_at: new Date().toISOString() })
                    .eq("id", appt.id);
                sent++;
            } else {
                console.warn(
                    `[Reminders] Not sent to ${lead.phone} for appt ${appt.id}: ${result.reason}`
                );
            }
        } catch (err) {
            console.error(`[Reminders] Error processing appt ${appt.id}:`, err);
        }
    }

    return sent;
}

// ── Job 2: Daily Digest ──────────────────────────────────────

async function sendDailyDigests(): Promise<number> {
    const db = getSupabaseAdmin();

    // Get today's date in Chile timezone
    const nowInChile = new Date(
        new Date().toLocaleString("en-US", { timeZone: CHILE_TZ })
    );
    const year = nowInChile.getFullYear();
    const month = String(nowInChile.getMonth() + 1).padStart(2, "0");
    const day = String(nowInChile.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const currentHour = nowInChile.getHours();
    const currentMinute = nowInChile.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Get all confirmed appointments for today
    const dayStart = `${todayStr}T00:00:00`;
    const dayEnd = `${todayStr}T23:59:59`;

    const { data: rawDigestAppts, error } = await db
        .from("appointments")
        .select(
            "id, start_time, organization_id, " +
            "leads!inner(name), products(name)"
        )
        .eq("status", "confirmed")
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time", { ascending: true });

    if (error) {
        console.error("[Digest] Query error:", error);
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const digestAppts = (rawDigestAppts || []) as any[];
    if (digestAppts.length === 0) return 0;

    // Group by organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byOrg = new Map<string, any[]>();
    for (const appt of digestAppts) {
        const orgId = appt.organization_id as string;
        if (!byOrg.has(orgId)) byOrg.set(orgId, []);
        byOrg.get(orgId)!.push(appt);
    }

    let sent = 0;

    for (const [orgId, orgAppointments] of byOrg) {
        try {
            const config = await getAppointmentConfig(orgId);

            // Skip if digest is disabled or no owner phone
            if (!config.daily_digest_enabled) continue;
            if (!config.owner_phone) {
                console.warn(`[Digest] Org ${orgId}: daily_digest_enabled but no owner_phone`);
                continue;
            }

            // Check if current time is within +/-30 min of configured digest time
            const [digestHour, digestMinute] = config.daily_digest_time.split(":").map(Number);
            const digestTotalMinutes = digestHour * 60 + digestMinute;
            const diff = Math.abs(currentTotalMinutes - digestTotalMinutes);
            if (diff > 30) continue;

            // Build the summary message
            const lines: string[] = [];
            for (let i = 0; i < orgAppointments.length; i++) {
                const appt = orgAppointments[i];
                const lead = appt.leads as { name: string };
                const product = appt.products as { name: string } | null;

                // Extract time in Chile TZ
                const apptDate = new Date(appt.start_time);
                const apptInChile = new Date(
                    apptDate.toLocaleString("en-US", { timeZone: CHILE_TZ })
                );
                const hh = String(apptInChile.getHours()).padStart(2, "0");
                const mm = String(apptInChile.getMinutes()).padStart(2, "0");
                const timeStr = `${hh}:${mm}`;

                const leadName = lead?.name || "Sin nombre";
                const productName = product?.name || "Sin servicio";

                lines.push(`${i + 1}. ${timeStr} - ${leadName} - ${productName}`);
            }

            const total = orgAppointments.length;
            const message =
                `Buenos d\u00edas! Aqu\u00ed tu resumen de citas para hoy:\n\n` +
                lines.join("\n") +
                `\n\nTotal: ${total} cita${total === 1 ? "" : "s"} programada${total === 1 ? "" : "s"}.\n` +
                `\u00a1Que tengas un excelente d\u00eda!`;

            const result = await sendWhatsAppMessage(orgId, config.owner_phone, message);

            if (result.success) {
                sent++;
            } else {
                console.error(
                    `[Digest] Failed to send digest for org ${orgId}:`,
                    result.error
                );
            }
        } catch (err) {
            console.error(`[Digest] Error processing org ${orgId}:`, err);
        }
    }

    return sent;
}

// ── Job 3: Follow-up Post-Visit (48h after completed appointment) ──

async function sendPostVisitFollowUps(): Promise<number> {
    const db = getSupabaseAdmin();

    const now = new Date();
    const from = new Date(now.getTime() - 50 * 60 * 60 * 1000); // 50h ago
    const to = new Date(now.getTime() - 46 * 60 * 60 * 1000);   // 46h ago

    // Find completed appointments in the 46-50h window
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

            const productName = (appt.products as { name: string } | null)?.name || "tu servicio";
            const leadName = lead.name?.split(" ")[0] || "";

            // Check if we already sent a follow-up for this lead (dedup via template_send_log)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existing } = await (db as any)
                .from("template_send_log")
                .select("id")
                .eq("lead_id", appt.lead_id)
                .eq("event", "follow_up_post_visit")
                .eq("success", true)
                .gte("sent_at", from.toISOString())
                .limit(1);

            if (existing && existing.length > 0) continue; // already sent

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

// ── Job 4: Inactive Lead Reactivation (7+ days no activity) ──

async function sendInactiveLeadFollowUps(): Promise<number> {
    const db = getSupabaseAdmin();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Find leads whose last message is older than 7 days
    // Only leads with chat_status indicating active interest
    const { data: inactiveLeads, error } = await db
        .from("leads")
        .select("id, name, phone, organization_id, chat_status, updated_at")
        .in("chat_status", ["Interesado activo", "Negociando horario"])
        .lte("updated_at", sevenDaysAgo)
        .limit(50); // process in batches

    if (error) {
        console.error("[InactiveLeads] Query error:", error);
        return 0;
    }

    if (!inactiveLeads || inactiveLeads.length === 0) return 0;

    let sent = 0;

    for (const lead of inactiveLeads) {
        try {
            if (!lead.phone) continue;

            // Check we haven't sent an inactive follow-up in the last 14 days
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: recentSend } = await (db as any)
                .from("template_send_log")
                .select("id")
                .eq("lead_id", lead.id)
                .eq("event", "follow_up_inactive")
                .eq("success", true)
                .gte("sent_at", fourteenDaysAgo)
                .limit(1);

            if (recentSend && recentSend.length > 0) continue; // skip — already sent recently

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

// ── POST Handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
    if (!verifyCronAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [remindersSent, digestsSent, postVisitSent, inactiveSent] = await Promise.all([
            sendReminders(),
            sendDailyDigests(),
            sendPostVisitFollowUps(),
            sendInactiveLeadFollowUps(),
        ]);

        console.log(
            `[Cron] Done — reminders: ${remindersSent}, digests: ${digestsSent}, post_visit: ${postVisitSent}, inactive: ${inactiveSent}`
        );

        return NextResponse.json({
            reminders_sent: remindersSent,
            digests_sent: digestsSent,
            post_visit_follow_ups_sent: postVisitSent,
            inactive_lead_follow_ups_sent: inactiveSent,
        });
    } catch (err) {
        console.error("[Cron] Unexpected error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

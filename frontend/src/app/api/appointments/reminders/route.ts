// ═══════════════════════════════════════════════════════════════
//  Cron Endpoint: Appointment Reminders & Daily Digest
//  POST /api/appointments/reminders
//  Protected by CRON_SECRET — not user-authenticated
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAppointmentConfig, formatChileDate } from "@/lib/appointments";

const CHILE_TZ = "America/Santiago";

// ── Auth guard ───────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Job 1: 24-hour Reminders ─────────────────────────────────

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

            const message =
                `¡Hola${leadName ? ` ${leadName}` : ""}! 👋\n\n` +
                `Te recordamos que mañana tienes una cita agendada:\n\n` +
                `📅 Fecha: ${formattedDate}\n` +
                `📋 Servicio: ${productName}\n\n` +
                `Si necesitas cancelar o reagendar, contáctanos con anticipación.\n` +
                `¡Te esperamos! 😊`;

            const result = await sendWhatsAppMessage(
                appt.organization_id,
                lead.phone,
                message
            );

            if (result.success) {
                // Mark reminder as sent
                await db
                    .from("appointments")
                    .update({ reminder_sent_at: new Date().toISOString() })
                    .eq("id", appt.id);
                sent++;
            } else {
                console.error(
                    `[Reminders] Failed to send to ${lead.phone} for appt ${appt.id}:`,
                    result.error
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

// ── POST Handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
    if (!verifyCronAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [remindersSent, digestsSent] = await Promise.all([
            sendReminders(),
            sendDailyDigests(),
        ]);

        console.log(
            `[Cron:Reminders] Done — reminders_sent: ${remindersSent}, digests_sent: ${digestsSent}`
        );

        return NextResponse.json({
            reminders_sent: remindersSent,
            digests_sent: digestsSent,
        });
    } catch (err) {
        console.error("[Cron:Reminders] Unexpected error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

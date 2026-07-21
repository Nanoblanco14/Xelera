// ═══════════════════════════════════════════════════════════════
//  📊 REPORTE DE IMPACTO SEMANAL (Executive) — ROI por WhatsApp
//
//  Cada lunes (Chile) el dueño recibe las métricas de la semana
//  desde daily_org_metrics, con Δ vs. la semana anterior y las
//  HORAS EJECUTIVAS AHORRADAS (bot_replies × min/chat ÷ 60).
//
//  Cadencia semanal por org vía impact_report_sent_at (columna
//  atómica, patrón token-health) — funciona con cron horario o
//  diario. Gated por flag impact_report_weekly del plan.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getPlanLimits } from "@/lib/plan-limits";
import { captureError } from "@/lib/monitoring";

const CHILE_TZ = "America/Santiago";
// Minutos ejecutivos que consume responder un chat a mano
// (conservador; alineado con el cálculo del dashboard)
const AVG_MINUTES_PER_REPLY = 5;
const WEEK_MS = 7 * 24 * 3600 * 1000;

interface WeekTotals {
    conversations: number;
    botReplies: number;
    appointments: number;
    leads: number;
    handoffs: number;
}

function emptyTotals(): WeekTotals {
    return { conversations: 0, botReplies: 0, appointments: 0, leads: 0, handoffs: 0 };
}

async function sumWeek(orgId: string, fromDate: string, toDate: string): Promise<WeekTotals> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
        .from("daily_org_metrics")
        .select("active_conversations, bot_replies, appointments_booked, leads_created, handoffs")
        .eq("organization_id", orgId)
        .gte("metric_date", fromDate)
        .lt("metric_date", toDate);

    const t = emptyTotals();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data || []) as any[]) {
        t.conversations += r.active_conversations || 0;
        t.botReplies += r.bot_replies || 0;
        t.appointments += r.appointments_booked || 0;
        t.leads += r.leads_created || 0;
        t.handoffs += r.handoffs || 0;
    }
    return t;
}

function dateStr(d: Date): string {
    const inChile = new Date(d.toLocaleString("en-US", { timeZone: CHILE_TZ }));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${inChile.getFullYear()}-${pad(inChile.getMonth() + 1)}-${pad(inChile.getDate())}`;
}

function delta(curr: number, prev: number): string {
    if (prev === 0) return curr > 0 ? " (nuevo ↑)" : "";
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct === 0) return " (= sem. anterior)";
    return pct > 0 ? ` (↑${pct}%)` : ` (↓${Math.abs(pct)}%)`;
}

function hoursSaved(botReplies: number): number {
    return Math.round((botReplies * AVG_MINUTES_PER_REPLY) / 60 * 10) / 10;
}

function buildReport(orgName: string, week: WeekTotals, prev: WeekTotals): string {
    const saved = hoursSaved(week.botReplies);
    const resolution = week.conversations > 0
        ? Math.round((1 - Math.min(week.handoffs / week.conversations, 1)) * 100)
        : null;

    return (
        `📊 *Reporte de Impacto Xelera — ${orgName}*\n` +
        `_Semana del ${dateStr(new Date(Date.now() - WEEK_MS))} al ${dateStr(new Date(Date.now() - 86_400_000))}_\n\n` +
        `⏱️ *Horas ejecutivas ahorradas: ${saved} hrs*${delta(week.botReplies, prev.botReplies)}\n` +
        `_(${week.botReplies} respuestas × ${AVG_MINUTES_PER_REPLY} min que NO tuviste que escribir)_\n\n` +
        `💬 Chats atendidos: ${week.conversations}${delta(week.conversations, prev.conversations)}\n` +
        `📅 Citas agendadas: ${week.appointments}${delta(week.appointments, prev.appointments)}\n` +
        `📈 Leads nuevos: ${week.leads}${delta(week.leads, prev.leads)}\n` +
        (resolution !== null
            ? `🤖 Resueltos sin tu intervención: ${resolution}%\n`
            : "") +
        `\nTu agente trabajó mientras tú dirigías. Revisa el detalle en tu dashboard de Analítica.`
    );
}

export interface ImpactReportResult {
    reportsSent: number;
}

/**
 * Job del cron: envía el reporte a orgs con el flag del plan, con
 * owner_phone configurado, los lunes (o si pasaron >8 días — lunes
 * perdido por cron Hobby). Cadencia via impact_report_sent_at.
 */
export async function sendWeeklyImpactReports(): Promise<ImpactReportResult> {
    const result: ImpactReportResult = { reportsSent: 0 };

    try {
        const db = getSupabaseAdmin();

        const nowChile = new Date(new Date().toLocaleString("en-US", { timeZone: CHILE_TZ }));
        const isMonday = nowChile.getDay() === 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgs, error } = await (db as any)
            .from("organizations")
            .select("id, name, plan, settings, impact_report_sent_at")
            .not("plan", "eq", "free");

        if (error) {
            // Columna inexistente → migración fase B pendiente
            if (/impact_report_sent_at|column/i.test(error.message || "")) {
                console.warn("[ImpactReport] Ejecuta la migración 20260707_fase_b_executive.sql");
            }
            return result;
        }

        const now = Date.now();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const org of (orgs || []) as any[]) {
            try {
                // ── Gate por plan ──
                if (!getPlanLimits(org.plan).impact_report_weekly) continue;

                // ── Cadencia semanal ──
                const lastSent = org.impact_report_sent_at
                    ? new Date(org.impact_report_sent_at).getTime()
                    : 0;
                const daysSince = (now - lastSent) / 86_400_000;
                // Lunes con ≥6 días desde el último, o rescate a los 8+
                if (!(isMonday && daysSince >= 6) && daysSince < 8) continue;

                // ── Destino ──
                const ownerPhone = (
                    (org.settings?.appointment_config || {}) as Record<string, string>
                ).owner_phone;
                if (!ownerPhone) continue;

                // ── Datos: semana actual vs. anterior ──
                const today = dateStr(new Date());
                const weekAgo = dateStr(new Date(now - WEEK_MS));
                const twoWeeksAgo = dateStr(new Date(now - 2 * WEEK_MS));

                const [week, prev] = await Promise.all([
                    sumWeek(org.id, weekAgo, today),
                    sumWeek(org.id, twoWeeksAgo, weekAgo),
                ]);

                // Semana sin actividad → no enviar reporte vacío
                if (week.botReplies === 0 && week.leads === 0 && week.appointments === 0) {
                    continue;
                }

                const message = buildReport(org.name, week, prev);
                const sendResult = await sendWhatsAppMessage(org.id, ownerPhone, message);

                if (sendResult.success) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (db as any)
                        .from("organizations")
                        .update({ impact_report_sent_at: new Date().toISOString() })
                        .eq("id", org.id);
                    result.reportsSent++;
                    console.log(`📊 [ImpactReport] Enviado a ${org.name} (${hoursSaved(week.botReplies)}h ahorradas)`);
                } else {
                    captureError(
                        new Error(sendResult.error || "send_failed"),
                        "impact_report:send",
                        { orgId: org.id }
                    );
                }
            } catch (err) {
                captureError(err, "impact_report:org", { orgId: org.id });
            }
        }
    } catch (err) {
        captureError(err, "impact_report:job");
    }

    return result;
}

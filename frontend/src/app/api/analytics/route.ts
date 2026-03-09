import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// ── GET /api/analytics?org_id=xxx ─────────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("analytics:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();

        // Fetch all leads for this org
        const { data: leads, error: leadsError } = await db
            .from("leads")
            .select("id, stage_id, appointment_date, source, created_at")
            .eq("organization_id", orgId);
        if (leadsError) throw leadsError;

        // Fetch all stages for this org (ordered by position)
        const { data: stages, error: stagesError } = await db
            .from("pipeline_stages")
            .select("id, name, color, position")
            .eq("organization_id", orgId)
            .order("position", { ascending: true });
        if (stagesError) throw stagesError;

        // Fetch AI-sent messages (with timestamps for peak hours)
        const leadIds = (leads || []).map((l) => l.id);
        let aiMessages = 0;
        let allMessages: { role: string; created_at: string }[] = [];
        if (leadIds.length > 0) {
            const { count, error: msgError } = await db
                .from("lead_messages")
                .select("id", { count: "exact", head: true })
                .eq("role", "assistant")
                .in("lead_id", leadIds);
            if (!msgError) aiMessages = count ?? 0;

            // Fetch message timestamps for peak hours analysis
            const { data: msgData } = await db
                .from("lead_messages")
                .select("role, created_at")
                .in("lead_id", leadIds)
                .order("created_at", { ascending: true });
            allMessages = msgData || [];
        }

        const allLeads = leads || [];
        const allStages = stages || [];

        // ── KPI Calculations ───────────────────────────────────
        const totalLeads = allLeads.length;

        const appointmentKeywords = ["visita", "cita", "agendad", "reuni", "appointment"];
        const appointmentStageIds = new Set(
            allStages
                .filter((s) =>
                    appointmentKeywords.some((k) => s.name.toLowerCase().includes(k))
                )
                .map((s) => s.id)
        );
        const citasAgendadas = allLeads.filter((l) =>
            appointmentStageIds.has(l.stage_id)
        ).length;

        const lastStage = allStages.length > 0 ? allStages[allStages.length - 1] : null;
        const successfulLeads = lastStage
            ? allLeads.filter((l) => l.stage_id === lastStage.id).length
            : 0;
        const lastStageName = lastStage?.name ?? "Etapa final";

        const discardedStageIds = new Set(
            allStages
                .filter((s) =>
                    s.name.toLowerCase().includes("descart") ||
                    s.name.toLowerCase().includes("cancelad") ||
                    s.name.toLowerCase().includes("no asist")
                )
                .map((s) => s.id)
        );
        const discardedLeads = allLeads.filter((l) =>
            discardedStageIds.has(l.stage_id)
        ).length;

        const conversionRate =
            totalLeads > 0
                ? Math.round((citasAgendadas / totalLeads) * 100 * 10) / 10
                : 0;

        const timeSavedMinutes = allLeads.length * 15;
        const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

        const leadsByStage = allStages.map((stage) => ({
            stage_id: stage.id,
            stage_name: stage.name,
            color: stage.color || null,
            count: allLeads.filter((l) => l.stage_id === stage.id).length,
        }));

        const sourceMap: Record<string, number> = {};
        allLeads.forEach((l) => {
            const src = l.source || "manual";
            sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({
            source,
            count,
        }));

        // ── Leads trend (last 30 days) ───────────────────────────
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 29);
        const leadsTrend: { date: string; leads: number; messages: number }[] = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(thirtyDaysAgo);
            d.setDate(thirtyDaysAgo.getDate() + i);
            const dateStr = d.toISOString().slice(0, 10);
            const leadsCount = allLeads.filter(
                (l) => l.created_at && l.created_at.slice(0, 10) === dateStr
            ).length;
            const msgsCount = allMessages.filter(
                (m) => m.created_at && m.created_at.slice(0, 10) === dateStr
            ).length;
            leadsTrend.push({
                date: dateStr,
                leads: leadsCount,
                messages: msgsCount,
            });
        }

        // ── Peak hours (0-23) ────────────────────────────────────
        const peakHours: { hour: number; count: number }[] = Array.from(
            { length: 24 },
            (_, h) => ({ hour: h, count: 0 })
        );
        allMessages
            .filter((m) => m.role === "user")
            .forEach((m) => {
                const h = new Date(m.created_at).getHours();
                peakHours[h].count += 1;
            });

        // ── Pipeline funnel ──────────────────────────────────────
        const funnel = allStages.map((stage, idx) => {
            const count = allLeads.filter((l) => l.stage_id === stage.id).length;
            return {
                stage_name: stage.name,
                color: stage.color || null,
                count,
                percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
                position: idx,
            };
        });

        return NextResponse.json({
            data: {
                totalLeads,
                citasAgendadas,
                successfulLeads,
                lastStageName,
                discardedLeads,
                conversionRate,
                aiMessages,
                timeSavedMinutes,
                timeSavedHours,
                leadsByStage,
                leadsBySource,
                leadsTrend,
                peakHours,
                funnel,
            },
        });
    } catch (err) {
        return serverError(err, "analytics:GET");
    }
}

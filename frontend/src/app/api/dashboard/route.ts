import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";

// ── GET /api/dashboard?org_id=xxx ─────────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("dashboard:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();

        // ── Parallel queries for performance ────────────────────
        const [
            leadsResult,
            stagesResult,
            agentResult,
            productsCountResult,
            orgResult,
        ] = await Promise.all([
            // All leads
            db
                .from("leads")
                .select("id, name, phone, stage_id, source, created_at")
                .eq("organization_id", orgId)
                .order("created_at", { ascending: false }),

            // Pipeline stages
            db
                .from("pipeline_stages")
                .select("id, name, color, position")
                .eq("organization_id", orgId)
                .order("position", { ascending: true }),

            // Agent (maybeSingle avoids error when 0 rows; order by is_active DESC to prefer active ones)
            db
                .from("agents")
                .select("id, name, is_active, model, welcome_message, conversation_tone")
                .eq("organization_id", orgId)
                .order("is_active", { ascending: false })
                .limit(1)
                .maybeSingle(),

            // Product count (active)
            db
                .from("products")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", orgId)
                .eq("status", "active"),

            // Org settings (for checklist — WhatsApp config, FAQs)
            db
                .from("organizations")
                .select("whatsapp_credentials, settings")
                .eq("id", orgId)
                .single(),
        ]);

        if (leadsResult.error) throw leadsResult.error;
        if (stagesResult.error) throw stagesResult.error;

        const allLeads = leadsResult.data || [];
        const allStages = stagesResult.data || [];
        const agent = agentResult.data || null;
        const productCount = productsCountResult.count ?? 0;
        const orgData = orgResult.data || null;

        // ── Setup checklist computation ─────────────────────────
        const orgSettings = (orgData?.settings || {}) as Record<string, unknown>;
        const whatsappCreds = (orgData?.whatsapp_credentials || {}) as Record<string, string>;
        const faqsList = (orgSettings.faqs || []) as unknown[];
        const hasWhatsApp = !!(whatsappCreds.phone_number_id || whatsappCreds.account_sid);
        const hasAgent = !!agent;
        const hasProducts = productCount > 0;
        const hasPipeline = allStages.length > 0;
        const hasFaqs = faqsList.length > 0;
        const hasSystemPrompt = !!(agent && (agent as Record<string, unknown>).welcome_message);

        const checklist = {
            agent: hasAgent,
            products: hasProducts,
            whatsapp: hasWhatsApp,
            pipeline: hasPipeline,
            faqs: hasFaqs,
        };
        const checklistTotal = Object.values(checklist).filter(Boolean).length;
        const checklistMax = Object.keys(checklist).length;

        // ── AI messages count ──────────────────────────────────
        const leadIds = allLeads.map((l) => l.id);
        let aiMessages = 0;
        if (leadIds.length > 0) {
            const { count, error: msgError } = await db
                .from("lead_messages")
                .select("id", { count: "exact", head: true })
                .eq("role", "assistant")
                .in("lead_id", leadIds);
            if (!msgError) aiMessages = count ?? 0;
        }

        // ── KPI calculations ──────────────────────────────────
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

        const conversionRate =
            totalLeads > 0
                ? Math.round((citasAgendadas / totalLeads) * 100 * 10) / 10
                : 0;

        const timeSavedMinutes = totalLeads * 15;
        const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

        // ── Leads by stage (for mini pipeline) ────────────────
        const leadsByStage = allStages.map((stage) => ({
            stage_id: stage.id,
            stage_name: stage.name,
            color: stage.color || null,
            count: allLeads.filter((l) => l.stage_id === stage.id).length,
        }));

        // ── Recent leads (last 5) with stage info ─────────────
        const stageMap = new Map(allStages.map((s) => [s.id, s]));
        const recentLeads = allLeads.slice(0, 5).map((lead) => {
            const stage = stageMap.get(lead.stage_id);
            return {
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                source: lead.source || "manual",
                created_at: lead.created_at,
                stage_name: stage?.name || "Sin etapa",
                stage_color: stage?.color || null,
            };
        });

        // ── Lead sources ──────────────────────────────────────
        const sourceMap: Record<string, number> = {};
        allLeads.forEach((l) => {
            const src = l.source || "manual";
            sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({
            source,
            count,
        }));

        return NextResponse.json({
            data: {
                // KPIs
                totalLeads,
                citasAgendadas,
                conversionRate,
                aiMessages,
                timeSavedMinutes,
                timeSavedHours,

                // Product count
                productCount,

                // Pipeline distribution
                leadsByStage,
                leadsBySource,

                // Recent leads
                recentLeads,

                // Agent info
                agent: agent
                    ? {
                        id: agent.id,
                        name: agent.name,
                        is_active: agent.is_active,
                        model: agent.model,
                        welcome_message: agent.welcome_message,
                        conversation_tone: agent.conversation_tone,
                    }
                    : null,

                // Setup checklist
                checklist,
                checklistTotal,
                checklistMax,
            },
        });
    } catch (err) {
        return serverError(err, "dashboard:GET");
    }
}

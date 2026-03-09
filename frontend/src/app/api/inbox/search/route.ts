import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";

// ── GET /api/inbox/search?org_id=xxx&q=query ────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("inbox-search:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        const query = req.nextUrl.searchParams.get("q");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");
        if (!query || query.trim().length < 2)
            return apiError("q must be at least 2 characters", 400, "INVALID_QUERY");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const q = query.trim().toLowerCase();

        // 1. Find leads matching by name or phone
        const { data: leads, error: leadsErr } = await db
            .from("leads")
            .select("id, name, phone, stage_id, source, chat_status, is_bot_paused, created_at")
            .eq("organization_id", orgId)
            .eq("source", "whatsapp");
        if (leadsErr) throw leadsErr;

        const allLeads = leads || [];
        if (allLeads.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 2. Search messages for content matches
        const leadIds = allLeads.map((l) => l.id);
        const { data: matchingMsgs, error: msgErr } = await db
            .from("lead_messages")
            .select("id, lead_id, role, content, created_at")
            .in("lead_id", leadIds)
            .ilike("content", `%${q}%`)
            .order("created_at", { ascending: false })
            .limit(100);
        if (msgErr) throw msgErr;

        // 3. Build results: leads matching name/phone + leads with matching messages
        const leadNameMatches = new Set(
            allLeads
                .filter(
                    (l) =>
                        l.name?.toLowerCase().includes(q) ||
                        l.phone?.includes(q)
                )
                .map((l) => l.id)
        );

        const msgMatchesByLead = new Map<
            string,
            { content: string; role: string; created_at: string }[]
        >();
        (matchingMsgs || []).forEach((msg) => {
            if (!msgMatchesByLead.has(msg.lead_id)) {
                msgMatchesByLead.set(msg.lead_id, []);
            }
            msgMatchesByLead.get(msg.lead_id)!.push({
                content: msg.content,
                role: msg.role,
                created_at: msg.created_at,
            });
        });

        // Combine results
        const relevantLeadIds = new Set([
            ...leadNameMatches,
            ...msgMatchesByLead.keys(),
        ]);

        // Get stage info for relevant leads
        const { data: stages } = await db
            .from("pipeline_stages")
            .select("id, name, color")
            .eq("organization_id", orgId);
        const stageMap = new Map(
            (stages || []).map((s) => [s.id, { name: s.name, color: s.color }])
        );

        const results = allLeads
            .filter((l) => relevantLeadIds.has(l.id))
            .map((lead) => {
                const stage = stageMap.get(lead.stage_id);
                const snippets = (msgMatchesByLead.get(lead.id) || [])
                    .slice(0, 3)
                    .map((m) => ({
                        content:
                            m.content.length > 120
                                ? m.content.slice(0, 120) + "..."
                                : m.content,
                        role: m.role,
                        created_at: m.created_at,
                    }));

                return {
                    lead_id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    stage_name: stage?.name || "Sin etapa",
                    stage_color: stage?.color || null,
                    is_bot_paused: lead.is_bot_paused || false,
                    match_type: leadNameMatches.has(lead.id)
                        ? snippets.length > 0
                            ? "both"
                            : "contact"
                        : "message",
                    snippets,
                    snippet_count: (msgMatchesByLead.get(lead.id) || []).length,
                };
            })
            .sort((a, b) => {
                // Prioritize: both > contact > message
                const priority = { both: 0, contact: 1, message: 2 };
                return (
                    priority[a.match_type as keyof typeof priority] -
                    priority[b.match_type as keyof typeof priority]
                );
            });

        return NextResponse.json({ data: results });
    } catch (err) {
        return serverError(err, "inbox-search:GET");
    }
}

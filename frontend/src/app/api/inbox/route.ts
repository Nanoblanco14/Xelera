import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";

// ── GET /api/inbox?org_id=xxx ─────────────────────────────
// Returns leads that have WhatsApp messages, with latest message info
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("inbox:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();

        // Get all leads with their message count and latest message
        const { data: leads, error: leadsError } = await db
            .from("leads")
            .select(`
                id, name, phone, source, stage_id, chat_status,
                is_bot_paused, created_at,
                pipeline_stages!inner(name, color)
            `)
            .eq("organization_id", orgId)
            .eq("source", "whatsapp")
            .order("created_at", { ascending: false });

        if (leadsError) throw leadsError;

        if (!leads || leads.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // For each lead, get latest message and message count
        const leadIds = leads.map((l) => l.id);

        const { data: allMessages, error: msgError } = await db
            .from("lead_messages")
            .select("id, lead_id, role, content, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false });

        if (msgError) throw msgError;

        // Group messages by lead
        const messagesByLead = new Map<string, typeof allMessages>();
        for (const msg of allMessages || []) {
            const existing = messagesByLead.get(msg.lead_id) || [];
            existing.push(msg);
            messagesByLead.set(msg.lead_id, existing);
        }

        // Build response with conversations sorted by latest activity
        const conversations = leads
            .map((lead) => {
                const msgs = messagesByLead.get(lead.id) || [];
                const latestMsg = msgs[0] || null;
                const unreadCount = msgs.filter(
                    (m) => m.role === "user"
                ).length; // Simplified: count user messages

                const stage = Array.isArray(lead.pipeline_stages)
                    ? lead.pipeline_stages[0]
                    : lead.pipeline_stages;

                return {
                    lead_id: lead.id,
                    name: lead.name || "Sin nombre",
                    phone: lead.phone,
                    chat_status: lead.chat_status,
                    is_bot_paused: lead.is_bot_paused || false,
                    stage_name: stage?.name || "Sin etapa",
                    stage_color: stage?.color || null,
                    message_count: msgs.length,
                    last_message: latestMsg
                        ? {
                            content: latestMsg.content,
                            role: latestMsg.role,
                            created_at: latestMsg.created_at,
                        }
                        : null,
                    created_at: lead.created_at,
                    last_activity: latestMsg?.created_at || lead.created_at,
                };
            })
            .filter((c) => c.message_count > 0)
            .sort(
                (a, b) =>
                    new Date(b.last_activity).getTime() -
                    new Date(a.last_activity).getTime()
            );

        return NextResponse.json({ data: conversations });
    } catch (err) {
        return serverError(err, "inbox:GET");
    }
}

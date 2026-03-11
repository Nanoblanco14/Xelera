import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// GET /api/inbox/unread?org_id=xxx
// Returns count of conversations where the last message is from 'user' (needs attention)
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("inbox-unread:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const sb = getSupabaseAdmin();

        // Get all leads for this org that have messages
        const { data: leads, error: leadsError } = await sb
            .from("leads")
            .select("id")
            .eq("organization_id", orgId);

        if (leadsError || !leads) {
            return NextResponse.json({ count: 0 });
        }

        if (leads.length === 0) {
            return NextResponse.json({ count: 0 });
        }

        // For each lead, get the last message and check if it's from 'user'
        let pendingCount = 0;

        // Batch: get the latest message per lead
        const leadIds = leads.map((l) => l.id);

        const { data: messages, error: msgError } = await sb
            .from("lead_messages")
            .select("lead_id, role, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false });

        if (msgError || !messages) {
            return NextResponse.json({ count: 0 });
        }

        // Group by lead_id and get the latest message role
        const latestByLead = new Map<string, string>();
        for (const msg of messages) {
            if (!latestByLead.has(msg.lead_id)) {
                latestByLead.set(msg.lead_id, msg.role);
            }
        }

        // Count leads where latest message is from 'user' (customer waiting for response)
        for (const [, role] of latestByLead) {
            if (role === "user") {
                pendingCount++;
            }
        }

        return NextResponse.json({ count: pendingCount });
    } catch (err) {
        return serverError(err, "inbox-unread:GET");
    }
}

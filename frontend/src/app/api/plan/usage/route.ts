import { NextResponse } from "next/server";
import { authenticateRequest, serverError } from "@/lib/api-auth";
import { getOrgUsage } from "@/lib/plan-limits";

// ═══════════════════════════════════════════════════════════════
//  GET /api/plan/usage — Get org plan + usage stats
// ═══════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const result = await authenticateRequest("plan-usage:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const usage = await getOrgUsage(auth.orgId);

        return NextResponse.json(usage);
    } catch (err) {
        return serverError(err, "plan-usage:GET");
    }
}

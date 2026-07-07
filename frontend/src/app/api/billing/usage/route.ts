// ── GET /api/billing/usage?org_id=xxx ───────────────────────
// Consumo IA del mes vs. presupuesto del plan + costo estimado.
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import { checkAiBudget } from "@/lib/plan-limits";
import { estimateCostUsd } from "@/lib/analytics";

export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("billing:usage");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");
        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const budget = await checkAiBudget(orgId);

        return NextResponse.json({
            data: {
                ...budget,
                // Aproximación: tokens del mes a precio de gpt-4o-mini
                // (ratio 3:1 prompt/completion típico del pipeline)
                estimatedCostUsd:
                    Math.round(estimateCostUsd("gpt-4o-mini", budget.used * 0.75, budget.used * 0.25) * 100) / 100,
            },
        });
    } catch (err) {
        return serverError(err, "billing:usage");
    }
}

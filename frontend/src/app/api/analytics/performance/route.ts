import { NextRequest, NextResponse } from "next/server";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";
import { getPerformanceStats } from "@/lib/analytics";

// ── GET /api/analytics/performance?org_id=xxx&days=14 ───────
// KPIs de rendimiento del agente IA: latencia percibida, tasa de
// resolución sin humano, tokens y costo estimado, más la serie
// diaria para el gráfico de tendencia.
//
// Histórico: daily_org_metrics (mantenido por el cron).
// HOY: calculado en vivo desde analytics_events + ai_usage_log.
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("analytics:performance");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const daysParam = Number(req.nextUrl.searchParams.get("days"));
        const days = Number.isFinite(daysParam)
            ? Math.min(Math.max(daysParam, 1), 30)
            : 14;

        const stats = await getPerformanceStats(orgId, days);

        return NextResponse.json({ data: stats });
    } catch (err) {
        return serverError(err, "analytics:performance");
    }
}

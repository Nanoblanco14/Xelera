import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import { getAvailableSlots } from "@/lib/appointments";

// ── GET /api/appointments/availability?org_id=xxx&date=2026-03-15&duration=60
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("appointments-availability:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const date = req.nextUrl.searchParams.get("date");
        if (!date) return apiError("date required", 400, "MISSING_PARAM");

        const durationParam = req.nextUrl.searchParams.get("duration");
        const duration = durationParam ? parseInt(durationParam, 10) : 60;

        if (isNaN(duration) || duration <= 0) {
            return apiError("duration must be a positive number", 400, "INVALID_PARAM");
        }

        const slots = await getAvailableSlots(orgId, date, duration);

        return NextResponse.json({ data: { slots, date } });
    } catch (err) {
        return serverError(err, "appointments-availability:GET");
    }
}

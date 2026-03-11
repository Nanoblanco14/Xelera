import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getBusinessHours } from "@/lib/appointments";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import type { BusinessDay } from "@/lib/types";

// ── GET /api/business-hours?org_id=xxx ──────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("business-hours:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const data = await getBusinessHours(orgId);
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "business-hours:GET");
    }
}

// ── PUT /api/business-hours ─────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const result = await authenticateRequest("business-hours:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { organization_id, hours } = body as {
            organization_id: string;
            hours: BusinessDay[];
        };

        if (!organization_id || !hours) {
            return apiError("organization_id and hours required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        if (!Array.isArray(hours) || hours.length !== 7) {
            return apiError("hours must be an array of 7 days", 400, "INVALID_HOURS");
        }

        // Validate time ranges for each open day
        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        for (const h of hours) {
            if (!h.is_open) continue;

            if (h.open_time >= h.close_time) {
                return apiError(
                    `Horario inválido para ${dayNames[h.day_of_week]}: la hora de apertura debe ser anterior a la hora de cierre`,
                    400,
                    "INVALID_HOURS"
                );
            }

            if (h.break_start && h.break_end) {
                if (h.break_start >= h.break_end) {
                    return apiError(
                        `Horario inválido para ${dayNames[h.day_of_week]}: el inicio de la pausa debe ser anterior al fin de la pausa`,
                        400,
                        "INVALID_HOURS"
                    );
                }
                if (h.break_start < h.open_time || h.break_end > h.close_time) {
                    return apiError(
                        `Horario inválido para ${dayNames[h.day_of_week]}: la pausa debe estar dentro del horario de atención`,
                        400,
                        "INVALID_HOURS"
                    );
                }
            }
        }

        const rows = hours.map((h) => ({
            organization_id,
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            open_time: h.open_time,
            close_time: h.close_time,
            break_start: h.break_start,
            break_end: h.break_end,
        }));

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("business_hours")
            .upsert(rows, { onConflict: "organization_id,day_of_week" })
            .select("*");

        if (error) throw error;

        // Return formatted data consistent with getBusinessHours
        const formatted: BusinessDay[] = (data || []).map((row) => ({
            id: row.id,
            organization_id: row.organization_id,
            day_of_week: row.day_of_week,
            is_open: row.is_open,
            open_time: row.open_time?.slice(0, 5) || "09:00",
            close_time: row.close_time?.slice(0, 5) || "18:00",
            break_start: row.break_start?.slice(0, 5) || null,
            break_end: row.break_end?.slice(0, 5) || null,
        }));

        return NextResponse.json({ data: formatted });
    } catch (err) {
        return serverError(err, "business-hours:PUT");
    }
}

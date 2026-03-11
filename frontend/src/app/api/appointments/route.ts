import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import { bookAppointment, formatChileDate } from "@/lib/appointments";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// ── GET /api/appointments?org_id=xxx&from=2026-03-01&to=2026-03-31&status=confirmed
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("appointments:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const from = req.nextUrl.searchParams.get("from");
        const to = req.nextUrl.searchParams.get("to");
        const status = req.nextUrl.searchParams.get("status");

        const db = getSupabaseAdmin();
        let query = db
            .from("appointments")
            .select("*, leads!inner(name, phone), products(name)")
            .eq("organization_id", orgId);

        if (from) query = query.gte("start_time", from);
        if (to) query = query.lte("start_time", to);
        if (status) query = query.eq("status", status);

        query = query.order("start_time", { ascending: true });

        const { data, error } = await query;
        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appointments = (data || []).map((row: any) => ({
            ...row,
            lead_name: row.leads?.name ?? null,
            lead_phone: row.leads?.phone ?? null,
            product_name: row.products?.name ?? null,
            leads: undefined,
            products: undefined,
        }));

        return NextResponse.json({ data: appointments });
    } catch (err) {
        return serverError(err, "appointments:GET");
    }
}

// ── POST /api/appointments ─────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("appointments:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { organization_id, lead_id, product_id, start_time, end_time, notes } = body;

        if (!organization_id || !lead_id || !start_time || !end_time) {
            return apiError("organization_id, lead_id, start_time, and end_time required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        const bookResult = await bookAppointment({
            orgId: organization_id,
            leadId: lead_id,
            productId: product_id || undefined,
            startTime: start_time,
            endTime: end_time,
            notes: notes || undefined,
        });

        if (!bookResult.success) {
            return NextResponse.json({ error: bookResult.error }, { status: 409 });
        }

        // ── Send instant WhatsApp confirmation to the client ──
        try {
            const db = getSupabaseAdmin();
            const { data: lead } = await db
                .from("leads")
                .select("name, phone")
                .eq("id", lead_id)
                .single();

            if (lead?.phone) {
                const { data: product } = product_id
                    ? await db.from("products").select("name").eq("id", product_id).single()
                    : { data: null };

                const serviceName = product?.name || "tu cita";
                const formattedDate = formatChileDate(start_time);

                const confirmationMsg =
                    `¡Hola ${lead.name || ""}! Tu cita ha sido agendada exitosamente.\n\n` +
                    `📅 Fecha: ${formattedDate}\n` +
                    `📋 Servicio: ${serviceName}\n\n` +
                    `Te enviaremos un recordatorio el día anterior. ¡Te esperamos!`;

                const sendResult = await sendWhatsAppMessage(organization_id, lead.phone, confirmationMsg);
                if (!sendResult.success) {
                    console.warn("[Appointments:POST] Confirmation WhatsApp failed:", sendResult.error);
                }
            }
        } catch (confirmErr) {
            // Don't fail the booking if confirmation message fails
            console.warn("[Appointments:POST] Could not send confirmation:", confirmErr);
        }

        return NextResponse.json({ data: bookResult.appointment }, { status: 201 });
    } catch (err) {
        return serverError(err, "appointments:POST");
    }
}

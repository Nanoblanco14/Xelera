import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import { cancelAppointment } from "@/lib/appointments";

// ── PATCH /api/appointments/:id ────────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("appointments:PATCH");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const body = await req.json();
        const { status, notes, cancellation_reason } = body;

        const db = getSupabaseAdmin();

        // Load appointment and verify org ownership
        const { data: appointment, error: fetchErr } = await db
            .from("appointments")
            .select("id, organization_id")
            .eq("id", id)
            .single();

        if (fetchErr || !appointment) return apiError("Cita no encontrada", 404, "NOT_FOUND");

        if (appointment.organization_id !== auth.orgId) {
            return apiError("No tienes permiso para modificar esta cita", 403, "FORBIDDEN");
        }

        // If cancelling, use the dedicated cancelAppointment helper
        if (status === "cancelled") {
            const cancelResult = await cancelAppointment(id, appointment.organization_id, cancellation_reason || undefined);
            if (!cancelResult.success) {
                return NextResponse.json({ error: cancelResult.error }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        // Otherwise, update allowed fields directly
        const updates: Record<string, unknown> = {};
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;
        if (cancellation_reason !== undefined) updates.cancellation_reason = cancellation_reason;

        const { data: updated, error: updateErr } = await db
            .from("appointments")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (updateErr) throw updateErr;
        return NextResponse.json({ data: updated });
    } catch (err) {
        return serverError(err, "appointments:PATCH");
    }
}

// ── DELETE /api/appointments/:id?org_id=xxx ────────────────
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("appointments:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;

        const db = getSupabaseAdmin();

        // Load appointment and verify org ownership
        const { data: appointment, error: fetchErr } = await db
            .from("appointments")
            .select("id, organization_id")
            .eq("id", id)
            .single();

        if (fetchErr || !appointment) return apiError("Cita no encontrada", 404, "NOT_FOUND");

        if (appointment.organization_id !== auth.orgId) {
            return apiError("No tienes permiso para eliminar esta cita", 403, "FORBIDDEN");
        }

        // Soft delete: set status to cancelled
        const { error: updateErr } = await db
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("id", id);

        if (updateErr) throw updateErr;
        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "appointments:DELETE");
    }
}

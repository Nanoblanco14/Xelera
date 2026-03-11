// ═══════════════════════════════════════════════════════════════
//  Appointment Scheduling Engine
//  Core logic: availability, booking, cancellation, rescheduling
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import type {
    Appointment,
    AppointmentConfig,
    BusinessDay,
    TimeSlot,
} from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────

export const SYSTEM_TIMEZONE = "America/Santiago";

export const DEFAULT_APPOINTMENT_CONFIG: AppointmentConfig = {
    slot_duration_minutes: 30,
    buffer_minutes: 10,
    max_advance_days: 30,
    allow_client_cancel: true,
    allow_client_reschedule: true,
    reschedule_policy: "self_service",
    daily_digest_enabled: false,
    daily_digest_time: "08:00",
    owner_phone: "",
    timezone: SYSTEM_TIMEZONE,
};

const DEFAULT_BUSINESS_HOURS: BusinessDay[] = [
    { day_of_week: 0, is_open: false, open_time: "09:00", close_time: "18:00", break_start: null, break_end: null },
    { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00", break_start: "13:00", break_end: "14:00" },
    { day_of_week: 2, is_open: true, open_time: "09:00", close_time: "18:00", break_start: "13:00", break_end: "14:00" },
    { day_of_week: 3, is_open: true, open_time: "09:00", close_time: "18:00", break_start: "13:00", break_end: "14:00" },
    { day_of_week: 4, is_open: true, open_time: "09:00", close_time: "18:00", break_start: "13:00", break_end: "14:00" },
    { day_of_week: 5, is_open: true, open_time: "09:00", close_time: "18:00", break_start: "13:00", break_end: "14:00" },
    { day_of_week: 6, is_open: false, open_time: "09:00", close_time: "13:00", break_start: null, break_end: null },
];

// ── Get Appointment Config ────────────────────────────────────

export async function getAppointmentConfig(orgId: string): Promise<AppointmentConfig> {
    const db = getSupabaseAdmin();
    const { data } = await db
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();

    const settings = (data?.settings || {}) as Record<string, unknown>;
    const saved = (settings.appointment_config || {}) as Partial<AppointmentConfig>;

    return { ...DEFAULT_APPOINTMENT_CONFIG, ...saved };
}

// ── Get Business Hours ────────────────────────────────────────

export async function getBusinessHours(orgId: string): Promise<BusinessDay[]> {
    const db = getSupabaseAdmin();
    const { data, error } = await db
        .from("business_hours")
        .select("*")
        .eq("organization_id", orgId)
        .order("day_of_week");

    if (error || !data || data.length === 0) {
        // Seed defaults
        const rows = DEFAULT_BUSINESS_HOURS.map(d => ({
            organization_id: orgId,
            ...d,
        }));
        await db.from("business_hours").upsert(rows, {
            onConflict: "organization_id,day_of_week",
        });
        return DEFAULT_BUSINESS_HOURS;
    }

    return data.map(row => ({
        id: row.id,
        organization_id: row.organization_id,
        day_of_week: row.day_of_week,
        is_open: row.is_open,
        open_time: row.open_time?.slice(0, 5) || "09:00",
        close_time: row.close_time?.slice(0, 5) || "18:00",
        break_start: row.break_start?.slice(0, 5) || null,
        break_end: row.break_end?.slice(0, 5) || null,
    }));
}

// ── Check if date is blocked ──────────────────────────────────

async function isDateBlocked(orgId: string, dateStr: string): Promise<boolean> {
    const db = getSupabaseAdmin();
    const { data } = await db
        .from("blocked_dates")
        .select("id")
        .eq("organization_id", orgId)
        .eq("blocked_date", dateStr)
        .limit(1);
    return (data?.length ?? 0) > 0;
}

// ── Get Available Slots ───────────────────────────────────────

export async function getAvailableSlots(
    orgId: string,
    dateStr: string,       // "YYYY-MM-DD"
    durationMinutes?: number
): Promise<TimeSlot[]> {
    const config = await getAppointmentConfig(orgId);
    const slotDuration = durationMinutes || config.slot_duration_minutes;
    const buffer = config.buffer_minutes;

    // 1. Check if date is blocked
    if (await isDateBlocked(orgId, dateStr)) return [];

    // 2. Get business hours for day of week
    const date = new Date(`${dateStr}T12:00:00`);
    const dayOfWeek = date.getDay(); // 0=Sun

    const hours = await getBusinessHours(orgId);
    const dayHours = hours.find(h => h.day_of_week === dayOfWeek);
    if (!dayHours || !dayHours.is_open) return [];

    // 3. Get existing confirmed appointments for this date
    const db = getSupabaseAdmin();
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const { data: existingAppts } = await db
        .from("appointments")
        .select("start_time, end_time")
        .eq("organization_id", orgId)
        .eq("status", "confirmed")
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd);

    const booked = (existingAppts || []).map(a => ({
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
    }));

    // 4. Generate all possible slots
    const slots: TimeSlot[] = [];

    const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    };

    const openMin = parseTime(dayHours.open_time);
    const closeMin = parseTime(dayHours.close_time);
    const breakStartMin = dayHours.break_start ? parseTime(dayHours.break_start) : null;
    const breakEndMin = dayHours.break_end ? parseTime(dayHours.break_end) : null;

    let cursor = openMin;
    while (cursor + slotDuration <= closeMin) {
        const slotEnd = cursor + slotDuration;

        // Skip if slot (including buffer after it) overlaps with break
        if (breakStartMin !== null && breakEndMin !== null) {
            const slotEndWithBuffer = slotEnd + buffer;
            if (slotEndWithBuffer > breakStartMin && cursor < breakEndMin) {
                cursor = breakEndMin;
                continue;
            }
        }

        // Build ISO timestamps
        const startHour = Math.floor(cursor / 60).toString().padStart(2, "0");
        const startMinute = (cursor % 60).toString().padStart(2, "0");
        const endHour = Math.floor(slotEnd / 60).toString().padStart(2, "0");
        const endMinute = (slotEnd % 60).toString().padStart(2, "0");

        const startISO = `${dateStr}T${startHour}:${startMinute}:00`;
        const endISO = `${dateStr}T${endHour}:${endMinute}:00`;

        const slotStartMs = new Date(startISO).getTime();
        const slotEndMs = new Date(endISO).getTime();

        // Check overlap with existing appointments
        const overlaps = booked.some(b =>
            slotStartMs < b.end && slotEndMs > b.start
        );

        // Skip past slots (can't book in the past)
        const now = new Date();
        const slotDate = new Date(startISO);
        if (slotDate <= now) {
            cursor += slotDuration + buffer;
            continue;
        }

        if (!overlaps) {
            slots.push({ start: startISO, end: endISO });
        }

        cursor += slotDuration + buffer;
    }

    return slots;
}

// ── Book Appointment ──────────────────────────────────────────

interface BookParams {
    orgId: string;
    leadId: string;
    productId?: string;
    startTime: string;
    endTime: string;
    notes?: string;
    rescheduledFromId?: string;
}

type BookResult =
    | { success: true; appointment: Appointment }
    | { success: false; error: string };

export async function bookAppointment(params: BookParams): Promise<BookResult> {
    const db = getSupabaseAdmin();

    // Double-booking check (application level — DB constraint is the safety net)
    const { data: conflicts } = await db
        .from("appointments")
        .select("id")
        .eq("organization_id", params.orgId)
        .eq("status", "confirmed")
        .lt("start_time", params.endTime)
        .gt("end_time", params.startTime)
        .limit(1);

    if (conflicts && conflicts.length > 0) {
        return { success: false, error: "Ese horario ya está ocupado. Por favor elige otro." };
    }

    // Check max advance days
    const config = await getAppointmentConfig(params.orgId);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + config.max_advance_days);
    if (new Date(params.startTime) > maxDate) {
        return {
            success: false,
            error: `Solo puedes agendar hasta ${config.max_advance_days} días en adelante.`,
        };
    }

    // Insert
    const insertData: Record<string, unknown> = {
        organization_id: params.orgId,
        lead_id: params.leadId,
        start_time: params.startTime,
        end_time: params.endTime,
        status: "confirmed",
        notes: params.notes || null,
        confirmation_sent_at: new Date().toISOString(),
    };
    if (params.productId) insertData.product_id = params.productId;
    if (params.rescheduledFromId) insertData.rescheduled_from_id = params.rescheduledFromId;

    const { data, error } = await db
        .from("appointments")
        .insert(insertData)
        .select("*")
        .single();

    if (error) {
        // Catch the exclusion constraint violation
        if (error.message?.includes("no_double_booking")) {
            return { success: false, error: "Ese horario ya está ocupado. Por favor elige otro." };
        }
        console.error("[Appointments:book]", error);
        return { success: false, error: "Error al crear la cita." };
    }

    return { success: true, appointment: data as Appointment };
}

// ── Cancel Appointment ────────────────────────────────────────

export async function cancelAppointment(
    appointmentId: string,
    orgId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const db = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
        status: "cancelled",
        updated_at: new Date().toISOString(),
    };
    if (reason) updateData.cancellation_reason = reason;

    const { error } = await db
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId)
        .eq("organization_id", orgId)
        .eq("status", "confirmed");

    if (error) {
        console.error("[Appointments:cancel]", error);
        return { success: false, error: "Error al cancelar la cita." };
    }

    return { success: true };
}

// ── Reschedule Appointment ────────────────────────────────────

interface RescheduleParams {
    appointmentId: string;
    orgId: string;
    leadId: string;
    productId?: string;
    newStartTime: string;
    newEndTime: string;
}

export async function rescheduleAppointment(
    params: RescheduleParams
): Promise<BookResult> {
    const db = getSupabaseAdmin();

    // Mark old appointment as rescheduled
    const { error: updateErr } = await db
        .from("appointments")
        .update({
            status: "rescheduled",
            updated_at: new Date().toISOString(),
        })
        .eq("id", params.appointmentId)
        .eq("organization_id", params.orgId)
        .eq("status", "confirmed");

    if (updateErr) {
        console.error("[Appointments:reschedule]", updateErr);
        return { success: false, error: "Error al reprogramar la cita." };
    }

    // Book new appointment linked to the old one
    return bookAppointment({
        orgId: params.orgId,
        leadId: params.leadId,
        productId: params.productId,
        startTime: params.newStartTime,
        endTime: params.newEndTime,
        notes: "Cita reprogramada",
        rescheduledFromId: params.appointmentId,
    });
}

// ── Format Chile Date ─────────────────────────────────────────

export function formatChileDate(isoDate: string): string {
    const date = new Date(isoDate);
    const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const day = days[date.getDay()];
    const num = date.getDate();
    const month = months[date.getMonth()];
    const hour = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");
    return `${day} ${num} de ${month}, ${hour}:${min} hrs`;
}

/** Returns "HH:mm" from an ISO date string */
export function formatTime(isoDate: string): string {
    const date = new Date(isoDate);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

// ── Get business hours text for system prompt ─────────────────

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function businessHoursToText(hours: BusinessDay[]): string {
    return hours.map(h => {
        if (!h.is_open) return `${DAY_NAMES[h.day_of_week]}: Cerrado`;
        let text = `${DAY_NAMES[h.day_of_week]}: ${h.open_time} - ${h.close_time}`;
        if (h.break_start && h.break_end) {
            text += ` (pausa ${h.break_start} - ${h.break_end})`;
        }
        return text;
    }).join("\n");
}

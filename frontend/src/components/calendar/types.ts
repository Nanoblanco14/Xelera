/* ═══════════════════════════════════════════════════════════════
   Shared Types
   ═══════════════════════════════════════════════════════════════ */

export interface Appointment {
    id: string;
    organization_id: string;
    lead_id: string;
    product_id: string | null;
    start_time: string;
    end_time: string;
    status: "confirmed" | "completed" | "cancelled" | "no_show" | "rescheduled";
    notes: string | null;
    cancellation_reason: string | null;
    lead_name: string | null;
    lead_phone: string | null;
    product_name: string | null;
    created_at: string;
}

export interface Lead {
    id: string;
    name: string;
    phone: string;
}

export interface Product {
    id: string;
    name: string;
}

export interface TimeSlot {
    start: string;
    end: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

export const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DAY_NAMES_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 - 20:00

/* ═══════════════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════════════ */

/** Extract HH:MM directly from ISO string (avoids timezone conversion) */
export const fmtTime = (iso: string) => iso.slice(11, 16);

export const fmtDateShort = (d: Date) =>
    d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

export const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

export const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Extract date key from an ISO timestamp string (UTC-based, avoids timezone conversion) */
export const isoToDateKey = (iso: string) => iso.slice(0, 10);

/** Extract hour from an ISO timestamp string (UTC-based, avoids timezone conversion) */
export const isoToHour = (iso: string) => parseInt(iso.slice(11, 13), 10);

/** Extract HH:MM from an ISO timestamp string (UTC-based) */
export const isoToTime = (iso: string) => iso.slice(11, 16);

/** Monday-based day-of-week (0=Mon, 6=Sun) */
export const getMondayDow = (d: Date) => (d.getDay() + 6) % 7;

/** Get the Monday of the week that contains a given date */
export const getMonday = (d: Date) => {
    const copy = new Date(d);
    const dow = getMondayDow(copy);
    copy.setDate(copy.getDate() - dow);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

/** Get all days for a month view grid (includes leading/trailing days) */
export const getMonthGrid = (year: number, month: number) => {
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const startDow = getMondayDow(firstOfMonth);

    const days: { date: Date; inMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = startDow - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push({ date: d, inMonth: false });
    }

    // Days in the current month
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
        days.push({ date: new Date(year, month, i), inMonth: true });
    }

    // Trailing days to fill the grid (always 6 rows x 7 cols = 42 cells)
    while (days.length < 42) {
        const next = new Date(days[days.length - 1].date);
        next.setDate(next.getDate() + 1);
        days.push({ date: next, inMonth: false });
    }

    return days;
};

/* ═══════════════════════════════════════════════════════════════
   Shared Styles
   ═══════════════════════════════════════════════════════════════ */

export const glassCard = {
    background: "var(--bg-card)",
    border: "0.5px solid var(--border)",
    borderRadius: 14,
    padding: 20,
} as const;

export const kpiStyle = {
    ...glassCard,
    padding: "16px 20px",
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 14,
    flex: 1,
    minWidth: 0,
};

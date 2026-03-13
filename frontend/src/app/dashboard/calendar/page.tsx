"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrg } from "@/lib/org-context";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
    CalendarHeader,
    CalendarStats,
    MonthView,
    WeekView,
    AppointmentDetail,
    AppointmentModal,
} from "@/components/calendar";
import {
    Appointment, Lead, Product, TimeSlot,
    MONTH_NAMES,
    toDateKey, isoToDateKey, fmtDateShort,
    getMonday, getMonthGrid,
} from "@/components/calendar/types";

/* ═══════════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════════ */
export default function CalendarPage() {
    const { organization } = useOrg();
    const today = useMemo(() => new Date(), []);

    /* ── Core state ───────────────────────────────────── */
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"month" | "week">("month");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    /* ── New appointment modal state ──────────────────── */
    const [showModal, setShowModal] = useState(false);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [leadSearch, setLeadSearch] = useState("");
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [appointmentDate, setAppointmentDate] = useState("");
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [appointmentNotes, setAppointmentNotes] = useState("");
    const [creating, setCreating] = useState(false);
    const [createSuccess, setCreateSuccess] = useState(false);
    const [createError, setCreateError] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* ── Date range for fetching ─────────────────────── */
    const fetchRange = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // Always fetch a wide range to cover month + week views plus overflow days
        const from = new Date(year, month - 1, 1);
        const to = new Date(year, month + 2, 0);
        return {
            from: toDateKey(from),
            to: toDateKey(to),
        };
    }, [currentDate]);

    /* ── Fetch appointments ──────────────────────────── */
    const fetchAppointments = useCallback(async () => {
        if (!organization) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/appointments?org_id=${organization.id}&from=${fetchRange.from}&to=${fetchRange.to}`
            );
            const { data } = await res.json();
            setAppointments(data || []);
        } catch (err) {
            console.error("Failed to load appointments:", err);
            setError("No se pudieron cargar las citas. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization, fetchRange]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    /* ── Fetch leads for modal ───────────────────────── */
    const fetchLeads = useCallback(async () => {
        setLeadsLoading(true);
        try {
            const res = await fetch("/api/pipeline/leads");
            if (res.ok) {
                const data = await res.json();
                setLeads(
                    (data.data || []).map((l: Record<string, string>) => ({
                        id: l.id,
                        name: l.name,
                        phone: l.phone,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load leads:", err);
            setError("No se pudieron cargar los leads. Intenta de nuevo.");
        }
        setLeadsLoading(false);
    }, []);

    /* ── Fetch products for modal ────────────────────── */
    const fetchProducts = useCallback(async () => {
        if (!organization) return;
        try {
            const res = await fetch(`/api/products?org_id=${organization.id}`);
            if (res.ok) {
                const { data } = await res.json();
                setProducts(
                    (data || []).map((p: Record<string, string>) => ({
                        id: p.id,
                        name: p.name,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load products:", err);
            setError("No se pudieron cargar los productos. Intenta de nuevo.");
        }
    }, [organization]);

    /* ── Fetch available slots ───────────────────────── */
    const fetchSlots = useCallback(
        async (date: string) => {
            if (!organization || !date) return;
            setSlotsLoading(true);
            setAvailableSlots([]);
            setSelectedSlot(null);
            try {
                const res = await fetch(
                    `/api/appointments/availability?org_id=${organization.id}&date=${date}`
                );
                if (res.ok) {
                    const { data } = await res.json();
                    setAvailableSlots(data?.slots || []);
                }
            } catch (err) {
                console.error("Failed to load slots:", err);
                setError("No se pudieron cargar los horarios disponibles. Intenta de nuevo.");
            }
            setSlotsLoading(false);
        },
        [organization]
    );

    /* ── Open new appointment modal ──────────────────── */
    const openNewAppointment = (preDate?: Date) => {
        setSelectedLead(null);
        setLeadSearch("");
        setSelectedProduct("");
        setAppointmentDate(preDate ? toDateKey(preDate) : "");
        setAvailableSlots([]);
        setSelectedSlot(null);
        setAppointmentNotes("");
        setCreateSuccess(false);
        setCreateError("");
        setShowModal(true);
        fetchLeads();
        fetchProducts();
        if (preDate) fetchSlots(toDateKey(preDate));
    };

    /* ── Create appointment ──────────────────────────── */
    const handleCreate = async () => {
        if (!selectedLead || !selectedSlot || !appointmentDate) return;
        setCreating(true);
        setCreateError("");
        try {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organization_id: organization.id,
                    lead_id: selectedLead.id,
                    product_id: selectedProduct || null,
                    start_time: selectedSlot.start,
                    end_time: selectedSlot.end,
                    notes: appointmentNotes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al crear la cita");
            }
            setCreateSuccess(true);
            fetchAppointments();
            setTimeout(() => {
                setShowModal(false);
                setCreateSuccess(false);
            }, 1500);
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : "Error desconocido");
        }
        setCreating(false);
    };

    /* ── Update appointment status ───────────────────── */
    const updateStatus = async (id: string, status: string, reason?: string) => {
        setUpdatingId(id);
        try {
            const body: Record<string, string> = { status };
            if (reason) body.cancellation_reason = reason;
            await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            fetchAppointments();
        } catch (err) {
            console.error("Failed to update appointment:", err);
            setError("No se pudo actualizar la cita. Intenta de nuevo.");
        }
        setUpdatingId(null);
    };

    /* ── Derived data ────────────────────────────────── */
    const appointmentsByDay = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        for (const apt of appointments) {
            const key = isoToDateKey(apt.start_time);
            if (!map[key]) map[key] = [];
            map[key].push(apt);
        }
        return map;
    }, [appointments]);

    /* ── Stats ───────────────────────────────────────── */
    const stats = useMemo(() => {
        const todayKey = toDateKey(today);
        const todayAppts = appointmentsByDay[todayKey] || [];

        const monday = getMonday(today);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        let weekCount = 0;
        for (const apt of appointments) {
            const d = new Date(apt.start_time);
            if (d >= monday && d <= sunday) weekCount++;
        }

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        let confirmedCount = 0;
        let completedCount = 0;
        for (const apt of appointments) {
            const d = new Date(apt.start_time);
            if (d >= monthStart && d <= monthEnd) {
                if (apt.status === "confirmed") confirmedCount++;
                if (apt.status === "completed") completedCount++;
            }
        }

        return {
            today: todayAppts.length,
            week: weekCount,
            confirmed: confirmedCount,
            completed: completedCount,
        };
    }, [appointments, appointmentsByDay, today]);

    /* ── Navigation ──────────────────────────────────── */
    const navigatePrev = () => {
        const d = new Date(currentDate);
        if (view === "month") {
            d.setMonth(d.getMonth() - 1);
        } else {
            d.setDate(d.getDate() - 7);
        }
        setCurrentDate(d);
    };

    const navigateNext = () => {
        const d = new Date(currentDate);
        if (view === "month") {
            d.setMonth(d.getMonth() + 1);
        } else {
            d.setDate(d.getDate() + 7);
        }
        setCurrentDate(d);
    };

    const goToday = () => {
        setCurrentDate(new Date());
        setSelectedDay(null);
    };

    /* ── Month grid ──────────────────────────────────── */
    const monthGrid = useMemo(
        () => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
        [currentDate]
    );

    /* ── Week grid ───────────────────────────────────── */
    const weekDays = useMemo(() => {
        const monday = getMonday(currentDate);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [currentDate]);

    /* ── Nav label ───────────────────────────────────── */
    const navLabel = useMemo(() => {
        if (view === "month") {
            return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        const first = weekDays[0];
        const last = weekDays[6];
        if (first.getMonth() === last.getMonth()) {
            return `${first.getDate()} - ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
        }
        return `${fmtDateShort(first)} - ${fmtDateShort(last)} ${last.getFullYear()}`;
    }, [view, currentDate, weekDays]);

    /* ── Day detail appointments ─────────────────────── */
    const selectedDayAppointments = useMemo(() => {
        if (!selectedDay) return [];
        const key = toDateKey(selectedDay);
        return appointmentsByDay[key] || [];
    }, [selectedDay, appointmentsByDay]);

    /* ── Filtered leads for search ───────────────────── */
    const filteredLeads = useMemo(() => {
        if (!leadSearch.trim()) return leads.slice(0, 20);
        const q = leadSearch.toLowerCase();
        return leads.filter(
            (l) => l.name.toLowerCase().includes(q) || l.phone.includes(q)
        ).slice(0, 20);
    }, [leads, leadSearch]);

    /* ── View change handler ─────────────────────────── */
    const handleViewChange = (v: "month" | "week") => {
        setView(v);
        setSelectedDay(null);
    };

    /* ── Modal date change handler ───────────────────── */
    const handleModalDateChange = (value: string) => {
        setAppointmentDate(value);
        if (value) fetchSlots(value);
    };

    /* ── Modal lead clear handler ────────────────────── */
    const handleClearLead = () => {
        setSelectedLead(null);
        setLeadSearch("");
    };

    /* ── Modal lead select handler ───────────────────── */
    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead);
        setLeadSearch("");
    };

    /* ═══════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════ */
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="animate-in"
            style={{ maxWidth: 1200, margin: "0 auto", animationDelay: "0s" }}
        >
            {error && (
                <div style={{ background: "var(--danger-bg)", border: "0.5px solid rgba(199,90,90,0.15)", borderRadius: 8, padding: "12px 16px", margin: "0 0 12px 0", color: "var(--danger)", fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* ── Header ─────────────────────────────────────── */}
            <CalendarHeader
                view={view}
                onViewChange={handleViewChange}
                onNavigatePrev={navigatePrev}
                onNavigateNext={navigateNext}
                onGoToday={goToday}
                onNewAppointment={() => openNewAppointment()}
                navLabel={navLabel}
            />

            {/* ── Stats Bar ──────────────────────────────────── */}
            <CalendarStats
                todayCount={stats.today}
                weekCount={stats.week}
                confirmedCount={stats.confirmed}
                completedCount={stats.completed}
            />

            {/* ── Calendar Body ──────────────────────────────── */}
            <div className="glass-panel" style={{ padding: 20, borderRadius: 14 }}>
                {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : view === "month" ? (
                    <MonthView
                        monthGrid={monthGrid}
                        appointmentsByDay={appointmentsByDay}
                        today={today}
                        selectedDay={selectedDay}
                        onSelectDay={setSelectedDay}
                    />
                ) : (
                    <WeekView
                        weekDays={weekDays}
                        appointmentsByDay={appointmentsByDay}
                        today={today}
                        onSelectDay={setSelectedDay}
                    />
                )}
            </div>

            {/* ── Day Detail Panel ───────────────────────────── */}
            <AppointmentDetail
                selectedDay={selectedDay}
                appointments={selectedDayAppointments}
                updatingId={updatingId}
                onNewAppointment={openNewAppointment}
                onClose={() => setSelectedDay(null)}
                onUpdateStatus={updateStatus}
            />

            {/* ── New Appointment Modal ──────────────────────── */}
            <AppointmentModal
                show={showModal}
                onClose={() => setShowModal(false)}
                leadSearch={leadSearch}
                onLeadSearchChange={setLeadSearch}
                filteredLeads={filteredLeads}
                leadsLoading={leadsLoading}
                selectedLead={selectedLead}
                onSelectLead={handleSelectLead}
                onClearLead={handleClearLead}
                products={products}
                selectedProduct={selectedProduct}
                onProductChange={setSelectedProduct}
                appointmentDate={appointmentDate}
                onDateChange={handleModalDateChange}
                availableSlots={availableSlots}
                slotsLoading={slotsLoading}
                selectedSlot={selectedSlot}
                onSlotSelect={setSelectedSlot}
                appointmentNotes={appointmentNotes}
                onNotesChange={setAppointmentNotes}
                creating={creating}
                createSuccess={createSuccess}
                createError={createError}
                onSubmit={handleCreate}
            />
        </motion.div>
    );
}

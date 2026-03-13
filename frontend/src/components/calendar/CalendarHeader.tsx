"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface CalendarHeaderProps {
    view: "month" | "week";
    onViewChange: (view: "month" | "week") => void;
    onNavigatePrev: () => void;
    onNavigateNext: () => void;
    onGoToday: () => void;
    onNewAppointment: () => void;
    navLabel: string;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function CalendarHeader({
    view,
    onViewChange,
    onNavigatePrev,
    onNavigateNext,
    onGoToday,
    onNewAppointment,
    navLabel,
}: CalendarHeaderProps) {
    return (
        <>
            {/* ── Title + View Toggle + New Button ─────────────── */}
            <div className="page-header" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Calendario de Citas</h1>
                    <p className="page-subtitle" style={{ margin: "6px 0 0" }}>
                        Gestiona las citas de tus clientes
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* View toggle */}
                    <div style={{
                        display: "flex",
                        gap: 4,
                        padding: "3px",
                        background: "var(--bg-card)",
                        border: "0.5px solid var(--border)",
                        borderRadius: 100,
                    }}>
                        {(["month", "week"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => onViewChange(v)}
                                className={`filter-pill${view === v ? " active" : ""}`}
                                style={{
                                    padding: "7px 18px",
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                {v === "month" ? "Mes" : "Semana"}
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn-primary"
                        onClick={onNewAppointment}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <Plus size={16} /> Nueva Cita
                    </button>
                </div>
            </div>

            {/* ── Date Navigation ──────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 16, flexWrap: "wrap", gap: 10,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        className="btn-secondary"
                        onClick={onNavigatePrev}
                        style={{ padding: "6px 10px", display: "flex", alignItems: "center" }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={onNavigateNext}
                        style={{ padding: "6px 10px", display: "flex", alignItems: "center" }}
                    >
                        <ChevronRight size={18} />
                    </button>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                        {navLabel}
                    </h2>
                </div>
                <button
                    className="btn-secondary"
                    onClick={onGoToday}
                    style={{ fontSize: 13 }}
                >
                    Hoy
                </button>
            </div>
        </>
    );
}

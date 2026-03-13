"use client";
import { useState, useEffect, useCallback } from "react";
import { CalendarX2, Trash2, Plus, Loader2, CalendarOff, Sparkles, Calendar } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import type { BlockedDate } from "@/lib/types";

/* ───────────────────────────── Constants ───────────────────────────── */

const MONTH_NAMES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTH_NAMES_LONG = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Chilean / LATAM holidays for quick-add presets. Dates are for the current year. */
function getHolidayPresets(existingDates: string[]) {
    const year = new Date().getFullYear();
    const all = [
        { label: "Año Nuevo", date: `${year}-01-01`, reason: "Año Nuevo" },
        { label: "Viernes Santo", date: getEasterFriday(year), reason: "Viernes Santo" },
        { label: "Día del Trabajo", date: `${year}-05-01`, reason: "Día del Trabajo" },
        { label: "San Pedro y San Pablo", date: `${year}-06-29`, reason: "San Pedro y San Pablo" },
        { label: "Virgen del Carmen", date: `${year}-07-16`, reason: "Virgen del Carmen" },
        { label: "Asunción", date: `${year}-08-15`, reason: "Asunción de la Virgen" },
        { label: "18 de Sept", date: `${year}-09-18`, reason: "Fiestas Patrias" },
        { label: "19 de Sept", date: `${year}-09-19`, reason: "Glorias del Ejército" },
        { label: "12 de Oct", date: `${year}-10-12`, reason: "Encuentro de Dos Mundos" },
        { label: "1 de Nov", date: `${year}-11-01`, reason: "Día de Todos los Santos" },
        { label: "8 de Dic", date: `${year}-12-08`, reason: "Inmaculada Concepción" },
        { label: "Navidad", date: `${year}-12-25`, reason: "Navidad" },
    ];
    // Only show presets for dates not already blocked
    return all.filter((h) => !existingDates.includes(h.date));
}

/** Rough Easter Friday calculator (anonymous Gregorian algorithm). */
function getEasterFriday(year: number): string {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    // Easter Sunday -> Friday is -2 days
    const easter = new Date(year, month - 1, day);
    easter.setDate(easter.getDate() - 2);
    const mm = String(easter.getMonth() + 1).padStart(2, "0");
    const dd = String(easter.getDate()).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}

/* ───────────────────────────── Styles ──────────────────────────────── */

const styles = {
    dateCard: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        transition: "all 0.25s ease",
    } as React.CSSProperties,
    dateBadge: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        minWidth: "52px",
        height: "52px",
        borderRadius: "10px",
        background: "linear-gradient(135deg, rgba(122,158,138,0.15), rgba(122,158,138,0.06))",
        border: "0.5px solid rgba(122,158,138,0.2)",
        flexShrink: 0,
    } as React.CSSProperties,
    badgeDay: {
        fontSize: "18px",
        fontWeight: 800,
        color: "#7a9e8a",
        lineHeight: 1,
    } as React.CSSProperties,
    badgeMonth: {
        fontSize: "10px",
        fontWeight: 700,
        color: "#7a9e8a",
        letterSpacing: "0.8px",
        lineHeight: 1,
        marginTop: "3px",
        opacity: 0.85,
    } as React.CSSProperties,
    dateInfo: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column" as const,
        gap: "2px",
    } as React.CSSProperties,
    dateReason: {
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--text-primary)",
        whiteSpace: "nowrap" as const,
        overflow: "hidden" as const,
        textOverflow: "ellipsis" as const,
    } as React.CSSProperties,
    dateYear: {
        fontSize: "11px",
        color: "var(--text-muted)",
        fontWeight: 400,
    } as React.CSSProperties,
    deleteBtn: (isDeleting: boolean): React.CSSProperties => ({
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        cursor: isDeleting ? "wait" : "pointer",
        padding: "8px",
        color: "var(--text-muted)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        flexShrink: 0,
    }),
    emptyState: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        gap: "12px",
        marginBottom: "16px",
    } as React.CSSProperties,
    emptyIcon: {
        width: "56px",
        height: "56px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
    } as React.CSSProperties,
    emptyTitle: {
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--text-secondary)",
    } as React.CSSProperties,
    emptySubtitle: {
        fontSize: "12px",
        color: "var(--text-muted)",
        textAlign: "center" as const,
        maxWidth: "280px",
        lineHeight: 1.5,
    } as React.CSSProperties,
    addCard: {
        background: "rgba(255,255,255,0.025)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "16px 18px",
        transition: "all 0.25s ease",
    } as React.CSSProperties,
    addHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "14px",
    } as React.CSSProperties,
    addHeaderIcon: {
        width: "28px",
        height: "28px",
        borderRadius: "8px",
        background: "rgba(122,158,138,0.1)",
        border: "0.5px solid rgba(122,158,138,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#7a9e8a",
    } as React.CSSProperties,
    addHeaderText: {
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--text-primary)",
    } as React.CSSProperties,
    inputGroup: {
        display: "flex",
        gap: "10px",
        alignItems: "flex-end",
        flexWrap: "wrap" as const,
    } as React.CSSProperties,
    inputBlock: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "5px",
    } as React.CSSProperties,
    label: {
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
    } as React.CSSProperties,
    input: {
        padding: "9px 12px",
        borderRadius: "8px",
        border: "0.5px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
    } as React.CSSProperties,
    addBtn: (disabled: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "9px 18px",
        borderRadius: "8px",
        border: "0.5px solid rgba(122,158,138,0.3)",
        background: disabled
            ? "rgba(122,158,138,0.05)"
            : "linear-gradient(135deg, rgba(122,158,138,0.15), rgba(122,158,138,0.08))",
        color: disabled ? "rgba(122,158,138,0.4)" : "#7a9e8a",
        fontSize: "13px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.25s ease",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
        letterSpacing: "0.2px",
    }),
    presetsSection: {
        marginTop: "14px",
        paddingTop: "14px",
        borderTop: "0.5px solid rgba(255,255,255,0.04)",
    } as React.CSSProperties,
    presetsLabel: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase" as const,
        letterSpacing: "0.8px",
        marginBottom: "8px",
    } as React.CSSProperties,
    presetsWrap: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "6px",
    } as React.CSSProperties,
    presetPill: {
        padding: "5px 11px",
        borderRadius: "20px",
        border: "0.5px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
        color: "var(--text-secondary)",
        fontSize: "11px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap" as const,
    } as React.CSSProperties,
    errorBox: {
        padding: "10px 14px",
        borderRadius: "10px",
        background: "rgba(239,68,68,0.07)",
        border: "0.5px solid rgba(239,68,68,0.14)",
        color: "#EF4444",
        fontSize: "12px",
        marginBottom: "14px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    } as React.CSSProperties,
};

/* ───────────────────────────── Component ───────────────────────────── */

interface BlockedDatesSectionProps {
    orgId: string;
}

export default function BlockedDatesSection({ orgId }: BlockedDatesSectionProps) {
    const [dates, setDates] = useState<BlockedDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState("");

    // New date form
    const [newDate, setNewDate] = useState("");
    const [newReason, setNewReason] = useState("");

    // ── Load blocked dates ──────────────────────────────────
    const fetchDates = useCallback(async () => {
        try {
            const res = await fetch(`/api/business-hours/blocked-dates?org_id=${orgId}`);
            if (res.ok) {
                const json = await res.json();
                setDates(json.data || []);
            }
        } catch {
            // Silent fail
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchDates();
    }, [fetchDates]);

    // ── Add a blocked date ──────────────────────────────────
    const handleAdd = async () => {
        if (!newDate) return;
        setAdding(true);
        setError("");
        try {
            const res = await fetch("/api/business-hours/blocked-dates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organization_id: orgId,
                    blocked_date: newDate,
                    reason: newReason || null,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Error agregando fecha");
            }
            const json = await res.json();
            setDates((prev) => [...prev, json.data].sort(
                (a, b) => a.blocked_date.localeCompare(b.blocked_date)
            ));
            setNewDate("");
            setNewReason("");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error agregando fecha");
        } finally {
            setAdding(false);
        }
    };

    // ── Delete a blocked date ───────────────────────────────
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setError("");
        try {
            const res = await fetch(
                `/api/business-hours/blocked-dates?id=${id}&org_id=${orgId}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Error eliminando fecha");
            }
            setDates((prev) => prev.filter((d) => d.id !== id));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error eliminando fecha");
        } finally {
            setDeletingId(null);
        }
    };

    // ── Quick-add a holiday preset ──────────────────────────
    const handlePreset = (date: string, reason: string) => {
        setNewDate(date);
        setNewReason(reason);
    };

    // ── Parse date for display ──────────────────────────────
    const parseDateParts = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-");
        return {
            day: parseInt(day, 10),
            monthAbbr: MONTH_NAMES[parseInt(month, 10) - 1],
            monthLong: MONTH_NAMES_LONG[parseInt(month, 10) - 1],
            year,
        };
    };

    // Holiday presets (filtered to exclude already-blocked dates)
    const existingDateStrs = dates.map((d) => d.blocked_date);
    const presets = getHolidayPresets(existingDateStrs);

    /* ─── Loading state ──────────────────────────────────────── */
    if (loading) {
        return (
            <SectionCard
                icon={<CalendarX2 size={16} />}
                title="Fechas Bloqueadas"
                subtitle="Feriados, vacaciones y días sin atención"
            >
                <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            </SectionCard>
        );
    }

    /* ─── Render ──────────────────────────────────────────────── */
    return (
        <SectionCard
            icon={<CalendarX2 size={16} />}
            title="Fechas Bloqueadas"
            subtitle="Feriados, vacaciones y días sin atención"
        >
            {/* ─── Error ────────────────────────────────────── */}
            {error && (
                <div style={styles.errorBox}>
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>!</span>
                    {error}
                </div>
            )}

            {/* ─── Blocked dates list ───────────────────────── */}
            {dates.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                    {dates.map((d) => {
                        const { day, monthAbbr, monthLong, year } = parseDateParts(d.blocked_date);
                        const isDeleting = deletingId === d.id;

                        return (
                            <div
                                key={d.id}
                                style={styles.dateCard}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.045)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                }}
                            >
                                {/* Date badge */}
                                <div style={styles.dateBadge}>
                                    <span style={styles.badgeDay}>{day}</span>
                                    <span style={styles.badgeMonth}>{monthAbbr}</span>
                                </div>

                                {/* Info */}
                                <div style={styles.dateInfo}>
                                    <span style={styles.dateReason}>
                                        {d.reason || `${day} de ${monthLong}`}
                                    </span>
                                    <span style={styles.dateYear}>
                                        {day} de {monthLong} {year}
                                    </span>
                                </div>

                                {/* Delete button */}
                                <button
                                    type="button"
                                    onClick={() => handleDelete(d.id)}
                                    disabled={isDeleting}
                                    style={styles.deleteBtn(isDeleting)}
                                    onMouseEnter={(e) => {
                                        if (!isDeleting) {
                                            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                                            e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                                            e.currentTarget.style.color = "#EF4444";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                        e.currentTarget.style.color = "var(--text-muted)";
                                    }}
                                    title="Eliminar fecha"
                                >
                                    {isDeleting ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={14} />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ─── Empty state ────────────────────────────── */
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>
                        <CalendarOff size={24} />
                    </div>
                    <span style={styles.emptyTitle}>
                        No hay fechas bloqueadas
                    </span>
                    <span style={styles.emptySubtitle}>
                        Agrega feriados, vacaciones o cualquier día en que no atiendes para que el bot no agende citas.
                    </span>
                </div>
            )}

            {/* ─── Add new blocked date card ────────────────── */}
            <div style={styles.addCard}>
                {/* Card header */}
                <div style={styles.addHeader}>
                    <div style={styles.addHeaderIcon}>
                        <Plus size={14} />
                    </div>
                    <span style={styles.addHeaderText}>Agregar fecha bloqueada</span>
                </div>

                {/* Input row */}
                <div style={styles.inputGroup}>
                    <div style={{ ...styles.inputBlock, flex: "0 0 auto" }}>
                        <label style={styles.label}>Fecha</label>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            style={{ ...styles.input, width: "155px" }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.4)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            }}
                        />
                    </div>
                    <div style={{ ...styles.inputBlock, flex: "1 1 160px" }}>
                        <label style={styles.label}>Motivo (opcional)</label>
                        <input
                            type="text"
                            value={newReason}
                            onChange={(e) => setNewReason(e.target.value)}
                            placeholder="Ej: Feriado nacional, Vacaciones..."
                            style={{ ...styles.input, width: "100%" }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.4)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newDate) handleAdd();
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={adding || !newDate}
                        style={styles.addBtn(adding || !newDate)}
                        onMouseEnter={(e) => {
                            if (!adding && newDate) {
                                e.currentTarget.style.background =
                                    "linear-gradient(135deg, rgba(122,158,138,0.22), rgba(122,158,138,0.12))";
                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.45)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                                adding || !newDate
                                    ? "rgba(122,158,138,0.05)"
                                    : "linear-gradient(135deg, rgba(122,158,138,0.15), rgba(122,158,138,0.08))";
                            e.currentTarget.style.borderColor = "rgba(122,158,138,0.3)";
                        }}
                    >
                        {adding ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Plus size={14} />
                        )}
                        Agregar
                    </button>
                </div>

                {/* ─── Quick-add holiday presets ─────────────── */}
                {presets.length > 0 && (
                    <div style={styles.presetsSection}>
                        <div style={styles.presetsLabel}>
                            <Sparkles size={11} />
                            Feriados comunes
                        </div>
                        <div style={styles.presetsWrap}>
                            {presets.map((p) => (
                                <button
                                    key={p.date}
                                    type="button"
                                    style={styles.presetPill}
                                    onClick={() => handlePreset(p.date, p.reason)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(122,158,138,0.1)";
                                        e.currentTarget.style.borderColor = "rgba(122,158,138,0.2)";
                                        e.currentTarget.style.color = "#7a9e8a";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                        e.currentTarget.style.color = "var(--text-secondary)";
                                    }}
                                    title={`${p.reason} - ${p.date}`}
                                >
                                    <Calendar size={10} />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

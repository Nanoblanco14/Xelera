"use client";
import { useState, useEffect, useCallback } from "react";
import { Clock, Loader2, Check, Save, Coffee, Lock, ChevronDown } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import type { BusinessDay } from "@/lib/types";

/* ───────────────────────────── Constants ───────────────────────────── */

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_ABBR = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const DEFAULT_HOURS: BusinessDay[] = DAY_NAMES.map((_, i) => ({
    day_of_week: i,
    is_open: i >= 1 && i <= 5,
    open_time: "09:00",
    close_time: "18:00",
    break_start: null,
    break_end: null,
}));

const PRESETS = [
    {
        label: "Lun-Vie 9-18",
        desc: "Oficina",
        apply: () =>
            DAY_NAMES.map((_, i) => ({
                day_of_week: i,
                is_open: i >= 1 && i <= 5,
                open_time: "09:00",
                close_time: "18:00",
                break_start: null,
                break_end: null,
            })),
    },
    {
        label: "Lun-Sáb 9-20",
        desc: "Retail",
        apply: () =>
            DAY_NAMES.map((_, i) => ({
                day_of_week: i,
                is_open: i >= 1 && i <= 6,
                open_time: "09:00",
                close_time: "20:00",
                break_start: null,
                break_end: null,
            })),
    },
    {
        label: "Todos 10-22",
        desc: "7 días",
        apply: () =>
            DAY_NAMES.map((_, i) => ({
                day_of_week: i,
                is_open: true,
                open_time: "10:00",
                close_time: "22:00",
                break_start: null,
                break_end: null,
            })),
    },
];

/* ───────────────────────────── Styles ──────────────────────────────── */

const styles = {
    dayCard: (isOpen: boolean): React.CSSProperties => ({
        background: isOpen ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: isOpen ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(255,255,255,0.04)",
        borderRadius: "12px",
        padding: "14px 16px",
        transition: "all 0.25s ease",
        opacity: isOpen ? 1 : 0.6,
    }),
    dayRow: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        flexWrap: "wrap" as const,
    } as React.CSSProperties,
    dayLabel: (isOpen: boolean): React.CSSProperties => ({
        minWidth: "54px",
        display: "flex",
        flexDirection: "column",
        gap: "1px",
    }),
    dayAbbr: (isOpen: boolean): React.CSSProperties => ({
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "0.5px",
        color: isOpen ? "var(--text-primary)" : "var(--text-muted)",
        transition: "color 0.2s",
    }),
    dayFull: {
        fontSize: "11px",
        color: "var(--text-muted)",
        fontWeight: 400,
    } as React.CSSProperties,
    toggle: (active: boolean): React.CSSProperties => ({
        width: "42px",
        height: "24px",
        borderRadius: "12px",
        background: active ? "#7a9e8a" : "rgba(255,255,255,0.08)",
        border: active ? "0.5px solid rgba(122,158,138,0.3)" : "0.5px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.25s ease",
        flexShrink: 0,
        padding: 0,
    }),
    toggleKnob: (active: boolean): React.CSSProperties => ({
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: active ? "#fff" : "rgba(255,255,255,0.4)",
        position: "absolute",
        top: "2px",
        left: active ? "21px" : "2px",
        transition: "all 0.25s ease",
        boxShadow: active ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
    }),
    closedBadge: {
        fontSize: "12px",
        color: "var(--text-muted)",
        fontStyle: "italic" as const,
        padding: "4px 12px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        border: "0.5px solid rgba(255,255,255,0.04)",
    } as React.CSSProperties,
    timeGroup: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flex: 1,
        minWidth: 0,
    } as React.CSSProperties,
    timeBlock: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "3px",
    } as React.CSSProperties,
    timeLabel: {
        fontSize: "11px",
        fontWeight: 500,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
    } as React.CSSProperties,
    timeInput: {
        width: "100px",
        padding: "6px 10px",
        borderRadius: "8px",
        border: "0.5px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        textAlign: "center" as const,
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
    } as React.CSSProperties,
    timeSeparator: {
        color: "var(--text-muted)",
        fontSize: "13px",
        fontWeight: 500,
        padding: "0 2px",
        marginTop: "18px",
    } as React.CSSProperties,
    breakToggle: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: "11px",
        fontWeight: 500,
        padding: "4px 8px",
        borderRadius: "6px",
        transition: "all 0.2s",
        marginTop: "2px",
    } as React.CSSProperties,
    breakRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "10px",
        paddingTop: "10px",
        borderTop: "0.5px solid rgba(255,255,255,0.04)",
        paddingLeft: "68px",
        flexWrap: "wrap" as const,
    } as React.CSSProperties,
    presetBtn: (isActive: boolean): React.CSSProperties => ({
        padding: "7px 14px",
        borderRadius: "8px",
        border: isActive ? "0.5px solid rgba(122,158,138,0.3)" : "0.5px solid rgba(255,255,255,0.06)",
        background: isActive ? "rgba(122,158,138,0.1)" : "rgba(255,255,255,0.03)",
        color: isActive ? "#7a9e8a" : "var(--text-secondary)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1px",
    }),
    presetLabel: {
        fontSize: "11px",
        fontWeight: 400,
        opacity: 0.7,
    } as React.CSSProperties,
    saveBtn: (saving: boolean, saved: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minWidth: "160px",
        padding: "10px 24px",
        borderRadius: "10px",
        border: saved
            ? "0.5px solid rgba(34,197,94,0.3)"
            : "0.5px solid rgba(122,158,138,0.3)",
        background: saved
            ? "rgba(34,197,94,0.12)"
            : "linear-gradient(135deg, rgba(122,158,138,0.15), rgba(122,158,138,0.08))",
        color: saved ? "#22C55E" : "#7a9e8a",
        fontSize: "13px",
        fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer",
        transition: "all 0.3s ease",
        opacity: saving ? 0.7 : 1,
        letterSpacing: "0.2px",
    }),
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

/* ────────────────────────── Helpers ────────────────────────────────── */

function matchesPreset(hours: BusinessDay[], presetApply: () => BusinessDay[]): boolean {
    const preset = presetApply();
    return hours.every((h) => {
        const p = preset.find((pp) => pp.day_of_week === h.day_of_week);
        if (!p) return false;
        return (
            h.is_open === p.is_open &&
            h.open_time === p.open_time &&
            h.close_time === p.close_time
        );
    });
}

/* ───────────────────────────── Component ───────────────────────────── */

interface BusinessHoursSectionProps {
    orgId: string;
}

export default function BusinessHoursSection({ orgId }: BusinessHoursSectionProps) {
    const [hours, setHours] = useState<BusinessDay[]>(DEFAULT_HOURS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [expandedBreaks, setExpandedBreaks] = useState<Set<number>>(new Set());

    // ── Load business hours ─────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/business-hours?org_id=${orgId}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && json.data.length === 7) {
                        setHours(json.data);
                        // Auto-expand break sections for days that already have break times
                        const breaksSet = new Set<number>();
                        json.data.forEach((d: BusinessDay) => {
                            if (d.break_start || d.break_end) {
                                breaksSet.add(d.day_of_week);
                            }
                        });
                        setExpandedBreaks(breaksSet);
                    }
                }
            } catch {
                // Use defaults
            } finally {
                setLoading(false);
            }
        })();
    }, [orgId]);

    // ── Update a single day ─────────────────────────────────
    const updateDay = useCallback((dayIndex: number, field: keyof BusinessDay, value: unknown) => {
        setHours((prev) =>
            prev.map((h) =>
                h.day_of_week === dayIndex ? { ...h, [field]: value } : h
            )
        );
    }, []);

    // ── Toggle break section visibility ─────────────────────
    const toggleBreak = useCallback((dayIndex: number) => {
        setExpandedBreaks((prev) => {
            const next = new Set(prev);
            if (next.has(dayIndex)) {
                next.delete(dayIndex);
            } else {
                next.add(dayIndex);
            }
            return next;
        });
    }, []);

    // ── Save handler ────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const res = await fetch("/api/business-hours", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: orgId, hours }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Error guardando horario");
            }
            const json = await res.json();
            if (json.data) setHours(json.data);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error guardando horario");
        } finally {
            setSaving(false);
        }
    };

    // ── Apply preset ────────────────────────────────────────
    const applyPreset = (presetFn: () => BusinessDay[]) => {
        setHours(presetFn());
        setExpandedBreaks(new Set());
    };

    // ── Sorted hours: show Mon-Sun ──────────────────────────
    const sortedHours = [1, 2, 3, 4, 5, 6, 0].map(
        (dayIdx) => hours.find((h) => h.day_of_week === dayIdx) || DEFAULT_HOURS[dayIdx]
    );

    /* ─── Loading state ─────────────────────────────────────── */
    if (loading) {
        return (
            <SectionCard
                icon={<Clock size={16} />}
                title="Horario de Atencion"
                subtitle="Define los dias y horarios en que atiendes clientes"
            >
                <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            </SectionCard>
        );
    }

    /* ─── Render ─────────────────────────────────────────────── */
    return (
        <SectionCard
            icon={<Clock size={16} />}
            title="Horario de Atencion"
            subtitle="Define los dias y horarios en que atiendes clientes"
            footer={
                <button
                    style={styles.saveBtn(saving, saved)}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Guardando...
                        </>
                    ) : saved ? (
                        <>
                            <Check size={14} />
                            Guardado!
                        </>
                    ) : (
                        <>
                            <Save size={14} />
                            Guardar Horario
                        </>
                    )}
                </button>
            }
        >
            {/* ─── Error ──────────────────────────────────── */}
            {error && (
                <div style={styles.errorBox}>
                    <span style={{ fontSize: "14px" }}>!</span>
                    {error}
                </div>
            )}

            {/* ─── Presets ────────────────────────────────── */}
            <div style={{ marginBottom: "16px" }}>
                <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    display: "block",
                    marginBottom: "8px",
                }}>
                    Plantillas rapidas
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {PRESETS.map((preset) => {
                        const isActive = matchesPreset(hours, preset.apply);
                        return (
                            <button
                                key={preset.label}
                                type="button"
                                style={styles.presetBtn(isActive)}
                                onClick={() => applyPreset(preset.apply)}
                            >
                                {preset.label}
                                <span style={styles.presetLabel}>{preset.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Day rows ───────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {sortedHours.map((day) => {
                    const isOpen = day.is_open;
                    const hasBreak = expandedBreaks.has(day.day_of_week);

                    return (
                        <div key={day.day_of_week} style={styles.dayCard(isOpen)}>
                            {/* Main row */}
                            <div style={styles.dayRow}>
                                {/* Day name */}
                                <div style={styles.dayLabel(isOpen)}>
                                    <span style={styles.dayAbbr(isOpen)}>
                                        {DAY_ABBR[day.day_of_week]}
                                    </span>
                                    <span style={styles.dayFull}>
                                        {DAY_NAMES[day.day_of_week]}
                                    </span>
                                </div>

                                {/* Toggle */}
                                <button
                                    type="button"
                                    style={styles.toggle(isOpen)}
                                    onClick={() => updateDay(day.day_of_week, "is_open", !isOpen)}
                                    aria-label={`${isOpen ? "Cerrar" : "Abrir"} ${DAY_NAMES[day.day_of_week]}`}
                                >
                                    <div style={styles.toggleKnob(isOpen)} />
                                </button>

                                {/* Closed state */}
                                {!isOpen && (
                                    <span style={styles.closedBadge}>Cerrado</span>
                                )}

                                {/* Open state: time inputs */}
                                {isOpen && (
                                    <div style={styles.timeGroup}>
                                        {/* Open time */}
                                        <div style={styles.timeBlock}>
                                            <span style={styles.timeLabel}>
                                                <Clock size={10} />
                                                Abre
                                            </span>
                                            <input
                                                type="time"
                                                value={day.open_time}
                                                onChange={(e) =>
                                                    updateDay(day.day_of_week, "open_time", e.target.value)
                                                }
                                                style={styles.timeInput}
                                            />
                                        </div>

                                        <span style={styles.timeSeparator}>-</span>

                                        {/* Close time */}
                                        <div style={styles.timeBlock}>
                                            <span style={styles.timeLabel}>
                                                <Lock size={10} />
                                                Cierra
                                            </span>
                                            <input
                                                type="time"
                                                value={day.close_time}
                                                onChange={(e) =>
                                                    updateDay(day.day_of_week, "close_time", e.target.value)
                                                }
                                                style={styles.timeInput}
                                            />
                                        </div>

                                        {/* Break toggle button */}
                                        <button
                                            type="button"
                                            style={{
                                                ...styles.breakToggle,
                                                color: hasBreak ? "#7a9e8a" : "var(--text-muted)",
                                                background: hasBreak
                                                    ? "rgba(122,158,138,0.08)"
                                                    : "transparent",
                                            }}
                                            onClick={() => toggleBreak(day.day_of_week)}
                                            title="Agregar pausa / almuerzo"
                                        >
                                            <Coffee size={11} />
                                            Pausa
                                            <ChevronDown
                                                size={10}
                                                style={{
                                                    transition: "transform 0.2s",
                                                    transform: hasBreak ? "rotate(180deg)" : "rotate(0deg)",
                                                }}
                                            />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Break sub-row (collapsible) */}
                            {isOpen && hasBreak && (
                                <div style={styles.breakRow}>
                                    <Coffee
                                        size={12}
                                        style={{ color: "var(--text-muted)", flexShrink: 0 }}
                                    />
                                    <div style={styles.timeBlock}>
                                        <span style={styles.timeLabel}>Pausa desde</span>
                                        <input
                                            type="time"
                                            value={day.break_start || ""}
                                            onChange={(e) =>
                                                updateDay(
                                                    day.day_of_week,
                                                    "break_start",
                                                    e.target.value || null
                                                )
                                            }
                                            placeholder="--:--"
                                            style={styles.timeInput}
                                        />
                                    </div>
                                    <span style={{ ...styles.timeSeparator, marginTop: "18px" }}>
                                        -
                                    </span>
                                    <div style={styles.timeBlock}>
                                        <span style={styles.timeLabel}>hasta</span>
                                        <input
                                            type="time"
                                            value={day.break_end || ""}
                                            onChange={(e) =>
                                                updateDay(
                                                    day.day_of_week,
                                                    "break_end",
                                                    e.target.value || null
                                                )
                                            }
                                            placeholder="--:--"
                                            style={styles.timeInput}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateDay(day.day_of_week, "break_start", null);
                                            updateDay(day.day_of_week, "break_end", null);
                                            toggleBreak(day.day_of_week);
                                        }}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "var(--text-muted)",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                            padding: "4px 8px",
                                            borderRadius: "6px",
                                            marginTop: "18px",
                                            transition: "color 0.2s",
                                        }}
                                        title="Quitar pausa"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

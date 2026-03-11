"use client";
import { useState, useEffect } from "react";
import {
    Calendar,
    Loader2,
    Check,
    Save,
    Timer,
    Clock,
    Shield,
    Bell,
    Phone,
    CalendarDays,
    Minus,
    Plus,
    AlertCircle,
    Pause,
} from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import type { AppointmentConfig } from "@/lib/types";
import { DEFAULT_APPOINTMENT_CONFIG } from "@/lib/appointments";

/* ───────────────────────────── Types ──────────────────────────────── */

interface AppointmentConfigSectionProps {
    orgId: string;
    orgSettings: Record<string, unknown>;
}

/* ───────────────────────────── Styles ─────────────────────────────── */

const s = {
    /* Sub-section glass card */
    groupCard: {
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "18px 20px",
        transition: "all 0.25s ease",
    } as React.CSSProperties,

    /* Section header (UPPERCASE category label) */
    groupHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "16px",
    } as React.CSSProperties,
    groupHeaderIcon: (color: string): React.CSSProperties => ({
        width: "28px",
        height: "28px",
        borderRadius: "8px",
        background: `${color}14`,
        border: `1px solid ${color}28`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
        flexShrink: 0,
    }),
    groupLabel: {
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--text-muted)",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
    } as React.CSSProperties,
    groupDesc: {
        fontSize: "11.5px",
        fontWeight: 400,
        color: "var(--text-muted)",
        opacity: 0.7,
        marginTop: "1px",
    } as React.CSSProperties,

    /* 3-column grid for numeric steppers */
    numericGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px",
    } as React.CSSProperties,

    /* Stepper card (for duration, buffer, max days) */
    stepperCard: {
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "10px",
        transition: "all 0.25s ease",
    } as React.CSSProperties,
    stepperLabel: {
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--text-muted)",
        textAlign: "center" as const,
        lineHeight: 1.3,
    } as React.CSSProperties,
    stepperControls: {
        display: "flex",
        alignItems: "center",
        gap: "0px",
    } as React.CSSProperties,
    stepperBtn: (disabled: boolean): React.CSSProperties => ({
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(255,255,255,0.15)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        padding: 0,
        flexShrink: 0,
    }),
    stepperValue: {
        minWidth: "56px",
        textAlign: "center" as const,
        fontSize: "18px",
        fontWeight: 700,
        color: "#3B82F6",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
    } as React.CSSProperties,
    stepperUnit: {
        fontSize: "11px",
        fontWeight: 500,
        color: "var(--text-muted)",
        textAlign: "center" as const,
        marginTop: "-2px",
    } as React.CSSProperties,

    /* Toggle row */
    toggleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px 0",
    } as React.CSSProperties,
    toggleRowBorder: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
    } as React.CSSProperties,
    toggleLabel: {
        fontSize: "13px",
        fontWeight: 500,
        color: "var(--text-primary)",
        lineHeight: 1.3,
    } as React.CSSProperties,
    toggleDesc: {
        fontSize: "11.5px",
        color: "var(--text-muted)",
        margin: "3px 0 0 0",
        lineHeight: 1.4,
    } as React.CSSProperties,

    /* Toggle switch (42x24, blue active, white knob) */
    toggle: (active: boolean): React.CSSProperties => ({
        width: "42px",
        height: "24px",
        borderRadius: "12px",
        background: active ? "#3B82F6" : "rgba(255,255,255,0.08)",
        border: active ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
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

    /* Select dropdown */
    select: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        cursor: "pointer",
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
        appearance: "none" as const,
        WebkitAppearance: "none" as const,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "32px",
    } as React.CSSProperties,

    /* Time input */
    timeInput: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        textAlign: "center" as const,
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
        width: "120px",
    } as React.CSSProperties,

    /* Phone input */
    phoneInput: {
        width: "100%",
        maxWidth: "260px",
        padding: "9px 12px 9px 40px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
    } as React.CSSProperties,
    phonePrefix: {
        position: "absolute" as const,
        left: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--text-muted)",
        fontSize: "13px",
        fontWeight: 500,
        pointerEvents: "none" as const,
    } as React.CSSProperties,

    /* Inline label */
    inlineLabel: {
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--text-secondary)",
        marginBottom: "6px",
        display: "block",
    } as React.CSSProperties,

    /* Collapsible content area for digest settings */
    digestPanel: (open: boolean): React.CSSProperties => ({
        overflow: "hidden",
        maxHeight: open ? "200px" : "0",
        opacity: open ? 1 : 0,
        transition: "all 0.3s ease",
        marginTop: open ? "4px" : "0",
    }),

    /* Save button */
    saveBtn: (saving: boolean, saved: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minWidth: "175px",
        padding: "10px 24px",
        borderRadius: "10px",
        border: saved
            ? "1px solid rgba(34,197,94,0.3)"
            : "1px solid rgba(59,130,246,0.3)",
        background: saved
            ? "rgba(34,197,94,0.12)"
            : "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08))",
        color: saved ? "#22C55E" : "#3B82F6",
        fontSize: "13px",
        fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer",
        transition: "all 0.3s ease",
        opacity: saving ? 0.7 : 1,
        letterSpacing: "0.2px",
    }),

    /* Error box */
    errorBox: {
        padding: "10px 14px",
        borderRadius: "10px",
        background: "rgba(239,68,68,0.07)",
        border: "1px solid rgba(239,68,68,0.14)",
        color: "#EF4444",
        fontSize: "12px",
        marginBottom: "14px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    } as React.CSSProperties,

    /* Phone error */
    phoneError: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        color: "#EF4444",
        fontSize: "11.5px",
        marginTop: "6px",
    } as React.CSSProperties,
};

/* ───────────────────────────── Component ──────────────────────────── */

export default function AppointmentConfigSection({ orgId, orgSettings }: AppointmentConfigSectionProps) {
    const [config, setConfig] = useState<AppointmentConfig>(DEFAULT_APPOINTMENT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [phoneError, setPhoneError] = useState<string | null>(null);

    // ── Load config from org settings ───────────────────────
    useEffect(() => {
        const existing = orgSettings?.appointment_config as Partial<AppointmentConfig> | undefined;
        if (existing) {
            setConfig({ ...DEFAULT_APPOINTMENT_CONFIG, ...existing });
        }
        setLoading(false);
    }, [orgSettings]);

    // ── Update a field ──────────────────────────────────────
    const updateField = <K extends keyof AppointmentConfig>(field: K, value: AppointmentConfig[K]) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
    };

    // ── Validacion de telefono chileno ─────────────────────
    const validatePhone = (phone: string) => {
        if (!phone) { setPhoneError(null); return true; }
        const cleaned = phone.replace(/[\s\-\+]/g, "");
        if (!/^569\d{8}$/.test(cleaned)) {
            setPhoneError("Formato: 569XXXXXXXX (ej: 569 1234 5678)");
            return false;
        }
        setPhoneError(null);
        return true;
    };

    // ── Save handler (update org settings JSONB) ────────────
    const handleSave = async () => {
        if (!validatePhone(config.owner_phone)) {
            setError("Corrige el telefono antes de guardar");
            return;
        }
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const newSettings = { ...orgSettings, appointment_config: config };
            const res = await fetch("/api/org/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: orgId, settings: newSettings }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Error guardando configuracion");
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error guardando configuracion");
        } finally {
            setSaving(false);
        }
    };

    /* ─── Stepper helper ──────────────────────────────────── */
    const Stepper = ({
        value,
        onChange,
        min,
        max,
        step = 1,
        label,
        unit,
        icon,
    }: {
        value: number;
        onChange: (v: number) => void;
        min: number;
        max: number;
        step?: number;
        label: string;
        unit: string;
        icon: React.ReactNode;
    }) => {
        const canDec = value - step >= min;
        const canInc = value + step <= max;
        return (
            <div style={s.stepperCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#3B82F6", display: "flex" }}>{icon}</span>
                    <span style={s.stepperLabel}>{label}</span>
                </div>
                <div style={s.stepperControls}>
                    <button
                        type="button"
                        style={s.stepperBtn(!canDec)}
                        disabled={!canDec}
                        onClick={() => canDec && onChange(value - step)}
                        aria-label={`Reducir ${label}`}
                    >
                        <Minus size={14} />
                    </button>
                    <div style={s.stepperValue}>{value}</div>
                    <button
                        type="button"
                        style={s.stepperBtn(!canInc)}
                        disabled={!canInc}
                        onClick={() => canInc && onChange(value + step)}
                        aria-label={`Aumentar ${label}`}
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <span style={s.stepperUnit}>{unit}</span>
            </div>
        );
    };

    /* ─── Toggle helper ───────────────────────────────────── */
    const Toggle = ({
        active,
        onToggle,
        label,
        description,
        hasBorder = true,
    }: {
        active: boolean;
        onToggle: () => void;
        label: string;
        description: string;
        hasBorder?: boolean;
    }) => (
        <div style={hasBorder ? s.toggleRowBorder : s.toggleRow}>
            <div style={{ flex: 1 }}>
                <span style={s.toggleLabel}>{label}</span>
                <p style={s.toggleDesc}>{description}</p>
            </div>
            <button type="button" style={s.toggle(active)} onClick={onToggle}>
                <div style={s.toggleKnob(active)} />
            </button>
        </div>
    );

    /* ─── Loading state ───────────────────────────────────── */
    if (loading) {
        return (
            <SectionCard
                icon={<Calendar size={16} />}
                title="Configuracion de Citas"
                subtitle="Parametros generales para el sistema de agendamiento"
            >
                <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            </SectionCard>
        );
    }

    /* ─── Render ───────────────────────────────────────────── */
    return (
        <SectionCard
            icon={<Calendar size={16} />}
            title="Configuracion de Citas"
            subtitle="Parametros generales para el sistema de agendamiento"
            footer={
                <button
                    style={s.saveBtn(saving, saved)}
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
                            Guardar Configuracion
                        </>
                    )}
                </button>
            }
        >
            {/* ─── Error ──────────────────────────────────────── */}
            {error && (
                <div style={s.errorBox}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {error}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* ═══════════════════════════════════════════════════
                    GROUP 1: DURACION Y TIEMPO
                   ═══════════════════════════════════════════════════ */}
                <div style={s.groupCard}>
                    <div style={s.groupHeader}>
                        <div style={s.groupHeaderIcon("#3B82F6")}>
                            <Timer size={14} />
                        </div>
                        <div>
                            <div style={s.groupLabel}>Duracion y Tiempo</div>
                            <div style={s.groupDesc}>Define la duracion de las citas y los intervalos</div>
                        </div>
                    </div>

                    <div style={s.numericGrid}>
                        <Stepper
                            value={config.slot_duration_minutes}
                            onChange={(v) => updateField("slot_duration_minutes", v)}
                            min={5}
                            max={480}
                            step={5}
                            label="Duracion"
                            unit="minutos por cita"
                            icon={<Clock size={13} />}
                        />
                        <Stepper
                            value={config.buffer_minutes}
                            onChange={(v) => updateField("buffer_minutes", v)}
                            min={0}
                            max={120}
                            step={5}
                            label="Descanso"
                            unit="minutos entre citas"
                            icon={<Pause size={13} />}
                        />
                        <Stepper
                            value={config.max_advance_days}
                            onChange={(v) => updateField("max_advance_days", v)}
                            min={1}
                            max={365}
                            step={1}
                            label="Anticipacion"
                            unit="dias maximo"
                            icon={<CalendarDays size={13} />}
                        />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    GROUP 2: PERMISOS DEL CLIENTE
                   ═══════════════════════════════════════════════════ */}
                <div style={s.groupCard}>
                    <div style={s.groupHeader}>
                        <div style={s.groupHeaderIcon("#8B5CF6")}>
                            <Shield size={14} />
                        </div>
                        <div>
                            <div style={s.groupLabel}>Permisos del Cliente</div>
                            <div style={s.groupDesc}>Controla que pueden hacer tus clientes con sus citas</div>
                        </div>
                    </div>

                    <Toggle
                        active={config.allow_client_cancel}
                        onToggle={() => updateField("allow_client_cancel", !config.allow_client_cancel)}
                        label="Permitir cancelar citas"
                        description="Los clientes pueden cancelar sus citas directamente por WhatsApp"
                    />

                    <Toggle
                        active={config.allow_client_reschedule}
                        onToggle={() => updateField("allow_client_reschedule", !config.allow_client_reschedule)}
                        label="Permitir reagendar citas"
                        description="Los clientes pueden cambiar la fecha/hora de sus citas"
                        hasBorder={config.allow_client_reschedule}
                    />

                    {/* Reschedule policy - visible when reschedule is allowed */}
                    <div style={{
                        overflow: "hidden",
                        maxHeight: config.allow_client_reschedule ? "120px" : "0",
                        opacity: config.allow_client_reschedule ? 1 : 0,
                        transition: "all 0.3s ease",
                        paddingTop: config.allow_client_reschedule ? "8px" : "0",
                    }}>
                        <div style={{ paddingLeft: "2px" }}>
                            <label style={s.inlineLabel}>Politica de reagendamiento</label>
                            <div style={{ position: "relative", maxWidth: "280px" }}>
                                <select
                                    value={config.reschedule_policy}
                                    onChange={(e) =>
                                        updateField(
                                            "reschedule_policy",
                                            e.target.value as "self_service" | "escalate_to_human"
                                        )
                                    }
                                    style={s.select}
                                >
                                    <option value="self_service">Libre por WhatsApp</option>
                                    <option value="escalate_to_human">Derivar a humano</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    GROUP 3: NOTIFICACIONES
                   ═══════════════════════════════════════════════════ */}
                <div style={s.groupCard}>
                    <div style={s.groupHeader}>
                        <div style={s.groupHeaderIcon("#F59E0B")}>
                            <Bell size={14} />
                        </div>
                        <div>
                            <div style={s.groupLabel}>Notificaciones</div>
                            <div style={s.groupDesc}>Configura alertas y resumenes de citas por WhatsApp</div>
                        </div>
                    </div>

                    <Toggle
                        active={config.daily_digest_enabled}
                        onToggle={() => updateField("daily_digest_enabled", !config.daily_digest_enabled)}
                        label="Resumen diario por WhatsApp"
                        description="Recibe cada manana un resumen con las citas del dia"
                        hasBorder={false}
                    />

                    {/* Digest settings - animated collapse */}
                    <div style={s.digestPanel(config.daily_digest_enabled)}>
                        <div style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "16px",
                            padding: "12px 0 4px 0",
                            borderTop: "1px solid rgba(255,255,255,0.04)",
                        }}>
                            <div>
                                <label style={s.inlineLabel}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <Clock size={11} />
                                        Hora de envio
                                    </span>
                                </label>
                                <input
                                    type="time"
                                    value={config.daily_digest_time}
                                    onChange={(e) => updateField("daily_digest_time", e.target.value)}
                                    style={s.timeInput}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Owner phone */}
                    <div style={{
                        padding: "14px 0 4px 0",
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        marginTop: "4px",
                    }}>
                        <label style={s.inlineLabel}>
                            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <Phone size={11} />
                                Telefono para notificaciones
                            </span>
                        </label>
                        <div style={{ position: "relative", maxWidth: "260px" }}>
                            <input
                                type="text"
                                value={config.owner_phone}
                                onChange={(e) => {
                                    updateField("owner_phone", e.target.value);
                                    validatePhone(e.target.value);
                                }}
                                placeholder="912345678"
                                style={s.phoneInput}
                            />
                            <span style={s.phonePrefix}>+56</span>
                        </div>
                        {phoneError && (
                            <div style={s.phoneError}>
                                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                                {phoneError}
                            </div>
                        )}
                        {!phoneError && config.owner_phone && (
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                color: "#22C55E",
                                fontSize: "11.5px",
                                marginTop: "6px",
                            }}>
                                <Check size={12} style={{ flexShrink: 0 }} />
                                Telefono valido
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}

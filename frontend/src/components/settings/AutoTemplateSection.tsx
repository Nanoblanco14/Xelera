"use client";
import { useState, useEffect } from "react";
import {
    Zap,
    Loader2,
    Check,
    Save,
    Moon,
    Shield,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import type {
    AutoTemplateConfig,
    AutoTemplateEvent,
} from "@/lib/auto-templates";
import {
    AUTO_TEMPLATE_EVENT_META,
    getIndustryDefaults,
} from "@/lib/auto-templates";

/* ─────────────────────── Types ────────────────────────────── */

interface AutoTemplateSectionProps {
    orgId: string;
    orgSettings: Record<string, unknown>;
}

/* ─────────────────────── Styles ───────────────────────────── */

const s = {
    groupCard: {
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "18px 20px",
        transition: "all 0.25s ease",
    } as React.CSSProperties,
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
        border: `0.5px solid ${color}28`,
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
        borderBottom: "0.5px solid rgba(255,255,255,0.04)",
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
    timeInput: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "0.5px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        textAlign: "center" as const,
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
        width: "100px",
    } as React.CSSProperties,
    numberInput: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "0.5px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: "13px",
        textAlign: "center" as const,
        outline: "none",
        width: "70px",
    } as React.CSSProperties,
    saveBtn: (saving: boolean): React.CSSProperties => ({
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 20px",
        borderRadius: "10px",
        background: saving ? "rgba(255,255,255,0.06)" : "#7a9e8a",
        color: saving ? "var(--text-muted)" : "#fff",
        fontSize: "13px",
        fontWeight: 600,
        border: "none",
        cursor: saving ? "not-allowed" : "pointer",
        transition: "all 0.25s ease",
    }),
    badge: (color: string): React.CSSProperties => ({
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        background: `${color}14`,
        color: color,
        border: `0.5px solid ${color}28`,
    }),
};

/* ─────────────────────── Event Category Groups ────────────── */

const EVENT_GROUPS: { label: string; color: string; icon: string; events: AutoTemplateEvent[] }[] = [
    {
        label: "Citas",
        color: "#7a9e8a",
        icon: "📅",
        events: ["appointment_confirmed", "appointment_reminder", "appointment_cancelled", "appointment_rescheduled"],
    },
    {
        label: "Etapas del Pipeline",
        color: "#6482aa",
        icon: "📊",
        events: ["stage_interested", "stage_qualified", "stage_handoff"],
    },
    {
        label: "Seguimiento",
        color: "#a89f94",
        icon: "🔄",
        events: ["follow_up_post_visit", "follow_up_inactive"],
    },
    {
        label: "Bienvenida",
        color: "#b8a990",
        icon: "👋",
        events: ["welcome_new_lead"],
    },
];

/* ─────────────────────── Component ────────────────────────── */

export default function AutoTemplateSection({ orgId, orgSettings }: AutoTemplateSectionProps) {
    const [config, setConfig] = useState<AutoTemplateConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Load config from org settings or defaults
    useEffect(() => {
        if (orgSettings.auto_templates) {
            setConfig(orgSettings.auto_templates as AutoTemplateConfig);
        } else {
            const industry = (orgSettings.industry_template as string) || "blank";
            setConfig(getIndustryDefaults(industry));
        }
        setLoading(false);
    }, [orgSettings]);

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const updateConfig = (updates: Partial<AutoTemplateConfig>) => {
        if (!config) return;
        setConfig({ ...config, ...updates });
    };

    const updateEvent = (event: AutoTemplateEvent, updates: Partial<{ enabled: boolean; template_name: string; cooldown_hours: number }>) => {
        if (!config) return;
        const currentEvent = config.events[event] || {
            enabled: false,
            template_name: "",
            cooldown_hours: AUTO_TEMPLATE_EVENT_META[event].defaultCooldown,
        };
        setConfig({
            ...config,
            events: {
                ...config.events,
                [event]: { ...currentEvent, ...updates },
            },
        });
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);

        try {
            const res = await fetch("/api/settings/auto-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, config }),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } catch (err) {
            console.error("Error saving auto-template config:", err);
        }

        setSaving(false);
    };

    if (loading || !config) {
        return (
            <SectionCard
                icon={<Zap size={15} />}
                title="Templates Automaticos"
                subtitle="Cargando configuracion..."
            >
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard
            icon={<Zap size={15} />}
            title="Templates Automaticos"
            subtitle="Envia templates de WhatsApp segun eventos reales — sin spam"
            footer={
                <button
                    style={s.saveBtn(saving)}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : saved ? (
                        <Check size={14} />
                    ) : (
                        <Save size={14} />
                    )}
                    {saving ? "Guardando..." : saved ? "Guardado" : "Guardar"}
                </button>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* ── Master toggle ───────────────────────────────── */}
                <div style={s.toggleRow}>
                    <div style={{ flex: 1 }}>
                        <div style={s.toggleLabel}>Activar templates automaticos</div>
                        <p style={s.toggleDesc}>
                            Envia templates de WhatsApp automaticamente cuando ocurren eventos importantes
                        </p>
                    </div>
                    <button
                        style={s.toggle(config.enabled)}
                        onClick={() => updateConfig({ enabled: !config.enabled })}
                    >
                        <div style={s.toggleKnob(config.enabled)} />
                    </button>
                </div>

                {config.enabled && (
                    <>
                        {/* ── Anti-spam controls ─────────────────────── */}
                        <div style={s.groupCard}>
                            <div style={s.groupHeader}>
                                <div style={s.groupHeaderIcon("#7a9e8a")}>
                                    <Shield size={14} />
                                </div>
                                <div>
                                    <div style={s.groupLabel}>Control Anti-Spam</div>
                                    <div style={s.groupDesc}>Protege a tus clientes de exceso de mensajes</div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {/* Daily limit */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                                    <div>
                                        <div style={s.toggleLabel}>Limite diario por lead</div>
                                        <p style={s.toggleDesc}>Maximo de templates por dia a un mismo cliente</p>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={config.global_daily_limit}
                                        onChange={e => updateConfig({ global_daily_limit: Math.min(5, Math.max(1, Number(e.target.value))) })}
                                        style={s.numberInput}
                                    />
                                </div>

                                {/* Quiet hours */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <Moon size={14} style={{ color: "var(--text-muted)" }} />
                                        <div>
                                            <div style={s.toggleLabel}>Horario silencioso</div>
                                            <p style={s.toggleDesc}>No enviar templates en este rango</p>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <input
                                            type="time"
                                            value={config.quiet_hours.start}
                                            onChange={e => updateConfig({
                                                quiet_hours: { ...config.quiet_hours, start: e.target.value }
                                            })}
                                            style={s.timeInput}
                                        />
                                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>a</span>
                                        <input
                                            type="time"
                                            value={config.quiet_hours.end}
                                            onChange={e => updateConfig({
                                                quiet_hours: { ...config.quiet_hours, end: e.target.value }
                                            })}
                                            style={s.timeInput}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Event groups ────────────────────────────── */}
                        {EVENT_GROUPS.map(group => {
                            const isExpanded = expandedGroups[group.label] !== false; // default expanded
                            const enabledCount = group.events.filter(e => config.events[e]?.enabled).length;

                            return (
                                <div key={group.label} style={s.groupCard}>
                                    <button
                                        onClick={() => toggleGroup(group.label)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            width: "100%",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: 0,
                                            marginBottom: isExpanded ? "12px" : 0,
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <div style={s.groupHeaderIcon(group.color)}>
                                                <span style={{ fontSize: "13px" }}>{group.icon}</span>
                                            </div>
                                            <div style={{ textAlign: "left" }}>
                                                <div style={s.groupLabel}>{group.label}</div>
                                                <div style={s.groupDesc}>
                                                    {enabledCount} de {group.events.length} activos
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                                        ) : (
                                            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                                        )}
                                    </button>

                                    {isExpanded && (
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            {group.events.map((event, idx) => {
                                                const meta = AUTO_TEMPLATE_EVENT_META[event];
                                                const eventConfig = config.events[event];
                                                const isEnabled = eventConfig?.enabled || false;
                                                const isLast = idx === group.events.length - 1;

                                                return (
                                                    <div
                                                        key={event}
                                                        style={isLast ? s.toggleRow : s.toggleRowBorder}
                                                    >
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                <div style={s.toggleLabel}>{meta.label}</div>
                                                            </div>
                                                            <p style={s.toggleDesc}>{meta.description}</p>

                                                            {isEnabled && (
                                                                <div style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "12px",
                                                                    marginTop: "8px",
                                                                    flexWrap: "wrap",
                                                                }}>
                                                                    {/* Template name input */}
                                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Template:</span>
                                                                        <input
                                                                            type="text"
                                                                            value={eventConfig?.template_name || ""}
                                                                            onChange={e => updateEvent(event, { template_name: e.target.value })}
                                                                            placeholder="nombre_template"
                                                                            style={{
                                                                                ...s.timeInput,
                                                                                width: "180px",
                                                                                textAlign: "left" as const,
                                                                                fontSize: "12px",
                                                                                fontFamily: "monospace",
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Cooldown */}
                                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Cooldown:</span>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            max={336}
                                                                            value={eventConfig?.cooldown_hours || meta.defaultCooldown}
                                                                            onChange={e => updateEvent(event, { cooldown_hours: Number(e.target.value) })}
                                                                            style={{ ...s.numberInput, width: "60px" }}
                                                                        />
                                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>hrs</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            style={s.toggle(isEnabled)}
                                                            onClick={() => updateEvent(event, { enabled: !isEnabled })}
                                                        >
                                                            <div style={s.toggleKnob(isEnabled)} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </SectionCard>
    );
}

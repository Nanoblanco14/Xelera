"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org-context";
import {
    Loader2,
    Users,
    CalendarCheck,
    TrendingUp,
    MessageSquare,
    Bot,
    Package,
    ArrowRight,
    Zap,
    Phone,
    Clock,
    Plus,
    ExternalLink,
    Sparkles,
    CheckCircle,
    Circle,
    Settings,
    HelpCircle,
    Kanban,
} from "lucide-react";
import { PlanUsageCard } from "@/components/plan";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface StageEntry {
    stage_id: string;
    stage_name: string;
    color: string | null;
    count: number;
}

interface RecentLead {
    id: string;
    name: string;
    phone: string;
    source: string;
    created_at: string;
    stage_name: string;
    stage_color: string | null;
}

interface AgentInfo {
    id: string;
    name: string;
    is_active: boolean;
    model: string | null;
    welcome_message: string | null;
    conversation_tone: string | null;
}

interface SetupChecklist {
    agent: boolean;
    products: boolean;
    whatsapp: boolean;
    pipeline: boolean;
    faqs: boolean;
}

interface DashboardData {
    totalLeads: number;
    citasAgendadas: number;
    conversionRate: number;
    aiMessages: number;
    timeSavedMinutes: number;
    timeSavedHours: number;
    productCount: number;
    leadsByStage: StageEntry[];
    leadsBySource: { source: string; count: number }[];
    recentLeads: RecentLead[];
    agent: AgentInfo | null;
    checklist: SetupChecklist;
    checklistTotal: number;
    checklistMax: number;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos dias";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
}

/* ═══════════════════════════════════════════════════════════
   KPI Card Component
   ═══════════════════════════════════════════════════════════ */

function KpiCard({
    icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub: string;
    accent?: string;
}) {
    const accentColor = accent || "#7a9e8a";
    return (
        <div
            className="kpi-card"
            style={{
                backgroundImage: `
                    radial-gradient(ellipse at 15% -10%, ${accentColor}0a 0%, transparent 55%),
                    radial-gradient(ellipse at 85% 110%, ${accentColor}06 0%, transparent 55%),
                    var(--gradient-card)
                `,
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${accentColor}35`;
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = `var(--shadow-elevated), 0 0 24px ${accentColor}0a`;
                const glow = e.currentTarget.querySelector("[data-glow]") as HTMLElement;
                if (glow) glow.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
                const glow = e.currentTarget.querySelector("[data-glow]") as HTMLElement;
                if (glow) glow.style.opacity = "0.4";
            }}
        >
            {/* Top glow line */}
            <div
                data-glow
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: `linear-gradient(90deg, transparent 10%, ${accentColor}40 50%, transparent 90%)`,
                    opacity: 0.4,
                    transition: "opacity 0.3s ease",
                }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                    style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
                        border: `0.5px solid ${accentColor}28`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px ${accentColor}0a`,
                        backdropFilter: "blur(4px)",
                        color: accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </div>
                <span
                    style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                    }}
                >
                    {label}
                </span>
            </div>
            <div>
                <div
                    className="font-display"
                    style={{
                        fontSize: "2.2rem",
                        fontWeight: 400,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {value}
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "8px", lineHeight: 1.4 }}>
                    {sub}
                </p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   Quick Action Button
   ═══════════════════════════════════════════════════════════ */

function QuickAction({
    icon,
    label,
    description,
    href,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    href: string;
    accent: string;
}) {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push(href)}
            style={{
                background: "rgba(255,255,255,0.015)",
                border: "0.5px solid rgba(255,255,255,0.05)",
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                textAlign: "left",
                width: "100%",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accent + "30";
                e.currentTarget.style.background = `${accent}08`;
                e.currentTarget.style.transform = "translateX(4px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                e.currentTarget.style.background = "rgba(255,255,255,0.015)";
                e.currentTarget.style.transform = "translateX(0)";
            }}
        >
            <div
                style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: `linear-gradient(135deg, ${accent}15 0%, ${accent}08 100%)`,
                    border: `0.5px solid ${accent}22`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
                    color: accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "2px",
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                    }}
                >
                    {description}
                </div>
            </div>
            <ArrowRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </button>
    );
}

/* ═══════════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════════ */

export default function DashboardHome() {
    const { organization } = useOrg();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`/api/dashboard?org_id=${organization.id}`);
            if (!res.ok) {
                console.error("Dashboard API error:", res.status, res.statusText);
                setError("Error al cargar el dashboard. Intenta de nuevo.");
                setLoading(false);
                return;
            }
            const json = await res.json();
            if (json.data) setData(json.data);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
            setError("No se pudieron cargar los datos del dashboard. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    /* ── Loading ──────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    /* ── Empty / Error ────────────────────────────────────── */
    if (!data) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">Centro de comando</p>
                    </div>
                </div>
                <div style={{ textAlign: "center", padding: "80px 40px", background: "radial-gradient(ellipse at center, rgba(199,90,90,0.04) 0%, transparent 60%)", borderRadius: "16px" }}>
                    <Zap size={44} style={{ color: "var(--text-muted)", margin: "0 auto 20px", opacity: 0.2 }} />
                    <p style={{ fontSize: "0.92rem", color: "var(--text-muted)", marginBottom: "20px" }}>No se pudieron cargar los datos del dashboard</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: "rgba(199,90,90,0.08)",
                            border: "0.5px solid rgba(199,90,90,0.18)",
                            borderRadius: "10px",
                            padding: "10px 22px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: "var(--danger)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        Reintentar <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        );
    }

    const greeting = getGreeting();
    const orgName = organization.name;

    return (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "36px" }}>

            {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", margin: "0 0 8px 0", color: "#f87171", fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                 WELCOME HEADER
                 ══════════════════════════════════════════════════════ */}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes dashFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
                .dash-stagger-1 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s forwards; }
                .dash-stagger-2 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.12s forwards; }
                .dash-stagger-3 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.19s forwards; }
                .dash-stagger-4 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.26s forwards; }
                .dash-stagger-5 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.33s forwards; }
                .dash-stagger-6 { opacity: 0; animation: dashFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.40s forwards; }
                .dash-lead-row { position: relative; }
                .dash-lead-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; border-radius: 2px; background: var(--accent-sage); opacity: 0; transform: scaleY(0); transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1); }
                .dash-lead-row:hover::before { opacity: 1; transform: scaleY(1); }
            `}</style>
            <div className="dash-stagger-1" style={{ marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: "linear-gradient(135deg, rgba(122,158,138,0.15) 0%, rgba(122,158,138,0.05) 100%)",
                            border: "0.5px solid rgba(122,158,138,0.2)",
                            boxShadow: "0 4px 20px rgba(122,158,138,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
                            backdropFilter: "blur(8px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Zap size={20} style={{ color: "var(--accent-light)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1
                            className="font-display"
                            style={{
                                fontSize: "1.75rem",
                                fontWeight: 400,
                                color: "var(--text-primary)",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.2,
                            }}
                        >
                            {greeting}, <span style={{ color: "var(--accent-sage)" }}>{orgName}</span>
                        </h1>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "var(--text-muted)", opacity: 0.5 }} />
                            <span style={{ color: "var(--text-secondary)" }}>Centro de comando</span>
                        </p>
                    </div>
                    <button
                        onClick={() => loadDashboard()}
                        disabled={loading}
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "0.5px solid var(--border)",
                            borderRadius: 10,
                            padding: "8px 16px",
                            cursor: loading ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "0.78rem",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(122,158,138,0.3)"; e.currentTarget.style.color = "var(--accent-sage)"; e.currentTarget.style.background = "rgba(122,158,138,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    >
                        <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
                        Actualizar
                    </button>
                </div>
                {/* Gradient divider line */}
                <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(122,158,138,0.2), transparent)", marginTop: "12px" }} />
            </div>

            {/* ══════════════════════════════════════════════════════
                 SETUP CHECKLIST (only if not all complete)
                 ══════════════════════════════════════════════════════ */}
            {data.checklistTotal < data.checklistMax && (
                <div
                    className="dash-stagger-1 glass-card"
                    style={{
                        backgroundImage: "linear-gradient(135deg, rgba(122,158,138,0.06) 0%, rgba(93,130,112,0.02) 100%), var(--gradient-card)",
                        borderColor: "rgba(122,158,138,0.12)",
                        padding: "24px 28px",
                    }}
                >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "10px",
                                    background: "linear-gradient(135deg, rgba(122,158,138,0.15) 0%, rgba(122,158,138,0.06) 100%)",
                                    border: "0.5px solid rgba(122,158,138,0.2)",
                                    boxShadow: "0 2px 8px rgba(122,158,138,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--accent-light)",
                                }}
                            >
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                                    Configuracion inicial
                                </h3>
                                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    {data.checklistTotal} de {data.checklistMax} pasos completados
                                </p>
                            </div>
                        </div>
                        <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--accent-sage)",
                            padding: "4px 12px",
                            borderRadius: "100px",
                            background: "rgba(122,158,138,0.08)",
                            border: "0.5px solid rgba(122,158,138,0.15)",
                        }}>
                            {Math.round((data.checklistTotal / data.checklistMax) * 100)}%
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div
                        style={{
                            height: "4px",
                            borderRadius: "100px",
                            background: "rgba(255,255,255,0.06)",
                            marginBottom: "22px",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: `${(data.checklistTotal / data.checklistMax) * 100}%`,
                                borderRadius: "100px",
                                background: "linear-gradient(90deg, var(--accent-sage), var(--accent-dark))",
                                transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                                boxShadow: "0 0 8px rgba(122,158,138,0.2)",
                            }}
                        />
                    </div>

                    {/* Checklist items */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: "10px",
                        }}
                    >
                        {([
                            {
                                key: "agent" as const,
                                label: "Configurar Asistente",
                                desc: "Crea y personaliza tu agente IA",
                                href: "/dashboard/agents",
                                icon: <Bot size={15} />,
                                accent: "#7a9e8a",
                            },
                            {
                                key: "products" as const,
                                label: "Subir Catalogo",
                                desc: "Agrega productos o servicios",
                                href: "/dashboard/products",
                                icon: <Package size={15} />,
                                accent: "#22c55e",
                            },
                            {
                                key: "whatsapp" as const,
                                label: "Conectar WhatsApp",
                                desc: "Vincula tu numero de WhatsApp",
                                href: "/dashboard/settings",
                                icon: <Phone size={15} />,
                                accent: "#25d366",
                            },
                            {
                                key: "pipeline" as const,
                                label: "Crear Pipeline",
                                desc: "Organiza tus etapas de venta",
                                href: "/dashboard/pipeline",
                                icon: <Kanban size={15} />,
                                accent: "#f59e0b",
                            },
                            {
                                key: "faqs" as const,
                                label: "Agregar FAQs",
                                desc: "Respuestas rapidas para tu agente",
                                href: "/dashboard/agents",
                                icon: <HelpCircle size={15} />,
                                accent: "#5d8270",
                            },
                        ] as const).map((item) => {
                            const done = data.checklist[item.key];
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => !done && router.push(item.href)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "14px 16px",
                                        borderRadius: "12px",
                                        background: done
                                            ? "rgba(122,158,138,0.04)"
                                            : "rgba(255,255,255,0.02)",
                                        border: done
                                            ? "0.5px solid rgba(122,158,138,0.12)"
                                            : "0.5px solid rgba(255,255,255,0.05)",
                                        cursor: done ? "default" : "pointer",
                                        textAlign: "left",
                                        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                                        opacity: done ? 0.65 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!done) {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                            e.currentTarget.style.borderColor = `${item.accent}35`;
                                            e.currentTarget.style.transform = "translateY(-1px)";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!done) {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                                            e.currentTarget.style.transform = "translateY(0)";
                                        }
                                    }}
                                >
                                    {/* Status icon */}
                                    {done ? (
                                        <CheckCircle size={18} style={{ color: "var(--accent-sage)", flexShrink: 0 }} />
                                    ) : (
                                        <div
                                            style={{
                                                width: "18px",
                                                height: "18px",
                                                borderRadius: "50%",
                                                border: `1.5px solid var(--text-dim)`,
                                                flexShrink: 0,
                                                transition: "border-color 0.2s ease",
                                            }}
                                        />
                                    )}

                                    {/* Icon */}
                                    <div
                                        style={{
                                            width: "30px",
                                            height: "30px",
                                            borderRadius: "8px",
                                            background: done ? "rgba(122,158,138,0.06)" : `${item.accent}10`,
                                            border: `0.5px solid ${done ? "rgba(122,158,138,0.12)" : `${item.accent}22`}`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: done ? "var(--text-muted)" : item.accent,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {item.icon}
                                    </div>

                                    {/* Text */}
                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: "0.82rem",
                                                fontWeight: 600,
                                                color: done ? "var(--text-muted)" : "var(--text-primary)",
                                                textDecoration: done ? "line-through" : "none",
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {item.label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.7rem",
                                                color: done ? "var(--text-dim)" : "var(--text-muted)",
                                                marginTop: "2px",
                                            }}
                                        >
                                            {item.desc}
                                        </div>
                                    </div>

                                    {/* Arrow for incomplete */}
                                    {!done && (
                                        <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "auto" }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                 KPI GRID (4 cards)
                 ══════════════════════════════════════════════════════ */}
            {/* Section label */}
            <div className="dash-stagger-2" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "-20px" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Metricas</span>
                <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
            </div>
            <div
                className="dash-stagger-2"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "16px",
                }}
            >
                <KpiCard
                    icon={<Users size={16} />}
                    label="Total Leads"
                    value={data.totalLeads}
                    sub="Leads captados por la IA"
                    accent="#6482aa"
                />
                <KpiCard
                    icon={<CalendarCheck size={16} />}
                    label="Citas Agendadas"
                    value={data.citasAgendadas}
                    sub="Visitas o reuniones programadas"
                    accent="#22c55e"
                />
                <KpiCard
                    icon={<TrendingUp size={16} />}
                    label="Conversion"
                    value={`${data.conversionRate}%`}
                    sub={`${data.citasAgendadas} de ${data.totalLeads} agendaron`}
                    accent="#7a9e8a"
                />
                <KpiCard
                    icon={<MessageSquare size={16} />}
                    label="Mensajes IA"
                    value={data.aiMessages}
                    sub="Respuestas automaticas enviadas"
                    accent="#a89f94"
                />
            </div>

            {/* ══════════════════════════════════════════════════════
                 MIDDLE ROW: Quick Actions + Agent Status
                 ══════════════════════════════════════════════════════ */}
            <div className="dash-stagger-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* ── Quick Actions ─────────────────────────────── */}
                <div
                    className="glass-card"
                    style={{
                        padding: "24px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "18px",
                        }}
                    >
                        <div style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            background: "linear-gradient(135deg, rgba(168,159,148,0.12) 0%, rgba(168,159,148,0.04) 100%)",
                            border: "0.5px solid rgba(168,159,148,0.18)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent-warm)",
                        }}>
                            <Sparkles size={14} />
                        </div>
                        <h3
                            style={{
                                fontSize: "0.88rem",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                            }}
                        >
                            Acciones rapidas
                        </h3>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <QuickAction
                            icon={<Plus size={18} />}
                            label="Agregar Producto"
                            description="Agrega items a tu catalogo"
                            href="/dashboard/products"
                            accent="#22c55e"
                        />
                        <QuickAction
                            icon={<Bot size={18} />}
                            label="Configurar Asistente"
                            description="Ajusta la personalidad de tu IA"
                            href="/dashboard/agents"
                            accent="#7a9e8a"
                        />
                        <QuickAction
                            icon={<TrendingUp size={18} />}
                            label="Ver Analitica"
                            description="Metricas detalladas y graficos"
                            href="/dashboard/analytics"
                            accent="#5d8270"
                        />
                    </div>
                </div>

                {/* ── Agent Status ──────────────────────────────── */}
                <div
                    className="glass-card"
                    style={{
                        backgroundImage: "linear-gradient(135deg, rgba(122,158,138,0.06) 0%, rgba(93,130,112,0.03) 100%), var(--gradient-card)",
                        borderColor: "rgba(122,158,138,0.12)",
                        padding: "24px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "18px",
                            }}
                        >
                            <div
                                style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "8px",
                                    background: "rgba(122,158,138,0.1)",
                                    border: "0.5px solid rgba(122,158,138,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--accent-light)",
                                }}
                            >
                                <Bot size={14} />
                            </div>
                            <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                Estado del Asistente
                            </h3>
                        </div>

                        {data.agent ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {/* Agent name & status */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span className="font-display" style={{ fontSize: "1.15rem", fontWeight: 400, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                                        {data.agent.name}
                                    </span>
                                    <span
                                        style={{
                                            padding: "4px 12px",
                                            borderRadius: "100px",
                                            fontSize: "0.72rem",
                                            fontWeight: 600,
                                            background: data.agent.is_active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                                            color: data.agent.is_active ? "#22c55e" : "#ef4444",
                                            border: `0.5px solid ${data.agent.is_active ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                                        }}
                                    >
                                        {data.agent.is_active ? "Activo" : "Inactivo"}
                                    </span>
                                </div>

                                {/* Agent details */}
                                <div
                                    style={{
                                        padding: "14px 16px",
                                        borderRadius: "12px",
                                        background: "rgba(255,255,255,0.03)",
                                        border: "0.5px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    {data.agent.welcome_message ? (
                                        <p
                                            style={{
                                                fontSize: "0.82rem",
                                                color: "var(--text-secondary)",
                                                lineHeight: 1.6,
                                                marginBottom: "10px",
                                            }}
                                        >
                                            &ldquo;{data.agent.welcome_message.slice(0, 100)}
                                            {data.agent.welcome_message.length > 100 ? "..." : ""}
                                            &rdquo;
                                        </p>
                                    ) : (
                                        <p
                                            style={{
                                                fontSize: "0.82rem",
                                                color: "var(--text-muted)",
                                                lineHeight: 1.6,
                                                marginBottom: "10px",
                                                fontStyle: "italic",
                                            }}
                                        >
                                            Sin mensaje de bienvenida configurado
                                        </p>
                                    )}
                                    <div style={{ display: "flex", gap: "16px" }}>
                                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            Modelo: <strong style={{ color: "var(--text-secondary)" }}>{data.agent.model || "gpt-4o-mini"}</strong>
                                        </span>
                                        {data.agent.conversation_tone && (
                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                Tono: <strong style={{ color: "var(--text-secondary)" }}>{data.agent.conversation_tone}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", padding: "32px 16px", background: "radial-gradient(ellipse at center, rgba(122,158,138,0.05) 0%, transparent 70%)", borderRadius: "12px" }}>
                                <Bot size={38} style={{ color: "var(--text-muted)", margin: "0 auto 14px", opacity: 0.25 }} />
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                                    No tienes un asistente configurado
                                </p>
                                <button
                                    onClick={() => router.push("/dashboard/agents")}
                                    style={{
                                        background: "linear-gradient(135deg, rgba(122,158,138,0.15), rgba(93,130,112,0.1))",
                                        color: "var(--accent-light)",
                                        border: "0.5px solid rgba(122,158,138,0.2)",
                                        padding: "10px 22px",
                                        borderRadius: "10px",
                                        fontSize: "0.82rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        transition: "all 0.25s ease",
                                    }}
                                >
                                    <Plus size={16} /> Crear Asistente
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Quick stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "16px" }}>
                        {[
                            { label: "Productos", value: data.productCount, color: "#22c55e" },
                            { label: "Mensajes IA", value: data.aiMessages, color: "#5d8270" },
                            {
                                label: "Tiempo ahorrado",
                                value: data.timeSavedHours > 0 ? `${data.timeSavedHours}h` : `${data.timeSavedMinutes}m`,
                                color: "#f59e0b",
                            },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "0.5px solid rgba(255,255,255,0.05)",
                                }}
                            >
                                <div
                                    className="font-display"
                                    style={{
                                        fontSize: "1.4rem",
                                        fontWeight: 400,
                                        color: stat.color,
                                        letterSpacing: "-0.02em",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {stat.value}
                                </div>
                                <div
                                    style={{
                                        fontSize: "0.65rem",
                                        color: "var(--text-muted)",
                                        marginTop: "3px",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                    }}
                                >
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                 PLAN USAGE
                 ══════════════════════════════════════════════════════ */}
            <div className="dash-stagger-4">
                <PlanUsageCard />
            </div>

            {/* ══════════════════════════════════════════════════════
                 BOTTOM ROW: Recent Leads + Pipeline Overview
                 ══════════════════════════════════════════════════════ */}
            {/* Section label */}
            <div className="dash-stagger-4" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "-20px" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Actividad</span>
                <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
            </div>
            <div className="dash-stagger-4" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>

                {/* ── Recent Leads ─────────────────────────────── */}
                <div
                    className="glass-card"
                    style={{
                        padding: "24px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                                style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "8px",
                                    background: "linear-gradient(135deg, rgba(100,130,170,0.12) 0%, rgba(100,130,170,0.04) 100%)",
                                    border: "0.5px solid rgba(100,130,170,0.18)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--accent-slate)",
                                }}
                            >
                                <Users size={14} />
                            </div>
                            <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                Leads Recientes
                            </h3>
                        </div>
                        <button
                            onClick={() => router.push("/dashboard/pipeline")}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent-sage)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                transition: "gap 0.25s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.gap = "8px"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.gap = "6px"; }}
                        >
                            Ver todos <ArrowRight size={13} />
                        </button>
                    </div>

                    {data.recentLeads.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 24px", background: "radial-gradient(ellipse at center, rgba(100,130,170,0.04) 0%, transparent 70%)", borderRadius: "12px" }}>
                            <Users size={36} style={{ color: "var(--text-muted)", margin: "0 auto 14px", opacity: 0.25 }} />
                            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                                Aun no tienes leads. Llegaran cuando tus clientes escriban por WhatsApp.
                            </p>
                            <button
                                onClick={() => router.push("/dashboard/settings")}
                                style={{
                                    background: "rgba(100,130,170,0.08)",
                                    border: "0.5px solid rgba(100,130,170,0.18)",
                                    borderRadius: "10px",
                                    padding: "8px 18px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    color: "var(--accent-slate)",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                Configurar WhatsApp <ArrowRight size={13} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {data.recentLeads.map((lead) => (
                                <div
                                    key={lead.id}
                                    className="dash-lead-row"
                                    onClick={() => router.push(`/dashboard/inbox?lead=${lead.id}`)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "12px 14px 12px 16px",
                                        borderRadius: "10px",
                                        background: "rgba(255,255,255,0.015)",
                                        border: "0.5px solid rgba(255,255,255,0.04)",
                                        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                                        cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(122,158,138,0.04)";
                                        e.currentTarget.style.borderColor = "rgba(122,158,138,0.1)";
                                        e.currentTarget.style.paddingLeft = "20px";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.015)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                                        e.currentTarget.style.paddingLeft = "16px";
                                    }}
                                >
                                    {/* Avatar */}
                                    <div
                                        style={{
                                            width: "36px",
                                            height: "36px",
                                            borderRadius: "10px",
                                            background: "rgba(255,255,255,0.05)",
                                            border: "0.5px solid rgba(255,255,255,0.08)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "0.82rem",
                                            fontWeight: 700,
                                            color: "var(--text-secondary)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {lead.name?.[0]?.toUpperCase() || "?"}
                                    </div>

                                    {/* Name + phone */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: "0.85rem",
                                                fontWeight: 700,
                                                color: "var(--text-primary)",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                letterSpacing: "-0.01em",
                                            }}
                                        >
                                            {lead.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.72rem",
                                                color: "var(--text-muted)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                            }}
                                        >
                                            <Phone size={10} /> {lead.phone}
                                        </div>
                                    </div>

                                    {/* Stage badge */}
                                    <span
                                        style={{
                                            padding: "3px 10px",
                                            borderRadius: "100px",
                                            fontSize: "0.68rem",
                                            fontWeight: 600,
                                            background: lead.stage_color
                                                ? `${lead.stage_color}18`
                                                : "rgba(255,255,255,0.05)",
                                            color: lead.stage_color || "var(--text-secondary)",
                                            border: `0.5px solid ${lead.stage_color ? `${lead.stage_color}30` : "rgba(255,255,255,0.08)"}`,
                                            whiteSpace: "nowrap",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {lead.stage_name}
                                    </span>

                                    {/* Time ago */}
                                    <span
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "var(--text-muted)",
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "3px",
                                        }}
                                    >
                                        <Clock size={10} /> {timeAgo(lead.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Pipeline Overview ─────────────────────────── */}
                <div
                    className="glass-card"
                    style={{
                        padding: "24px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                                style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "8px",
                                    background: "linear-gradient(135deg, rgba(122,158,138,0.12) 0%, rgba(122,158,138,0.04) 100%)",
                                    border: "0.5px solid rgba(122,158,138,0.18)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--accent-sage)",
                                }}
                            >
                                <Zap size={14} />
                            </div>
                            <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                Pipeline
                            </h3>
                        </div>
                        <button
                            onClick={() => router.push("/dashboard/pipeline")}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent-sage)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                transition: "gap 0.25s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.gap = "8px"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.gap = "6px"; }}
                        >
                            Ver pipeline <ArrowRight size={13} />
                        </button>
                    </div>

                    {data.leadsByStage.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 24px", background: "radial-gradient(ellipse at center, rgba(122,158,138,0.04) 0%, transparent 70%)", borderRadius: "12px" }}>
                            <Zap size={36} style={{ color: "var(--text-muted)", margin: "0 auto 14px", opacity: 0.25 }} />
                            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.5 }}>
                                Configura tu pipeline para organizar tus leads
                            </p>
                            <button
                                onClick={() => router.push("/dashboard/pipeline")}
                                style={{
                                    background: "rgba(122,158,138,0.08)",
                                    border: "0.5px solid rgba(122,158,138,0.18)",
                                    borderRadius: "10px",
                                    padding: "8px 18px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    color: "var(--accent-sage)",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                Crear Pipeline <ArrowRight size={13} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {data.leadsByStage.map((stage) => {
                                const totalLeadsInPipeline = data.leadsByStage.reduce((sum, s) => sum + s.count, 0) || 1;
                                const maxCount = Math.max(...data.leadsByStage.map((s) => s.count), 1);
                                const pct = Math.max((stage.count / maxCount) * 100, 4);
                                const pctOfTotal = Math.round((stage.count / totalLeadsInPipeline) * 100);
                                const stageColor = stage.color || "#7a9e8a";

                                return (
                                    <div
                                        key={stage.stage_id}
                                        style={{
                                            padding: "12px 14px",
                                            borderRadius: "10px",
                                            background: "rgba(255,255,255,0.015)",
                                            border: "0.5px solid rgba(255,255,255,0.04)",
                                            transition: "background 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {/* Color dot */}
                                                <div
                                                    style={{
                                                        width: "8px",
                                                        height: "8px",
                                                        borderRadius: "50%",
                                                        background: stageColor,
                                                        flexShrink: 0,
                                                        boxShadow: `0 0 6px ${stageColor}40`,
                                                    }}
                                                />
                                                {/* Stage name */}
                                                <span
                                                    style={{
                                                        fontSize: "0.78rem",
                                                        fontWeight: 600,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {stage.stage_name}
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                    {pctOfTotal}%
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: "0.82rem",
                                                        fontWeight: 700,
                                                        color: stageColor,
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {stage.count}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bar */}
                                        <div
                                            style={{
                                                height: "6px",
                                                borderRadius: "100px",
                                                background: "rgba(255,255,255,0.04)",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: "100%",
                                                    width: `${pct}%`,
                                                    borderRadius: "100px",
                                                    background: `linear-gradient(90deg, ${stageColor}, ${stageColor}99)`,
                                                    transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Lead source mini-summary */}
                            {data.leadsBySource.length > 0 && (
                                <div
                                    style={{
                                        marginTop: "8px",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "0.5px solid rgba(255,255,255,0.04)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 600,
                                            color: "var(--text-muted)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        Origen:
                                    </span>
                                    {data.leadsBySource.map((src) => (
                                        <span
                                            key={src.source}
                                            style={{
                                                padding: "3px 10px",
                                                borderRadius: "100px",
                                                fontSize: "0.72rem",
                                                fontWeight: 600,
                                                background: src.source === "whatsapp"
                                                    ? "rgba(34,197,94,0.1)"
                                                    : "rgba(255,255,255,0.05)",
                                                color: src.source === "whatsapp"
                                                    ? "#22c55e"
                                                    : "var(--text-secondary)",
                                                border: `0.5px solid ${src.source === "whatsapp" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
                                                textTransform: "capitalize",
                                            }}
                                        >
                                            {src.source}: {src.count}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

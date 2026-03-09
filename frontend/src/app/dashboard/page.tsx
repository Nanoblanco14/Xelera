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
    model: string;
    welcome_message: string;
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
    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "22px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                transition: "border-color 0.2s ease, background 0.2s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
                e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--bg-card)";
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                    style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        background: accent ? `${accent}18` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${accent ? `${accent}30` : "rgba(255,255,255,0.07)"}`,
                        color: accent ?? "#a1a1aa",
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
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                    }}
                >
                    {label}
                </span>
            </div>
            <div>
                <div
                    style={{
                        fontSize: "2rem",
                        fontWeight: 800,
                        color: accent ?? "var(--text-primary)",
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                    }}
                >
                    {value}
                </div>
                <p style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: "6px" }}>
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
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
                width: "100%",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accent + "50";
                e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--bg-card)";
            }}
        >
            <div
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    background: `${accent}15`,
                    border: `1px solid ${accent}25`,
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

    const loadDashboard = useCallback(async () => {
        try {
            const res = await fetch(`/api/dashboard?org_id=${organization.id}`);
            const json = await res.json();
            if (json.data) setData(json.data);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
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
                <div className="empty-state">
                    <Zap />
                    <p>No se pudieron cargar los datos del dashboard</p>
                </div>
            </div>
        );
    }

    const greeting = getGreeting();
    const orgName = organization.name;

    return (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* ══════════════════════════════════════════════════════
                 WELCOME HEADER
                 ══════════════════════════════════════════════════════ */}
            <div style={{ marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div
                        style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "13px",
                            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                            boxShadow: "0 4px 16px rgba(59,130,246,0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Zap size={20} color="white" />
                    </div>
                    <div>
                        <h1
                            style={{
                                fontSize: "1.6rem",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.2,
                            }}
                        >
                            {greeting}, <span style={{ color: "var(--accent-light)" }}>{orgName}</span>
                        </h1>
                        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                            Aqui tienes el resumen de tu plataforma
                        </p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                 SETUP CHECKLIST (only if not all complete)
                 ══════════════════════════════════════════════════════ */}
            {data.checklistTotal < data.checklistMax && (
                <div
                    style={{
                        background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.04) 100%)",
                        border: "1px solid rgba(99,102,241,0.15)",
                        borderRadius: "16px",
                        padding: "24px",
                    }}
                >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                                style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "8px",
                                    background: "rgba(59,130,246,0.12)",
                                    border: "1px solid rgba(59,130,246,0.18)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#60a5fa",
                                }}
                            >
                                <Zap size={14} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    Configuracion inicial
                                </h3>
                                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    {data.checklistTotal} de {data.checklistMax} pasos completados
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div
                        style={{
                            height: "6px",
                            borderRadius: "100px",
                            background: "rgba(255,255,255,0.06)",
                            marginBottom: "20px",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: `${(data.checklistTotal / data.checklistMax) * 100}%`,
                                borderRadius: "100px",
                                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                                transition: "width 0.6s ease",
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
                                accent: "#3b82f6",
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
                                accent: "#8b5cf6",
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
                                            ? "rgba(34,197,94,0.04)"
                                            : "rgba(255,255,255,0.03)",
                                        border: done
                                            ? "1px solid rgba(34,197,94,0.12)"
                                            : "1px solid rgba(255,255,255,0.06)",
                                        cursor: done ? "default" : "pointer",
                                        textAlign: "left",
                                        transition: "all 0.2s ease",
                                        opacity: done ? 0.7 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!done) {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                            e.currentTarget.style.borderColor = `${item.accent}40`;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!done) {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                        }
                                    }}
                                >
                                    {/* Status icon */}
                                    {done ? (
                                        <CheckCircle size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
                                    ) : (
                                        <div
                                            style={{
                                                width: "18px",
                                                height: "18px",
                                                borderRadius: "50%",
                                                border: `2px solid ${item.accent}50`,
                                                flexShrink: 0,
                                            }}
                                        />
                                    )}

                                    {/* Icon */}
                                    <div
                                        style={{
                                            width: "30px",
                                            height: "30px",
                                            borderRadius: "8px",
                                            background: `${item.accent}12`,
                                            border: `1px solid ${item.accent}25`,
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
                                                color: "var(--text-muted)",
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
            <div
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
                    accent="#3b82f6"
                />
                <KpiCard
                    icon={<MessageSquare size={16} />}
                    label="Mensajes IA"
                    value={data.aiMessages}
                    sub="Respuestas automaticas enviadas"
                    accent="#8b5cf6"
                />
            </div>

            {/* ══════════════════════════════════════════════════════
                 MIDDLE ROW: Quick Actions + Agent Status
                 ══════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* ── Quick Actions ─────────────────────────────── */}
                <div
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "16px",
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
                        <Sparkles size={16} style={{ color: "var(--text-muted)" }} />
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
                            accent="#3b82f6"
                        />
                        <QuickAction
                            icon={<TrendingUp size={18} />}
                            label="Ver Analitica"
                            description="Metricas detalladas y graficos"
                            href="/dashboard/analytics"
                            accent="#8b5cf6"
                        />
                    </div>
                </div>

                {/* ── Agent Status ──────────────────────────────── */}
                <div
                    style={{
                        background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.06) 100%)",
                        border: "1px solid rgba(99,102,241,0.15)",
                        borderRadius: "16px",
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
                                    background: "rgba(59,130,246,0.1)",
                                    border: "1px solid rgba(59,130,246,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#60a5fa",
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
                                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
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
                                            border: `1px solid ${data.agent.is_active ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
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
                                        border: "1px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: "0.82rem",
                                            color: "var(--text-secondary)",
                                            lineHeight: 1.6,
                                            marginBottom: "10px",
                                        }}
                                    >
                                        &ldquo;{data.agent.welcome_message?.slice(0, 100)}
                                        {(data.agent.welcome_message?.length || 0) > 100 ? "..." : ""}
                                        &rdquo;
                                    </p>
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
                            <div style={{ textAlign: "center", padding: "20px 0" }}>
                                <Bot size={32} style={{ color: "var(--text-muted)", margin: "0 auto 10px", opacity: 0.4 }} />
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                                    No tienes un asistente configurado
                                </p>
                                <button
                                    onClick={() => router.push("/dashboard/agents")}
                                    style={{
                                        background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
                                        color: "white",
                                        border: "none",
                                        padding: "10px 22px",
                                        borderRadius: "10px",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
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
                            { label: "Mensajes IA", value: data.aiMessages, color: "#8b5cf6" },
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
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "1.2rem",
                                        fontWeight: 800,
                                        color: stat.color,
                                        letterSpacing: "-0.02em",
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
                 BOTTOM ROW: Recent Leads + Pipeline Overview
                 ══════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* ── Recent Leads ─────────────────────────────── */}
                <div
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "16px",
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
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#a1a1aa",
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
                                color: "var(--accent-light)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            Ver todos <ExternalLink size={12} />
                        </button>
                    </div>

                    {data.recentLeads.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0" }}>
                            <Users size={28} style={{ color: "var(--text-muted)", margin: "0 auto 10px", opacity: 0.3 }} />
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                Aun no tienes leads. Llegaran cuando tus clientes escriban por WhatsApp.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {data.recentLeads.map((lead) => (
                                <div
                                    key={lead.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.04)",
                                        transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                    }}
                                >
                                    {/* Avatar */}
                                    <div
                                        style={{
                                            width: "36px",
                                            height: "36px",
                                            borderRadius: "10px",
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.08)",
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
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
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
                                            border: `1px solid ${lead.stage_color ? `${lead.stage_color}30` : "rgba(255,255,255,0.08)"}`,
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
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "16px",
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
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#a1a1aa",
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
                                color: "var(--accent-light)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            Ver pipeline <ExternalLink size={12} />
                        </button>
                    </div>

                    {data.leadsByStage.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0" }}>
                            <Zap size={28} style={{ color: "var(--text-muted)", margin: "0 auto 10px", opacity: 0.3 }} />
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                Configura tu pipeline para organizar tus leads
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {data.leadsByStage.map((stage) => {
                                const maxCount = Math.max(...data.leadsByStage.map((s) => s.count), 1);
                                const pct = Math.max((stage.count / maxCount) * 100, 4);
                                const stageColor = stage.color || "#3b82f6";

                                return (
                                    <div
                                        key={stage.stage_id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "14px",
                                            padding: "10px 14px",
                                            borderRadius: "10px",
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.04)",
                                        }}
                                    >
                                        {/* Color dot */}
                                        <div
                                            style={{
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "50%",
                                                background: stageColor,
                                                flexShrink: 0,
                                                boxShadow: `0 0 6px ${stageColor}40`,
                                            }}
                                        />

                                        {/* Stage name */}
                                        <span
                                            style={{
                                                fontSize: "0.82rem",
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                                minWidth: "100px",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {stage.stage_name}
                                        </span>

                                        {/* Bar */}
                                        <div
                                            style={{
                                                flex: 1,
                                                height: "8px",
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
                                                    background: stageColor,
                                                    transition: "width 0.6s ease",
                                                }}
                                            />
                                        </div>

                                        {/* Count */}
                                        <span
                                            style={{
                                                fontSize: "0.82rem",
                                                fontWeight: 700,
                                                color: stageColor,
                                                minWidth: "28px",
                                                textAlign: "right",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {stage.count}
                                        </span>
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
                                        border: "1px solid rgba(255,255,255,0.04)",
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
                                                border: `1px solid ${src.source === "whatsapp" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
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

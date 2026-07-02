"use client";
import { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/lib/org-context";
import {
    Loader2, Users, CalendarCheck, TrendingUp,
    MessageSquare, BarChart3, Zap, FileText, MessageCircle,
    Activity, Clock, ArrowDownRight, Gauge, Bot, Coins, Timer,
} from "lucide-react";
import { PipelineDonut, LeadsBarChart, LeadsTrendChart, PeakHoursChart, AiPerformanceChart } from "./charts";

/* ─── Types ──────────────────────────────────────────────────── */
interface StageEntry {
    stage_id: string;
    stage_name: string;
    color: string | null;
    count: number;
}

interface SourceEntry {
    source: string;
    count: number;
}

interface TrendEntry {
    date: string;
    leads: number;
    messages: number;
}

interface PeakHourEntry {
    hour: number;
    count: number;
}

interface FunnelEntry {
    stage_name: string;
    color: string | null;
    count: number;
    percentage: number;
    position: number;
}

/* ── Eje 1: rendimiento del agente IA ── */
interface AiDailyMetric {
    metric_date: string;
    messages_received: number;
    bot_replies: number;
    avg_latency_ms: number | null;
    active_conversations: number;
    handoffs: number;
    leads_created: number;
    appointments_booked: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
}

interface PerformanceStats {
    avgResponseSeconds: number | null;
    resolutionRate: number | null;
    totalConversations: number;
    botReplies: number;
    totalTokens: number;
    estimatedCostUsd: number;
    daily: AiDailyMetric[];
    hasEventData: boolean;
}

interface AnalyticsData {
    totalLeads: number;
    citasAgendadas: number;
    successfulLeads: number;
    lastStageName: string;
    discardedLeads: number;
    conversionRate: number;
    aiMessages: number;
    timeSavedMinutes: number;
    timeSavedHours: number;
    leadsByStage: StageEntry[];
    leadsBySource: SourceEntry[];
    leadsTrend: TrendEntry[];
    peakHours: PeakHourEntry[];
    funnel: FunnelEntry[];
}

const FUNNEL_COLORS = [
    "#7a9e8a", "#22c55e", "#f59e0b", "#5d8270",
    "#ef4444", "#06b6d4", "#ec4899", "#14b8a6",
];

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
    icon, label, value, sub, accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub: string;
    accent?: string;
}) {
    return (
        <div className="kpi-card" style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                    width: "34px", height: "34px", borderRadius: "10px",
                    background: accent ? `${accent}18` : "rgba(255,255,255,0.05)",
                    border: `0.5px solid ${accent ? `${accent}30` : "var(--border)"}`,
                    color: accent ?? "var(--text-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                    {icon}
                </div>
                <span style={{
                    fontSize: "0.68rem", fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{label}</span>
            </div>
            <div>
                <div className="kpi-value" style={{
                    color: accent ?? "var(--text-primary)",
                }}>{value}</div>
                <p style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: "6px" }}>{sub}</p>
            </div>
        </div>
    );
}

/* ─── Chart Card wrapper ─────────────────────────────────────── */
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
                <div style={{
                    width: "28px", height: "28px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "0.5px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-muted)",
                }}>
                    {icon}
                </div>
                <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
            </div>
            {children}
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function AnalyticsPage() {
    const { organization } = useOrg();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [perf, setPerf] = useState<PerformanceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAnalytics = useCallback(async () => {
        setError(null);
        try {
            // Métricas clásicas + rendimiento IA en paralelo
            const [res, perfRes] = await Promise.all([
                fetch(`/api/analytics?org_id=${organization.id}`),
                fetch(`/api/analytics/performance?org_id=${organization.id}&days=14`),
            ]);
            const json = await res.json();
            if (json.data) setData(json.data);
            const perfJson = await perfRes.json().catch(() => null);
            if (perfJson?.data) setPerf(perfJson.data);
        } catch (err) {
            console.error("Failed to load analytics:", err);
            setError("No se pudieron cargar las metricas. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div><h1 className="page-title">Analítica</h1><p className="page-subtitle">Dashboard de métricas clave</p></div>
                </div>
                <div className="empty-state"><BarChart3 /><p>No se pudieron cargar las métricas</p></div>
            </div>
        );
    }

    return (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {error && (
                <div style={{ background: "var(--danger-bg)", border: "0.5px solid rgba(199,90,90,0.15)", borderRadius: 8, padding: "12px 16px", margin: "0 0 8px 0", color: "var(--danger)", fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* ── Header ────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analítica</h1>
                    <p className="page-subtitle">Rendimiento del Agente IA</p>
                </div>
            </div>

            {/* ── KPI Grid ─────────────────────────────────────── */}
            <div className="stagger-children" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
            }}>
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
                    sub={`Etapa visita/cita del pipeline`}
                    accent="#22c55e"
                />
                <KpiCard
                    icon={<TrendingUp size={16} />}
                    label="Tasa de Conversión"
                    value={`${data.conversionRate}%`}
                    sub={`${data.citasAgendadas} de ${data.totalLeads} leads agendaron`}
                    accent="#7a9e8a"
                />
                <KpiCard
                    icon={<MessageSquare size={16} />}
                    label="Mensajes Gestionados"
                    value={data.aiMessages}
                    sub="Respuestas enviadas por la IA"
                    accent="#5d8270"
                />
            </div>

            {/* ══════════════════════════════════════════════════
                 EJE 1 — Rendimiento del Agente IA (últimos 14 días)
                 Fuente: analytics_events + daily_org_metrics + ai_usage_log
               ══════════════════════════════════════════════════ */}
            {perf && (
                <>
                    <div className="section-label">Rendimiento del agente IA · 14 días</div>
                    <div className="stagger-children" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "16px",
                    }}>
                        <KpiCard
                            icon={<Timer size={16} />}
                            label="Tiempo de Respuesta"
                            value={perf.avgResponseSeconds !== null ? `${perf.avgResponseSeconds}s` : "—"}
                            sub="Desde el mensaje del cliente hasta la respuesta (incluye agrupado de ráfagas)"
                            accent="#7a9e8a"
                        />
                        <KpiCard
                            icon={<Bot size={16} />}
                            label="Resolución sin Humano"
                            value={perf.resolutionRate !== null ? `${perf.resolutionRate}%` : "—"}
                            sub={`${perf.totalConversations} conversaciones atendidas en el período`}
                            accent="#22c55e"
                        />
                        <KpiCard
                            icon={<Coins size={16} />}
                            label="Tokens Consumidos"
                            value={perf.totalTokens >= 1000
                                ? `${(perf.totalTokens / 1000).toFixed(1)}k`
                                : perf.totalTokens}
                            sub={`≈ US$${perf.estimatedCostUsd.toFixed(2)} en OpenAI (estimado)`}
                            accent="#6482aa"
                        />
                        <KpiCard
                            icon={<Gauge size={16} />}
                            label="Turnos Respondidos"
                            value={perf.botReplies}
                            sub="Ráfagas de mensajes procesadas como un solo turno"
                            accent="#c4a35a"
                        />
                    </div>

                    <ChartCard title="Actividad del agente (conversaciones vs. tokens)" icon={<Activity size={14} />}>
                        <AiPerformanceChart data={perf.daily} />
                        {!perf.hasEventData && (
                            <p style={{
                                fontSize: "0.72rem", color: "var(--text-muted)",
                                marginTop: "10px", textAlign: "center",
                            }}>
                                ⚠️ La tabla de eventos aún no existe — ejecuta la migración{" "}
                                <code style={{ color: "var(--accent-light)" }}>20260702_eje1_analytics.sql</code>{" "}
                                para activar latencia y resolución.
                            </p>
                        )}
                    </ChartCard>
                </>
            )}

            {/* ── Charts Row ───────────────────────────────────── */}
            <div className="section-label">Distribución</div>
            <div className="glass-panel r-grid" style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* Donut — Pipeline distribution */}
                <ChartCard title="Distribución del Pipeline" icon={<Zap size={14} />}>
                    <PipelineDonut data={data.leadsByStage} />
                </ChartCard>

                {/* Bar — Leads por etapa */}
                <ChartCard title="Leads por Etapa" icon={<BarChart3 size={14} />}>
                    <LeadsBarChart data={data.leadsByStage} />
                </ChartCard>

            </div>

            {/* ── Trends Row: Leads Trend + Peak Hours ────────── */}
            <div className="section-label">Tendencias</div>
            <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px" }}>

                {/* Tendencia de Leads (30 dias) */}
                <ChartCard title="Tendencia (ultimos 30 dias)" icon={<Activity size={14} />}>
                    <LeadsTrendChart data={data.leadsTrend} />
                </ChartCard>

                {/* Horarios Pico */}
                <ChartCard title="Horarios Pico" icon={<Clock size={14} />}>
                    <PeakHoursChart data={data.peakHours} />
                </ChartCard>

            </div>

            {/* ── Funnel Visualization ────────────────────────────── */}
            <div className="section-label">Embudo</div>
            {data.funnel.length > 0 && (
                <ChartCard title="Embudo de Conversion" icon={<ArrowDownRight size={14} />}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {data.funnel.map((step, idx) => {
                            const maxWidth = 100;
                            const width = Math.max(step.percentage, 8);
                            const stageColor = step.color || FUNNEL_COLORS[idx % FUNNEL_COLORS.length];
                            return (
                                <div
                                    key={step.stage_name}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "14px",
                                        padding: "10px 14px",
                                    }}
                                >
                                    <span style={{
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                        minWidth: "120px",
                                        flexShrink: 0,
                                    }}>
                                        {step.stage_name}
                                    </span>
                                    <div style={{
                                        flex: 1,
                                        display: "flex",
                                        justifyContent: "center",
                                    }}>
                                        <div style={{
                                            width: `${width}%`,
                                            maxWidth: `${maxWidth}%`,
                                            height: "32px",
                                            borderRadius: "8px",
                                            background: `linear-gradient(90deg, ${stageColor}30, ${stageColor}60)`,
                                            border: `0.5px solid ${stageColor}40`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "width 0.6s ease",
                                        }}>
                                            <span style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                color: stageColor,
                                            }}>
                                                {step.count}
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 600,
                                        color: "var(--text-muted)",
                                        minWidth: "40px",
                                        textAlign: "right",
                                        flexShrink: 0,
                                    }}>
                                        {step.percentage}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </ChartCard>
            )}

            {/* ── Source Breakdown + Insight Row ───────────────── */}
            <div className="section-label">Fuentes e Insights</div>
            <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* Origen de leads */}
                <ChartCard title="Origen de Leads" icon={<FileText size={14} />}>
                    {data.leadsBySource.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "32px 0" }}>Sin datos</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {data.leadsBySource.map((src) => {
                                const isWhatsApp = src.source === "whatsapp";
                                const pct = data.totalLeads > 0 ? Math.round((src.count / data.totalLeads) * 100) : 0;
                                return (
                                    <div key={src.source} style={{
                                        display: "flex", alignItems: "center",
                                        gap: "12px",
                                        padding: "11px 14px", borderRadius: "10px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "0.5px solid rgba(255,255,255,0.05)",
                                    }}>
                                        <span style={{ color: "var(--text-muted)", display: "flex" }}>
                                            {isWhatsApp ? <MessageCircle size={14} /> : <FileText size={14} />}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                                                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{src.source}</span>
                                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{src.count} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pct}%)</span></span>
                                            </div>
                                            <div style={{ height: "4px", borderRadius: "100px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${pct}%`, borderRadius: "100px", background: isWhatsApp ? "#22c55e" : "#7a9e8a", transition: "width 0.6s ease" }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ChartCard>

                {/* AI Insight card */}
                <div style={{
                    background: "linear-gradient(135deg, rgba(122,158,138,0.08) 0%, rgba(93,130,112,0.08) 100%)",
                    border: "0.5px solid rgba(122,158,138,0.2)",
                    borderRadius: "16px",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "20px",
                }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                            <span style={{ fontSize: "1.2rem" }}>🤖</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Resumen del Agente</span>
                        </div>
                        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                            {data.aiMessages > 0
                                ? `Tu IA envió ${data.aiMessages.toLocaleString("es-CL")} mensajes y gestionó ${data.totalLeads} conversaciones, ahorrando aproximadamente ${data.timeSavedHours > 0 ? `${data.timeSavedHours} horas` : `${data.timeSavedMinutes} minutos`} de atención manual.`
                                : "Tu agente IA está activo y gestionando conversaciones automáticamente por WhatsApp."}
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {[
                            { label: "Descartados", value: data.discardedLeads, color: "#ef4444" },
                            { label: "Tiempo Ahorrado", value: data.timeSavedHours > 0 ? `${data.timeSavedHours}h` : `${data.timeSavedMinutes}m`, color: "#22c55e" },
                        ].map((stat) => (
                            <div key={stat.label} style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.04)",
                                border: "0.5px solid rgba(255,255,255,0.06)",
                            }}>
                                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: stat.color, letterSpacing: "-0.02em" }}>{stat.value}</div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}

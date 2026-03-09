"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText,
    RefreshCw,
    CheckCircle,
    Clock,
    XCircle,
    Loader2,
    Send,
    Eye,
    X,
    Search,
    Megaphone,
    Wrench,
    MessageCircle,
    User,
    Plus,
    ExternalLink,
    HelpCircle,
    Lightbulb,
    Copy,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Info,
    Sparkles,
    Globe,
    AlertCircle,
    CheckCheck,
} from "lucide-react";
import { useOrg } from "@/lib/org-context";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════
interface TemplateComponent {
    type: string;
    format?: string;
    text?: string;
    buttons?: { type: string; text: string; url?: string }[];
}

interface Template {
    id: string;
    name: string;
    status: string;
    category: string;
    language: string;
    components: TemplateComponent[];
}

interface Lead {
    id: string;
    name: string;
    phone: string;
}

// ═══════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════
export default function TemplatesPage() {
    const { organization } = useOrg();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Modal states
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [activeTab, setActiveTab] = useState<"preview" | "send">("preview");
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLead, setSelectedLead] = useState<string>("");
    const [sendParams, setSendParams] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

    // Guide toggle
    const [showGuide, setShowGuide] = useState(false);

    // ── Fetch templates ───────────────────────────────────────
    const fetchTemplates = useCallback(async (showSync = false) => {
        if (showSync) setSyncing(true);
        else setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/whatsapp/templates");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || "Error cargando templates");
                return;
            }
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch {
            setError("Error de conexión");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    // ── Fetch leads ─────────────────────────────────────────
    const fetchLeads = useCallback(async () => {
        try {
            const res = await fetch("/api/pipeline/leads");
            if (res.ok) {
                const data = await res.json();
                setLeads((data.data || []).map((l: Record<string, string>) => ({
                    id: l.id, name: l.name, phone: l.phone,
                })));
            }
        } catch { /* silent */ }
    }, []);

    // ── Open template detail ────────────────────────────────
    const openTemplate = (t: Template, tab: "preview" | "send" = "preview") => {
        setSelectedTemplate(t);
        setActiveTab(tab);
        setSelectedLead("");
        setSendParams([]);
        setSendResult(null);

        if (tab === "send") {
            fetchLeads();
            const body = t.components.find(c => c.type === "BODY");
            if (body?.text) {
                const matches = body.text.match(/\{\{\d+\}\}/g);
                if (matches) setSendParams(new Array(matches.length).fill(""));
            }
        }
    };

    // ── Switch to send tab ──────────────────────────────────
    const switchToSendTab = () => {
        setActiveTab("send");
        fetchLeads();
        if (selectedTemplate) {
            const body = selectedTemplate.components.find(c => c.type === "BODY");
            if (body?.text) {
                const matches = body.text.match(/\{\{\d+\}\}/g);
                if (matches && sendParams.length === 0) setSendParams(new Array(matches.length).fill(""));
            }
        }
    };

    // ── Send template ─────────────────────────────────────────
    const handleSend = async () => {
        if (!selectedTemplate || !selectedLead) return;
        setSending(true);
        setSendResult(null);

        try {
            const res = await fetch("/api/whatsapp/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lead_id: selectedLead,
                    template_name: selectedTemplate.name,
                    template_language: selectedTemplate.language,
                    parameters: sendParams.filter(p => p.trim()),
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setSendResult({ success: true });
                setTimeout(() => { setSelectedTemplate(null); setSendResult(null); }, 2000);
            } else {
                setSendResult({ success: false, error: data.error || "Error enviando" });
            }
        } catch {
            setSendResult({ success: false, error: "Error de conexión" });
        } finally {
            setSending(false);
        }
    };

    // ── Filter templates ──────────────────────────────────────
    const filtered = templates.filter(t => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // ── Counts ────────────────────────────────────────────────
    const counts = {
        total: templates.length,
        approved: templates.filter(t => t.status === "APPROVED").length,
        pending: templates.filter(t => t.status === "PENDING").length,
        rejected: templates.filter(t => t.status === "REJECTED").length,
    };

    // ── Helper: get body text ─────────────────────────────────
    const getBodyText = (t: Template) => {
        const body = t.components.find(c => c.type === "BODY");
        return body?.text || "";
    };

    // ── Helper: get header text ──────────────────────────────
    const getHeaderText = (t: Template) => {
        const header = t.components.find(c => c.type === "HEADER");
        return header?.text || "";
    };

    // ── Helper: count variables ──────────────────────────────
    const getVarCount = (t: Template) => {
        const body = getBodyText(t);
        const matches = body.match(/\{\{\d+\}\}/g);
        return matches?.length || 0;
    };

    // ── Helper: preview body with params filled ──────────────
    const getFilledBody = (t: Template) => {
        let text = getBodyText(t);
        sendParams.forEach((val, i) => {
            if (val.trim()) {
                text = text.replace(`{{${i + 1}}}`, val);
            }
        });
        return text;
    };

    // ═══════════════════════════════════════════════════════════
    //  Render
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="animate-in" style={{ maxWidth: "1100px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
                <div>
                    <h1 className="page-title" style={{ marginBottom: "4px" }}>Plantillas WhatsApp</h1>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
                        Gestiona y envía templates aprobados por Meta a tus leads
                    </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        className="btn-secondary flex items-center gap-2"
                        style={{ fontSize: "0.8rem" }}
                    >
                        <HelpCircle size={14} />
                        {showGuide ? "Ocultar guía" : "¿Cómo funciona?"}
                    </button>
                    <button
                        onClick={() => fetchTemplates(true)}
                        disabled={syncing}
                        className="btn-secondary flex items-center gap-2"
                        style={{ fontSize: "0.8rem" }}
                    >
                        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "Sincronizando..." : "Sincronizar"}
                    </button>
                </div>
            </div>

            {/* ═══ Guide Section ═══ */}
            <AnimatePresence>
                {showGuide && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: "hidden", marginBottom: "20px" }}
                    >
                        <div style={{
                            borderRadius: "14px",
                            border: "1px solid rgba(59,130,246,0.15)",
                            background: "rgba(59,130,246,0.03)",
                            padding: "24px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                                <div style={{
                                    width: "32px", height: "32px", borderRadius: "8px",
                                    background: "rgba(59,130,246,0.1)", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                }}>
                                    <Lightbulb size={16} style={{ color: "#60a5fa" }} />
                                </div>
                                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                                    Guía rápida de Templates
                                </h3>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                                {/* Step 1 */}
                                <div style={{
                                    padding: "16px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                        <span style={{
                                            width: "22px", height: "22px", borderRadius: "50%",
                                            background: "var(--gradient-1)", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            fontSize: "0.7rem", fontWeight: 700, color: "white",
                                        }}>1</span>
                                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                            ¿Qué es un template?
                                        </span>
                                    </div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                        Los templates son mensajes pre-aprobados por Meta que puedes enviar a clientes en cualquier momento, incluso fuera de la ventana de 24 horas de WhatsApp.
                                    </p>
                                </div>

                                {/* Step 2 */}
                                <div style={{
                                    padding: "16px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                        <span style={{
                                            width: "22px", height: "22px", borderRadius: "50%",
                                            background: "var(--gradient-1)", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            fontSize: "0.7rem", fontWeight: 700, color: "white",
                                        }}>2</span>
                                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                            Crear un template nuevo
                                        </span>
                                    </div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                        Los templates se crean desde el <strong style={{ color: "var(--text-primary)" }}>Meta Business Suite</strong>. Haz clic en &quot;Crear en Meta&quot; para ir directo al editor. Una vez aprobado, sincroniza aquí.
                                    </p>
                                </div>

                                {/* Step 3 */}
                                <div style={{
                                    padding: "16px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                        <span style={{
                                            width: "22px", height: "22px", borderRadius: "50%",
                                            background: "var(--gradient-1)", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            fontSize: "0.7rem", fontWeight: 700, color: "white",
                                        }}>3</span>
                                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                            Enviar a un lead
                                        </span>
                                    </div>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                        Haz clic en cualquier template aprobado, personaliza las variables (ej: nombre del cliente), selecciona el lead y envía. El mensaje llega al WhatsApp del cliente al instante.
                                    </p>
                                </div>
                            </div>

                            {/* CTA - Create in Meta */}
                            <div style={{ marginTop: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
                                <a
                                    href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary flex items-center gap-2"
                                    style={{ fontSize: "0.8rem", textDecoration: "none" }}
                                >
                                    <Plus size={14} /> Crear template en Meta
                                    <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                </a>
                                <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                    Se abre el editor de Meta Business Suite en nueva pestaña
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
                {[
                    { label: "Total", value: counts.total, color: "#60a5fa", icon: <FileText size={14} /> },
                    { label: "Aprobados", value: counts.approved, color: "#22c55e", icon: <CheckCircle size={14} /> },
                    { label: "Pendientes", value: counts.pending, color: "#f59e0b", icon: <Clock size={14} /> },
                    { label: "Rechazados", value: counts.rejected, color: "#ef4444", icon: <XCircle size={14} /> },
                ].map(kpi => (
                    <div key={kpi.label} style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: `${kpi.color}12`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: kpi.color, flexShrink: 0,
                        }}>
                            {kpi.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500, marginTop: "2px" }}>{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search + Filter + Create CTA */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "300px" }}>
                    <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input
                        className="input"
                        placeholder="Buscar template..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: "34px", fontSize: "0.82rem" }}
                    />
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                    {(["all", "APPROVED", "PENDING", "REJECTED"] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className="filter-pill"
                            style={{
                                ...(statusFilter === s ? {
                                    background: "rgba(59,130,246,0.1)",
                                    borderColor: "rgba(59,130,246,0.25)",
                                    color: "#60a5fa",
                                } : {}),
                            }}
                        >
                            {s === "all" ? "Todos" : s === "APPROVED" ? "✓ Aprobados" : s === "PENDING" ? "⏳ Pendientes" : "✕ Rechazados"}
                        </button>
                    ))}
                </div>
                <div style={{ marginLeft: "auto" }}>
                    <a
                        href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary flex items-center gap-2"
                        style={{ fontSize: "0.78rem", textDecoration: "none", padding: "8px 14px" }}
                    >
                        <Plus size={13} /> Crear en Meta
                    </a>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: "12px 16px", borderRadius: "12px",
                    background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)",
                    color: "#f87171", fontSize: "0.82rem", marginBottom: "16px",
                    display: "flex", alignItems: "center", gap: "8px",
                }}>
                    <AlertCircle size={15} />
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center" style={{ minHeight: "200px" }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            )}

            {/* ═══ Templates List ═══ */}
            {!loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <AnimatePresence>
                        {filtered.map((t, i) => {
                            const bodyText = getBodyText(t);
                            const varCount = getVarCount(t);
                            const isApproved = t.status === "APPROVED";

                            return (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ delay: i * 0.03, duration: 0.25 }}
                                    onClick={() => openTemplate(t)}
                                    style={{
                                        padding: "16px 20px",
                                        borderRadius: "12px",
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "16px",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = "var(--bg-card)";
                                        e.currentTarget.style.borderColor = "var(--border)";
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: "40px", height: "40px", borderRadius: "10px",
                                        background: isApproved ? "rgba(34,197,94,0.08)" : t.status === "PENDING" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <MessageCircle size={18} style={{
                                            color: isApproved ? "#22c55e" : t.status === "PENDING" ? "#f59e0b" : "#ef4444",
                                        }} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                                {t.name.replace(/_/g, " ")}
                                            </span>
                                            <StatusBadge status={t.status} />
                                            <CategoryBadge category={t.category} />
                                        </div>
                                        <p style={{
                                            fontSize: "0.76rem", color: "var(--text-secondary)",
                                            margin: 0, lineHeight: 1.5,
                                            overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap", maxWidth: "100%",
                                        }}>
                                            {bodyText || "Sin contenido"}
                                        </p>
                                    </div>

                                    {/* Meta info */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                        {varCount > 0 && (
                                            <span style={{
                                                fontSize: "0.68rem", color: "var(--text-muted)",
                                                display: "flex", alignItems: "center", gap: "4px",
                                                padding: "3px 8px", borderRadius: "6px",
                                                background: "rgba(255,255,255,0.03)",
                                            }}>
                                                <Sparkles size={10} /> {varCount} variable{varCount > 1 ? "s" : ""}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: "0.68rem", color: "var(--text-muted)",
                                            display: "flex", alignItems: "center", gap: "4px",
                                        }}>
                                            <Globe size={10} /> {t.language}
                                        </span>
                                        {isApproved && (
                                            <button
                                                onClick={e => { e.stopPropagation(); openTemplate(t, "send"); }}
                                                style={{
                                                    padding: "6px 14px",
                                                    borderRadius: "8px",
                                                    background: "rgba(37,211,102,0.1)",
                                                    border: "1px solid rgba(37,211,102,0.2)",
                                                    color: "#25d366",
                                                    fontSize: "0.76rem",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    transition: "all 0.2s ease",
                                                    whiteSpace: "nowrap",
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = "rgba(37,211,102,0.18)";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = "rgba(37,211,102,0.1)";
                                                }}
                                                title="Enviar este template por WhatsApp a uno de tus leads"
                                            >
                                                <Send size={12} /> Enviar a Lead
                                            </button>
                                        )}
                                        <ArrowRight size={14} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && !error && (
                <div style={{
                    textAlign: "center", padding: "60px 20px",
                    borderRadius: "14px", background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{
                        width: "56px", height: "56px", borderRadius: "14px",
                        background: "rgba(59,130,246,0.06)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        margin: "0 auto 16px",
                    }}>
                        <FileText size={24} style={{ color: "#60a5fa" }} />
                    </div>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.92rem", fontWeight: 600, marginBottom: "4px" }}>
                        {templates.length === 0 ? "No hay templates todavía" : "Sin resultados"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "16px" }}>
                        {templates.length === 0
                            ? "Sincroniza con Meta para cargar tus templates, o crea uno nuevo desde Meta Business Suite."
                            : "Intenta ajustar los filtros o el término de búsqueda."}
                    </p>
                    {templates.length === 0 && (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                                onClick={() => fetchTemplates(true)}
                                className="btn-secondary flex items-center gap-2"
                                style={{ fontSize: "0.8rem" }}
                            >
                                <RefreshCw size={14} /> Sincronizar con Meta
                            </button>
                            <a
                                href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary flex items-center gap-2"
                                style={{ fontSize: "0.8rem", textDecoration: "none" }}
                            >
                                <Plus size={14} /> Crear en Meta
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Template Detail Modal ═══ */}
            <AnimatePresence>
                {selectedTemplate && (
                    <ModalOverlay onClose={() => setSelectedTemplate(null)}>
                        <div style={{ maxWidth: "560px", width: "100%" }}>
                            {/* Modal Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                                <div>
                                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
                                        {selectedTemplate.name.replace(/_/g, " ")}
                                    </h3>
                                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                        <StatusBadge status={selectedTemplate.status} />
                                        <CategoryBadge category={selectedTemplate.category} />
                                        <span style={{
                                            padding: "2px 8px", borderRadius: "100px",
                                            fontSize: "0.62rem", fontWeight: 600,
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            color: "var(--text-muted)",
                                        }}>
                                            {selectedTemplate.language}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedTemplate(null)} style={{
                                    color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none",
                                    padding: "4px", borderRadius: "6px",
                                }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div style={{
                                display: "flex", gap: "4px", marginBottom: "20px",
                                background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                                padding: "3px",
                            }}>
                                <button
                                    onClick={() => setActiveTab("preview")}
                                    style={{
                                        flex: 1, padding: "8px 16px", borderRadius: "8px",
                                        fontSize: "0.8rem", fontWeight: 600, border: "none", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        background: activeTab === "preview" ? "rgba(59,130,246,0.1)" : "transparent",
                                        color: activeTab === "preview" ? "#60a5fa" : "var(--text-secondary)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <Eye size={14} /> Vista Previa
                                </button>
                                {selectedTemplate.status === "APPROVED" && (
                                    <button
                                        onClick={switchToSendTab}
                                        style={{
                                            flex: 1, padding: "8px 16px", borderRadius: "8px",
                                            fontSize: "0.8rem", fontWeight: 600, border: "none", cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                            background: activeTab === "send" ? "rgba(37,211,102,0.1)" : "transparent",
                                            color: activeTab === "send" ? "#25d366" : "var(--text-secondary)",
                                            transition: "all 0.2s ease",
                                        }}
                                    >
                                        <Send size={14} /> Enviar a Lead
                                    </button>
                                )}
                            </div>

                            {/* ── Preview Tab ── */}
                            {activeTab === "preview" && (
                                <div>
                                    {/* WhatsApp-style preview */}
                                    <div style={{
                                        padding: "20px",
                                        borderRadius: "14px",
                                        background: "rgba(37,211,102,0.03)",
                                        border: "1px solid rgba(37,211,102,0.1)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                            <MessageCircle size={15} style={{ color: "#25d366" }} />
                                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#25d366" }}>
                                                Así se verá en WhatsApp
                                            </span>
                                        </div>

                                        <div style={{
                                            padding: "14px 16px",
                                            borderRadius: "2px 14px 14px 14px",
                                            background: "rgba(255,255,255,0.06)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                        }}>
                                            {selectedTemplate.components.map((c, i) => (
                                                <div key={i}>
                                                    {c.type === "HEADER" && c.text && (
                                                        <p style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px", margin: "0 0 6px" }}>
                                                            {c.text}
                                                        </p>
                                                    )}
                                                    {c.type === "BODY" && (
                                                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 6px" }}>
                                                            {c.text}
                                                        </p>
                                                    )}
                                                    {c.type === "FOOTER" && (
                                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "8px", margin: "8px 0 0" }}>
                                                            {c.text}
                                                        </p>
                                                    )}
                                                    {c.type === "BUTTONS" && c.buttons && (
                                                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                                            {c.buttons.map((btn, bi) => (
                                                                <div key={bi} style={{
                                                                    textAlign: "center",
                                                                    padding: "8px",
                                                                    borderRadius: "8px",
                                                                    background: "rgba(59,130,246,0.06)",
                                                                    border: "1px solid rgba(59,130,246,0.1)",
                                                                    color: "#60a5fa",
                                                                    fontSize: "0.78rem",
                                                                    fontWeight: 600,
                                                                }}>
                                                                    {btn.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Variables info */}
                                    {getVarCount(selectedTemplate) > 0 && (
                                        <div style={{
                                            marginTop: "14px", padding: "12px 14px",
                                            borderRadius: "10px",
                                            background: "rgba(245,158,11,0.04)",
                                            border: "1px solid rgba(245,158,11,0.1)",
                                            display: "flex", alignItems: "flex-start", gap: "8px",
                                        }}>
                                            <Info size={14} style={{ color: "#f59e0b", marginTop: "1px", flexShrink: 0 }} />
                                            <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                                Este template tiene <strong style={{ color: "#f59e0b" }}>{getVarCount(selectedTemplate)} variable(s)</strong> personalizables.
                                                Cuando envíes, podrás completar {`{{1}}`}, {`{{2}}`}, etc. con datos del cliente (nombre, dirección, etc.)
                                            </p>
                                        </div>
                                    )}

                                    {/* Send CTA for approved */}
                                    {selectedTemplate.status === "APPROVED" && (
                                        <button
                                            onClick={switchToSendTab}
                                            className="btn-primary w-full flex items-center justify-center gap-2"
                                            style={{ marginTop: "16px", fontSize: "0.84rem" }}
                                        >
                                            <Send size={14} /> Enviar este template a un lead
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ── Send Tab ── */}
                            {activeTab === "send" && (
                                <div>
                                    {/* Explanation */}
                                    <div style={{
                                        padding: "12px 14px", borderRadius: "10px",
                                        background: "rgba(37,211,102,0.04)",
                                        border: "1px solid rgba(37,211,102,0.1)",
                                        marginBottom: "16px",
                                        display: "flex", alignItems: "flex-start", gap: "8px",
                                    }}>
                                        <Sparkles size={14} style={{ color: "#25d366", marginTop: "1px", flexShrink: 0 }} />
                                        <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                            Selecciona un lead de tu pipeline y personaliza las variables. El mensaje se enviará por WhatsApp al instante.
                                        </p>
                                    </div>

                                    {/* Select lead */}
                                    <div style={{ marginBottom: "14px" }}>
                                        <label style={{
                                            display: "block", fontSize: "0.76rem", fontWeight: 600,
                                            color: "var(--text-secondary)", marginBottom: "6px",
                                        }}>
                                            ¿A quién enviar?
                                        </label>
                                        <select
                                            className="select"
                                            value={selectedLead}
                                            onChange={e => setSelectedLead(e.target.value)}
                                            style={{ fontSize: "0.84rem" }}
                                        >
                                            <option value="">Selecciona un lead...</option>
                                            {leads.map(l => (
                                                <option key={l.id} value={l.id}>
                                                    {l.name} — {l.phone}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Parameters */}
                                    {sendParams.length > 0 && (
                                        <div style={{ marginBottom: "14px" }}>
                                            <label style={{
                                                display: "block", fontSize: "0.76rem", fontWeight: 600,
                                                color: "var(--text-secondary)", marginBottom: "6px",
                                            }}>
                                                Personaliza las variables
                                            </label>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                {sendParams.map((p, i) => (
                                                    <div key={i} style={{ position: "relative" }}>
                                                        <span style={{
                                                            position: "absolute", left: "12px", top: "50%",
                                                            transform: "translateY(-50%)",
                                                            fontSize: "0.72rem", fontWeight: 700,
                                                            color: "var(--text-muted)",
                                                        }}>
                                                            {`{{${i + 1}}}`}
                                                        </span>
                                                        <input
                                                            className="input"
                                                            placeholder={`Ej: ${i === 0 ? "nombre del cliente" : i === 1 ? "nombre del producto" : "valor"}`}
                                                            value={p}
                                                            onChange={e => {
                                                                const next = [...sendParams];
                                                                next[i] = e.target.value;
                                                                setSendParams(next);
                                                            }}
                                                            style={{ paddingLeft: "52px", fontSize: "0.82rem" }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Live preview */}
                                    <div style={{
                                        padding: "14px 16px",
                                        borderRadius: "10px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        marginBottom: "16px",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                                            <Eye size={12} style={{ color: "var(--text-muted)" }} />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                Vista previa del mensaje
                                            </span>
                                        </div>
                                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                            {getFilledBody(selectedTemplate)}
                                        </p>
                                    </div>

                                    {/* Send result */}
                                    {sendResult && (
                                        <div style={{
                                            padding: "10px 14px",
                                            borderRadius: "10px",
                                            marginBottom: "12px",
                                            fontSize: "0.82rem",
                                            display: "flex", alignItems: "center", gap: "8px",
                                            background: sendResult.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                                            border: `1px solid ${sendResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                                            color: sendResult.success ? "#22c55e" : "#f87171",
                                        }}>
                                            {sendResult.success ? <CheckCheck size={15} /> : <AlertCircle size={15} />}
                                            {sendResult.success ? "¡Template enviado exitosamente!" : sendResult.error}
                                        </div>
                                    )}

                                    {/* Send button */}
                                    <button
                                        onClick={handleSend}
                                        disabled={!selectedLead || sending}
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                        style={{
                                            fontSize: "0.84rem",
                                            opacity: !selectedLead || sending ? 0.4 : 1,
                                            cursor: !selectedLead || sending ? "not-allowed" : "pointer",
                                            background: !selectedLead || sending ? undefined : "linear-gradient(135deg, #22c55e, #16a34a)",
                                        }}
                                    >
                                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        {sending ? "Enviando por WhatsApp..." : "Enviar Template por WhatsApp"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </ModalOverlay>
                )}
            </AnimatePresence>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
        APPROVED: { icon: <CheckCircle size={10} />, label: "Aprobado", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.18)" },
        PENDING: { icon: <Clock size={10} />, label: "Pendiente", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.18)" },
        REJECTED: { icon: <XCircle size={10} />, label: "Rechazado", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.18)" },
    };
    const c = config[status] || config.PENDING;

    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "2px 8px", borderRadius: "100px",
            fontSize: "0.62rem", fontWeight: 700,
            background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            letterSpacing: "0.02em",
        }}>
            {c.icon} {c.label}
        </span>
    );
}

function CategoryBadge({ category }: { category: string }) {
    const isMarketing = category === "MARKETING";
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "2px 8px", borderRadius: "100px",
            fontSize: "0.62rem", fontWeight: 600,
            background: isMarketing ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isMarketing ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.06)"}`,
            color: isMarketing ? "#60a5fa" : "var(--text-muted)",
        }}>
            {isMarketing ? <Megaphone size={10} /> : <Wrench size={10} />}
            {isMarketing ? "Marketing" : "Utilidad"}
        </span>
    );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-overlay"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
                className="modal-content"
                style={{ maxHeight: "85vh", overflowY: "auto" }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

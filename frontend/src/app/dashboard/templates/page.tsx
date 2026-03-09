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
    ChevronRight,
    User,
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
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [sendTemplate, setSendTemplate] = useState<Template | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLead, setSelectedLead] = useState<string>("");
    const [sendParams, setSendParams] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

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
            setError("Error de conexion");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    // ── Fetch leads for send modal ────────────────────────────
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

    // ── Send template ─────────────────────────────────────────
    const handleSend = async () => {
        if (!sendTemplate || !selectedLead) return;
        setSending(true);
        setSendResult(null);

        try {
            const res = await fetch("/api/whatsapp/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lead_id: selectedLead,
                    template_name: sendTemplate.name,
                    template_language: sendTemplate.language,
                    parameters: sendParams.filter(p => p.trim()),
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setSendResult({ success: true });
                setTimeout(() => { setSendTemplate(null); setSendResult(null); }, 2000);
            } else {
                setSendResult({ success: false, error: data.error || "Error enviando" });
            }
        } catch {
            setSendResult({ success: false, error: "Error de conexion" });
        } finally {
            setSending(false);
        }
    };

    // ── Open send modal ───────────────────────────────────────
    const openSendModal = (t: Template) => {
        setSendTemplate(t);
        setSelectedLead("");
        setSendParams([]);
        setSendResult(null);
        fetchLeads();

        // Count variables in body
        const body = t.components.find(c => c.type === "BODY");
        if (body?.text) {
            const matches = body.text.match(/\{\{\d+\}\}/g);
            if (matches) setSendParams(new Array(matches.length).fill(""));
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

    // ═══════════════════════════════════════════════════════════
    //  Render
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h1 className="page-title">Plantillas WhatsApp</h1>
                    <p className="page-subtitle">Templates de mensajes aprobados por Meta para enviar fuera de la ventana de 24h</p>
                </div>
                <button
                    onClick={() => fetchTemplates(true)}
                    disabled={syncing}
                    className="btn-secondary flex items-center gap-2"
                    style={{ fontSize: "0.82rem" }}
                >
                    <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Sincronizando..." : "Sincronizar con Meta"}
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                {[
                    { label: "Total", value: counts.total, color: "var(--accent)", bg: "rgba(59,130,246,0.06)" },
                    { label: "Aprobados", value: counts.approved, color: "#22c55e", bg: "rgba(34,197,94,0.06)" },
                    { label: "Pendientes", value: counts.pending, color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
                    { label: "Rechazados", value: counts.rejected, color: "#ef4444", bg: "rgba(239,68,68,0.06)" },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card" style={{ background: kpi.bg, borderColor: `${kpi.color}15` }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Search + Filter */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
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
                            {s === "all" ? "Todos" : s === "APPROVED" ? "Aprobados" : s === "PENDING" ? "Pendientes" : "Rechazados"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", color: "#f87171", fontSize: "0.83rem", marginBottom: "16px" }}>
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center" style={{ minHeight: "200px" }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            )}

            {/* Templates Grid */}
            {!loading && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px" }}>
                    <AnimatePresence>
                        {filtered.map((t, i) => (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.04, duration: 0.3 }}
                                className="glass-card"
                                style={{ padding: "20px" }}
                            >
                                {/* Header row */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                                {t.name.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            <StatusBadge status={t.status} />
                                            <CategoryBadge category={t.category} />
                                            <span style={{
                                                padding: "2px 8px", borderRadius: "100px",
                                                fontSize: "0.62rem", fontWeight: 600,
                                                background: "rgba(255,255,255,0.04)",
                                                border: "1px solid rgba(255,255,255,0.06)",
                                                color: "var(--text-muted)",
                                            }}>
                                                {t.language}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body preview */}
                                <div style={{
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.04)",
                                    marginBottom: "14px",
                                    maxHeight: "100px",
                                    overflow: "hidden",
                                }}>
                                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                        {getBodyText(t) || "Sin contenido de body"}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={() => setPreviewTemplate(t)}
                                        className="btn-secondary flex items-center gap-1.5"
                                        style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "8px" }}
                                    >
                                        <Eye size={13} /> Preview
                                    </button>
                                    {t.status === "APPROVED" && (
                                        <button
                                            onClick={() => openSendModal(t)}
                                            className="btn-primary flex items-center gap-1.5"
                                            style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "8px" }}
                                        >
                                            <Send size={13} /> Enviar
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && !error && (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <FileText size={40} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        {templates.length === 0 ? "No hay templates. Sincroniza con Meta para cargarlos." : "No hay templates que coincidan con tu busqueda."}
                    </p>
                </div>
            )}

            {/* ═══ Preview Modal ═══ */}
            <AnimatePresence>
                {previewTemplate && (
                    <ModalOverlay onClose={() => setPreviewTemplate(null)}>
                        <div style={{ maxWidth: "440px", width: "100%" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    Preview: {previewTemplate.name.replace(/_/g, " ")}
                                </h3>
                                <button onClick={() => setPreviewTemplate(null)} style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                                <StatusBadge status={previewTemplate.status} />
                                <CategoryBadge category={previewTemplate.category} />
                            </div>

                            {/* WhatsApp-style preview */}
                            <div style={{
                                padding: "20px",
                                borderRadius: "14px",
                                background: "rgba(37,211,102,0.03)",
                                border: "1px solid rgba(37,211,102,0.1)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                    <MessageCircle size={16} style={{ color: "#25d366" }} />
                                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#25d366" }}>Vista previa WhatsApp</span>
                                </div>

                                <div style={{
                                    padding: "12px 14px",
                                    borderRadius: "2px 12px 12px 12px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}>
                                    {previewTemplate.components.map((c, i) => (
                                        <div key={i}>
                                            {c.type === "HEADER" && c.text && (
                                                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                                                    {c.text}
                                                </p>
                                            )}
                                            {c.type === "BODY" && (
                                                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 6px" }}>
                                                    {c.text}
                                                </p>
                                            )}
                                            {c.type === "FOOTER" && (
                                                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "8px" }}>
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
                        </div>
                    </ModalOverlay>
                )}
            </AnimatePresence>

            {/* ═══ Send Modal ═══ */}
            <AnimatePresence>
                {sendTemplate && (
                    <ModalOverlay onClose={() => setSendTemplate(null)}>
                        <div style={{ maxWidth: "480px", width: "100%" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    Enviar: {sendTemplate.name.replace(/_/g, " ")}
                                </h3>
                                <button onClick={() => setSendTemplate(null)} style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Select lead */}
                            <div style={{ marginBottom: "16px" }}>
                                <label className="form-label">Seleccionar Lead</label>
                                <select
                                    className="select"
                                    value={selectedLead}
                                    onChange={e => setSelectedLead(e.target.value)}
                                >
                                    <option value="">— Selecciona un lead —</option>
                                    {leads.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.name} ({l.phone})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Parameters */}
                            {sendParams.length > 0 && (
                                <div style={{ marginBottom: "16px" }}>
                                    <label className="form-label">Variables del template</label>
                                    <div className="grid gap-2">
                                        {sendParams.map((p, i) => (
                                            <input
                                                key={i}
                                                className="input"
                                                placeholder={`Variable {{${i + 1}}}`}
                                                value={p}
                                                onChange={e => {
                                                    const next = [...sendParams];
                                                    next[i] = e.target.value;
                                                    setSendParams(next);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Body preview */}
                            <div style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.04)",
                                marginBottom: "16px",
                            }}>
                                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                    {getBodyText(sendTemplate)}
                                </p>
                            </div>

                            {/* Send result */}
                            {sendResult && (
                                <div style={{
                                    padding: "10px 14px",
                                    borderRadius: "10px",
                                    marginBottom: "12px",
                                    fontSize: "0.82rem",
                                    background: sendResult.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                                    border: `1px solid ${sendResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                                    color: sendResult.success ? "#22c55e" : "#f87171",
                                }}>
                                    {sendResult.success ? "Template enviado exitosamente" : sendResult.error}
                                </div>
                            )}

                            {/* Send button */}
                            <button
                                onClick={handleSend}
                                disabled={!selectedLead || sending}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                                style={{
                                    opacity: !selectedLead || sending ? 0.4 : 1,
                                    cursor: !selectedLead || sending ? "not-allowed" : "pointer",
                                }}
                            >
                                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                {sending ? "Enviando..." : "Enviar Template"}
                            </button>
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
    const config: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
        APPROVED: { icon: <CheckCircle size={10} />, color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.18)" },
        PENDING: { icon: <Clock size={10} />, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.18)" },
        REJECTED: { icon: <XCircle size={10} />, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.18)" },
    };
    const c = config[status] || config.PENDING;

    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "2px 8px", borderRadius: "100px",
            fontSize: "0.62rem", fontWeight: 700,
            background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
            {c.icon} {status}
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
            textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
            {isMarketing ? <Megaphone size={10} /> : <Wrench size={10} />} {category}
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

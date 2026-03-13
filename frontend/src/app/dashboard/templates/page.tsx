"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText, RefreshCw, CheckCircle, Clock, XCircle, Loader2,
    Send, Eye, X, Search, Megaphone, Wrench, MessageCircle,
    Plus, HelpCircle, Lightbulb, ArrowRight, Info, Sparkles,
    Globe, AlertCircle, CheckCheck, Trash2, ArrowLeft, Type,
    AlignLeft, Hash, MousePointerClick, ExternalLink,
} from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { TEMPLATE_PRESET_GROUPS, type TemplatePreset } from "@/lib/whatsapp-template-presets";

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

interface ButtonDraft {
    type: "QUICK_REPLY" | "URL";
    text: string;
    url: string;
}

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
const LANGUAGES = [
    { code: "es", label: "Español" },
    { code: "es_MX", label: "Español (México)" },
    { code: "es_AR", label: "Español (Argentina)" },
    { code: "en_US", label: "English (US)" },
    { code: "en", label: "English" },
    { code: "pt_BR", label: "Português (BR)" },
];

const CATEGORY_INFO = {
    MARKETING: {
        label: "Marketing",
        desc: "Promociones, ofertas, novedades. Ideal para atraer clientes.",
        icon: <Megaphone size={16} />,
        color: "#9ab8a8",
    },
    UTILITY: {
        label: "Utilidad",
        desc: "Confirmaciones, actualizaciones, notificaciones. Info útil para el cliente.",
        icon: <Wrench size={16} />,
        color: "#a78bfa",
    },
};

// ═══════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════
export default function TemplatesPage() {
    const { organization } = useOrg();

    // ── List state ──
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // ── Detail modal state ──
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [activeTab, setActiveTab] = useState<"preview" | "send">("preview");
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLead, setSelectedLead] = useState("");
    const [sendParams, setSendParams] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

    // ── Editor state ──
    const [showEditor, setShowEditor] = useState(false);
    const [editorStep, setEditorStep] = useState(1); // 1=basics, 2=content, 3=preview+submit
    const [edName, setEdName] = useState("");
    const [edCategory, setEdCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
    const [edLanguage, setEdLanguage] = useState("es");
    const [edHeader, setEdHeader] = useState("");
    const [edBody, setEdBody] = useState("");
    const [edFooter, setEdFooter] = useState("");
    const [edButtons, setEdButtons] = useState<ButtonDraft[]>([]);
    const [edSubmitting, setEdSubmitting] = useState(false);
    const [edResult, setEdResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

    // ── Delete state ──
    const [deleting, setDeleting] = useState<string | null>(null);

    // Guide
    const [showGuide, setShowGuide] = useState(false);

    // Presets
    const [showPresets, setShowPresets] = useState(true);
    const [presetIndustry, setPresetIndustry] = useState<string>(() => {
        // Auto-detect from org settings if available
        return "real_estate";
    });

    // Auto-detect industry from org settings
    useEffect(() => {
        if (organization?.settings?.industry_template) {
            const orgIndustry = organization.settings.industry_template as string;
            const match = TEMPLATE_PRESET_GROUPS.find(g => g.id === orgIndustry);
            if (match) setPresetIndustry(match.id);
        }
    }, [organization]);

    // Load preset into editor
    const loadPreset = (preset: TemplatePreset) => {
        setEdName(preset.name);
        setEdCategory(preset.category);
        setEdLanguage(preset.language);
        setEdHeader(preset.headerText || "");
        setEdBody(preset.body);
        setEdFooter(preset.footer || "");
        setEdButtons(
            (preset.buttons || []).map(b => ({
                type: b.type as "QUICK_REPLY" | "URL",
                text: b.text,
                url: b.url || "",
            }))
        );
        setEditorStep(2); // Skip to content step since basics are pre-filled
        setEdResult(null);
        setShowEditor(true);
    };

    // ── Fetch templates ──
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

    // ── Fetch leads ──
    const fetchLeads = useCallback(async () => {
        try {
            const res = await fetch("/api/pipeline/leads");
            if (res.ok) {
                const data = await res.json();
                setLeads((data.data || []).map((l: Record<string, string>) => ({
                    id: l.id, name: l.name, phone: l.phone,
                })));
            }
        } catch (err) {
            console.error("Failed to load leads:", err);
            setError("No se pudieron cargar los leads para envio.");
        }
    }, []);

    // ── Open detail ──
    const openTemplate = (t: Template, tab: "preview" | "send" = "preview") => {
        setSelectedTemplate(t);
        setActiveTab(tab);
        setSelectedLead("");
        setSendParams([]);
        setSendResult(null);
        if (tab === "send") {
            fetchLeads();
            initSendParams(t);
        }
    };

    const initSendParams = (t: Template) => {
        const body = t.components.find(c => c.type === "BODY");
        if (body?.text) {
            const matches = body.text.match(/\{\{\d+\}\}/g);
            if (matches) setSendParams(new Array(matches.length).fill(""));
        }
    };

    const switchToSendTab = () => {
        setActiveTab("send");
        fetchLeads();
        if (selectedTemplate && sendParams.length === 0) initSendParams(selectedTemplate);
    };

    // ── Send template ──
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
                    parameters: sendParams,
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

    // ── Delete template ──
    const handleDelete = async (name: string) => {
        setDeleting(name);
        try {
            const res = await fetch(`/api/whatsapp/templates/manage?name=${encodeURIComponent(name)}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setTemplates(prev => prev.filter(t => t.name !== name));
                setSelectedTemplate(null);
            } else {
                alert(data.error || "Error eliminando template");
            }
        } catch {
            alert("Error de conexión");
        } finally {
            setDeleting(null);
        }
    };

    // ── Editor: submit to Meta ──
    const handleEditorSubmit = async () => {
        if (!edName.trim() || !edBody.trim()) return;
        setEdSubmitting(true);
        setEdResult(null);
        try {
            const res = await fetch("/api/whatsapp/templates/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: edName,
                    category: edCategory,
                    language: edLanguage,
                    header_text: edHeader || undefined,
                    body_text: edBody,
                    footer_text: edFooter || undefined,
                    buttons: edButtons.length > 0 ? edButtons : undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setEdResult({ success: true, message: data.message });
                // Refresh templates list after a moment
                setTimeout(() => {
                    fetchTemplates(true);
                }, 2000);
            } else {
                setEdResult({ success: false, error: data.error || "Error creando template" });
            }
        } catch {
            setEdResult({ success: false, error: "Error de conexión" });
        } finally {
            setEdSubmitting(false);
        }
    };

    // ── Editor: reset ──
    const resetEditor = () => {
        setShowEditor(false);
        setEditorStep(1);
        setEdName("");
        setEdCategory("MARKETING");
        setEdLanguage("es");
        setEdHeader("");
        setEdBody("");
        setEdFooter("");
        setEdButtons([]);
        setEdResult(null);
    };

    // ── Editor: add button ──
    const addButton = () => {
        if (edButtons.length >= 3) return;
        setEdButtons([...edButtons, { type: "QUICK_REPLY", text: "", url: "" }]);
    };

    const updateButton = (i: number, field: keyof ButtonDraft, value: string) => {
        const next = [...edButtons];
        next[i] = { ...next[i], [field]: value };
        setEdButtons(next);
    };

    const removeButton = (i: number) => {
        setEdButtons(edButtons.filter((_, idx) => idx !== i));
    };

    // ── Filter + counts ──
    const filtered = templates.filter(t => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const counts = {
        total: templates.length,
        approved: templates.filter(t => t.status === "APPROVED").length,
        pending: templates.filter(t => t.status === "PENDING").length,
        rejected: templates.filter(t => t.status === "REJECTED").length,
    };

    // ── Helpers ──
    const getBodyText = (t: Template) => t.components.find(c => c.type === "BODY")?.text || "";
    const getVarCount = (t: Template) => (getBodyText(t).match(/\{\{\d+\}\}/g) || []).length;

    const getFilledBody = (t: Template) => {
        let text = getBodyText(t);
        sendParams.forEach((val, i) => {
            if (val.trim()) text = text.replace(`{{${i + 1}}}`, val);
        });
        return text;
    };

    // Preview body text for editor
    const edPreviewBody = () => {
        return edBody || "El cuerpo del mensaje aparecerá aquí...";
    };

    const edVarCount = () => (edBody.match(/\{\{\d+\}\}/g) || []).length;

    // Editor step validation
    const canProceedStep1 = edName.trim().length >= 2;
    const canProceedStep2 = edBody.trim().length >= 10;

    // ═══════════════════════════════════════════════════════════
    //  Render: Editor View
    // ═══════════════════════════════════════════════════════════
    if (showEditor) {
        return (
            <div className="animate-in" style={{ maxWidth: "900px" }}>
                {/* Editor Header */}
                <div className="page-header" style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            onClick={resetEditor}
                            className="btn-secondary"
                            style={{ padding: "8px", borderRadius: "10px" }}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="page-title">Crear Template</h1>
                            <p className="page-subtitle">
                                Crea un nuevo template y envíalo a revisión de Meta
                            </p>
                        </div>
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="glass-panel" style={{
                    display: "flex", gap: "8px", marginBottom: "24px",
                    padding: "5px", borderRadius: "14px",
                }}>
                    {[
                        { n: 1, label: "Datos básicos" },
                        { n: 2, label: "Contenido" },
                        { n: 3, label: "Revisar y enviar" },
                    ].map(step => (
                        <div
                            key={step.n}
                            onClick={() => {
                                if (step.n < editorStep) setEditorStep(step.n);
                                if (step.n === 2 && canProceedStep1) setEditorStep(2);
                                if (step.n === 3 && canProceedStep1 && canProceedStep2) setEditorStep(3);
                            }}
                            style={{
                                flex: 1, padding: "10px 16px",
                                borderRadius: "10px",
                                display: "flex", alignItems: "center", gap: "8px",
                                cursor: "pointer",
                                background: editorStep === step.n ? "rgba(122,158,138,0.1)" : "transparent",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <span style={{
                                width: "24px", height: "24px", borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.72rem", fontWeight: 700,
                                background: editorStep >= step.n ? "var(--gradient-accent)" : "rgba(255,255,255,0.06)",
                                color: editorStep >= step.n ? "white" : "var(--text-muted)",
                                transition: "all 0.2s ease",
                            }}>
                                {editorStep > step.n ? <CheckCircle size={13} /> : step.n}
                            </span>
                            <span style={{
                                fontSize: "0.8rem", fontWeight: 600,
                                color: editorStep === step.n ? "#9ab8a8" : "var(--text-secondary)",
                            }}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", alignItems: "start" }}>
                    {/* Left: Form */}
                    <div>
                        {/* ── Step 1: Basics ── */}
                        {editorStep === 1 && (
                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-card"
                                style={{
                                    padding: "24px", borderRadius: "14px",
                                }}
                            >
                                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "20px" }}>
                                    Datos básicos del template
                                </h3>

                                {/* Name */}
                                <div style={{ marginBottom: "18px" }}>
                                    <label style={labelStyle}>
                                        Nombre del template <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="ej: bienvenida_cliente, confirmacion_compra"
                                        value={edName}
                                        onChange={e => setEdName(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
                                        style={{ fontSize: "0.84rem" }}
                                    />
                                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                        Solo letras minúsculas, números y guión bajo (_). Sin espacios ni acentos.
                                    </p>
                                </div>

                                {/* Category */}
                                <div style={{ marginBottom: "18px" }}>
                                    <label style={labelStyle}>
                                        Categoría <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        {(["MARKETING", "UTILITY"] as const).map(cat => {
                                            const info = CATEGORY_INFO[cat];
                                            const selected = edCategory === cat;
                                            return (
                                                <div
                                                    key={cat}
                                                    onClick={() => setEdCategory(cat)}
                                                    style={{
                                                        padding: "14px",
                                                        borderRadius: "10px",
                                                        border: `1.5px solid ${selected ? info.color + "40" : "var(--border)"}`,
                                                        background: selected ? info.color + "08" : "transparent",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s ease",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                                        <span style={{ color: selected ? info.color : "var(--text-muted)" }}>{info.icon}</span>
                                                        <span style={{
                                                            fontSize: "0.84rem", fontWeight: 600,
                                                            color: selected ? info.color : "var(--text-primary)",
                                                        }}>
                                                            {info.label}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                                                        {info.desc}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Language */}
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={labelStyle}>Idioma</label>
                                    <select
                                        className="select"
                                        value={edLanguage}
                                        onChange={e => setEdLanguage(e.target.value)}
                                        style={{ fontSize: "0.84rem" }}
                                    >
                                        {LANGUAGES.map(l => (
                                            <option key={l.code} value={l.code}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={() => setEditorStep(2)}
                                    disabled={!canProceedStep1}
                                    className="btn-primary flex items-center gap-2"
                                    style={{
                                        fontSize: "0.84rem", width: "100%", justifyContent: "center",
                                        opacity: canProceedStep1 ? 1 : 0.4,
                                        cursor: canProceedStep1 ? "pointer" : "not-allowed",
                                    }}
                                >
                                    Siguiente: Contenido <ArrowRight size={14} />
                                </button>
                            </motion.div>
                        )}

                        {/* ── Step 2: Content ── */}
                        {editorStep === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-card"
                                style={{
                                    padding: "24px", borderRadius: "14px",
                                }}
                            >
                                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                    Contenido del mensaje
                                </h3>
                                <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                                    Usa {"{{1}}"}, {"{{2}}"}, etc. como variables que personalizarás al enviar (nombre, precio, etc.)
                                </p>

                                {/* Header */}
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={labelStyle}>
                                        <Type size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                                        Encabezado <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span>
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="ej: ¡Hola! Tenemos una oferta para ti"
                                        value={edHeader}
                                        onChange={e => setEdHeader(e.target.value)}
                                        style={{ fontSize: "0.84rem" }}
                                        maxLength={60}
                                    />
                                    <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: "2px", textAlign: "right" }}>
                                        {edHeader.length}/60
                                    </p>
                                </div>

                                {/* Body */}
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={labelStyle}>
                                        <AlignLeft size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                                        Cuerpo del mensaje <span style={{ color: "#ef4444" }}>*</span>
                                    </label>
                                    <textarea
                                        className="input"
                                        placeholder={"Hola {{1}}, gracias por tu interés en {{2}}.\n\nTenemos una oferta especial para ti. ¿Te gustaría más información?"}
                                        value={edBody}
                                        onChange={e => setEdBody(e.target.value)}
                                        rows={5}
                                        style={{ fontSize: "0.84rem", resize: "vertical", minHeight: "100px" }}
                                        maxLength={1024}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {[1, 2, 3].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setEdBody(prev => prev + `{{${n}}}`)}
                                                    style={{
                                                        padding: "2px 8px", borderRadius: "6px",
                                                        fontSize: "0.7rem", fontWeight: 600,
                                                        background: "rgba(122,158,138,0.08)",
                                                        border: "0.5px solid rgba(122,158,138,0.15)",
                                                        color: "#9ab8a8", cursor: "pointer",
                                                    }}
                                                    title={`Insertar variable {{${n}}}`}
                                                >
                                                    + {`{{${n}}}`}
                                                </button>
                                            ))}
                                        </div>
                                        <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                                            {edBody.length}/1024
                                        </span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={labelStyle}>
                                        Pie de página <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span>
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="ej: Responde STOP para dejar de recibir mensajes"
                                        value={edFooter}
                                        onChange={e => setEdFooter(e.target.value)}
                                        style={{ fontSize: "0.84rem" }}
                                        maxLength={60}
                                    />
                                </div>

                                {/* Buttons */}
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={labelStyle}>
                                        <MousePointerClick size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                                        Botones <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional, máx 3)</span>
                                    </label>

                                    {edButtons.map((btn, i) => (
                                        <div key={i} style={{
                                            display: "flex", gap: "8px", marginBottom: "8px",
                                            alignItems: "center",
                                        }}>
                                            <select
                                                className="select"
                                                value={btn.type}
                                                onChange={e => updateButton(i, "type", e.target.value)}
                                                style={{ width: "130px", fontSize: "0.8rem", flexShrink: 0 }}
                                            >
                                                <option value="QUICK_REPLY">Respuesta rápida</option>
                                                <option value="URL">Enlace URL</option>
                                            </select>
                                            <input
                                                className="input"
                                                placeholder="Texto del botón"
                                                value={btn.text}
                                                onChange={e => updateButton(i, "text", e.target.value)}
                                                style={{ flex: 1, fontSize: "0.82rem" }}
                                                maxLength={25}
                                            />
                                            {btn.type === "URL" && (
                                                <input
                                                    className="input"
                                                    placeholder="https://..."
                                                    value={btn.url}
                                                    onChange={e => updateButton(i, "url", e.target.value)}
                                                    style={{ flex: 1, fontSize: "0.82rem" }}
                                                />
                                            )}
                                            <button
                                                onClick={() => removeButton(i)}
                                                style={{
                                                    padding: "6px", borderRadius: "6px",
                                                    background: "rgba(239,68,68,0.06)",
                                                    border: "0.5px solid rgba(239,68,68,0.1)",
                                                    color: "#ef4444", cursor: "pointer", flexShrink: 0,
                                                }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}

                                    {edButtons.length < 3 && (
                                        <button
                                            onClick={addButton}
                                            style={{
                                                padding: "6px 12px", borderRadius: "8px",
                                                fontSize: "0.76rem", fontWeight: 600,
                                                background: "rgba(255,255,255,0.03)",
                                                border: "1px dashed var(--border)",
                                                color: "var(--text-secondary)", cursor: "pointer",
                                                display: "flex", alignItems: "center", gap: "6px",
                                            }}
                                        >
                                            <Plus size={12} /> Agregar botón
                                        </button>
                                    )}
                                </div>

                                {/* Navigation */}
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button
                                        onClick={() => setEditorStep(1)}
                                        className="btn-secondary flex items-center gap-2"
                                        style={{ fontSize: "0.82rem" }}
                                    >
                                        <ArrowLeft size={14} /> Atrás
                                    </button>
                                    <button
                                        onClick={() => setEditorStep(3)}
                                        disabled={!canProceedStep2}
                                        className="btn-primary flex items-center gap-2"
                                        style={{
                                            fontSize: "0.82rem", flex: 1, justifyContent: "center",
                                            opacity: canProceedStep2 ? 1 : 0.4,
                                            cursor: canProceedStep2 ? "pointer" : "not-allowed",
                                        }}
                                    >
                                        Siguiente: Revisar <ArrowRight size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 3: Review & Submit ── */}
                        {editorStep === 3 && (
                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-card"
                                style={{
                                    padding: "24px", borderRadius: "14px",
                                }}
                            >
                                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                    Revisar y enviar a Meta
                                </h3>
                                <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                                    Verifica que todo esté correcto antes de enviar. Meta revisará tu template y lo aprobará o rechazará.
                                </p>

                                {/* Summary */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                                    {[
                                        { label: "Nombre", value: edName },
                                        { label: "Categoría", value: CATEGORY_INFO[edCategory].label },
                                        { label: "Idioma", value: LANGUAGES.find(l => l.code === edLanguage)?.label || edLanguage },
                                        { label: "Variables", value: `${edVarCount()} variable(s)` },
                                    ].map(item => (
                                        <div key={item.label} style={{
                                            padding: "10px 14px", borderRadius: "8px",
                                            background: "rgba(255,255,255,0.02)",
                                            border: "0.5px solid rgba(255,255,255,0.04)",
                                        }}>
                                            <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>
                                                {item.label}
                                            </div>
                                            <div style={{ fontSize: "0.84rem", color: "var(--text-primary)", fontWeight: 600 }}>
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tips */}
                                <div style={{
                                    padding: "12px 14px", borderRadius: "10px",
                                    background: "rgba(245,158,11,0.04)",
                                    border: "0.5px solid rgba(245,158,11,0.1)",
                                    marginBottom: "16px",
                                }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                        <Lightbulb size={14} style={{ color: "#f59e0b", marginTop: "1px", flexShrink: 0 }} />
                                        <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                            <strong style={{ color: "#f59e0b" }}>Tips para aprobación rápida:</strong>
                                            <ul style={{ margin: "4px 0 0", paddingLeft: "16px" }}>
                                                <li>Evita texto todo en MAYÚSCULAS</li>
                                                <li>No incluyas links abreviados (bit.ly, etc.)</li>
                                                <li>Sé claro sobre quién eres y qué ofreces</li>
                                                <li>Para Marketing: incluye opción de opt-out en el footer</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Result */}
                                {edResult && (
                                    <div style={{
                                        padding: "12px 14px", borderRadius: "10px", marginBottom: "14px",
                                        display: "flex", alignItems: "flex-start", gap: "8px",
                                        background: edResult.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                                        border: `0.5px solid ${edResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                                        color: edResult.success ? "#22c55e" : "#f87171",
                                        fontSize: "0.82rem",
                                    }}>
                                        {edResult.success ? <CheckCheck size={16} /> : <AlertCircle size={16} />}
                                        <div>
                                            {edResult.success ? (
                                                <>
                                                    <strong>¡Template enviado a revisión!</strong>
                                                    <p style={{ margin: "4px 0 0", fontSize: "0.76rem", opacity: 0.85 }}>
                                                        {edResult.message}
                                                    </p>
                                                </>
                                            ) : edResult.error}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button
                                        onClick={() => setEditorStep(2)}
                                        className="btn-secondary flex items-center gap-2"
                                        style={{ fontSize: "0.82rem" }}
                                    >
                                        <ArrowLeft size={14} /> Editar
                                    </button>
                                    {edResult?.success ? (
                                        <button
                                            onClick={resetEditor}
                                            className="btn-primary flex items-center gap-2"
                                            style={{ fontSize: "0.82rem", flex: 1, justifyContent: "center" }}
                                        >
                                            <CheckCircle size={14} /> Volver a mis templates
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleEditorSubmit}
                                            disabled={edSubmitting}
                                            className="btn-primary flex items-center gap-2"
                                            style={{
                                                fontSize: "0.82rem", flex: 1, justifyContent: "center",
                                                opacity: edSubmitting ? 0.5 : 1,
                                                cursor: edSubmitting ? "not-allowed" : "pointer",
                                                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                            }}
                                        >
                                            {edSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                            {edSubmitting ? "Enviando a Meta..." : "Enviar a revisión de Meta"}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Right: Live Preview */}
                    <div className="glass-card" style={{
                        position: "sticky", top: "80px",
                        padding: "20px", borderRadius: "14px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                            <MessageCircle size={15} style={{ color: "#25d366" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#25d366" }}>
                                Vista previa WhatsApp
                            </span>
                        </div>

                        {/* Phone mockup */}
                        <div style={{
                            borderRadius: "16px",
                            background: "rgba(37,211,102,0.03)",
                            border: "0.5px solid rgba(37,211,102,0.1)",
                            padding: "16px",
                            minHeight: "200px",
                        }}>
                            <div style={{
                                padding: "12px 14px",
                                borderRadius: "2px 12px 12px 12px",
                                background: "rgba(255,255,255,0.06)",
                                border: "0.5px solid rgba(255,255,255,0.06)",
                            }}>
                                {edHeader && (
                                    <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
                                        {edHeader}
                                    </p>
                                )}
                                <p style={{
                                    fontSize: "0.78rem", color: edBody ? "var(--text-secondary)" : "var(--text-muted)",
                                    lineHeight: 1.6, margin: "0 0 4px",
                                    fontStyle: edBody ? "normal" : "italic",
                                    whiteSpace: "pre-wrap",
                                }}>
                                    {edPreviewBody()}
                                </p>
                                {edFooter && (
                                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "6px 0 0" }}>
                                        {edFooter}
                                    </p>
                                )}
                                {edButtons.length > 0 && (
                                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                        {edButtons.filter(b => b.text.trim()).map((btn, i) => (
                                            <div key={i} style={{
                                                textAlign: "center", padding: "7px",
                                                borderRadius: "8px",
                                                background: "rgba(122,158,138,0.06)",
                                                border: "0.5px solid rgba(122,158,138,0.1)",
                                                color: "#9ab8a8", fontSize: "0.76rem", fontWeight: 600,
                                            }}>
                                                {btn.text} {btn.type === "URL" && <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Meta info */}
                        <div style={{ marginTop: "12px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                <strong>Nombre:</strong> {edName || "—"}<br />
                                <strong>Categoría:</strong> {CATEGORY_INFO[edCategory].label}<br />
                                <strong>Idioma:</strong> {LANGUAGES.find(l => l.code === edLanguage)?.label}<br />
                                <strong>Variables:</strong> {edVarCount()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  Render: Templates List
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="animate-in" style={{ maxWidth: "1100px" }}>
            {/* Header */}
            <div className="page-header" style={{ flexWrap: "wrap", gap: "16px" }}>
                <div>
                    <h1 className="page-title">Plantillas WhatsApp</h1>
                    <p className="page-subtitle">
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
                    <button
                        onClick={() => setShowEditor(true)}
                        className="btn-primary flex items-center gap-2"
                        style={{ fontSize: "0.8rem" }}
                    >
                        <Plus size={14} /> Crear Template
                    </button>
                </div>
            </div>

            {/* Guide */}
            <AnimatePresence>
                {showGuide && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: "hidden", marginBottom: "20px" }}
                    >
                        <div className="glass-card" style={{
                            borderRadius: "14px",
                            padding: "24px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                                <div style={{
                                    width: "32px", height: "32px", borderRadius: "8px",
                                    background: "rgba(122,158,138,0.1)", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                }}>
                                    <Lightbulb size={16} style={{ color: "#9ab8a8" }} />
                                </div>
                                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                                    Guía rápida de Templates
                                </h3>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                                {[
                                    {
                                        n: 1, title: "¿Qué es un template?",
                                        text: "Mensajes pre-aprobados por Meta que puedes enviar en cualquier momento, incluso fuera de la ventana de 24h de WhatsApp.",
                                    },
                                    {
                                        n: 2, title: "Crear uno nuevo",
                                        text: "Haz clic en \"Crear Template\", redacta tu mensaje con variables personalizables y envíalo a revisión. Meta lo aprueba en minutos a horas.",
                                    },
                                    {
                                        n: 3, title: "Enviar a un lead",
                                        text: "En cualquier template aprobado, haz clic en \"Enviar a Lead\", elige el contacto, personaliza las variables y envía al instante.",
                                    },
                                ].map(step => (
                                    <div key={step.n} style={{
                                        padding: "14px", borderRadius: "10px",
                                        background: "rgba(255,255,255,0.03)",
                                        border: "0.5px solid rgba(255,255,255,0.05)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                            <span style={{
                                                width: "20px", height: "20px", borderRadius: "50%",
                                                background: "var(--gradient-accent)", display: "flex",
                                                alignItems: "center", justifyContent: "center",
                                                fontSize: "0.68rem", fontWeight: 700, color: "white",
                                            }}>{step.n}</span>
                                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                                {step.title}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                                            {step.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* KPIs */}
            <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
                {[
                    { label: "Total", value: counts.total, color: "#9ab8a8", icon: <FileText size={14} /> },
                    { label: "Aprobados", value: counts.approved, color: "#22c55e", icon: <CheckCircle size={14} /> },
                    { label: "Pendientes", value: counts.pending, color: "#f59e0b", icon: <Clock size={14} /> },
                    { label: "Rechazados", value: counts.rejected, color: "#ef4444", icon: <XCircle size={14} /> },
                ].map(kpi => (
                    <div key={kpi.label} className="kpi-card" style={{
                        padding: "14px 16px",
                        display: "flex", alignItems: "center", gap: "12px",
                    }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: `${kpi.color}12`, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: kpi.color, flexShrink: 0,
                        }}>
                            {kpi.icon}
                        </div>
                        <div>
                            <div className="dashboard-stat" style={{ fontSize: "1.25rem", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, marginTop: "3px", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ Predefined Templates Section ═══ */}
            <div className="glass-card" style={{
                borderRadius: "14px", marginBottom: "20px", overflow: "hidden",
            }}>
                {/* Header with toggle */}
                <button
                    onClick={() => setShowPresets(!showPresets)}
                    style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-primary)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                            width: "32px", height: "32px", borderRadius: "8px",
                            background: "rgba(122,158,138,0.1)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                        }}>
                            <Sparkles size={16} style={{ color: "var(--accent, #7a9e8a)" }} />
                        </div>
                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Plantillas predefinidas</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                7 templates listos por industria — úsalos como punto de partida
                            </div>
                        </div>
                    </div>
                    <ArrowRight size={16} style={{
                        color: "var(--text-muted)",
                        transform: showPresets ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                    }} />
                </button>

                {showPresets && (
                    <div style={{ padding: "0 20px 20px" }}>
                        {/* Industry tabs */}
                        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                            {TEMPLATE_PRESET_GROUPS.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setPresetIndustry(group.id)}
                                    className={`filter-pill${presetIndustry === group.id ? " active" : ""}`}
                                    style={{
                                        padding: "7px 16px",
                                        display: "flex", alignItems: "center", gap: "6px",
                                        fontSize: "0.78rem", fontWeight: 600,
                                    }}
                                >
                                    <span>{group.emoji}</span> {group.label}
                                </button>
                            ))}
                        </div>

                        {/* Preset cards grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: "10px",
                        }}>
                            {TEMPLATE_PRESET_GROUPS
                                .find(g => g.id === presetIndustry)
                                ?.presets.map(preset => (
                                    <div
                                        key={preset.id}
                                        className="glass-card card-hover-lift"
                                        style={{
                                            padding: "16px",
                                            display: "flex", flexDirection: "column", gap: "10px",
                                            cursor: "default",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{
                                                fontSize: "0.82rem", fontWeight: 600,
                                                color: "var(--text-primary)", flex: 1,
                                            }}>
                                                {preset.name.replace(/_/g, " ")}
                                            </span>
                                            <span style={{
                                                fontSize: "0.62rem", fontWeight: 600,
                                                padding: "2px 8px", borderRadius: "10px",
                                                letterSpacing: "0.05em",
                                                background: preset.category === "MARKETING"
                                                    ? "rgba(154,184,168,0.1)" : "rgba(167,139,250,0.1)",
                                                color: preset.category === "MARKETING"
                                                    ? "#9ab8a8" : "#a78bfa",
                                                textTransform: "uppercase",
                                            }}>
                                                {preset.category === "MARKETING" ? "Marketing" : "Utilidad"}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: "0.72rem", color: "var(--text-muted)",
                                            lineHeight: 1.5, margin: 0,
                                        }}>
                                            {preset.description}
                                        </p>
                                        <p style={{
                                            fontSize: "0.7rem", color: "var(--text-secondary)",
                                            lineHeight: 1.5, margin: 0,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            opacity: 0.7,
                                            fontStyle: "italic",
                                        }}>
                                            {preset.body.substring(0, 120)}...
                                        </p>
                                        <button
                                            onClick={() => loadPreset(preset)}
                                            style={{
                                                padding: "6px 14px", borderRadius: "8px",
                                                border: "0.5px solid rgba(122,158,138,0.2)",
                                                background: "rgba(122,158,138,0.06)",
                                                color: "var(--accent, #7a9e8a)",
                                                fontSize: "0.72rem", fontWeight: 600,
                                                cursor: "pointer",
                                                transition: "all 0.2s ease",
                                                alignSelf: "flex-start",
                                                display: "flex", alignItems: "center", gap: "6px",
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = "rgba(122,158,138,0.12)";
                                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.35)";
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = "rgba(122,158,138,0.06)";
                                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.2)";
                                            }}
                                        >
                                            <Plus size={12} /> Usar plantilla
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Search + Filter */}
            <div className="section-label" style={{ marginTop: "4px" }}>Mis Templates</div>
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
                            className={`filter-pill${statusFilter === s ? " active" : ""}`}
                        >
                            {s === "all" ? "Todos" : s === "APPROVED" ? "Aprobados" : s === "PENDING" ? "Pendientes" : "Rechazados"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: "12px 16px", borderRadius: "12px",
                    background: "rgba(239,68,68,0.05)", border: "0.5px solid rgba(239,68,68,0.12)",
                    color: "#f87171", fontSize: "0.82rem", marginBottom: "16px",
                    display: "flex", alignItems: "center", gap: "8px",
                }}>
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center" style={{ minHeight: "200px" }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            )}

            {/* Templates List */}
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
                                    className="glass-card"
                                    style={{
                                        padding: "16px 20px", borderRadius: "12px",
                                        display: "flex", alignItems: "center", gap: "16px",
                                        cursor: "pointer",
                                        borderLeft: `2px solid ${isApproved ? "var(--accent-sage)" : t.status === "PENDING" ? "var(--accent-warm)" : "var(--danger)"}`,
                                    }}
                                >
                                    <div style={{
                                        width: "40px", height: "40px", borderRadius: "10px",
                                        background: isApproved ? "rgba(34,197,94,0.08)" : t.status === "PENDING" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                    }}>
                                        <MessageCircle size={18} style={{
                                            color: isApproved ? "#22c55e" : t.status === "PENDING" ? "#f59e0b" : "#ef4444",
                                        }} />
                                    </div>
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
                                            margin: 0, lineHeight: 1.5, overflow: "hidden",
                                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                            {bodyText || "Sin contenido"}
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                        {varCount > 0 && (
                                            <span style={{
                                                fontSize: "0.68rem", color: "var(--text-muted)",
                                                display: "flex", alignItems: "center", gap: "4px",
                                                padding: "3px 8px", borderRadius: "6px",
                                                background: "rgba(255,255,255,0.03)",
                                            }}>
                                                <Sparkles size={10} /> {varCount} var
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
                                                    padding: "6px 14px", borderRadius: "8px",
                                                    background: "rgba(37,211,102,0.1)",
                                                    border: "0.5px solid rgba(37,211,102,0.2)",
                                                    color: "#25d366", fontSize: "0.76rem", fontWeight: 600,
                                                    cursor: "pointer", display: "flex", alignItems: "center",
                                                    gap: "6px", transition: "all 0.2s ease", whiteSpace: "nowrap",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,0.18)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,211,102,0.1)"; }}
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
                <div className="glass-card" style={{
                    textAlign: "center", padding: "60px 20px",
                    borderRadius: "14px",
                }}>
                    <div style={{
                        width: "56px", height: "56px", borderRadius: "14px",
                        background: "rgba(122,158,138,0.06)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        margin: "0 auto 16px",
                    }}>
                        <FileText size={24} style={{ color: "#9ab8a8" }} />
                    </div>
                    <p style={{ color: "var(--text-primary)", fontSize: "0.92rem", fontWeight: 600, marginBottom: "4px" }}>
                        {templates.length === 0 ? "No hay templates todavía" : "Sin resultados"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "16px" }}>
                        {templates.length === 0
                            ? "Crea tu primer template o sincroniza con Meta para cargar los existentes."
                            : "Ajusta los filtros o el término de búsqueda."}
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
                            <button
                                onClick={() => setShowEditor(true)}
                                className="btn-primary flex items-center gap-2"
                                style={{ fontSize: "0.8rem" }}
                            >
                                <Plus size={14} /> Crear Template
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Detail Modal ═══ */}
            <AnimatePresence>
                {selectedTemplate && (
                    <ModalOverlay onClose={() => setSelectedTemplate(null)}>
                        <div style={{ maxWidth: "560px", width: "100%" }}>
                            {/* Header */}
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
                                            border: "0.5px solid rgba(255,255,255,0.06)",
                                            color: "var(--text-muted)",
                                        }}>
                                            {selectedTemplate.language}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <button
                                        onClick={() => {
                                            if (confirm("¿Eliminar este template? Esta acción no se puede deshacer.")) {
                                                handleDelete(selectedTemplate.name);
                                            }
                                        }}
                                        disabled={deleting === selectedTemplate.name}
                                        style={{
                                            padding: "6px", borderRadius: "6px", cursor: "pointer",
                                            background: "rgba(239,68,68,0.06)",
                                            border: "0.5px solid rgba(239,68,68,0.1)",
                                            color: "#ef4444",
                                            opacity: deleting ? 0.4 : 1,
                                        }}
                                        title="Eliminar template"
                                    >
                                        {deleting === selectedTemplate.name ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                    <button onClick={() => setSelectedTemplate(null)} style={{
                                        color: "var(--text-muted)", cursor: "pointer", background: "none",
                                        border: "none", padding: "4px",
                                    }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div style={{
                                display: "flex", gap: "4px", marginBottom: "20px",
                                background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "3px",
                            }}>
                                <button
                                    onClick={() => setActiveTab("preview")}
                                    style={{
                                        flex: 1, padding: "8px 16px", borderRadius: "8px",
                                        fontSize: "0.8rem", fontWeight: 600, border: "none", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        background: activeTab === "preview" ? "rgba(122,158,138,0.1)" : "transparent",
                                        color: activeTab === "preview" ? "#9ab8a8" : "var(--text-secondary)",
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

                            {/* Preview Tab */}
                            {activeTab === "preview" && (
                                <div>
                                    <div style={{
                                        padding: "20px", borderRadius: "14px",
                                        background: "rgba(37,211,102,0.03)",
                                        border: "0.5px solid rgba(37,211,102,0.1)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                            <MessageCircle size={15} style={{ color: "#25d366" }} />
                                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#25d366" }}>
                                                Así se verá en WhatsApp
                                            </span>
                                        </div>
                                        <div style={{
                                            padding: "14px 16px", borderRadius: "2px 14px 14px 14px",
                                            background: "rgba(255,255,255,0.06)",
                                            border: "0.5px solid rgba(255,255,255,0.06)",
                                        }}>
                                            {selectedTemplate.components.map((c, i) => (
                                                <div key={i}>
                                                    {c.type === "HEADER" && c.text && (
                                                        <p style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>{c.text}</p>
                                                    )}
                                                    {c.type === "BODY" && (
                                                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 6px" }}>{c.text}</p>
                                                    )}
                                                    {c.type === "FOOTER" && (
                                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "8px 0 0" }}>{c.text}</p>
                                                    )}
                                                    {c.type === "BUTTONS" && c.buttons && (
                                                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                                            {c.buttons.map((btn, bi) => (
                                                                <div key={bi} style={{
                                                                    textAlign: "center", padding: "8px", borderRadius: "8px",
                                                                    background: "rgba(122,158,138,0.06)",
                                                                    border: "0.5px solid rgba(122,158,138,0.1)",
                                                                    color: "#9ab8a8", fontSize: "0.78rem", fontWeight: 600,
                                                                }}>{btn.text}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {getVarCount(selectedTemplate) > 0 && (
                                        <div style={{
                                            marginTop: "14px", padding: "12px 14px", borderRadius: "10px",
                                            background: "rgba(245,158,11,0.04)",
                                            border: "0.5px solid rgba(245,158,11,0.1)",
                                            display: "flex", alignItems: "flex-start", gap: "8px",
                                        }}>
                                            <Info size={14} style={{ color: "#f59e0b", marginTop: "1px", flexShrink: 0 }} />
                                            <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                                Este template tiene <strong style={{ color: "#f59e0b" }}>{getVarCount(selectedTemplate)} variable(s)</strong>.
                                                Al enviar, podrás personalizar cada variable con datos del cliente.
                                            </p>
                                        </div>
                                    )}
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

                            {/* Send Tab */}
                            {activeTab === "send" && (
                                <div>
                                    <div style={{
                                        padding: "12px 14px", borderRadius: "10px",
                                        background: "rgba(37,211,102,0.04)",
                                        border: "0.5px solid rgba(37,211,102,0.1)",
                                        marginBottom: "16px",
                                        display: "flex", alignItems: "flex-start", gap: "8px",
                                    }}>
                                        <Sparkles size={14} style={{ color: "#25d366", marginTop: "1px", flexShrink: 0 }} />
                                        <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                            Selecciona un lead y personaliza las variables. El mensaje se envía por WhatsApp al instante.
                                        </p>
                                    </div>

                                    <div style={{ marginBottom: "14px" }}>
                                        <label style={labelStyle}>¿A quién enviar?</label>
                                        <select
                                            className="select"
                                            value={selectedLead}
                                            onChange={e => setSelectedLead(e.target.value)}
                                            style={{ fontSize: "0.84rem" }}
                                        >
                                            <option value="">Selecciona un lead...</option>
                                            {leads.map(l => (
                                                <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {sendParams.length > 0 && (
                                        <div style={{ marginBottom: "14px" }}>
                                            <label style={labelStyle}>Personaliza las variables</label>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                {sendParams.map((p, i) => (
                                                    <div key={i} style={{ position: "relative" }}>
                                                        <span style={{
                                                            position: "absolute", left: "12px", top: "50%",
                                                            transform: "translateY(-50%)", fontSize: "0.72rem",
                                                            fontWeight: 700, color: "var(--text-muted)",
                                                        }}>{`{{${i + 1}}}`}</span>
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

                                    <div style={{
                                        padding: "14px 16px", borderRadius: "10px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "0.5px solid rgba(255,255,255,0.05)",
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

                                    {sendResult && (
                                        <div style={{
                                            padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
                                            fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px",
                                            background: sendResult.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                                            border: `0.5px solid ${sendResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                                            color: sendResult.success ? "#22c55e" : "#f87171",
                                        }}>
                                            {sendResult.success ? <CheckCheck size={15} /> : <AlertCircle size={15} />}
                                            {sendResult.success ? "¡Template enviado exitosamente!" : sendResult.error}
                                        </div>
                                    )}

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
//  Styles
// ═══════════════════════════════════════════════════════════════
const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.76rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "6px",
};

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
            background: c.bg, border: `0.5px solid ${c.border}`, color: c.color,
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
            background: isMarketing ? "rgba(122,158,138,0.08)" : "rgba(255,255,255,0.04)",
            border: `0.5px solid ${isMarketing ? "rgba(122,158,138,0.18)" : "rgba(255,255,255,0.06)"}`,
            color: isMarketing ? "#9ab8a8" : "var(--text-muted)",
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

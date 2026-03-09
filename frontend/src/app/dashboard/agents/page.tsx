"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/lib/org-context";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { applyIndustryTemplate } from "../settings/actions";
import { scrapeUrlsForPreview, saveScrapedContext } from "./actions";
import type { ConversationTone } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot, Save, Sparkles, CheckCircle, CalendarCheck,
    MessageSquare, SlidersHorizontal, AlertTriangle, Kanban, Loader2, Check,
    Scissors, Building2, ShoppingBag, FileText, Briefcase, Rocket, Smile,
    Globe, RefreshCw, BookOpen, Plus, Trash2, Database, HelpCircle, GripVertical,
    ChevronDown, Brain, Settings2, Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
    hair_salon: <Scissors size={17} />,
    real_estate: <Building2 size={17} />,
    ecommerce: <ShoppingBag size={17} />,
    blank: <FileText size={17} />,
};

const TONE_ICONS: Record<string, React.ReactNode> = {
    "Profesional y Formal": <Briefcase size={15} />,
    "Amigable y Casual": <Smile size={15} />,
    "Entusiasta y Vendedor": <Rocket size={15} />,
};

const TONE_OPTIONS: { value: ConversationTone; label: string; desc: string }[] = [
    { value: "Profesional y Formal", label: "Profesional y Formal", desc: "Preciso, vocabulario corporativo" },
    { value: "Amigable y Casual", label: "Amigable y Casual", desc: "Cercano, coloquial, como un amigo experto" },
    { value: "Entusiasta y Vendedor", label: "Entusiasta y Vendedor", desc: "Proactivo, persuasivo, orientado a cerrar" },
];

interface AgentData {
    id: string; name: string; system_prompt: string; welcome_message: string;
    model: string; temperature: number; booking_url: string | null;
    conversation_tone: ConversationTone | null; escalation_rule: string | null;
    is_active: boolean; scraped_context?: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ACCORDION SECTION COMPONENT
   ═══════════════════════════════════════════════════════════ */

function AccordionSection({
    id, icon, title, subtitle, badge, isOpen, onToggle, children,
}: {
    id: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    badge?: React.ReactNode;
    isOpen: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="glass-card" style={{ cursor: "default", overflow: "hidden" }}>
            {/* ── Clickable header ── */}
            <button
                type="button"
                onClick={() => onToggle(id)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "18px 22px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
                {/* Icon */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: isOpen ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.05)",
                    border: isOpen ? "1px solid rgba(59,130,246,0.15)" : "1px solid rgba(255,255,255,0.07)",
                    color: isOpen ? "#60a5fa" : "#a1a1aa",
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                }}>
                    {icon}
                </div>

                {/* Title + subtitle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: "0.88rem", fontWeight: 600,
                        color: "var(--text-primary)",
                        lineHeight: 1.3,
                    }}>
                        {title}
                    </div>
                    <div style={{
                        fontSize: "0.73rem",
                        color: "var(--text-muted)",
                        marginTop: "1px",
                    }}>
                        {subtitle}
                    </div>
                </div>

                {/* Badge */}
                {badge && (
                    <div style={{
                        padding: "3px 10px",
                        borderRadius: "100px",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                    }}>
                        {badge}
                    </div>
                )}

                {/* Chevron */}
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ flexShrink: 0, color: "var(--text-muted)" }}
                >
                    <ChevronDown size={18} />
                </motion.div>
            </button>

            {/* ── Collapsible body ── */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        key={`body-${id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{
                            padding: "0 22px 22px",
                            borderTop: "1px solid rgba(255,255,255,0.04)",
                        }}>
                            <div style={{ paddingTop: "18px" }}>
                                {children}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function AgentConfigPage() {
    const { organization } = useOrg();
    const [agent, setAgent] = useState<AgentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [name, setName] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [welcomeMessage, setWelcomeMessage] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");
    const [temperature, setTemperature] = useState(0.7);
    const [bookingUrl, setBookingUrl] = useState("");
    const [tone, setTone] = useState<ConversationTone>("Profesional y Formal");
    const [escalationRule, setEscalationRule] = useState("");
    const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
    const [applyingTpl, setApplyingTpl] = useState(false);
    const [tplResult, setTplResult] = useState<{ stagesCreated: boolean; msg: string } | null>(null);

    // ── URL Brain state ───────────────────────────────────────
    const [urls, setUrls] = useState<string[]>([""]);
    const [scraping, setScraping] = useState(false);
    const [scrapeErrors, setScrapeErrors] = useState<string[]>([]);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [contextSaving, setContextSaving] = useState(false);
    const [contextSaved, setContextSaved] = useState(false);
    const [currentContext, setCurrentContext] = useState<string | null>(null);

    // ── FAQ state ─────────────────────────────────────────────
    interface FaqItem { id: string; question: string; answer: string; }
    const [faqs, setFaqs] = useState<FaqItem[]>([]);
    const [faqLoading, setFaqLoading] = useState(true);
    const [faqSaving, setFaqSaving] = useState(false);
    const [faqSaved, setFaqSaved] = useState(false);
    const [faqDraft, setFaqDraft] = useState({ question: "", answer: "" });
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);

    // ── Accordion state ───────────────────────────────────────
    const [openSections, setOpenSections] = useState<Set<string>>(
        new Set(["personality", "instructions"])
    );
    const [showFloatingSave, setShowFloatingSave] = useState(false);

    const toggleSection = (id: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ── Floating save on scroll ──
    useEffect(() => {
        const handleScroll = () => setShowFloatingSave(window.scrollY > 140);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    /* ── Data loaders ──────────────────────────────────────── */
    const loadAgent = useCallback(async () => {
        try {
            const res = await fetch(`/api/agents?org_id=${organization.id}`);
            const { data } = await res.json();
            if (data && data.length > 0) {
                const a: AgentData = data[0];
                setAgent(a); setName(a.name);
                setSystemPrompt(a.system_prompt || "");
                setWelcomeMessage(a.welcome_message || "¡Hola! ¿En qué puedo ayudarte?");
                setModel(a.model || "gpt-4o-mini");
                setTemperature(a.temperature ?? 0.7);
                setBookingUrl(a.booking_url || "");
                setTone((a.conversation_tone as ConversationTone) || "Profesional y Formal");
                setEscalationRule(a.escalation_rule || "");
                setCurrentContext(a.scraped_context || null);
            } else {
                const createRes = await fetch("/api/agents", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ organization_id: organization.id, name: "Asistente Virtual", system_prompt: "", welcome_message: "¡Hola! ¿En qué puedo ayudarte hoy?" }),
                });
                const { data: newAgent } = await createRes.json();
                if (newAgent) {
                    setAgent(newAgent); setName(newAgent.name || "Asistente Virtual");
                    setSystemPrompt(newAgent.system_prompt || "");
                    setWelcomeMessage(newAgent.welcome_message || "");
                    setModel(newAgent.model || "gpt-4o-mini");
                    setTemperature(newAgent.temperature ?? 0.7);
                }
            }
        } catch (err) { console.error("Failed to load agent:", err); }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => { loadAgent(); }, [loadAgent]);

    const loadFaqs = useCallback(async () => {
        try {
            const res = await fetch(`/api/faqs?org_id=${organization.id}`);
            const { data } = await res.json();
            if (data) setFaqs(data);
        } catch (err) { console.error("Failed to load FAQs:", err); }
        setFaqLoading(false);
    }, [organization.id]);

    useEffect(() => { loadFaqs(); }, [loadFaqs]);

    /* ── FAQ handlers ─────────────────────────────────────── */
    const saveFaqs = async (updatedFaqs: FaqItem[]) => {
        setFaqSaving(true); setFaqSaved(false);
        try {
            await fetch(`/api/faqs?org_id=${organization.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ faqs: updatedFaqs }),
            });
            setFaqs(updatedFaqs);
            setFaqSaved(true);
            setTimeout(() => setFaqSaved(false), 2500);
        } catch (err) { console.error("Failed to save FAQs:", err); }
        setFaqSaving(false);
    };

    const addFaq = () => {
        if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
        const newFaq: FaqItem = {
            id: crypto.randomUUID(),
            question: faqDraft.question.trim(),
            answer: faqDraft.answer.trim(),
        };
        const updated = [...faqs, newFaq];
        saveFaqs(updated);
        setFaqDraft({ question: "", answer: "" });
    };

    const updateFaq = (id: string, field: "question" | "answer", value: string) => {
        setFaqs(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const saveFaqEdit = (id: string) => {
        void id;
        setEditingFaqId(null);
        saveFaqs(faqs);
    };

    const removeFaq = (id: string) => {
        const updated = faqs.filter(f => f.id !== id);
        saveFaqs(updated);
    };

    /* ── Template handler ─────────────────────────────────── */
    const handleApplyTemplate = async () => {
        if (!selectedTplId) return;
        setApplyingTpl(true); setTplResult(null);
        const tpl = INDUSTRY_TEMPLATES.find((t) => t.id === selectedTplId);
        if (tpl?.systemPrompt) setSystemPrompt(tpl.systemPrompt);
        if (tpl?.defaultName) setName(tpl.defaultName);
        if (tpl?.defaultWelcome) setWelcomeMessage(tpl.defaultWelcome);
        const result = await applyIndustryTemplate(organization.id, selectedTplId);
        setTplResult({
            stagesCreated: result.stagesCreated ?? false,
            msg: result.stagesCreated
                ? "Pipeline creado con las columnas de tu industria."
                : "Prompt actualizado. Tu pipeline existente no fue modificado.",
        });
        setApplyingTpl(false);
    };

    /* ── Save handler ─────────────────────────────────────── */
    const handleSave = async () => {
        if (!agent) return;
        setSaving(true); setSaved(false);
        try {
            await fetch(`/api/agents/${agent.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, system_prompt: systemPrompt, welcome_message: welcomeMessage, model, temperature, booking_url: bookingUrl || null, conversation_tone: tone, escalation_rule: escalationRule || null }),
            });
            setSaved(true); setTimeout(() => setSaved(false), 2500);
        } catch (err) { console.error("Failed to save agent:", err); }
        setSaving(false);
    };

    /* ── URL Brain handlers ───────────────────────────────── */
    const addUrl = () => setUrls((prev) => [...prev, ""]);
    const removeUrl = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i));
    const updateUrl = (i: number, val: string) =>
        setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

    const handleScrape = async () => {
        if (!agent) return;
        setScraping(true); setScrapeErrors([]); setExtractedText(null); setContextSaved(false);
        const result = await scrapeUrlsForPreview(urls);
        if (result.ok && result.text) setExtractedText(result.text);
        if (result.errors?.length) setScrapeErrors(result.errors);
        if (!result.ok && !result.text) setScrapeErrors(result.errors ?? ["Error desconocido al extraer contenido."]);
        setScraping(false);
    };

    const handleSaveContext = async () => {
        if (!agent || !extractedText?.trim()) return;
        setContextSaving(true); setContextSaved(false);
        const result = await saveScrapedContext(agent.id, extractedText);
        if (result.ok) {
            setCurrentContext(extractedText);
            setContextSaved(true);
            setTimeout(() => setContextSaved(false), 3000);
        } else {
            setScrapeErrors([result.error ?? "Error al guardar."]);
        }
        setContextSaving(false);
    };

    /* ── Dynamic badges ───────────────────────────────────── */
    const personalityBadge = (() => {
        const tpl = INDUSTRY_TEMPLATES.find(t => t.id === selectedTplId);
        return tpl ? tpl.label : name || "Sin configurar";
    })();

    const instructionsBadge = (() => {
        if (!systemPrompt) return "Pendiente";
        const len = systemPrompt.length;
        return len > 500 ? `${Math.round(len / 1000)}k chars` : `${len} chars`;
    })();

    const knowledgeBadge = currentContext ? "Activa" : "Sin datos";

    const faqBadge = faqs.length > 0 ? `${faqs.length} pregunta${faqs.length > 1 ? "s" : ""}` : "Sin FAQ";

    const advancedBadge = `${model === "gpt-4o-mini" ? "4o Mini" : model === "gpt-4o" ? "4o" : "4 Turbo"} | T: ${temperature}`;

    /* ── Loading state ────────────────────────────────────── */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    /* ═════════════════════════════════════════════════════════
       RENDER
       ═════════════════════════════════════════════════════════ */
    return (
        <div className="animate-in">
            {/* ── Page header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mi Asistente</h1>
                    <p className="page-subtitle">Define la personalidad, el tono y el comportamiento de tu bot</p>
                </div>
                <button onClick={handleSave} className="btn-primary" disabled={saving} style={{ minWidth: "160px" }}>
                    {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</>
                        : saved ? <><CheckCircle size={14} /> ¡Guardado!</>
                            : <><Save size={14} /> Guardar Cambios</>}
                </button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>

                {/* ═══ SECTION 1: Plantilla y Personalidad ═══ */}
                <AccordionSection
                    id="personality"
                    icon={<Sparkles size={17} />}
                    title="Plantilla y Personalidad"
                    subtitle="Elige tu industria, nombra al agente y define su tono"
                    badge={personalityBadge}
                    isOpen={openSections.has("personality")}
                    onToggle={toggleSection}
                >
                    <div className="space-y-5">

                        {/* Template grid */}
                        <div>
                            <label className="form-label" style={{ marginBottom: "10px", display: "block" }}>
                                Plantillas por Industria
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "14px" }}>
                                {INDUSTRY_TEMPLATES.map((tpl) => {
                                    const isSelected = selectedTplId === tpl.id;
                                    return (
                                        <button key={tpl.id} onClick={() => {
                                            setSelectedTplId(tpl.id);
                                            setTplResult(null);
                                            if (tpl.systemPrompt) setSystemPrompt(tpl.systemPrompt);
                                            if (tpl.defaultName) setName(tpl.defaultName);
                                            if (tpl.defaultWelcome) setWelcomeMessage(tpl.defaultWelcome);
                                        }}
                                            style={{
                                                padding: "13px 10px", borderRadius: "10px",
                                                border: isSelected ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.06)",
                                                background: isSelected ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.02)",
                                                cursor: "pointer", textAlign: "left" as const,
                                                transition: "all 0.15s ease",
                                                boxShadow: isSelected ? "0 0 0 1px rgba(59,130,246,0.15)" : "none",
                                            }}>
                                            <div style={{ marginBottom: "7px", color: isSelected ? "#60a5fa" : "#52525b" }}>
                                                {TEMPLATE_ICONS[tpl.id] ?? <FileText size={17} />}
                                            </div>
                                            <div style={{ fontSize: "0.77rem", fontWeight: 600, color: isSelected ? "#f4f4f5" : "#a1a1aa" }}>{tpl.label}</div>
                                            <div style={{ fontSize: "0.67rem", color: "#52525b", marginTop: "2px" }}>{tpl.description}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Pipeline preview */}
                            {selectedTplId && selectedTplId !== "blank" && (() => {
                                const tpl = INDUSTRY_TEMPLATES.find((t) => t.id === selectedTplId);
                                if (!tpl) return null;
                                return (
                                    <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
                                            <Kanban size={12} style={{ color: "var(--text-muted)" }} />
                                            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pipeline</span>
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                            {tpl.stages.map((s) => (
                                                <span key={s.name} style={{ padding: "2px 9px", borderRadius: "100px", fontSize: "0.7rem", fontWeight: 500, background: `${s.color}14`, color: s.color, border: `1px solid ${s.color}30` }}>
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Template result */}
                            {tplResult && (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px", fontSize: "0.8rem", fontWeight: 500, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                                    <Check size={13} style={{ color: "var(--success)" }} />{tplResult.msg}
                                </div>
                            )}

                            <button className="btn-primary" onClick={handleApplyTemplate} disabled={!selectedTplId || applyingTpl} style={{ width: "100%", justifyContent: "center" }}>
                                {applyingTpl ? <><Loader2 size={13} className="animate-spin" /> Aplicando…</> : <><Sparkles size={13} /> Aplicar Plantilla</>}
                            </button>
                            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                                El prompt se actualiza al seleccionar. Haz clic en &ldquo;Aplicar&rdquo; para crear las columnas del pipeline.
                            </p>
                        </div>

                        {/* Divider */}
                        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

                        {/* Agent name */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                <Bot size={11} className="inline mr-1" />
                                Nombre del Agente
                            </label>
                            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Vendedor Estrella" />
                        </div>

                        {/* Welcome message */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                <MessageSquare size={11} className="inline mr-1" />
                                Mensaje de Bienvenida
                            </label>
                            <input className="input" value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="¡Hola! ¿En qué puedo ayudarte?" />
                            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                Primer mensaje que el bot envía al iniciar una conversación.
                            </p>
                        </div>

                        {/* Conversation tone */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tono de Conversación</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                                {TONE_OPTIONS.map((opt) => {
                                    const isSelected = tone === opt.value;
                                    return (
                                        <button key={opt.value} type="button" onClick={() => setTone(opt.value)} style={{
                                            display: "flex", alignItems: "center", gap: "11px", padding: "11px 13px", borderRadius: "10px",
                                            border: isSelected ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
                                            background: isSelected ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.02)",
                                            cursor: "pointer", textAlign: "left", transition: "all 0.15s ease", width: "100%",
                                        }}>
                                            <span style={{ color: isSelected ? "#60a5fa" : "#52525b", flexShrink: 0 }}>
                                                {TONE_ICONS[opt.value]}
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: isSelected ? "#f4f4f5" : "#a1a1aa" }}>{opt.label}</div>
                                                <div style={{ fontSize: "0.7rem", color: "#52525b" }}>{opt.desc}</div>
                                            </div>
                                            {isSelected && <Check size={13} style={{ color: "#60a5fa", flexShrink: 0 }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </AccordionSection>

                {/* ═══ SECTION 2: Instrucciones del Agente ═══ */}
                <AccordionSection
                    id="instructions"
                    icon={<Brain size={17} />}
                    title="Instrucciones del Agente"
                    subtitle="Prompt del sistema y regla de derivación"
                    badge={instructionsBadge}
                    isOpen={openSections.has("instructions")}
                    onToggle={toggleSection}
                >
                    <div className="space-y-4">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                <Zap size={11} className="inline mr-1" />
                                Prompt del Sistema
                            </label>
                            <textarea
                                className="textarea"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                placeholder="Selecciona una plantilla arriba o escribe aquí las instrucciones para tu agente…"
                                style={{ minHeight: "260px", fontFamily: "monospace", fontSize: "0.78rem", lineHeight: 1.7 }}
                            />
                            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                Este es el cerebro de tu agente. Define cómo debe comportarse, qué información dar y cuándo derivar.
                            </p>
                        </div>

                        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                <AlertTriangle size={11} className="inline mr-1" />
                                Regla de Derivación a Humano
                            </label>
                            <textarea
                                className="textarea"
                                rows={3}
                                value={escalationRule}
                                onChange={e => setEscalationRule(e.target.value)}
                                placeholder="Ej: Derivar a un humano si el cliente pide un reembolso o si insiste más de 2 veces."
                                style={{ resize: "vertical", minHeight: "80px" }}
                            />
                            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                Define cuándo el bot debe dejar de responder y notificar a un agente humano.
                            </p>
                        </div>
                    </div>
                </AccordionSection>

                {/* ═══ SECTION 3: Base de Conocimiento ═══ */}
                <AccordionSection
                    id="knowledge"
                    icon={<BookOpen size={17} />}
                    title="Base de Conocimiento"
                    subtitle="Entrena al bot con información de tu web"
                    badge={knowledgeBadge}
                    isOpen={openSections.has("knowledge")}
                    onToggle={toggleSection}
                >
                    <div className="space-y-4">
                        {/* URL list */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {urls.map((url, i) => (
                                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <div style={{ position: "relative", flex: 1 }}>
                                        <Globe size={14} style={{
                                            position: "absolute", left: "12px", top: "50%",
                                            transform: "translateY(-50%)", color: "var(--text-muted)",
                                            pointerEvents: "none",
                                        }} />
                                        <input
                                            className="input"
                                            style={{ paddingLeft: "36px" }}
                                            value={url}
                                            onChange={(e) => updateUrl(i, e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && i === urls.length - 1 && addUrl()}
                                            placeholder={i === 0 ? "https://tuempresa.com/inicio" : "https://tuempresa.com/faq"}
                                            disabled={scraping}
                                        />
                                    </div>
                                    {urls.length > 1 && (
                                        <button type="button" onClick={() => removeUrl(i)} disabled={scraping} title="Eliminar esta URL"
                                            style={{
                                                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                                                borderRadius: "8px", color: "#f87171", padding: "8px", cursor: "pointer",
                                                display: "flex", alignItems: "center", transition: "all 0.15s ease", flexShrink: 0,
                                            }}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Buttons */}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button type="button" onClick={addUrl} disabled={scraping}
                                style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    padding: "9px 14px", borderRadius: "9px", fontSize: "0.8rem",
                                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                                    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s ease",
                                }}>
                                <Plus size={14} /> Agregar otra URL
                            </button>
                            <button className="btn-primary" onClick={handleScrape} disabled={scraping || urls.every((u) => !u.trim())}
                                style={{ flex: 1, justifyContent: "center", minWidth: "160px" }}>
                                {scraping
                                    ? <><Loader2 size={14} className="animate-spin" /> Extrayendo con Jina AI…</>
                                    : <><RefreshCw size={14} /> Extraer Información</>}
                            </button>
                        </div>

                        {/* Errors */}
                        {scrapeErrors.length > 0 && (
                            <div style={{
                                padding: "10px 14px", borderRadius: "10px", fontSize: "0.78rem",
                                background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
                                color: "#f87171", display: "flex", flexDirection: "column", gap: "4px",
                            }}>
                                {scrapeErrors.map((e, i) => <span key={i}>{e}</span>)}
                            </div>
                        )}

                        {/* Review textarea */}
                        {extractedText !== null && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    fontSize: "0.68rem", fontWeight: 700,
                                    textTransform: "uppercase", letterSpacing: "0.07em",
                                    color: "var(--text-muted)",
                                }}>
                                    <BookOpen size={11} />
                                    Revisa y corrige el contenido extraído
                                </div>
                                <textarea
                                    className="textarea"
                                    value={extractedText}
                                    onChange={(e) => { setExtractedText(e.target.value); setContextSaved(false); }}
                                    style={{ minHeight: "280px", fontFamily: "monospace", fontSize: "0.78rem", lineHeight: 1.75, resize: "vertical" }}
                                />
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    Puedes editar, corregir o agregar información antes de guardar.
                                </p>
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <button className="btn-primary" onClick={handleSaveContext} disabled={contextSaving || !extractedText.trim()}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "7px",
                                            minWidth: "240px", justifyContent: "center",
                                            ...(contextSaved
                                                ? { background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.2)" }
                                                : {}),
                                        }}>
                                        {contextSaving
                                            ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                                            : contextSaved
                                                ? <><Check size={13} /> ¡Guardado en la Base de Conocimiento!</>
                                                : <><Database size={13} /> Guardar en la Base de Conocimiento</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Current context preview */}
                        {currentContext && extractedText === null && (
                            <div>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    marginBottom: "8px", fontSize: "0.65rem",
                                    fontWeight: 700, textTransform: "uppercase",
                                    letterSpacing: "0.07em", color: "var(--text-muted)",
                                }}>
                                    <BookOpen size={11} />
                                    Conocimiento actual del bot
                                </div>
                                <div style={{
                                    padding: "12px 14px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                                    fontSize: "0.75rem", lineHeight: 1.7, color: "var(--text-secondary)",
                                    maxHeight: "130px", overflowY: "auto", fontFamily: "monospace",
                                }}>
                                    {currentContext.slice(0, 500)}
                                    {currentContext.length > 500 && <span style={{ color: "var(--text-muted)" }}> …</span>}
                                </div>
                                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                                    Este texto se inyecta automáticamente en el prompt del bot en cada conversación.
                                </p>
                            </div>
                        )}

                        {!currentContext && extractedText === null && !scraping && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Ingresa una o más URLs (inicio, servicios, FAQ…), extrae la información,
                                revísala y guárdala para que el bot aprenda sobre tu empresa.
                            </p>
                        )}
                    </div>
                </AccordionSection>

                {/* ═══ SECTION 4: Preguntas Frecuentes ═══ */}
                <AccordionSection
                    id="faq"
                    icon={<HelpCircle size={17} />}
                    title="Preguntas Frecuentes (FAQ)"
                    subtitle="Respuestas rápidas que el bot usará automáticamente"
                    badge={faqBadge}
                    isOpen={openSections.has("faq")}
                    onToggle={toggleSection}
                >
                    <div className="space-y-4">
                        {/* FAQ list */}
                        {faqLoading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                            </div>
                        ) : faqs.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {faqs.map((faq) => {
                                    const isEditing = editingFaqId === faq.id;
                                    return (
                                        <div key={faq.id} style={{
                                            padding: "12px 14px", borderRadius: "10px",
                                            background: "rgba(255,255,255,0.02)",
                                            border: isEditing ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                            transition: "all 0.15s ease",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                                <div style={{ flexShrink: 0, marginTop: "2px", color: "var(--text-muted)" }}>
                                                    <GripVertical size={14} style={{ opacity: 0.3 }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {isEditing ? (
                                                        <div className="space-y-2">
                                                            <input className="input" value={faq.question}
                                                                onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                                                                placeholder="Pregunta..." style={{ fontSize: "0.8rem" }} />
                                                            <textarea className="textarea" value={faq.answer}
                                                                onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                                                                placeholder="Respuesta..." rows={2}
                                                                style={{ fontSize: "0.8rem", resize: "vertical" }} />
                                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                                                                <button onClick={() => saveFaqEdit(faq.id)} className="btn-primary"
                                                                    style={{ padding: "6px 14px", fontSize: "0.75rem" }}>
                                                                    <Check size={12} /> Guardar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                                                                {faq.question}
                                                            </div>
                                                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                                                {faq.answer}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                {!isEditing && (
                                                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                                        <button onClick={() => setEditingFaqId(faq.id)} title="Editar"
                                                            style={{
                                                                padding: "5px", borderRadius: "6px",
                                                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                                                                color: "var(--text-muted)", cursor: "pointer",
                                                                display: "flex", alignItems: "center", transition: "all 0.15s ease",
                                                            }}>
                                                            <MessageSquare size={12} />
                                                        </button>
                                                        <button onClick={() => removeFaq(faq.id)} title="Eliminar"
                                                            style={{
                                                                padding: "5px", borderRadius: "6px",
                                                                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                                                                color: "#f87171", cursor: "pointer",
                                                                display: "flex", alignItems: "center", transition: "all 0.15s ease",
                                                            }}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{
                                padding: "20px", textAlign: "center", borderRadius: "10px",
                                background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
                            }}>
                                <HelpCircle size={20} style={{ margin: "0 auto 8px", opacity: 0.3, color: "var(--text-muted)" }} />
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    Aún no tienes preguntas frecuentes. Agrega la primera abajo.
                                </p>
                            </div>
                        )}

                        {/* Add new FAQ */}
                        <div style={{
                            padding: "14px", borderRadius: "10px",
                            background: "rgba(59,130,246,0.03)", border: "1px solid rgba(59,130,246,0.1)",
                        }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                marginBottom: "10px", fontSize: "0.68rem",
                                fontWeight: 700, textTransform: "uppercase",
                                letterSpacing: "0.07em", color: "var(--text-muted)",
                            }}>
                                <Plus size={11} />
                                Agregar nueva pregunta
                            </div>
                            <div className="space-y-2">
                                <input className="input" value={faqDraft.question}
                                    onChange={(e) => setFaqDraft(prev => ({ ...prev, question: e.target.value }))}
                                    placeholder="Ej: ¿Cuál es el horario de atención?" style={{ fontSize: "0.8rem" }} />
                                <textarea className="textarea" value={faqDraft.answer}
                                    onChange={(e) => setFaqDraft(prev => ({ ...prev, answer: e.target.value }))}
                                    placeholder="Ej: Nuestro horario es de Lunes a Viernes, 9:00 a 19:00 hrs."
                                    rows={2} style={{ fontSize: "0.8rem", resize: "vertical" }} />
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <button onClick={addFaq} className="btn-primary"
                                        disabled={!faqDraft.question.trim() || !faqDraft.answer.trim() || faqSaving}
                                        style={{ padding: "8px 16px", fontSize: "0.78rem" }}>
                                        {faqSaving
                                            ? <><Loader2 size={12} className="animate-spin" /> Guardando…</>
                                            : faqSaved
                                                ? <><Check size={12} /> ¡Guardado!</>
                                                : <><Plus size={12} /> Agregar FAQ</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Estas preguntas se inyectan automáticamente en el contexto del bot.
                            Cuando un cliente pregunte algo similar, el agente usará estas respuestas.
                        </p>
                    </div>
                </AccordionSection>

                {/* ═══ SECTION 5: Config. Avanzada ═══ */}
                <AccordionSection
                    id="advanced"
                    icon={<Settings2 size={17} />}
                    title="Configuración Avanzada"
                    subtitle="Modelo de IA, creatividad y link de agenda"
                    badge={advancedBadge}
                    isOpen={openSections.has("advanced")}
                    onToggle={toggleSection}
                >
                    <div className="space-y-5">
                        {/* Model + Temperature grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">
                                    <SlidersHorizontal size={11} className="inline mr-1" />
                                    Modelo de IA
                                </label>
                                <select className="select" value={model} onChange={e => setModel(e.target.value)}>
                                    <option value="gpt-4o-mini">GPT-4o Mini (rápido y económico)</option>
                                    <option value="gpt-4o">GPT-4o (más inteligente)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo (máxima capacidad)</option>
                                </select>
                                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                    GPT-4o Mini es ideal para la mayoría de negocios.
                                </p>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Estilo de Respuesta</label>
                                <input type="range" min="0" max="1" step="0.1" value={temperature}
                                    onChange={e => setTemperature(parseFloat(e.target.value))}
                                    style={{ width: "100%", marginTop: "8px", accentColor: "#3b82f6" }} />
                                <div className="flex justify-between mt-1" style={{ color: "var(--text-muted)", fontSize: "0.65rem", fontWeight: 500 }}>
                                    <span>Preciso y directo</span>
                                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                                        {temperature <= 0.3 ? "Muy preciso" : temperature <= 0.5 ? "Equilibrado" : temperature <= 0.7 ? "Conversacional" : "Muy creativo"}
                                    </span>
                                    <span>Creativo y variado</span>
                                </div>
                                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                    Para ventas, recomendamos entre 0.5 y 0.7.
                                </p>
                            </div>
                        </div>

                        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

                        {/* Booking URL */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">
                                <CalendarCheck size={11} className="inline mr-1" />
                                Link de Agenda (Cal.com / Calendly)
                            </label>
                            <input className="input" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)}
                                placeholder="https://cal.com/tu-empresa/reunion" />
                            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                                El agente compartirá este link cuando un cliente quiera agendar una reunión o cita.
                            </p>
                        </div>
                    </div>
                </AccordionSection>

            </div>

            {/* ── Floating save button ── */}
            <AnimatePresence>
                {showFloatingSave && (
                    <motion.button
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary"
                        style={{
                            position: "fixed",
                            bottom: "28px",
                            right: "28px",
                            zIndex: 50,
                            minWidth: "170px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            justifyContent: "center",
                        }}
                    >
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</>
                            : saved ? <><CheckCircle size={14} /> ¡Guardado!</>
                                : <><Save size={14} /> Guardar Cambios</>}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

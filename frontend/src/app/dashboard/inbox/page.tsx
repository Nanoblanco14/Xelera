"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, Search, Send, Loader2, Bot, User,
    Phone, Clock, PauseCircle, PlayCircle, AlertTriangle,
    ChevronRight, Inbox as InboxIcon, Zap, Plus, X,
    StickyNote, Trash2, Hash, Timer, CheckCheck, Filter,
    FileText, Eye,
} from "lucide-react";

interface LeadNote {
    id: string;
    content: string;
    author_email: string;
    created_at: string;
}

// ── Types ─────────────────────────────────────────────────
interface Conversation {
    lead_id: string;
    name: string;
    phone: string;
    chat_status: string | null;
    is_bot_paused: boolean;
    stage_name: string;
    stage_color: string | null;
    message_count: number;
    last_message: {
        content: string;
        role: string;
        created_at: string;
    } | null;
    created_at: string;
    last_activity: string;
}

interface ChatMessage {
    id: string;
    lead_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

interface SearchResult {
    lead_id: string;
    name: string;
    phone: string;
    stage_name: string;
    stage_color: string | null;
    is_bot_paused: boolean;
    match_type: "both" | "contact" | "message";
    snippets: { content: string; role: string; created_at: string }[];
    snippet_count: number;
}

// ── Helpers ───────────────────────────────────────────────
function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

// ── Main Page ─────────────────────────────────────────────
export default function InboxPage() {
    const { organization, userEmail } = useOrg();
    const searchParams = useSearchParams();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Quick reply templates ──────────────────────────────
    const DEFAULT_TEMPLATES = [
        "¡Hola! Un momento, te atiendo personalmente.",
        "Gracias por tu interés, te comparto más información.",
        "¿Podrías indicarme tu disponibilidad para una visita?",
        "Te envío los detalles por este medio.",
        "Perfecto, quedo atento a tu respuesta.",
    ];
    const storageKey = `inbox_templates_${organization.id}`;
    const [templates, setTemplates] = useState<string[]>(() => {
        if (typeof window === "undefined") return DEFAULT_TEMPLATES;
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
        } catch {
            return DEFAULT_TEMPLATES;
        }
    });
    const [showTemplates, setShowTemplates] = useState(false);
    const [newTemplate, setNewTemplate] = useState("");
    const [addingTemplate, setAddingTemplate] = useState(false);

    // ── WhatsApp templates (Meta) ───────────────────────────
    const [showWaTemplates, setShowWaTemplates] = useState(false);
    const [waTemplates, setWaTemplates] = useState<Array<{
        id: string; name: string; status: string; category: string;
        language: string; components: Array<Record<string, unknown>>;
    }>>([]);
    const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
    const [waSelectedTemplate, setWaSelectedTemplate] = useState<string | null>(null);
    const [waParams, setWaParams] = useState<string[]>([]);
    const [waSending, setWaSending] = useState(false);

    // ── Internal notes ─────────────────────────────────
    const [showNotes, setShowNotes] = useState(false);
    const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [newNoteText, setNewNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    // ── Filters & typing ─────────────────────────────
    const [convoFilter, setConvoFilter] = useState<"all" | "bot_active" | "bot_paused" | "unread">("all");
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveTemplates = (updated: string[]) => {
        setTemplates(updated);
        try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    };
    const addTemplate = () => {
        const t = newTemplate.trim();
        if (!t || templates.includes(t)) return;
        saveTemplates([...templates, t]);
        setNewTemplate("");
        setAddingTemplate(false);
    };
    const removeTemplate = (idx: number) => {
        saveTemplates(templates.filter((_, i) => i !== idx));
    };
    const useTemplate = (text: string) => {
        setNewMessage(text);
        setShowTemplates(false);
        inputRef.current?.focus();
    };

    // ── WhatsApp template functions ──────────────────────
    const fetchWaTemplates = useCallback(async () => {
        setWaTemplatesLoading(true);
        try {
            const res = await fetch("/api/whatsapp/templates");
            if (res.ok) {
                const { templates: tpls } = await res.json();
                setWaTemplates(tpls || []);
            }
        } catch { /* silent */ }
        setWaTemplatesLoading(false);
    }, []);

    const openWaTemplateModal = () => {
        setShowWaTemplates(true);
        setWaSelectedTemplate(null);
        setWaParams([]);
        if (waTemplates.length === 0) fetchWaTemplates();
    };

    const getTemplateVarCount = (tpl: typeof waTemplates[0]): number => {
        const bodyComp = tpl.components.find((c: Record<string, unknown>) => c.type === "BODY") as Record<string, unknown> | undefined;
        if (!bodyComp?.text) return 0;
        const matches = (bodyComp.text as string).match(/\{\{\d+\}\}/g);
        return matches ? matches.length : 0;
    };

    const getTemplateBodyText = (tpl: typeof waTemplates[0]): string => {
        const bodyComp = tpl.components.find((c: Record<string, unknown>) => c.type === "BODY") as Record<string, unknown> | undefined;
        return (bodyComp?.text as string) || "";
    };

    const sendWaTemplate = async () => {
        if (!selectedLeadId || !waSelectedTemplate) return;
        setWaSending(true);
        try {
            const tpl = waTemplates.find(t => t.name === waSelectedTemplate);
            const res = await fetch("/api/whatsapp/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lead_id: selectedLeadId,
                    template_name: waSelectedTemplate,
                    template_language: tpl?.language || "es",
                    parameters: waParams.filter(p => p.trim()),
                }),
            });
            if (res.ok) {
                // Add local message for instant feedback
                const localMsg: ChatMessage = {
                    id: `temp-wa-${Date.now()}`,
                    lead_id: selectedLeadId,
                    role: "assistant",
                    content: `[Template: ${waSelectedTemplate}]${waParams.length ? " — " + waParams.join(", ") : ""}`,
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, localMsg]);
                setShowWaTemplates(false);
                setWaSelectedTemplate(null);
                setWaParams([]);
            }
        } catch (err) {
            console.error("Send WA template failed:", err);
            setError("No se pudo enviar el template de WhatsApp. Intenta de nuevo.");
        }
        setWaSending(false);
    };

    // ── Notes functions ───────────────────────────────────
    const fetchLeadNotes = useCallback(async (leadId: string) => {
        setNotesLoading(true);
        try {
            const res = await fetch(`/api/leads/${leadId}/notes?org_id=${organization.id}`);
            const { data } = await res.json();
            setLeadNotes(data || []);
        } catch (err) {
            console.error("Failed to load notes:", err);
            setError("No se pudieron cargar las notas. Intenta de nuevo.");
        }
        setNotesLoading(false);
    }, [organization.id]);

    const handleAddNote = async () => {
        if (!selectedLeadId || !newNoteText.trim() || savingNote) return;
        setSavingNote(true);
        try {
            const res = await fetch(`/api/leads/${selectedLeadId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    org_id: organization.id,
                    content: newNoteText.trim(),
                    author_email: userEmail || "",
                }),
            });
            const { data } = await res.json();
            if (data) {
                setLeadNotes((prev) => [data, ...prev]);
                setNewNoteText("");
            }
        } catch (err) {
            console.error("Failed to add note:", err);
            setError("No se pudo guardar la nota. Intenta de nuevo.");
        }
        setSavingNote(false);
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!selectedLeadId) return;
        try {
            await fetch(`/api/leads/${selectedLeadId}/notes?note_id=${noteId}`, {
                method: "DELETE",
            });
            setLeadNotes((prev) => prev.filter((n) => n.id !== noteId));
        } catch (err) {
            console.error("Failed to delete note:", err);
            setError("No se pudo eliminar la nota. Intenta de nuevo.");
        }
    };

    // ── Debounced deep search ─────────────────────────────
    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!val.trim() || val.trim().length < 2) {
            setSearchResults(null);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/inbox/search?org_id=${organization.id}&q=${encodeURIComponent(val.trim())}`
                );
                const json = await res.json();
                if (json.data) setSearchResults(json.data);
            } catch (err) {
                console.error("Search failed:", err);
                setSearchResults(null);
            }
            setSearchLoading(false);
        }, 400);
    };

    // ── Load conversations ────────────────────────────────
    const loadConversations = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`/api/inbox?org_id=${organization.id}`);
            const { data } = await res.json();
            if (data) setConversations(data);
        } catch (err) {
            console.error("Failed to load inbox:", err);
            setError("No se pudieron cargar las conversaciones. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Auto-seleccionar lead si viene desde query param (?lead=uuid)
    useEffect(() => {
        const leadParam = searchParams.get("lead");
        if (leadParam && !selectedLeadId && conversations.length > 0) {
            const found = conversations.find((c) => c.lead_id === leadParam);
            if (found) setSelectedLeadId(found.lead_id);
        }
    }, [searchParams, conversations, selectedLeadId]);

    // ── Load messages for selected lead ───────────────────
    const loadMessages = useCallback(async (leadId: string) => {
        setMessagesLoading(true);
        try {
            const res = await fetch(`/api/pipeline/leads/${leadId}/messages`);
            const { data } = await res.json();
            if (data) setMessages(data);
        } catch (err) {
            console.error("Failed to load messages:", err);
            setError("No se pudieron cargar los mensajes. Intenta de nuevo.");
        }
        setMessagesLoading(false);
    }, []);

    useEffect(() => {
        if (selectedLeadId) {
            loadMessages(selectedLeadId);
            fetchLeadNotes(selectedLeadId);
            setShowNotes(false);
            setNewNoteText("");
        }
    }, [selectedLeadId, loadMessages, fetchLeadNotes]);

    // ── Auto-scroll to bottom ─────────────────────────────
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // ── Supabase Realtime for new messages ─────────────────
    useEffect(() => {
        const channel = supabase
            .channel("inbox-messages")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "lead_messages",
                },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    // If it's for the selected conversation, add it
                    if (newMsg.lead_id === selectedLeadId) {
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                        // Typing indicator logic
                        if (newMsg.role === "user") {
                            setIsTyping(true);
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 4000);
                        } else if (newMsg.role === "assistant") {
                            setIsTyping(false);
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        }
                    }
                    loadConversations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedLeadId, loadConversations]);

    // ── Toggle bot pause ──────────────────────────────────
    const toggleBotPause = async (leadId: string, currentPaused: boolean) => {
        try {
            // Use API route for reliable update (bypasses RLS issues)
            const res = await fetch(`/api/pipeline/leads/${leadId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_bot_paused: !currentPaused }),
            });

            if (res.ok) {
                setConversations((prev) =>
                    prev.map((c) =>
                        c.lead_id === leadId
                            ? { ...c, is_bot_paused: !currentPaused }
                            : c
                    )
                );
            } else {
                const err = await res.json().catch(() => ({}));
                console.error("Toggle bot pause failed:", err);
                setError("No se pudo cambiar el estado del bot. Intenta de nuevo.");
            }
        } catch (err) {
            console.error("Toggle bot pause failed:", err);
            setError("No se pudo cambiar el estado del bot. Intenta de nuevo.");
        }
    };

    // ── Send human message ────────────────────────────────
    const handleSend = async () => {
        if (!newMessage.trim() || !selectedLeadId || sending) return;
        setSending(true);
        try {
            const res = await fetch("/api/inbox/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead_id: selectedLeadId, message: newMessage }),
            });
            const { data } = await res.json();
            if (data?.success) {
                // Add message locally for instant feedback
                const localMsg: ChatMessage = {
                    id: `temp-${Date.now()}`,
                    lead_id: selectedLeadId,
                    role: "assistant",
                    content: newMessage,
                    created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, localMsg]);
                setNewMessage("");

                // Update conversation's bot paused state
                setConversations((prev) =>
                    prev.map((c) =>
                        c.lead_id === selectedLeadId
                            ? { ...c, is_bot_paused: true }
                            : c
                    )
                );

                inputRef.current?.focus();
            }
        } catch (err) {
            console.error("Send message failed:", err);
            setError("No se pudo enviar el mensaje. Intenta de nuevo.");
        }
        setSending(false);
    };

    // ── Filter conversations ──────────────────────────────
    const isDeepSearch = searchQuery.trim().length >= 2 && searchResults !== null;
    const filtered = (() => {
        let list = isDeepSearch
            ? conversations.filter((c) => searchResults.some((r) => r.lead_id === c.lead_id))
            : conversations.filter((c) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.content.toLowerCase().includes(q);
              });
        if (convoFilter === "bot_active") list = list.filter(c => !c.is_bot_paused);
        if (convoFilter === "bot_paused") list = list.filter(c => c.is_bot_paused);
        if (convoFilter === "unread") list = list.filter(c => c.last_message?.role === "user");
        return list;
    })();

    // Get search result for a specific lead (for snippets display)
    const getSearchResult = (leadId: string) =>
        searchResults?.find((r) => r.lead_id === leadId) || null;

    const selectedConvo = conversations.find((c) => c.lead_id === selectedLeadId);

    // ── Group messages by date ────────────────────────────
    const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
        const msgDate = formatDate(msg.created_at);
        if (msgDate !== currentDate) {
            currentDate = msgDate;
            groupedMessages.push({ date: msgDate, messages: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    }

    return (
        <div className="animate-in" style={{ height: "calc(100vh - 110px)" }}>

            {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", margin: "0 0 12px 0", color: "#f87171", fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* ── Header ── */}
            <div className="page-header" style={{ marginBottom: "16px" }}>
                <div>
                    <h1 className="page-title">Inbox</h1>
                    <p className="page-subtitle">
                        Conversaciones de WhatsApp en tiempo real
                    </p>
                </div>
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    fontSize: "0.78rem", color: "var(--text-muted)",
                }}>
                    <div style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.5)",
                        animation: "pulseGlow 2s ease-in-out infinite",
                    }} />
                    En vivo
                </div>
            </div>

            {/* ── Main layout: sidebar + chat ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "360px 1fr",
                gap: "0",
                height: "calc(100% - 70px)",
                borderRadius: "14px",
                overflow: "hidden",
                border: "0.5px solid rgba(255,255,255,0.055)",
                background: "var(--bg-card)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.15)",
            }}>

                {/* ── Conversation List ── */}
                <div style={{
                    borderRight: "0.5px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    background: "linear-gradient(180deg, #1a1a18 0%, #141413 100%)",
                    overflow: "hidden",
                    minHeight: 0,
                }}>
                    {/* Search */}
                    <div style={{
                        padding: "12px",
                        borderBottom: "1px solid transparent",
                        borderImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent) 1",
                    }}>
                        <div style={{ position: "relative" }}>
                            <Search size={14} style={{
                                position: "absolute", left: "10px", top: "50%",
                                transform: "translateY(-50%)", color: "var(--text-muted)",
                                pointerEvents: "none",
                            }} />
                            <input
                                className="input"
                                placeholder="Buscar en conversaciones y mensajes..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                style={{
                                    paddingLeft: "32px",
                                    fontSize: "0.8rem",
                                    background: "rgba(255,255,255,0.03)",
                                    backdropFilter: "blur(12px)",
                                    border: "0.5px solid rgba(255,255,255,0.06)",
                                    borderRadius: "10px",
                                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(122,158,138,0.35)";
                                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122,158,138,0.08), 0 0 20px rgba(122,158,138,0.06)";
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                        </div>
                    </div>

                    {/* Filter pills */}
                    <div style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid transparent",
                        borderImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent) 1",
                        display: "flex", gap: "4px",
                        overflowX: "auto",
                    }}>
                        {([
                            { key: "all" as const, label: "Todas", count: conversations.length },
                            { key: "bot_active" as const, label: "Bot", count: conversations.filter(c => !c.is_bot_paused).length },
                            { key: "bot_paused" as const, label: "Humano", count: conversations.filter(c => c.is_bot_paused).length },
                            { key: "unread" as const, label: "Sin leer", count: conversations.filter(c => c.last_message?.role === "user").length },
                        ]).map(f => (
                            <button key={f.key} onClick={() => setConvoFilter(f.key)}
                                style={{
                                    padding: "3px 10px", borderRadius: "100px",
                                    fontSize: "0.65rem", fontWeight: 600,
                                    background: convoFilter === f.key ? "rgba(122,158,138,0.1)" : "transparent",
                                    border: convoFilter === f.key ? "0.5px solid rgba(122,158,138,0.25)" : "0.5px solid transparent",
                                    color: convoFilter === f.key ? "#9ab8a8" : "var(--text-muted)",
                                    cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
                                }}>
                                {f.label} <span style={{ opacity: 0.5 }}>{f.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Search status */}
                    {searchLoading && (
                        <div style={{
                            padding: "6px 12px",
                            borderBottom: "0.5px solid var(--border)",
                            display: "flex", alignItems: "center", gap: "6px",
                            fontSize: "0.7rem", color: "var(--text-muted)",
                        }}>
                            <Loader2 size={11} className="animate-spin" />
                            Buscando en mensajes...
                        </div>
                    )}
                    {isDeepSearch && !searchLoading && (
                        <div style={{
                            padding: "6px 12px",
                            borderBottom: "0.5px solid var(--border)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            fontSize: "0.7rem", color: "var(--text-muted)",
                        }}>
                            <span>
                                {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""} en conversaciones
                            </span>
                            <button
                                onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                                style={{
                                    background: "none", border: "none",
                                    color: "var(--accent-light)", cursor: "pointer",
                                    fontSize: "0.7rem", fontWeight: 600,
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                    )}

                    {/* List */}
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{
                                padding: "48px 20px", textAlign: "center",
                                color: "var(--text-muted)",
                                background: "radial-gradient(ellipse at center, rgba(122,158,138,0.03) 0%, transparent 70%)",
                            }}>
                                <InboxIcon size={28} style={{ margin: "0 auto 12px", opacity: 0.25 }} />
                                <p style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                                    {searchQuery ? "Sin resultados" : "No hay conversaciones aún"}
                                </p>
                                <p style={{ fontSize: "0.72rem", marginTop: "4px" }}>
                                    Las conversaciones de WhatsApp aparecerán aquí
                                </p>
                            </div>
                        ) : (
                            filtered.map((convo) => {
                                const isSelected = selectedLeadId === convo.lead_id;
                                return (
                                    <button
                                        key={convo.lead_id}
                                        onClick={() => setSelectedLeadId(convo.lead_id)}
                                        style={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: "10px",
                                            padding: "10px 12px",
                                            margin: "2px 6px",
                                            borderRadius: "10px",
                                            background: isSelected
                                                ? "linear-gradient(90deg, rgba(122,158,138,0.12) 0%, rgba(122,158,138,0.04) 100%)"
                                                : "transparent",
                                            border: "none",
                                            borderLeft: isSelected
                                                ? "3px solid #7a9e8a"
                                                : "3px solid transparent",
                                            boxShadow: isSelected
                                                ? "0 0 12px rgba(122,158,138,0.06), inset 0 0 0 0.5px rgba(122,158,138,0.12)"
                                                : "none",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                            position: "relative" as const,
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "rgba(255,255,255,0.04)";
                                                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                                    "inset 0 0 0 0.5px rgba(255,255,255,0.06)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "transparent";
                                                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                                    "none";
                                            }
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            flexShrink: 0, width: "38px", height: "38px",
                                            borderRadius: "10px",
                                            background: isSelected
                                                ? "linear-gradient(135deg, rgba(122,158,138,0.2) 0%, rgba(122,158,138,0.08) 100%)"
                                                : "rgba(255,255,255,0.04)",
                                            border: isSelected
                                                ? "0.5px solid rgba(122,158,138,0.25)"
                                                : "0.5px solid rgba(255,255,255,0.06)",
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center",
                                            color: isSelected ? "#9ab8a8" : "var(--text-muted)",
                                            fontSize: "0.75rem", fontWeight: 700,
                                            transition: "all 0.2s ease",
                                        }}>
                                            {convo.name[0]?.toUpperCase() || "?"}
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                marginBottom: "3px",
                                            }}>
                                                <span style={{
                                                    fontSize: "0.82rem",
                                                    fontWeight: 600,
                                                    color: isSelected
                                                        ? "var(--text-primary)"
                                                        : "var(--text-secondary)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: "160px",
                                                }}>
                                                    {convo.name}
                                                </span>
                                                <span style={{
                                                    fontSize: "0.65rem",
                                                    color: "var(--text-muted)",
                                                    flexShrink: 0,
                                                }}>
                                                    {convo.last_message
                                                        ? timeAgo(convo.last_message.created_at)
                                                        : ""}
                                                </span>
                                            </div>
                                            {/* Show search snippets or last message */}
                                            {isDeepSearch && getSearchResult(convo.lead_id)?.snippets?.length ? (
                                                <div style={{
                                                    fontSize: "0.7rem",
                                                    color: "#93c5fd",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: "240px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "3px",
                                                }}>
                                                    <Search size={9} style={{ flexShrink: 0 }} />
                                                    {getSearchResult(convo.lead_id)!.snippets[0].content}
                                                </div>
                                            ) : (
                                                <div style={{
                                                    fontSize: "0.72rem",
                                                    color: "var(--text-dim)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: "240px",
                                                    letterSpacing: "0.01em",
                                                    lineHeight: 1.4,
                                                }}>
                                                    {convo.last_message?.role === "assistant" && (
                                                        <Bot size={10} style={{
                                                            display: "inline", marginRight: "4px",
                                                            verticalAlign: "middle",
                                                            opacity: 0.5,
                                                        }} />
                                                    )}
                                                    {convo.last_message?.content || "Sin mensajes"}
                                                </div>
                                            )}
                                            {/* Tags */}
                                            <div style={{
                                                display: "flex", gap: "4px",
                                                marginTop: "5px", flexWrap: "wrap",
                                            }}>
                                                {convo.is_bot_paused && (
                                                    <span style={{
                                                        padding: "1px 6px",
                                                        borderRadius: "100px",
                                                        fontSize: "0.6rem",
                                                        fontWeight: 600,
                                                        background: "rgba(245,158,11,0.1)",
                                                        color: "#f59e0b",
                                                        border: "0.5px solid rgba(245,158,11,0.2)",
                                                    }}>
                                                        Humano
                                                    </span>
                                                )}
                                                <span style={{
                                                    padding: "1px 6px",
                                                    borderRadius: "100px",
                                                    fontSize: "0.6rem",
                                                    fontWeight: 500,
                                                    background: convo.stage_color
                                                        ? `${convo.stage_color}14`
                                                        : "rgba(255,255,255,0.04)",
                                                    color: convo.stage_color || "var(--text-muted)",
                                                    border: `0.5px solid ${convo.stage_color ? convo.stage_color + "30" : "rgba(255,255,255,0.06)"}`,
                                                }}>
                                                    {convo.stage_name}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Chat Panel ── */}
                <div style={{
                    display: "flex", flexDirection: "column",
                    background: "var(--bg-deep)",
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    overflow: "hidden",
                    minHeight: 0,
                }}>
                    {!selectedLeadId ? (
                        /* Empty state */
                        <div style={{
                            flex: 1, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            flexDirection: "column", gap: "16px",
                            color: "var(--text-muted)",
                            background: "radial-gradient(ellipse at center, rgba(122,158,138,0.04) 0%, transparent 70%)",
                        }}>
                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                style={{
                                    width: "72px", height: "72px", borderRadius: "20px",
                                    background: "linear-gradient(135deg, rgba(122,158,138,0.08) 0%, rgba(122,158,138,0.03) 100%)",
                                    border: "0.5px solid rgba(122,158,138,0.1)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    boxShadow: "0 0 40px rgba(122,158,138,0.06)",
                                }}
                            >
                                <MessageSquare size={32} style={{ opacity: 0.35, color: "#9ab8a8" }} />
                            </motion.div>
                            <p style={{
                                fontSize: "1.1rem", fontWeight: 500,
                                fontFamily: "'Playfair Display', serif",
                                color: "var(--text-secondary)",
                                letterSpacing: "-0.01em",
                            }}>
                                Selecciona una conversacion
                            </p>
                            <p style={{ fontSize: "0.73rem", maxWidth: "280px", textAlign: "center", lineHeight: 1.6, color: "var(--text-dim)" }}>
                                Elige un contacto de la lista para ver sus mensajes y gestionar la conversacion
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Chat header ── */}
                            <div style={{
                                borderBottom: "1px solid transparent",
                                borderImage: "linear-gradient(90deg, rgba(122,158,138,0.1), rgba(255,255,255,0.06), transparent) 1",
                                background: "rgba(14,14,13,0.8)",
                                backdropFilter: "blur(16px)",
                            }}>
                              {/* Row 1: Main info */}
                              <div style={{
                                padding: "12px 16px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {/* Avatar with status dot */}
                                    <div style={{ position: "relative" }}>
                                        <div style={{
                                            width: "40px", height: "40px",
                                            borderRadius: "12px",
                                            background: "linear-gradient(135deg, rgba(122,158,138,0.15) 0%, rgba(122,158,138,0.06) 100%)",
                                            border: "0.5px solid rgba(122,158,138,0.2)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "#9ab8a8", fontSize: "0.82rem", fontWeight: 700,
                                            boxShadow: "0 0 12px rgba(122,158,138,0.06)",
                                        }}>
                                            {selectedConvo?.name[0]?.toUpperCase() || "?"}
                                        </div>
                                        {/* Online/status dot */}
                                        <div style={{
                                            position: "absolute", bottom: "-2px", right: "-2px",
                                            width: "11px", height: "11px", borderRadius: "50%",
                                            background: selectedConvo?.is_bot_paused ? "#f59e0b" : "#22c55e",
                                            border: "2px solid var(--bg-deep)",
                                            boxShadow: selectedConvo?.is_bot_paused
                                                ? "0 0 6px rgba(245,158,11,0.3)"
                                                : "0 0 8px rgba(34,197,94,0.4)",
                                            animation: selectedConvo?.is_bot_paused ? "none" : "pulseGlow 2s ease-in-out infinite",
                                        }} />
                                    </div>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                                                {selectedConvo?.name || "Contacto"}
                                            </span>
                                            <span style={{
                                                padding: "1px 7px", borderRadius: "100px",
                                                fontSize: "0.58rem", fontWeight: 600,
                                                background: selectedConvo?.is_bot_paused ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
                                                color: selectedConvo?.is_bot_paused ? "#f59e0b" : "#22c55e",
                                                border: `0.5px solid ${selectedConvo?.is_bot_paused ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}`,
                                            }}>
                                                {selectedConvo?.is_bot_paused ? "Humano" : "Bot activo"}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: "6px",
                                            fontSize: "0.7rem", color: "var(--text-muted)",
                                        }}>
                                            <Phone size={10} />
                                            {selectedConvo?.phone}
                                            <span style={{ margin: "0 2px" }}>·</span>
                                            <span style={{
                                                padding: "0px 5px", borderRadius: "100px",
                                                fontSize: "0.6rem", fontWeight: 500,
                                                background: selectedConvo?.stage_color ? `${selectedConvo.stage_color}14` : "rgba(255,255,255,0.04)",
                                                color: selectedConvo?.stage_color || "var(--text-muted)",
                                            }}>
                                                {selectedConvo?.stage_name}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {/* Notes toggle */}
                                    <button
                                        onClick={() => setShowNotes(!showNotes)}
                                        title="Notas internas"
                                        style={{
                                            display: "flex", alignItems: "center", gap: "5px",
                                            padding: "7px 10px", borderRadius: "8px",
                                            fontSize: "0.72rem", fontWeight: 600,
                                            cursor: "pointer",
                                            border: showNotes
                                                ? "0.5px solid rgba(245,158,11,0.2)"
                                                : "0.5px solid rgba(255,255,255,0.06)",
                                            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                            background: showNotes
                                                ? "rgba(245,158,11,0.1)"
                                                : "rgba(255,255,255,0.04)",
                                            backdropFilter: "blur(8px)",
                                            color: showNotes ? "#f59e0b" : "var(--text-muted)",
                                            position: "relative" as const,
                                        }}
                                    >
                                        <StickyNote size={14} />
                                        {!showNotes && <span style={{
                                            opacity: 0.8,
                                            display: "none",
                                        }}>Notas</span>}
                                        {leadNotes.length > 0 && (
                                            <span style={{
                                                fontSize: "0.6rem",
                                                fontWeight: 700,
                                                background: "rgba(245,158,11,0.2)",
                                                color: "#f59e0b",
                                                padding: "0px 5px",
                                                borderRadius: "100px",
                                                minWidth: "16px",
                                                textAlign: "center" as const,
                                            }}>
                                                {leadNotes.length}
                                            </span>
                                        )}
                                    </button>

                                    {/* Bot toggle */}
                                    <button
                                        onClick={() =>
                                            selectedConvo &&
                                            toggleBotPause(selectedConvo.lead_id, selectedConvo.is_bot_paused)
                                        }
                                        title={
                                            selectedConvo?.is_bot_paused
                                                ? "Reactivar bot"
                                                : "Pausar bot (intervenir manualmente)"
                                        }
                                        style={{
                                            display: "flex", alignItems: "center", gap: "6px",
                                            padding: "7px 12px", borderRadius: "8px",
                                            fontSize: "0.72rem", fontWeight: 600,
                                            cursor: "pointer",
                                            backdropFilter: "blur(8px)",
                                            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                            ...(selectedConvo?.is_bot_paused
                                                ? {
                                                    background: "rgba(34,197,94,0.08)",
                                                    color: "#22c55e",
                                                    border: "0.5px solid rgba(34,197,94,0.15)",
                                                }
                                                : {
                                                    background: "rgba(245,158,11,0.08)",
                                                    color: "#f59e0b",
                                                    border: "0.5px solid rgba(245,158,11,0.15)",
                                                }),
                                        }}
                                    >
                                        {selectedConvo?.is_bot_paused ? (
                                            <>
                                                <PlayCircle size={14} /> Reactivar Bot
                                            </>
                                        ) : (
                                            <>
                                                <PauseCircle size={14} /> Pausar Bot
                                            </>
                                        )}
                                    </button>
                                </div>
                              </div>
                              {/* Row 2: Stats bar */}
                              <div style={{
                                  padding: "6px 16px",
                                  background: "rgba(255,255,255,0.015)",
                                  borderTop: "0.5px solid rgba(255,255,255,0.03)",
                                  display: "flex", alignItems: "center", gap: "16px",
                                  fontSize: "0.63rem", color: "var(--text-dim)",
                                  letterSpacing: "0.02em",
                              }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <Hash size={10} /> {messages.length} mensajes
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <Clock size={10} /> Inicio: {selectedConvo ? formatDate(selectedConvo.created_at) : ""}
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                      <Timer size={10} /> Ultimo: {selectedConvo ? timeAgo(selectedConvo.last_activity) : ""}
                                  </span>
                              </div>
                            </div>

                            {/* ── Bot paused banner ── */}
                            {selectedConvo?.is_bot_paused && (
                                <div style={{
                                    padding: "8px 16px",
                                    background: "linear-gradient(90deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)",
                                    borderBottom: "1px solid transparent",
                                    borderImage: "linear-gradient(90deg, rgba(245,158,11,0.15), transparent) 1",
                                    display: "flex", alignItems: "center", gap: "8px",
                                    fontSize: "0.74rem", color: "#f59e0b",
                                    backdropFilter: "blur(8px)",
                                }}>
                                    <AlertTriangle size={13} />
                                    Bot pausado — tú estás respondiendo como humano. Los mensajes del bot no se enviarán.
                                </div>
                            )}

                            {/* ── Notes panel ── */}
                            {showNotes && (
                                <div style={{
                                    borderBottom: "1px solid transparent",
                                    borderImage: "linear-gradient(90deg, rgba(245,158,11,0.1), rgba(255,255,255,0.04), transparent) 1",
                                    background: "rgba(245,158,11,0.015)",
                                    backdropFilter: "blur(12px)",
                                    maxHeight: "260px",
                                    display: "flex",
                                    flexDirection: "column",
                                }}>
                                    {/* Notes header */}
                                    <div style={{
                                        padding: "8px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        borderBottom: "0.5px solid rgba(245,158,11,0.1)",
                                    }}>
                                        <span style={{
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            color: "#f59e0b",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                        }}>
                                            <StickyNote size={11} />
                                            Notas Internas ({leadNotes.length})
                                        </span>
                                        <button
                                            onClick={() => setShowNotes(false)}
                                            style={{
                                                background: "none", border: "none",
                                                color: "var(--text-muted)", cursor: "pointer",
                                                padding: "2px",
                                            }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>

                                    {/* Add note input */}
                                    <div style={{
                                        padding: "8px 16px",
                                        display: "flex",
                                        gap: "6px",
                                        alignItems: "center",
                                        borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                                    }}>
                                        <input
                                            className="input"
                                            value={newNoteText}
                                            onChange={(e) => setNewNoteText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleAddNote();
                                            }}
                                            placeholder="Agregar nota..."
                                            style={{ flex: 1, fontSize: "0.75rem", padding: "6px 10px" }}
                                        />
                                        <button
                                            onClick={handleAddNote}
                                            disabled={!newNoteText.trim() || savingNote}
                                            style={{
                                                background: newNoteText.trim()
                                                    ? "rgba(245,158,11,0.1)"
                                                    : "rgba(255,255,255,0.03)",
                                                border: "0.5px solid " + (newNoteText.trim()
                                                    ? "rgba(245,158,11,0.2)"
                                                    : "rgba(255,255,255,0.06)"),
                                                color: newNoteText.trim() ? "#f59e0b" : "var(--text-muted)",
                                                borderRadius: "6px",
                                                padding: "6px 8px",
                                                cursor: newNoteText.trim() ? "pointer" : "default",
                                                display: "flex",
                                                alignItems: "center",
                                            }}
                                        >
                                            {savingNote ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <Send size={12} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Notes list */}
                                    <div style={{
                                        flex: 1,
                                        overflowY: "auto",
                                        padding: "6px 16px",
                                    }}>
                                        {notesLoading ? (
                                            <div style={{
                                                display: "flex", justifyContent: "center",
                                                padding: "12px",
                                            }}>
                                                <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                            </div>
                                        ) : leadNotes.length === 0 ? (
                                            <div style={{
                                                padding: "16px",
                                                textAlign: "center",
                                                color: "var(--text-muted)",
                                                fontSize: "0.72rem",
                                            }}>
                                                Sin notas. Escribe la primera nota interna.
                                            </div>
                                        ) : (
                                            leadNotes.map((note) => {
                                                const date = new Date(note.created_at);
                                                const timeStr = date.toLocaleString("es-CL", {
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                });
                                                return (
                                                    <div
                                                        key={note.id}
                                                        style={{
                                                            padding: "6px 10px",
                                                            borderRadius: "8px",
                                                            marginBottom: "4px",
                                                            background: "rgba(245,158,11,0.04)",
                                                            border: "0.5px solid rgba(245,158,11,0.08)",
                                                            display: "flex",
                                                            alignItems: "flex-start",
                                                            gap: "8px",
                                                        }}
                                                    >
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontSize: "0.73rem",
                                                                lineHeight: 1.4,
                                                                color: "var(--text-primary)",
                                                                wordBreak: "break-word",
                                                            }}>
                                                                {note.content}
                                                            </div>
                                                            <div style={{
                                                                fontSize: "0.6rem",
                                                                color: "var(--text-muted)",
                                                                marginTop: "2px",
                                                            }}>
                                                                {note.author_email ? `${note.author_email} · ` : ""}{timeStr}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteNote(note.id)}
                                                            title="Eliminar"
                                                            style={{
                                                                background: "none",
                                                                border: "none",
                                                                color: "var(--text-muted)",
                                                                cursor: "pointer",
                                                                padding: "2px",
                                                                flexShrink: 0,
                                                                opacity: 0.4,
                                                                transition: "opacity 0.15s",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.opacity = "1";
                                                                e.currentTarget.style.color = "#f87171";
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.opacity = "0.4";
                                                                e.currentTarget.style.color = "var(--text-muted)";
                                                            }}
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Messages ── */}
                            <div style={{
                                flex: 1, overflowY: "auto",
                                minHeight: 0,
                                padding: "20px 24px",
                                display: "flex", flexDirection: "column",
                                gap: "2px",
                            }}>
                                {messagesLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={{
                                        flex: 1, display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                        color: "var(--text-muted)", fontSize: "0.8rem",
                                    }}>
                                        Sin mensajes
                                    </div>
                                ) : (
                                    groupedMessages.map((group) => (
                                        <React.Fragment key={group.date}>
                                            {/* Date separator */}
                                            <div style={{
                                                textAlign: "center",
                                                margin: "16px 0 10px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                            }}>
                                                <div style={{ flex: 1, height: "0.5px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
                                                <span style={{
                                                    fontSize: "0.62rem",
                                                    fontWeight: 600,
                                                    color: "var(--text-dim)",
                                                    background: "rgba(255,255,255,0.03)",
                                                    backdropFilter: "blur(8px)",
                                                    padding: "3px 12px",
                                                    borderRadius: "100px",
                                                    border: "0.5px solid rgba(255,255,255,0.05)",
                                                    letterSpacing: "0.04em",
                                                    textTransform: "uppercase",
                                                }}>
                                                    {group.date}
                                                </span>
                                                <div style={{ flex: 1, height: "0.5px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
                                            </div>
                                            {group.messages.map((msg, msgIdx) => (
                                                <motion.div
                                                    key={msg.id}
                                                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: msgIdx < 3 ? msgIdx * 0.03 : 0 }}
                                                    style={{
                                                    display: "flex",
                                                    justifyContent: msg.role === "user" ? "flex-start" : "flex-end",
                                                    marginBottom: "4px",
                                                }}>
                                                    <div style={{
                                                        maxWidth: "70%",
                                                        padding: "9px 13px 6px",
                                                        borderRadius: msg.role === "user"
                                                            ? "4px 14px 14px 14px"
                                                            : "14px 4px 14px 14px",
                                                        background: msg.role === "user"
                                                            ? "rgba(255,255,255,0.05)"
                                                            : "linear-gradient(135deg, rgba(122,158,138,0.1) 0%, rgba(122,158,138,0.06) 100%)",
                                                        border: msg.role === "user"
                                                            ? "0.5px solid rgba(255,255,255,0.07)"
                                                            : "0.5px solid rgba(122,158,138,0.14)",
                                                        boxShadow: msg.role === "user"
                                                            ? "0 1px 3px rgba(0,0,0,0.15)"
                                                            : "0 1px 3px rgba(0,0,0,0.15), 0 0 8px rgba(122,158,138,0.04)",
                                                        backdropFilter: "blur(8px)",
                                                    }}>
                                                        <div style={{
                                                            fontSize: "0.8rem",
                                                            lineHeight: 1.55,
                                                            color: "var(--text-primary)",
                                                            whiteSpace: "pre-wrap",
                                                            wordBreak: "break-word",
                                                            letterSpacing: "0.005em",
                                                        }}>
                                                            {msg.content}
                                                        </div>
                                                        {/* Time + checkmarks footer */}
                                                        <div style={{
                                                            display: "flex", alignItems: "center",
                                                            justifyContent: "flex-end", gap: "4px",
                                                            marginTop: "3px",
                                                        }}>
                                                            <span style={{ fontSize: "0.55rem", color: "var(--text-dim)", letterSpacing: "0.02em" }}>
                                                                {formatTime(msg.created_at)}
                                                            </span>
                                                            {msg.role === "assistant" && (
                                                                <CheckCheck size={12} style={{ color: "#9ab8a8", opacity: 0.5 }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </React.Fragment>
                                    ))
                                )}
                                {/* Typing indicator */}
                                <AnimatePresence>
                                    {isTyping && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                            style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}
                                        >
                                            <div style={{
                                                padding: "10px 14px",
                                                borderRadius: "12px 4px 12px 12px",
                                                background: "rgba(122,158,138,0.08)",
                                                border: "0.5px solid rgba(122,158,138,0.12)",
                                                display: "flex", alignItems: "center", gap: "6px",
                                            }}>
                                                <Bot size={11} style={{ color: "#9ab8a8" }} />
                                                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                                                    {[0, 1, 2].map(i => (
                                                        <span key={i} style={{
                                                            width: "5px", height: "5px", borderRadius: "50%",
                                                            background: "#9ab8a8",
                                                            animation: `typingBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                                                        }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div ref={chatEndRef} />
                            </div>

                            {/* ── Quick reply templates ── */}
                            {selectedConvo?.is_bot_paused && showTemplates && (
                                <div style={{
                                    padding: "10px 16px",
                                    borderTop: "1px solid transparent",
                                    borderImage: "linear-gradient(90deg, transparent, rgba(122,158,138,0.12), transparent) 1",
                                    background: "rgba(122,158,138,0.02)",
                                    backdropFilter: "blur(12px)",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                }}>
                                    <div style={{
                                        display: "flex", alignItems: "center",
                                        justifyContent: "space-between", marginBottom: "8px",
                                    }}>
                                        <span style={{
                                            fontSize: "0.7rem", fontWeight: 600,
                                            color: "var(--text-muted)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}>
                                            Respuestas rapidas
                                        </span>
                                        <button
                                            onClick={() => setShowTemplates(false)}
                                            style={{
                                                background: "none", border: "none",
                                                color: "var(--text-muted)", cursor: "pointer",
                                                padding: "2px",
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div style={{
                                        display: "flex", flexWrap: "wrap", gap: "6px",
                                    }}>
                                        {templates.map((tpl, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: "flex", alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                <button
                                                    onClick={() => useTemplate(tpl)}
                                                    style={{
                                                        padding: "5px 10px",
                                                        borderRadius: "8px",
                                                        fontSize: "0.73rem",
                                                        fontWeight: 500,
                                                        background: "rgba(255,255,255,0.05)",
                                                        border: "0.5px solid rgba(255,255,255,0.08)",
                                                        color: "var(--text-secondary)",
                                                        cursor: "pointer",
                                                        transition: "all 0.15s ease",
                                                        maxWidth: "280px",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        textAlign: "left",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = "rgba(122,158,138,0.1)";
                                                        e.currentTarget.style.borderColor = "rgba(122,158,138,0.2)";
                                                        e.currentTarget.style.color = "#93c5fd";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                                        e.currentTarget.style.color = "var(--text-secondary)";
                                                    }}
                                                >
                                                    {tpl}
                                                </button>
                                                <button
                                                    onClick={() => removeTemplate(i)}
                                                    title="Eliminar plantilla"
                                                    style={{
                                                        background: "none", border: "none",
                                                        color: "var(--text-muted)", cursor: "pointer",
                                                        padding: "2px", opacity: 0.5,
                                                        transition: "opacity 0.15s",
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </div>
                                        ))}
                                        {/* Add new template */}
                                        {addingTemplate ? (
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "4px",
                                            }}>
                                                <input
                                                    className="input"
                                                    value={newTemplate}
                                                    onChange={(e) => setNewTemplate(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") addTemplate();
                                                        if (e.key === "Escape") setAddingTemplate(false);
                                                    }}
                                                    placeholder="Nuevo mensaje..."
                                                    style={{
                                                        fontSize: "0.73rem", padding: "5px 8px",
                                                        width: "200px",
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={addTemplate}
                                                    disabled={!newTemplate.trim()}
                                                    style={{
                                                        background: "rgba(122,158,138,0.1)",
                                                        border: "0.5px solid rgba(122,158,138,0.2)",
                                                        color: "#9ab8a8",
                                                        borderRadius: "6px",
                                                        padding: "4px 8px",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        opacity: newTemplate.trim() ? 1 : 0.4,
                                                    }}
                                                >
                                                    Guardar
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAddingTemplate(true)}
                                                style={{
                                                    padding: "5px 10px",
                                                    borderRadius: "8px",
                                                    fontSize: "0.73rem",
                                                    fontWeight: 500,
                                                    background: "none",
                                                    border: "1px dashed rgba(255,255,255,0.12)",
                                                    color: "var(--text-muted)",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                <Plus size={12} /> Agregar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Message input ── */}
                            <div style={{
                                padding: "14px 20px",
                                borderTop: "1px solid transparent",
                                borderImage: "linear-gradient(90deg, transparent, rgba(122,158,138,0.15), rgba(255,255,255,0.06), transparent) 1",
                                background: "rgba(14,14,13,0.85)",
                                backdropFilter: "blur(16px)",
                            }}>
                                <div style={{
                                    display: "flex", gap: "8px",
                                    alignItems: "center",
                                }}>
                                    {/* Templates toggle button */}
                                    {selectedConvo?.is_bot_paused && (
                                        <button
                                            onClick={() => setShowTemplates(!showTemplates)}
                                            title="Respuestas rapidas"
                                            style={{
                                                background: showTemplates
                                                    ? "rgba(122,158,138,0.1)"
                                                    : "rgba(255,255,255,0.05)",
                                                border: showTemplates
                                                    ? "0.5px solid rgba(122,158,138,0.2)"
                                                    : "0.5px solid rgba(255,255,255,0.08)",
                                                color: showTemplates ? "#9ab8a8" : "var(--text-muted)",
                                                borderRadius: "8px",
                                                padding: "8px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition: "all 0.15s ease",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Zap size={15} />
                                        </button>
                                    )}
                                    {/* WhatsApp template button — always visible */}
                                    <button
                                        onClick={openWaTemplateModal}
                                        title="Enviar plantilla WhatsApp"
                                        style={{
                                            background: showWaTemplates
                                                ? "rgba(34,197,94,0.1)"
                                                : "rgba(255,255,255,0.05)",
                                            border: showWaTemplates
                                                ? "0.5px solid rgba(34,197,94,0.2)"
                                                : "0.5px solid rgba(255,255,255,0.08)",
                                            color: showWaTemplates ? "#22c55e" : "var(--text-muted)",
                                            borderRadius: "8px",
                                            padding: "8px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.15s ease",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <FileText size={15} />
                                    </button>
                                    <input
                                        ref={inputRef}
                                        className="input"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder={
                                            selectedConvo?.is_bot_paused
                                                ? "Escribe un mensaje como humano..."
                                                : "Pausar bot primero para intervenir..."
                                        }
                                        disabled={!selectedConvo?.is_bot_paused}
                                        style={{
                                            flex: 1,
                                            fontSize: "0.82rem",
                                            opacity: selectedConvo?.is_bot_paused ? 1 : 0.5,
                                            borderRadius: "10px",
                                            background: "rgba(255,255,255,0.03)",
                                            border: "0.5px solid rgba(255,255,255,0.06)",
                                            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "rgba(122,158,138,0.3)";
                                            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122,158,138,0.06), 0 0 16px rgba(122,158,138,0.05)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={
                                            !newMessage.trim() ||
                                            sending ||
                                            !selectedConvo?.is_bot_paused
                                        }
                                        className="btn-primary"
                                        style={{
                                            padding: "9px 16px",
                                            minWidth: "auto",
                                            opacity:
                                                !newMessage.trim() || !selectedConvo?.is_bot_paused
                                                    ? 0.4
                                                    : 1,
                                            background: "linear-gradient(135deg, #7a9e8a 0%, #5d8270 100%)",
                                            border: "0.5px solid rgba(122,158,138,0.3)",
                                            borderRadius: "10px",
                                            boxShadow: newMessage.trim() && selectedConvo?.is_bot_paused
                                                ? "0 0 16px rgba(122,158,138,0.2), 0 2px 8px rgba(0,0,0,0.3)"
                                                : "none",
                                            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                        }}
                                    >
                                        {sending ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                    </button>
                                </div>
                                {!selectedConvo?.is_bot_paused && (
                                    <p style={{
                                        fontSize: "0.68rem",
                                        color: "var(--text-muted)",
                                        marginTop: "6px",
                                    }}>
                                        Haz clic en &quot;Pausar Bot&quot; para intervenir manualmente
                                        en esta conversación.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ═══ WhatsApp Template Modal ═══ */}
            <AnimatePresence>
                {showWaTemplates && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowWaTemplates(false)}
                        style={{
                            position: "fixed", inset: 0, zIndex: 60,
                            background: "rgba(0,0,0,0.6)",
                            backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center",
                            justifyContent: "center", padding: "24px",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card"
                            style={{
                                width: "100%", maxWidth: "520px",
                                maxHeight: "80vh", display: "flex",
                                flexDirection: "column", overflow: "hidden",
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                padding: "16px 20px",
                                borderBottom: "0.5px solid var(--border)",
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between",
                            }}>
                                <div>
                                    <h3 style={{
                                        fontSize: "0.95rem", fontWeight: 700,
                                        color: "var(--text-primary)",
                                    }}>
                                        Enviar Plantilla WhatsApp
                                    </h3>
                                    <p style={{
                                        fontSize: "0.72rem",
                                        color: "var(--text-muted)", marginTop: "2px",
                                    }}>
                                        Selecciona un template aprobado para enviar
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowWaTemplates(false)}
                                    style={{
                                        background: "none", border: "none",
                                        color: "var(--text-muted)", cursor: "pointer",
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{
                                flex: 1, overflowY: "auto", padding: "16px 20px",
                            }}>
                                {waTemplatesLoading ? (
                                    <div style={{
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center", padding: "32px",
                                    }}>
                                        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                    </div>
                                ) : waTemplates.filter(t => t.status === "APPROVED").length === 0 ? (
                                    <div style={{
                                        textAlign: "center", padding: "32px",
                                        color: "var(--text-muted)", fontSize: "0.82rem",
                                    }}>
                                        No hay templates aprobados disponibles
                                    </div>
                                ) : !waSelectedTemplate ? (
                                    /* ── Template list ── */
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {waTemplates
                                            .filter(t => t.status === "APPROVED")
                                            .map(tpl => (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => {
                                                        setWaSelectedTemplate(tpl.name);
                                                        const count = getTemplateVarCount(tpl);
                                                        setWaParams(Array(count).fill(""));
                                                    }}
                                                    style={{
                                                        padding: "12px 14px",
                                                        borderRadius: "10px",
                                                        background: "rgba(255,255,255,0.03)",
                                                        border: "0.5px solid rgba(255,255,255,0.06)",
                                                        cursor: "pointer",
                                                        textAlign: "left",
                                                        transition: "all 0.15s ease",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "6px",
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = "rgba(34,197,94,0.06)";
                                                        e.currentTarget.style.borderColor = "rgba(34,197,94,0.15)";
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                                    }}
                                                >
                                                    <div style={{
                                                        display: "flex", alignItems: "center",
                                                        justifyContent: "space-between",
                                                    }}>
                                                        <span style={{
                                                            fontSize: "0.82rem", fontWeight: 600,
                                                            color: "var(--text-primary)",
                                                        }}>
                                                            {tpl.name}
                                                        </span>
                                                        <div style={{
                                                            display: "flex", alignItems: "center", gap: "6px",
                                                        }}>
                                                            <span style={{
                                                                fontSize: "0.62rem", fontWeight: 600,
                                                                padding: "2px 7px", borderRadius: "6px",
                                                                background: tpl.category === "MARKETING"
                                                                    ? "rgba(122,158,138,0.1)"
                                                                    : "rgba(255,255,255,0.05)",
                                                                color: tpl.category === "MARKETING"
                                                                    ? "#9ab8a8"
                                                                    : "var(--text-muted)",
                                                                border: tpl.category === "MARKETING"
                                                                    ? "0.5px solid rgba(122,158,138,0.2)"
                                                                    : "0.5px solid rgba(255,255,255,0.08)",
                                                                textTransform: "uppercase",
                                                            }}>
                                                                {tpl.category}
                                                            </span>
                                                            <span style={{
                                                                fontSize: "0.62rem",
                                                                color: "var(--text-muted)",
                                                            }}>
                                                                {tpl.language}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--text-secondary)",
                                                        lineHeight: 1.4,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                    }}>
                                                        {getTemplateBodyText(tpl) || "Sin preview"}
                                                    </p>
                                                </button>
                                            ))}
                                    </div>
                                ) : (
                                    /* ── Selected template: preview + params ── */
                                    (() => {
                                        const tpl = waTemplates.find(t => t.name === waSelectedTemplate);
                                        if (!tpl) return null;
                                        const varCount = getTemplateVarCount(tpl);
                                        let bodyPreview = getTemplateBodyText(tpl);
                                        waParams.forEach((p, i) => {
                                            if (p.trim()) bodyPreview = bodyPreview.replace(`{{${i + 1}}}`, p);
                                        });
                                        return (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                                {/* Back button */}
                                                <button
                                                    onClick={() => { setWaSelectedTemplate(null); setWaParams([]); }}
                                                    style={{
                                                        background: "none", border: "none",
                                                        color: "var(--text-muted)", cursor: "pointer",
                                                        fontSize: "0.75rem", fontWeight: 500,
                                                        display: "flex", alignItems: "center", gap: "4px",
                                                        padding: 0,
                                                    }}
                                                >
                                                    ← Volver a la lista
                                                </button>

                                                {/* Template name */}
                                                <div style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                }}>
                                                    <span style={{
                                                        fontSize: "0.88rem", fontWeight: 700,
                                                        color: "var(--text-primary)",
                                                    }}>
                                                        {tpl.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "0.62rem", fontWeight: 600,
                                                        padding: "2px 8px", borderRadius: "6px",
                                                        background: "rgba(34,197,94,0.1)",
                                                        color: "#22c55e",
                                                        border: "0.5px solid rgba(34,197,94,0.2)",
                                                    }}>
                                                        APPROVED
                                                    </span>
                                                </div>

                                                {/* Preview bubble */}
                                                <div style={{
                                                    padding: "14px 16px",
                                                    borderRadius: "4px 14px 14px 14px",
                                                    background: "rgba(34,197,94,0.06)",
                                                    border: "0.5px solid rgba(34,197,94,0.12)",
                                                }}>
                                                    <div style={{
                                                        display: "flex", alignItems: "center", gap: "4px",
                                                        marginBottom: "6px",
                                                    }}>
                                                        <Eye size={11} style={{ color: "#22c55e" }} />
                                                        <span style={{
                                                            fontSize: "0.62rem", fontWeight: 600,
                                                            color: "#22c55e",
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                        }}>
                                                            Preview
                                                        </span>
                                                    </div>
                                                    <p style={{
                                                        fontSize: "0.82rem",
                                                        color: "var(--text-primary)",
                                                        lineHeight: 1.5,
                                                        whiteSpace: "pre-wrap",
                                                    }}>
                                                        {bodyPreview}
                                                    </p>
                                                </div>

                                                {/* Variable inputs */}
                                                {varCount > 0 && (
                                                    <div style={{
                                                        display: "flex", flexDirection: "column", gap: "8px",
                                                    }}>
                                                        <label style={{
                                                            fontSize: "0.72rem", fontWeight: 600,
                                                            color: "var(--text-muted)",
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                        }}>
                                                            Variables del template
                                                        </label>
                                                        {Array.from({ length: varCount }).map((_, i) => (
                                                            <input
                                                                key={i}
                                                                className="input"
                                                                placeholder={`Variable {{${i + 1}}}`}
                                                                value={waParams[i] || ""}
                                                                onChange={e => {
                                                                    const updated = [...waParams];
                                                                    updated[i] = e.target.value;
                                                                    setWaParams(updated);
                                                                }}
                                                                style={{ fontSize: "0.82rem" }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            {/* Footer — Send button */}
                            {waSelectedTemplate && (
                                <div style={{
                                    padding: "12px 20px",
                                    borderTop: "0.5px solid var(--border)",
                                    display: "flex", justifyContent: "flex-end", gap: "8px",
                                }}>
                                    <button
                                        onClick={() => setShowWaTemplates(false)}
                                        className="btn-secondary"
                                        style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={sendWaTemplate}
                                        disabled={waSending}
                                        className="btn-primary"
                                        style={{
                                            padding: "8px 20px", fontSize: "0.82rem",
                                            gap: "6px",
                                        }}
                                    >
                                        {waSending ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                        Enviar Template
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

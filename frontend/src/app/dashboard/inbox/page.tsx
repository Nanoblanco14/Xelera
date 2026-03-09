"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/lib/supabase";
import {
    MessageSquare, Search, Send, Loader2, Bot, User,
    Phone, Clock, PauseCircle, PlayCircle, AlertTriangle,
    ChevronRight, Inbox as InboxIcon, Zap, Plus, X,
    StickyNote, Trash2,
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

    // ── Internal notes ─────────────────────────────────
    const [showNotes, setShowNotes] = useState(false);
    const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [newNoteText, setNewNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

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

    // ── Notes functions ───────────────────────────────────
    const fetchLeadNotes = useCallback(async (leadId: string) => {
        setNotesLoading(true);
        try {
            const res = await fetch(`/api/leads/${leadId}/notes?org_id=${organization.id}`);
            const { data } = await res.json();
            setLeadNotes(data || []);
        } catch (err) {
            console.error("Failed to load notes:", err);
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
        try {
            const res = await fetch(`/api/inbox?org_id=${organization.id}`);
            const { data } = await res.json();
            if (data) setConversations(data);
        } catch (err) {
            console.error("Failed to load inbox:", err);
        }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // ── Load messages for selected lead ───────────────────
    const loadMessages = useCallback(async (leadId: string) => {
        setMessagesLoading(true);
        try {
            const res = await fetch(`/api/pipeline/leads/${leadId}/messages`);
            const { data } = await res.json();
            if (data) setMessages(data);
        } catch (err) {
            console.error("Failed to load messages:", err);
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
                            // Avoid duplicates
                            if (prev.some((m) => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                    }
                    // Refresh conversation list for latest message preview
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
            const { error } = await supabase
                .from("leads")
                .update({ is_bot_paused: !currentPaused })
                .eq("id", leadId);

            if (!error) {
                setConversations((prev) =>
                    prev.map((c) =>
                        c.lead_id === leadId
                            ? { ...c, is_bot_paused: !currentPaused }
                            : c
                    )
                );
            }
        } catch (err) {
            console.error("Toggle bot pause failed:", err);
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
        }
        setSending(false);
    };

    // ── Filter conversations ──────────────────────────────
    const isDeepSearch = searchQuery.trim().length >= 2 && searchResults !== null;
    const filtered = isDeepSearch
        ? conversations.filter((c) =>
              searchResults.some((r) => r.lead_id === c.lead_id)
          )
        : conversations.filter((c) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                  c.name.toLowerCase().includes(q) ||
                  c.phone.includes(q) ||
                  c.last_message?.content.toLowerCase().includes(q)
              );
          });

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
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
            }}>

                {/* ── Conversation List ── */}
                <div style={{
                    borderRight: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bg-secondary)",
                    overflow: "hidden",
                    minHeight: 0,
                }}>
                    {/* Search */}
                    <div style={{
                        padding: "12px",
                        borderBottom: "1px solid var(--border)",
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
                                style={{ paddingLeft: "32px", fontSize: "0.8rem" }}
                            />
                        </div>
                    </div>

                    {/* Search status */}
                    {searchLoading && (
                        <div style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid var(--border)",
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
                            borderBottom: "1px solid var(--border)",
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
                                padding: "40px 20px", textAlign: "center",
                                color: "var(--text-muted)",
                            }}>
                                <InboxIcon size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
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
                                            padding: "12px 14px",
                                            background: isSelected
                                                ? "rgba(59,130,246,0.08)"
                                                : "transparent",
                                            border: "none",
                                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                                            borderLeft: isSelected
                                                ? "3px solid #3b82f6"
                                                : "3px solid transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "all 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "rgba(255,255,255,0.03)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "transparent";
                                            }
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            flexShrink: 0, width: "38px", height: "38px",
                                            borderRadius: "10px",
                                            background: isSelected
                                                ? "rgba(59,130,246,0.15)"
                                                : "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.07)",
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center",
                                            color: isSelected ? "#60a5fa" : "var(--text-muted)",
                                            fontSize: "0.75rem", fontWeight: 700,
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
                                                    fontSize: "0.73rem",
                                                    color: "var(--text-muted)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: "240px",
                                                }}>
                                                    {convo.last_message?.role === "assistant" && (
                                                        <Bot size={10} style={{
                                                            display: "inline", marginRight: "4px",
                                                            verticalAlign: "middle",
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
                                                        border: "1px solid rgba(245,158,11,0.2)",
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
                                                    border: `1px solid ${convo.stage_color ? convo.stage_color + "30" : "rgba(255,255,255,0.06)"}`,
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
                    background: "var(--bg-primary)",
                    overflow: "hidden",
                    minHeight: 0,
                }}>
                    {!selectedLeadId ? (
                        /* Empty state */
                        <div style={{
                            flex: 1, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            flexDirection: "column", gap: "12px",
                            color: "var(--text-muted)",
                        }}>
                            <MessageSquare size={36} style={{ opacity: 0.2 }} />
                            <p style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                                Selecciona una conversación
                            </p>
                            <p style={{ fontSize: "0.73rem" }}>
                                Elige un contacto de la lista para ver sus mensajes
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Chat header ── */}
                            <div style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--bg-secondary)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{
                                        width: "36px", height: "36px",
                                        borderRadius: "10px",
                                        background: "rgba(59,130,246,0.1)",
                                        border: "1px solid rgba(59,130,246,0.2)",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center",
                                        color: "#60a5fa",
                                        fontSize: "0.78rem", fontWeight: 700,
                                    }}>
                                        {selectedConvo?.name[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: "0.85rem", fontWeight: 600,
                                            color: "var(--text-primary)",
                                        }}>
                                            {selectedConvo?.name || "Contacto"}
                                        </div>
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: "6px",
                                            fontSize: "0.7rem", color: "var(--text-muted)",
                                        }}>
                                            <Phone size={10} />
                                            {selectedConvo?.phone}
                                            <span style={{ margin: "0 2px" }}>·</span>
                                            <span style={{
                                                padding: "0px 5px",
                                                borderRadius: "100px",
                                                fontSize: "0.6rem",
                                                fontWeight: 500,
                                                background: selectedConvo?.stage_color
                                                    ? `${selectedConvo.stage_color}14`
                                                    : "rgba(255,255,255,0.04)",
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
                                            border: "none",
                                            transition: "all 0.15s ease",
                                            background: showNotes
                                                ? "rgba(245,158,11,0.1)"
                                                : "rgba(255,255,255,0.05)",
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
                                            border: "none",
                                            transition: "all 0.15s ease",
                                            ...(selectedConvo?.is_bot_paused
                                                ? {
                                                    background: "rgba(34,197,94,0.08)",
                                                    color: "#22c55e",
                                                }
                                                : {
                                                    background: "rgba(245,158,11,0.08)",
                                                    color: "#f59e0b",
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

                            {/* ── Bot paused banner ── */}
                            {selectedConvo?.is_bot_paused && (
                                <div style={{
                                    padding: "8px 16px",
                                    background: "rgba(245,158,11,0.06)",
                                    borderBottom: "1px solid rgba(245,158,11,0.15)",
                                    display: "flex", alignItems: "center", gap: "8px",
                                    fontSize: "0.75rem", color: "#f59e0b",
                                }}>
                                    <AlertTriangle size={13} />
                                    Bot pausado — tú estás respondiendo como humano. Los mensajes del bot no se enviarán.
                                </div>
                            )}

                            {/* ── Notes panel ── */}
                            {showNotes && (
                                <div style={{
                                    borderBottom: "1px solid var(--border)",
                                    background: "rgba(245,158,11,0.02)",
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
                                        borderBottom: "1px solid rgba(245,158,11,0.1)",
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
                                        borderBottom: "1px solid rgba(255,255,255,0.04)",
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
                                                border: "1px solid " + (newNoteText.trim()
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
                                                            border: "1px solid rgba(245,158,11,0.08)",
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
                                padding: "16px",
                                display: "flex", flexDirection: "column",
                                gap: "4px",
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
                                                margin: "12px 0 8px",
                                            }}>
                                                <span style={{
                                                    fontSize: "0.65rem",
                                                    fontWeight: 600,
                                                    color: "var(--text-muted)",
                                                    background: "rgba(255,255,255,0.04)",
                                                    padding: "3px 10px",
                                                    borderRadius: "100px",
                                                }}>
                                                    {group.date}
                                                </span>
                                            </div>
                                            {group.messages.map((msg) => (
                                                <div
                                                    key={msg.id}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent:
                                                            msg.role === "user"
                                                                ? "flex-start"
                                                                : "flex-end",
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    <div style={{
                                                        maxWidth: "70%",
                                                        padding: "9px 12px",
                                                        borderRadius:
                                                            msg.role === "user"
                                                                ? "4px 12px 12px 12px"
                                                                : "12px 4px 12px 12px",
                                                        background:
                                                            msg.role === "user"
                                                                ? "rgba(255,255,255,0.06)"
                                                                : "rgba(59,130,246,0.1)",
                                                        border:
                                                            msg.role === "user"
                                                                ? "1px solid rgba(255,255,255,0.08)"
                                                                : "1px solid rgba(59,130,246,0.15)",
                                                    }}>
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "5px",
                                                            marginBottom: "3px",
                                                        }}>
                                                            {msg.role === "user" ? (
                                                                <User size={10} style={{ color: "var(--text-muted)" }} />
                                                            ) : (
                                                                <Bot size={10} style={{ color: "#60a5fa" }} />
                                                            )}
                                                            <span style={{
                                                                fontSize: "0.6rem",
                                                                fontWeight: 600,
                                                                color: msg.role === "user"
                                                                    ? "var(--text-muted)"
                                                                    : "#60a5fa",
                                                            }}>
                                                                {msg.role === "user"
                                                                    ? selectedConvo?.name || "Cliente"
                                                                    : "Asistente"}
                                                            </span>
                                                            <span style={{
                                                                fontSize: "0.58rem",
                                                                color: "var(--text-muted)",
                                                            }}>
                                                                {formatTime(msg.created_at)}
                                                            </span>
                                                        </div>
                                                        <div style={{
                                                            fontSize: "0.8rem",
                                                            lineHeight: 1.5,
                                                            color: "var(--text-primary)",
                                                            whiteSpace: "pre-wrap",
                                                            wordBreak: "break-word",
                                                        }}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* ── Quick reply templates ── */}
                            {selectedConvo?.is_bot_paused && showTemplates && (
                                <div style={{
                                    padding: "10px 16px",
                                    borderTop: "1px solid var(--border)",
                                    background: "rgba(59,130,246,0.03)",
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
                                                        border: "1px solid rgba(255,255,255,0.08)",
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
                                                        e.currentTarget.style.background = "rgba(59,130,246,0.1)";
                                                        e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
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
                                                        background: "rgba(59,130,246,0.1)",
                                                        border: "1px solid rgba(59,130,246,0.2)",
                                                        color: "#60a5fa",
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
                                padding: "12px 16px",
                                borderTop: "1px solid var(--border)",
                                background: "var(--bg-secondary)",
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
                                                    ? "rgba(59,130,246,0.1)"
                                                    : "rgba(255,255,255,0.05)",
                                                border: showTemplates
                                                    ? "1px solid rgba(59,130,246,0.2)"
                                                    : "1px solid rgba(255,255,255,0.08)",
                                                color: showTemplates ? "#60a5fa" : "var(--text-muted)",
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
        </div>
    );
}

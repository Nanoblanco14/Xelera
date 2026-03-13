"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
} from "@hello-pangea/dnd";
import { useOrg } from "@/lib/org-context";
import { createClient } from "@supabase/supabase-js";
import type { PipelineStage, Lead, LeadMessage } from "@/lib/types";
import {
    Loader2, Plus, X, User, Phone, Search,
    GripVertical, Users, Edit3, CalendarDays, Save,
    DollarSign, MessageSquare, Tag, Settings, Trash2,
    ChevronUp, ChevronDown, Palette, Activity,
    Bot, MessageCircle, TrendingUp, CalendarCheck, Download,
    StickyNote, Send, History, ArrowRight,
} from "lucide-react";

/* ── Note type ────────────────────────────── */
interface LeadNote {
    id: string;
    content: string;
    author_email: string;
    created_at: string;
}

/* ── Stage History type ──────────────────── */
interface StageHistoryEntry {
    id: string;
    from_stage_id: string | null;
    to_stage_id: string;
    changed_by: "ai" | "human" | "system";
    reason: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

/* ── Color palette for stage configuration ─── */
const COLOR_PALETTE = [
    "#7a9e8a", "#f59e0b", "#5d8270", "#10b981",
    "#ef4444", "#06b6d4", "#ec4899", "#5d8270",
    "#f97316", "#14b8a6", "#6366f1", "#84cc16",
];

/* ── ConfirmModal ──────────────────────────── */
function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 24, maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.07)", background: "var(--bg-secondary)", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: confirmColor || "#7a9e8a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            {confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AlertModal ───────────────────────────── */
function AlertModal({ open, title, message, onClose }: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#7a9e8a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
    const { organization, userEmail } = useOrg();
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── Modal: crear lead ────────────────────────── */
    const [showModal, setShowModal] = useState(false);
    const [newLead, setNewLead] = useState({
        name: "",
        email: "",
        phone: "",
        stage_id: "",
    });
    const [creating, setCreating] = useState(false);

    /* ── Modal: editar lead ───────────────────────── */
    const [editLead, setEditLead] = useState<Lead | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        phone: "",
        stage_id: "",
        notes: "",
        budget: "",
        appointment_date: "",
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    /* ── Modal: tabs (Detalles | Chat | Notas | Historial) ── */
    const [activeTab, setActiveTab] = useState<"details" | "chat" | "notes" | "history">("details");
    const [chatMessages, setChatMessages] = useState<LeadMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [botPaused, setBotPaused] = useState(false);
    const [pauseLoading, setPauseLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    /* ── Notes state ──────────────────────────────── */
    const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [newNoteText, setNewNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    /* ── Stage History state ────────────────────── */
    const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    /* ── Modal: config stages ────────────────────── */
    const [showConfig, setShowConfig] = useState(false);
    interface EditableStage { id: string; name: string; color: string; position: number; leadCount: number; isNew?: boolean; }
    const [editableStages, setEditableStages] = useState<EditableStage[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [newStageName, setNewStageName] = useState("");

    /* ── Modal: confirmación / alerta ─────────────── */
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        confirmColor?: string;
        onConfirm: () => void;
    } | null>(null);

    const [alertModal, setAlertModal] = useState<{
        open: boolean;
        title: string;
        message: string;
    } | null>(null);

    /* ── Error state ──────────────────────────────────── */
    const [error, setError] = useState<string | null>(null);

    /* ── Search / Filter ───────────────────────────── */
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSource, setFilterSource] = useState<"all" | "whatsapp" | "manual">("all");

    /* ── Fetch pipeline ───────────────────────────── */
    const loadPipeline = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`/api/pipeline?org_id=${organization.id}`);
            const { data } = await res.json();
            if (data) setStages(data);
        } catch (err) {
            console.error("Failed to load pipeline:", err);
            setError("No se pudo cargar el pipeline. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization.id]);

    useEffect(() => {
        loadPipeline();

        // ── Supabase Realtime: dedicated client for live updates ──
        const realtimeClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const channel = realtimeClient
            .channel('pipeline-leads-live')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload: any) => {
                    console.log('[Realtime] INSERT received:', payload);
                    const newRecord = payload.new as Lead;
                    if (!newRecord) return;
                    setStages((prev) => {
                        const next = prev.map((s) => ({
                            ...s,
                            leads: s.leads ? s.leads.map((l) => ({ ...l })) : [],
                        }));
                        const col = next.find((s) => s.id === newRecord.stage_id);
                        if (col && !col.leads!.some((l) => l.id === newRecord.id)) {
                            col.leads = [...col.leads!, { ...newRecord }];
                        }
                        return next;
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'leads',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload: any) => {
                    console.log('[Realtime] UPDATE received:', payload);
                    const newRecord = payload.new as Lead;
                    if (!newRecord) return;
                    setStages((prev) => {
                        const next = prev.map((s) => ({
                            ...s,
                            leads: s.leads
                                ? s.leads
                                    .filter((l) => l.id !== newRecord.id)
                                    .map((l) => ({ ...l }))
                                : [],
                        }));
                        // Insert into correct stage
                        const col = next.find((s) => s.id === newRecord.stage_id);
                        if (col) {
                            col.leads = [...col.leads!, { ...newRecord }];
                        }
                        return next;
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'leads',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload: any) => {
                    console.log('[Realtime] DELETE received:', payload);
                    const oldRecord = payload.old as { id?: string };
                    if (!oldRecord?.id) return;
                    setStages((prev) => {
                        return prev.map((s) => ({
                            ...s,
                            leads: (s.leads || []).filter((l) => l.id !== oldRecord.id).map((l) => ({ ...l })),
                        }));
                    });
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status);
            });

        return () => {
            realtimeClient.removeChannel(channel);
        };
    }, [loadPipeline, organization.id]);

    /* ── Drag & Drop handler (optimistic) ─────────── */
    const onDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        )
            return;

        const destStageId = destination.droppableId;

        setStages((prev) => {
            const next = prev.map((s) => ({
                ...s,
                leads: [...(s.leads || [])],
            }));
            const srcCol = next.find((s) => s.id === source.droppableId);
            const dstCol = next.find((s) => s.id === destStageId);
            if (!srcCol || !dstCol) return prev;
            const [moved] = srcCol.leads!.splice(source.index, 1);
            moved.stage_id = destStageId;
            dstCol.leads!.splice(destination.index, 0, moved);
            return next;
        });

        try {
            await fetch(`/api/pipeline/leads/${draggableId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage_id: destStageId }),
            });
        } catch (err) {
            console.error("Failed to update lead stage:", err);
            setError("No se pudo mover el lead. Intenta de nuevo.");
            loadPipeline();
        }
    };

    /* ── Create lead ──────────────────────────────── */
    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLead.name.trim()) return;
        setCreating(true);

        const stageId = newLead.stage_id || stages[0]?.id;
        if (!stageId) return;

        try {
            const res = await fetch("/api/pipeline/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organization_id: organization.id,
                    stage_id: stageId,
                    name: newLead.name.trim(),
                    email: newLead.email.trim(),
                    phone: newLead.phone.trim(),
                }),
            });
            const { data } = await res.json();

            if (data) {
                setStages((prev) =>
                    prev.map((s) =>
                        s.id === stageId
                            ? { ...s, leads: [...(s.leads || []), data] }
                            : s
                    )
                );
            }

            setNewLead({ name: "", email: "", phone: "", stage_id: "" });
            setShowModal(false);
        } catch (err) {
            console.error("Failed to create lead:", err);
            setError("No se pudo crear el lead. Intenta de nuevo.");
        }
        setCreating(false);
    };

    /* ── Open edit modal ──────────────────────────── */
    const openEditModal = (lead: Lead) => {
        setEditLead(lead);
        setEditForm({
            name: lead.name,
            phone: lead.phone || "",
            stage_id: lead.stage_id,
            notes: lead.notes || "",
            budget: lead.budget || "",
            appointment_date: lead.appointment_date || "",
        });
        // Reset tab state
        setActiveTab("details");
        setChatMessages([]);
        setBotPaused(lead.is_bot_paused ?? false);
        setLeadNotes([]);
        setNewNoteText("");
    };

    /* ── Fetch chat messages ───────────────────────── */
    const fetchChatMessages = useCallback(async (leadId: string) => {
        setChatLoading(true);
        try {
            const res = await fetch(`/api/pipeline/leads/${leadId}/messages`);
            const { data } = await res.json();
            setChatMessages(data || []);
        } catch (err) {
            console.error("Failed to load chat messages:", err);
            setError("No se pudieron cargar los mensajes del chat. Intenta de nuevo.");
        }
        setChatLoading(false);
    }, []);

    /* ── Auto-scroll chat to bottom ───────────────── */
    useEffect(() => {
        if (activeTab === "chat" && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, activeTab]);

    /* ── Chat tab click → fetch messages ──────────── */
    const handleChatTabClick = () => {
        setActiveTab("chat");
        if (editLead) fetchChatMessages(editLead.id);
    };

    /* ── Notes: fetch ──────────────────────────────── */
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

    /* ── Notes tab click → fetch notes ─────────────── */
    const handleNotesTabClick = () => {
        setActiveTab("notes");
        if (editLead) fetchLeadNotes(editLead.id);
    };

    /* ── Stage History: fetch ────────────────────── */
    const fetchStageHistory = useCallback(async (leadId: string) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/pipeline/leads/${leadId}/history`);
            const { data } = await res.json();
            setStageHistory(data || []);
        } catch (err) {
            console.error("Failed to load stage history:", err);
            setError("No se pudo cargar el historial de etapas. Intenta de nuevo.");
        }
        setHistoryLoading(false);
    }, []);

    /* ── History tab click → fetch history ────────── */
    const handleHistoryTabClick = () => {
        setActiveTab("history");
        if (editLead) fetchStageHistory(editLead.id);
    };

    /* ── Helper: get stage name by ID ─────────────── */
    const getStageName = useCallback((stageId: string | null): string => {
        if (!stageId) return "Nuevo";
        const stage = stages.find(s => s.id === stageId);
        return stage?.name || "Desconocido";
    }, [stages]);

    /* ── Notes: add new note ───────────────────────── */
    const handleAddNote = async () => {
        if (!editLead || !newNoteText.trim() || savingNote) return;
        setSavingNote(true);
        try {
            const res = await fetch(`/api/leads/${editLead.id}/notes`, {
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

    /* ── Notes: delete note ────────────────────────── */
    const handleDeleteNote = async (noteId: string) => {
        try {
            await fetch(`/api/leads/${editLead?.id}/notes?note_id=${noteId}`, {
                method: "DELETE",
            });
            setLeadNotes((prev) => prev.filter((n) => n.id !== noteId));
        } catch (err) {
            console.error("Failed to delete note:", err);
            setError("No se pudo eliminar la nota. Intenta de nuevo.");
        }
    };

    /* ── Toggle bot pause ─────────────────────────── */
    const handleToggleBotPause = async () => {
        if (!editLead || pauseLoading) return;
        const newPaused = !botPaused;
        setPauseLoading(true);
        setBotPaused(newPaused); // optimistic
        try {
            await fetch(`/api/pipeline/leads/${editLead.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_bot_paused: newPaused }),
            });
            // Update local pipeline state so it survives modal close
            setStages((prev) =>
                prev.map((s) => ({
                    ...s,
                    leads: (s.leads || []).map((l) =>
                        l.id === editLead.id ? { ...l, is_bot_paused: newPaused } : l
                    ),
                }))
            );
        } catch (err) {
            console.error("Failed to toggle bot pause:", err);
            setBotPaused(!newPaused); // revert on error
            setError("No se pudo cambiar el estado del bot. Intenta de nuevo.");
        }
        setPauseLoading(false);
    };

    /* ── Save edited lead ─────────────────────────── */
    const handleSaveLead = async () => {
        if (!editLead) return;
        setSaving(true);
        try {
            await fetch(`/api/pipeline/leads/${editLead.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editForm.name.trim(),
                    phone: editForm.phone.trim(),
                    stage_id: editForm.stage_id,
                    notes: editForm.notes.trim(),
                    budget: editForm.budget.trim(),
                    appointment_date: editForm.appointment_date.trim(),
                }),
            });
            await loadPipeline();
            setEditLead(null);
        } catch (err) {
            console.error("Failed to update lead:", err);
            setError("No se pudo actualizar el lead. Intenta de nuevo.");
        }
        setSaving(false);
    };

    /* ── Delete lead ──────────────────────────────── */
    const handleDeleteLead = () => {
        if (!editLead) return;
        setConfirmModal({
            open: true,
            title: "Eliminar lead",
            message: `¿Eliminar a "${editLead.name}" del pipeline? Esta acción no se puede deshacer.`,
            confirmLabel: "Eliminar",
            confirmColor: "#DC2626",
            onConfirm: async () => {
                setConfirmModal(null);
                setDeleting(true);
                try {
                    await fetch(`/api/pipeline/leads/${editLead.id}`, { method: "DELETE" });
                    // Optimistic UI: remove from local state immediately
                    setStages((prev) =>
                        prev.map((s) => ({
                            ...s,
                            leads: (s.leads || []).filter((l) => l.id !== editLead.id),
                        }))
                    );
                    setEditLead(null);
                } catch (err) {
                    console.error("Failed to delete lead:", err);
                    setError("No se pudo eliminar el lead. Intenta de nuevo.");
                }
                setDeleting(false);
            },
        });
    };

    /* ── Helper: source badge ─────────────────────── */
    const getSourceBadge = (lead: Lead) => {
        const src = lead.source || "manual";
        if (src === "whatsapp" || lead.name?.toLowerCase().includes("whatsapp")) {
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-green-400">
                    WhatsApp
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-blue-400">
                Manual
            </span>
        );
    };

    /* ── Helper: status badge ─────────────────────── */
    const getStatusBadge = (lead: Lead) => {
        const isQualified = !!lead.appointment_date;
        if (isQualified) {
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                    ✓ Calificado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-zinc-400 ring-1 ring-zinc-500/20">
                Pendiente
            </span>
        );
    };

    /* ── Helper: chat status live badge ────────────── */
    const getChatStatusBadge = (lead: Lead) => {
        const status = lead.chat_status || "Nuevo";
        const statusConfig: Record<string, { color: string; bg: string; ring: string; pulse: boolean }> = {
            "Nuevo": { color: "text-zinc-400", bg: "bg-zinc-500/10", ring: "ring-zinc-500/20", pulse: false },
            "Contacto inicial": { color: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/20", pulse: true },
            "Consultando opciones": { color: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/20", pulse: true },
            "Filtrando perfil": { color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20", pulse: true },
            "Negociando horario": { color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20", pulse: true },
            "Cita agendada": { color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", pulse: false },
            "Derivado a humano": { color: "text-orange-400", bg: "bg-orange-500/10", ring: "ring-orange-500/20", pulse: true },
            "Esperando respuesta": { color: "text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/20", pulse: true },
            "Descartado": { color: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/20", pulse: false },
        };
        const cfg = statusConfig[status] || statusConfig["Nuevo"];

        return (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${cfg.bg} ring-1 ${cfg.ring}`}>
                <span className="relative flex h-2 w-2">
                    {cfg.pulse && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.bg}`} />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.bg.replace('/10', '/70')}`} />
                </span>
                <span className={`text-[0.6rem] font-semibold ${cfg.color}`}>
                    {status}
                </span>
            </div>
        );
    };

    /* ── Stage color accents (dynamic from DB or fallback) ── */
    const FALLBACK_COLORS = ["#7a9e8a", "#f59e0b", "#5d8270", "#10b981"];
    const getStageColor = (stage: PipelineStage, idx: number) => {
        const dot = stage.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        return {
            bg: `${dot}1f`,
            border: `${dot}4d`,
            dot,
        };
    };

    /* ── Open config modal ────────────────────────── */
    const openConfigModal = () => {
        setEditableStages(
            stages.map((s) => ({
                id: s.id,
                name: s.name,
                color: s.color || FALLBACK_COLORS[stages.indexOf(s) % FALLBACK_COLORS.length],
                position: s.position,
                leadCount: s.leads?.length || 0,
            }))
        );
        setNewStageName("");
        setShowConfig(true);
    };

    /* ── Config: add stage ─────────────────────────── */
    const handleAddStage = () => {
        if (!newStageName.trim()) return;
        const maxPos = editableStages.length > 0
            ? Math.max(...editableStages.map((s) => s.position))
            : -1;
        setEditableStages((prev) => [
            ...prev,
            {
                id: `new-${Date.now()}`,
                name: newStageName.trim(),
                color: COLOR_PALETTE[prev.length % COLOR_PALETTE.length],
                position: maxPos + 1,
                leadCount: 0,
                isNew: true,
            },
        ]);
        setNewStageName("");
    };

    /* ── Config: move stage up/down ────────────────── */
    const moveStage = (idx: number, dir: -1 | 1) => {
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= editableStages.length) return;
        setEditableStages((prev) => {
            const next = [...prev];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next.map((s, i) => ({ ...s, position: i }));
        });
    };

    /* ── Config: delete stage ──────────────────────── */
    const handleDeleteStage = (idx: number) => {
        const stage = editableStages[idx];
        if (stage.leadCount > 0 && !stage.isNew) {
            setAlertModal({ open: true, title: "Error", message: "No puedes eliminar una etapa con leads. Muévelos primero." });
            return;
        }
        setEditableStages((prev) =>
            prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i }))
        );
    };

    /* ── Config: save all changes ──────────────────── */
    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            // 1. Create new stages
            for (const s of editableStages.filter((s) => s.isNew)) {
                await fetch("/api/pipeline/stages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        organization_id: organization.id,
                        name: s.name,
                        color: s.color,
                        position: s.position,
                    }),
                });
            }

            // 2. Update existing stages (name, color)
            for (const s of editableStages.filter((s) => !s.isNew)) {
                await fetch(`/api/pipeline/stages/${s.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: s.name,
                        color: s.color,
                    }),
                });
            }

            // 3. Batch reorder
            const orderPayload = editableStages
                .filter((s) => !s.isNew)
                .map((s) => ({ id: s.id, position: s.position }));
            if (orderPayload.length > 0) {
                await fetch("/api/pipeline/stages", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stages: orderPayload }),
                });
            }

            // 4. Delete removed stages
            const currentIds = new Set(editableStages.map((s) => s.id));
            const deletedStages = stages.filter((s) => !currentIds.has(s.id));
            for (const s of deletedStages) {
                await fetch(`/api/pipeline/stages/${s.id}`, { method: "DELETE" });
            }

            // Reload pipeline
            setShowConfig(false);
            setLoading(true);
            await loadPipeline();
        } catch (err) {
            console.error("Failed to save config:", err);
            setError("No se pudo guardar la configuracion del pipeline. Intenta de nuevo.");
        }
        setSavingConfig(false);
    };

    /* ── Computed: metrics + filtered stages ──────── */
    const allLeads = stages.flatMap((s) => s.leads || []);
    const totalLeads = allLeads.length;
    const qualifiedLeads = allLeads.filter((l) => !!l.appointment_date).length;
    const whatsappLeads = allLeads.filter((l) => l.source === "whatsapp" || l.name?.toLowerCase().includes("whatsapp")).length;
    const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

    const searchLower = searchQuery.toLowerCase().trim();
    const filteredStages = stages.map((stage) => ({
        ...stage,
        leads: (stage.leads || []).filter((lead) => {
            const matchesSearch = !searchLower ||
                lead.name?.toLowerCase().includes(searchLower) ||
                lead.phone?.toLowerCase().includes(searchLower) ||
                lead.notes?.toLowerCase().includes(searchLower) ||
                lead.budget?.toLowerCase().includes(searchLower);
            const matchesSource = filterSource === "all" ||
                (filterSource === "whatsapp" && (lead.source === "whatsapp" || lead.name?.toLowerCase().includes("whatsapp"))) ||
                (filterSource === "manual" && lead.source !== "whatsapp" && !lead.name?.toLowerCase().includes("whatsapp"));
            return matchesSearch && matchesSource;
        }),
    }));
    const isFiltering = !!searchLower || filterSource !== "all";

    /* ── Exportar CSV ──────────────────────────── */
    const exportCSV = () => {
        const stageMap = new Map(stages.map((s) => [s.id, s.name]));
        const headers = ["Nombre", "Telefono", "Email", "Etapa", "Origen", "Presupuesto", "Notas", "Cita", "Fecha de creacion"];
        const rows = allLeads.map((lead) => [
            lead.name || "",
            lead.phone || "",
            lead.email || "",
            stageMap.get(lead.stage_id) || "",
            lead.source || "manual",
            lead.budget || "",
            (lead.notes || "").replace(/[\r\n]+/g, " "),
            lead.appointment_date || "",
            lead.created_at ? new Date(lead.created_at).toLocaleString("es-CL") : "",
        ]);

        const escape = (v: string) => {
            if (v.includes(",") || v.includes('"') || v.includes("\n")) {
                return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
        };

        const csv = [
            headers.join(","),
            ...rows.map((r) => r.map(escape).join(",")),
        ].join("\n");

        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    return (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
            {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", margin: "0 0 12px 0", color: "#f87171", fontSize: 14 }}>
                    {error}
                </div>
            )}
            {/* ── Header ──────────────────────────────── */}
            <div style={{ flexShrink: 0, marginBottom: "16px" }}>
                <div className="page-header" style={{ marginBottom: "16px" }}>
                    <div>
                        <h1 className="page-title" style={{ fontFamily: "'Playfair Display', serif" }}>Flujo de Ventas</h1>
                        <p className="page-subtitle">
                            Gestiona tus leads a través del embudo de ventas
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        {allLeads.length > 0 && (
                            <button
                                className="btn-secondary"
                                onClick={exportCSV}
                                title="Exportar leads a CSV"
                            >
                                <Download size={16} /> Exportar CSV
                            </button>
                        )}
                        <button
                            className="btn-secondary"
                            onClick={openConfigModal}
                        >
                            <Settings size={16} /> Configurar Etapas
                        </button>
                        <button
                            className="btn-primary"
                            onClick={() => setShowModal(true)}
                    >
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>
                </div>

                {/* ── Metrics bar ──────────────────────── */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                    {[
                        { label: "Total Leads", value: totalLeads, icon: <Users size={13} />, color: "#a1a1aa" },
                        { label: "Calificados", value: qualifiedLeads, icon: <CalendarCheck size={13} />, color: "#22c55e" },
                        { label: "Conversion", value: `${conversionRate}%`, icon: <TrendingUp size={13} />, color: "#7a9e8a" },
                        { label: "Via WhatsApp", value: whatsappLeads, icon: <MessageCircle size={13} />, color: "#25d366" },
                    ].map((metric) => (
                        <div
                            key={metric.label}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 16px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.045)",
                                backdropFilter: "blur(8px)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <span style={{ color: metric.color, display: "flex", opacity: 0.8 }}>{metric.icon}</span>
                            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: metric.color }}>{metric.value}</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.01em" }}>{metric.label}</span>
                        </div>
                    ))}

                    {/* Stage count summary badges */}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "auto" }}>
                        {stages.map((stage, idx) => {
                            const sc = getStageColor(stage, idx);
                            return (
                                <div
                                    key={stage.id}
                                    title={stage.name}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        padding: "4px 10px",
                                        borderRadius: "100px",
                                        background: `${sc.dot}10`,
                                        border: `1px solid ${sc.dot}20`,
                                        fontSize: "0.62rem",
                                        fontWeight: 600,
                                        color: sc.dot,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                                    {stage.leads?.length || 0}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Search & Filter bar ──────────────── */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "4px" }}>
                    <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
                        <Search size={15} style={{
                            position: "absolute", left: "12px", top: "50%",
                            transform: "translateY(-50%)", color: "var(--text-muted)",
                            pointerEvents: "none",
                        }} />
                        <input
                            className="input"
                            style={{ paddingLeft: "36px", height: "38px" }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre, teléfono o notas..."
                        />
                    </div>
                    <div style={{ display: "flex", gap: "4px", padding: "3px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.045)", backdropFilter: "blur(8px)" }}>
                        {([
                            { value: "all" as const, label: "Todos" },
                            { value: "whatsapp" as const, label: "WhatsApp" },
                            { value: "manual" as const, label: "Manual" },
                        ]).map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterSource(opt.value)}
                                style={{
                                    padding: "5px 14px",
                                    borderRadius: "7px",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    transition: "all 0.15s ease",
                                    background: filterSource === opt.value ? "rgba(255,255,255,0.1)" : "transparent",
                                    color: filterSource === opt.value ? "var(--text-primary)" : "var(--text-muted)",
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {isFiltering && (
                        <button
                            onClick={() => { setSearchQuery(""); setFilterSource("all"); }}
                            style={{
                                padding: "5px 12px",
                                borderRadius: "8px",
                                border: "0.5px solid rgba(239,68,68,0.2)",
                                background: "rgba(239,68,68,0.06)",
                                color: "#f87171",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                            }}
                        >
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Kanban Board ────────────────────────── */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div
                    className="pipeline-scroll"
                    style={{
                        display: "flex",
                        gap: "14px",
                        flex: 1,
                        overflowX: "auto",
                        overflowY: "hidden",
                        paddingBottom: "16px",
                        paddingTop: "2px",
                        paddingRight: "20px",
                    }}
                >
                    {(isFiltering ? filteredStages : stages).map((stage, idx) => {
                        const color = getStageColor(stage, idx);
                        const leadCount = stage.leads?.length || 0;

                        return (
                            <div
                                key={stage.id}
                                style={{
                                    minWidth: "320px",
                                    maxWidth: "360px",
                                    flex: "1 0 320px",
                                    display: "flex",
                                    flexDirection: "column",
                                    background: `linear-gradient(180deg, ${color.dot}08 0%, var(--bg-deep) 80px, var(--bg-deep) 100%)`,
                                    borderRadius: "14px",
                                    border: "0.5px solid var(--border)",
                                    borderTop: `2px solid ${color.dot}`,
                                    overflow: "hidden",
                                    backdropFilter: "blur(12px)",
                                    boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                                }}
                            >
                                {/* Column header */}
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        background: "rgba(255,255,255,0.015)",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            background: color.dot,
                                            flexShrink: 0,
                                            boxShadow: `0 0 8px ${color.dot}55`,
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: "0.82rem",
                                            fontWeight: 600,
                                            color: "var(--text-primary)",
                                            flex: 1,
                                            letterSpacing: "0.01em",
                                        }}
                                    >
                                        {stage.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            color: color.dot,
                                            background: `${color.dot}15`,
                                            padding: "3px 10px",
                                            borderRadius: "100px",
                                            border: `1px solid ${color.dot}20`,
                                            letterSpacing: "0.02em",
                                        }}
                                    >
                                        {leadCount}
                                    </span>
                                </div>

                                {/* Droppable area */}
                                <Droppable droppableId={stage.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="pipeline-scroll"
                                            style={{
                                                flex: 1,
                                                overflowY: "auto",
                                                padding: "10px",
                                                minHeight: "120px",
                                                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                                background: snapshot.isDraggingOver
                                                    ? `${color.dot}0d`
                                                    : "transparent",
                                                border: snapshot.isDraggingOver
                                                    ? `1.5px dashed ${color.dot}40`
                                                    : "1.5px dashed transparent",
                                                borderRadius: "8px",
                                                margin: "6px",
                                            }}
                                        >
                                            {(stage.leads || []).map(
                                                (lead, leadIdx) => (
                                                    <Draggable
                                                        key={lead.id}
                                                        draggableId={lead.id}
                                                        index={leadIdx}
                                                    >
                                                        {(prov, snap) => (
                                                            <div
                                                                ref={prov.innerRef}
                                                                {...prov.draggableProps}
                                                                {...prov.dragHandleProps}
                                                                onClick={() => openEditModal(lead)}
                                                                className="group"
                                                                style={{
                                                                    ...prov.draggableProps.style,
                                                                    marginBottom: "10px",
                                                                }}
                                                            >
                                                                {/* ═══ PREMIUM LEAD CARD ═══ */}
                                                                <div
                                                                    style={{
                                                                        position: "relative",
                                                                        borderRadius: "12px",
                                                                        border: snap.isDragging
                                                                            ? `1px solid ${color.dot}60`
                                                                            : "1px solid rgba(255,255,255,0.055)",
                                                                        background: snap.isDragging
                                                                            ? "var(--bg-primary)"
                                                                            : "var(--bg-primary)",
                                                                        cursor: "pointer",
                                                                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                                                        boxShadow: snap.isDragging
                                                                            ? `0 20px 40px rgba(0,0,0,0.35), 0 0 20px ${color.dot}15`
                                                                            : "0 2px 8px rgba(0,0,0,0.12)",
                                                                        overflow: "hidden",
                                                                        transform: snap.isDragging ? "scale(1.02)" : "none",
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (!snap.isDragging) {
                                                                            e.currentTarget.style.transform = "translateY(-2px)";
                                                                            e.currentTarget.style.borderColor = `${color.dot}40`;
                                                                            e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.25), 0 0 12px ${color.dot}10`;
                                                                        }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (!snap.isDragging) {
                                                                            e.currentTarget.style.transform = "none";
                                                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.055)";
                                                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
                                                                        }
                                                                    }}
                                                                >
                                                                    {/* Stage-colored left accent bar */}
                                                                    <div style={{
                                                                        position: "absolute",
                                                                        left: 0,
                                                                        top: "8px",
                                                                        bottom: "8px",
                                                                        width: "3px",
                                                                        borderRadius: "0 3px 3px 0",
                                                                        background: `linear-gradient(180deg, ${color.dot}, ${color.dot}60)`,
                                                                    }} />

                                                                    {/* Row 1: Grip + Name + Source */}
                                                                    <div className="flex items-center gap-2" style={{ padding: "12px 14px 6px 16px" }}>
                                                                        <GripVertical size={12} className="shrink-0" style={{ color: "var(--text-muted)", opacity: 0.3, transition: "opacity 0.2s" }} />
                                                                        <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                            {lead.name}
                                                                        </span>
                                                                        {getSourceBadge(lead)}
                                                                    </div>

                                                                    {/* Row 2: Phone + Status Badge */}
                                                                    <div className="flex items-center justify-between" style={{ padding: "0 14px 4px 16px" }}>
                                                                        {lead.phone ? (
                                                                            <div className="flex items-center gap-1.5" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                                                <Phone size={10} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                                                                                <span>{lead.phone}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin telefono</span>
                                                                        )}
                                                                        {getStatusBadge(lead)}
                                                                    </div>

                                                                    {/* Row 2.5: Live Chat Status */}
                                                                    <div className="flex items-center gap-1.5" style={{ padding: "0 14px 8px 16px" }}>
                                                                        <Activity size={9} style={{ color: "var(--text-muted)", opacity: 0.5, flexShrink: 0 }} />
                                                                        {getChatStatusBadge(lead)}
                                                                    </div>

                                                                    {/* Row 3: Data Grid */}
                                                                    <div style={{ margin: "0 10px 10px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.035)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                                                                        <div style={{ padding: "8px 10px", borderRight: "1px solid rgba(255,255,255,0.035)" }}>
                                                                            <div className="flex items-center gap-1" style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>
                                                                                <DollarSign size={9} />
                                                                                Monto
                                                                            </div>
                                                                            <div style={{ fontSize: "0.76rem", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                {lead.budget || "\u2014"}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ padding: "8px 10px" }}>
                                                                            <div className="flex items-center gap-1" style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>
                                                                                <CalendarDays size={9} />
                                                                                Fecha Cita
                                                                            </div>
                                                                            <div style={{ fontSize: "0.76rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: lead.appointment_date ? "#6ee7b7" : "var(--text-primary)" }}>
                                                                                {lead.appointment_date || "\u2014"}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Row 4: Notes preview + timestamp */}
                                                                    {(lead.notes || lead.created_at) && (
                                                                        <div style={{ padding: "0 14px 10px 16px", display: "flex", flexDirection: "column", gap: "3px" }}>
                                                                            {lead.notes && (
                                                                                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic", margin: 0 }}>
                                                                                    {lead.notes}
                                                                                </p>
                                                                            )}
                                                                            {lead.created_at && (
                                                                                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", opacity: 0.5 }}>
                                                                                    {new Date(lead.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                )
                                            )}
                                            {provided.placeholder}

                                            {/* Empty column state */}
                                            {leadCount === 0 && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        padding: "32px 16px",
                                                        color: "var(--text-muted)",
                                                        fontSize: "0.73rem",
                                                        gap: "6px",
                                                        margin: "8px",
                                                        borderRadius: "10px",
                                                        border: "1.5px dashed rgba(255,255,255,0.06)",
                                                        background: "rgba(255,255,255,0.01)",
                                                    }}
                                                >
                                                    <Users size={22} style={{ opacity: 0.15, color: color.dot }} />
                                                    <span style={{ opacity: 0.5, fontWeight: 500 }}>Sin leads en esta etapa</span>
                                                    <span style={{ opacity: 0.3, fontSize: "0.65rem" }}>Arrastra un lead aqui</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* ── Modal: Nuevo Cliente ─────────────────── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "480px" }}
                    >
                        <div className="modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div
                                    style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "10px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "0.5px solid rgba(255,255,255,0.07)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <User size={18} color="white" />
                                </div>
                                <div>
                                    <h3
                                        style={{
                                            fontSize: "1rem",
                                            fontWeight: 700,
                                            color: "var(--text-primary)",
                                        }}
                                    >
                                        Nuevo Cliente
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-muted)",
                                        }}
                                    >
                                        Agrega un lead al pipeline
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    padding: "4px",
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLead}>
                            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Nombre *</label>
                                    <input
                                        className="input"
                                        value={newLead.name}
                                        onChange={(e) =>
                                            setNewLead((p) => ({
                                                ...p,
                                                name: e.target.value,
                                            }))
                                        }
                                        placeholder="Juan Pérez"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Email</label>
                                    <input
                                        className="input"
                                        type="email"
                                        value={newLead.email}
                                        onChange={(e) =>
                                            setNewLead((p) => ({
                                                ...p,
                                                email: e.target.value,
                                            }))
                                        }
                                        placeholder="juan@email.com"
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Teléfono</label>
                                    <input
                                        className="input"
                                        value={newLead.phone}
                                        onChange={(e) =>
                                            setNewLead((p) => ({
                                                ...p,
                                                phone: e.target.value,
                                            }))
                                        }
                                        placeholder="+56 9 1234 5678"
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Etapa Inicial</label>
                                    <select
                                        className="select"
                                        value={newLead.stage_id || stages[0]?.id || ""}
                                        onChange={(e) =>
                                            setNewLead((p) => ({
                                                ...p,
                                                stage_id: e.target.value,
                                            }))
                                        }
                                    >
                                        {stages.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={creating || !newLead.name.trim()}
                                >
                                    {creating ? (
                                        <><Loader2 size={15} className="animate-spin" />{" "}
                                            Guardando…
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={16} /> Agregar Lead
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════ */}
            {/* ── Modal: Editar Lead (2 tabs) ────────── */}
            {/* ══════════════════════════════════════════ */}
            {editLead && (
                <div className="modal-overlay" onClick={() => setEditLead(null)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "540px", background: "var(--bg-deep)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)" }}
                    >
                        {/* ── Header ────────────────────────────── */}
                        <div className="modal-header" style={{ flexDirection: "column", gap: "12px", paddingBottom: "0", background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                <div className="flex items-center gap-3">
                                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #7a9e8a, #6482aa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(122,158,138,0.2)" }}>
                                        <Edit3 size={18} color="white" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                                            {editLead.name}
                                        </h3>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {editLead.phone || "Sin teléfono"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditLead(null)}
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* ── Tab Bar ──────────────────────────────── */}
                            <div style={{
                                display: "flex",
                                gap: "3px",
                                padding: "3px",
                                background: "rgba(255,255,255,0.025)",
                                borderRadius: "10px",
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}>
                                <button
                                    onClick={() => setActiveTab("details")}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                        padding: "7px 12px",
                                        borderRadius: "7px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        background: activeTab === "details" ? "rgba(255,255,255,0.1)" : "transparent",
                                        color: activeTab === "details" ? "var(--text-primary)" : "var(--text-muted)",
                                    }}
                                >
                                    <Edit3 size={13} />
                                    Detalles
                                </button>
                                <button
                                    onClick={handleChatTabClick}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                        padding: "7px 12px",
                                        borderRadius: "7px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        background: activeTab === "chat" ? "rgba(255,255,255,0.1)" : "transparent",
                                        color: activeTab === "chat" ? "var(--text-primary)" : "var(--text-muted)",
                                    }}
                                >
                                    <MessageCircle size={13} />
                                    💬 Chat
                                    {chatMessages.length > 0 && (
                                        <span style={{
                                            fontSize: "0.6rem",
                                            fontWeight: 700,
                                            background: "rgba(122,158,138,0.25)",
                                            color: "#9ab8a8",
                                            padding: "1px 6px",
                                            borderRadius: "100px",
                                        }}>
                                            {chatMessages.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={handleNotesTabClick}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                        padding: "7px 12px",
                                        borderRadius: "7px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        background: activeTab === "notes" ? "rgba(255,255,255,0.1)" : "transparent",
                                        color: activeTab === "notes" ? "var(--text-primary)" : "var(--text-muted)",
                                    }}
                                >
                                    <StickyNote size={13} />
                                    Notas
                                    {leadNotes.length > 0 && (
                                        <span style={{
                                            fontSize: "0.6rem",
                                            fontWeight: 700,
                                            background: "rgba(245,158,11,0.25)",
                                            color: "#f59e0b",
                                            padding: "1px 6px",
                                            borderRadius: "100px",
                                        }}>
                                            {leadNotes.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={handleHistoryTabClick}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                        padding: "7px 12px",
                                        borderRadius: "7px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        background: activeTab === "history" ? "rgba(255,255,255,0.1)" : "transparent",
                                        color: activeTab === "history" ? "var(--text-primary)" : "var(--text-muted)",
                                    }}
                                >
                                    <History size={13} />
                                    Historial
                                </button>
                            </div>
                        </div>

                        {/* ════════════════════════════════════════ */}
                        {/* ── TAB: DETALLES ──────────────────────  */}
                        {/* ════════════════════════════════════════ */}
                        {activeTab === "details" && (
                            <>
                                <div className="modal-body flex flex-col gap-4">

                                    {/* ── Bot Pause Toggle ────────────────── */}
                                    <button
                                        type="button"
                                        onClick={handleToggleBotPause}
                                        disabled={pauseLoading}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "12px 16px",
                                            borderRadius: "12px",
                                            border: `0.5px solid ${botPaused ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                                            background: botPaused ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)",
                                            cursor: pauseLoading ? "not-allowed" : "pointer",
                                            transition: "all 0.3s ease",
                                            opacity: pauseLoading ? 0.7 : 1,
                                            width: "100%",
                                            textAlign: "left",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            {pauseLoading ? (
                                                <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                            ) : (
                                                <Bot size={16} style={{ color: botPaused ? "#f87171" : "#4ade80" }} />
                                            )}
                                            <div>
                                                <div style={{
                                                    fontSize: "0.82rem",
                                                    fontWeight: 700,
                                                    color: botPaused ? "#f87171" : "#4ade80",
                                                }}>
                                                    {botPaused ? "⏸️ IA Pausada" : "🤖 IA Activa"}
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                                                    {botPaused
                                                        ? "El bot no responderá. Toma el control manualmente."
                                                        : "El bot responde automáticamente por WhatsApp."}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Toggle pill */}
                                        <div style={{
                                            width: "44px",
                                            height: "24px",
                                            borderRadius: "100px",
                                            background: botPaused ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)",
                                            border: `0.5px solid ${botPaused ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.5)"}`,
                                            position: "relative",
                                            flexShrink: 0,
                                            transition: "all 0.3s ease",
                                        }}>
                                            <div style={{
                                                width: "18px",
                                                height: "18px",
                                                borderRadius: "50%",
                                                background: botPaused ? "#f87171" : "#4ade80",
                                                position: "absolute",
                                                top: "2px",
                                                left: botPaused ? "22px" : "3px",
                                                transition: "left 0.3s ease, background 0.3s ease",
                                                boxShadow: `0 0 6px ${botPaused ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)"}`,
                                            }} />
                                        </div>
                                    </button>

                                    {/* ── Row: Name + Phone ─────────────── */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">
                                                <User size={12} className="inline mr-1 align-middle" />
                                                Nombre
                                            </label>
                                            <input
                                                className="input"
                                                value={editForm.name}
                                                onChange={(e) =>
                                                    setEditForm((p) => ({
                                                        ...p,
                                                        name: e.target.value,
                                                    }))
                                                }
                                                placeholder="Nombre del lead"
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">
                                                <Phone size={12} className="inline mr-1 align-middle" />
                                                Teléfono
                                            </label>
                                            <input
                                                className="input"
                                                value={editForm.phone}
                                                onChange={(e) =>
                                                    setEditForm((p) => ({
                                                        ...p,
                                                        phone: e.target.value,
                                                    }))
                                                }
                                                placeholder="+56 9 1234 5678"
                                            />
                                        </div>
                                    </div>

                                    {/* Stage */}
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">
                                            <Tag size={12} className="inline mr-1 align-middle" />
                                            Etapa
                                        </label>
                                        <select
                                            className="select"
                                            value={editForm.stage_id}
                                            onChange={(e) =>
                                                setEditForm((p) => ({
                                                    ...p,
                                                    stage_id: e.target.value,
                                                }))
                                            }
                                        >
                                            {stages.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Row: Budget + Appointment Date */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">
                                                <DollarSign size={12} className="inline mr-1 align-middle" />
                                                Monto / Valor
                                            </label>
                                            <input
                                                className="input"
                                                value={editForm.budget}
                                                onChange={(e) =>
                                                    setEditForm((p) => ({
                                                        ...p,
                                                        budget: e.target.value,
                                                    }))
                                                }
                                                placeholder="Ej: $50.000.000"
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">
                                                <CalendarDays size={12} className="inline mr-1 align-middle" />
                                                Fecha de Cita
                                            </label>
                                            <input
                                                className="input"
                                                value={editForm.appointment_date}
                                                onChange={(e) =>
                                                    setEditForm((p) => ({
                                                        ...p,
                                                        appointment_date: e.target.value,
                                                    }))
                                                }
                                                placeholder="26 Feb, 10:00 am"
                                            />
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">
                                            <MessageSquare size={12} className="inline mr-1 align-middle" />
                                            Notas
                                        </label>
                                        <textarea
                                            className="input"
                                            rows={3}
                                            value={editForm.notes}
                                            onChange={(e) =>
                                                setEditForm((p) => ({
                                                    ...p,
                                                    notes: e.target.value,
                                                }))
                                            }
                                            placeholder="Ej: Detalles del servicio, producto requerido o notas adicionales del cliente..."
                                            style={{ resize: "vertical", minHeight: "70px" }}
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="modal-footer" style={{ justifyContent: "space-between" }}>
                                    <button
                                        type="button"
                                        onClick={handleDeleteLead}
                                        disabled={deleting || saving}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "8px 14px",
                                            borderRadius: "10px",
                                            border: "0.5px solid rgba(239,68,68,0.35)",
                                            background: "rgba(239,68,68,0.08)",
                                            color: deleting ? "var(--text-muted)" : "#f87171",
                                            cursor: deleting ? "not-allowed" : "pointer",
                                            fontSize: "0.82rem",
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!deleting) {
                                                e.currentTarget.style.background = "rgba(239,68,68,0.18)";
                                                e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                                            e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                                        }}
                                    >
                                        {deleting ? (
                                            <><Loader2 size={13} className="animate-spin" /> Eliminando…</>
                                        ) : (
                                            <><Trash2 size={14} /> Eliminar Prospecto</>
                                        )}
                                    </button>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setEditLead(null)}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            disabled={saving || !editForm.name.trim()}
                                            onClick={handleSaveLead}
                                        >
                                            {saving ? (
                                                <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                                            ) : (
                                                <><Save size={16} /> Guardar Cambios</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ════════════════════════════════════════ */}
                        {/* ── TAB: CHAT (MODO ESPÍA) ─────────────  */}
                        {/* ════════════════════════════════════════ */}
                        {activeTab === "chat" && (
                            <div className="modal-body" style={{ padding: "0" }}>

                                {/* Spy Mode banner */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 20px",
                                    background: "rgba(122,158,138,0.08)",
                                    borderBottom: "0.5px solid rgba(122,158,138,0.15)",
                                }}>
                                    <span style={{ fontSize: "0.68rem", color: "#a78bfa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                        👁️ Modo Espía — Historial de conversación
                                    </span>
                                </div>

                                {/* Message list */}
                                <div style={{
                                    height: "420px",
                                    overflowY: "auto",
                                    padding: "16px 20px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                    background: "var(--bg-primary)",
                                }}>
                                    {chatLoading ? (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                                            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    ) : chatMessages.length === 0 ? (
                                        <div style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flex: 1,
                                            gap: "8px",
                                            color: "var(--text-muted)",
                                        }}>
                                            <MessageCircle size={32} style={{ opacity: 0.3 }} />
                                            <span style={{ fontSize: "0.8rem" }}>Sin mensajes registrados aún</span>
                                            <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>Los mensajes se guardan a partir de ahora</span>
                                        </div>
                                    ) : (
                                        chatMessages.map((msg) => {
                                            const isUser = msg.role === "user";
                                            const time = new Date(msg.created_at).toLocaleTimeString("es-CL", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                            return (
                                                <div
                                                    key={msg.id}
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: isUser ? "flex-start" : "flex-end",
                                                        gap: "3px",
                                                    }}
                                                >
                                                    <div style={{
                                                        maxWidth: "78%",
                                                        padding: "9px 13px",
                                                        borderRadius: isUser ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                                                        background: isUser ? "rgba(255,255,255,0.07)" : "rgba(122,158,138,0.75)",
                                                        border: isUser ? "0.5px solid rgba(255,255,255,0.08)" : "none",
                                                        fontSize: "0.82rem",
                                                        lineHeight: 1.5,
                                                        color: isUser ? "var(--text-primary)" : "#fff",
                                                        wordBreak: "break-word",
                                                        backdropFilter: "blur(4px)",
                                                    }}>
                                                        {msg.content}
                                                    </div>
                                                    <span style={{
                                                        fontSize: "0.62rem",
                                                        color: "var(--text-muted)",
                                                        paddingLeft: isUser ? "4px" : "0",
                                                        paddingRight: isUser ? "0" : "4px",
                                                    }}>
                                                        {isUser ? `👤 Cliente · ${time}` : `🤖 Bot · ${time}`}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                    {/* Auto-scroll anchor */}
                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════════ */}
                        {/* ── TAB: NOTAS INTERNAS ──────────────── */}
                        {/* ════════════════════════════════════════ */}
                        {activeTab === "notes" && (
                            <div className="modal-body" style={{ padding: "0" }}>
                                {/* Add note input */}
                                <div style={{
                                    padding: "12px 20px",
                                    borderBottom: "0.5px solid var(--border)",
                                    display: "flex",
                                    gap: "8px",
                                    alignItems: "flex-end",
                                }}>
                                    <textarea
                                        className="input"
                                        rows={2}
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddNote();
                                            }
                                        }}
                                        placeholder="Escribe una nota interna..."
                                        style={{
                                            flex: 1,
                                            fontSize: "0.8rem",
                                            resize: "none",
                                            minHeight: "44px",
                                        }}
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        disabled={!newNoteText.trim() || savingNote}
                                        className="btn-primary"
                                        style={{
                                            padding: "10px 14px",
                                            minWidth: "auto",
                                            opacity: !newNoteText.trim() ? 0.4 : 1,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {savingNote ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                    </button>
                                </div>

                                {/* Notes list */}
                                <div style={{
                                    height: "380px",
                                    overflowY: "auto",
                                    padding: "12px 20px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}>
                                    {notesLoading ? (
                                        <div style={{
                                            display: "flex", justifyContent: "center",
                                            alignItems: "center", flex: 1,
                                        }}>
                                            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    ) : leadNotes.length === 0 ? (
                                        <div style={{
                                            display: "flex", flexDirection: "column",
                                            alignItems: "center", justifyContent: "center",
                                            flex: 1, gap: "8px", color: "var(--text-muted)",
                                        }}>
                                            <StickyNote size={32} style={{ opacity: 0.3 }} />
                                            <span style={{ fontSize: "0.8rem" }}>Sin notas aún</span>
                                            <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                                                Agrega notas internas para tu equipo
                                            </span>
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
                                                        padding: "10px 14px",
                                                        borderRadius: "10px",
                                                        background: "rgba(245,158,11,0.04)",
                                                        border: "0.5px solid rgba(245,158,11,0.1)",
                                                        position: "relative",
                                                    }}
                                                    className="group"
                                                >
                                                    <div style={{
                                                        fontSize: "0.8rem",
                                                        lineHeight: 1.5,
                                                        color: "var(--text-primary)",
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-word",
                                                    }}>
                                                        {note.content}
                                                    </div>
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        marginTop: "6px",
                                                    }}>
                                                        <span style={{
                                                            fontSize: "0.65rem",
                                                            color: "var(--text-muted)",
                                                        }}>
                                                            {note.author_email ? `${note.author_email} · ` : ""}{timeStr}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteNote(note.id)}
                                                            title="Eliminar nota"
                                                            style={{
                                                                background: "none",
                                                                border: "none",
                                                                color: "var(--text-muted)",
                                                                cursor: "pointer",
                                                                padding: "2px",
                                                                opacity: 0,
                                                                transition: "opacity 0.15s",
                                                            }}
                                                            className="group-hover:!opacity-100"
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.opacity = "1";
                                                                e.currentTarget.style.color = "#f87171";
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.opacity = "0";
                                                                e.currentTarget.style.color = "var(--text-muted)";
                                                            }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                        {/* ════════════════════════════════════════ */}
                        {/* ── TAB: HISTORIAL ────────────────────── */}
                        {/* ════════════════════════════════════════ */}
                        {activeTab === "history" && (
                            <div className="modal-body" style={{ padding: "0" }}>
                                <div style={{
                                    height: "440px",
                                    overflowY: "auto",
                                    padding: "16px 20px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0",
                                }}>
                                    {historyLoading ? (
                                        <div style={{
                                            display: "flex", justifyContent: "center",
                                            alignItems: "center", flex: 1,
                                        }}>
                                            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    ) : stageHistory.length === 0 ? (
                                        <div style={{
                                            display: "flex", flexDirection: "column",
                                            alignItems: "center", justifyContent: "center",
                                            flex: 1, gap: "8px", color: "var(--text-muted)",
                                        }}>
                                            <History size={32} style={{ opacity: 0.3 }} />
                                            <span style={{ fontSize: "0.8rem" }}>Sin historial de cambios</span>
                                            <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                                                Los movimientos de etapa se registrarán aquí
                                            </span>
                                        </div>
                                    ) : (
                                        stageHistory.map((entry, idx) => {
                                            const date = new Date(entry.created_at);
                                            const timeStr = date.toLocaleString("es-CL", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                            const isAI = entry.changed_by === "ai";
                                            const isLast = idx === stageHistory.length - 1;

                                            return (
                                                <div key={entry.id} style={{
                                                    display: "flex",
                                                    gap: "12px",
                                                    position: "relative",
                                                }}>
                                                    {/* Timeline line + dot */}
                                                    <div style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        width: "20px",
                                                        flexShrink: 0,
                                                    }}>
                                                        <div style={{
                                                            width: "10px",
                                                            height: "10px",
                                                            borderRadius: "50%",
                                                            background: isAI ? "#7a9e8a" : "#10b981",
                                                            border: `2px solid ${isAI ? "rgba(122,158,138,0.3)" : "rgba(16,185,129,0.3)"}`,
                                                            flexShrink: 0,
                                                            marginTop: "4px",
                                                            boxShadow: `0 0 8px ${isAI ? "rgba(122,158,138,0.3)" : "rgba(16,185,129,0.3)"}`,
                                                        }} />
                                                        {!isLast && (
                                                            <div style={{
                                                                width: "1.5px",
                                                                flex: 1,
                                                                background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                                                                minHeight: "20px",
                                                            }} />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{
                                                        flex: 1,
                                                        paddingBottom: isLast ? "0" : "16px",
                                                    }}>
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "6px",
                                                            flexWrap: "wrap",
                                                        }}>
                                                            {entry.from_stage_id ? (
                                                                <>
                                                                    <span style={{
                                                                        fontSize: "0.75rem",
                                                                        fontWeight: 600,
                                                                        color: "var(--text-muted)",
                                                                        background: "rgba(255,255,255,0.05)",
                                                                        padding: "2px 8px",
                                                                        borderRadius: "4px",
                                                                    }}>
                                                                        {getStageName(entry.from_stage_id)}
                                                                    </span>
                                                                    <ArrowRight size={12} style={{ color: "var(--text-muted)" }} />
                                                                </>
                                                            ) : null}
                                                            <span style={{
                                                                fontSize: "0.75rem",
                                                                fontWeight: 600,
                                                                color: "var(--text-primary)",
                                                                background: isAI ? "rgba(122,158,138,0.1)" : "rgba(16,185,129,0.1)",
                                                                border: `0.5px solid ${isAI ? "rgba(122,158,138,0.2)" : "rgba(16,185,129,0.2)"}`,
                                                                padding: "2px 8px",
                                                                borderRadius: "4px",
                                                            }}>
                                                                {getStageName(entry.to_stage_id)}
                                                            </span>
                                                        </div>
                                                        {entry.reason && (
                                                            <p style={{
                                                                fontSize: "0.7rem",
                                                                color: "var(--text-muted)",
                                                                marginTop: "4px",
                                                                lineHeight: 1.4,
                                                                maxWidth: "100%",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                display: "-webkit-box",
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: "vertical",
                                                            }}>
                                                                {entry.reason}
                                                            </p>
                                                        )}
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "8px",
                                                            marginTop: "4px",
                                                        }}>
                                                            <span style={{
                                                                fontSize: "0.6rem",
                                                                color: isAI ? "#7a9e8a" : "#10b981",
                                                                fontWeight: 600,
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.5px",
                                                            }}>
                                                                {isAI ? "🤖 IA" : entry.changed_by === "system" ? "⚙️ Sistema" : "👤 Humano"}
                                                            </span>
                                                            <span style={{
                                                                fontSize: "0.6rem",
                                                                color: "var(--text-muted)",
                                                                opacity: 0.7,
                                                            }}>
                                                                {timeStr}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════ */}
            {/* ── Modal: Configurar Etapas ───────────────  */}
            {/* ══════════════════════════════════════════ */}
            {showConfig && (
                <div className="modal-overlay" onClick={() => setShowConfig(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "560px" }}
                    >
                        {/* Header */}
                        <div className="modal-header">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center">
                                    <Settings size={18} color="white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                                        Configurar Etapas
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Agrega, renombra, reordena o elimina columnas del pipeline
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfig(false)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="modal-body flex flex-col gap-3">
                            {editableStages.map((stage, idx) => (
                                <div
                                    key={stage.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "10px 14px",
                                        borderRadius: "var(--radius)",
                                        background: "var(--bg-card)",
                                        border: "0.5px solid var(--border)",
                                    }}
                                >
                                    {/* Position number */}
                                    <span style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        color: "var(--text-muted)",
                                        width: "20px",
                                        textAlign: "center",
                                    }}>
                                        {idx + 1}
                                    </span>

                                    {/* Color picker */}
                                    <div style={{ position: "relative" }}>
                                        <div
                                            style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "8px",
                                                background: stage.color,
                                                cursor: "pointer",
                                                border: "2px solid rgba(255,255,255,0.1)",
                                                position: "relative",
                                            }}
                                            onClick={() => {
                                                // Cycle through palette
                                                const currentIdx = COLOR_PALETTE.indexOf(stage.color);
                                                const nextColor = COLOR_PALETTE[(currentIdx + 1) % COLOR_PALETTE.length];
                                                setEditableStages((prev) =>
                                                    prev.map((s, i) =>
                                                        i === idx ? { ...s, color: nextColor } : s
                                                    )
                                                );
                                            }}
                                            title="Click para cambiar color"
                                        >
                                            <Palette size={12} color="white" style={{
                                                position: "absolute",
                                                top: "50%", left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                opacity: 0.7,
                                            }} />
                                        </div>
                                    </div>

                                    {/* Name input */}
                                    <input
                                        className="input"
                                        value={stage.name}
                                        onChange={(e) =>
                                            setEditableStages((prev) =>
                                                prev.map((s, i) =>
                                                    i === idx ? { ...s, name: e.target.value } : s
                                                )
                                            )
                                        }
                                        style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem" }}
                                    />

                                    {/* Lead count badge */}
                                    {stage.leadCount > 0 && (
                                        <span style={{
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            color: "var(--text-muted)",
                                            background: "rgba(255,255,255,0.05)",
                                            padding: "2px 8px",
                                            borderRadius: "100px",
                                        }}>
                                            {stage.leadCount} leads
                                        </span>
                                    )}

                                    {/* Move up/down */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <button
                                            onClick={() => moveStage(idx, -1)}
                                            disabled={idx === 0}
                                            style={{
                                                background: "none", border: "none", padding: "2px",
                                                cursor: idx === 0 ? "default" : "pointer",
                                                color: idx === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                                                opacity: idx === 0 ? 0.3 : 1,
                                            }}
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                        <button
                                            onClick={() => moveStage(idx, 1)}
                                            disabled={idx === editableStages.length - 1}
                                            style={{
                                                background: "none", border: "none", padding: "2px",
                                                cursor: idx === editableStages.length - 1 ? "default" : "pointer",
                                                color: idx === editableStages.length - 1 ? "var(--text-muted)" : "var(--text-secondary)",
                                                opacity: idx === editableStages.length - 1 ? 0.3 : 1,
                                            }}
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                    </div>

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDeleteStage(idx)}
                                        title={stage.leadCount > 0 ? "Mueve los leads primero" : "Eliminar etapa"}
                                        style={{
                                            background: "none", border: "none", padding: "4px",
                                            cursor: stage.leadCount > 0 && !stage.isNew ? "not-allowed" : "pointer",
                                            color: stage.leadCount > 0 && !stage.isNew ? "var(--text-muted)" : "var(--danger)",
                                            opacity: stage.leadCount > 0 && !stage.isNew ? 0.3 : 0.7,
                                            transition: "opacity 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!(stage.leadCount > 0 && !stage.isNew))
                                                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!(stage.leadCount > 0 && !stage.isNew))
                                                (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}

                            {/* Add new stage row */}
                            <div style={{
                                display: "flex",
                                gap: "10px",
                                alignItems: "center",
                                marginTop: "8px",
                                padding: "10px 14px",
                                borderRadius: "var(--radius)",
                                background: "rgba(122,158,138,0.06)",
                                border: "1px dashed rgba(122,158,138,0.2)",
                            }}>
                                <Plus size={16} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
                                <input
                                    className="input"
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    placeholder="Nueva etapa..."
                                    onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
                                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem" }}
                                />
                                <button
                                    className="btn-secondary"
                                    onClick={handleAddStage}
                                    disabled={!newStageName.trim()}
                                    style={{ padding: "8px 16px", fontSize: "0.8rem" }}
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setShowConfig(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={savingConfig}
                                onClick={handleSaveConfig}
                            >
                                {savingConfig ? (
                                    <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                                ) : (
                                    <><Save size={16} /> Guardar Configuración</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ──────────────────────── */}
            {confirmModal && (
                <ConfirmModal
                    open={confirmModal.open}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmLabel={confirmModal.confirmLabel}
                    confirmColor={confirmModal.confirmColor}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* ── Alert Modal ────────────────────────── */}
            {alertModal && (
                <AlertModal
                    open={alertModal.open}
                    title={alertModal.title}
                    message={alertModal.message}
                    onClose={() => setAlertModal(null)}
                />
            )}
        </div>
    );
}

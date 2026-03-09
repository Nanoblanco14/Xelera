"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, MessageSquare, UserPlus, ArrowRightCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export interface ToastMessage {
    id: string;
    title: string;
    body: string;
    type: "message" | "lead" | "stage" | "info";
    timestamp: number;
}

interface Props {
    orgId: string;
}

export default function ToastProvider({ orgId }: Props) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Auto-dismiss after 5 seconds
    const addToast = useCallback((toast: Omit<ToastMessage, "id" | "timestamp">) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newToast: ToastMessage = { ...toast, id, timestamp: Date.now() };

        setToasts((prev) => {
            // Keep max 4 toasts
            const next = [...prev, newToast];
            if (next.length > 4) next.shift();
            return next;
        });

        const timer = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            dismissTimers.current.delete(id);
        }, 5000);
        dismissTimers.current.set(id, timer);
    }, []);

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = dismissTimers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            dismissTimers.current.delete(id);
        }
    };

    // ── Listen to Supabase Realtime for new messages & leads ──
    useEffect(() => {
        if (!orgId) return;

        const realtimeClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const channel = realtimeClient
            .channel("toast-notifications")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "lead_messages",
                },
                async (payload: any) => {
                    const msg = payload.new;
                    if (!msg || msg.role !== "user") return;

                    // Fetch the lead name for this message
                    const { data: lead } = await realtimeClient
                        .from("leads")
                        .select("name, organization_id")
                        .eq("id", msg.lead_id)
                        .maybeSingle();

                    if (!lead || lead.organization_id !== orgId) return;

                    addToast({
                        title: "Nuevo mensaje",
                        body: `${lead.name}: ${(msg.content || "").slice(0, 80)}${(msg.content || "").length > 80 ? "..." : ""}`,
                        type: "message",
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "leads",
                    filter: `organization_id=eq.${orgId}`,
                },
                (payload: any) => {
                    const lead = payload.new;
                    if (!lead) return;

                    addToast({
                        title: "Nuevo lead",
                        body: `${lead.name || "Cliente nuevo"} ha iniciado contacto`,
                        type: "lead",
                    });
                }
            )
            .subscribe();

        return () => {
            realtimeClient.removeChannel(channel);
            // Clear all timers
            for (const timer of dismissTimers.current.values()) {
                clearTimeout(timer);
            }
            dismissTimers.current.clear();
        };
    }, [orgId, addToast]);

    const getIcon = (type: ToastMessage["type"]) => {
        switch (type) {
            case "message":
                return <MessageSquare size={16} />;
            case "lead":
                return <UserPlus size={16} />;
            case "stage":
                return <ArrowRightCircle size={16} />;
            default:
                return <MessageSquare size={16} />;
        }
    };

    const getIconColor = (type: ToastMessage["type"]) => {
        switch (type) {
            case "message":
                return "#3b82f6";
            case "lead":
                return "#22c55e";
            case "stage":
                return "#f59e0b";
            default:
                return "#6366f1";
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: "64px",
                right: "24px",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxWidth: "380px",
                pointerEvents: "none",
            }}
        >
            {toasts.map((toast, idx) => (
                <div
                    key={toast.id}
                    style={{
                        pointerEvents: "auto",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "#1a1a1e",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
                        animation: "toast-slide-in 0.3s ease-out",
                        backdropFilter: "blur(16px)",
                        transition: "all 0.2s ease",
                    }}
                >
                    {/* Icon */}
                    <div
                        style={{
                            flexShrink: 0,
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: `${getIconColor(toast.type)}15`,
                            color: getIconColor(toast.type),
                        }}
                    >
                        {getIcon(toast.type)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                marginBottom: "2px",
                            }}
                        >
                            {toast.title}
                        </div>
                        <div
                            style={{
                                fontSize: "0.73rem",
                                color: "var(--text-secondary)",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                            }}
                        >
                            {toast.body}
                        </div>
                    </div>

                    {/* Dismiss */}
                    <button
                        onClick={() => dismissToast(toast.id)}
                        style={{
                            flexShrink: 0,
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px",
                            borderRadius: "4px",
                            transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}

            <style>{`
                @keyframes toast-slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(100px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}

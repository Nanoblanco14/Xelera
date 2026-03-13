"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Notification {
    id: string;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
    lead_id: string | null;
}

interface Props {
    orgId: string;
}

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
}

export default function NotificationBell({ orgId }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        if (!orgId) return;
        const { data } = await supabase
            .from("notifications")
            .select("id, type, message, is_read, created_at, lead_id")
            .eq("tenant_id", orgId)
            .order("created_at", { ascending: false })
            .limit(20);
        if (data) setNotifications(data as Notification[]);
    }, [orgId]);

    // Initial fetch + 30s polling
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30_000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const unread = notifications.filter((n) => !n.is_read);
    const unreadCount = unread.length;

    const markAsRead = async (id: string) => {
        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
    };

    const markAllRead = async () => {
        const ids = unread.map((n) => n.id);
        if (!ids.length) return;
        await supabase.from("notifications").update({ is_read: true }).in("id", ids);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    return (
        <div ref={dropdownRef} style={{ position: "relative" }}>
            {/* ── Bell button ── */}
            <button
                id="notification-bell-btn"
                onClick={() => setOpen((o) => !o)}
                title="Notificaciones"
                style={{
                    position: "relative",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: open ? "rgba(255,255,255,0.06)" : "none",
                    border: "none",
                    color: unreadCount > 0 ? "var(--text-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "background 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                    if (!open) {
                        (e.currentTarget as HTMLButtonElement).style.background = "none";
                        (e.currentTarget as HTMLButtonElement).style.color =
                            unreadCount > 0 ? "var(--text-primary)" : "var(--text-muted)";
                    }
                }}
            >
                <Bell size={16} />

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#6366f1",
                            boxShadow: "0 0 0 2px var(--bg-secondary)",
                        }}
                    >
                        {/* Ping animation via inline keyframes */}
                        <span
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: "50%",
                                background: "#6366f1",
                                opacity: 0.75,
                                animation: "notif-ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
                            }}
                        />
                    </span>
                )}
            </button>

            {/* ── Dropdown panel ── */}
            {open && (
                <div
                    id="notification-dropdown"
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: "0",
                        width: "320px",
                        background: "#111113",
                        border: "0.5px solid rgba(255,255,255,0.07)",
                        borderRadius: "14px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                        zIndex: 200,
                        overflow: "hidden",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 16px 12px",
                            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                                style={{
                                    fontSize: "0.8125rem",
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                }}
                            >
                                Notificaciones
                            </span>
                            {unreadCount > 0 && (
                                <span
                                    style={{
                                        fontSize: "0.6875rem",
                                        fontWeight: 600,
                                        color: "#818cf8",
                                        background: "rgba(122,158,138,0.12)",
                                        padding: "1px 6px",
                                        borderRadius: "20px",
                                    }}
                                >
                                    {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{
                                    fontSize: "0.6875rem",
                                    color: "var(--text-muted)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                    borderRadius: "4px",
                                    transition: "color 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.color =
                                    "var(--text-primary)")
                                }
                                onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.color =
                                    "var(--text-muted)")
                                }
                            >
                                Marcar todo como leído
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                            <div
                                style={{
                                    padding: "32px 16px",
                                    textAlign: "center",
                                    color: "var(--text-muted)",
                                    fontSize: "0.8125rem",
                                }}
                            >
                                <Bell
                                    size={22}
                                    style={{ margin: "0 auto 10px", opacity: 0.3, display: "block" }}
                                />
                                Sin notificaciones nuevas
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => markAsRead(n.id)}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: "10px",
                                        padding: "12px 16px",
                                        background: n.is_read ? "none" : "rgba(122,158,138,0.05)",
                                        border: "none",
                                        borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                                        cursor: n.is_read ? "default" : "pointer",
                                        textAlign: "left",
                                        transition: "background 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!n.is_read)
                                            (e.currentTarget as HTMLButtonElement).style.background =
                                                "rgba(122,158,138,0.08)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.background = n.is_read
                                            ? "none"
                                            : "rgba(122,158,138,0.05)";
                                    }}
                                >
                                    {/* Dot */}
                                    <div
                                        style={{
                                            flexShrink: 0,
                                            marginTop: "5px",
                                            width: "6px",
                                            height: "6px",
                                            borderRadius: "50%",
                                            background: n.is_read ? "transparent" : "#6366f1",
                                            border: n.is_read ? "0.5px solid rgba(255,255,255,0.12)" : "none",
                                        }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: "0.8125rem",
                                                color: n.is_read
                                                    ? "var(--text-secondary)"
                                                    : "var(--text-primary)",
                                                fontWeight: n.is_read ? 400 : 500,
                                                lineHeight: 1.4,
                                                marginBottom: "3px",
                                            }}
                                        >
                                            {n.message}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.6875rem",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            {timeAgo(n.created_at)}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Ping keyframe — injected once */}
            <style>{`
                @keyframes notif-ping {
                    75%, 100% { transform: scale(2.2); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { OrgProvider, type OrgContextType } from "@/lib/org-context";
import type { Organization } from "@/lib/types";
import {
    Home, Bot, Kanban, BarChart3, Package, MessageSquare,
    LogOut, Loader2, ChevronRight, Settings, Zap, AlertCircle,
    FileText,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ToastProvider from "./Toast";

const NAV_ITEMS = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/dashboard/products", label: "Inventario", icon: Package },
    { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban },
    { href: "/dashboard/templates", label: "Templates", icon: FileText },
    { href: "/dashboard/analytics", label: "Analítica", icon: BarChart3 },
    { href: "/dashboard/agents", label: "Mi Asistente", icon: Bot },
    { href: "/dashboard/settings", label: "Configuración", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [orgCtx, setOrgCtx] = useState<OrgContextType | null>(null);
    const [userEmail, setUserEmail] = useState("");
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [collapsed, setCollapsed] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    // ── Fetch unread (pending) inbox count ──
    const fetchUnread = useCallback(async (orgId: string) => {
        try {
            const res = await fetch(`/api/inbox/unread?org_id=${orgId}`);
            const { count } = await res.json();
            setUnreadCount(count || 0);
        } catch {
            /* silent */
        }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    router.replace("/login");
                    return;
                }

                setUserEmail(user.email || "");

                // Fetch org membership
                const { data: members, error: membersError } = await supabase
                    .from("org_members")
                    .select("*, organizations(*)")
                    .eq("user_id", user.id)
                    .limit(1);

                if (membersError) {
                    console.error("Org members error:", membersError);
                    setError("Error cargando organización: " + membersError.message);
                    setReady(true);
                    return;
                }

                if (!members || members.length === 0) {
                    setError("No tienes una organización asignada. Contacta al administrador.");
                    setReady(true);
                    return;
                }

                const m = members[0] as any;
                const org = m.organizations as Organization;
                setOrgCtx({
                    organization: org,
                    role: m.role,
                    userId: user.id,
                    userEmail: user.email || "",
                });

                // Redirect new users to onboarding
                const settings = (org.settings || {}) as Record<string, unknown>;
                if (!settings.onboarding_completed && !window.location.pathname.startsWith("/dashboard/onboarding")) {
                    router.replace("/dashboard/onboarding");
                }

                setReady(true);
            } catch (err: any) {
                console.error("Layout init error:", err);
                setError(err.message || "Error inesperado");
                setReady(true);
            }
        })();
    }, [router]);

    // ── Poll unread count every 20s ──
    useEffect(() => {
        if (!orgCtx?.organization.id) return;
        fetchUnread(orgCtx.organization.id);
        const interval = setInterval(() => fetchUnread(orgCtx.organization.id), 20_000);
        return () => clearInterval(interval);
    }, [orgCtx?.organization.id, fetchUnread]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.replace("/login");
    };

    // Loading spinner
    if (!ready) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    // Error state
    if (error && !orgCtx) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
                <div className="glass-card p-8 max-w-md text-center">
                    <AlertCircle size={36} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
                    <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                        Error de Configuración
                    </h2>
                    <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                        {error}
                    </p>
                    <button onClick={handleLogout} className="btn-primary">
                        <LogOut size={15} /> Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    const orgName = orgCtx?.organization.name || "Plataforma";
    const sidebarW = collapsed ? "64px" : "240px";
    const isOnboarding = pathname.startsWith("/dashboard/onboarding");

    // During onboarding, render full-screen without sidebar/topbar
    if (isOnboarding) {
        return (
            <OrgProvider value={orgCtx!}>
                {children}
            </OrgProvider>
        );
    }

    return (
        <OrgProvider value={orgCtx!}>
            <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>

                {/* ── Sidebar ────────────────────────── */}
                <aside
                    onMouseEnter={() => setCollapsed(false)}
                    onMouseLeave={() => setCollapsed(true)}
                    style={{
                        width: sidebarW,
                        background: "var(--bg-secondary)",
                        borderRight: "1px solid var(--border)",
                        minHeight: "100vh",
                        position: "fixed",
                        top: 0,
                        left: 0,
                        zIndex: 40,
                        display: "flex",
                        flexDirection: "column",
                        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                        overflow: "hidden",
                    }}
                >
                    {/* Logo / Brand */}
                    <div
                        style={{
                            borderBottom: "1px solid var(--border)",
                            padding: "20px 0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: collapsed ? "center" : "flex-start",
                            gap: "12px",
                            paddingLeft: collapsed ? 0 : "16px",
                            transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                            overflow: "hidden",
                        }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: "var(--gradient-1)",
                            }}
                        >
                            <Zap size={18} color="white" />
                        </div>

                        {/* Name — only visible when expanded */}
                        <div
                            style={{
                                opacity: collapsed ? 0 : 1,
                                width: collapsed ? 0 : "auto",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                transition: "opacity 200ms ease, width 300ms ease",
                            }}
                        >
                            <div
                                className="text-sm font-bold leading-tight"
                                style={{
                                    background: "none",
                                    WebkitBackgroundClip: "unset",
                                    WebkitTextFillColor: "var(--text-primary)",
                                    color: "var(--text-primary)",
                                    fontWeight: 700,
                                    maxWidth: "160px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {orgName}
                            </div>
                            <div className="text-[0.6rem] font-medium" style={{ color: "var(--text-muted)" }}>
                                AI Platform
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav style={{ flex: 1, paddingTop: "8px", paddingBottom: "8px" }}>
                        {NAV_ITEMS.map(item => {
                            const isActive = pathname === item.href ||
                                (item.href !== "/dashboard" && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={collapsed ? item.label : undefined}
                                    style={{
                                        position: "relative" as const,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "11px",
                                        margin: "2px 8px",
                                        borderRadius: "10px",
                                        color: isActive ? "#60a5fa" : "var(--text-secondary)",
                                        background: isActive ? "rgba(59, 130, 246, 0.08)" : "transparent",
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        textDecoration: "none",
                                        transition: "all 0.2s ease",
                                        justifyContent: collapsed ? "center" : "flex-start",
                                        overflow: collapsed ? "visible" : "hidden",
                                        whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                                        }
                                    }}
                                >
                                    <item.icon size={18} style={{ flexShrink: 0 }} />
                                    <span
                                        style={{
                                            opacity: collapsed ? 0 : 1,
                                            width: collapsed ? 0 : "auto",
                                            overflow: "hidden",
                                            transition: "opacity 200ms ease, width 300ms ease",
                                            flex: 1,
                                        }}
                                    >
                                        {item.label}
                                    </span>
                                    {/* Unread badge for Inbox */}
                                    {item.label === "Inbox" && unreadCount > 0 && (
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                minWidth: collapsed ? "16px" : "20px",
                                                height: collapsed ? "16px" : "20px",
                                                borderRadius: "100px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: collapsed ? "0.55rem" : "0.65rem",
                                                fontWeight: 700,
                                                background: "#ef4444",
                                                color: "#fff",
                                                padding: "0 4px",
                                                position: collapsed ? "absolute" as const : "relative" as const,
                                                top: collapsed ? "4px" : "auto",
                                                right: collapsed ? "4px" : "auto",
                                                boxShadow: "0 0 8px rgba(239,68,68,0.4)",
                                                animation: "badge-pulse 2s ease-in-out infinite",
                                            }}
                                        >
                                            {unreadCount > 9 ? "9+" : unreadCount}
                                        </span>
                                    )}
                                    {isActive && !collapsed && (
                                        <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User footer */}
                    <div
                        style={{
                            borderTop: "1px solid var(--border)",
                            padding: "12px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            justifyContent: collapsed ? "center" : "flex-start",
                            overflow: "hidden",
                            transition: "all 300ms ease",
                        }}
                    >
                        {/* Avatar */}
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                background: "var(--bg-card)",
                                color: "var(--accent-light)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            {userEmail[0]?.toUpperCase() || "U"}
                        </div>

                        {/* Email + role — hidden when collapsed */}
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                opacity: collapsed ? 0 : 1,
                                width: collapsed ? 0 : "auto",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                transition: "opacity 200ms ease, width 300ms ease",
                            }}
                        >
                            <div className="text-xs font-semibold truncate">{userEmail}</div>
                            <div className="text-[0.6rem]" style={{ color: "var(--text-muted)" }}>
                                {orgCtx?.role || "member"}
                            </div>
                        </div>

                        {/* Logout — hidden when collapsed */}
                        {!collapsed && (
                            <button
                                onClick={handleLogout}
                                title="Cerrar sesión"
                                style={{
                                    flexShrink: 0,
                                    padding: "4px",
                                    borderRadius: "6px",
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "color 0.2s ease",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </aside>

                {/* ── Topbar ─────────────────────────────── */}
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        left: sidebarW,
                        height: "52px",
                        zIndex: 30,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        padding: "0 24px",
                        borderBottom: "1px solid var(--border)",
                        background: "rgba(9,9,11,0.85)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        transition: "left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                        gap: "8px",
                    }}
                >
                    {orgCtx?.organization.id && (
                        <NotificationBell orgId={orgCtx.organization.id} />
                    )}
                </div>

                {/* ── Main Content ───────────────────── */}
                <main
                    className="page-container flex-1"
                    style={{
                        marginLeft: sidebarW,
                        paddingTop: "80px",
                        transition: "margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                >
                    {children}
                </main>

                {/* ── Toast Notifications ──────────────── */}
                {orgCtx?.organization.id && (
                    <ToastProvider orgId={orgCtx.organization.id} />
                )}

                {/* Badge pulse animation */}
                <style>{`
                    @keyframes badge-pulse {
                        0%, 100% { box-shadow: 0 0 4px rgba(239,68,68,0.3); }
                        50% { box-shadow: 0 0 12px rgba(239,68,68,0.6); }
                    }
                `}</style>
            </div>
        </OrgProvider>
    );
}

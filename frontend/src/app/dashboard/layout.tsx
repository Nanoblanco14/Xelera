"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { OrgProvider, type OrgContextType } from "@/lib/org-context";
import type { Organization } from "@/lib/types";
import {
    Home, Bot, Kanban, BarChart3, Package, MessageSquare,
    LogOut, Loader2, ChevronRight, Settings, AlertCircle,
    FileText, Calendar,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ToastProvider from "./Toast";
import { PlanBadge } from "@/components/plan";

const PAGE_LABELS: Record<string, string> = {
    "/dashboard": "Inicio",
    "/dashboard/inbox": "Inbox",
    "/dashboard/products": "Inventario",
    "/dashboard/pipeline": "Pipeline",
    "/dashboard/calendar": "Calendario",
    "/dashboard/templates": "Templates",
    "/dashboard/analytics": "Analítica",
    "/dashboard/agents": "Mi Asistente",
    "/dashboard/settings": "Configuración",
};

const NAV_ITEMS = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/dashboard/products", label: "Inventario", icon: Package },
    { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban },
    { href: "/dashboard/calendar", label: "Calendario", icon: Calendar },
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    <div style={{
                        width: "36px",
                        height: "36px",
                        border: "2px solid var(--border)",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                    }} />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", letterSpacing: "0.05em" }}>
                        Cargando
                    </span>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Error state
    if (error && !orgCtx) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
                <div className="glass-card" style={{ padding: "40px", maxWidth: "420px", textAlign: "center" }}>
                    <AlertCircle size={32} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
                    <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "8px", color: "var(--text-primary)" }}>
                        Error de Configuración
                    </h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "24px", lineHeight: 1.6 }}>
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
                        background: "var(--bg-deep)",
                        backgroundImage: "linear-gradient(180deg, rgba(122,158,138,0.03) 0%, rgba(14,14,13,0) 40%, rgba(100,130,170,0.015) 100%)",
                        borderRight: "none",
                        minHeight: "100vh",
                        position: "fixed",
                        top: 0,
                        left: 0,
                        zIndex: 40,
                        display: "flex",
                        flexDirection: "column",
                        transition: "width 300ms var(--ease-out-expo)",
                        overflow: "hidden",
                    }}
                >
                    {/* Logo / Brand */}
                    <div
                        style={{
                            borderBottom: "1px solid transparent",
                            borderImage: "linear-gradient(90deg, transparent, var(--border), transparent) 1",
                            padding: "20px 0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: collapsed ? "center" : "flex-start",
                            gap: "12px",
                            paddingLeft: collapsed ? 0 : "16px",
                            transition: "all 300ms var(--ease-out-expo)",
                            overflow: "hidden",
                        }}
                    >
                        {/* Icon — sage green gradient with pulse ring */}
                        <div style={{ flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px" }}>
                            {/* Pulse ring */}
                            <span style={{
                                position: "absolute",
                                inset: "-3px",
                                borderRadius: "13px",
                                border: "1px solid rgba(122,158,138,0.15)",
                                animation: "icon-pulse-ring 3.5s ease-in-out infinite",
                                pointerEvents: "none",
                            }} />
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "10px",
                                    background: "radial-gradient(circle at 40% 40%, #3a4a3e, #1a2020)",
                                    border: "0.5px solid rgba(122,158,138,0.25)",
                                    boxShadow: "0 0 16px rgba(122,158,138,0.15), 0 0 4px rgba(122,158,138,0.1)",
                                }}
                            >
                                <span style={{
                                    fontFamily: "'Playfair Display', Georgia, serif",
                                    fontSize: "1.1rem",
                                    fontWeight: 700,
                                    color: "#f0ede8",
                                    lineHeight: 1,
                                    textShadow: "0 0 8px rgba(122,158,138,0.3)",
                                }}>
                                    M
                                </span>
                            </div>
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
                                style={{
                                    fontFamily: "'Playfair Display', Georgia, serif",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                    maxWidth: "160px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {orgName}
                            </div>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                color: "var(--accent)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                marginTop: "3px",
                                background: "rgba(122,158,138,0.06)",
                                padding: "2px 8px 2px 7px",
                                borderRadius: "4px",
                                border: "0.5px solid rgba(122,158,138,0.1)",
                            }}>
                                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--accent)", opacity: 0.7 }} />
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
                                        borderRadius: "8px",
                                        color: isActive ? "var(--accent-light)" : "var(--text-secondary)",
                                        background: isActive
                                            ? "linear-gradient(90deg, rgba(122,158,138,0.12) 0%, rgba(122,158,138,0.03) 70%, transparent 100%)"
                                            : "transparent",
                                        fontSize: "0.85rem",
                                        fontWeight: isActive ? 600 : 500,
                                        textDecoration: "none",
                                        transition: "all 200ms var(--ease-smooth)",
                                        justifyContent: collapsed ? "center" : "flex-start",
                                        overflow: collapsed ? "visible" : "hidden",
                                        whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLAnchorElement).style.background = "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)";
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
                                    {/* Active indicator bar */}
                                    {isActive && (
                                        <span style={{
                                            position: "absolute",
                                            left: 0,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            width: "3px",
                                            height: "18px",
                                            background: "var(--accent)",
                                            borderRadius: "0 3px 3px 0",
                                            boxShadow: "0 0 8px rgba(122,158,138,0.35), 0 0 2px rgba(122,158,138,0.2)",
                                        }} />
                                    )}
                                    <item.icon size={18} style={{
                                        flexShrink: 0,
                                        strokeWidth: isActive ? 2.2 : 1.8,
                                        filter: isActive ? "drop-shadow(0 0 4px rgba(122,158,138,0.4))" : "none",
                                        transition: "filter 200ms ease",
                                    }} />
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
                                                minWidth: collapsed ? "18px" : "22px",
                                                height: collapsed ? "18px" : "22px",
                                                borderRadius: "100px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: collapsed ? "0.55rem" : "0.65rem",
                                                fontWeight: 700,
                                                background: "var(--danger)",
                                                color: "#fff",
                                                padding: "0 5px",
                                                position: collapsed ? "absolute" as const : "relative" as const,
                                                top: collapsed ? "2px" : "auto",
                                                right: collapsed ? "2px" : "auto",
                                                border: "2px solid var(--bg-deep)",
                                                boxShadow: "0 0 12px rgba(199,90,90,0.5), 0 0 4px rgba(199,90,90,0.3)",
                                                animation: "badge-pulse 2s ease-in-out infinite",
                                            }}
                                        >
                                            {unreadCount > 9 ? "9+" : unreadCount}
                                        </span>
                                    )}
                                    {isActive && !collapsed && (
                                        <ChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User footer */}
                    <div
                        style={{
                            borderTop: "1px solid transparent",
                            borderImage: "linear-gradient(90deg, transparent, var(--border), transparent) 1",
                            padding: "14px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            justifyContent: collapsed ? "center" : "flex-start",
                            overflow: "hidden",
                            transition: "all 300ms ease",
                        }}
                    >
                        {/* Avatar — sage accent with hover ring */}
                        <div
                            className="sidebar-avatar"
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                fontFamily: "'Playfair Display', Georgia, serif",
                                background: "var(--accent-subtle)",
                                color: "var(--accent-light)",
                                border: "1.5px solid rgba(122, 158, 138, 0.12)",
                                transition: "border-color 250ms ease, box-shadow 250ms ease",
                                cursor: "default",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.4)";
                                e.currentTarget.style.boxShadow = "0 0 8px rgba(122,158,138,0.15)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "rgba(122,158,138,0.12)";
                                e.currentTarget.style.boxShadow = "none";
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
                            <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{userEmail}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                                <span style={{
                                    display: "inline-block",
                                    fontSize: "0.58rem",
                                    fontWeight: 600,
                                    color: "var(--accent)",
                                    textTransform: "capitalize",
                                    background: "rgba(122,158,138,0.08)",
                                    padding: "1px 7px",
                                    borderRadius: "100px",
                                    border: "0.5px solid rgba(122,158,138,0.12)",
                                    letterSpacing: "0.03em",
                                }}>
                                    {orgCtx?.role || "member"}
                                </span>
                                <PlanBadge plan={orgCtx?.organization.plan || "free"} size="xs" />
                            </div>
                        </div>

                        {/* Logout — hidden when collapsed */}
                        {!collapsed && (
                            <button
                                onClick={handleLogout}
                                title="Cerrar sesión"
                                style={{
                                    flexShrink: 0,
                                    padding: "6px",
                                    borderRadius: "6px",
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 150ms ease",
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.color = "var(--danger)";
                                    e.currentTarget.style.background = "var(--danger-bg)";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.color = "var(--text-muted)";
                                    e.currentTarget.style.background = "none";
                                }}
                            >
                                <LogOut size={15} />
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
                        justifyContent: "space-between",
                        padding: "0 28px",
                        borderBottom: "none",
                        background: "rgba(14,14,13,0.88)",
                        backdropFilter: "blur(32px) saturate(1.3)",
                        WebkitBackdropFilter: "blur(32px) saturate(1.3)",
                        transition: "left 300ms var(--ease-out-expo)",
                        gap: "8px",
                    }}
                >
                    {/* Bottom gradient line */}
                    <span style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "1px",
                        background: "linear-gradient(90deg, transparent, var(--border), rgba(122,158,138,0.08), var(--border), transparent)",
                        pointerEvents: "none",
                    }} />

                    {/* Breadcrumb / page title */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            letterSpacing: "0.02em",
                        }}>
                            Dashboard
                        </span>
                        <span style={{
                            fontSize: "0.65rem",
                            color: "var(--text-dim)",
                            userSelect: "none",
                        }}>/</span>
                        <span className="font-display" style={{
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            letterSpacing: "-0.01em",
                        }}>
                            {PAGE_LABELS[pathname] || pathname.split("/").pop()?.replace(/-/g, " ")}
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {orgCtx?.organization.id && (
                            <NotificationBell orgId={orgCtx.organization.id} />
                        )}
                    </div>
                </div>

                {/* ── Main Content ───────────────────── */}
                <motion.main
                    key={pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="page-container flex-1"
                    style={{
                        marginLeft: sidebarW,
                        paddingTop: "84px",
                        transition: "margin-left 300ms var(--ease-out-expo)",
                        backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
                        backgroundSize: "60px 60px",
                    }}
                >
                    {children}
                </motion.main>

                {/* ── Toast Notifications ──────────────── */}
                {orgCtx?.organization.id && (
                    <ToastProvider orgId={orgCtx.organization.id} />
                )}

                {/* Dashboard layout animations */}
                <style>{`
                    @keyframes badge-pulse {
                        0%, 100% { box-shadow: 0 0 6px rgba(199,90,90,0.3), 0 0 2px rgba(199,90,90,0.2); }
                        50% { box-shadow: 0 0 16px rgba(199,90,90,0.55), 0 0 4px rgba(199,90,90,0.35); }
                    }
                    @keyframes icon-pulse-ring {
                        0%, 100% { opacity: 0; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.08); }
                    }
                `}</style>

                {/* Sidebar right gradient border (pseudo via extra element) */}
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: sidebarW,
                    width: "1px",
                    height: "100vh",
                    background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(122,158,138,0.08) 50%, rgba(255,255,255,0.06) 70%, transparent 100%)",
                    zIndex: 41,
                    pointerEvents: "none",
                    transition: "left 300ms var(--ease-out-expo)",
                }} />
            </div>
        </OrgProvider>
    );
}

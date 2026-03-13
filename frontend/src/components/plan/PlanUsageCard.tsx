"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/org-context";
import PlanBadge from "./PlanBadge";
import { Bot, Package, Users, MessageSquare, UserPlus, Loader2 } from "lucide-react";
import type { PlanTier } from "@/lib/types";

interface UsageItem {
    current: number;
    limit: number;
    percentage: number;
}

interface UsageData {
    plan: PlanTier;
    planName: string;
    usage: {
        agents: UsageItem;
        products: UsageItem;
        leads: UsageItem;
        conversations: UsageItem;
        team_members: UsageItem;
    };
}

const RESOURCE_META: Record<string, { label: string; icon: typeof Bot }> = {
    agents: { label: "Agentes", icon: Bot },
    products: { label: "Productos", icon: Package },
    leads: { label: "Leads", icon: Users },
    conversations: { label: "Conversaciones", icon: MessageSquare },
    team_members: { label: "Miembros", icon: UserPlus },
};

function UsageBar({ item, label, icon: Icon }: { item: UsageItem; label: string; icon: typeof Bot }) {
    const pct = Math.min(item.percentage, 100);
    const isHigh = pct >= 80;
    const isFull = pct >= 100;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon
                        size={13}
                        style={{
                            color: isFull
                                ? "var(--danger)"
                                : isHigh
                                    ? "#d4a017"
                                    : "var(--text-muted)",
                        }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {label}
                    </span>
                </div>
                <span
                    style={{
                        fontSize: "0.73rem",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: isFull
                            ? "var(--danger)"
                            : isHigh
                                ? "#d4a017"
                                : "var(--text-muted)",
                    }}
                >
                    {item.current} / {item.limit}
                </span>
            </div>
            <div
                style={{
                    height: "4px",
                    borderRadius: "2px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: "2px",
                        background: isFull
                            ? "var(--danger)"
                            : isHigh
                                ? "linear-gradient(90deg, #d4a017, #e8b631)"
                                : "linear-gradient(90deg, var(--accent-sage), rgba(122,158,138,0.6))",
                        transition: "width 0.6s ease",
                    }}
                />
            </div>
        </div>
    );
}

export default function PlanUsageCard() {
    const { organization } = useOrg();
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/plan/usage");
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch {
                // Silent
            } finally {
                setLoading(false);
            }
        })();
    }, [organization.id]);

    if (loading) {
        return (
            <div className="glass-card" style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
                <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
        );
    }

    if (!data) return null;

    const resources = ["agents", "products", "leads", "conversations", "team_members"] as const;

    return (
        <div className="glass-card" style={{ padding: "20px" }}>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "18px",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: "0.82rem",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            marginBottom: "4px",
                        }}
                    >
                        Tu plan actual
                    </div>
                    <PlanBadge plan={data.plan} size="md" />
                </div>
                {data.plan === "free" && (
                    <button
                        style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            color: "var(--accent-sage)",
                            background: "rgba(122,158,138,0.1)",
                            border: "1px solid rgba(122,158,138,0.2)",
                            borderRadius: "8px",
                            padding: "6px 14px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(122,158,138,0.18)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(122,158,138,0.1)";
                        }}
                    >
                        Mejorar plan
                    </button>
                )}
            </div>

            {/* Usage bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {resources.map((key) => {
                    const meta = RESOURCE_META[key];
                    const item = data.usage[key];
                    if (!item) return null;
                    return (
                        <UsageBar
                            key={key}
                            item={item}
                            label={meta.label}
                            icon={meta.icon}
                        />
                    );
                })}
            </div>
        </div>
    );
}

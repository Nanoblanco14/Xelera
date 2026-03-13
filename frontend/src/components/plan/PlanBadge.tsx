"use client";

import type { PlanTier } from "@/lib/types";

const PLAN_STYLES: Record<PlanTier, { bg: string; text: string; border: string; glow: string }> = {
    free: {
        bg: "rgba(255,255,255,0.04)",
        text: "rgba(255,255,255,0.5)",
        border: "rgba(255,255,255,0.08)",
        glow: "none",
    },
    pro: {
        bg: "rgba(122,158,138,0.12)",
        text: "var(--accent-sage)",
        border: "rgba(122,158,138,0.25)",
        glow: "0 0 12px rgba(122,158,138,0.15)",
    },
    business: {
        bg: "rgba(200,170,110,0.12)",
        text: "#c8aa6e",
        border: "rgba(200,170,110,0.25)",
        glow: "0 0 12px rgba(200,170,110,0.15)",
    },
};

export default function PlanBadge({
    plan,
    size = "sm",
}: {
    plan: PlanTier;
    size?: "xs" | "sm" | "md";
}) {
    const s = PLAN_STYLES[plan] || PLAN_STYLES.free;
    const label = plan.charAt(0).toUpperCase() + plan.slice(1);

    const fontSize = size === "xs" ? "0.6rem" : size === "sm" ? "0.65rem" : "0.75rem";
    const padding = size === "xs" ? "1px 6px" : size === "sm" ? "2px 8px" : "3px 10px";

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: s.text,
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: "6px",
                padding,
                boxShadow: s.glow,
                whiteSpace: "nowrap",
            }}
        >
            {plan !== "free" && (
                <span style={{ fontSize: "0.7em" }}>
                    {plan === "business" ? "\u2B50" : "\u26A1"}
                </span>
            )}
            {label}
        </span>
    );
}

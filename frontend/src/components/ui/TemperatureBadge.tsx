// 🌡️ TemperatureBadge — chip de scoring de intención de compra
// (Lead Scoring). Reutilizado en Pipeline e Inbox.
import { LEAD_TEMPERATURE_META } from "@/lib/types";

export default function TemperatureBadge({
    temperature,
    size = "md",
}: {
    temperature?: "caliente" | "tibio" | "frio" | null;
    size?: "xs" | "md";
}) {
    if (!temperature) return null;
    const meta = LEAD_TEMPERATURE_META[temperature];
    if (!meta) return null;

    return (
        <span
            title={`Intención de compra: ${meta.label}`}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                flexShrink: 0,
                padding: size === "xs" ? "1px 6px" : "2px 8px",
                borderRadius: "100px",
                fontSize: size === "xs" ? "0.56rem" : "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: meta.color,
                background: `${meta.color}18`,
                border: `0.5px solid ${meta.color}40`,
                whiteSpace: "nowrap",
            }}
        >
            {meta.emoji} {meta.label}
        </span>
    );
}

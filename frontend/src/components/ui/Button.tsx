"use client";
import { Loader2 } from "lucide-react";

// Átomo Button — envuelve .btn-primary / .btn-secondary de globals.css
export default function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    children,
    disabled,
    className = "",
    ...rest
}: {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const base =
        variant === "primary" ? "btn-primary"
        : variant === "secondary" ? "btn-secondary"
        : ""; // danger/ghost: estilos inline sobre la base secundaria

    const sizeStyle: React.CSSProperties =
        size === "sm" ? { fontSize: "0.78rem", padding: "7px 14px" }
        : size === "lg" ? { fontSize: "0.9rem", padding: "14px 32px" }
        : {};

    const variantStyle: React.CSSProperties =
        variant === "danger" ? {
            background: "var(--danger-bg)",
            border: "0.5px solid rgba(199,90,90,0.25)",
            color: "var(--danger)",
            borderRadius: "10px", padding: "10px 20px",
            display: "inline-flex", alignItems: "center", gap: "8px",
            fontWeight: 600, cursor: "pointer", ...sizeStyle,
        }
        : variant === "ghost" ? {
            background: "none", border: "none",
            color: "var(--text-secondary)",
            display: "inline-flex", alignItems: "center", gap: "8px",
            cursor: "pointer", padding: "8px 12px", borderRadius: "8px",
            fontWeight: 500, ...sizeStyle,
        }
        : sizeStyle;

    return (
        <button
            className={`${base} ${className}`.trim()}
            style={variantStyle}
            disabled={disabled || loading}
            {...rest}
        >
            {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
            {children}
        </button>
    );
}

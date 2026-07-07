"use client";

// Átomo Toggle — extraído del Toggle privado de AppointmentConfigSection
export default function Toggle({
    active,
    onToggle,
    label,
    description,
    hasBorder = true,
    disabled = false,
}: {
    active: boolean;
    onToggle: () => void;
    label: string;
    description?: string;
    hasBorder?: boolean;
    disabled?: boolean;
}) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "16px",
            padding: "13px 0",
            borderTop: hasBorder ? "0.5px solid rgba(255,255,255,0.04)" : "none",
            opacity: disabled ? 0.5 : 1,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                    fontSize: "0.83rem", fontWeight: 600,
                    color: "var(--text-primary)",
                }}>{label}</span>
                {description && (
                    <p style={{
                        fontSize: "0.72rem", color: "var(--text-muted)",
                        marginTop: "3px", lineHeight: 1.5,
                    }}>{description}</p>
                )}
            </div>
            <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                aria-pressed={active}
                style={{
                    flexShrink: 0, width: "40px", height: "22px",
                    borderRadius: "100px", border: "none",
                    cursor: disabled ? "default" : "pointer",
                    background: active ? "var(--accent)" : "rgba(255,255,255,0.1)",
                    position: "relative",
                    transition: "background 200ms var(--ease-smooth)",
                }}
            >
                <div style={{
                    position: "absolute", top: "3px",
                    left: active ? "21px" : "3px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: active ? "var(--bg-deep)" : "var(--text-secondary)",
                    transition: "left 200ms var(--ease-smooth), background 200ms ease",
                }} />
            </button>
        </div>
    );
}

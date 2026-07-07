"use client";

// Átomo Field — envuelve .input + .form-label + error/hint repetidos
export default function Field({
    label,
    error,
    hint,
    icon,
    ...inputProps
}: {
    label?: string;
    error?: string | null;
    hint?: React.ReactNode;
    icon?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="form-group">
            {label && <label className="form-label">{label}</label>}
            <div style={{ position: "relative" }}>
                {icon && (
                    <span style={{
                        position: "absolute", left: "10px", top: "50%",
                        transform: "translateY(-50%)", color: "var(--text-muted)",
                        pointerEvents: "none", display: "inline-flex",
                    }}>{icon}</span>
                )}
                <input
                    className="input"
                    style={icon ? { paddingLeft: "34px" } : undefined}
                    {...inputProps}
                />
            </div>
            {error && (
                <p style={{ color: "var(--danger)", fontSize: "0.72rem", marginTop: "6px" }}>
                    {error}
                </p>
            )}
            {!error && hint && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: "6px" }}>
                    {hint}
                </p>
            )}
        </div>
    );
}

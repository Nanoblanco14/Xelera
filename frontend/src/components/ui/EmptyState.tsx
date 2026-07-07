// Átomo EmptyState — estado vacío con guía accionable
export default function EmptyState({
    icon,
    title,
    hint,
    action,
}: {
    icon: React.ReactNode;
    title: string;
    hint?: string;
    action?: React.ReactNode;
}) {
    return (
        <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "12px", padding: "48px 24px", textAlign: "center",
        }}>
            <div style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: "var(--accent-subtle)",
                border: "0.5px solid var(--border-accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent-light)", opacity: 0.8,
            }}>
                {icon}
            </div>
            <p style={{
                fontSize: "0.95rem", fontWeight: 600,
                color: "var(--text-secondary)",
                fontFamily: "'Playfair Display', Georgia, serif",
            }}>{title}</p>
            {hint && (
                <p style={{
                    fontSize: "0.76rem", color: "var(--text-muted)",
                    maxWidth: "320px", lineHeight: 1.6,
                }}>{hint}</p>
            )}
            {action && <div style={{ marginTop: "6px" }}>{action}</div>}
        </div>
    );
}

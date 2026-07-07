// Átomo Badge — pill de estado (stage, plan, bot activo, etc.)
// Sustituye ~15 pills inline dispersas. Color = cualquier hex/var.
export default function Badge({
    children,
    color = "var(--accent)",
    size = "md",
    dot = false,
    title,
}: {
    children: React.ReactNode;
    /** hex ("#22c55e") o var CSS — tiñe texto, borde y fondo al 10-20% */
    color?: string;
    size?: "xs" | "md";
    dot?: boolean;
    title?: string;
}) {
    const isVar = color.startsWith("var(");
    const bg = isVar ? "var(--accent-subtle)" : `${color}14`;
    const border = isVar ? "var(--border-accent)" : `${color}30`;

    return (
        <span
            title={title}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: size === "xs" ? "1px 7px" : "3px 10px",
                borderRadius: "100px",
                fontSize: size === "xs" ? "0.58rem" : "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.03em",
                color,
                background: bg,
                border: `0.5px solid ${border}`,
                whiteSpace: "nowrap",
            }}
        >
            {dot && (
                <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: color, flexShrink: 0,
                }} />
            )}
            {children}
        </span>
    );
}

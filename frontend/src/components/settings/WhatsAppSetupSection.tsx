"use client";
import { useState } from "react";
import {
    MessageCircle,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    Loader2,
    Wifi,
    Copy,
    CheckCheck,
    Shield,
    Phone,
} from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import {
    useWhatsAppConnection,
    type ConnectionStatus,
} from "@/lib/hooks/useWhatsAppConnection";

interface WhatsAppSetupSectionProps {
    metaToken: string;
    metaPhoneId: string;
    businessAccountId: string;
    onMetaTokenChange: (value: string) => void;
    onMetaPhoneIdChange: (value: string) => void;
    onBusinessAccountIdChange: (value: string) => void;
    orgId: string;
    initialStatus?: ConnectionStatus;
}

export default function WhatsAppSetupSection({
    metaToken,
    metaPhoneId,
    businessAccountId,
    onMetaTokenChange,
    onMetaPhoneIdChange,
    onBusinessAccountIdChange,
    orgId,
    initialStatus,
}: WhatsAppSetupSectionProps) {
    const wa = useWhatsAppConnection(orgId);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Use initial status from parent or hook's live status
    const isConnected = wa.status.connected || initialStatus?.connected;
    const displayPhone = wa.status.display_phone || initialStatus?.display_phone;
    const verifiedName = wa.status.verified_name || initialStatus?.verified_name;
    const qualityRating = wa.status.quality_rating || initialStatus?.quality_rating;
    const webhookUrl = wa.status.webhook_url || initialStatus?.webhook_url || "";
    const verifyToken = wa.status.verify_token || initialStatus?.verify_token || "";

    const canConnect = !!(metaToken.trim() && metaPhoneId.trim() && businessAccountId.trim());

    const handleConnect = async () => {
        await wa.connect({
            access_token: metaToken,
            phone_number_id: metaPhoneId,
            business_account_id: businessAccountId,
        });
    };

    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <SectionCard
            icon={<MessageCircle size={16} />}
            title="Conecta tu WhatsApp Business"
            subtitle="Credenciales de Meta Cloud API para tu agente de IA"
            footer={
                <div className="flex items-center justify-between w-full">
                    {/* Connection Status Badge */}
                    <div className="flex items-center gap-2">
                        {isConnected ? (
                            <>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.4)" }} />
                                <span className="text-xs font-medium" style={{ color: "#22c55e" }}>Conectado</span>
                            </>
                        ) : (
                            <>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                                <span className="text-xs font-medium" style={{ color: "#f59e0b" }}>No conectado</span>
                            </>
                        )}
                    </div>

                    {/* Connect Button */}
                    <button
                        onClick={handleConnect}
                        disabled={!canConnect || wa.connecting}
                        className="flex items-center gap-2 text-sm font-semibold transition-all"
                        style={{
                            padding: "8px 20px",
                            borderRadius: "10px",
                            background: canConnect && !wa.connecting
                                ? "linear-gradient(135deg, #25d366 0%, #128c7e 100%)"
                                : "rgba(255,255,255,0.04)",
                            border: "none",
                            color: canConnect && !wa.connecting ? "white" : "rgba(255,255,255,0.2)",
                            cursor: canConnect && !wa.connecting ? "pointer" : "not-allowed",
                            boxShadow: canConnect && !wa.connecting ? "0 2px 12px rgba(37,211,102,0.25)" : "none",
                        }}
                    >
                        {wa.connecting ? (
                            <><Loader2 size={14} className="animate-spin" /> Conectando...</>
                        ) : isConnected ? (
                            <><Wifi size={14} /> Reconectar</>
                        ) : (
                            <><Wifi size={14} /> Verificar y Conectar</>
                        )}
                    </button>
                </div>
            }
        >
            {/* Connected phone info */}
            {isConnected && (
                <div
                    style={{
                        padding: "14px 18px",
                        borderRadius: "12px",
                        background: "rgba(34,197,94,0.04)",
                        border: "1px solid rgba(34,197,94,0.1)",
                        marginBottom: "16px",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center"
                            style={{
                                width: "36px", height: "36px", borderRadius: "10px",
                                background: "rgba(37,211,102,0.1)",
                                border: "1px solid rgba(37,211,102,0.15)",
                            }}
                        >
                            <Phone size={16} style={{ color: "#25d366" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs" style={{ color: "#f0f0f5" }}>
                                {verifiedName || "WhatsApp Business"}
                            </div>
                            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                                {displayPhone || metaPhoneId}
                            </div>
                        </div>
                        {qualityRating && <QualityBadge rating={qualityRating} />}
                    </div>
                </div>
            )}

            {/* Connection progress */}
            {wa.connecting && (
                <div style={{ marginBottom: "16px" }}>
                    {wa.allSteps.map((step) => {
                        const isCompleted = wa.completedSteps.includes(step);
                        const isCurrent = wa.currentStep === step;
                        return (
                            <div key={step} className="flex items-center gap-2 py-1.5">
                                {isCompleted ? <CheckCircle size={14} style={{ color: "#22c55e" }} />
                                    : isCurrent ? <Loader2 size={14} className="animate-spin" style={{ color: "#3b82f6" }} />
                                        : <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.1)" }} />}
                                <span className="text-xs" style={{ color: isCompleted ? "#22c55e" : isCurrent ? "#f0f0f5" : "rgba(255,255,255,0.2)" }}>
                                    {wa.stepLabels[step]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Error */}
            {wa.error && (
                <div
                    className="flex items-start gap-2 mb-4"
                    style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.12)",
                        color: "#f87171",
                        fontSize: "0.8rem",
                    }}
                >
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{wa.error}</span>
                </div>
            )}

            {/* Instructions */}
            <ol className="pl-[18px] mb-5 flex flex-col gap-2.5 text-[0.83rem] text-[var(--text-secondary)] leading-relaxed">
                <li>
                    <a
                        href="https://developers.facebook.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline inline-flex items-center gap-1 font-semibold"
                    >
                        Haz clic aqui para ir a Meta for Developers
                        <ExternalLink size={12} />
                    </a>
                    {" — "}
                    Crea una App de tipo <strong>Business</strong>.
                </li>
                <li>
                    Dentro de tu App, ve a <strong>WhatsApp → API Setup</strong>.
                    Copia el <strong>Phone Number ID</strong>, genera un <strong>Token permanente</strong> (desde System Users),
                    y anota el <strong>Business Account ID</strong> (WABA ID).
                </li>
                <li>
                    Pega esos valores en los campos de abajo y haz clic en{" "}
                    <strong>Verificar y Conectar</strong>. Verificaremos, registraremos el numero y suscribiremos los webhooks automaticamente.
                </li>
            </ol>

            <div className="grid gap-3">
                <div className="form-group !mb-0">
                    <label className="form-label">Token de Acceso (Access Token)</label>
                    <input
                        className="input"
                        type="password"
                        value={metaToken}
                        onChange={(e) => onMetaTokenChange(e.target.value)}
                        placeholder="EAAGm0PX4ZCpsBAG..."
                    />
                    <p className="text-xs mt-1 text-[var(--text-muted)]">
                        Token permanente generado desde Meta Business Settings → System Users.
                    </p>
                </div>
                <div className="form-group !mb-0">
                    <label className="form-label">Phone Number ID</label>
                    <input
                        className="input"
                        type="text"
                        value={metaPhoneId}
                        onChange={(e) => onMetaPhoneIdChange(e.target.value)}
                        placeholder="123456789012345"
                    />
                    <p className="text-xs mt-1 text-[var(--text-muted)]">
                        ID numerico del numero de telefono — no es tu numero de telefono.
                    </p>
                </div>
                <div className="form-group !mb-0">
                    <label className="form-label">Business Account ID (WABA ID)</label>
                    <input
                        className="input"
                        type="text"
                        value={businessAccountId}
                        onChange={(e) => onBusinessAccountIdChange(e.target.value)}
                        placeholder="987654321098765"
                    />
                    <p className="text-xs mt-1 text-[var(--text-muted)]">
                        ID de tu cuenta de WhatsApp Business — visible en la cabecera de API Setup.
                    </p>
                </div>
            </div>

            {/* Webhook info when connected */}
            {isConnected && webhookUrl && (
                <div style={{ marginTop: "16px" }} className="grid gap-2">
                    <div className="flex items-center gap-2">
                        <label className="form-label !mb-0 flex items-center gap-1.5">
                            <Wifi size={11} /> Webhook URL
                        </label>
                        <div className="flex-1 flex items-center gap-1.5">
                            <input
                                className="input"
                                type="text"
                                readOnly
                                value={webhookUrl}
                                style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                            />
                            <button
                                onClick={() => copyToClipboard(webhookUrl, "webhook")}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors"
                                style={{
                                    background: copiedField === "webhook" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                                    border: copiedField === "webhook" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                    color: copiedField === "webhook" ? "#34d399" : "var(--text-secondary)",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {copiedField === "webhook" ? <><CheckCheck size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="form-label !mb-0 flex items-center gap-1.5">
                            <Shield size={11} /> Verify Token
                        </label>
                        <div className="flex-1 flex items-center gap-1.5">
                            <input
                                className="input"
                                type="text"
                                readOnly
                                value={verifyToken}
                                style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                            />
                            <button
                                onClick={() => copyToClipboard(verifyToken, "verify")}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors"
                                style={{
                                    background: copiedField === "verify" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                                    border: copiedField === "verify" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                    color: copiedField === "verify" ? "#34d399" : "var(--text-secondary)",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {copiedField === "verify" ? <><CheckCheck size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

// ── Quality badge ─────────────────────────────────────────────
function QualityBadge({ rating }: { rating: string }) {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
        GREEN: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", text: "#22c55e" },
        YELLOW: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", text: "#f59e0b" },
        RED: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", text: "#ef4444" },
    };
    const c = colors[rating] || colors.GREEN;

    return (
        <span
            style={{
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
            }}
        >
            {rating}
        </span>
    );
}

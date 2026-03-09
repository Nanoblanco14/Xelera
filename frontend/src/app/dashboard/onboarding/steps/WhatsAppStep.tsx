"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageCircle,
    CheckCircle,
    BookOpen,
    Copy,
    CheckCheck,
    Loader2,
    ArrowLeft,
    ArrowRight,
    ExternalLink,
    AlertCircle,
    Shield,
    Wifi,
    Phone,
    Key,
    Hash,
    CircleDot,
} from "lucide-react";
import {
    useWhatsAppConnection,
    type ConnectCredentials,
} from "@/lib/hooks/useWhatsAppConnection";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════
export interface WhatsAppData {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId: string;
    connectionStatus: "idle" | "connecting" | "connected" | "error";
}

interface Props {
    data: WhatsAppData;
    onChange: (data: WhatsAppData) => void;
    webhookUrl: string;
    orgId: string;
}

type Mode = "select" | "quick" | "guided";
type GuidedSub = 0 | 1 | 2;

// ═══════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════
const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#f0f0f5",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "0.88rem",
    width: "100%",
    outline: "none",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    transition: "border-color 0.2s ease",
};

const inputFocusStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: "rgba(59,130,246,0.4)",
    boxShadow: "0 0 0 3px rgba(59,130,246,0.08)",
};

const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.55)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
};

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════
export default function WhatsAppStep({ data, onChange, webhookUrl, orgId }: Props) {
    const [mode, setMode] = useState<Mode>(
        data.connectionStatus === "connected" ? "quick" : "select"
    );
    const [guidedSub, setGuidedSub] = useState<GuidedSub>(0);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const wa = useWhatsAppConnection(orgId);

    // Check existing connection status on mount
    useEffect(() => {
        wa.checkStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync hook status → parent data
    useEffect(() => {
        if (wa.status.connected && data.connectionStatus !== "connected") {
            onChange({
                ...data,
                phoneNumberId: wa.status.phone_number_id || data.phoneNumberId,
                connectionStatus: "connected",
            });
            setMode("quick"); // Show connected state
        }
    }, [wa.status.connected]);

    // ── Copy handler ──────────────────────────────────────────
    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // ── Connect handler ───────────────────────────────────────
    const handleConnect = async () => {
        if (!data.phoneNumberId || !data.accessToken || !data.businessAccountId) return;

        onChange({ ...data, connectionStatus: "connecting" });

        const credentials: ConnectCredentials = {
            access_token: data.accessToken,
            phone_number_id: data.phoneNumberId,
            business_account_id: data.businessAccountId,
        };

        await wa.connect(credentials);

        if (wa.status.connected) {
            onChange({ ...data, connectionStatus: "connected" });
        }
    };

    // After connect completes, sync
    useEffect(() => {
        if (!wa.connecting && wa.status.connected) {
            onChange({ ...data, connectionStatus: "connected" });
        } else if (!wa.connecting && wa.error) {
            onChange({ ...data, connectionStatus: "error" });
        }
    }, [wa.connecting, wa.status.connected, wa.error]);

    const canConnect = !!(data.phoneNumberId.trim() && data.accessToken.trim() && data.businessAccountId.trim());

    // ═══════════════════════════════════════════════════════════
    //  RENDER: Connected State
    // ═══════════════════════════════════════════════════════════
    if (wa.status.connected) {
        return (
            <div className="max-w-xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {/* Success header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                            className="inline-flex items-center justify-center mb-4"
                            style={{
                                width: "72px", height: "72px", borderRadius: "20px",
                                background: "rgba(34,197,94,0.1)",
                                border: "1.5px solid rgba(34,197,94,0.2)",
                            }}
                        >
                            <CheckCircle size={36} style={{ color: "#22c55e" }} />
                        </motion.div>
                        <h2 className="text-2xl font-bold mb-2" style={{ color: "#f0f0f5" }}>
                            WhatsApp Conectado
                        </h2>
                        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.95rem" }}>
                            Tu agente de IA ya puede recibir y responder mensajes.
                        </p>
                    </div>

                    {/* Phone info card */}
                    <div
                        style={{
                            padding: "20px 24px",
                            borderRadius: "16px",
                            background: "rgba(34,197,94,0.04)",
                            border: "1px solid rgba(34,197,94,0.12)",
                            marginBottom: "16px",
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: "48px", height: "48px", borderRadius: "14px",
                                    background: "rgba(37,211,102,0.1)",
                                    border: "1px solid rgba(37,211,102,0.15)",
                                }}
                            >
                                <Phone size={22} style={{ color: "#25d366" }} />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-sm" style={{ color: "#f0f0f5" }}>
                                    {wa.status.verified_name || "WhatsApp Business"}
                                </div>
                                <div className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                                    {wa.status.display_phone || data.phoneNumberId}
                                </div>
                            </div>
                            {wa.status.quality_rating && (
                                <QualityBadge rating={wa.status.quality_rating} />
                            )}
                        </div>
                    </div>

                    {/* Webhook URL + Verify Token */}
                    <div className="space-y-3">
                        <CopyField
                            label="Webhook URL"
                            icon={<Wifi size={12} />}
                            value={wa.status.webhook_url || webhookUrl}
                            copied={copiedField === "webhook"}
                            onCopy={() => copyToClipboard(wa.status.webhook_url || webhookUrl, "webhook")}
                        />
                        <CopyField
                            label="Verify Token"
                            icon={<Shield size={12} />}
                            value={wa.status.verify_token || ""}
                            copied={copiedField === "verify"}
                            onCopy={() => copyToClipboard(wa.status.verify_token || "", "verify")}
                        />
                    </div>

                    {/* Webhook instructions */}
                    <div
                        style={{
                            marginTop: "16px",
                            padding: "14px 18px",
                            borderRadius: "12px",
                            background: "rgba(59,130,246,0.04)",
                            border: "1px solid rgba(59,130,246,0.1)",
                            color: "rgba(255,255,255,0.45)",
                            fontSize: "0.82rem",
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: "rgba(255,255,255,0.7)" }}>Ultimo paso en Meta:</strong>{" "}
                        Ve a tu App en{" "}
                        <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 underline inline-flex items-center gap-1">
                            developers.facebook.com <ExternalLink size={10} />
                        </a>{" "}
                        → WhatsApp → Configuration → Callback URL. Pega el Webhook URL y Verify Token de arriba.
                        Suscribete al campo <strong style={{ color: "rgba(255,255,255,0.6)" }}>messages</strong>.
                    </div>
                </motion.div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER: Connecting Progress
    // ═══════════════════════════════════════════════════════════
    if (wa.connecting) {
        return (
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    <div
                        className="inline-flex items-center justify-center mb-4"
                        style={{
                            width: "64px", height: "64px", borderRadius: "18px",
                            background: "rgba(59,130,246,0.1)",
                            border: "1px solid rgba(59,130,246,0.15)",
                        }}
                    >
                        <Loader2 size={30} className="animate-spin" style={{ color: "#3b82f6" }} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: "#f0f0f5" }}>
                        Conectando WhatsApp
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.92rem" }}>
                        Verificando credenciales y configurando tu agente...
                    </p>
                </div>

                <div
                    style={{
                        padding: "24px",
                        borderRadius: "16px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    {wa.allSteps.map((step, i) => {
                        const isCompleted = wa.completedSteps.includes(step);
                        const isCurrent = wa.currentStep === step;
                        const isFailed = wa.failedStep === step;
                        const isPending = !isCompleted && !isCurrent && !isFailed;

                        return (
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.3 }}
                                className="flex items-center gap-3"
                                style={{
                                    padding: "14px 0",
                                    borderBottom: i < wa.allSteps.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                }}
                            >
                                {/* Icon */}
                                <div className="flex items-center justify-center" style={{ width: "28px", height: "28px" }}>
                                    {isCompleted && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                        >
                                            <CheckCircle size={20} style={{ color: "#22c55e" }} />
                                        </motion.div>
                                    )}
                                    {isCurrent && <Loader2 size={20} className="animate-spin" style={{ color: "#3b82f6" }} />}
                                    {isFailed && <AlertCircle size={20} style={{ color: "#ef4444" }} />}
                                    {isPending && <CircleDot size={20} style={{ color: "rgba(255,255,255,0.15)" }} />}
                                </div>

                                {/* Label */}
                                <span
                                    style={{
                                        fontSize: "0.9rem",
                                        fontWeight: isCurrent ? 600 : 400,
                                        color: isCompleted
                                            ? "#22c55e"
                                            : isCurrent
                                                ? "#f0f0f5"
                                                : isFailed
                                                    ? "#ef4444"
                                                    : "rgba(255,255,255,0.25)",
                                        transition: "color 0.3s ease",
                                    }}
                                >
                                    {wa.stepLabels[step]}
                                    {isCompleted && " ✓"}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Error message */}
                {wa.error && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            marginTop: "16px",
                            padding: "14px 18px",
                            borderRadius: "12px",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: "#f87171",
                            fontSize: "0.85rem",
                        }}
                    >
                        {wa.error}
                    </motion.div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER: Mode Selection
    // ═══════════════════════════════════════════════════════════
    if (mode === "select") {
        return (
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    <div
                        className="inline-flex items-center justify-center mb-4"
                        style={{
                            width: "64px", height: "64px", borderRadius: "18px",
                            background: "rgba(37,211,102,0.1)",
                            border: "1px solid rgba(37,211,102,0.15)",
                        }}
                    >
                        <MessageCircle size={32} style={{ color: "#25d366" }} />
                    </div>
                    <h2 className="text-3xl font-bold mb-3" style={{ color: "#f0f0f5" }}>
                        Conectar WhatsApp
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                        Conecta tu numero de WhatsApp Business para que tu agente de IA responda automaticamente.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ModeCard
                        icon={<CheckCircle size={28} />}
                        iconColor="#22c55e"
                        iconBg="rgba(34,197,94,0.1)"
                        iconBorder="rgba(34,197,94,0.15)"
                        title="Ya tengo WhatsApp Business"
                        description="Tengo mi Phone Number ID, Access Token y WABA ID listos"
                        onClick={() => setMode("quick")}
                        delay={0}
                    />
                    <ModeCard
                        icon={<BookOpen size={28} />}
                        iconColor="#3b82f6"
                        iconBg="rgba(59,130,246,0.1)"
                        iconBorder="rgba(59,130,246,0.15)"
                        title="Configurar desde cero"
                        description="Necesito instrucciones paso a paso para configurar Meta Cloud API"
                        onClick={() => { setMode("guided"); setGuidedSub(0); }}
                        delay={0.08}
                    />
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER: Guided Mode
    // ═══════════════════════════════════════════════════════════
    if (mode === "guided") {
        return (
            <div className="max-w-xl mx-auto">
                {/* Back to mode select */}
                <button
                    onClick={() => setMode("select")}
                    className="flex items-center gap-2 mb-6 transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", cursor: "pointer", background: "none", border: "none" }}
                >
                    <ArrowLeft size={14} /> Volver a opciones
                </button>

                {/* Mini progress */}
                <div className="flex items-center gap-2 mb-6">
                    {[0, 1, 2].map((s) => (
                        <div key={s} className="flex items-center" style={{ flex: s < 2 ? 1 : "none" }}>
                            <div
                                style={{
                                    width: "28px", height: "28px", borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.75rem", fontWeight: 700,
                                    background: s < guidedSub ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : s === guidedSub ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                                    border: s === guidedSub ? "2px solid #3b82f6" : s < guidedSub ? "2px solid transparent" : "2px solid rgba(255,255,255,0.08)",
                                    color: s <= guidedSub ? "white" : "rgba(255,255,255,0.25)",
                                }}
                            >
                                {s < guidedSub ? <CheckCircle size={14} /> : s + 1}
                            </div>
                            {s < 2 && (
                                <div style={{ flex: 1, height: "2px", margin: "0 6px", borderRadius: "2px", background: s < guidedSub ? "linear-gradient(90deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.06)" }} />
                            )}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={guidedSub}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.25 }}
                    >
                        {guidedSub === 0 && (
                            <GuidedStep
                                number={1}
                                title="Crear App en Meta"
                                content={
                                    <>
                                        <ol className="space-y-3 text-sm" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, paddingLeft: "16px" }}>
                                            <li>
                                                Ve a{" "}
                                                <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer"
                                                    className="text-blue-400 underline inline-flex items-center gap-1 font-semibold">
                                                    Meta for Developers <ExternalLink size={11} />
                                                </a>
                                            </li>
                                            <li>Crea una App de tipo <strong style={{ color: "rgba(255,255,255,0.7)" }}>Business</strong></li>
                                            <li>Dentro de tu App, agrega el producto <strong style={{ color: "rgba(255,255,255,0.7)" }}>WhatsApp</strong></li>
                                            <li>En <strong style={{ color: "rgba(255,255,255,0.7)" }}>WhatsApp → API Setup</strong>, agrega el numero de telefono que usara tu agente de IA</li>
                                        </ol>
                                    </>
                                }
                            />
                        )}

                        {guidedSub === 1 && (
                            <GuidedStep
                                number={2}
                                title="Obtener credenciales"
                                content={
                                    <>
                                        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
                                            En tu panel de Meta for Developers, encuentra estos 3 datos:
                                        </p>
                                        <div className="space-y-3">
                                            <CredentialGuide
                                                icon={<Hash size={14} />}
                                                name="Phone Number ID"
                                                where="WhatsApp → API Setup → numero seleccionado"
                                                example="Ej: 123456789012345"
                                            />
                                            <CredentialGuide
                                                icon={<Key size={14} />}
                                                name="Access Token"
                                                where="Genera un token permanente desde Business Settings → System Users"
                                                example="Ej: EAAx..."
                                            />
                                            <CredentialGuide
                                                icon={<Shield size={14} />}
                                                name="Business Account ID (WABA ID)"
                                                where="WhatsApp → API Setup → en el encabezado de la pagina"
                                                example="Ej: 987654321098765"
                                            />
                                        </div>
                                    </>
                                }
                            />
                        )}

                        {guidedSub === 2 && (
                            <div>
                                <h3 className="text-lg font-bold mb-1" style={{ color: "#f0f0f5" }}>
                                    3. Conectar
                                </h3>
                                <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                                    Pega tus credenciales y verificaremos la conexion automaticamente.
                                </p>
                                <CredentialForm
                                    data={data}
                                    onChange={onChange}
                                    focusedInput={focusedInput}
                                    setFocusedInput={setFocusedInput}
                                />
                                {/* Error from previous attempt */}
                                {wa.error && (
                                    <div style={{ marginTop: "12px", padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: "0.83rem" }}>
                                        {wa.error}
                                    </div>
                                )}
                                <motion.button
                                    whileHover={canConnect ? { scale: 1.02 } : {}}
                                    whileTap={canConnect ? { scale: 0.98 } : {}}
                                    onClick={handleConnect}
                                    disabled={!canConnect}
                                    style={{
                                        marginTop: "20px",
                                        width: "100%",
                                        padding: "14px",
                                        borderRadius: "12px",
                                        fontSize: "0.95rem",
                                        fontWeight: 600,
                                        border: "none",
                                        cursor: canConnect ? "pointer" : "not-allowed",
                                        background: canConnect
                                            ? "linear-gradient(135deg, #25d366 0%, #128c7e 100%)"
                                            : "rgba(255,255,255,0.04)",
                                        color: canConnect ? "white" : "rgba(255,255,255,0.2)",
                                        boxShadow: canConnect ? "0 4px 20px rgba(37,211,102,0.3)" : "none",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <Wifi size={18} /> Verificar y Conectar
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Guided navigation */}
                {guidedSub < 2 && (
                    <div className="flex justify-between mt-6">
                        <button
                            onClick={() => setGuidedSub((s) => Math.max(0, s - 1) as GuidedSub)}
                            disabled={guidedSub === 0}
                            className="flex items-center gap-2 text-sm transition-colors"
                            style={{
                                padding: "10px 20px", borderRadius: "10px",
                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                color: guidedSub === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                                cursor: guidedSub === 0 ? "not-allowed" : "pointer",
                            }}
                        >
                            <ArrowLeft size={14} /> Anterior
                        </button>
                        <button
                            onClick={() => setGuidedSub((s) => Math.min(2, s + 1) as GuidedSub)}
                            className="flex items-center gap-2 text-sm font-medium transition-colors"
                            style={{
                                padding: "10px 20px", borderRadius: "10px",
                                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                                color: "#60a5fa", cursor: "pointer",
                            }}
                        >
                            Siguiente <ArrowRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER: Quick Connect Mode
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="max-w-xl mx-auto">
            {/* Back to mode select */}
            <button
                onClick={() => setMode("select")}
                className="flex items-center gap-2 mb-6 transition-colors"
                style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", cursor: "pointer", background: "none", border: "none" }}
            >
                <ArrowLeft size={14} /> Volver a opciones
            </button>

            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2" style={{ color: "#f0f0f5" }}>
                    Conexion Rapida
                </h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.92rem" }}>
                    Ingresa tus credenciales de Meta WhatsApp Cloud API
                </p>
            </div>

            <CredentialForm
                data={data}
                onChange={onChange}
                focusedInput={focusedInput}
                setFocusedInput={setFocusedInput}
            />

            {/* Error from previous attempt */}
            {wa.error && (
                <div style={{ marginTop: "12px", padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: "0.83rem" }}>
                    {wa.error}
                </div>
            )}

            {/* Connect button */}
            <motion.button
                whileHover={canConnect ? { scale: 1.02 } : {}}
                whileTap={canConnect ? { scale: 0.98 } : {}}
                onClick={handleConnect}
                disabled={!canConnect}
                style={{
                    marginTop: "20px",
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: canConnect ? "pointer" : "not-allowed",
                    background: canConnect
                        ? "linear-gradient(135deg, #25d366 0%, #128c7e 100%)"
                        : "rgba(255,255,255,0.04)",
                    color: canConnect ? "white" : "rgba(255,255,255,0.2)",
                    boxShadow: canConnect ? "0 4px 20px rgba(37,211,102,0.3)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                }}
            >
                <Wifi size={18} /> Verificar y Conectar
            </motion.button>

            {/* Skip note */}
            <div
                style={{
                    marginTop: "16px",
                    padding: "14px 18px",
                    borderRadius: "12px",
                    background: "rgba(245,158,11,0.04)",
                    border: "1px solid rgba(245,158,11,0.1)",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "0.82rem",
                }}
            >
                Si aun no tienes tu cuenta de WhatsApp Business configurada, puedes{" "}
                <strong style={{ color: "rgba(255,255,255,0.65)" }}>saltarte este paso</strong>{" "}
                y configurarlo despues en Ajustes.
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function ModeCard({ icon, iconColor, iconBg, iconBorder, title, description, onClick, delay: d }: {
    icon: React.ReactNode; iconColor: string; iconBg: string; iconBorder: string;
    title: string; description: string; onClick: () => void; delay: number;
}) {
    return (
        <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: d, duration: 0.35 }}
            whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.12)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            style={{
                padding: "28px 24px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.02)",
                border: "1.5px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.25s ease",
            }}
        >
            <div
                className="inline-flex items-center justify-center mb-4"
                style={{
                    width: "56px", height: "56px", borderRadius: "16px",
                    background: iconBg,
                    border: `1px solid ${iconBorder}`,
                    color: iconColor,
                }}
            >
                {icon}
            </div>
            <h3 className="font-bold text-sm mb-2" style={{ color: "#f0f0f5" }}>{title}</h3>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", lineHeight: 1.5 }}>{description}</p>
        </motion.button>
    );
}

function CredentialForm({ data, onChange, focusedInput, setFocusedInput }: {
    data: WhatsAppData;
    onChange: (d: WhatsAppData) => void;
    focusedInput: string | null;
    setFocusedInput: (f: string | null) => void;
}) {
    return (
        <div className="space-y-4">
            <div>
                <label style={labelStyle}><Hash size={12} /> Phone Number ID</label>
                <input
                    type="text"
                    value={data.phoneNumberId}
                    onChange={(e) => onChange({ ...data, phoneNumberId: e.target.value })}
                    onFocus={() => setFocusedInput("phone")}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="Ej: 123456789012345"
                    style={focusedInput === "phone" ? inputFocusStyle : inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}><Key size={12} /> Access Token</label>
                <input
                    type="password"
                    value={data.accessToken}
                    onChange={(e) => onChange({ ...data, accessToken: e.target.value })}
                    onFocus={() => setFocusedInput("token")}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="EAAx..."
                    style={focusedInput === "token" ? inputFocusStyle : inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}><Shield size={12} /> Business Account ID (WABA ID)</label>
                <input
                    type="text"
                    value={data.businessAccountId}
                    onChange={(e) => onChange({ ...data, businessAccountId: e.target.value })}
                    onFocus={() => setFocusedInput("waba")}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="Ej: 987654321098765"
                    style={focusedInput === "waba" ? inputFocusStyle : inputStyle}
                />
            </div>
        </div>
    );
}

function CopyField({ label, icon, value, copied, onCopy }: {
    label: string; icon: React.ReactNode; value: string; copied: boolean; onCopy: () => void;
}) {
    return (
        <div>
            <label style={{ ...labelStyle, marginBottom: "6px" }}>{icon} {label}</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    readOnly
                    style={{
                        ...inputStyle,
                        flex: 1,
                        fontSize: "0.73rem",
                        color: "rgba(255,255,255,0.35)",
                        background: "rgba(255,255,255,0.02)",
                    }}
                />
                <button
                    onClick={onCopy}
                    className="flex items-center gap-2 transition-all"
                    style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        background: copied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                        border: copied ? "1.5px solid rgba(16,185,129,0.3)" : "1.5px solid rgba(255,255,255,0.08)",
                        color: copied ? "#34d399" : "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                    }}
                >
                    {copied ? <><CheckCheck size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                </button>
            </div>
        </div>
    );
}

function QualityBadge({ rating }: { rating: string }) {
    const colors = {
        GREEN: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", text: "#22c55e" },
        YELLOW: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", text: "#f59e0b" },
        RED: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", text: "#ef4444" },
    };
    const c = colors[rating as keyof typeof colors] || colors.GREEN;

    return (
        <span
            style={{
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "0.7rem",
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

function GuidedStep({ number, title, content }: { number: number; title: string; content: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-lg font-bold mb-1" style={{ color: "#f0f0f5" }}>
                {number}. {title}
            </h3>
            <div
                style={{
                    marginTop: "16px",
                    padding: "20px 24px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                {content}
            </div>
        </div>
    );
}

function CredentialGuide({ icon, name, where, example }: {
    icon: React.ReactNode; name: string; where: string; example: string;
}) {
    return (
        <div
            style={{
                padding: "14px 16px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
            }}
        >
            <div className="flex items-center gap-2 mb-1">
                <span style={{ color: "#60a5fa" }}>{icon}</span>
                <span className="font-semibold text-sm" style={{ color: "#f0f0f5" }}>{name}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", lineHeight: 1.5, marginBottom: "4px" }}>
                {where}
            </p>
            <code style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                {example}
            </code>
        </div>
    );
}

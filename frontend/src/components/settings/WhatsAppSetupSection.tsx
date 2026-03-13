"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
    CheckCircle,
    AlertCircle,
    Loader2,
    Wifi,
    Copy,
    CheckCheck,
    Shield,
    Phone,
    ChevronDown,
    ChevronRight,
    Settings2,
    ExternalLink,
    X,
    Info,
} from "lucide-react";
import {
    useWhatsAppConnection,
    type ConnectionStatus,
} from "@/lib/hooks/useWhatsAppConnection";

// ═══════════════════════════════════════════════════════════════
//  Facebook SDK global types
// ═══════════════════════════════════════════════════════════════
declare global {
    interface Window {
        fbAsyncInit: () => void;
        FB: {
            init: (params: {
                appId: string;
                cookie: boolean;
                xfbml: boolean;
                version: string;
            }) => void;
            login: (
                callback: (response: {
                    authResponse?: { code?: string };
                }) => void,
                options: Record<string, unknown>
            ) => void;
        };
    }
}

// ═══════════════════════════════════════════════════════════════
//  Props
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || "";
const EMBEDDED_SIGNUP_AVAILABLE = !!(META_APP_ID && META_CONFIG_ID);

// ═══════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════
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
    const [showManual, setShowManual] = useState(false);
    const [showFbModal, setShowFbModal] = useState(false);
    const [fbSdkReady, setFbSdkReady] = useState(false);
    const [embeddedMode, setEmbeddedMode] = useState(false);

    const signupDataRef = useRef<{ phone_number_id?: string; waba_id?: string }>({});

    // ── Derived state ────────────────────────────────────────
    const isConnected = wa.status.connected || initialStatus?.connected;
    const displayPhone = wa.status.display_phone || initialStatus?.display_phone;
    const verifiedName = wa.status.verified_name || initialStatus?.verified_name;
    const qualityRating = wa.status.quality_rating || initialStatus?.quality_rating;
    const webhookUrl = wa.status.webhook_url || initialStatus?.webhook_url || "";
    const verifyToken = wa.status.verify_token || initialStatus?.verify_token || "";
    const canConnect = !!(metaToken.trim() && metaPhoneId.trim() && businessAccountId.trim());
    const activeSteps = embeddedMode ? wa.embeddedSteps : wa.manualSteps;

    // ── Load Facebook SDK ────────────────────────────────────
    useEffect(() => {
        if (!EMBEDDED_SIGNUP_AVAILABLE) return;
        if (typeof window === "undefined") return;
        if (window.FB) {
            setFbSdkReady(true);
            return;
        }

        window.fbAsyncInit = () => {
            window.FB.init({
                appId: META_APP_ID,
                cookie: true,
                xfbml: true,
                version: "v21.0",
            });
            setFbSdkReady(true);
        };

        if (!document.getElementById("facebook-jssdk")) {
            const script = document.createElement("script");
            script.id = "facebook-jssdk";
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    }, []);

    // ── Listen for WA_EMBEDDED_SIGNUP postMessage events ─────
    useEffect(() => {
        if (!EMBEDDED_SIGNUP_AVAILABLE) return;

        const handler = (event: MessageEvent) => {
            if (
                event.origin !== "https://www.facebook.com" &&
                event.origin !== "https://web.facebook.com"
            ) {
                return;
            }
            try {
                const data =
                    typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : event.data;
                if (data.type === "WA_EMBEDDED_SIGNUP") {
                    if (data.event === "FINISH" && data.data) {
                        signupDataRef.current = {
                            phone_number_id: data.data.phone_number_id,
                            waba_id: data.data.waba_id,
                        };
                    }
                }
            } catch {
                // Not a JSON message we care about
            }
        };

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    // ── Embedded signup: launch Facebook login ───────────────
    const launchEmbeddedSignup = useCallback(() => {
        if (!fbSdkReady || !window.FB) return;

        setShowFbModal(false);
        setEmbeddedMode(true);
        signupDataRef.current = {};

        window.FB.login(
            (response) => {
                if (response.authResponse?.code) {
                    const code = response.authResponse.code;
                    setTimeout(() => {
                        const phoneId = signupDataRef.current.phone_number_id || "";
                        const wabaId = signupDataRef.current.waba_id || "";

                        wa.connectViaEmbeddedSignup({
                            code,
                            phone_number_id: phoneId,
                            waba_id: wabaId,
                        });

                        if (phoneId) onMetaPhoneIdChange(phoneId);
                        if (wabaId) onBusinessAccountIdChange(wabaId);
                    }, 500);
                } else {
                    setEmbeddedMode(false);
                }
            },
            {
                config_id: META_CONFIG_ID,
                response_type: "code",
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: "",
                    sessionInfoVersion: 2,
                },
            }
        );
    }, [fbSdkReady, wa, onMetaPhoneIdChange, onBusinessAccountIdChange]);

    // ── Manual connect ───────────────────────────────────────
    const handleManualConnect = async () => {
        setEmbeddedMode(false);
        await wa.connect({
            access_token: metaToken,
            phone_number_id: metaPhoneId,
            business_account_id: businessAccountId,
        });
    };

    // ── Copy helper ──────────────────────────────────────────
    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // ── Reset for reconnect ──────────────────────────────────
    const handleReconnect = () => {
        wa.reset();
        setEmbeddedMode(false);
        setShowManual(false);
    };

    // ── Lock scroll when modal is open ───────────────────────
    const savedScrollRef = useRef(0);
    useEffect(() => {
        if (showFbModal) {
            savedScrollRef.current = document.documentElement.scrollTop;
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
        } else {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
            // Restore scroll position after browser re-enables scrolling
            requestAnimationFrame(() => {
                document.documentElement.scrollTop = savedScrollRef.current;
            });
        }
        return () => {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
        };
    }, [showFbModal]);

    // ── Handle "Conectar" click ──────────────────────────────
    const handleConectar = () => {
        if (EMBEDDED_SIGNUP_AVAILABLE) {
            setShowFbModal(true);
        } else {
            setShowManual(true);
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <div
            className="glass-card cursor-default"
            style={{
                padding: "0",
                borderRadius: "16px",
                overflow: "hidden",
            }}
        >
            {/* ──────────────────────────────────────────────── */}
            {/*  CONNECTED STATE                                */}
            {/* ──────────────────────────────────────────────── */}
            {isConnected && (
                <div style={{ padding: "28px" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "12px",
                                    background: "rgba(37,211,102,0.1)",
                                    border: "0.5px solid rgba(37,211,102,0.15)",
                                }}
                            >
                                <WhatsAppIcon size={22} />
                            </div>
                            <div>
                                <div
                                    className="text-sm font-bold"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    WhatsApp Business
                                </div>
                                <StatusBadge connected />
                            </div>
                        </div>
                        <button
                            onClick={handleReconnect}
                            className="flex items-center gap-1.5 text-xs font-medium transition-all"
                            style={{
                                padding: "7px 14px",
                                borderRadius: "8px",
                                background: "rgba(255,255,255,0.04)",
                                border: "0.5px solid rgba(255,255,255,0.08)",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                            }}
                        >
                            <Wifi size={12} />
                            Reconectar
                        </button>
                    </div>

                    {/* Phone info */}
                    <div
                        style={{
                            padding: "14px 18px",
                            borderRadius: "12px",
                            background: "rgba(34,197,94,0.04)",
                            border: "0.5px solid rgba(34,197,94,0.1)",
                            marginBottom: webhookUrl ? "14px" : "0",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Phone size={16} style={{ color: "#25d366" }} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                    {verifiedName || "WhatsApp Business"}
                                </div>
                                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    {displayPhone || metaPhoneId}
                                </div>
                            </div>
                            {qualityRating && <QualityBadge rating={qualityRating} />}
                        </div>
                    </div>

                    {/* Webhook info */}
                    {webhookUrl && (
                        <div className="grid gap-2">
                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    background: "rgba(122, 158, 138, 0.08)",
                                    border: "0.5px solid rgba(122, 158, 138, 0.15)",
                                    marginBottom: "2px",
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: "11.5px",
                                        lineHeight: "1.5",
                                        color: "var(--text-secondary)",
                                        margin: 0,
                                    }}
                                >
                                    <strong style={{ color: "var(--text-primary)" }}>
                                        Configura tu Webhook en Meta:
                                    </strong>{" "}
                                    Copia estos datos e ingresalos en{" "}
                                    <span style={{ color: "var(--accent)" }}>
                                        Meta for Developers → Tu App → WhatsApp → Configuracion → Webhook
                                    </span>
                                </p>
                            </div>
                            <CopyField
                                icon={<Wifi size={11} />}
                                label="Webhook URL"
                                value={webhookUrl}
                                fieldKey="webhook"
                                copiedField={copiedField}
                                onCopy={copyToClipboard}
                            />
                            <CopyField
                                icon={<Shield size={11} />}
                                label="Verify Token"
                                value={verifyToken}
                                fieldKey="verify"
                                copiedField={copiedField}
                                onCopy={copyToClipboard}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ──────────────────────────────────────────────── */}
            {/*  DISCONNECTED STATE                             */}
            {/* ──────────────────────────────────────────────── */}
            {!isConnected && (
                <div style={{ padding: "40px 28px 28px" }}>
                    {/* Connection progress animation */}
                    {wa.connecting && (
                        <div style={{ marginBottom: "24px" }}>
                            <StepProgress
                                steps={activeSteps}
                                labels={wa.stepLabels}
                                completedSteps={wa.completedSteps}
                                currentStep={wa.currentStep}
                            />
                        </div>
                    )}

                    {/* Error banner */}
                    {wa.error && <ErrorBanner message={wa.error} />}

                    {/* Main CTA area - always visible when not connecting */}
                    {!wa.connecting && (
                        <div style={{ textAlign: "center" }}>
                            {/* WhatsApp icon */}
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "18px",
                                    background: "rgba(37,211,102,0.08)",
                                    border: "0.5px solid rgba(37,211,102,0.12)",
                                    margin: "0 auto 20px",
                                }}
                            >
                                <WhatsAppIcon size={34} />
                            </div>

                            {/* Title */}
                            <h3
                                className="text-base font-bold"
                                style={{
                                    color: "var(--text-primary)",
                                    marginBottom: "6px",
                                }}
                            >
                                WhatsApp Business
                            </h3>

                            {/* Subtitle */}
                            <p
                                className="text-sm"
                                style={{
                                    color: "var(--text-secondary)",
                                    maxWidth: "340px",
                                    margin: "0 auto 28px",
                                    lineHeight: "1.5",
                                }}
                            >
                                Conecta tu numero de WhatsApp para comunicarte con tus clientes
                            </p>

                            {/* Big green Conectar button */}
                            {!showManual && (
                                <button
                                    onClick={handleConectar}
                                    disabled={EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady}
                                    className="inline-flex items-center justify-center gap-2.5 font-bold transition-all"
                                    style={{
                                        padding: "14px 48px",
                                        borderRadius: "12px",
                                        background:
                                            EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady
                                                ? "rgba(255,255,255,0.04)"
                                                : "linear-gradient(135deg, #25d366 0%, #128c7e 100%)",
                                        border: "none",
                                        color:
                                            EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady
                                                ? "rgba(255,255,255,0.2)"
                                                : "white",
                                        cursor:
                                            EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady
                                                ? "not-allowed"
                                                : "pointer",
                                        boxShadow:
                                            EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady
                                                ? "none"
                                                : "0 4px 24px rgba(37,211,102,0.3)",
                                        fontSize: "0.95rem",
                                        letterSpacing: "0.01em",
                                        minWidth: "200px",
                                    }}
                                >
                                    {EMBEDDED_SIGNUP_AVAILABLE && !fbSdkReady ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Cargando...
                                        </>
                                    ) : (
                                        <>
                                            <WhatsAppIcon size={20} />
                                            Conectar
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Advanced config link */}
                            {!showManual && (
                                <div style={{ marginTop: "16px" }}>
                                    <button
                                        onClick={() => setShowManual(true)}
                                        className="inline-flex items-center gap-1 text-xs transition-colors"
                                        style={{
                                            color: "var(--text-muted)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "4px 0",
                                            opacity: 0.7,
                                        }}
                                    >
                                        <Settings2 size={11} />
                                        Configuracion avanzada
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Manual Configuration (expandable) ──── */}
                    <div
                        style={{
                            overflow: "hidden",
                            maxHeight: showManual ? "600px" : "0px",
                            opacity: showManual ? 1 : 0,
                            transition: "max-height 0.35s ease, opacity 0.25s ease, margin 0.3s ease",
                            marginTop: showManual ? "20px" : "0px",
                        }}
                    >
                        <div
                            style={{
                                padding: "20px",
                                borderRadius: "12px",
                                background: "rgba(255,255,255,0.02)",
                                border: "0.5px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            {/* Collapse toggle — entire header is clickable */}
                            <button
                                onClick={() => setShowManual(false)}
                                className="flex items-center justify-between w-full"
                                style={{
                                    marginBottom: "16px",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "0",
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <Settings2 size={14} style={{ color: "var(--text-muted)" }} />
                                    <span
                                        className="text-xs font-semibold"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        Configuracion manual
                                    </span>
                                </div>
                                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                            </button>

                            {/* Input fields */}
                            <div className="grid gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Access Token</label>
                                    <input
                                        className="input"
                                        type="password"
                                        value={metaToken}
                                        onChange={(e) => onMetaTokenChange(e.target.value)}
                                        placeholder="EAAGm0PX4ZCpsBAG..."
                                    />
                                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                                        Token permanente de Meta Business Settings
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
                                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                                        ID numerico del numero de telefono
                                    </p>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Business Account ID (WABA)</label>
                                    <input
                                        className="input"
                                        type="text"
                                        value={businessAccountId}
                                        onChange={(e) => onBusinessAccountIdChange(e.target.value)}
                                        placeholder="987654321098765"
                                    />
                                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                                        ID de tu cuenta de WhatsApp Business
                                    </p>
                                </div>
                            </div>

                            {/* Verify & Connect button */}
                            <div className="flex justify-end" style={{ marginTop: "16px" }}>
                                <button
                                    onClick={handleManualConnect}
                                    disabled={!canConnect || wa.connecting}
                                    className="flex items-center gap-2 text-sm font-semibold transition-all"
                                    style={{
                                        padding: "10px 24px",
                                        borderRadius: "10px",
                                        background:
                                            canConnect && !wa.connecting
                                                ? "linear-gradient(135deg, #25d366 0%, #128c7e 100%)"
                                                : "rgba(255,255,255,0.04)",
                                        border: "none",
                                        color:
                                            canConnect && !wa.connecting
                                                ? "white"
                                                : "rgba(255,255,255,0.2)",
                                        cursor:
                                            canConnect && !wa.connecting
                                                ? "pointer"
                                                : "not-allowed",
                                        boxShadow:
                                            canConnect && !wa.connecting
                                                ? "0 2px 12px rgba(37,211,102,0.25)"
                                                : "none",
                                    }}
                                >
                                    {wa.connecting ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Conectando...
                                        </>
                                    ) : (
                                        <>
                                            <Wifi size={14} />
                                            Verificar y Conectar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ──────────────────────────────────────────────── */}
            {/*  FACEBOOK REDIRECT MODAL (portal to body)       */}
            {/* ──────────────────────────────────────────────── */}
            {showFbModal && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{
                        background: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowFbModal(false);
                    }}
                >
                    <div
                        className="wa-modal-enter"
                        style={{
                            width: "100%",
                            maxWidth: "420px",
                            borderRadius: "16px",
                            background: "var(--bg-card)",
                            border: "0.5px solid var(--border)",
                            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
                            padding: "28px",
                            position: "relative",
                        }}
                    >
                        {/* Close */}
                        <button
                            onClick={() => setShowFbModal(false)}
                            style={{
                                position: "absolute",
                                top: "16px",
                                right: "16px",
                                background: "rgba(255,255,255,0.04)",
                                border: "0.5px solid rgba(255,255,255,0.06)",
                                borderRadius: "8px",
                                width: "32px",
                                height: "32px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                            }}
                        >
                            <X size={16} />
                        </button>

                        {/* Icon + title */}
                        <div className="text-center" style={{ marginBottom: "24px" }}>
                            <div
                                className="flex items-center justify-center mx-auto"
                                style={{
                                    width: "52px",
                                    height: "52px",
                                    borderRadius: "14px",
                                    background: "rgba(37,211,102,0.1)",
                                    border: "0.5px solid rgba(37,211,102,0.15)",
                                    marginBottom: "16px",
                                }}
                            >
                                <WhatsAppIcon size={26} />
                            </div>
                            <h3
                                className="text-base font-bold"
                                style={{ color: "var(--text-primary)", marginBottom: "6px" }}
                            >
                                Conectar con Facebook
                            </h3>
                            <p
                                className="text-xs leading-relaxed"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Te redirigiremos a Facebook para conectar tu WhatsApp Business.
                            </p>
                        </div>

                        {/* Info note */}
                        <div
                            className="flex items-start gap-2.5"
                            style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: "rgba(122,158,138,0.04)",
                                border: "0.5px solid rgba(122,158,138,0.08)",
                                marginBottom: "24px",
                            }}
                        >
                            <Info
                                size={14}
                                className="flex-shrink-0 mt-0.5"
                                style={{ color: "#7a9e8a" }}
                            />
                            <span
                                className="text-xs leading-relaxed"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Tu negocio debe estar verificado en Meta Business Manager.
                            </span>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFbModal(false)}
                                className="flex-1 text-sm font-semibold transition-all"
                                style={{
                                    padding: "11px 0",
                                    borderRadius: "10px",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "0.5px solid rgba(255,255,255,0.08)",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={launchEmbeddedSignup}
                                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold transition-all"
                                style={{
                                    padding: "11px 0",
                                    borderRadius: "10px",
                                    background: "linear-gradient(135deg, #1877F2 0%, #0b5fcc 100%)",
                                    border: "none",
                                    color: "white",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 12px rgba(24,119,242,0.3)",
                                }}
                            >
                                <ExternalLink size={14} />
                                Ir a Facebook
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Keyframes for modal animation ───────────── */}
            <style jsx>{`
                .wa-modal-enter {
                    animation: waModalFadeIn 0.2s ease-out;
                }
                @keyframes waModalFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
    return (
        <div className="flex items-center gap-1.5">
            <div
                style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: connected ? "#22c55e" : "#f59e0b",
                    boxShadow: connected ? "0 0 6px rgba(34,197,94,0.4)" : "none",
                }}
            />
            <span
                className="text-xs"
                style={{ color: connected ? "#22c55e" : "#f59e0b" }}
            >
                {connected ? "Conectado" : "No conectado"}
            </span>
        </div>
    );
}

// ── Step progress display ────────────────────────────────────
function StepProgress<T extends string>({
    steps,
    labels,
    completedSteps,
    currentStep,
}: {
    steps: T[];
    labels: Record<T, string>;
    completedSteps: T[];
    currentStep: T | null;
}) {
    return (
        <div
            style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(37,211,102,0.03)",
                border: "0.5px solid rgba(37,211,102,0.08)",
            }}
        >
            {steps.map((step) => {
                const isCompleted = completedSteps.includes(step);
                const isCurrent = currentStep === step;
                return (
                    <div key={step} className="flex items-center gap-2.5 py-1.5">
                        {isCompleted ? (
                            <CheckCircle size={15} style={{ color: "#22c55e" }} />
                        ) : isCurrent ? (
                            <Loader2
                                size={15}
                                className="animate-spin"
                                style={{ color: "#25d366" }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: "15px",
                                    height: "15px",
                                    borderRadius: "50%",
                                    border: "1.5px solid rgba(255,255,255,0.1)",
                                }}
                            />
                        )}
                        <span
                            className="text-xs"
                            style={{
                                color: isCompleted
                                    ? "#22c55e"
                                    : isCurrent
                                      ? "var(--text-primary)"
                                      : "var(--text-muted)",
                                fontWeight: isCurrent ? 600 : 400,
                            }}
                        >
                            {labels[step]}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Error banner ─────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
    return (
        <div
            className="flex items-start gap-2"
            style={{
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(239,68,68,0.06)",
                border: "0.5px solid rgba(239,68,68,0.12)",
                color: "#f87171",
                fontSize: "0.8rem",
                marginBottom: "16px",
            }}
        >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{message}</span>
        </div>
    );
}

// ── Copyable field row ───────────────────────────────────────
function CopyField({
    icon,
    label,
    value,
    fieldKey,
    copiedField,
    onCopy,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    fieldKey: string;
    copiedField: string | null;
    onCopy: (text: string, field: string) => void;
}) {
    const isCopied = copiedField === fieldKey;
    return (
        <div className="flex items-center gap-2">
            <label className="form-label !mb-0 flex items-center gap-1.5 whitespace-nowrap">
                {icon} {label}
            </label>
            <div className="flex-1 flex items-center gap-1.5">
                <input
                    className="input"
                    type="text"
                    readOnly
                    value={value}
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                />
                <button
                    onClick={() => onCopy(value, fieldKey)}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors"
                    style={{
                        background: isCopied
                            ? "rgba(16,185,129,0.1)"
                            : "rgba(255,255,255,0.04)",
                        border: isCopied
                            ? "0.5px solid rgba(16,185,129,0.2)"
                            : "0.5px solid rgba(255,255,255,0.06)",
                        color: isCopied ? "#34d399" : "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    {isCopied ? (
                        <>
                            <CheckCheck size={12} /> Copiado
                        </>
                    ) : (
                        <>
                            <Copy size={12} /> Copiar
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// ── Quality badge ────────────────────────────────────────────
function QualityBadge({ rating }: { rating: string }) {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
        GREEN: {
            bg: "rgba(34,197,94,0.1)",
            border: "rgba(34,197,94,0.2)",
            text: "#22c55e",
        },
        YELLOW: {
            bg: "rgba(245,158,11,0.1)",
            border: "rgba(245,158,11,0.2)",
            text: "#f59e0b",
        },
        RED: {
            bg: "rgba(239,68,68,0.1)",
            border: "rgba(239,68,68,0.2)",
            text: "#ef4444",
        },
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
                border: `0.5px solid ${c.border}`,
                color: c.text,
            }}
        >
            {rating}
        </span>
    );
}

// ── WhatsApp SVG icon ────────────────────────────────────────
function WhatsAppIcon({ size = 24 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
                fill="#25d366"
            />
            <path
                d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.174-3.01.79.8-2.93-.19-.3A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
                fill="#25d366"
            />
        </svg>
    );
}

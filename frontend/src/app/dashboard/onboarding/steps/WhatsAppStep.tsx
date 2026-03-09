"use client";

import { MessageCircle, Copy, CheckCheck } from "lucide-react";
import { useState } from "react";

interface WhatsAppData {
    phoneNumberId: string;
    accessToken: string;
}

interface Props {
    data: WhatsAppData;
    onChange: (data: WhatsAppData) => void;
    webhookUrl: string;
}

const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#f0f0f5",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "0.9rem",
    width: "100%",
    outline: "none",
    fontFamily: "monospace",
} as const;

export default function WhatsAppStep({ data, onChange, webhookUrl }: Props) {
    const [copied, setCopied] = useState(false);

    const copyWebhook = async () => {
        await navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                    Conecta tu número de WhatsApp Business para recibir mensajes.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Phone Number ID
                    </label>
                    <input type="text" value={data.phoneNumberId} onChange={(e) => onChange({ ...data, phoneNumberId: e.target.value })} placeholder="Ej: 123456789012345" style={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Access Token (Meta)
                    </label>
                    <input type="password" value={data.accessToken} onChange={(e) => onChange({ ...data, accessToken: e.target.value })} placeholder="EAAx..." style={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        URL del Webhook
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={webhookUrl}
                            readOnly
                            style={{
                                ...inputStyle,
                                flex: 1,
                                fontSize: "0.75rem",
                                color: "rgba(255,255,255,0.35)",
                                background: "rgba(255,255,255,0.02)",
                            }}
                        />
                        <button
                            onClick={copyWebhook}
                            className="flex items-center gap-2 transition-all"
                            style={{
                                padding: "12px 18px",
                                borderRadius: "12px",
                                background: copied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                                border: copied ? "1.5px solid rgba(16,185,129,0.3)" : "1.5px solid rgba(255,255,255,0.08)",
                                color: copied ? "#34d399" : "rgba(255,255,255,0.5)",
                                cursor: "pointer",
                                fontSize: "0.85rem", fontWeight: 500,
                            }}
                        >
                            {copied ? <><CheckCheck size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        padding: "16px 20px",
                        borderRadius: "12px",
                        background: "rgba(245,158,11,0.04)",
                        border: "1px solid rgba(245,158,11,0.1)",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.85rem",
                    }}
                >
                    Si aún no tienes tu cuenta de WhatsApp Business configurada,
                    puedes <strong style={{ color: "rgba(255,255,255,0.65)" }}>saltarte este paso</strong> y configurarlo después en Ajustes.
                </div>
            </div>
        </div>
    );
}

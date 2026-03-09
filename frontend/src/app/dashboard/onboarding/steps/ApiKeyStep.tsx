"use client";

import { Key, ExternalLink } from "lucide-react";

interface Props {
    apiKey: string;
    onChange: (key: string) => void;
}

export default function ApiKeyStep({ apiKey, onChange }: Props) {
    const isValid = apiKey.startsWith("sk-") && apiKey.length > 20;

    return (
        <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
                <div
                    className="inline-flex items-center justify-center mb-4"
                    style={{
                        width: "64px", height: "64px", borderRadius: "18px",
                        background: "rgba(245,158,11,0.1)",
                        border: "1px solid rgba(245,158,11,0.15)",
                    }}
                >
                    <Key size={32} style={{ color: "#fbbf24" }} />
                </div>
                <h2 className="text-3xl font-bold mb-3" style={{ color: "#f0f0f5" }}>
                    Conecta tu API Key
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                    Tu agente usa OpenAI para generar respuestas inteligentes.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        OpenAI API Key
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="sk-proj-..."
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${apiKey && !isValid ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                            color: "#f0f0f5",
                            borderRadius: "12px",
                            padding: "12px 16px",
                            fontSize: "0.9rem",
                            width: "100%",
                            outline: "none",
                            fontFamily: "monospace",
                        }}
                    />
                    {apiKey && !isValid && (
                        <p className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                            La API key debe empezar con &quot;sk-&quot;
                        </p>
                    )}
                </div>

                <div
                    style={{
                        padding: "20px",
                        borderRadius: "14px",
                        background: "rgba(59,130,246,0.04)",
                        border: "1px solid rgba(59,130,246,0.1)",
                    }}
                >
                    <p className="text-sm font-medium mb-3" style={{ color: "#e0e0e8" }}>
                        ¿No tienes una API Key?
                    </p>
                    <div className="space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <p>1. Crea una cuenta en OpenAI (si no tienes una)</p>
                        <p>2. Ve a la sección de API Keys</p>
                        <p>3. Genera una nueva key y pégala aquí</p>
                    </div>
                    <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-4 font-medium transition-colors"
                        style={{
                            fontSize: "0.85rem",
                            color: "#60a5fa",
                            padding: "8px 16px",
                            borderRadius: "10px",
                            background: "rgba(59,130,246,0.08)",
                            border: "1px solid rgba(59,130,246,0.15)",
                            textDecoration: "none",
                        }}
                    >
                        Ir a OpenAI <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
}

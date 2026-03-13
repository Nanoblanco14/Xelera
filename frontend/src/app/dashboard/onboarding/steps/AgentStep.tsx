"use client";

import { motion } from "framer-motion";
import { Bot, Check } from "lucide-react";

const TONES = [
    { id: "Profesional y Formal", label: "Profesional", desc: "Serio, confiable, corporativo" },
    { id: "Amigable y Casual", label: "Amigable", desc: "Cercano, cálido, conversacional" },
    { id: "Entusiasta y Vendedor", label: "Entusiasta", desc: "Persuasivo, energético, vendedor" },
] as const;

interface AgentData {
    name: string;
    welcomeMessage: string;
    tone: string;
}

interface Props {
    data: AgentData;
    onChange: (data: AgentData) => void;
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
} as const;

export default function AgentStep({ data, onChange }: Props) {
    return (
        <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
                <div
                    className="inline-flex items-center justify-center mb-4"
                    style={{
                        width: "64px", height: "64px", borderRadius: "18px",
                        background: "rgba(122,158,138,0.1)",
                        border: "0.5px solid rgba(122,158,138,0.15)",
                    }}
                >
                    <Bot size={32} style={{ color: "#9ab8a8" }} />
                </div>
                <h2 className="text-3xl font-bold mb-3" style={{ color: "#f0f0f5" }}>
                    Personaliza tu asistente
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                    Dale nombre y personalidad a tu agente AI.
                </p>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Nombre del asistente
                    </label>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => onChange({ ...data, name: e.target.value })}
                        placeholder="Ej: Asistente Estrella"
                        style={inputStyle}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Mensaje de bienvenida
                    </label>
                    <textarea
                        value={data.welcomeMessage}
                        onChange={(e) => onChange({ ...data, welcomeMessage: e.target.value })}
                        placeholder="Ej: ¡Hola! ¿En qué puedo ayudarte?"
                        rows={3}
                        style={{ ...inputStyle, resize: "none" as const }}
                    />
                    <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                        Este es el primer mensaje que recibe el cliente por WhatsApp.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Tono de conversación
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {TONES.map((tone) => {
                            const isActive = data.tone === tone.id;
                            return (
                                <motion.button
                                    key={tone.id}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => onChange({ ...data, tone: tone.id })}
                                    className="relative text-center transition-all"
                                    style={{
                                        padding: "14px 12px", borderRadius: "12px",
                                        background: isActive ? "rgba(122,158,138,0.12)" : "rgba(255,255,255,0.03)",
                                        border: isActive ? "1.5px solid rgba(122,158,138,0.4)" : "1.5px solid rgba(255,255,255,0.06)",
                                        cursor: "pointer",
                                        boxShadow: isActive ? "0 2px 12px rgba(122,158,138,0.15)" : "none",
                                    }}
                                >
                                    {isActive && (
                                        <div className="absolute top-2 right-2">
                                            <Check size={14} color="#9ab8a8" />
                                        </div>
                                    )}
                                    <div className="text-sm font-semibold mb-1" style={{ color: isActive ? "#93bbfc" : "#e0e0e8" }}>
                                        {tone.label}
                                    </div>
                                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                                        {tone.desc}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

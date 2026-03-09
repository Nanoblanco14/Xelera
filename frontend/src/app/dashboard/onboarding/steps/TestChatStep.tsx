"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface Props {
    agentId: string;
    agentName: string;
    welcomeMessage: string;
}

export default function TestChatStep({ agentId, agentName, welcomeMessage }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: "assistant", content: welcomeMessage || "¡Hola! ¿En qué puedo ayudarte?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setLoading(true);
        try {
            const res = await fetch(`/api/agents/${agentId}/test-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history: messages.map((m) => ({ role: m.role, content: m.content })) }),
            });
            const data = await res.json();
            setMessages((prev) => [...prev, { role: "assistant", content: data.response || "Error al generar respuesta." }]);
        } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Error de conexión." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-3" style={{ color: "#f0f0f5" }}>
                    Prueba tu agente
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                    Habla con tu asistente y verifica que responde correctamente.
                </p>
            </div>

            {/* Chat container */}
            <div
                className="rounded-2xl overflow-hidden"
                style={{
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                    maxHeight: "480px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <div
                    className="px-5 py-3.5 flex items-center gap-3"
                    style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(59,130,246,0.04)",
                    }}
                >
                    <div
                        className="flex items-center justify-center"
                        style={{
                            width: "36px", height: "36px", borderRadius: "50%",
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.2)",
                        }}
                    >
                        <Bot size={18} style={{ color: "#60a5fa" }} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold" style={{ color: "#e0e0e8" }}>
                            {agentName || "Tu Asistente"}
                        </div>
                        <div className="text-xs" style={{ color: "#34d399" }}>
                            En línea
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ minHeight: "300px", maxHeight: "360px" }}>
                    <AnimatePresence initial={false}>
                        {messages.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed"
                                    style={{
                                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                        background: msg.role === "user"
                                            ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.2))"
                                            : "rgba(255,255,255,0.05)",
                                        border: msg.role === "user"
                                            ? "1px solid rgba(59,130,246,0.2)"
                                            : "1px solid rgba(255,255,255,0.06)",
                                        color: "#e0e0e8",
                                    }}
                                >
                                    {msg.content}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div
                                className="px-4 py-2.5 text-sm"
                                style={{
                                    borderRadius: "16px 16px 16px 4px",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    color: "rgba(255,255,255,0.3)",
                                }}
                            >
                                <span className="inline-flex gap-1">
                                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                                </span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Escribe un mensaje..."
                        disabled={loading}
                        style={{
                            flex: 1,
                            background: "rgba(255,255,255,0.04)",
                            border: "1.5px solid rgba(255,255,255,0.08)",
                            color: "#f0f0f5",
                            borderRadius: "12px",
                            padding: "10px 16px",
                            fontSize: "0.85rem",
                            outline: "none",
                        }}
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="flex items-center justify-center"
                        style={{
                            width: "42px", height: "42px", borderRadius: "12px",
                            background: loading || !input.trim()
                                ? "rgba(255,255,255,0.04)"
                                : "linear-gradient(135deg, #3b82f6, #7c3aed)",
                            border: "none",
                            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                            boxShadow: !loading && input.trim() ? "0 2px 10px rgba(59,130,246,0.3)" : "none",
                        }}
                    >
                        <Send size={16} color={loading || !input.trim() ? "rgba(255,255,255,0.2)" : "white"} />
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

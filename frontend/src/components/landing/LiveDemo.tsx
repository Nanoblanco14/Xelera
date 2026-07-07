"use client";
// ═══════════════════════════════════════════════════════════════
//  🎭 LIVE DEMO — chat real con el agente demo, en la landing.
//  "Nadie vende un bot con screenshots; se vende chateando con él."
//  Dogfooding: consume los átomos Button/Badge del design system.
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, Bot, Sparkles } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { DEMO_INDUSTRIES, getDemoProfile, type DemoIndustryId } from "@/lib/demo-agent";

interface DemoMsg {
    role: "user" | "assistant";
    content: string;
}

export default function LiveDemo() {
    const [industry, setIndustry] = useState<DemoIndustryId>("real_estate");
    const profile = getDemoProfile(industry);

    const [messages, setMessages] = useState<DemoMsg[]>([
        { role: "assistant", content: profile.welcome },
    ]);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const [ended, setEnded] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    const userTurns = messages.filter((m) => m.role === "user").length;

    // Cambiar de rubro = sesión nueva: chat limpio + bienvenida propia
    const switchIndustry = (id: DemoIndustryId) => {
        if (id === industry || typing) return;
        setIndustry(id);
        setMessages([{ role: "assistant", content: getDemoProfile(id).welcome }]);
        setInput("");
        setEnded(false);
    };

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [messages, typing]);

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || typing || ended) return;

        const history = messages.slice(1); // el saludo no viaja
        setMessages((prev) => [...prev, { role: "user", content: msg }]);
        setInput("");
        setTyping(true);

        try {
            const res = await fetch("/api/demo-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg, history, industry }),
            });
            const json = await res.json();
            const reply: string =
                json?.data?.reply || json?.error || "Ups, intenta de nuevo 🙈";
            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
            if (json?.data?.ended) setEnded(true);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Se cortó la señal 📶 — intenta de nuevo." },
            ]);
        }
        setTyping(false);
    };

    return (
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            {/* Selector de industria — el demo es multi-rubro como Xelera */}
            <div style={{
                display: "flex", gap: "8px", justifyContent: "center",
                marginBottom: "14px", flexWrap: "wrap",
            }}>
                {DEMO_INDUSTRIES.map((ind) => (
                    <button
                        key={ind.id}
                        onClick={() => switchIndustry(ind.id)}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "6px",
                            padding: "7px 14px", borderRadius: "100px",
                            fontSize: "0.76rem", fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 180ms var(--ease-smooth)",
                            background: industry === ind.id ? "var(--accent)" : "var(--bg-card)",
                            color: industry === ind.id ? "var(--bg-deep)" : "var(--text-secondary)",
                            border: industry === ind.id
                                ? "0.5px solid var(--accent)"
                                : "0.5px solid var(--border)",
                        }}
                    >
                        {ind.emoji} {ind.label}
                    </button>
                ))}
            </div>

        <div className="glass-card" style={{
            display: "flex", flexDirection: "column",
            height: "480px", overflow: "hidden",
        }}>
            {/* Header estilo WhatsApp */}
            <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "14px 18px",
                borderBottom: "0.5px solid var(--border)",
                background: "rgba(14,14,13,0.6)",
            }}>
                <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: "var(--gradient-accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <Bot size={18} color="var(--bg-deep)" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {profile.businessName}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                        {profile.tagline}
                    </div>
                </div>
                <Badge color="#22c55e" dot size="xs">EN VIVO</Badge>
            </div>

            {/* Mensajes */}
            <div style={{
                flex: 1, overflowY: "auto", padding: "16px",
                display: "flex", flexDirection: "column", gap: "10px",
                background: "radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
            }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        padding: "10px 14px",
                        borderRadius: m.role === "user"
                            ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: m.role === "user"
                            ? "rgba(122,158,138,0.16)" : "var(--bg-elevated)",
                        border: "0.5px solid var(--border)",
                        fontSize: "0.82rem", lineHeight: 1.55,
                        color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                    }}>
                        {m.content}
                    </div>
                ))}
                {typing && (
                    <div style={{
                        alignSelf: "flex-start", padding: "12px 16px",
                        borderRadius: "14px 14px 14px 4px",
                        background: "var(--bg-elevated)",
                        border: "0.5px solid var(--border)",
                        display: "flex", gap: "4px",
                    }}>
                        {[0, 1, 2].map((d) => (
                            <span key={d} style={{
                                width: "6px", height: "6px", borderRadius: "50%",
                                background: "var(--text-muted)",
                                animation: `typingDot 1.2s ${d * 0.15}s infinite`,
                            }} />
                        ))}
                    </div>
                )}

                {/* CTA tras el 3er turno o al terminar la sesión */}
                {(userTurns >= 3 || ended) && !typing && (
                    <div style={{
                        alignSelf: "center", marginTop: "8px",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", gap: "8px",
                    }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            Así atendería a TUS clientes, 24/7
                        </span>
                        <Link href="/login">
                            <Button size="sm" icon={<Sparkles size={14} />}>
                                Crea el tuyo gratis
                            </Button>
                        </Link>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Chips de arranque + input */}
            <div style={{ padding: "12px 14px", borderTop: "0.5px solid var(--border)" }}>
                {userTurns === 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                        {profile.chips.map((chip) => (
                            <button key={chip} onClick={() => send(chip)} style={{
                                background: "var(--accent-subtle)",
                                border: "0.5px solid var(--border-accent)",
                                borderRadius: "100px", padding: "6px 12px",
                                fontSize: "0.72rem", color: "var(--accent-light)",
                                cursor: "pointer",
                            }}>
                                {chip}
                            </button>
                        ))}
                    </div>
                )}
                <form
                    onSubmit={(e) => { e.preventDefault(); send(input); }}
                    style={{ display: "flex", gap: "8px" }}
                >
                    <input
                        className="input"
                        style={{ flex: 1 }}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={ended ? "Demo finalizado — crea tu agente 👆" : "Escríbele como si fuera WhatsApp..."}
                        disabled={ended}
                        maxLength={500}
                    />
                    <Button type="submit" loading={typing} disabled={ended || !input.trim()} icon={<Send size={15} />} />
                </form>
            </div>
        </div>
        </div>
    );
}

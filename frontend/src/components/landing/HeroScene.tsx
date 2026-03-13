"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Play, Send, Bot, Headphones, GraduationCap } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   MiAgente — Ultra-Premium Hero Scene
   Built entirely in React/CSS. No images needed.
   Techniques: glassmorphism, aurora orbs, beam sweeps, film grain,
   mouse-parallax, staggered entrance, typing animation, sparklines
   ══════════════════════════════════════════════════════════════ */

/* ── Mouse parallax hook (GPU-only, zero re-renders) ────── */
function useMouseParallax() {
    const containerRef = useRef<HTMLDivElement>(null);
    const target = useRef({ x: 0, y: 0 });
    const current = useRef({ x: 0, y: 0 });
    const rafId = useRef<number>(0);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.matchMedia("(pointer: coarse)").matches) return;

        const onMove = (e: MouseEvent) => {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            target.current.x = (e.clientX - cx) * 0.015;
            target.current.y = (e.clientY - cy) * 0.015;
        };

        const tick = () => {
            // Smooth lerp — 8% per frame = ~60fps butter
            current.current.x += (target.current.x - current.current.x) * 0.08;
            current.current.y += (target.current.y - current.current.y) * 0.08;

            const el = containerRef.current;
            if (el) {
                const children = el.querySelectorAll<HTMLElement>("[data-parallax]");
                children.forEach((child) => {
                    const f = parseFloat(child.dataset.parallax || "1");
                    child.style.transform = `translate3d(${current.current.x * f}px, ${current.current.y * f}px, 0)`;
                });
            }

            rafId.current = requestAnimationFrame(tick);
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        rafId.current = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener("mousemove", onMove);
            cancelAnimationFrame(rafId.current);
        };
    }, []);

    return containerRef;
}

/* ── Typing text animation ───────────────────────────────── */
function TypingText({ text, delay = 0 }: { text: string; delay?: number }) {
    const [displayed, setDisplayed] = useState("");
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    useEffect(() => {
        if (!started) return;
        let i = 0;
        const iv = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) clearInterval(iv);
        }, 28);
        return () => clearInterval(iv);
    }, [started, text]);

    return (
        <span>
            {displayed}
            {displayed.length < text.length && started && (
                <span style={{ opacity: 0.5, animation: "blink 0.8s step-end infinite" }}>|</span>
            )}
        </span>
    );
}

/* ── Sparkline SVG ───────────────────────────────────────── */
function Sparkline({ color = "#7a9e8a", width = 80, height = 24 }: { color?: string; width?: number; height?: number }) {
    const points = "0,20 12,16 24,18 36,10 48,13 60,6 72,8 80,3";
    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
            <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <polyline points={`${points} 80,24 0,24`} fill="url(#sparkFill)" stroke="none" />
        </svg>
    );
}

/* ── Animated counter ────────────────────────────────────── */
function AnimCounter({ end, suffix = "", duration = 2000, delay = 0 }: { end: number; suffix?: string; duration?: number; delay?: number }) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        const timeout = setTimeout(() => {
            const start = performance.now();
            const step = (now: number) => {
                const p = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                setVal(parseFloat((eased * end).toFixed(1)));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, delay);
        return () => clearTimeout(timeout);
    }, [end, duration, delay]);

    return <>{val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}{suffix}</>;
}

/* ══════════════════════════════════════════════════════════════
   Main Hero Component
   ══════════════════════════════════════════════════════════════ */
export default function HeroScene() {
    const [mounted, setMounted] = useState(false);
    const parallaxRef = useMouseParallax();

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(t);
    }, []);

    const enter = (delay: number) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.22,0.68,0,1.1) ${delay}ms, transform 0.8s cubic-bezier(0.22,0.68,0,1.1) ${delay}ms`,
    });

    return (
        <section
            ref={parallaxRef}
            style={{
                position: "relative",
                overflow: "hidden",
                paddingTop: "120px",
                paddingBottom: "80px",
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
            }}
        >
            {/* ── Background layers ─────────────────────────────── */}

            {/* Grid pattern */}
            <div style={{
                position: "absolute", inset: 0, zIndex: 0,
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
                `,
                backgroundSize: "60px 60px",
                maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 70%)",
                WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 70%)",
            }} />

            {/* Aurora orb — sage (bottom-left) */}
            <div data-parallax="-0.5" style={{
                position: "absolute", bottom: "-10%", left: "-5%",
                width: "600px", height: "600px", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(122,158,138,0.07) 0%, transparent 65%)",
                filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
                willChange: "transform",
            }} />

            {/* Aurora orb — slate (top-right) */}
            <div data-parallax="0.5" style={{
                position: "absolute", top: "-15%", right: "-5%",
                width: "500px", height: "500px", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(100,130,170,0.05) 0%, transparent 65%)",
                filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
                willChange: "transform",
            }} />

            {/* Center bloom */}
            <div style={{
                position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
                width: "800px", height: "500px", borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(122,158,138,0.035) 0%, transparent 60%)",
                filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
            }} />

            {/* Film grain overlay */}
            <div style={{
                position: "absolute", inset: 0, zIndex: 1,
                opacity: 0.035, pointerEvents: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat",
            }} />

            {/* Beam sweep animation */}
            <div className="hero-beam-sweep" style={{
                position: "absolute", top: 0, left: "-100%",
                width: "60%", height: "100%", zIndex: 1,
                background: "linear-gradient(90deg, transparent, rgba(122,158,138,0.015), transparent)",
                transform: "skewX(-15deg)",
                pointerEvents: "none",
            }} />

            {/* Vignette */}
            <div style={{
                position: "absolute", inset: 0, zIndex: 1,
                background: "radial-gradient(ellipse 80% 70% at 50% 45%, transparent 40%, rgba(10,10,9,0.7) 100%)",
                pointerEvents: "none",
            }} />

            {/* ── Content ─────────────────────────────────────── */}
            <div style={{
                position: "relative", zIndex: 10,
                maxWidth: "1280px", margin: "0 auto",
                padding: "0 24px", width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr 1.15fr",
                gap: "60px",
                alignItems: "center",
            }}
                className="hero-grid"
            >
                {/* ═══ LEFT COLUMN — Typography + CTAs ═══ */}
                <div>
                    {/* Tag pill */}
                    <div style={enter(200)}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "6px 16px", borderRadius: "100px",
                            background: "rgba(122,158,138,0.06)",
                            border: "0.5px solid rgba(122,158,138,0.15)",
                            fontSize: "11px", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.08em",
                            color: "var(--accent-sage)",
                        }}>
                            <span style={{
                                width: "6px", height: "6px", borderRadius: "50%",
                                background: "#7a9e8a",
                                boxShadow: "0 0 8px rgba(122,158,138,0.6)",
                                animation: "subtlePulse 2s ease-in-out infinite",
                            }} />
                            Plataforma de Agentes IA
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 style={{
                        ...enter(400),
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "clamp(2.2rem, 4.2vw, 3.8rem)",
                        fontWeight: 400,
                        lineHeight: 1.1,
                        letterSpacing: "-0.02em",
                        marginTop: "28px",
                        marginBottom: "24px",
                    }}>
                        <span style={{ color: "var(--text-primary)" }}>Agentes IA que</span>
                        <br />
                        <span style={{ color: "var(--text-primary)" }}>trabajan </span>
                        <span style={{
                            color: "var(--accent-sage)",
                            textShadow: "0 0 40px rgba(122,158,138,0.2)",
                        }}>mientras</span>
                        <br />
                        <span style={{
                            color: "var(--accent-warm)",
                            textShadow: "0 0 40px rgba(168,159,148,0.15)",
                        }}>duermes</span>
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        ...enter(550),
                        color: "var(--text-secondary)",
                        fontSize: "clamp(0.9rem, 1.1vw, 1.05rem)",
                        lineHeight: 1.8,
                        maxWidth: "480px",
                        marginBottom: "36px",
                    }}>
                        Automatiza ventas, soporte y onboarding con agentes autónomos
                        entrenados para tu negocio. Sin código. Sin fricción.
                    </p>

                    {/* CTAs */}
                    <div style={{ ...enter(700), display: "flex", gap: "14px", flexWrap: "wrap" }}>
                        <Link
                            href="/login"
                            className="btn-primary"
                            style={{
                                fontSize: "0.9rem", padding: "13px 28px",
                                boxShadow: "0 0 30px rgba(122,158,138,0.1)",
                            }}
                        >
                            Crear mi primer agente <ArrowRight size={16} />
                        </Link>
                        <a href="#demo" className="btn-secondary" style={{ fontSize: "0.9rem", padding: "13px 28px" }}>
                            <Play size={16} /> Ver demo
                        </a>
                    </div>

                    {/* Trust line */}
                    <div style={{
                        ...enter(850),
                        marginTop: "40px",
                        display: "flex", alignItems: "center", gap: "20px",
                    }}>
                        {/* Stacked avatars */}
                        <div style={{ display: "flex" }}>
                            {["CM", "DF", "VR", "MS"].map((initials, i) => (
                                <div key={i} style={{
                                    width: "30px", height: "30px", borderRadius: "50%",
                                    background: i % 2 === 0
                                        ? "linear-gradient(135deg, #7a9e8a, #5d8270)"
                                        : "linear-gradient(135deg, #6482aa, #4a6a90)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "9px", fontWeight: 700, color: "#0e0e0d",
                                    border: "2px solid var(--bg-deep)",
                                    marginLeft: i > 0 ? "-8px" : 0,
                                    zIndex: 4 - i,
                                    position: "relative",
                                }}>
                                    {initials}
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                +2,400 equipos activos
                            </div>
                            <div style={{ display: "flex", gap: "2px", marginTop: "3px" }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <svg key={s} viewBox="0 0 12 12" style={{ width: "11px", height: "11px" }}>
                                        <path d="M6 1l1.5 3.1 3.4.5-2.5 2.4.6 3.4L6 8.8 3 10.4l.6-3.4L1.1 4.6l3.4-.5z"
                                            fill="#c4a35a" />
                                    </svg>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ RIGHT COLUMN — Dashboard Mockup + Floating Cards ═══ */}
                <div data-parallax="1" style={{
                    position: "relative",
                    willChange: "transform",
                }}>
                    {/* ── Main Dashboard Card ──────────────────────── */}
                    <div style={{
                        ...enter(500),
                        background: "#141413",
                        border: "0.5px solid rgba(255,255,255,0.07)",
                        borderRadius: "16px",
                        boxShadow: "0 60px 120px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.05)",
                        overflow: "hidden",
                        position: "relative",
                    }}>
                        {/* Top glow line */}
                        <div style={{
                            position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
                            background: "linear-gradient(90deg, transparent, rgba(122,158,138,0.3), transparent)",
                        }} />

                        {/* Window chrome */}
                        <div style={{
                            padding: "12px 18px",
                            display: "flex", alignItems: "center",
                            borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                        }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c75a5a", opacity: 0.7 }} />
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c4a35a", opacity: 0.7 }} />
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7a9e8a", opacity: 0.7 }} />
                            </div>
                            <span style={{
                                margin: "0 auto",
                                fontSize: "11px", color: "var(--text-muted)",
                                fontWeight: 500, letterSpacing: "0.03em",
                            }}>
                                MiAgente — Pipeline IA
                            </span>
                            <div style={{ width: "50px" }} />
                        </div>

                        {/* Tab row */}
                        <div style={{
                            display: "flex", gap: "0",
                            borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                            padding: "0 18px",
                        }}>
                            {[
                                { label: "Agentes", active: true },
                                { label: "Pipeline", active: false },
                                { label: "Analytics", active: false },
                                { label: "Inbox", active: false },
                            ].map((tab) => (
                                <div key={tab.label} style={{
                                    padding: "10px 16px",
                                    fontSize: "11px", fontWeight: 500,
                                    color: tab.active ? "var(--text-primary)" : "var(--text-muted)",
                                    borderBottom: tab.active ? "1.5px solid #7a9e8a" : "1.5px solid transparent",
                                    letterSpacing: "0.02em",
                                    transition: "all 0.2s",
                                }}>
                                    {tab.label}
                                </div>
                            ))}
                        </div>

                        {/* Main content — two columns */}
                        <div style={{
                            display: "grid", gridTemplateColumns: "0.9fr 1.1fr",
                            minHeight: "300px",
                        }}>
                            {/* LEFT — Agent list */}
                            <div style={{
                                borderRight: "0.5px solid rgba(255,255,255,0.05)",
                                padding: "14px",
                            }}>
                                <div style={{
                                    fontSize: "9px", fontWeight: 600, textTransform: "uppercase",
                                    letterSpacing: "0.1em", color: "var(--text-muted)",
                                    marginBottom: "12px", paddingLeft: "4px",
                                }}>
                                    Agentes activos
                                </div>

                                {/* Agent rows */}
                                {[
                                    {
                                        initial: "A", color: "#7a9e8a", name: "Agente Ventas Pro",
                                        sub: "Procesando 47 leads...", active: true,
                                        icon: <Bot size={12} />,
                                    },
                                    {
                                        initial: "S", color: "#6482aa", name: "Agente Soporte",
                                        sub: "12 tickets resueltos hoy", active: false,
                                        icon: <Headphones size={12} />,
                                    },
                                    {
                                        initial: "O", color: "#c4a35a", name: "Agente Onboarding",
                                        sub: "3 demos agendadas", active: false,
                                        icon: <GraduationCap size={12} />,
                                    },
                                ].map((agent, i) => (
                                    <div key={i} style={{
                                        display: "flex", alignItems: "center", gap: "10px",
                                        padding: "10px 8px",
                                        borderRadius: "10px",
                                        background: i === 0 ? "rgba(122,158,138,0.06)" : "transparent",
                                        border: i === 0 ? "0.5px solid rgba(122,158,138,0.12)" : "0.5px solid transparent",
                                        marginBottom: "4px",
                                        transition: "all 0.2s",
                                    }}>
                                        <div style={{
                                            width: "32px", height: "32px", borderRadius: "10px",
                                            background: `linear-gradient(135deg, ${agent.color}, ${agent.color}88)`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "#0e0e0d", fontSize: "11px", fontWeight: 700,
                                            flexShrink: 0,
                                        }}>
                                            {agent.icon}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{
                                                fontSize: "11.5px", fontWeight: 600,
                                                color: "var(--text-primary)",
                                                display: "flex", alignItems: "center", gap: "6px",
                                            }}>
                                                {agent.name}
                                                {agent.active && (
                                                    <span style={{
                                                        width: "5px", height: "5px", borderRadius: "50%",
                                                        background: "#7a9e8a",
                                                        boxShadow: "0 0 6px rgba(122,158,138,0.7)",
                                                        animation: "subtlePulse 2s ease-in-out infinite",
                                                        display: "inline-block",
                                                    }} />
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: "10px", color: "var(--text-muted)",
                                                marginTop: "2px", whiteSpace: "nowrap",
                                                overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                                {agent.sub}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* RIGHT — Chat thread */}
                            <div style={{ padding: "14px", display: "flex", flexDirection: "column" }}>
                                <div style={{
                                    fontSize: "9px", fontWeight: 600, textTransform: "uppercase",
                                    letterSpacing: "0.1em", color: "var(--text-muted)",
                                    marginBottom: "12px", paddingLeft: "4px",
                                }}>
                                    Conversación en vivo
                                </div>

                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {/* Message 1 */}
                                    <div style={{
                                        background: "#1a1a18", borderRadius: "10px",
                                        padding: "10px 14px", maxWidth: "92%",
                                        border: "0.5px solid rgba(255,255,255,0.04)",
                                    }}>
                                        <div style={{ fontSize: "10.5px", color: "#edeae4", lineHeight: 1.6 }}>
                                            {mounted ? (
                                                <TypingText text="Analizando historial del cliente Empresa XYZ..." delay={1200} />
                                            ) : ""}
                                        </div>
                                    </div>

                                    {/* Message 2 — sage accent */}
                                    <div style={{
                                        ...enter(1800),
                                        background: "#1a1a18", borderRadius: "10px",
                                        padding: "10px 14px", maxWidth: "92%",
                                        borderLeft: "2px solid #7a9e8a",
                                        border: "0.5px solid rgba(255,255,255,0.04)",
                                        borderLeftWidth: "2px",
                                        borderLeftColor: "#7a9e8a",
                                    }}>
                                        <div style={{ fontSize: "10.5px", color: "#7a9e8a", lineHeight: 1.6, fontWeight: 500 }}>
                                            Oportunidad detectada: plan Enterprise
                                        </div>
                                    </div>

                                    {/* Message 3 */}
                                    <div style={{
                                        ...enter(2200),
                                        background: "#1a1a18", borderRadius: "10px",
                                        padding: "10px 14px", maxWidth: "92%",
                                        border: "0.5px solid rgba(255,255,255,0.04)",
                                    }}>
                                        <div style={{ fontSize: "10.5px", color: "#edeae4", lineHeight: 1.6 }}>
                                            Propuesta personalizada enviada <span style={{ color: "#7a9e8a" }}>✓</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Input bar */}
                                <div style={{
                                    marginTop: "12px",
                                    display: "flex", alignItems: "center", gap: "8px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "0.5px solid rgba(255,255,255,0.06)",
                                    borderRadius: "10px", padding: "8px 12px",
                                }}>
                                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)", flex: 1 }}>
                                        Instrucción al agente...
                                    </span>
                                    <div style={{
                                        width: "26px", height: "26px", borderRadius: "8px",
                                        background: "linear-gradient(135deg, #7a9e8a, #5d8270)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <Send size={11} color="#0e0e0d" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Floating Card: Agents Active (top-right) ── */}
                    <div
                        className="animate-float-slow"
                        data-parallax="1.5"
                        style={{
                            ...enter(900),
                            position: "absolute", top: "-30px", right: "-40px",
                            background: "rgba(20,20,19,0.92)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            border: "0.5px solid rgba(255,255,255,0.08)",
                            borderLeft: "2px solid #7a9e8a",
                            borderRadius: "12px",
                            padding: "14px 18px",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 20px rgba(122,158,138,0.05)",
                            zIndex: 20,
                            willChange: "transform",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{
                                width: "7px", height: "7px", borderRadius: "50%",
                                background: "#7a9e8a",
                                boxShadow: "0 0 8px rgba(122,158,138,0.7)",
                                animation: "subtlePulse 2s ease-in-out infinite",
                            }} />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                                3 agentes activos
                            </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "15px" }}>
                            ↑ 94% tasa de respuesta
                        </div>
                    </div>

                    {/* ── Floating Card: Revenue Metric (bottom-right) ── */}
                    <div
                        className="animate-float-alt"
                        data-parallax="2"
                        style={{
                            ...enter(1100),
                            position: "absolute", bottom: "-30px", right: "-35px",
                            background: "rgba(20,20,19,0.92)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            border: "0.5px solid rgba(255,255,255,0.08)",
                            borderRadius: "14px",
                            padding: "16px 20px",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                            zIndex: 20,
                            minWidth: "160px",
                            willChange: "transform",
                        }}
                    >
                        <div style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: "28px", fontWeight: 400,
                            color: "#edeae4",
                            letterSpacing: "-0.02em",
                            lineHeight: 1,
                        }}>
                            $ <AnimCounter end={2.4} suffix="M" delay={1500} />
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px" }}>
                            Pipeline generado este mes
                        </div>
                        <div style={{ marginTop: "8px" }}>
                            <Sparkline />
                        </div>
                    </div>

                    {/* ── Floating Toast (left side) ──────────────── */}
                    <div
                        className="animate-float"
                        data-parallax="-1"
                        style={{
                            ...enter(1300),
                            position: "absolute", top: "45%", left: "-160px",
                            background: "rgba(20,20,19,0.92)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            border: "0.5px solid rgba(255,255,255,0.08)",
                            borderLeft: "2px solid #7a9e8a",
                            borderRadius: "10px",
                            padding: "10px 16px",
                            boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
                            zIndex: 20,
                            willChange: "transform",
                        }}
                    >
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#edeae4" }}>
                            ✓ Tarea completada
                        </div>
                        <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                            Agente Soporte #2 · hace 2 min
                        </div>
                    </div>

                    {/* ── Floating Code Snippet (bottom-center) ──── */}
                    <div data-parallax="0.8" style={{
                        ...enter(1500),
                        position: "absolute", bottom: "-65px", left: "-20px",
                        background: "rgba(14,14,13,0.95)",
                        border: "0.5px solid rgba(255,255,255,0.06)",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
                        zIndex: 20,
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: "9.5px",
                        lineHeight: 1.7,
                        willChange: "transform",
                    }}>
                        <div><span style={{ color: "#6b6864" }}>{"{"}</span></div>
                        <div style={{ paddingLeft: "12px" }}>
                            <span style={{ color: "#7a9e8a" }}>&quot;accion&quot;</span>
                            <span style={{ color: "#6b6864" }}>: </span>
                            <span style={{ color: "#c4a35a" }}>&quot;enviar_propuesta&quot;</span>
                        </div>
                        <div style={{ paddingLeft: "12px" }}>
                            <span style={{ color: "#7a9e8a" }}>&quot;cliente&quot;</span>
                            <span style={{ color: "#6b6864" }}>: </span>
                            <span style={{ color: "#c4a35a" }}>&quot;Empresa XYZ&quot;</span>
                        </div>
                        <div style={{ paddingLeft: "12px" }}>
                            <span style={{ color: "#7a9e8a" }}>&quot;valor&quot;</span>
                            <span style={{ color: "#6b6864" }}>: </span>
                            <span style={{ color: "#edeae4" }}>&quot;$24,000&quot;</span>
                        </div>
                        <div style={{ paddingLeft: "12px" }}>
                            <span style={{ color: "#7a9e8a" }}>&quot;estado&quot;</span>
                            <span style={{ color: "#6b6864" }}>: </span>
                            <span style={{ color: "#7a9e8a" }}>&quot;✓ enviado&quot;</span>
                        </div>
                        <div><span style={{ color: "#6b6864" }}>{"}"}</span></div>
                    </div>
                </div>
            </div>

            {/* ── Hero-specific styles ────────────────────────── */}
            <style>{`
                @keyframes blink {
                    50% { opacity: 0; }
                }

                .hero-beam-sweep {
                    animation: beamSweep 8s ease-in-out infinite;
                }

                @keyframes beamSweep {
                    0%, 100% { left: -60%; }
                    50% { left: 110%; }
                }

                @media (max-width: 900px) {
                    .hero-grid {
                        grid-template-columns: 1fr !important;
                        text-align: center;
                    }
                    .hero-grid > div:last-child {
                        display: none;
                    }
                }
            `}</style>
        </section>
    );
}

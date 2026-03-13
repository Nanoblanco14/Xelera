"use client";
import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import {
    Bot, MessageSquare, BarChart3, ArrowRight,
    CheckCircle, Shield, Users, Star,
    Calendar, Check, Crown, Play,
    Menu, X, Zap, TrendingUp, Lock, Plug,
    Layout, FileText, Settings2,
} from "lucide-react";
import HeroScene from "@/components/landing/HeroScene";

/* ══════════════════════════════════════════════════════════════
   Native IntersectionObserver hook (framer-motion broken w/ React 19)
   ══════════════════════════════════════════════════════════════ */

function useNativeInView(ref: React.RefObject<Element | null>, opts?: { once?: boolean; margin?: string }) {
    const [inView, setInView] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    if (opts?.once) observer.disconnect();
                } else if (!opts?.once) {
                    setInView(false);
                }
            },
            { rootMargin: opts?.margin || "0px" }
        );
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, opts?.once, opts?.margin]);
    return inView;
}

/* ── Fade-up element (scroll triggered) ─────────────────── */

function FadeUp({ children, delay = 0, className = "", style = {} }: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
}) {
    const ref = useRef(null);
    const inView = useNativeInView(ref, { once: true, margin: "-60px" });
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (inView) {
            const t = setTimeout(() => setShow(true), delay);
            return () => clearTimeout(t);
        }
    }, [inView, delay]);

    return (
        <div
            ref={ref}
            className={className}
            style={{
                ...style,
                opacity: show ? 1 : 0,
                transform: show ? "translateY(0)" : "translateY(18px)",
                transition: `opacity 0.65s cubic-bezier(0.22,0.68,0,1.1), transform 0.65s cubic-bezier(0.22,0.68,0,1.1)`,
                transitionDelay: `${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

/* ── Section wrapper ────────────────────────────────────── */

function Section({ children, className = "", style = {}, id }: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
}) {
    return (
        <section className={`section-spacing ${className}`} style={style} id={id}>
            <div className="section-container">{children}</div>
        </section>
    );
}

/* ── Animated counter hook ──────────────────────────────── */

function useCounter(end: number, duration = 1800, inView: boolean) {
    const [count, setCount] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (!inView || started.current) return;
        started.current = true;
        const start = performance.now();
        const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [inView, end, duration]);

    return count;
}

/* ══════════════════════════════════════════════════════════════
   Data
   ══════════════════════════════════════════════════════════════ */

const FEATURES = [
    {
        icon: <Bot size={22} />,
        title: "Agentes Autónomos",
        desc: "Agentes de IA que trabajan 24/7 sin supervisión. Responden, califican y cierran automáticamente.",
        large: true,
        detail: "chat",
    },
    {
        icon: <Layout size={22} />,
        title: "Pipeline Visual",
        desc: "Tablero Kanban inteligente. Arrastra leads entre etapas y visualiza tu embudo completo.",
        detail: "chart",
    },
    {
        icon: <BarChart3 size={22} />,
        title: "Analytics en Tiempo Real",
        desc: "Métricas de conversión, tiempo de respuesta y rendimiento de cada agente.",
        detail: "miniChart",
    },
    {
        icon: <MessageSquare size={22} />,
        title: "Inbox Unificado",
        desc: "Todas las conversaciones en un solo lugar. WhatsApp, web y más canales.",
    },
    {
        icon: <FileText size={22} />,
        title: "Templates Listos",
        desc: "Workflows prediseñados para ventas, soporte, onboarding y más.",
    },
    {
        icon: <Plug size={22} />,
        title: "Integraciones API",
        desc: "Conecta con tu stack existente. Webhooks, REST API y más.",
        detail: "api",
    },
];

const LOGOS = [
    "Inmobiliaria Andina", "BarberPro", "TechStore CL",
    "Salón Élite", "PropTech360", "BeautyHub",
    "NexoDigital", "VentaRápida",
];

const STATS = [
    { value: 847, suffix: "K+", label: "Tareas automatizadas" },
    { value: 99.9, suffix: "%", label: "Uptime", decimals: 1 },
    { value: 2400, suffix: "+", label: "Equipos activos", formatK: true },
    { value: 4.2, suffix: "M", label: "Mensajes procesados", decimals: 1 },
];

const HOW_IT_WORKS = [
    { step: "01", title: "Crea tu agente", desc: "Define el objetivo, tono y reglas de tu agente de IA en minutos.", icon: <Bot size={20} /> },
    { step: "02", title: "Define el workflow", desc: "Configura el pipeline, respuestas automáticas y condiciones de escalado.", icon: <Settings2 size={20} /> },
    { step: "03", title: "Déjalo correr", desc: "Tu agente trabaja 24/7: responde, califica, agenda y cierra.", icon: <Zap size={20} /> },
];

const TESTIMONIALS = [
    {
        name: "Carolina Méndez",
        role: "Directora Comercial",
        company: "Inmobiliaria Andina",
        quote: "En el primer mes automatizamos el 80% de las consultas iniciales. El agente filtra prospectos mejor que un junior.",
        initials: "CM",
    },
    {
        name: "Diego Fuentes",
        role: "Fundador",
        company: "BarberPro",
        quote: "Mis clientes agendan citas por WhatsApp a cualquier hora. Ya no pierdo reservas por no contestar a tiempo.",
        initials: "DF",
    },
    {
        name: "Valentina Rojas",
        role: "Gerente de Ventas",
        company: "TechStore CL",
        quote: "El bot responde sobre stock y precios al instante. Las conversiones subieron un 40% desde que lo implementamos.",
        initials: "VR",
    },
    {
        name: "Martín Soto",
        role: "CEO",
        company: "PropTech360",
        quote: "La integración fue increíblemente simple. En menos de una hora teníamos el agente funcionando con nuestro catálogo.",
        initials: "MS",
    },
    {
        name: "Lucía Herrera",
        role: "Dueña",
        company: "Salón Élite",
        quote: "Mis clientas reservan turnos mientras duermen. El agente nunca se equivoca con los horarios disponibles.",
        initials: "LH",
    },
    {
        name: "Andrés Muñoz",
        role: "Director",
        company: "NexoDigital",
        quote: "La calidad de los leads que llegan al pipeline mejoró enormemente. El bot filtra y califica antes de que yo intervenga.",
        initials: "AM",
    },
];

const PLANS = [
    {
        name: "Free",
        monthly: 0,
        annual: 0,
        desc: "Perfecto para probar la plataforma",
        features: [
            "1 agente IA",
            "100 mensajes/mes",
            "50 leads",
            "Pipeline básico",
            "Soporte por email",
        ],
        cta: "Empezar Gratis",
        popular: false,
    },
    {
        name: "Pro",
        monthly: 49,
        annual: 39,
        desc: "Para negocios en crecimiento",
        features: [
            "3 agentes IA",
            "2,000 mensajes/mes",
            "500 leads",
            "Pipeline completo + analítica",
            "Templates WhatsApp",
            "Notas internas",
            "Soporte prioritario",
        ],
        cta: "Comenzar Ahora",
        popular: true,
    },
    {
        name: "Enterprise",
        monthly: 99,
        annual: 79,
        desc: "Para equipos y franquicias",
        features: [
            "Agentes ilimitados",
            "Mensajes ilimitados",
            "Leads ilimitados",
            "API personalizada",
            "Multi-usuario / roles",
            "Soporte dedicado 24/7",
            "Onboarding personalizado",
        ],
        cta: "Contactar Ventas",
        popular: false,
    },
];

/* ══════════════════════════════════════════════════════════════
   Custom Cursor Component
   ══════════════════════════════════════════════════════════════ */

function CustomCursor() {
    const cursorRef = useRef<HTMLDivElement>(null);
    const pos = useRef({ x: 0, y: 0 });
    const target = useRef({ x: 0, y: 0 });
    const [expanded, setExpanded] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        // Check for touch device
        if (window.matchMedia("(pointer: coarse)").matches) return;

        const onMove = (e: MouseEvent) => {
            target.current = { x: e.clientX, y: e.clientY };
            if (!visible) setVisible(true);
        };

        const onOver = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            const interactive = t.closest("a, button, [role='button'], input, textarea, select, [data-cursor-expand]");
            setExpanded(!!interactive);
        };

        const onLeave = () => setVisible(false);
        const onEnter = () => setVisible(true);

        let animId: number;
        const lerp = () => {
            pos.current.x += (target.current.x - pos.current.x) * 0.15;
            pos.current.y += (target.current.y - pos.current.y) * 0.15;
            if (cursorRef.current) {
                cursorRef.current.style.left = `${pos.current.x}px`;
                cursorRef.current.style.top = `${pos.current.y}px`;
            }
            animId = requestAnimationFrame(lerp);
        };
        animId = requestAnimationFrame(lerp);

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseover", onOver);
        document.addEventListener("mouseleave", onLeave);
        document.addEventListener("mouseenter", onEnter);
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseover", onOver);
            document.removeEventListener("mouseleave", onLeave);
            document.removeEventListener("mouseenter", onEnter);
        };
    }, [visible]);

    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return null;

    return (
        <div
            ref={cursorRef}
            className={`custom-cursor ${expanded ? "expanded" : ""}`}
            style={{ opacity: visible ? 1 : 0 }}
        />
    );
}

/* ══════════════════════════════════════════════════════════════
   Floating Hero Elements
   ══════════════════════════════════════════════════════════════ */

function HeroFloatingTerminal() {
    return (
        <div
            className="animate-float-slow"
            style={{
                position: "absolute", top: "18%", right: "5%",
                background: "var(--bg-raised)", border: "0.5px solid var(--border)",
                borderRadius: "12px", padding: "14px 18px", width: "260px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                zIndex: 2,
            }}
        >
            <div style={{ display: "flex", gap: "5px", marginBottom: "10px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#2e1a1a" }} />
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#2e2a18" }} />
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#1a2820" }} />
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "11px", lineHeight: 1.8 }}>
                <div style={{ color: "var(--text-ghost)" }}>$ agent.run()</div>
                <div style={{ color: "var(--accent-sage)" }}>Agent: analyzing data... <span style={{ color: "var(--accent-warm)" }}>✓ 847ms</span></div>
                <div style={{ color: "var(--text-muted)" }}>→ 3 leads qualified</div>
            </div>
        </div>
    );
}

function HeroFloatingBadge() {
    return (
        <div
            className="animate-float-alt"
            style={{
                position: "absolute", top: "55%", right: "3%",
                background: "var(--bg-raised)", border: "0.5px solid var(--border-accent)",
                borderRadius: "20px", padding: "8px 16px",
                display: "flex", alignItems: "center", gap: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                zIndex: 2,
            }}
        >
            <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "var(--accent-sage)",
                boxShadow: "0 0 6px rgba(122,158,138,0.5)",
                animation: "subtlePulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "0.03em" }}>
                3 agents running
            </span>
        </div>
    );
}

function HeroSVGNodes() {
    return (
        <svg
            className="animate-float"
            viewBox="0 0 160 120"
            style={{
                position: "absolute", bottom: "20%", right: "12%",
                width: "160px", height: "120px", zIndex: 1,
            }}
        >
            <line x1="40" y1="30" x2="120" y2="30" stroke="rgba(122,158,138,0.2)" strokeWidth="0.5" />
            <line x1="40" y1="30" x2="80" y2="90" stroke="rgba(122,158,138,0.2)" strokeWidth="0.5" />
            <line x1="120" y1="30" x2="80" y2="90" stroke="rgba(100,130,170,0.2)" strokeWidth="0.5" />
            <circle cx="40" cy="30" r="6" fill="var(--bg-raised)" stroke="var(--accent-sage)" strokeWidth="0.5" />
            <circle cx="120" cy="30" r="6" fill="var(--bg-raised)" stroke="var(--accent-slate)" strokeWidth="0.5" />
            <circle cx="80" cy="90" r="6" fill="var(--bg-raised)" stroke="var(--accent-warm)" strokeWidth="0.5" />
            <circle cx="40" cy="30" r="2.5" fill="var(--accent-sage)" opacity="0.6" />
            <circle cx="120" cy="30" r="2.5" fill="var(--accent-slate)" opacity="0.6" />
            <circle cx="80" cy="90" r="2.5" fill="var(--accent-warm)" opacity="0.6" />
        </svg>
    );
}

/* ── Mini chart for bento feature ─────────────────────── */

function MiniLineChart() {
    return (
        <svg viewBox="0 0 200 60" style={{ width: "100%", height: "50px", marginTop: "16px" }}>
            <polyline
                points="0,50 30,38 60,42 90,25 120,30 150,15 180,20 200,8"
                fill="none"
                stroke="var(--accent-sage)"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <polyline
                points="0,50 30,38 60,42 90,25 120,30 150,15 180,20 200,8"
                fill="url(#chartGradient)"
                stroke="none"
            />
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(122,158,138,0.15)" />
                    <stop offset="100%" stopColor="rgba(122,158,138,0)" />
                </linearGradient>
            </defs>
        </svg>
    );
}

/* ══════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [billingAnnual, setBillingAnnual] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div style={{ background: "var(--bg-deep)", minHeight: "100vh" }}>

            {/* ═══════════════════════ 01. NAVBAR ═══════════════════════ */}
            <nav
                className={`landing-nav ${scrolled ? "scrolled" : ""}`}
                style={{
                    position: "fixed", top: 0, left: 0, right: 0,
                    zIndex: 50, padding: "0 24px",
                    background: scrolled ? undefined : "transparent",
                    borderBottom: scrolled ? undefined : "0.5px solid transparent",
                }}
            >
                <div style={{
                    maxWidth: "1200px", margin: "0 auto",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", height: "64px",
                }}>
                    <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                        <div style={{
                            width: "34px", height: "34px", borderRadius: "10px",
                            background: "linear-gradient(135deg, #7a9e8a 0%, #5d8270 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1rem", fontWeight: 700, color: "var(--bg-deep)",
                        }}>M</div>
                        <span style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: "1.15rem", fontWeight: 400,
                            color: "var(--text-primary)", letterSpacing: "-0.02em",
                        }}>MiAgente</span>
                    </Link>

                    <div style={{ display: "flex", gap: "32px", alignItems: "center" }} className="nav-links-desktop">
                        {[
                            { label: "Features", href: "#funciones" },
                            { label: "Pipeline", href: "#demo" },
                            { label: "Pricing", href: "#precios" },
                        ].map((item) => (
                            <a key={item.label} href={item.href} className="hover-line" style={{
                                color: "var(--text-secondary)", fontSize: "0.85rem",
                                fontWeight: 500, textDecoration: "none", padding: "4px 0",
                                transition: "color 0.2s",
                            }}>{item.label}</a>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <Link href="/login" style={{
                            color: "var(--text-secondary)", fontSize: "0.85rem",
                            fontWeight: 500, textDecoration: "none",
                        }} className="nav-login-desktop">Ingresar</Link>
                        <Link href="/login" className="btn-primary nav-cta-desktop" style={{ fontSize: "0.82rem", padding: "8px 20px" }}>
                            Empezar gratis
                        </Link>
                        <button
                            onClick={() => setMobileMenu(!mobileMenu)}
                            className="nav-hamburger"
                            style={{
                                display: "none", background: "none", border: "none",
                                color: "var(--text-primary)", padding: "4px",
                            }}
                        >
                            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {mobileMenu && (
                    <div style={{
                        padding: "16px 24px 24px",
                        borderTop: "0.5px solid var(--border)",
                        background: "rgba(14,14,13,0.95)",
                        backdropFilter: "blur(20px)",
                    }}>
                        {["Features", "Pipeline", "Pricing"].map((label) => (
                            <a key={label} href={`#${label.toLowerCase()}`} onClick={() => setMobileMenu(false)} style={{
                                display: "block", padding: "12px 0",
                                color: "var(--text-secondary)", fontSize: "0.9rem",
                                textDecoration: "none", borderBottom: "0.5px solid var(--border)",
                            }}>{label}</a>
                        ))}
                        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                            <Link href="/login" className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Ingresar</Link>
                            <Link href="/login" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>Empezar gratis</Link>
                        </div>
                    </div>
                )}
            </nav>

            <style>{`
                @media (max-width: 768px) {
                    .nav-links-desktop, .nav-login-desktop, .nav-cta-desktop { display: none !important; }
                    .nav-hamburger { display: block !important; }
                }
            `}</style>


            {/* ═══════════════════════ 02. HERO ═══════════════════════ */}
            <HeroScene />


            {/* ═══════════════════ 03. SOCIAL PROOF ═══════════════════ */}
            <div style={{
                borderTop: "0.5px solid var(--border)",
                borderBottom: "0.5px solid var(--border)",
                padding: "32px 0",
                overflow: "hidden",
            }}>
                <p style={{
                    textAlign: "center", fontSize: "11px", fontWeight: 400,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--text-muted)", marginBottom: "24px",
                }}>
                    +2,400 equipos automatizando con MiAgente
                </p>
                <div style={{ overflow: "hidden" }}>
                    <div className="marquee-track">
                        {[...LOGOS, ...LOGOS].map((name, i) => (
                            <div key={i} style={{
                                padding: "0 40px", display: "flex", alignItems: "center",
                                gap: "8px", whiteSpace: "nowrap",
                                color: "var(--text-ghost)", fontSize: "1rem", fontWeight: 600,
                                letterSpacing: "-0.01em",
                            }}>
                                <div style={{
                                    width: "6px", height: "6px", borderRadius: "50%",
                                    background: "var(--accent-sage)", opacity: 0.3,
                                }} />
                                {name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            {/* ═══════════════════ 04. FEATURES BENTO GRID ═══════════════════ */}
            <Section id="funciones">
                <FadeUp style={{ textAlign: "center", marginBottom: "56px" }}>
                    <span className="tag" style={{ marginBottom: "16px", display: "inline-block" }}>Funciones</span>
                    <h2 className="text-section-title" style={{ marginTop: "16px" }}>
                        Todo lo que necesitas para automatizar
                    </h2>
                    <p style={{
                        color: "var(--text-secondary)", fontSize: "15px",
                        maxWidth: "500px", margin: "16px auto 0", lineHeight: 1.75,
                    }}>
                        Desde la primera conversación hasta el cierre, tus agentes gestionan cada paso del proceso.
                    </p>
                </FadeUp>

                <div className="bento-grid">
                    {FEATURES.map((f, i) => (
                        <FadeUp
                            key={i}
                            delay={i * 100}
                            className={`glass-card card-hover-lift ${f.large ? "bento-large" : ""}`}
                            style={{ padding: f.large ? "36px" : "28px", display: "flex", flexDirection: "column" }}
                        >
                            <div style={{
                                width: "42px", height: "42px", borderRadius: "12px",
                                background: "var(--accent-subtle)",
                                border: "0.5px solid rgba(122,158,138,0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "var(--accent-sage)", marginBottom: "20px",
                                transition: "transform 0.3s var(--ease-bounce)",
                            }}>
                                {f.icon}
                            </div>
                            <h3 style={{
                                fontSize: f.large ? "18px" : "18px",
                                fontWeight: 500, color: "var(--text-primary)",
                                marginBottom: "10px",
                            }}>{f.title}</h3>
                            <p style={{
                                color: "var(--text-secondary)", fontSize: "15px",
                                lineHeight: 1.75, flex: 1,
                            }}>{f.desc}</p>

                            {/* Micro-animated details per card */}
                            {f.detail === "chat" && (
                                <div style={{
                                    marginTop: "28px", padding: "20px",
                                    background: "var(--bg-deep)", borderRadius: "var(--radius)",
                                    border: "0.5px solid var(--border)",
                                }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <div style={{
                                            alignSelf: "flex-end", background: "var(--accent-sage)",
                                            color: "var(--bg-deep)", padding: "8px 14px",
                                            borderRadius: "12px 12px 4px 12px", fontSize: "13px", maxWidth: "70%",
                                        }}>Hola, me interesa el departamento de 3 dormitorios</div>
                                        <div style={{
                                            alignSelf: "flex-start", background: "var(--bg-raised)",
                                            color: "var(--text-primary)", padding: "8px 14px",
                                            borderRadius: "12px 12px 12px 4px", fontSize: "13px",
                                            border: "0.5px solid var(--border)", maxWidth: "70%",
                                        }}>¡Hola! El depto. de 3 dormitorios está en $185,000 USD, 120m². ¿Te gustaría agendar una visita?</div>
                                    </div>
                                </div>
                            )}
                            {f.detail === "miniChart" && <MiniLineChart />}
                            {f.detail === "api" && (
                                <div style={{
                                    marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "6px",
                                    padding: "5px 12px", borderRadius: "20px",
                                    background: "rgba(100,130,170,0.08)",
                                    border: "0.5px solid rgba(100,130,170,0.2)",
                                }}>
                                    <div style={{
                                        width: "6px", height: "6px", borderRadius: "50%",
                                        background: "var(--accent-slate)",
                                        animation: "apiBlink 2s ease-in-out infinite",
                                    }} />
                                    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--accent-slate)", letterSpacing: "0.05em" }}>API</span>
                                </div>
                            )}
                            {f.detail === "chart" && (
                                <div style={{
                                    marginTop: "16px", height: "6px", borderRadius: "3px",
                                    background: "var(--bg-deep)", overflow: "hidden",
                                }}>
                                    <div style={{
                                        height: "100%", borderRadius: "3px",
                                        background: "var(--accent-sage)", width: "72%",
                                        animation: "progressFill 2s ease-out forwards",
                                    }} />
                                </div>
                            )}
                        </FadeUp>
                    ))}
                </div>
            </Section>


            {/* ═══════════════════ 05. DEMO PREVIEW ═══════════════════ */}
            <Section id="demo" style={{ background: "var(--bg-void)" }}>
                <FadeUp style={{ textAlign: "center", marginBottom: "48px" }}>
                    <span className="tag" style={{ marginBottom: "16px", display: "inline-block" }}>Demo</span>
                    <h2 className="text-section-title" style={{ marginTop: "16px" }}>
                        Tu plataforma de agentes completa
                    </h2>
                </FadeUp>

                <FadeUp delay={150}>
                    <div style={{
                        background: "var(--bg-surface)",
                        border: "0.5px solid var(--border)",
                        borderRadius: "var(--radius-2xl)",
                        overflow: "hidden",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                        position: "relative",
                    }}>
                        {/* Topbar dots */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "13px 20px",
                            borderBottom: "0.5px solid var(--border)",
                        }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2e1a1a" }} />
                                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2e2a18" }} />
                                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1a2820" }} />
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--text-ghost)", letterSpacing: "0.07em" }}>miagente.app/dashboard</span>
                            <div style={{ width: "50px" }} />
                        </div>

                        {/* Tab bar */}
                        <div style={{
                            display: "flex", gap: "0", borderBottom: "0.5px solid var(--border)",
                            padding: "0 4px",
                        }}>
                            {["Pipeline", "Agentes", "Analytics"].map((tab, i) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(i)}
                                    style={{
                                        padding: "14px 24px", border: "none", cursor: "pointer",
                                        background: activeTab === i ? "var(--bg-raised)" : "transparent",
                                        color: activeTab === i ? "var(--accent-sage)" : "var(--text-muted)",
                                        fontSize: "13px", fontWeight: 500,
                                        borderBottom: activeTab === i ? "1.5px solid var(--accent-sage)" : "1.5px solid transparent",
                                        transition: "all 0.2s",
                                    }}
                                >{tab}</button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div style={{ padding: "32px", minHeight: "320px", position: "relative" }}>
                            {/* Toast notification */}
                            <div style={{
                                position: "absolute", top: "12px", right: "12px",
                                background: "var(--bg-raised)", border: "0.5px solid var(--border-accent)",
                                borderRadius: "10px", padding: "10px 16px",
                                display: "flex", alignItems: "center", gap: "8px",
                                animation: "toastIn 4s ease-in-out infinite",
                                zIndex: 5,
                            }}>
                                <CheckCircle size={14} style={{ color: "var(--accent-sage)" }} />
                                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Agent completed task</span>
                            </div>

                            {activeTab === 0 && (
                                <div style={{ display: "flex", gap: "16px", overflowX: "auto" }}>
                                    {[
                                        { stage: "Nuevo Lead", count: 8, color: "var(--accent-sage)" },
                                        { stage: "Contactado", count: 5, color: "var(--accent-slate)" },
                                        { stage: "Calificado", count: 3, color: "var(--accent-warm)" },
                                        { stage: "Cierre", count: 2, color: "var(--success)" },
                                    ].map((col) => (
                                        <div key={col.stage} style={{ flex: "1", minWidth: "160px" }}>
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "8px",
                                                marginBottom: "14px", padding: "0 4px",
                                            }}>
                                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.color }} />
                                                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>{col.stage}</span>
                                                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>{col.count}</span>
                                            </div>
                                            {Array.from({ length: Math.min(col.count, 3) }).map((_, j) => (
                                                <div key={j} style={{
                                                    padding: "14px", background: "var(--bg-raised)",
                                                    border: "0.5px solid var(--border)",
                                                    borderRadius: "var(--radius)", marginBottom: "8px",
                                                }}>
                                                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                                                        Lead #{j + 1}
                                                    </div>
                                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                                                        WhatsApp · hace {j + 1}h
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeTab === 1 && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                    {[
                                        { name: "Sales Agent", status: "Activo", msgs: "1,247" },
                                        { name: "Support Bot", status: "Activo", msgs: "892" },
                                        { name: "Onboarding", status: "Pausado", msgs: "456" },
                                    ].map((agent) => (
                                        <div key={agent.name} style={{
                                            padding: "20px", background: "var(--bg-raised)",
                                            border: "0.5px solid var(--border)",
                                            borderRadius: "var(--radius)",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                                <Bot size={16} style={{ color: "var(--accent-sage)" }} />
                                                <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{agent.name}</span>
                                            </div>
                                            <div style={{ fontSize: "11px", color: agent.status === "Activo" ? "var(--accent-sage)" : "var(--text-muted)", marginBottom: "8px" }}>
                                                ● {agent.status}
                                            </div>
                                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{agent.msgs} mensajes</div>
                                            {/* Typing indicator */}
                                            {agent.status === "Activo" && (
                                                <div style={{ display: "flex", gap: "3px", marginTop: "12px" }}>
                                                    {[0, 1, 2].map((d) => (
                                                        <div key={d} style={{
                                                            width: "4px", height: "4px", borderRadius: "50%",
                                                            background: "var(--accent-sage)",
                                                            animation: `typingDot 1.4s ease-in-out ${d * 0.2}s infinite`,
                                                        }} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeTab === 2 && (
                                <div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "28px" }}>
                                        {[
                                            { label: "Leads totales", value: "2,847" },
                                            { label: "Conversiones", value: "412" },
                                            { label: "Tasa cierre", value: "26.7%" },
                                            { label: "Tiempo respuesta", value: "< 30s" },
                                        ].map((kpi) => (
                                            <div key={kpi.label} style={{
                                                padding: "16px", background: "var(--bg-raised)",
                                                border: "0.5px solid var(--border)", borderRadius: "var(--radius)",
                                            }}>
                                                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                                                <div style={{ fontSize: "1.4rem", fontWeight: 400, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif", marginTop: "4px" }}>{kpi.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "120px" }}>
                                        {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
                                            <div key={i} style={{
                                                flex: 1, height: `${h}%`,
                                                background: i === 5 ? "var(--accent-sage)" : "rgba(122,158,138,0.15)",
                                                borderRadius: "6px 6px 0 0",
                                                transition: "all 0.3s",
                                            }} />
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                                            <div key={d} style={{ flex: 1, textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}>{d}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </FadeUp>
            </Section>


            {/* ═══════════════════ 06. MÉTRICAS ═══════════════════ */}
            <MetricsSection />


            {/* ═══════════════════ 07. CÓMO FUNCIONA ═══════════════════ */}
            <Section>
                <FadeUp style={{ textAlign: "center", marginBottom: "64px" }}>
                    <span className="tag" style={{ marginBottom: "16px", display: "inline-block" }}>Proceso</span>
                    <h2 className="text-section-title" style={{ marginTop: "16px" }}>
                        Tres pasos para automatizar
                    </h2>
                </FadeUp>

                <div style={{ position: "relative", maxWidth: "900px", margin: "0 auto" }}>
                    {/* Connector line — desktop */}
                    <div className="nav-links-desktop" style={{
                        position: "absolute", top: "32px", left: "16.67%", right: "16.67%",
                        height: "1px", background: "var(--border-subtle)",
                    }}>
                        <HowItWorksLine />
                    </div>

                    <div style={{
                        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px",
                    }}>
                        {HOW_IT_WORKS.map((item, i) => (
                            <FadeUp key={i} delay={i * 120} style={{ textAlign: "center", position: "relative" }}>
                                <div style={{
                                    width: "48px", height: "48px", borderRadius: "50%",
                                    background: "var(--bg-raised)", border: "0.5px solid var(--border-accent)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto 20px", color: "var(--accent-sage)",
                                    position: "relative", zIndex: 2,
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{
                                    fontSize: "11px", color: "var(--accent-sage)",
                                    letterSpacing: "0.1em", fontWeight: 500, marginBottom: "8px",
                                }}>{item.step}</div>
                                <h3 style={{
                                    fontSize: "18px", fontWeight: 500,
                                    color: "var(--text-primary)", marginBottom: "8px",
                                }}>{item.title}</h3>
                                <p style={{
                                    fontSize: "15px", color: "var(--text-secondary)",
                                    lineHeight: 1.75, maxWidth: "260px", margin: "0 auto",
                                }}>{item.desc}</p>
                            </FadeUp>
                        ))}
                    </div>
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .how-steps-grid { grid-template-columns: 1fr !important; }
                    }
                `}</style>
            </Section>


            {/* ═══════════════════ 08. TESTIMONIALS ═══════════════════ */}
            <Section style={{ background: "var(--bg-void)" }}>
                <FadeUp style={{ textAlign: "center", marginBottom: "56px" }}>
                    <span className="tag" style={{ marginBottom: "16px", display: "inline-block" }}>Testimonios</span>
                    <h2 className="text-section-title" style={{ marginTop: "16px" }}>
                        Lo que dicen nuestros clientes
                    </h2>
                </FadeUp>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                }}>
                    {TESTIMONIALS.map((t, i) => (
                        <FadeUp
                            key={i}
                            delay={i * 100}
                            className="glass-card card-hover-lift"
                            style={{ padding: "28px" }}
                        >
                            <div style={{ display: "flex", gap: "3px", marginBottom: "16px" }}>
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <Star key={j} size={14} fill="var(--accent-warm)" color="var(--accent-warm)" />
                                ))}
                            </div>
                            <p style={{
                                color: "var(--text-secondary)", fontSize: "15px",
                                lineHeight: 1.75, marginBottom: "20px",
                            }}>
                                &ldquo;{t.quote}&rdquo;
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{
                                    width: "38px", height: "38px", borderRadius: "50%",
                                    background: "var(--accent-subtle)",
                                    border: "0.5px solid var(--border-accent)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "11px", fontWeight: 600, color: "var(--accent-sage)",
                                    letterSpacing: "0.02em",
                                }}>{t.initials}</div>
                                <div>
                                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{t.name}</div>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.role} · {t.company}</div>
                                </div>
                            </div>
                        </FadeUp>
                    ))}
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .section-spacing .bento-grid,
                        .section-spacing > div > div[style*="grid-template-columns: repeat(3"] {
                            grid-template-columns: 1fr !important;
                        }
                    }
                `}</style>
            </Section>


            {/* ═══════════════════ 09. PRICING ═══════════════════ */}
            <Section id="precios">
                <FadeUp style={{ textAlign: "center", marginBottom: "48px" }}>
                    <span className="tag" style={{ marginBottom: "16px", display: "inline-block" }}>Precios</span>
                    <h2 className="text-section-title" style={{ marginTop: "16px" }}>
                        Planes simples, sin sorpresas
                    </h2>
                    <p style={{
                        color: "var(--text-secondary)", fontSize: "15px",
                        maxWidth: "460px", margin: "16px auto 0", lineHeight: 1.75,
                    }}>
                        Empieza gratis y escala cuando quieras.
                    </p>

                    <div className="pricing-toggle" style={{ marginTop: "28px" }}>
                        <button
                            className={!billingAnnual ? "active" : ""}
                            onClick={() => setBillingAnnual(false)}
                        >Mensual</button>
                        <button
                            className={billingAnnual ? "active" : ""}
                            onClick={() => setBillingAnnual(true)}
                        >
                            Anual{" "}
                            <span style={{
                                fontSize: "11px",
                                color: billingAnnual ? "var(--bg-deep)" : "var(--accent-sage)",
                                fontWeight: 600, marginLeft: "4px",
                                background: billingAnnual ? "transparent" : "rgba(122,158,138,0.1)",
                                padding: billingAnnual ? "0" : "2px 8px",
                                borderRadius: "10px",
                            }}>2 meses gratis</span>
                        </button>
                    </div>
                </FadeUp>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px", maxWidth: "960px", margin: "0 auto",
                }}>
                    {PLANS.map((plan, i) => (
                        <FadeUp
                            key={i}
                            delay={i * 120}
                            className="glass-card"
                            style={{
                                padding: "32px",
                                position: "relative",
                                borderColor: plan.popular ? "var(--border-accent)" : undefined,
                            }}
                        >
                            {plan.popular && (
                                <div style={{
                                    position: "absolute", top: "-12px", left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "var(--accent-sage)", color: "var(--bg-deep)",
                                    padding: "4px 16px", borderRadius: "20px",
                                    fontSize: "11px", fontWeight: 600,
                                    textTransform: "uppercase", letterSpacing: "0.05em",
                                    display: "flex", alignItems: "center", gap: "4px",
                                }}>
                                    <Crown size={12} /> Popular
                                </div>
                            )}
                            <h3 style={{
                                fontSize: "18px", fontWeight: 500,
                                color: "var(--text-primary)", marginBottom: "8px",
                            }}>{plan.name}</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
                                {plan.desc}
                            </p>
                            <div style={{ marginBottom: "24px" }}>
                                <span style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: "2.5rem", fontWeight: 400,
                                    color: "var(--text-primary)", letterSpacing: "-0.03em",
                                }}>
                                    ${billingAnnual ? plan.annual : plan.monthly}
                                </span>
                                <span style={{ color: "var(--text-muted)", fontSize: "15px" }}>/mes</span>
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                {plan.features.map((f, j) => (
                                    <li key={j} style={{
                                        display: "flex", alignItems: "center", gap: "10px",
                                        fontSize: "15px", color: "var(--text-secondary)",
                                    }}>
                                        <Check size={14} style={{ color: "var(--accent-sage)", flexShrink: 0 }} />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href="/login"
                                className={plan.popular ? "btn-primary" : "btn-secondary"}
                                style={{
                                    width: "100%", justifyContent: "center",
                                    padding: "12px 24px", textDecoration: "none",
                                }}
                            >
                                {plan.cta}
                            </Link>
                        </FadeUp>
                    ))}
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        #precios .section-container > div[style*="grid-template-columns: repeat(3"] {
                            grid-template-columns: 1fr !important;
                        }
                    }
                `}</style>
            </Section>


            {/* ═══════════════════ 10. CTA FINAL ═══════════════════ */}
            <section style={{
                padding: "var(--section-gap) 24px",
                position: "relative", overflow: "hidden",
            }}>
                {/* Orbs */}
                <div style={{
                    position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
                    width: "450px", height: "450px", borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(122,158,138,0.05) 0%, transparent 70%)",
                    filter: "blur(80px)", pointerEvents: "none",
                }} />

                <FadeUp style={{
                    maxWidth: "700px", margin: "0 auto", textAlign: "center",
                    position: "relative",
                }}>
                    <h2 className="text-section-title" style={{ marginBottom: "16px" }}>
                        <span style={{ color: "var(--text-primary)" }}>¿Listo para</span>{" "}
                        <span style={{ color: "var(--accent-sage)" }}>automatizar</span>
                        <span style={{ color: "var(--text-primary)" }}>?</span>
                    </h2>
                    <p style={{
                        color: "var(--text-secondary)", fontSize: "15px",
                        lineHeight: 1.75, marginBottom: "36px", maxWidth: "500px",
                        margin: "0 auto 36px",
                    }}>
                        Únete a +2,400 equipos que ya automatizan sus procesos de negocio con agentes de IA.
                    </p>
                    <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
                        <Link href="/login" className="btn-primary" style={{ fontSize: "0.9rem", padding: "14px 32px" }}>
                            Crear mi primer agente <ArrowRight size={16} />
                        </Link>
                        <a href="#precios" className="btn-secondary" style={{ fontSize: "0.9rem", padding: "14px 32px" }}>
                            Ver precios
                        </a>
                    </div>
                </FadeUp>
            </section>


            {/* ═══════════════════ 11. FOOTER ═══════════════════ */}
            <footer style={{
                borderTop: "0.5px solid var(--border)",
                padding: "64px 24px 32px",
            }}>
                <div style={{
                    maxWidth: "1200px", margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "40px",
                }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                            <div style={{
                                width: "30px", height: "30px", borderRadius: "8px",
                                background: "linear-gradient(135deg, #7a9e8a 0%, #5d8270 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.85rem", fontWeight: 700, color: "var(--bg-deep)",
                            }}>M</div>
                            <span style={{
                                fontFamily: "'Playfair Display', serif", fontSize: "1.05rem",
                                fontWeight: 400, color: "var(--text-primary)",
                            }}>MiAgente</span>
                        </div>
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.75, maxWidth: "240px" }}>
                            Agentes de IA autónomos para tu negocio. Automatiza ventas, soporte y operaciones.
                        </p>
                    </div>

                    {[
                        {
                            title: "Producto",
                            links: ["Funciones", "Precios", "Integraciones", "API Docs"],
                        },
                        {
                            title: "Empresa",
                            links: ["Sobre nosotros", "Blog", "Contacto", "Soporte"],
                        },
                        {
                            title: "Legal",
                            links: [
                                { label: "Privacidad", href: "/privacy" },
                                { label: "Términos de Servicio", href: "#" },
                                { label: "Cookies", href: "#" },
                            ],
                        },
                    ].map((col) => (
                        <div key={col.title}>
                            <h4 style={{
                                fontSize: "11px", fontWeight: 400, textTransform: "uppercase",
                                letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "16px",
                            }}>{col.title}</h4>
                            {col.links.map((l) => {
                                const label = typeof l === "string" ? l : l.label;
                                const href = typeof l === "string" ? "#" : l.href;
                                return (
                                    <Link key={label} href={href} style={{
                                        display: "block", color: "var(--text-ghost)", fontSize: "15px",
                                        textDecoration: "none", padding: "5px 0",
                                        transition: "color 0.2s",
                                    }}>{label}</Link>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div style={{
                    maxWidth: "1200px", margin: "40px auto 0",
                    paddingTop: "24px",
                    borderTop: "0.5px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "12px",
                }}>
                    <span style={{ color: "var(--text-ghost)", fontSize: "13px" }}>
                        © {new Date().getFullYear()} MiAgente. Todos los derechos reservados.
                    </span>
                    <div style={{ display: "flex", gap: "16px" }}>
                        {["X", "Li", "Ig"].map((s) => (
                            <a key={s} href="#" style={{
                                width: "32px", height: "32px", borderRadius: "50%",
                                background: "rgba(255,255,255,0.03)",
                                border: "0.5px solid var(--border)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "var(--text-muted)", fontSize: "11px", fontWeight: 600,
                                textDecoration: "none",
                                transition: "all 0.2s",
                            }}>{s}</a>
                        ))}
                    </div>
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        footer > div:first-child { grid-template-columns: 1fr 1fr !important; }
                    }
                    @media (max-width: 480px) {
                        footer > div:first-child { grid-template-columns: 1fr !important; }
                    }
                `}</style>
            </footer>
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════
   Metrics Section (separate component for counter hooks)
   ══════════════════════════════════════════════════════════════ */

function MetricsSection() {
    const ref = useRef(null);
    const inView = useNativeInView(ref, { once: true, margin: "-60px" });

    return (
        <section
            ref={ref}
            style={{
                background: "var(--bg-raised)",
                borderTop: "0.5px solid var(--border)",
                borderBottom: "0.5px solid var(--border)",
            }}
            className="section-spacing"
        >
            <div className="section-container">
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "32px",
                }}>
                    {STATS.map((stat, i) => (
                        <MetricItem key={i} stat={stat} inView={inView} />
                    ))}
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .section-container > div[style*="grid-template-columns: repeat(4"] {
                            grid-template-columns: repeat(2, 1fr) !important;
                        }
                    }
                `}</style>
            </div>
        </section>
    );
}

function MetricItem({ stat, inView }: {
    stat: { value: number; suffix: string; label: string; decimals?: number; formatK?: boolean };
    inView: boolean;
}) {
    const count = useCounter(stat.formatK ? 2400 : stat.decimals ? Math.round(stat.value * 10) : stat.value, 1800, inView);

    const displayValue = stat.decimals
        ? (count / 10).toFixed(stat.decimals)
        : stat.formatK
        ? (count / 1000).toFixed(1).replace(/\.0$/, "") + "," + String(count % 1000).padStart(3, "0").replace(/0+$/, "").padEnd(1, "0")
        : count;

    // Simpler display for formatted numbers
    const formattedValue = stat.formatK
        ? count.toLocaleString()
        : stat.decimals
        ? (count / 10).toFixed(stat.decimals)
        : count;

    return (
        <div style={{ textAlign: "center" }}>
            <div style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 400, color: "var(--text-primary)",
                letterSpacing: "-0.03em",
            }}>
                {formattedValue}{stat.suffix}
            </div>
            <div style={{
                fontSize: "11px", color: "var(--text-muted)",
                letterSpacing: "0.08em", marginTop: "8px",
                textTransform: "uppercase",
            }}>
                {stat.label}
            </div>
        </div>
    );
}


/* ══════════════════════════════════════════════════════════════
   How It Works connector line (animates on scroll)
   ══════════════════════════════════════════════════════════════ */

function HowItWorksLine() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useNativeInView(ref as React.RefObject<Element>, { once: true, margin: "-40px" });

    return (
        <div
            ref={ref}
            style={{
                position: "absolute", top: 0, left: 0,
                height: "100%",
                width: inView ? "100%" : "0%",
                background: "var(--accent-sage)",
                opacity: 0.4,
                transition: "width 1.2s cubic-bezier(0.22,0.68,0,1.1)",
            }}
        />
    );
}

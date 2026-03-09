"use client";
import Link from "next/link";
import {
    Zap, MessageSquare, BarChart3, Bot, ArrowRight,
    CheckCircle, Sparkles, Clock, Shield, Users, Star,
    Building2, Scissors, ShoppingBag, ChevronRight,
    Phone, Calendar, TrendingUp, Check, Crown,
    Mail, FileText, Globe,
} from "lucide-react";

// ── Feature data ──────────────────────────────────────────
const FEATURES = [
    {
        icon: <Bot size={22} />,
        title: "Agente IA en WhatsApp",
        desc: "Tu asistente virtual atiende clientes 24/7 por WhatsApp. Responde preguntas, filtra prospectos y agenda citas automáticamente.",
    },
    {
        icon: <MessageSquare size={22} />,
        title: "Conversaciones Inteligentes",
        desc: "El agente mantiene conversaciones naturales, adapta su tono a tu marca y nunca inventa información que no exista en tu catálogo.",
    },
    {
        icon: <Calendar size={22} />,
        title: "Agenda Automática",
        desc: "Cuando un prospecto está listo, el agente agenda citas confirmando fecha y hora. Se integra con tu calendario real.",
    },
    {
        icon: <BarChart3 size={22} />,
        title: "Pipeline Visual",
        desc: "Visualiza todos tus leads en un tablero Kanban. Arrastra, filtra y prioriza prospectos como un CRM profesional.",
    },
    {
        icon: <Shield size={22} />,
        title: "Anti-Alucinación",
        desc: "Reglas estrictas impiden que el agente invente productos, precios o información. Solo responde con datos reales de tu negocio.",
    },
    {
        icon: <Users size={22} />,
        title: "Intervención Humana",
        desc: "Cuando el cliente necesita un humano, el bot se pausa automáticamente y te notifica. Tú intervienes desde el inbox.",
    },
];

const INDUSTRIES = [
    {
        icon: <Scissors size={20} />,
        name: "Peluquerías y Estéticas",
        desc: "Agenda turnos, muestra servicios y precios",
        color: "#ec4899",
    },
    {
        icon: <Building2 size={20} />,
        name: "Inmobiliarias",
        desc: "Filtra compradores, muestra propiedades, agenda visitas",
        color: "#3b82f6",
    },
    {
        icon: <ShoppingBag size={20} />,
        name: "E-commerce",
        desc: "Recomienda productos, resuelve dudas, cierra ventas",
        color: "#22c55e",
    },
];

const STEPS = [
    {
        num: "01",
        title: "Crea tu cuenta",
        desc: "Regístrate gratis y configura tu organización en menos de 2 minutos.",
    },
    {
        num: "02",
        title: "Configura tu agente",
        desc: "Elige tu industria, carga tu catálogo y personaliza el tono de tu bot.",
    },
    {
        num: "03",
        title: "Conecta WhatsApp",
        desc: "Vincula tu número de WhatsApp Business y activa el agente.",
    },
    {
        num: "04",
        title: "Vende en automático",
        desc: "Tu agente atiende clientes 24/7 mientras tú te enfocas en crecer.",
    },
];

const STATS = [
    { value: "24/7", label: "Disponibilidad" },
    { value: "15min", label: "Ahorro por lead" },
    { value: "3x", label: "Más conversiones" },
    { value: "<2min", label: "Tiempo de setup" },
];

const PLANS = [
    {
        name: "Starter",
        price: "$0",
        period: "/mes",
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
        price: "$49",
        period: "/mes",
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
        price: "$99",
        period: "/mes",
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

const TESTIMONIALS = [
    {
        name: "Carolina Méndez",
        role: "Directora Comercial",
        company: "Inmobiliaria Andina",
        industry: "Inmobiliaria",
        quote: "En el primer mes automatizamos el 80% de las consultas iniciales. El agente filtra prospectos mejor que un junior y agenda visitas sin errores.",
        rating: 5,
    },
    {
        name: "Diego Fuentes",
        role: "Fundador",
        company: "BarberPro",
        industry: "Peluquería",
        quote: "Mis clientes agendan citas por WhatsApp a cualquier hora. Ya no pierdo reservas por no contestar a tiempo. Ha sido un cambio total.",
        rating: 5,
    },
    {
        name: "Valentina Rojas",
        role: "Gerente de Ventas",
        company: "TechStore CL",
        industry: "E-commerce",
        quote: "El bot responde preguntas sobre stock y precios al instante. Las conversiones subieron un 40% desde que lo implementamos.",
        rating: 5,
    },
];

// ── Page Component ────────────────────────────────────────
export default function LandingPage() {
    return (
        <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>

            {/* ═══════════════════════════════════════════
                NAVBAR
            ═══════════════════════════════════════════ */}
            <nav style={{
                position: "fixed", top: 0, left: 0, right: 0,
                zIndex: 50, padding: "0 24px",
                background: "rgba(9,9,11,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderBottom: "1px solid var(--border)",
            }}>
                <div style={{
                    maxWidth: "1200px", margin: "0 auto",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", height: "64px",
                }}>
                    {/* Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                            width: "34px", height: "34px", borderRadius: "10px",
                            background: "var(--gradient-1)",
                            display: "flex", alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Zap size={18} color="white" />
                        </div>
                        <span style={{
                            fontSize: "1.1rem", fontWeight: 700,
                            color: "var(--text-primary)",
                            letterSpacing: "-0.02em",
                        }}>
                            MiAgente
                        </span>
                    </div>

                    {/* Nav links */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "32px",
                        fontSize: "0.85rem", fontWeight: 500,
                    }}>
                        <a href="#features" style={{ color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}>
                            Funciones
                        </a>
                        <a href="#how-it-works" style={{ color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}>
                            Cómo funciona
                        </a>
                        <a href="#industries" style={{ color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}>
                            Industrias
                        </a>
                        <a href="#pricing" style={{ color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}>
                            Precios
                        </a>
                        <Link href="/login" style={{
                            color: "var(--text-secondary)", textDecoration: "none",
                            transition: "color 0.2s",
                        }}>
                            Iniciar Sesión
                        </Link>
                        <Link href="/login" className="btn-primary" style={{
                            padding: "8px 18px", fontSize: "0.82rem",
                        }}>
                            Pruébalo Gratis <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ═══════════════════════════════════════════
                HERO
            ═══════════════════════════════════════════ */}
            <section style={{
                paddingTop: "160px", paddingBottom: "100px",
                textAlign: "center", position: "relative",
                overflow: "hidden",
            }}>
                {/* Gradient orbs */}
                <div style={{
                    position: "absolute", width: "600px", height: "600px",
                    borderRadius: "50%", top: "-200px", left: "50%",
                    transform: "translateX(-50%)",
                    background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
                    pointerEvents: "none",
                }} />
                <div style={{
                    position: "absolute", width: "400px", height: "400px",
                    borderRadius: "50%", bottom: "-100px", right: "-100px",
                    background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
                    pointerEvents: "none",
                }} />

                <div className="animate-in" style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
                    {/* Badge */}
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "5px 14px", borderRadius: "100px",
                        background: "rgba(59,130,246,0.08)",
                        border: "1px solid rgba(59,130,246,0.15)",
                        fontSize: "0.75rem", fontWeight: 600,
                        color: "#60a5fa", marginBottom: "24px",
                    }}>
                        <Sparkles size={13} />
                        Plataforma de Agentes IA para WhatsApp
                    </div>

                    {/* Headline */}
                    <h1 style={{
                        fontSize: "3.5rem", fontWeight: 800,
                        lineHeight: 1.1, letterSpacing: "-0.03em",
                        color: "var(--text-primary)",
                        marginBottom: "20px",
                    }}>
                        Tu vendedor AI que
                        <br />
                        <span style={{ color: "var(--text-muted)" }}>nunca duerme</span>
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        fontSize: "1.15rem", lineHeight: 1.6,
                        color: "var(--text-secondary)",
                        maxWidth: "600px", margin: "0 auto 36px",
                    }}>
                        Automatiza la atención al cliente en WhatsApp con inteligencia artificial.
                        Agenda citas, filtra prospectos y vende 24/7 sin intervención humana.
                    </p>

                    {/* CTA buttons */}
                    <div style={{
                        display: "flex", gap: "12px",
                        justifyContent: "center", flexWrap: "wrap",
                    }}>
                        <Link href="/login" className="btn-primary" style={{
                            padding: "14px 28px", fontSize: "0.95rem",
                        }}>
                            Empezar Gratis <ArrowRight size={16} />
                        </Link>
                        <a href="#how-it-works" className="btn-secondary" style={{
                            padding: "14px 28px", fontSize: "0.95rem",
                        }}>
                            Ver cómo funciona
                        </a>
                    </div>

                    {/* Trust line */}
                    <p style={{
                        fontSize: "0.75rem", color: "var(--text-muted)",
                        marginTop: "20px",
                    }}>
                        Sin tarjeta de crédito · Setup en 2 minutos · Cancela cuando quieras
                    </p>
                </div>

                {/* ── Stats bar ── */}
                <div style={{
                    maxWidth: "700px", margin: "60px auto 0",
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "1px", background: "var(--border)", borderRadius: "14px",
                    overflow: "hidden",
                }}>
                    {STATS.map((stat) => (
                        <div key={stat.label} style={{
                            padding: "20px 16px",
                            background: "var(--bg-card)",
                            textAlign: "center",
                        }}>
                            <div style={{
                                fontSize: "1.5rem", fontWeight: 800,
                                color: "var(--text-primary)",
                                letterSpacing: "-0.02em",
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: "0.72rem", fontWeight: 500,
                                color: "var(--text-muted)", marginTop: "2px",
                            }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                DEMO PREVIEW — WhatsApp Chat Mockup
            ═══════════════════════════════════════════ */}
            <section style={{
                padding: "0 24px 100px",
                maxWidth: "900px", margin: "0 auto",
            }}>
                <div style={{
                    borderRadius: "18px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    overflow: "hidden",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                }}>
                    {/* Phone header */}
                    <div style={{
                        padding: "14px 20px",
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: "10px",
                    }}>
                        <div style={{
                            width: "10px", height: "10px",
                            borderRadius: "50%", background: "#ef4444",
                        }} />
                        <div style={{
                            width: "10px", height: "10px",
                            borderRadius: "50%", background: "#f59e0b",
                        }} />
                        <div style={{
                            width: "10px", height: "10px",
                            borderRadius: "50%", background: "#22c55e",
                        }} />
                        <span style={{
                            flex: 1, textAlign: "center",
                            fontSize: "0.75rem", color: "var(--text-muted)",
                            fontWeight: 500,
                        }}>
                            WhatsApp Business — Asistente IA
                        </span>
                    </div>

                    {/* Chat messages */}
                    <div style={{
                        padding: "24px 32px",
                        display: "flex", flexDirection: "column",
                        gap: "12px",
                    }}>
                        {/* User message */}
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                padding: "10px 14px", borderRadius: "4px 12px 12px 12px",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                maxWidth: "70%", fontSize: "0.85rem",
                                color: "var(--text-primary)",
                            }}>
                                Hola! Estoy buscando un departamento de 2 dormitorios en Providencia
                            </div>
                        </div>

                        {/* Bot response */}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div style={{
                                padding: "10px 14px", borderRadius: "12px 4px 12px 12px",
                                background: "rgba(59,130,246,0.1)",
                                border: "1px solid rgba(59,130,246,0.15)",
                                maxWidth: "70%", fontSize: "0.85rem",
                                color: "var(--text-primary)",
                            }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "5px",
                                    marginBottom: "4px",
                                }}>
                                    <Bot size={11} style={{ color: "#60a5fa" }} />
                                    <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#60a5fa" }}>Asistente IA</span>
                                </div>
                                ¡Hola! Tengo 3 opciones en Providencia que podrían interesarte. ¿Cuál es tu presupuesto aproximado? Así te muestro las que mejor se ajusten.
                            </div>
                        </div>

                        {/* User */}
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                padding: "10px 14px", borderRadius: "4px 12px 12px 12px",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                maxWidth: "70%", fontSize: "0.85rem",
                                color: "var(--text-primary)",
                            }}>
                                Entre 600 y 800 mil pesos
                            </div>
                        </div>

                        {/* Bot with CRM action */}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div style={{
                                padding: "10px 14px", borderRadius: "12px 4px 12px 12px",
                                background: "rgba(59,130,246,0.1)",
                                border: "1px solid rgba(59,130,246,0.15)",
                                maxWidth: "70%", fontSize: "0.85rem",
                                color: "var(--text-primary)",
                            }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "5px",
                                    marginBottom: "4px",
                                }}>
                                    <Bot size={11} style={{ color: "#60a5fa" }} />
                                    <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#60a5fa" }}>Asistente IA</span>
                                </div>
                                Perfecto, tengo un depto en Av. Providencia, 2 dormitorios, 65m², arriendo $720.000/mes. ¿Te gustaría agendar una visita esta semana?
                            </div>
                        </div>

                        {/* CRM action indicator */}
                        <div style={{
                            display: "flex", justifyContent: "center",
                        }}>
                            <div style={{
                                padding: "5px 12px", borderRadius: "100px",
                                background: "rgba(34,197,94,0.08)",
                                border: "1px solid rgba(34,197,94,0.15)",
                                fontSize: "0.68rem", fontWeight: 600,
                                color: "#22c55e",
                                display: "flex", alignItems: "center", gap: "5px",
                            }}>
                                <TrendingUp size={11} />
                                Lead movido a &quot;Calificado&quot; en el Pipeline
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                FEATURES
            ═══════════════════════════════════════════ */}
            <section id="features" style={{
                padding: "80px 24px",
                maxWidth: "1100px", margin: "0 auto",
            }}>
                <div style={{ textAlign: "center", marginBottom: "60px" }}>
                    <h2 style={{
                        fontSize: "2.2rem", fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "var(--text-primary)", marginBottom: "12px",
                    }}>
                        Todo lo que necesitas para vender más
                    </h2>
                    <p style={{
                        fontSize: "1rem", color: "var(--text-secondary)",
                        maxWidth: "500px", margin: "0 auto",
                    }}>
                        Una plataforma completa para automatizar ventas, gestionar leads y crecer tu negocio.
                    </p>
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                }}>
                    {FEATURES.map((f) => (
                        <div key={f.title} className="glass-card" style={{
                            padding: "28px 24px",
                            cursor: "default",
                        }}>
                            <div style={{
                                width: "44px", height: "44px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                display: "flex", alignItems: "center",
                                justifyContent: "center",
                                color: "var(--text-secondary)",
                                marginBottom: "16px",
                            }}>
                                {f.icon}
                            </div>
                            <h3 style={{
                                fontSize: "1rem", fontWeight: 700,
                                color: "var(--text-primary)",
                                marginBottom: "8px",
                            }}>
                                {f.title}
                            </h3>
                            <p style={{
                                fontSize: "0.82rem", lineHeight: 1.6,
                                color: "var(--text-secondary)",
                            }}>
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                HOW IT WORKS
            ═══════════════════════════════════════════ */}
            <section id="how-it-works" style={{
                padding: "80px 24px",
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
            }}>
                <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "60px" }}>
                        <h2 style={{
                            fontSize: "2.2rem", fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "var(--text-primary)", marginBottom: "12px",
                        }}>
                            Activa tu agente en 4 pasos
                        </h2>
                        <p style={{
                            fontSize: "1rem", color: "var(--text-secondary)",
                        }}>
                            De cero a vendiendo en menos de 5 minutos.
                        </p>
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "20px",
                    }}>
                        {STEPS.map((step, idx) => (
                            <div key={step.num} style={{ position: "relative" }}>
                                {/* Connector line */}
                                {idx < STEPS.length - 1 && (
                                    <div style={{
                                        position: "absolute", top: "24px",
                                        left: "calc(50% + 24px)", right: "-20px",
                                        height: "1px",
                                        background: "var(--border)",
                                    }} />
                                )}
                                <div style={{ textAlign: "center" }}>
                                    <div style={{
                                        width: "48px", height: "48px",
                                        borderRadius: "14px",
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border)",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 14px",
                                        fontSize: "0.8rem", fontWeight: 800,
                                        color: "var(--text-muted)",
                                        position: "relative", zIndex: 1,
                                    }}>
                                        {step.num}
                                    </div>
                                    <h3 style={{
                                        fontSize: "0.95rem", fontWeight: 700,
                                        color: "var(--text-primary)",
                                        marginBottom: "6px",
                                    }}>
                                        {step.title}
                                    </h3>
                                    <p style={{
                                        fontSize: "0.78rem", lineHeight: 1.5,
                                        color: "var(--text-secondary)",
                                    }}>
                                        {step.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                INDUSTRIES
            ═══════════════════════════════════════════ */}
            <section id="industries" style={{
                padding: "80px 24px",
                maxWidth: "900px", margin: "0 auto",
            }}>
                <div style={{ textAlign: "center", marginBottom: "50px" }}>
                    <h2 style={{
                        fontSize: "2.2rem", fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "var(--text-primary)", marginBottom: "12px",
                    }}>
                        Diseñado para tu industria
                    </h2>
                    <p style={{
                        fontSize: "1rem", color: "var(--text-secondary)",
                    }}>
                        Plantillas pre-configuradas con prompts, pipeline y flujos optimizados.
                    </p>
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                }}>
                    {INDUSTRIES.map((ind) => (
                        <div key={ind.name} className="glass-card" style={{
                            padding: "28px 24px",
                            cursor: "default",
                            textAlign: "center",
                        }}>
                            <div style={{
                                width: "50px", height: "50px", borderRadius: "14px",
                                background: `${ind.color}10`,
                                border: `1px solid ${ind.color}25`,
                                display: "flex", alignItems: "center",
                                justifyContent: "center",
                                color: ind.color,
                                margin: "0 auto 14px",
                            }}>
                                {ind.icon}
                            </div>
                            <h3 style={{
                                fontSize: "0.95rem", fontWeight: 700,
                                color: "var(--text-primary)",
                                marginBottom: "6px",
                            }}>
                                {ind.name}
                            </h3>
                            <p style={{
                                fontSize: "0.78rem",
                                color: "var(--text-secondary)",
                                lineHeight: 1.5,
                            }}>
                                {ind.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Extra note */}
                <p style={{
                    textAlign: "center", marginTop: "20px",
                    fontSize: "0.8rem", color: "var(--text-muted)",
                }}>
                    ¿Tu industria no está aquí? Usa la plantilla en blanco y configura todo a tu medida.
                </p>
            </section>

            {/* ═══════════════════════════════════════════
                BENEFITS CHECKLIST
            ═══════════════════════════════════════════ */}
            <section style={{
                padding: "80px 24px",
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
            }}>
                <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                    <h2 style={{
                        fontSize: "2rem", fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "var(--text-primary)",
                        textAlign: "center", marginBottom: "40px",
                    }}>
                        ¿Por qué MiAgente?
                    </h2>

                    <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: "14px",
                    }}>
                        {[
                            "Responde en segundos, no en horas",
                            "Nunca inventa productos o precios",
                            "Filtra prospectos automáticamente",
                            "Pipeline visual tipo Kanban",
                            "Funciona con Meta Cloud API y Twilio",
                            "FAQ y base de conocimiento incluidos",
                            "Notificaciones de derivación a humano",
                            "Analítica completa de conversiones",
                            "Multi-tenant: cada negocio aislado",
                            "Setup en menos de 5 minutos",
                        ].map((benefit) => (
                            <div key={benefit} style={{
                                display: "flex", alignItems: "center", gap: "10px",
                                padding: "12px 16px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}>
                                <CheckCircle size={16} style={{
                                    color: "#22c55e", flexShrink: 0,
                                }} />
                                <span style={{
                                    fontSize: "0.82rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 500,
                                }}>
                                    {benefit}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                PRICING
            ═══════════════════════════════════════════ */}
            <section id="pricing" style={{
                padding: "80px 24px",
                maxWidth: "1100px", margin: "0 auto",
            }}>
                <div style={{ textAlign: "center", marginBottom: "60px" }}>
                    <h2 style={{
                        fontSize: "2.2rem", fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "var(--text-primary)", marginBottom: "12px",
                    }}>
                        Planes simples y transparentes
                    </h2>
                    <p style={{
                        fontSize: "1rem", color: "var(--text-secondary)",
                        maxWidth: "500px", margin: "0 auto",
                    }}>
                        Empieza gratis, escala cuando lo necesites. Sin sorpresas ni costos ocultos.
                    </p>
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                    alignItems: "stretch",
                }}>
                    {PLANS.map((plan) => (
                        <div key={plan.name} style={{
                            position: "relative",
                            padding: plan.popular ? "2px" : "0",
                            borderRadius: "18px",
                            background: plan.popular
                                ? "linear-gradient(135deg, #3b82f6, #7c3aed, #3b82f6)"
                                : "transparent",
                        }}>
                            <div className="glass-card" style={{
                                padding: "32px 24px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                borderRadius: plan.popular ? "16px" : undefined,
                                border: plan.popular ? "none" : undefined,
                            }}>
                                {/* Popular badge */}
                                {plan.popular && (
                                    <div style={{
                                        position: "absolute",
                                        top: "-12px", left: "50%",
                                        transform: "translateX(-50%)",
                                        display: "flex", alignItems: "center", gap: "4px",
                                        padding: "4px 14px", borderRadius: "100px",
                                        background: "var(--gradient-1)",
                                        fontSize: "0.68rem", fontWeight: 700,
                                        color: "white",
                                        boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
                                    }}>
                                        <Crown size={12} /> Popular
                                    </div>
                                )}

                                {/* Plan name + price */}
                                <div style={{ marginBottom: "20px" }}>
                                    <h3 style={{
                                        fontSize: "1.1rem", fontWeight: 700,
                                        color: "var(--text-primary)",
                                        marginBottom: "8px",
                                    }}>
                                        {plan.name}
                                    </h3>
                                    <div style={{
                                        display: "flex", alignItems: "baseline", gap: "2px",
                                    }}>
                                        <span style={{
                                            fontSize: "2.5rem", fontWeight: 800,
                                            color: "var(--text-primary)",
                                            letterSpacing: "-0.03em",
                                        }}>
                                            {plan.price}
                                        </span>
                                        <span style={{
                                            fontSize: "0.85rem",
                                            color: "var(--text-muted)",
                                        }}>
                                            {plan.period}
                                        </span>
                                    </div>
                                    <p style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-secondary)",
                                        marginTop: "4px",
                                    }}>
                                        {plan.desc}
                                    </p>
                                </div>

                                {/* Features */}
                                <div style={{
                                    display: "flex", flexDirection: "column", gap: "10px",
                                    flex: 1, marginBottom: "24px",
                                }}>
                                    {plan.features.map((feat) => (
                                        <div key={feat} style={{
                                            display: "flex", alignItems: "center", gap: "8px",
                                        }}>
                                            <Check size={15} style={{
                                                color: plan.popular ? "#60a5fa" : "#22c55e",
                                                flexShrink: 0,
                                            }} />
                                            <span style={{
                                                fontSize: "0.82rem",
                                                color: "var(--text-secondary)",
                                                fontWeight: 500,
                                            }}>
                                                {feat}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA */}
                                <Link
                                    href="/login"
                                    className={plan.popular ? "btn-primary" : "btn-secondary"}
                                    style={{
                                        padding: "12px 24px",
                                        fontSize: "0.88rem",
                                        textAlign: "center",
                                        justifyContent: "center",
                                        width: "100%",
                                    }}
                                >
                                    {plan.cta} <ArrowRight size={15} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                TESTIMONIALS
            ═══════════════════════════════════════════ */}
            <section style={{
                padding: "80px 24px",
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
            }}>
                <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "50px" }}>
                        <h2 style={{
                            fontSize: "2.2rem", fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "var(--text-primary)", marginBottom: "12px",
                        }}>
                            Lo que dicen nuestros clientes
                        </h2>
                        <p style={{
                            fontSize: "1rem", color: "var(--text-secondary)",
                        }}>
                            Negocios reales que ya venden en automático con MiAgente.
                        </p>
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "20px",
                    }}>
                        {TESTIMONIALS.map((t) => (
                            <div key={t.name} className="glass-card" style={{
                                padding: "28px 24px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                            }}>
                                {/* Stars */}
                                <div style={{ display: "flex", gap: "2px" }}>
                                    {Array.from({ length: t.rating }).map((_, i) => (
                                        <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                                    ))}
                                </div>

                                {/* Quote */}
                                <p style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.6,
                                    flex: 1,
                                    fontStyle: "italic",
                                }}>
                                    &ldquo;{t.quote}&rdquo;
                                </p>

                                {/* Author */}
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "10px",
                                    paddingTop: "12px",
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: "36px", height: "36px", borderRadius: "10px",
                                        background: "rgba(59,130,246,0.08)",
                                        border: "1px solid rgba(59,130,246,0.15)",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem", fontWeight: 700,
                                        color: "#60a5fa",
                                    }}>
                                        {t.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: "0.8rem", fontWeight: 700,
                                            color: "var(--text-primary)",
                                        }}>
                                            {t.name}
                                        </div>
                                        <div style={{
                                            fontSize: "0.68rem",
                                            color: "var(--text-muted)",
                                        }}>
                                            {t.role} · {t.company}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                FINAL CTA
            ═══════════════════════════════════════════ */}
            <section style={{
                padding: "100px 24px",
                textAlign: "center",
                position: "relative", overflow: "hidden",
            }}>
                {/* Background glow */}
                <div style={{
                    position: "absolute", width: "500px", height: "500px",
                    borderRadius: "50%", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
                    pointerEvents: "none",
                }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                    <h2 style={{
                        fontSize: "2.5rem", fontWeight: 800,
                        letterSpacing: "-0.03em",
                        color: "var(--text-primary)",
                        marginBottom: "16px",
                    }}>
                        Empieza a vender hoy
                    </h2>
                    <p style={{
                        fontSize: "1.05rem", color: "var(--text-secondary)",
                        maxWidth: "480px", margin: "0 auto 32px",
                        lineHeight: 1.6,
                    }}>
                        Crea tu agente de ventas en minutos. Sin código, sin complicaciones, sin tarjeta de crédito.
                    </p>
                    <Link href="/login" className="btn-primary" style={{
                        padding: "16px 36px", fontSize: "1rem",
                    }}>
                        Crear Mi Agente Gratis <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                FOOTER
            ═══════════════════════════════════════════ */}
            <footer style={{
                borderTop: "1px solid var(--border)",
                padding: "60px 24px 30px",
            }}>
                <div style={{
                    maxWidth: "1100px", margin: "0 auto",
                }}>
                    {/* Footer grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr",
                        gap: "40px",
                        marginBottom: "40px",
                    }}>
                        {/* Brand column */}
                        <div>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                marginBottom: "12px",
                            }}>
                                <div style={{
                                    width: "30px", height: "30px", borderRadius: "8px",
                                    background: "var(--gradient-1)",
                                    display: "flex", alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Zap size={15} color="white" />
                                </div>
                                <span style={{
                                    fontSize: "1rem", fontWeight: 700,
                                    color: "var(--text-primary)",
                                }}>
                                    MiAgente
                                </span>
                            </div>
                            <p style={{
                                fontSize: "0.8rem",
                                color: "var(--text-secondary)",
                                lineHeight: 1.6,
                                maxWidth: "280px",
                            }}>
                                La plataforma de agentes de ventas con inteligencia artificial para WhatsApp. Automatiza, convierte y crece.
                            </p>
                        </div>

                        {/* Product column */}
                        <div>
                            <h4 style={{
                                fontSize: "0.75rem", fontWeight: 700,
                                color: "var(--text-primary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                marginBottom: "16px",
                            }}>
                                Producto
                            </h4>
                            <div style={{
                                display: "flex", flexDirection: "column", gap: "10px",
                            }}>
                                {[
                                    { label: "Funciones", href: "#features" },
                                    { label: "Precios", href: "#pricing" },
                                    { label: "Industrias", href: "#industries" },
                                    { label: "Cómo funciona", href: "#how-it-works" },
                                ].map(link => (
                                    <a key={link.label} href={link.href} style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-secondary)",
                                        textDecoration: "none",
                                        transition: "color 0.2s",
                                    }}>
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Company column */}
                        <div>
                            <h4 style={{
                                fontSize: "0.75rem", fontWeight: 700,
                                color: "var(--text-primary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                marginBottom: "16px",
                            }}>
                                Empresa
                            </h4>
                            <div style={{
                                display: "flex", flexDirection: "column", gap: "10px",
                            }}>
                                {[
                                    { label: "Contacto", href: "mailto:soporte@miagente.com" },
                                    { label: "Blog", href: "#" },
                                    { label: "Soporte", href: "#" },
                                ].map(link => (
                                    <a key={link.label} href={link.href} style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-secondary)",
                                        textDecoration: "none",
                                        transition: "color 0.2s",
                                    }}>
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Legal column */}
                        <div>
                            <h4 style={{
                                fontSize: "0.75rem", fontWeight: 700,
                                color: "var(--text-primary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                marginBottom: "16px",
                            }}>
                                Legal
                            </h4>
                            <div style={{
                                display: "flex", flexDirection: "column", gap: "10px",
                            }}>
                                {[
                                    { label: "Términos de Servicio", href: "#" },
                                    { label: "Política de Privacidad", href: "#" },
                                    { label: "Cookies", href: "#" },
                                ].map(link => (
                                    <a key={link.label} href={link.href} style={{
                                        fontSize: "0.8rem",
                                        color: "var(--text-secondary)",
                                        textDecoration: "none",
                                        transition: "color 0.2s",
                                    }}>
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer bottom */}
                    <div style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <p style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                        }}>
                            &copy; 2026 MiAgente. Todos los derechos reservados.
                        </p>
                        <div style={{
                            display: "flex", alignItems: "center", gap: "16px",
                        }}>
                            <a href="mailto:soporte@miagente.com" title="Email" style={{
                                color: "var(--text-muted)", transition: "color 0.2s",
                            }}>
                                <Mail size={16} />
                            </a>
                            <a href="#" title="Docs" style={{
                                color: "var(--text-muted)", transition: "color 0.2s",
                            }}>
                                <FileText size={16} />
                            </a>
                            <a href="#" title="Website" style={{
                                color: "var(--text-muted)", transition: "color 0.2s",
                            }}>
                                <Globe size={16} />
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

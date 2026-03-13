"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bot, Eye, EyeOff, Sparkles } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [orgName, setOrgName] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signupSuccess, setSignupSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Login: redirect to dashboard
                router.refresh();
                await new Promise(resolve => setTimeout(resolve, 300));
                router.push("/dashboard");
            } else {
                // Register — Supabase requires email confirmation before login
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
                if (authError) throw authError;

                // Create org + membership via admin endpoint
                if (authData.user) {
                    const res = await fetch("/api/auth/setup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            user_id: authData.user.id,
                            org_name: orgName || email.split("@")[0],
                        }),
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || "Failed to create organization");
                    }
                }

                // Show confirmation message instead of auto-login
                setSignupSuccess(true);
            }
        } catch (err: any) {
            setError(err.message || "Error de autenticación");
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-primary)", position: "relative", overflow: "hidden",
        }}>
            {/* Animated background */}
            <div className="animate-in" style={{
                position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
            }}>
                <div className="float" style={{
                    position: "absolute", width: "400px", height: "400px", borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
                    top: "-100px", right: "-100px",
                }} />
                <div className="float" style={{
                    position: "absolute", width: "300px", height: "300px", borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(122,158,138,0.08) 0%, transparent 70%)",
                    bottom: "-50px", left: "-50px", animationDelay: "2s",
                }} />
            </div>

            <div className="animate-in glass-card" style={{
                width: "100%", maxWidth: "420px", padding: "40px",
                position: "relative", zIndex: 1,
            }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{
                        width: "56px", height: "56px", borderRadius: "16px",
                        background: "var(--gradient-1)", display: "flex",
                        alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                    }}>
                        <Bot size={28} color="white" />
                    </div>
                    <h1 style={{
                        fontSize: "1.5rem", fontWeight: 700,
                        background: "var(--gradient-1)", WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        AI Agent Platform
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                        {isLogin ? "Ingresa a tu cuenta" : "Crea tu organización"}
                    </p>
                </div>

                {signupSuccess ? (
                    <div style={{
                        padding: "16px", background: "rgba(34,197,94,0.1)",
                        border: "0.5px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius)",
                        color: "#4ade80", fontSize: "0.85rem", lineHeight: 1.6,
                        textAlign: "center",
                    }}>
                        <strong style={{ display: "block", marginBottom: "6px", fontSize: "0.95rem" }}>
                            ✅ ¡Cuenta creada con éxito!
                        </strong>
                        Por favor, revisa tu bandeja de entrada (y la carpeta de spam) para confirmar
                        tu correo electrónico antes de iniciar sesión.
                    </div>
                ) : (
                    <>
                        {error && (
                            <div style={{
                                padding: "12px 16px", background: "rgba(239,68,68,0.1)",
                                border: "0.5px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)",
                                color: "#f87171", fontSize: "0.8rem", marginBottom: "20px",
                            }}>
                                {error}
                            </div>
                        )}
                    </>
                )}

                {!signupSuccess && <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label">Nombre de tu organización</label>
                            <input className="input" value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                                placeholder="Mi Empresa" required={!isLogin} />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="input" type="email" value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="tu@email.com" required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <div style={{ position: "relative" }}>
                            <input className="input" type={showPw ? "text" : "password"}
                                value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••" required style={{ paddingRight: "44px" }} />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                style={{
                                    position: "absolute", right: "12px", top: "50%",
                                    transform: "translateY(-50%)", background: "none",
                                    border: "none", color: "var(--text-muted)", cursor: "pointer",
                                }}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}
                        style={{ width: "100%", padding: "14px", marginTop: "8px" }}>
                        {loading ? (
                            <Sparkles size={16} className="pulse-glow" />
                        ) : (
                            isLogin ? "Iniciar Sesión" : "Crear Cuenta"
                        )}
                    </button>
                </form>}

                {!signupSuccess && (
                    <div style={{
                        textAlign: "center", marginTop: "20px", fontSize: "0.8rem",
                        color: "var(--text-muted)",
                    }}>
                        {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
                        <button onClick={() => { setIsLogin(!isLogin); setError(""); setSignupSuccess(false); }}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--accent-light)", fontWeight: 600, fontSize: "0.8rem",
                            }}>
                            {isLogin ? "Regístrate" : "Inicia sesión"}
                        </button>
                    </div>
                )}
                {signupSuccess && (
                    <div style={{ textAlign: "center", marginTop: "16px" }}>
                        <button onClick={() => { setIsLogin(true); setSignupSuccess(false); }}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--accent-light)", fontWeight: 600, fontSize: "0.85rem",
                            }}>
                            → Ir a Iniciar Sesión
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, SkipForward, Zap, Check } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { getTemplate } from "@/lib/industry-templates";

import IndustryStep from "./steps/IndustryStep";
import AgentStep from "./steps/AgentStep";
import ProductStep from "./steps/ProductStep";
import ApiKeyStep from "./steps/ApiKeyStep";
import WhatsAppStep from "./steps/WhatsAppStep";
import type { WhatsAppData } from "./steps/WhatsAppStep";
import TestChatStep from "./steps/TestChatStep";
import CompleteStep from "./steps/CompleteStep";

import {
    applyOnboardingTemplate,
    updateOnboardingAgent,
    saveOnboardingApiKey,
    completeOnboarding,
} from "./actions";

const STEPS = [
    { label: "Industria", emoji: "🏭" },
    { label: "Asistente", emoji: "🤖" },
    { label: "Catálogo", emoji: "📦" },
    { label: "API Key", emoji: "🔑" },
    { label: "WhatsApp", emoji: "💬" },
    { label: "Prueba", emoji: "🧪" },
    { label: "Listo", emoji: "🚀" },
];

interface WizardData {
    industryId: string;
    agentId: string;
    agent: { name: string; welcomeMessage: string; tone: string };
    product: { name: string; description: string; price: string; attributes: Record<string, string> };
    apiKey: string;
    whatsApp: WhatsAppData;
}

const INITIAL_DATA: WizardData = {
    industryId: "",
    agentId: "",
    agent: { name: "", welcomeMessage: "", tone: "Amigable y Casual" },
    product: { name: "", description: "", price: "", attributes: {} },
    apiKey: "",
    whatsApp: { phoneNumberId: "", accessToken: "", businessAccountId: "", connectionStatus: "idle" },
};

export default function OnboardingPage() {
    const { organization } = useOrg();
    const router = useRouter();

    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardData>(INITIAL_DATA);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const totalSteps = STEPS.length;

    const handleNext = useCallback(async () => {
        setError("");
        setSaving(true);
        try {
            if (step === 0) {
                if (!data.industryId) { setError("Selecciona una industria para continuar."); setSaving(false); return; }
                const result = await applyOnboardingTemplate(organization.id, data.industryId);
                if (!result.success) { setError(result.error || "Error aplicando plantilla"); setSaving(false); return; }
                const tpl = getTemplate(data.industryId);
                if (tpl && result.agentId) {
                    setData((prev) => ({ ...prev, agentId: result.agentId!, agent: { name: tpl.defaultName, welcomeMessage: tpl.defaultWelcome, tone: prev.agent.tone } }));
                }
            } else if (step === 1) {
                if (data.agentId) {
                    const result = await updateOnboardingAgent(data.agentId, { name: data.agent.name, welcome_message: data.agent.welcomeMessage, conversation_tone: data.agent.tone });
                    if (!result.success) { setError(result.error || "Error guardando agente"); setSaving(false); return; }
                }
            } else if (step === 2) {
                if (data.product.name.trim()) {
                    const attrs: Record<string, string> = { ...data.product.attributes };
                    if (data.product.price) attrs.precio = data.product.price;
                    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organization.id, name: data.product.name, description: data.product.description, attributes: attrs }) });
                    if (!res.ok) { const err = await res.json().catch(() => ({})); setError(err.error || "Error creando producto"); setSaving(false); return; }
                }
            } else if (step === 3) {
                if (data.apiKey.trim()) {
                    const result = await saveOnboardingApiKey(organization.id, data.apiKey);
                    if (!result.success) { setError(result.error || "Error guardando API key"); setSaving(false); return; }
                }
            } else if (step === 4) {
                // WhatsApp step handles its own connection + save via /api/whatsapp/connect
                // If connected, proceed. If not connected, allow skipping.
            }
            setStep((s) => Math.min(s + 1, totalSteps - 1));
        } catch (err: any) { setError(err.message || "Error inesperado"); } finally { setSaving(false); }
    }, [step, data, organization.id, totalSteps]);

    const handleBack = () => { setError(""); setStep((s) => Math.max(s - 1, 0)); };

    const handleSkipAll = async () => {
        setSaving(true);
        try { await completeOnboarding(organization.id); router.replace("/dashboard/products"); } catch { router.replace("/dashboard/products"); }
    };

    const handleFinish = async () => {
        setSaving(true);
        try { await completeOnboarding(organization.id); router.replace("/dashboard/products"); } catch { router.replace("/dashboard/products"); }
    };

    const canProceed = (() => {
        if (saving) return false;
        if (step === 0) return !!data.industryId;
        if (step === 1) return !!data.agent.name.trim();
        return true;
    })();

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const webhookUrl = `${baseUrl}/api/webhook/${organization.id}`;

    const setupStatus = {
        hasAgent: !!data.agentId,
        hasProduct: !!data.product.name.trim(),
        hasApiKey: !!data.apiKey.trim(),
        hasWhatsApp: data.whatsApp.connectionStatus === "connected",
    };

    return (
        <div
            className="min-h-screen flex flex-col relative overflow-hidden"
            style={{ background: "#0a0e1a" }}
        >
            {/* Background ambient glow */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(139,92,246,0.05) 0%, transparent 50%)",
            }} />

            {/* ══════════════════════════════════════════════
                 HEADER
                 ══════════════════════════════════════════════ */}
            <header
                className="relative z-10"
                style={{
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(10,14,26,0.8)",
                    backdropFilter: "blur(20px)",
                }}
            >
                {/* Top row */}
                <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px 32px" }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: "42px", height: "42px", borderRadius: "12px",
                                    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                                    boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
                                }}
                            >
                                <Zap size={20} color="white" />
                            </div>
                            <div>
                                <div className="text-sm font-bold" style={{ color: "#f0f0f5" }}>
                                    {organization.name}
                                </div>
                                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                                    Configuración inicial
                                </div>
                            </div>
                        </div>

                        {step < totalSteps - 1 && (
                            <button
                                onClick={handleSkipAll}
                                disabled={saving}
                                className="flex items-center gap-2 text-sm font-medium transition-all"
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "10px",
                                    color: "rgba(255,255,255,0.5)",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                            >
                                <SkipForward size={14} />
                                Saltar configuración
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress steps */}
                <div style={{ maxWidth: "900px", margin: "0 auto", padding: "4px 32px 20px" }}>
                    <div className="flex items-center">
                        {STEPS.map((s, i) => {
                            const isDone = i < step;
                            const isCurrent = i === step;
                            const isFuture = i > step;

                            return (
                                <div key={s.label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : "none" }}>
                                    {/* Circle + label */}
                                    <div className="flex flex-col items-center" style={{ minWidth: "56px" }}>
                                        <motion.div
                                            animate={{ scale: isCurrent ? 1.1 : 1 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                            className="flex items-center justify-center"
                                            style={{
                                                width: "40px", height: "40px", borderRadius: "50%",
                                                background: isDone
                                                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                                                    : isCurrent
                                                        ? "rgba(59,130,246,0.15)"
                                                        : "rgba(255,255,255,0.03)",
                                                border: isCurrent
                                                    ? "2px solid #3b82f6"
                                                    : isDone
                                                        ? "2px solid transparent"
                                                        : "2px solid rgba(255,255,255,0.08)",
                                                boxShadow: isCurrent
                                                    ? "0 0 0 4px rgba(59,130,246,0.12), 0 2px 8px rgba(59,130,246,0.2)"
                                                    : isDone
                                                        ? "0 2px 8px rgba(59,130,246,0.25)"
                                                        : "none",
                                                transition: "all 0.3s ease",
                                            }}
                                        >
                                            {isDone ? (
                                                <Check size={18} color="white" strokeWidth={2.5} />
                                            ) : (
                                                <span style={{
                                                    fontSize: "1rem",
                                                    filter: isFuture ? "grayscale(1) opacity(0.3)" : "none",
                                                }}>
                                                    {s.emoji}
                                                </span>
                                            )}
                                        </motion.div>
                                        <span
                                            className="text-[0.65rem] font-semibold mt-1.5"
                                            style={{
                                                color: isCurrent
                                                    ? "#93bbfc"
                                                    : isDone
                                                        ? "rgba(255,255,255,0.45)"
                                                        : "rgba(255,255,255,0.2)",
                                                transition: "color 0.3s ease",
                                            }}
                                        >
                                            {s.label}
                                        </span>
                                    </div>

                                    {/* Connector */}
                                    {i < STEPS.length - 1 && (
                                        <div style={{ flex: 1, padding: "0 4px", marginBottom: "18px" }}>
                                            <div
                                                style={{
                                                    height: "2px", borderRadius: "2px",
                                                    background: isDone
                                                        ? "linear-gradient(90deg, #3b82f6, #8b5cf6)"
                                                        : "rgba(255,255,255,0.06)",
                                                    transition: "background 0.5s ease",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* ══════════════════════════════════════════════
                 CONTENT
                 ══════════════════════════════════════════════ */}
            <div className="flex-1 flex items-center justify-center relative z-10" style={{ padding: "40px 32px" }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}
                    >
                        {step === 0 && <IndustryStep selected={data.industryId} onSelect={(id) => setData((prev) => ({ ...prev, industryId: id }))} />}
                        {step === 1 && <AgentStep data={data.agent} onChange={(agent) => setData((prev) => ({ ...prev, agent }))} />}
                        {step === 2 && <ProductStep industryId={data.industryId} data={data.product} onChange={(product) => setData((prev) => ({ ...prev, product }))} />}
                        {step === 3 && <ApiKeyStep apiKey={data.apiKey} onChange={(apiKey) => setData((prev) => ({ ...prev, apiKey }))} />}
                        {step === 4 && <WhatsAppStep data={data.whatsApp} onChange={(whatsApp) => setData((prev) => ({ ...prev, whatsApp }))} webhookUrl={webhookUrl} orgId={organization.id} />}
                        {step === 5 && <TestChatStep agentId={data.agentId} agentName={data.agent.name} welcomeMessage={data.agent.welcomeMessage} />}
                        {step === 6 && <CompleteStep status={setupStatus} onFinish={handleFinish} loading={saving} />}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ══════════════════════════════════════════════
                 ERROR
                 ══════════════════════════════════════════════ */}
            {error && (
                <div className="relative z-10" style={{ padding: "0 32px 12px" }}>
                    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                        <div
                            style={{
                                padding: "12px 20px", borderRadius: "12px",
                                background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                color: "#f87171", fontSize: "0.85rem", textAlign: "center",
                            }}
                        >
                            {error}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                 FOOTER NAV
                 ══════════════════════════════════════════════ */}
            {step < totalSteps - 1 && (
                <footer
                    className="relative z-10"
                    style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(10,14,26,0.85)",
                        backdropFilter: "blur(20px)",
                        padding: "20px 32px",
                    }}
                >
                    <div style={{ maxWidth: "900px", margin: "0 auto" }} className="flex items-center justify-between">
                        {/* Back */}
                        {step > 0 ? (
                            <button
                                onClick={handleBack}
                                disabled={saving}
                                className="flex items-center gap-2 font-medium transition-all"
                                style={{
                                    padding: "12px 24px", borderRadius: "12px", fontSize: "0.9rem",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "rgba(255,255,255,0.6)",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                            >
                                <ArrowLeft size={18} />
                                Anterior
                            </button>
                        ) : (
                            <div />
                        )}

                        {/* Step counter */}
                        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {step + 1} / {totalSteps}
                        </span>

                        {/* Next */}
                        <motion.button
                            whileHover={canProceed ? { scale: 1.03 } : {}}
                            whileTap={canProceed ? { scale: 0.97 } : {}}
                            onClick={handleNext}
                            disabled={!canProceed}
                            className="flex items-center gap-2 font-semibold text-white transition-all"
                            style={{
                                padding: "12px 32px", borderRadius: "12px", fontSize: "0.9rem",
                                background: canProceed
                                    ? "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)"
                                    : "rgba(255,255,255,0.04)",
                                border: canProceed ? "none" : "1px solid rgba(255,255,255,0.08)",
                                color: canProceed ? "white" : "rgba(255,255,255,0.2)",
                                cursor: canProceed ? "pointer" : "not-allowed",
                                boxShadow: canProceed
                                    ? "0 4px 20px rgba(59,130,246,0.35), 0 0 0 1px rgba(59,130,246,0.2)"
                                    : "none",
                            }}
                        >
                            {saving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    Continuar
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </motion.button>
                    </div>
                </footer>
            )}
        </div>
    );
}

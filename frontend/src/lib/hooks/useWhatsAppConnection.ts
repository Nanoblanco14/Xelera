"use client";

import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════
export interface ConnectionStatus {
    connected: boolean;
    phone_number_id?: string | null;
    display_phone?: string | null;
    verified_name?: string | null;
    quality_rating?: string | null;
    connected_at?: string | null;
    webhook_url?: string | null;
    verify_token?: string | null;
}

export interface ConnectCredentials {
    access_token: string;
    phone_number_id: string;
    business_account_id: string;
}

export interface EmbeddedSignupData {
    code: string;
    phone_number_id: string;
    waba_id: string;
}

type StepName = "exchange_token" | "verify_token" | "register_phone" | "subscribe_webhooks" | "save_credentials";

const MANUAL_STEPS: StepName[] = ["verify_token", "register_phone", "subscribe_webhooks", "save_credentials"];
const EMBEDDED_STEPS: StepName[] = ["exchange_token", "verify_token", "register_phone", "subscribe_webhooks", "save_credentials"];

const STEP_LABELS: Record<StepName, string> = {
    exchange_token: "Intercambiando credenciales con Facebook",
    verify_token: "Verificando credenciales",
    register_phone: "Registrando numero de telefono",
    subscribe_webhooks: "Suscribiendo webhooks",
    save_credentials: "Guardando configuracion",
};

// ═══════════════════════════════════════════════════════════════
//  Hook
// ═══════════════════════════════════════════════════════════════
export function useWhatsAppConnection(orgId: string) {
    const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
    const [connecting, setConnecting] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failedStep, setFailedStep] = useState<StepName | null>(null);
    const [completedSteps, setCompletedSteps] = useState<StepName[]>([]);
    const [currentStep, setCurrentStep] = useState<StepName | null>(null);

    // ── Check current connection status ───────────────────────
    const checkStatus = useCallback(async () => {
        setChecking(true);
        try {
            const res = await fetch(`/api/whatsapp/connect?org_id=${orgId}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (data.connected) {
                    setCompletedSteps([...MANUAL_STEPS]);
                }
            }
        } catch {
            // Silent fail — status stays disconnected
        } finally {
            setChecking(false);
        }
    }, [orgId]);

    // ── Connect with credentials ──────────────────────────────
    const connect = useCallback(
        async (credentials: ConnectCredentials) => {
            setConnecting(true);
            setError(null);
            setFailedStep(null);
            setCompletedSteps([]);
            setCurrentStep("verify_token");

            try {
                const res = await fetch("/api/whatsapp/connect", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ org_id: orgId, ...credentials }),
                });

                const data = await res.json();

                if (data.success) {
                    // Animate steps sequentially
                    const steps = data.steps_completed as StepName[];
                    for (let i = 0; i < steps.length; i++) {
                        setCompletedSteps((prev) => [...prev, steps[i]]);
                        setCurrentStep(steps[i + 1] || null);
                        if (i < steps.length - 1) {
                            await delay(400);
                        }
                    }

                    // Final state
                    await delay(300);
                    setCurrentStep(null);
                    setStatus({
                        connected: true,
                        phone_number_id: credentials.phone_number_id,
                        display_phone: data.phone_info?.display_phone,
                        verified_name: data.phone_info?.verified_name,
                        quality_rating: data.phone_info?.quality_rating,
                        connected_at: new Date().toISOString(),
                        webhook_url: data.webhook_url,
                        verify_token: data.verify_token,
                    });
                } else {
                    // Animate completed steps up to failure
                    const completed = (data.steps_completed || []) as StepName[];
                    for (let i = 0; i < completed.length; i++) {
                        setCompletedSteps((prev) => [...prev, completed[i]]);
                        await delay(300);
                    }
                    setCurrentStep(null);
                    setFailedStep(data.step as StepName);
                    setError(data.error || "Error desconocido al conectar");
                }
            } catch {
                setError("Error de red. Verifica tu conexion e intenta de nuevo.");
                setCurrentStep(null);
            } finally {
                setConnecting(false);
            }
        },
        [orgId]
    );

    // ── Connect via Embedded Signup ───────────────────────────
    const connectViaEmbeddedSignup = useCallback(
        async (data: EmbeddedSignupData) => {
            setConnecting(true);
            setError(null);
            setFailedStep(null);
            setCompletedSteps([]);
            setCurrentStep("exchange_token");

            try {
                const res = await fetch("/api/whatsapp/embedded-signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ org_id: orgId, ...data }),
                });

                const result = await res.json();

                if (result.success) {
                    // Animate steps sequentially
                    const steps = result.steps_completed as StepName[];
                    for (let i = 0; i < steps.length; i++) {
                        setCompletedSteps((prev) => [...prev, steps[i]]);
                        setCurrentStep(steps[i + 1] || null);
                        if (i < steps.length - 1) {
                            await delay(400);
                        }
                    }

                    // Final state
                    await delay(300);
                    setCurrentStep(null);
                    setStatus({
                        connected: true,
                        phone_number_id: data.phone_number_id,
                        display_phone: result.phone_info?.display_phone,
                        verified_name: result.phone_info?.verified_name,
                        quality_rating: result.phone_info?.quality_rating,
                        connected_at: new Date().toISOString(),
                        webhook_url: result.webhook_url,
                        verify_token: result.verify_token,
                    });
                } else {
                    // Animate completed steps up to failure
                    const completed = (result.steps_completed || []) as StepName[];
                    for (let i = 0; i < completed.length; i++) {
                        setCompletedSteps((prev) => [...prev, completed[i]]);
                        await delay(300);
                    }
                    setCurrentStep(null);
                    setFailedStep(result.step as StepName);
                    setError(result.error || "Error desconocido al conectar");
                }
            } catch {
                setError("Error de red. Verifica tu conexion e intenta de nuevo.");
                setCurrentStep(null);
            } finally {
                setConnecting(false);
            }
        },
        [orgId]
    );

    // ── Reset to initial state ────────────────────────────────
    const reset = useCallback(() => {
        setStatus({ connected: false });
        setConnecting(false);
        setError(null);
        setFailedStep(null);
        setCompletedSteps([]);
        setCurrentStep(null);
    }, []);

    return {
        status,
        connecting,
        checking,
        error,
        failedStep,
        completedSteps,
        currentStep,
        manualSteps: MANUAL_STEPS,
        embeddedSteps: EMBEDDED_STEPS,
        stepLabels: STEP_LABELS,
        connect,
        connectViaEmbeddedSignup,
        checkStatus,
        reset,
    };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

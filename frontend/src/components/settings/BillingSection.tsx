"use client";
// ═══════════════════════════════════════════════════════════════
//  💳 BILLING — plan actual, consumo IA del mes, costo estimado
//  y CTA de upgrade (Stripe Checkout) / gestión (Customer Portal).
//  Dogfooding: átomos Button/Badge del design system.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { CreditCard, Zap, ExternalLink } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import { Button, Badge } from "@/components/ui";

interface BudgetInfo {
    used: number;
    limit: number;
    percentage: number;
    plan: string;
    estimatedCostUsd: number;
}

const PLAN_META: Record<string, { label: string; color: string; next?: string; nextLabel?: string; nextPrice?: string }> = {
    free: { label: "Free", color: "#a89f94", next: "starter", nextLabel: "Starter", nextPrice: "$24.990 CLP" },
    starter: { label: "Starter", color: "#7a9e8a", next: "executive", nextLabel: "Executive", nextPrice: "$180.000 CLP" },
    pro: { label: "Pro", color: "#7a9e8a", next: "executive", nextLabel: "Executive", nextPrice: "$180.000 CLP" },
    business: { label: "Business", color: "#6482aa", next: "executive", nextLabel: "Executive", nextPrice: "$180.000 CLP" },
    executive: { label: "Executive", color: "#c4a35a" },
};

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export default function BillingSection({ orgId, plan }: { orgId: string; plan: string }) {
    const [budget, setBudget] = useState<BudgetInfo | null>(null);
    const [redirecting, setRedirecting] = useState<string | null>(null);
    const [error, setError] = useState("");

    const meta = PLAN_META[plan] || PLAN_META.free;

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/billing/usage?org_id=${orgId}`);
                const json = await res.json();
                if (json?.data) setBudget(json.data);
            } catch { /* silencioso */ }
        })();
    }, [orgId]);

    const goTo = async (endpoint: "checkout" | "portal", tier?: string) => {
        setRedirecting(endpoint + (tier || ""));
        setError("");
        try {
            const res = await fetch(`/api/billing/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tier ? { tier } : {}),
            });
            const json = await res.json();
            if (json?.data?.url) { window.location.href = json.data.url; return; }
            setError(json?.error || "No se pudo abrir el pago");
        } catch {
            setError("Error de conexión con el sistema de pagos");
        }
        setRedirecting(null);
    };

    const pct = budget?.percentage ?? 0;
    const barColor = pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warning)" : "var(--accent)";

    return (
        <SectionCard
            icon={<CreditCard size={16} />}
            title="Plan y Facturación"
            subtitle="Tu suscripción y el consumo de IA del mes"
        >
            {/* Plan actual */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Plan actual:</span>
                <Badge color={meta.color} dot>{meta.label.toUpperCase()}</Badge>
            </div>

            {/* Consumo IA del mes */}
            {budget && (
                <div style={{ marginBottom: "18px" }}>
                    <div style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: "6px",
                    }}>
                        <span>Tokens IA este mes</span>
                        <span>
                            {fmt(budget.used)} / {fmt(budget.limit)} ({pct}%)
                            {" · "}≈ US${budget.estimatedCostUsd.toFixed(2)}
                        </span>
                    </div>
                    <div style={{
                        height: "6px", borderRadius: "100px",
                        background: "rgba(255,255,255,0.06)", overflow: "hidden",
                    }}>
                        <div style={{
                            width: `${Math.min(pct, 100)}%`, height: "100%",
                            borderRadius: "100px", background: barColor,
                            transition: "width 400ms var(--ease-smooth)",
                        }} />
                    </div>
                    {pct >= 80 && (
                        <p style={{ fontSize: "0.7rem", color: barColor, marginTop: "6px" }}>
                            {pct >= 100
                                ? "⚠️ Límite alcanzado: el agente dejó de responder con IA. Mejora tu plan para reactivarlo."
                                : "⏳ Estás cerca del límite mensual de tu plan."}
                        </p>
                    )}
                </div>
            )}

            {error && (
                <p style={{ fontSize: "0.74rem", color: "var(--danger)", marginBottom: "12px" }}>{error}</p>
            )}

            {/* Acciones */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {meta.next && (
                    <Button
                        icon={<Zap size={14} />}
                        loading={redirecting === `checkout${meta.next}`}
                        onClick={() => goTo("checkout", meta.next)}
                    >
                        Mejorar a {meta.nextLabel} — {meta.nextPrice}/mes
                    </Button>
                )}
                {plan !== "free" && (
                    <Button
                        variant="secondary"
                        icon={<ExternalLink size={14} />}
                        loading={redirecting === "portal"}
                        onClick={() => goTo("portal")}
                    >
                        Gestionar suscripción
                    </Button>
                )}
            </div>
        </SectionCard>
    );
}

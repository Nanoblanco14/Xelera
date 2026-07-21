"use client";
// ═══════════════════════════════════════════════════════════════
//  🔗 WEBHOOK CRM (Executive) — settings.outbound_webhook
//  Eventos firmados HMAC-SHA256: lead_updated, appointment_booked,
//  handoff. Gated por flag outbound_webhooks del plan.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { Link2, Lock } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import SaveButton from "@/components/ui/SaveButton";
import { Field, Toggle, Badge, Button } from "@/components/ui";
import { useOrg } from "@/lib/org-context";
import { getPlanLimits } from "@/lib/plan-limits";

export default function OutboundWebhookSection() {
    const { organization } = useOrg();
    const plan = (organization.plan as string) || "free";
    const allowed = getPlanLimits(plan).outbound_webhooks;

    const settings = (organization.settings || {}) as Record<string, unknown>;
    const cfg = (settings.outbound_webhook || {}) as Record<string, unknown>;

    const [enabled, setEnabled] = useState(cfg.enabled === true);
    const [url, setUrl] = useState(String(cfg.url || ""));
    const [secret, setSecret] = useState(String(cfg.secret || ""));
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [error, setError] = useState("");

    const save = async () => {
        if (enabled && !/^https:\/\//.test(url)) {
            setError("La URL debe ser https://");
            return;
        }
        setSaving("webhook");
        setError("");
        try {
            const res = await fetch("/api/org/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organization_id: organization.id,
                    settings: {
                        ...settings,
                        outbound_webhook: { enabled, url: url.trim(), secret: secret.trim() },
                    },
                }),
            });
            if (!res.ok) setError("No se pudo guardar");
            else {
                settings.outbound_webhook = { enabled, url: url.trim(), secret: secret.trim() };
                setSaved("webhook");
                setTimeout(() => setSaved(null), 2500);
            }
        } catch { setError("Error de conexión"); }
        setSaving(null);
    };

    // ── Candado de plan (upsell) ──────────────────────────────
    if (!allowed) {
        return (
            <SectionCard
                icon={<Link2 size={16} />}
                title="Webhook CRM"
                subtitle="Conecta Xelera con tu CRM, Make o Zapier"
            >
                <div style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "10px 0", flexWrap: "wrap",
                }}>
                    <Lock size={18} style={{ color: "var(--text-muted)" }} />
                    <p style={{ flex: 1, fontSize: "0.8rem", color: "var(--text-muted)", minWidth: "200px" }}>
                        Recibe cada lead, cita y derivación en tu CRM al instante,
                        con eventos firmados. Disponible en el plan <strong>Executive</strong>.
                    </p>
                    <Badge color="#c4a35a">EXECUTIVE</Badge>
                    <Button size="sm" variant="secondary" onClick={() => {
                        document.querySelector("[class*='glass-card']")?.scrollIntoView({ behavior: "smooth" });
                    }}>
                        Ver planes
                    </Button>
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard
            icon={<Link2 size={16} />}
            title="Webhook CRM"
            subtitle="Eventos firmados (HMAC-SHA256) hacia tu CRM, Make o Zapier"
            footer={
                <SaveButton
                    label="Guardar webhook"
                    section="webhook"
                    saving={saving}
                    saved={saved}
                    onClick={save}
                />
            }
        >
            <Toggle
                active={enabled}
                onToggle={() => setEnabled(!enabled)}
                label="Emitir eventos salientes"
                description="lead_updated · appointment_booked · handoff"
                hasBorder={false}
            />

            <Field
                label="URL de destino"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.tu-crm.com/xelera"
                error={error || undefined}
            />

            <Field
                label="Secreto de firma"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="un-secreto-largo-compartido"
                hint={
                    <>Verifica cada request: <code style={{ color: "var(--accent-light)" }}>
                        hmac_sha256(secreto, `${"{timestamp}"}.${"{body}"}`)
                    </code> vs. header <code style={{ color: "var(--accent-light)" }}>X-Xelera-Signature</code></>
                }
            />
        </SectionCard>
    );
}

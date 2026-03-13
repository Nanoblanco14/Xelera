"use client";
import { useOrg } from "@/lib/org-context";
import { useEffect, useState, useCallback } from "react";
import { updateTenantSettings, loadTenantSettings } from "./actions";
import { Loader2, AlertCircle } from "lucide-react";
import {
    OrgInfoSection,
    ApiKeySection,
    WhatsAppSetupSection,
    BusinessHoursSection,
    AppointmentConfigSection,
    BlockedDatesSection,
    AutoTemplateSection,
} from "@/components/settings";
import type { ConnectionStatus } from "@/lib/hooks/useWhatsAppConnection";

/* ── Group divider ─────────────────────────────────────────── */
function GroupHeader({ label }: { label: string }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "8px",
            }}
        >
            <span
                style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.25)",
                }}
            >
                {label}
            </span>
            <div
                style={{
                    flex: 1,
                    height: "1px",
                    background: "var(--border)",
                }}
            />
        </div>
    );
}

/* ── Settings page ─────────────────────────────────────────── */
export default function SettingsPage() {
    const { organization, role } = useOrg();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [metaToken, setMetaToken] = useState("");
    const [metaPhoneId, setMetaPhoneId] = useState("");
    const [businessAccountId, setBusinessAccountId] = useState("");
    const [waStatus, setWaStatus] = useState<ConnectionStatus | undefined>(undefined);

    // ── Load settings on mount ────────────────────────────────
    useEffect(() => {
        (async () => {
            const data = await loadTenantSettings(organization.id);
            if (data) {
                setApiKey(data.openai_api_key);
                if (data.whatsapp_credentials?.access_token)
                    setMetaToken(data.whatsapp_credentials.access_token);
                if (data.whatsapp_credentials?.phone_number_id)
                    setMetaPhoneId(data.whatsapp_credentials.phone_number_id);
                if (data.whatsapp_credentials?.business_account_id)
                    setBusinessAccountId(data.whatsapp_credentials.business_account_id);
            }
            setLoading(false);
        })();
    }, [organization.id]);

    // ── Fetch WhatsApp connection status ─────────────────────
    useEffect(() => {
        if (loading) return;
        (async () => {
            try {
                const res = await fetch(`/api/whatsapp/connect?org_id=${organization.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setWaStatus(data);
                }
            } catch {
                // Silent fail
            }
        })();
    }, [organization.id, loading]);

    // ── Generic save handler ──────────────────────────────────
    const saveSection = useCallback(
        async (section: string, payload: Parameters<typeof updateTenantSettings>[0]) => {
            setSaving(section);
            setError("");
            setSaved(null);
            const result = await updateTenantSettings(payload);
            if (result.success) {
                setSaved(section);
                setTimeout(() => setSaved(null), 2500);
            } else {
                setError(result.error || "Error guardando");
            }
            setSaving(null);
        },
        []
    );

    // ── Loading state ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="animate-in flex items-center justify-center min-h-[60vh]">
                <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configuracion</h1>
                    <p className="page-subtitle">
                        Gestiona tu cuenta, conexiones y horarios
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl mb-5 text-sm max-w-[720px] bg-red-500/[0.07] border border-red-500/[0.14] text-[var(--danger)]">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <div className="grid gap-4 max-w-[720px]">
                {/* ── General ─────────────────────────────────── */}
                <GroupHeader label="General" />
                <OrgInfoSection organization={organization} role={role} />
                <ApiKeySection
                    apiKey={apiKey}
                    onApiKeyChange={setApiKey}
                    saving={saving}
                    saved={saved}
                    onSave={() =>
                        saveSection("apikey", {
                            orgId: organization.id,
                            openai_api_key: apiKey,
                        })
                    }
                />

                {/* ── WhatsApp ────────────────────────────────── */}
                <GroupHeader label="WhatsApp" />
                <WhatsAppSetupSection
                    metaToken={metaToken}
                    metaPhoneId={metaPhoneId}
                    businessAccountId={businessAccountId}
                    onMetaTokenChange={setMetaToken}
                    onMetaPhoneIdChange={setMetaPhoneId}
                    onBusinessAccountIdChange={setBusinessAccountId}
                    orgId={organization.id}
                    initialStatus={waStatus}
                />

                {/* ── Agenda ──────────────────────────────────── */}
                <GroupHeader label="Agenda" />
                <BusinessHoursSection orgId={organization.id} />
                <AppointmentConfigSection
                    orgId={organization.id}
                    orgSettings={
                        (organization.settings as Record<string, unknown>) || {}
                    }
                />
                <BlockedDatesSection orgId={organization.id} />

                {/* ── Automatizacion ────────────────────────── */}
                <GroupHeader label="Automatizacion" />
                <AutoTemplateSection
                    orgId={organization.id}
                    orgSettings={
                        (organization.settings as Record<string, unknown>) || {}
                    }
                />
            </div>
        </div>
    );
}
